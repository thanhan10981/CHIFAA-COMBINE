begin;
set local lock_timeout='5s';

-- Keep removed order lines for audit. Only submitted orders can be revised;
-- approved/fulfilled snapshots remain immutable.
alter table public.customer_order_items
 add column cancelled_at timestamptz,
 add column cancellation_reason text;

create table public.customer_order_item_changes(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.customer_orders(id),
 order_item_id uuid references public.customer_order_items(id),action text not null check(action in('add','edit','remove')),
 reason text not null,previous_values jsonb,current_values jsonb,
 version bigint not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
insert into private.table_modules(table_name,module) values('customer_order_item_changes','orders') on conflict do nothing;
alter table public.customer_order_item_changes enable row level security;
create policy customer_order_item_changes_read on public.customer_order_item_changes for select to authenticated using((select private.can('orders','view')));
create trigger customer_order_item_changes_audit before insert or update or delete on public.customer_order_item_changes for each row execute function private.record_change('orders');
grant select on public.customer_order_item_changes to authenticated;
revoke all on public.customer_order_item_changes from anon;

create function public.revise_submitted_order_item(
 p_order uuid,p_expected_version bigint,p_action text,p_product uuid,p_quantity numeric,p_reason text,p_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; o public.customer_orders; p public.products; line public.customer_order_items; old_values jsonb; new_values jsonb; price bigint; discount numeric; result jsonb;
begin
 if not private.can('orders','approve') then raise exception 'FORBIDDEN';end if;
 if p_key is null or p_order is null or p_expected_version is null or p_action is null or p_action not in('add','edit','remove') or length(trim(coalesce(p_reason,'')))<3 then raise exception 'INVALID_ORDER_ITEM_CHANGE';end if;
 if p_action='remove' and p_product is null then raise exception 'PRODUCT_REQUIRED';end if;
 if p_action in('add','edit') and (p_product is null or p_quantity is null or p_quantity<=0 or p_quantity>999999999999) then raise exception 'INVALID_ORDER_QUANTITY';end if;
 cached=private.begin_request(p_key,'order:revise-item',jsonb_build_object('order',p_order,'version',p_expected_version,'action',p_action,'product',p_product,'quantity',p_quantity,'reason',p_reason));
 if cached is not null then return cached;end if;
 select * into strict o from public.customer_orders where id=p_order for update;
 if o.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if o.status<>'submitted' then raise exception 'ORDER_ITEM_EDIT_REQUIRES_SUBMITTED';end if;
 if p_action='add' then
  select * into p from public.products where id=p_product and published and not archived;
  if p.id is null then raise exception 'PRODUCT_NOT_AVAILABLE';end if;
 end if;
 select * into line from public.customer_order_items where order_id=p_order and product_id=p_product for update;
 if p_action='remove' then
  if line.id is null or line.cancelled_at is not null then raise exception 'ORDER_ITEM_NOT_FOUND';end if;
  old_values=to_jsonb(line);
  update public.customer_order_items set cancelled_at=now(),cancellation_reason=trim(p_reason) where id=line.id returning * into line;
  new_values=to_jsonb(line);
 elsif p_action='edit' then
  if line.id is null or line.cancelled_at is not null then raise exception 'ORDER_ITEM_NOT_FOUND';end if;
  old_values=to_jsonb(line);
  update public.customer_order_items set quantity=p_quantity where id=line.id returning * into line;
  update public.customer_order_item_toppings set quantity=p_quantity where order_item_id=line.id;
  new_values=to_jsonb(line);
 else
  if line.id is not null and line.cancelled_at is null then raise exception 'ORDER_ITEM_ALREADY_EXISTS';end if;
  discount=0;
  if o.store_id is not null then select x.price_vnd,coalesce(x.discount_rate,0) into price,discount from private.commercial_offer(o.store_id,p.id,o.delivery_date) x;end if;
  if price is null then select pp.price_vnd into price from public.product_prices pp where pp.product_id=p.id and pp.effective_from<=o.delivery_date order by pp.effective_from desc limit 1;discount=0;end if;
  if price is null then raise exception 'PRODUCT_PRICE_NOT_FOUND';end if;
  if line.id is not null then
   old_values=to_jsonb(line);
   update public.customer_order_items set quantity=p_quantity,cancelled_at=null,cancellation_reason=null,
    price_vnd=price,discount_rate=coalesce(discount,0),product_name=p.name,product_code=p.code,sale_unit=p.sale_unit
    where id=line.id returning * into line;
   update public.customer_order_item_toppings set quantity=p_quantity where order_item_id=line.id;
  else
   insert into public.customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate,product_name,product_code,sale_unit)
    values(p_order,p.id,p_quantity,price,coalesce(discount,0),p.name,p.code,p.sale_unit) returning * into line;
  end if;
  new_values=to_jsonb(line);
 end if;
 insert into public.customer_order_item_changes(order_id,order_item_id,action,reason,previous_values,current_values)
 values(p_order,line.id,p_action,trim(p_reason),old_values,new_values);
 update public.customer_orders set updated_at=now() where id=p_order;
 result=private.finish_request(p_key,jsonb_build_object('order_id',p_order,'order_item_id',line.id,'action',p_action,'version',o.version+1));
 return result;
end $$;
revoke all on function public.revise_submitted_order_item(uuid,bigint,text,uuid,numeric,text,uuid) from public,anon;
grant execute on function public.revise_submitted_order_item(uuid,bigint,text,uuid,numeric,text,uuid) to authenticated;

-- Never expose cancelled order lines in operational detail or totals.
do $patch$
declare d text;
begin
 select pg_get_functiondef('public.order_delivery_detail(uuid)'::regprocedure) into d;
 if position('where i.order_id=p_order' in d)=0 then raise exception 'ORDER_DETAIL_CANCELLED_LINE_PATCH_MISMATCH';end if;
 d=replace(d,'where i.order_id=p_order','where i.order_id=p_order and i.cancelled_at is null');
 execute d;
 select pg_get_functiondef('public.order_customer_summary(date)'::regprocedure) into d;
 if position('where i.order_id=o.id' in d)=0 then raise exception 'ORDER_SUMMARY_CANCELLED_LINE_PATCH_MISMATCH';end if;
 d=replace(d,'where i.order_id=o.id','where i.order_id=o.id and i.cancelled_at is null');
 d=replace(d,'where i.product_id=p.id and o.delivery_date=p_date','where i.product_id=p.id and i.cancelled_at is null and o.delivery_date=p_date');
 d=replace(d,'where i.product_id=p.id and o.delivery_date=p_date','where i.product_id=p.id and i.cancelled_at is null and o.delivery_date=p_date');
 execute d;
 select pg_get_functiondef('public.order_material_demand(date)'::regprocedure) into d;
 if position('from public.customer_order_items i join public.customer_orders o' in d)=0 then raise exception 'ORDER_DEMAND_CANCELLED_LINE_PATCH_MISMATCH';end if;
 d=replace(d,'where o.delivery_date=p_date and o.status','where i.cancelled_at is null and o.delivery_date=p_date and o.status');
 execute d;
 select pg_get_functiondef('public.fulfill_order_delivery(uuid,bigint,uuid)'::regprocedure) into d;
 if position('where order_id=p_order' in d)=0 then raise exception 'ORDER_FULFILL_CANCELLED_LINE_PATCH_MISMATCH';end if;
 d=replace(d,'where order_id=p_order','where order_id=p_order and cancelled_at is null');
 execute d;
 select pg_get_functiondef('public.review_order(uuid,bigint,boolean,text,uuid)'::regprocedure) into d;
 if position('new_status=case when p_approve' in d)=0 then raise exception 'ORDER_REVIEW_NONEMPTY_PATCH_MISMATCH';end if;
 d=replace(d,'new_status=case when p_approve','if p_approve and not exists(select 1 from public.customer_order_items where order_id=p_order and cancelled_at is null) then raise exception ''ORDER_ITEMS_REQUIRED'';end if; new_status=case when p_approve');
 execute d;
 select pg_get_functiondef('public.order_review_toppings(uuid)'::regprocedure) into d;
 if position('where i.order_id=p_order' in d)=0 then raise exception 'ORDER_TOPPING_CANCELLED_LINE_PATCH_MISMATCH';end if;
 d=replace(d,'where i.order_id=p_order','where i.order_id=p_order and i.cancelled_at is null');
 execute d;
end $patch$;
commit;

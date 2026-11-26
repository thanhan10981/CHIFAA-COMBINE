begin;
set local lock_timeout='5s';

-- Server-side date filtering keeps pagination scoped to the selected delivery day.
drop function public.order_review_queue(integer,integer);
create function public.order_review_queue(p_offset integer default 0,p_limit integer default 25,p_date date default null)
returns table(
 id uuid,version bigint,store_id uuid,customer_id uuid,delivery_date date,shift text,status text,note text,
 guest_name text,guest_phone text,guest_address text,store_code text,store_name text,customer_payment_method text
)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can('orders','view') then raise exception 'FORBIDDEN';end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 or (p_date is not null and not isfinite(p_date)) then raise exception 'INVALID_FILTER';end if;
 return query select o.id,o.version,o.store_id,o.customer_id,o.delivery_date,o.shift,o.status,o.note,
  o.guest_name,o.guest_phone,o.guest_address,s.code,s.name,o.customer_payment_method
 from public.customer_orders o left join public.stores s on s.id=o.store_id
 where p_date is null or o.delivery_date=p_date
 order by o.created_at desc,o.id desc offset p_offset limit p_limit;
end $$;
revoke all on function public.order_review_queue(integer,integer,date) from public,anon,authenticated;
grant execute on function public.order_review_queue(integer,integer,date) to authenticated;

-- Cancellation is a linked status change; remove its contribution from an open
-- production plan while retaining the order, items, status history and audit.
create function public.cancel_approved_order(p_order uuid,p_expected_version bigint,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; o public.customer_orders; plan public.production_plans; item record;
begin
 if not private.can('orders','approve') then raise exception 'FORBIDDEN';end if;
 if p_order is null or p_expected_version is null or p_key is null or length(trim(coalesce(p_reason,'')))<3 then raise exception 'INVALID_ORDER_CANCELLATION';end if;
 cached=private.begin_request(p_key,'order:cancel-approved',jsonb_build_object('order',p_order,'version',p_expected_version,'reason',p_reason));
 if cached is not null then return cached;end if;
 select * into strict o from public.customer_orders where id=p_order for update;
 if o.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if o.status not in('approved','scheduled') then raise exception 'ORDER_NOT_CANCELLABLE';end if;
 if exists(select 1 from public.deliveries where order_id=p_order) then raise exception 'ORDER_ALREADY_DELIVERED';end if;
 if o.plan_id is not null then
  if not private.can('production','edit') then raise exception 'FORBIDDEN_PRODUCTION_EDIT';end if;
  select * into strict plan from public.production_plans where id=o.plan_id for update;
  if plan.status not in('approved') or exists(select 1 from public.production_batches where plan_id=o.plan_id and status<>'reversed') then raise exception 'ORDER_PLAN_ALREADY_IN_PRODUCTION';end if;
  for item in select product_id,sum(quantity) quantity from public.customer_order_items where order_id=p_order and cancelled_at is null group by product_id loop
   update public.production_plan_lines set planned_quantity=planned_quantity-item.quantity where plan_id=o.plan_id and product_id=item.product_id and planned_quantity>=item.quantity;
   if not found then raise exception 'ORDER_PLAN_QUANTITY_MISMATCH';end if;
  end loop;
 end if;
 update public.customer_orders set status='cancelled',rejection_reason=trim(p_reason) where id=p_order;
 insert into public.order_status_history(order_id,from_status,to_status,note) values(p_order,o.status,'cancelled',trim(p_reason));
 return private.finish_request(p_key,jsonb_build_object('order_id',p_order,'status','cancelled'));
end $$;
revoke all on function public.cancel_approved_order(uuid,bigint,text,uuid) from public,anon;
grant execute on function public.cancel_approved_order(uuid,bigint,text,uuid) to authenticated;

-- Approved orders can be corrected only before any delivery or production batch.
-- Plan totals are changed by the order's delta, never by replacing other sources.
create function public.revise_approved_order_item(
 p_order uuid,p_expected_version bigint,p_action text,p_product uuid,p_quantity numeric,p_reason text,p_key uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; o public.customer_orders; line public.customer_order_items; old_values jsonb; new_values jsonb; item record; delta numeric;
begin
 if not private.can('orders','approve') then raise exception 'FORBIDDEN';end if;
 if p_order is null or p_expected_version is null or p_key is null or p_action not in('edit','remove') or p_product is null or length(trim(coalesce(p_reason,'')))<3 then raise exception 'INVALID_ORDER_ITEM_CHANGE';end if;
 if p_action='edit' and (p_quantity is null or p_quantity<=0 or p_quantity>999999999999) then raise exception 'INVALID_ORDER_QUANTITY';end if;
 cached=private.begin_request(p_key,'order:revise-approved-item',jsonb_build_object('order',p_order,'version',p_expected_version,'action',p_action,'product',p_product,'quantity',p_quantity,'reason',p_reason));
 if cached is not null then return cached;end if;
 select * into strict o from public.customer_orders where id=p_order for update;
 if o.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if o.status not in('approved','scheduled') then raise exception 'ORDER_NOT_EDITABLE';end if;
 if exists(select 1 from public.deliveries where order_id=p_order) then raise exception 'ORDER_ALREADY_DELIVERED';end if;
 if o.plan_id is not null then
  if not private.can('production','edit') then raise exception 'FORBIDDEN_PRODUCTION_EDIT';end if;
  perform 1 from public.production_plans where id=o.plan_id and status='approved' for update;
  if not found or exists(select 1 from public.production_batches where plan_id=o.plan_id and status<>'reversed') then raise exception 'ORDER_PLAN_ALREADY_IN_PRODUCTION';end if;
 end if;
 select * into line from public.customer_order_items where order_id=p_order and product_id=p_product and cancelled_at is null for update;
 if line.id is null then raise exception 'ORDER_ITEM_NOT_FOUND';end if;
 if p_action='remove' and (select count(*) from public.customer_order_items where order_id=p_order and cancelled_at is null)<=1 then raise exception 'ORDER_ITEMS_REQUIRED';end if;
 old_values=to_jsonb(line);
 delta=case when p_action='edit' then p_quantity-line.quantity else -line.quantity end;
 if o.plan_id is not null and delta<>0 then
  update public.production_plan_lines set planned_quantity=planned_quantity+delta
   where plan_id=o.plan_id and product_id=p_product and planned_quantity+delta>=0;
  if not found then raise exception 'ORDER_PLAN_QUANTITY_MISMATCH';end if;
 end if;
 if p_action='remove' then
  update public.customer_order_items set cancelled_at=now(),cancellation_reason=trim(p_reason) where id=line.id returning * into line;
 else
  update public.customer_order_items set quantity=p_quantity where id=line.id returning * into line;
  update public.customer_order_item_toppings set quantity=p_quantity where order_item_id=line.id;
 end if;
 new_values=to_jsonb(line);
 insert into public.customer_order_item_changes(order_id,order_item_id,action,reason,previous_values,current_values)
 values(p_order,line.id,p_action,trim(p_reason),old_values,new_values);
 update public.customer_orders set updated_at=now() where id=p_order;
 return private.finish_request(p_key,jsonb_build_object('order_id',p_order,'order_item_id',line.id,'action',p_action,'version',o.version+1));
end $$;
revoke all on function public.revise_approved_order_item(uuid,bigint,text,uuid,numeric,text,uuid) from public,anon;
grant execute on function public.revise_approved_order_item(uuid,bigint,text,uuid,numeric,text,uuid) to authenticated;

-- Cancelled orders disappear from the date summary as if they were never active;
-- the underlying order and audit trail remain available in the review list.
do $patch$
declare definition text;
begin
 select pg_get_functiondef('public.order_customer_summary(date)'::regprocedure) into definition;
 if position('where o.delivery_date=p_date;' in definition)=0 then raise exception 'CANCELLED_ORDER_SUMMARY_PATCH_MISMATCH';end if;
 execute replace(definition,'where o.delivery_date=p_date;','where o.delivery_date=p_date and o.status<>''cancelled'';');
end
$patch$;

commit;

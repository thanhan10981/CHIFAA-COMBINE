begin;

-- A posted delivery is the stock movement for finished goods. Ingredient
-- issues remain tied to production; completing an order never issues them a
-- second time. Support for returned order goods is recorded separately and
-- deliberately has no inventory or cash-ledger relation.
create unique index deliveries_one_posted_order_idx
 on public.deliveries(order_id) where order_id is not null and status='posted';
create index production_batch_lines_product_stock_idx on public.production_batch_lines(product_id,batch_id);
create index delivery_items_product_stock_idx on public.delivery_items(product_id,delivery_id);
create index sales_lines_product_stock_idx on public.sales_lines(product_id,document_id);

insert into private.table_modules values('order_return_supports','returns');
create table public.order_return_supports (
 id uuid primary key default gen_random_uuid(),
 delivery_id uuid not null references public.deliveries(id),
 returned_on date not null,
 reason text not null check(length(trim(reason)) between 3 and 2000),
 status text not null default 'posted' check(status in ('posted','reversed')),
 reversed_on date,
 reversal_reason text,
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),updated_by uuid references auth.users(id),
 check((status='posted' and reversed_on is null and reversal_reason is null) or
       (status='reversed' and reversed_on is not null and length(trim(coalesce(reversal_reason,'')))>=3))
);
alter table public.order_return_supports enable row level security;
create policy order_return_supports_read on public.order_return_supports for select to authenticated using((select private.can('returns','view')));
create trigger order_return_supports_audit before insert or update or delete on public.order_return_supports for each row execute function private.record_change('returns');
grant select on public.order_return_supports to authenticated;
revoke all on public.order_return_supports from anon;

insert into private.table_modules values('order_return_support_lines','returns');
create table public.order_return_support_lines (
 id uuid primary key default gen_random_uuid(),
 support_id uuid not null references public.order_return_supports(id),
 delivery_item_id uuid not null references public.delivery_items(id),
 quantity numeric(20,6) not null check(quantity>0),
 support_unit_price_vnd bigint not null check(support_unit_price_vnd>=0),
 support_amount_vnd bigint not null check(support_amount_vnd>=0),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),updated_by uuid references auth.users(id),
 unique(support_id,delivery_item_id)
);
alter table public.order_return_support_lines enable row level security;
create policy order_return_support_lines_read on public.order_return_support_lines for select to authenticated using((select private.can('returns','view')));
create trigger order_return_support_lines_audit before insert or update or delete on public.order_return_support_lines for each row execute function private.record_change('returns');
grant select on public.order_return_support_lines to authenticated;
revoke all on public.order_return_support_lines from anon;

create function private.finished_goods_balance(p_product uuid,p_date date) returns numeric
language sql stable security definer set search_path='' as $$
 select
  coalesce((select sum(l.main_quantity+l.extra_quantity-l.rejected_quantity)
   from public.production_batch_lines l join public.production_batches b on b.id=l.batch_id
   where l.product_id=p_product and b.status='posted' and coalesce(b.delivery_date,b.produced_on)<=p_date),0)
  -coalesce((select sum(i.quantity) from public.delivery_items i join public.deliveries d on d.id=i.delivery_id
   where i.product_id=p_product and d.status='posted' and d.delivery_date<=p_date),0)
  -coalesce((select sum(l.delivered) from public.sales_lines l join public.sales_documents d on d.id=l.document_id
   where l.product_id=p_product and d.status='posted' and d.sold_on<=p_date
    and not exists(select 1 from public.deliveries x where x.id=d.delivery_id and x.status='posted')),0)
$$;
revoke all on function private.finished_goods_balance(uuid,date) from public,anon,authenticated;

-- For a backdated delivery, preserve every later posted commitment too. The
-- minimum end-of-day balance from the order date forward is the safe amount.
create function private.finished_goods_min_balance(p_product uuid,p_date date) returns numeric
language sql stable security definer set search_path='' as $$
 with movements as(
  select coalesce(b.delivery_date,b.produced_on) movement_date,sum(l.main_quantity+l.extra_quantity-l.rejected_quantity) delta
  from public.production_batch_lines l join public.production_batches b on b.id=l.batch_id
  where l.product_id=p_product and b.status='posted' and coalesce(b.delivery_date,b.produced_on)>p_date group by 1
  union all
  select d.delivery_date,-sum(i.quantity) from public.delivery_items i join public.deliveries d on d.id=i.delivery_id
  where i.product_id=p_product and d.status='posted' and d.delivery_date>p_date group by d.delivery_date
  union all
  select d.sold_on,-sum(l.delivered) from public.sales_lines l join public.sales_documents d on d.id=l.document_id
  where l.product_id=p_product and d.status='posted' and d.sold_on>p_date
   and not exists(select 1 from public.deliveries x where x.id=d.delivery_id and x.status='posted') group by d.sold_on
 ),daily as(select movement_date,sum(delta) delta from movements group by movement_date),base as(
  select private.finished_goods_balance(p_product,p_date) quantity
 ),running as(
  select base.quantity+sum(daily.delta) over(order by daily.movement_date rows between unbounded preceding and current row) quantity
  from daily cross join base
 ) select least(base.quantity,coalesce((select min(quantity) from running),base.quantity)) from base
$$;
revoke all on function private.finished_goods_min_balance(uuid,date) from public,anon,authenticated;

create function public.order_delivery_detail(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare current_order public.customer_orders; delivery public.deliveries; items jsonb; supports jsonb;
begin
 if not private.can('orders','view') then raise exception 'FORBIDDEN';end if;
 select * into strict current_order from public.customer_orders where id=p_order;
 select * into delivery from public.deliveries where order_id=p_order and status='posted' order by created_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object(
  'order_item_id',i.id,'product_id',i.product_id,'product_code',coalesce(i.product_code,p.code),
  'product_name',coalesce(i.product_name,p.name),'sale_unit',coalesce(i.sale_unit,p.sale_unit),
  'ordered_quantity',i.quantity::text,'price_vnd',i.price_vnd::text,
  'available_quantity',case when private.can('production','view') then private.finished_goods_min_balance(i.product_id,current_order.delivery_date)::text else null end,
  'delivery_item_id',di.id,'delivered_quantity',coalesce(di.quantity,0)::text,
  'returned_quantity',coalesce((select sum(rl.quantity) from public.order_return_support_lines rl
   join public.order_return_supports rs on rs.id=rl.support_id where rl.delivery_item_id=di.id and rs.status='posted'),0)::text
  ) order by p.code,i.id),'[]') into items
 from public.customer_order_items i join public.products p on p.id=i.product_id
 left join public.delivery_items di on di.delivery_id=delivery.id and di.product_id=i.product_id
 where i.order_id=p_order;
 if delivery.id is not null and private.can('returns','view') then
  select coalesce(jsonb_agg(jsonb_build_object(
   'id',s.id,'returned_on',s.returned_on,'reason',s.reason,'status',s.status,
   'reversed_on',s.reversed_on,'reversal_reason',s.reversal_reason,
   'total_support_vnd',(select coalesce(sum(l.support_amount_vnd),0)::text from public.order_return_support_lines l where l.support_id=s.id),
   'lines',(select coalesce(jsonb_agg(jsonb_build_object('delivery_item_id',l.delivery_item_id,'quantity',l.quantity::text,
    'support_unit_price_vnd',l.support_unit_price_vnd::text,'support_amount_vnd',l.support_amount_vnd::text,
    'product_code',p.code,'product_name',p.name,'sale_unit',p.sale_unit) order by p.code),'[]')
    from public.order_return_support_lines l join public.delivery_items di on di.id=l.delivery_item_id join public.products p on p.id=di.product_id where l.support_id=s.id)
  ) order by s.returned_on desc,s.created_at desc),'[]') into supports
  from public.order_return_supports s where s.delivery_id=delivery.id;
 else supports='[]'::jsonb;end if;
 return jsonb_build_object('order_id',current_order.id,'order_status',current_order.status,
  'delivery',case when delivery.id is null then null else jsonb_build_object('id',delivery.id,'delivery_date',delivery.delivery_date,'status',delivery.status,'version',delivery.version::text) end,
  'items',items,'return_supports',supports);
end $$;

create function public.fulfill_order_delivery(p_order uuid,p_expected_version bigint,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_order public.customer_orders; item record; delivery_id uuid; available numeric; result jsonb;
begin
 if not private.can('orders','approve') or not private.can('deliveries','create') or not private.can('deliveries','approve') or not private.can('production','view') then raise exception 'FORBIDDEN';end if;
 if p_key is null or p_order is null or p_expected_version is null then raise exception 'INVALID_REQUEST';end if;
 cached=private.begin_request(p_key,'order:fulfill-delivery',jsonb_build_object('order',p_order,'version',p_expected_version));if cached is not null then return cached;end if;
 select * into strict current_order from public.customer_orders where id=p_order for update;
 if current_order.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if current_order.status not in ('approved','scheduled') then raise exception 'INVALID_ORDER_STATUS';end if;
 if not isfinite(current_order.delivery_date) then raise exception 'INVALID_DELIVERY_DATE';end if;
 if current_order.store_id is null then raise exception 'ORDER_STORE_REQUIRED';end if;
 if exists(select 1 from public.accounting_periods where status='closed' and current_order.delivery_date between starts_on and ends_on) then raise exception 'PERIOD_CLOSED';end if;
 if not exists(select 1 from public.customer_order_items where order_id=p_order) then raise exception 'ORDER_ITEMS_REQUIRED';end if;
 -- Serialize competing orders for each finished product, including orders on
 -- different dates, before reading the production-minus-delivery balance.
 for item in select product_id from public.customer_order_items where order_id=p_order order by product_id loop
  perform pg_advisory_xact_lock(hashtextextended('finished-goods:'||item.product_id::text,0));
 end loop;
 for item in select product_id,quantity from public.customer_order_items where order_id=p_order order by product_id loop
  available=private.finished_goods_min_balance(item.product_id,current_order.delivery_date);
  if available<item.quantity then raise exception 'INSUFFICIENT_FINISHED_GOODS:%',item.product_id;end if;
 end loop;
 insert into public.deliveries(order_id,store_id,delivery_date,status)
  values(p_order,current_order.store_id,current_order.delivery_date,'posted') returning id into delivery_id;
 insert into public.delivery_items(delivery_id,product_id,quantity)
  select delivery_id,product_id,quantity from public.customer_order_items where order_id=p_order order by product_id;
 update public.customer_orders set status='fulfilled' where id=p_order;
 insert into public.order_status_history(order_id,from_status,to_status,note)
  values(p_order,current_order.status,'fulfilled','Giao đủ theo đơn; tồn thành phẩm giảm theo chứng từ giao.');
 if current_order.customer_id is not null then
  insert into public.notifications(user_id,order_id,title) values(current_order.customer_id,p_order,'Đơn hàng đã giao hoàn tất');
 end if;
 result=jsonb_build_object('order_id',p_order,'delivery_id',delivery_id,'delivery_date',current_order.delivery_date,'status','fulfilled');
 return private.finish_request(p_key,result);
end $$;

create function public.record_order_return_support(p_delivery uuid,p_returned_on date,p_lines jsonb,p_reason text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cached jsonb; delivery public.deliveries; item jsonb; line_id uuid; quantity numeric; unit_price bigint; amount numeric; support_id uuid; total numeric=0;
begin
 if not private.can('orders','view') or not private.can('returns','create') or not private.can('returns','approve') then raise exception 'FORBIDDEN';end if;
 if p_key is null or p_delivery is null or p_returned_on is null or length(trim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'INVALID_RETURN_SUPPORT';end if;
 if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'INVALID_RETURN_SUPPORT_LINES';end if;
 if jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'INVALID_RETURN_SUPPORT_LINES';end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x group by x->>'delivery_item_id' having count(*)>1) then raise exception 'DUPLICATE_RETURN_LINE';end if;
 cached=private.begin_request(p_key,'order:return-support',jsonb_build_object('delivery',p_delivery,'date',p_returned_on,'lines',p_lines,'reason',p_reason));if cached is not null then return cached;end if;
 select * into strict delivery from public.deliveries where id=p_delivery for update;
 if delivery.status<>'posted' or delivery.order_id is null then raise exception 'ORDER_DELIVERY_REQUIRED';end if;
 if p_returned_on<delivery.delivery_date or p_returned_on>(now() at time zone 'Asia/Ho_Chi_Minh')::date or not isfinite(p_returned_on) then raise exception 'INVALID_RETURN_DATE';end if;
 if exists(select 1 from public.accounting_periods where status='closed' and p_returned_on between starts_on and ends_on) then raise exception 'PERIOD_CLOSED';end if;
 for item in select value from jsonb_array_elements(p_lines) order by value->>'delivery_item_id' loop
  if coalesce(item->>'delivery_item_id','')!~'^[0-9a-fA-F-]{36}$' or coalesce(item->>'quantity','')!~'^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' or coalesce(item->>'support_unit_price_vnd','')!~'^(0|[1-9][0-9]{0,12})$' then raise exception 'INVALID_RETURN_SUPPORT_LINE';end if;
  line_id=(item->>'delivery_item_id')::uuid;quantity=(item->>'quantity')::numeric;unit_price=(item->>'support_unit_price_vnd')::bigint;
  if quantity<=0 then raise exception 'INVALID_RETURN_QUANTITY';end if;
  perform 1 from public.delivery_items where id=line_id and delivery_id=p_delivery for update;
  if not found then raise exception 'DELIVERY_ITEM_NOT_FOUND';end if;
  if quantity+coalesce((select sum(l.quantity) from public.order_return_support_lines l join public.order_return_supports s on s.id=l.support_id where l.delivery_item_id=line_id and s.status='posted'),0)>(select di.quantity from public.delivery_items di where di.id=line_id) then raise exception 'RETURN_QUANTITY_EXCEEDS_DELIVERY';end if;
  amount=round(quantity*unit_price);
  if amount>9223372036854775807 then raise exception 'SUPPORT_AMOUNT_OVERFLOW';end if;
  total=total+amount;
 end loop;
 if total>9223372036854775807 then raise exception 'SUPPORT_AMOUNT_OVERFLOW';end if;
 insert into public.order_return_supports(delivery_id,returned_on,reason,status) values(p_delivery,p_returned_on,trim(p_reason),'posted') returning id into support_id;
 for item in select value from jsonb_array_elements(p_lines) loop
  line_id=(item->>'delivery_item_id')::uuid;quantity=(item->>'quantity')::numeric;unit_price=(item->>'support_unit_price_vnd')::bigint;amount=round(quantity*unit_price);
  insert into public.order_return_support_lines(support_id,delivery_item_id,quantity,support_unit_price_vnd,support_amount_vnd)
   values(support_id,line_id,quantity,unit_price,amount::bigint);
 end loop;
 return private.finish_request(p_key,jsonb_build_object('support_id',support_id,'delivery_id',p_delivery,'total_support_vnd',total::bigint::text,'status','posted','inventory_returned',false,'automatically_paid',false));
end $$;

create function public.reverse_order_return_support(p_support uuid,p_expected_version bigint,p_reversed_on date,p_reason text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_support public.order_return_supports;
begin
 if not private.can('returns','approve') then raise exception 'FORBIDDEN';end if;
 if p_key is null or p_support is null or p_expected_version is null or p_reversed_on is null or length(trim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'INVALID_SUPPORT_REVERSAL';end if;
 cached=private.begin_request(p_key,'order:return-support-reverse',jsonb_build_object('support',p_support,'version',p_expected_version,'date',p_reversed_on,'reason',p_reason));if cached is not null then return cached;end if;
 select * into strict current_support from public.order_return_supports where id=p_support for update;
 if current_support.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if current_support.status<>'posted' then raise exception 'SUPPORT_ALREADY_REVERSED';end if;
 if p_reversed_on<current_support.returned_on or p_reversed_on>(now() at time zone 'Asia/Ho_Chi_Minh')::date or not isfinite(p_reversed_on) then raise exception 'INVALID_REVERSAL_DATE';end if;
 if exists(select 1 from public.accounting_periods where status='closed' and p_reversed_on between starts_on and ends_on) then raise exception 'PERIOD_CLOSED';end if;
 update public.order_return_supports set status='reversed',reversed_on=p_reversed_on,reversal_reason=trim(p_reason) where id=p_support;
 return private.finish_request(p_key,jsonb_build_object('support_id',p_support,'status','reversed','inventory_returned',false));
end $$;

revoke all on function public.order_delivery_detail(uuid),public.fulfill_order_delivery(uuid,bigint,uuid),public.record_order_return_support(uuid,date,jsonb,text,uuid),public.reverse_order_return_support(uuid,bigint,date,text,uuid) from public,anon;
grant execute on function public.order_delivery_detail(uuid),public.fulfill_order_delivery(uuid,bigint,uuid),public.record_order_return_support(uuid,date,jsonb,text,uuid),public.reverse_order_return_support(uuid,bigint,date,text,uuid) to authenticated;

commit;

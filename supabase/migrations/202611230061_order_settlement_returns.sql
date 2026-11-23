begin;

-- A delivered order may be collected immediately or left as a receivable.
-- Returned stock creates a carry-forward credit for the store's next order;
-- destroyed stock reduces only its own invoice and is tracked as a loss.
alter table public.order_return_supports
 add column disposition text not null default 'support' check(disposition in ('support','returned','destroyed')),
 add column warehouse_id uuid references public.warehouses(id),
 add column adjustment_id uuid references public.debt_adjustments(id);
alter table public.order_return_support_lines
 add column pricing_mode text not null default 'legacy' check(pricing_mode in ('legacy','unit_price','discount','order_price')),
 add column discount_rate numeric(8,6) check(discount_rate is null or discount_rate between 0 and 1);
alter table public.sales_documents
 add column delivery_payment_method text check(delivery_payment_method is null or delivery_payment_method in ('cash','bank','receivable')),
 add column delivery_paid_vnd bigint check(delivery_paid_vnd is null or delivery_paid_vnd>=0),
 add column delivery_old_deduction_vnd bigint check(delivery_old_deduction_vnd is null or delivery_old_deduction_vnd>=0);

alter table public.kiosk_return_lots
 add column order_return_support_line_id uuid references public.order_return_support_lines(id),
 add column unit_cost_vnd bigint check(unit_cost_vnd is null or unit_cost_vnd>=0);
drop index public.kiosk_return_source_active_idx;
create unique index kiosk_return_legacy_source_active_idx on public.kiosk_return_lots(source_line_id)
 where status<>'reversed' and order_return_support_line_id is null;
create unique index kiosk_return_order_line_active_idx on public.kiosk_return_lots(order_return_support_line_id)
 where order_return_support_line_id is not null and status<>'reversed';

insert into private.table_modules values('order_return_credit_applications','returns');
create table public.order_return_credit_applications (
 id uuid primary key default gen_random_uuid(),
 support_line_id uuid not null references public.order_return_support_lines(id),
 receivable_id uuid not null references public.receivables(id),
 amount_vnd bigint not null check(amount_vnd>0),
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),updated_by uuid references auth.users(id),
 unique(support_line_id,receivable_id)
);
alter table public.order_return_credit_applications enable row level security;
create policy order_return_credit_applications_read on public.order_return_credit_applications for select to authenticated using((select private.can('returns','view') or private.can('receivables','view')));
create trigger order_return_credit_applications_audit before insert or update or delete on public.order_return_credit_applications for each row execute function private.record_change('returns');
grant select on public.order_return_credit_applications to authenticated;
revoke all on public.order_return_credit_applications from anon;

insert into private.table_modules values('order_revenue_adjustments','returns');
create table public.order_revenue_adjustments (
 id uuid primary key default gen_random_uuid(),
 support_line_id uuid not null references public.order_return_support_lines(id),
 target_receivable_id uuid references public.receivables(id),
 business_date date not null,
 store_id uuid not null references public.stores(id),
 product_id uuid not null references public.products(id),
 kind text not null check(kind in ('destroyed','returned_credit','destroyed_reversal')),
 reverses_id uuid references public.order_revenue_adjustments(id),
 amount_vnd bigint not null check((kind in ('destroyed','returned_credit') and amount_vnd<0) or (kind='destroyed_reversal' and amount_vnd>0)),
 reason text not null,
 version bigint not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id),updated_by uuid references auth.users(id),
 check((kind='destroyed' and target_receivable_id is null and reverses_id is null) or
       (kind='returned_credit' and target_receivable_id is not null and reverses_id is null) or
       (kind='destroyed_reversal' and target_receivable_id is null and reverses_id is not null))
);
create unique index order_revenue_destroyed_once_idx on public.order_revenue_adjustments(support_line_id)
 where kind='destroyed';
create unique index order_revenue_credit_once_idx on public.order_revenue_adjustments(support_line_id,target_receivable_id)
 where kind='returned_credit';
create unique index order_revenue_reversal_once_idx on public.order_revenue_adjustments(reverses_id)
 where kind='destroyed_reversal';
alter table public.order_revenue_adjustments enable row level security;
create policy order_revenue_adjustments_read on public.order_revenue_adjustments for select to authenticated using((select private.can('returns','view') or private.can('sales','view')));
create trigger order_revenue_adjustments_audit before insert or update or delete on public.order_revenue_adjustments for each row execute function private.record_change('returns');
grant select on public.order_revenue_adjustments to authenticated;
revoke all on public.order_revenue_adjustments from anon;

create function public.record_order_return_event(p_delivery uuid,p_event_on date,p_disposition text,p_warehouse uuid,p_lines jsonb,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; delivery public.deliveries; support_id uuid; item jsonb; line_id uuid; sale_line public.sales_lines; qty numeric;
 mode text; unit_price bigint; discount numeric; amount numeric; total numeric=0; created_adjustment_id uuid; source_receivable uuid; kiosk_lot uuid; inserted_line uuid;
begin
 if not private.can('orders','view') or not private.can('returns','create') or not private.can('returns','approve') or not private.can('receivables','create') then raise exception 'FORBIDDEN';end if;
 if p_disposition not in ('returned','destroyed') or p_delivery is null or p_event_on is null or p_key is null or length(trim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'INVALID_ORDER_RETURN';end if;
 if p_disposition='returned' and (not private.can('kiosk','view') or not private.can('kiosk','approve') or p_warehouse is null or not exists(select 1 from public.warehouses where id=p_warehouse and active and kind='kiosk')) then raise exception 'KIOSK_WAREHOUSE_REQUIRED';end if;
 if p_disposition='destroyed' and p_warehouse is not null then raise exception 'INVALID_ORDER_RETURN';end if;
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'INVALID_ORDER_RETURN_LINES';end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x group by x->>'delivery_item_id' having count(*)>1) then raise exception 'DUPLICATE_RETURN_LINE';end if;
 cached=private.begin_request(p_key,'order:return-event',jsonb_build_object('delivery',p_delivery,'date',p_event_on,'disposition',p_disposition,'warehouse',p_warehouse,'lines',p_lines,'reason',p_reason));if cached is not null then return cached;end if;
 select * into strict delivery from public.deliveries where id=p_delivery for update;
 if delivery.status<>'posted' or delivery.order_id is null then raise exception 'ORDER_DELIVERY_REQUIRED';end if;
 if p_event_on<delivery.delivery_date or p_event_on>(now() at time zone 'Asia/Ho_Chi_Minh')::date or not isfinite(p_event_on) then raise exception 'INVALID_RETURN_DATE';end if;
 if exists(select 1 from public.accounting_periods where status='closed' and p_event_on between starts_on and ends_on) then raise exception 'PERIOD_CLOSED';end if;
 if p_disposition='returned' then perform pg_advisory_xact_lock(hashtextextended('order-return:'||delivery.id::text,0));end if;
 for item in select value from jsonb_array_elements(p_lines) order by value->>'delivery_item_id' loop
  if coalesce(item->>'delivery_item_id','')!~'^[0-9a-fA-F-]{36}$' or coalesce(item->>'quantity','')!~'^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' then raise exception 'INVALID_ORDER_RETURN_LINE';end if;
  line_id=(item->>'delivery_item_id')::uuid;qty=(item->>'quantity')::numeric;
  if qty<=0 then raise exception 'INVALID_RETURN_QUANTITY';end if;
  perform 1 from public.delivery_items where id=line_id and delivery_id=p_delivery for update;if not found then raise exception 'DELIVERY_ITEM_NOT_FOUND';end if;
  if qty+coalesce((select sum(l.quantity) from public.order_return_support_lines l join public.order_return_supports s on s.id=l.support_id where l.delivery_item_id=line_id and s.status='posted'),0)>(select di.quantity from public.delivery_items di where di.id=line_id) then raise exception 'RETURN_QUANTITY_EXCEEDS_DELIVERY';end if;
  select sl.* into strict sale_line from public.sales_lines sl join public.sales_documents sd on sd.id=sl.document_id where sd.delivery_id=p_delivery and sd.status='posted' and sl.product_id=(select product_id from public.delivery_items where id=line_id) for update of sl;
  if p_disposition='destroyed' then
   mode='order_price';discount=null;unit_price=round(sale_line.price_vnd*(1-sale_line.discount_rate))::bigint;amount=round(qty*unit_price);
  else
   mode=coalesce(item->>'pricing_mode','unit_price');
   if mode='unit_price' and coalesce(item->>'unit_price_vnd','')~'^(0|[1-9][0-9]{0,12})$' then unit_price=(item->>'unit_price_vnd')::bigint;discount=null;
   elsif mode='discount' and coalesce(item->>'discount_rate','')~'^(0|1)(\.[0-9]{1,6})?$' then discount=(item->>'discount_rate')::numeric;unit_price=round(sale_line.price_vnd*(1-sale_line.discount_rate)*(1-discount))::bigint;
   else raise exception 'INVALID_RETURN_PRICE';end if;
   amount=round(qty*unit_price);
  end if;
  if amount<0 or amount>9223372036854775807 then raise exception 'RETURN_AMOUNT_OVERFLOW';end if;
  total=total+amount;if total>9223372036854775807 then raise exception 'RETURN_AMOUNT_OVERFLOW';end if;
 end loop;
 insert into public.order_return_supports(delivery_id,returned_on,reason,status,disposition,warehouse_id)
  values(p_delivery,p_event_on,trim(p_reason),'posted',p_disposition,p_warehouse) returning id into support_id;
 for item in select value from jsonb_array_elements(p_lines) order by value->>'delivery_item_id' loop
  line_id=(item->>'delivery_item_id')::uuid;qty=(item->>'quantity')::numeric;
  select sl.* into strict sale_line from public.sales_lines sl join public.sales_documents sd on sd.id=sl.document_id where sd.delivery_id=p_delivery and sd.status='posted' and sl.product_id=(select product_id from public.delivery_items where id=line_id);
  if p_disposition='destroyed' then mode='order_price';discount=null;unit_price=round(sale_line.price_vnd*(1-sale_line.discount_rate))::bigint;amount=round(qty*unit_price);
  else mode=item->>'pricing_mode';if mode='unit_price' then unit_price=(item->>'unit_price_vnd')::bigint;discount=null;else discount=(item->>'discount_rate')::numeric;unit_price=round(sale_line.price_vnd*(1-sale_line.discount_rate)*(1-discount))::bigint;end if;amount=round(qty*unit_price);end if;
  insert into public.order_return_support_lines(support_id,delivery_item_id,quantity,support_unit_price_vnd,support_amount_vnd,pricing_mode,discount_rate)
   values(support_id,line_id,qty,unit_price,amount::bigint,mode,discount) returning id into inserted_line;
  if p_disposition='destroyed' and amount>0 then
   insert into public.order_revenue_adjustments(support_line_id,business_date,store_id,product_id,kind,amount_vnd,reason)
    select inserted_line,p_event_on,sd.store_id,sale_line.product_id,'destroyed',-amount::bigint,'Hàng hủy tại điểm bán; tham chiếu hoàn/hủy '||support_id::text
    from public.sales_documents sd where sd.id=sale_line.document_id;
  end if;
  if p_disposition='returned' then
   insert into public.kiosk_return_lots(source_line_id,source_line_version,source_document_version,product_id,store_id,quantity,approved_on,received_on,warehouse_id,unit_cost_vnd,status,note,order_return_support_line_id)
    select sl.id,sl.version,sd.version,sl.product_id,sd.store_id,qty,p_event_on,p_event_on,p_warehouse,unit_price,'received',trim(p_reason),inserted_line
    from public.sales_lines sl join public.sales_documents sd on sd.id=sl.document_id where sd.delivery_id=p_delivery and sl.product_id=(select product_id from public.delivery_items where id=line_id)
    returning id into kiosk_lot;
  end if;
 end loop;
 if p_disposition='destroyed' then
  select r.id into strict source_receivable from public.receivables r join public.sales_documents sd on sd.id=r.sales_document_id
   where sd.delivery_id=p_delivery and sd.status='posted' for update of r;
  if total>0 then
   insert into public.debt_adjustments(receivable_id,adjustment_on,amount_vnd,reason)
    values(source_receivable,p_event_on,-total::bigint,'Hủy tại điểm bán; giảm khoản phải thu riêng, không tạo khoản cấn trừ cho đơn kế tiếp. Tham chiếu hoàn/hủy '||support_id::text) returning id into created_adjustment_id;
   update public.order_return_supports set adjustment_id=created_adjustment_id where id=support_id;
  end if;
 end if;
 return private.finish_request(p_key,jsonb_build_object('support_id',support_id,'delivery_id',p_delivery,'disposition',p_disposition,'total_support_vnd',total::bigint::text,'credit_next_order',p_disposition='returned','inventory_received',p_disposition='returned'));
end $$;

create function public.reverse_order_return_event(p_support uuid,p_expected_version bigint,p_reversed_on date,p_reason text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; s public.order_return_supports; amount bigint; receivable_id uuid; reversal_id uuid;
begin
 if not private.can('returns','approve') then raise exception 'FORBIDDEN';end if;
 if p_support is null or p_expected_version is null or p_reversed_on is null or p_key is null or length(trim(coalesce(p_reason,''))) not between 3 and 2000 then raise exception 'INVALID_RETURN_REVERSAL';end if;
 cached=private.begin_request(p_key,'order:return-event-reverse',jsonb_build_object('support',p_support,'version',p_expected_version,'date',p_reversed_on,'reason',p_reason));if cached is not null then return cached;end if;
 select * into strict s from public.order_return_supports where id=p_support for update;
 if s.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if s.status<>'posted' then raise exception 'SUPPORT_ALREADY_REVERSED';end if;
 if p_reversed_on<s.returned_on or p_reversed_on>(now() at time zone 'Asia/Ho_Chi_Minh')::date or not isfinite(p_reversed_on) then raise exception 'INVALID_REVERSAL_DATE';end if;
 if exists(select 1 from public.accounting_periods where status='closed' and p_reversed_on between starts_on and ends_on) then raise exception 'PERIOD_CLOSED';end if;
 if exists(select 1 from public.order_return_credit_applications a join public.order_return_support_lines l on l.id=a.support_line_id where l.support_id=p_support) then raise exception 'ORDER_RETURN_CREDIT_APPLIED';end if;
 if exists(select 1 from public.kiosk_sales k join public.kiosk_return_lots r on r.id=k.lot_id join public.order_return_support_lines l on l.id=r.order_return_support_line_id where l.support_id=p_support and k.status='posted') then raise exception 'KIOSK_LINKED_SALE';end if;
 perform private.assert_open(s.returned_on);perform private.assert_open(p_reversed_on);
 if s.adjustment_id is not null then
  select -da.amount_vnd,da.receivable_id into amount,receivable_id from public.debt_adjustments da where da.id=s.adjustment_id;
  if amount>0 then insert into public.debt_adjustments(receivable_id,adjustment_on,amount_vnd,reason) values(receivable_id,p_reversed_on,amount,'Đảo điều chỉnh hủy '||p_support::text||': '||trim(p_reason)) returning id into reversal_id;end if;
  insert into public.order_revenue_adjustments(support_line_id,business_date,store_id,product_id,kind,reverses_id,amount_vnd,reason)
   select original.support_line_id,p_reversed_on,original.store_id,original.product_id,'destroyed_reversal',original.id,-original.amount_vnd,'Đảo ghi nhận hàng hủy '||p_support::text||': '||trim(p_reason)
   from public.order_revenue_adjustments original where original.support_line_id in(select id from public.order_return_support_lines where support_id=p_support) and original.kind='destroyed';
 end if;
 update public.kiosk_return_lots set status='reversed',received_on=null,warehouse_id=null,note=trim(p_reason)
  where order_return_support_line_id in(select id from public.order_return_support_lines where support_id=p_support) and status='received';
 update public.order_return_supports set status='reversed',reversed_on=p_reversed_on,reversal_reason=trim(p_reason) where id=p_support;
 return private.finish_request(p_key,jsonb_build_object('support_id',p_support,'status','reversed','reversal_adjustment_id',reversal_id));
end $$;

-- Keep the existing kiosk sale workflow; order returns are already received
-- into a kiosk lot, so only its source validation needs an additional path.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.kiosk_action(text,uuid,bigint,date,jsonb,uuid)'::regprocedure) into definition;
 old_fragment='if document.status<>''posted'' or source.returned<=0 then raise exception ''KIOSK_SOURCE_UNAVAILABLE'';end if;';
 new_fragment='if document.status<>''posted'' or (source.returned<=0 and not exists(select 1 from public.kiosk_return_lots kr join public.order_return_support_lines rl on rl.id=kr.order_return_support_line_id join public.order_return_supports rs on rs.id=rl.support_id where kr.id=case when p_action=''undo_sale'' then (select lot_id from public.kiosk_sales where id=p_id) else p_id end and rs.status=''posted'' and rs.disposition=''returned'')) then raise exception ''KIOSK_SOURCE_UNAVAILABLE'';end if;';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_RETURN_KIOSK_SOURCE_PATCH_MISMATCH';end if;definition=replace(definition,old_fragment,new_fragment);
 old_fragment='if exists(select 1 from public.kiosk_return_lots where source_line_id=source.id and status<>''reversed'') then raise exception ''KIOSK_ALREADY_PROCESSED'';end if;';
 new_fragment='if exists(select 1 from public.kiosk_return_lots where source_line_id=source.id and order_return_support_line_id is null and status<>''reversed'') then raise exception ''KIOSK_ALREADY_PROCESSED'';end if;';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_RETURN_KIOSK_DUPLICATE_PATCH_MISMATCH';end if;execute replace(definition,old_fragment,new_fragment);
end $patch$;

-- The entered recovery value is also the kiosk lot's acquisition cost. Legacy
-- lots without a documented buyback amount remain unknown instead of receiving
-- a guessed cost.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.kiosk_report(date,date,integer,integer)'::regprocedure) into definition;
 old_fragment=$old$declare sources jsonb; inventory jsonb; history jsonb='[]';$old$;
 new_fragment=old_fragment||$add$ sold_revenue bigint; sold_cost bigint; sale_count integer; unvalued_sales integer; remaining_cost bigint; remaining_complete boolean; valuation jsonb;$add$;
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_KIOSK_VALUATION_DECLARATION_MISMATCH';end if;definition=replace(definition,old_fragment,new_fragment);
 old_fragment='r.quantity::text received,';
 new_fragment='r.quantity::text received,r.unit_cost_vnd::text unit_cost_vnd,case when r.unit_cost_vnd is null then null else round((r.quantity-coalesce(sold.quantity,0))*r.unit_cost_vnd)::bigint::text end balance_cost_vnd,';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_KIOSK_VALUATION_STOCK_PATCH_MISMATCH';end if;definition=replace(definition,old_fragment,new_fragment);
 old_fragment='i.price_vnd::text price_vnd,';
 new_fragment='i.price_vnd::text price_vnd,r.unit_cost_vnd::text unit_cost_vnd,case when r.unit_cost_vnd is null then null else round(i.quantity*r.unit_cost_vnd)::bigint::text end cost_vnd,case when r.unit_cost_vnd is null then null else (round(i.quantity*i.price_vnd)-round(i.quantity*r.unit_cost_vnd))::bigint::text end gross_profit_vnd,';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_KIOSK_VALUATION_HISTORY_PATCH_MISMATCH';end if;definition=replace(definition,old_fragment,new_fragment);
 old_fragment='from public.kiosk_sales k join public.kiosk_sale_items i on i.sale_id=k.id join public.products p on p.id=i.product_id join public.stores s on s.id=k.store_id';
 new_fragment=old_fragment||' left join public.kiosk_return_lots r on r.id=k.lot_id';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_KIOSK_VALUATION_HISTORY_JOIN_MISMATCH';end if;definition=replace(definition,old_fragment,new_fragment);
 old_fragment=$old$return jsonb_build_object('sources',sources,'inventory',inventory,'sales',history,'valuation',null,'checked_at',now());$old$;
 new_fragment=$new$select count(*)::integer,coalesce(sum(l.net_revenue_vnd),0)::bigint,
  coalesce(sum(case when r.unit_cost_vnd is not null then round(i.quantity*r.unit_cost_vnd)::bigint else 0 end),0)::bigint,
  count(*) filter(where r.unit_cost_vnd is null or l.net_revenue_vnd is null)::integer
  into sale_count,sold_revenue,sold_cost,unvalued_sales
  from public.kiosk_sales k join public.sales_lines l on l.document_id=k.sales_document_id
  join public.kiosk_sale_items i on i.sale_id=k.id left join public.kiosk_return_lots r on r.id=k.lot_id
  where k.status='posted' and k.sold_on between p_from and p_to;
 select coalesce(sum(round((r.quantity-coalesce(sold.quantity,0))*r.unit_cost_vnd)::bigint),0)::bigint,
  not exists(select 1 from public.kiosk_return_lots r left join lateral(select sum(i.quantity) quantity from public.kiosk_sales k join public.kiosk_sale_items i on i.sale_id=k.id where k.lot_id=r.id and k.status='posted' and k.sold_on<=p_to) sold on true where r.status='received' and r.received_on<=p_to and r.quantity>coalesce(sold.quantity,0) and r.unit_cost_vnd is null)
  into remaining_cost,remaining_complete
  from public.kiosk_return_lots r left join lateral(select sum(i.quantity) quantity from public.kiosk_sales k join public.kiosk_sale_items i on i.sale_id=k.id where k.lot_id=r.id and k.status='posted' and k.sold_on<=p_to) sold on true
  where r.status='received' and r.received_on<=p_to and r.quantity>coalesce(sold.quantity,0) and r.unit_cost_vnd is not null;
 valuation=jsonb_build_object('sale_count',sale_count,'sold_revenue_vnd',sold_revenue::text,
  'sold_cost_vnd',case when unvalued_sales=0 then sold_cost::text end,
  'gross_profit_vnd',case when unvalued_sales=0 then (sold_revenue-sold_cost)::text end,
  'sold_cost_complete',unvalued_sales=0,'known_remaining_cost_vnd',remaining_cost::text,'remaining_cost_complete',remaining_complete);
 return jsonb_build_object('sources',sources,'inventory',inventory,'sales',history,'valuation',valuation,'checked_at',now());$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_KIOSK_VALUATION_RETURN_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end $patch$;

create function public.fulfill_order_delivery_settle(p_order uuid,p_expected_version bigint,p_method text,p_account uuid,p_paid_vnd bigint,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; current_order public.customer_orders; fulfilled jsonb; receivable_id uuid; sales_id uuid; gross bigint; due bigint; paid bigint; credit record; available_credit bigint; application_id uuid; receipt_id uuid; account_kind text; cash_kind text; delivery_key uuid;
begin
 if p_method not in ('cash','bank','receivable') or p_paid_vnd is null or p_paid_vnd<0 or p_key is null then raise exception 'INVALID_DELIVERY_SETTLEMENT';end if;
 if p_method='receivable' and (p_paid_vnd<>0 or p_account is not null) then raise exception 'INVALID_DELIVERY_SETTLEMENT';end if;
 if p_method in ('cash','bank') and (p_paid_vnd<=0 or p_account is null or not private.can('cash','create') or not private.can('payments','approve')) then raise exception 'PAYMENT_REQUIRED';end if;
 if not private.can('receivables','create') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'order:fulfill-delivery-settle',jsonb_build_object('order',p_order,'version',p_expected_version,'method',p_method,'account',p_account,'paid',p_paid_vnd));if cached is not null then return cached;end if;
 select * into strict current_order from public.customer_orders where id=p_order;
 if current_order.store_id is null then raise exception 'ORDER_STORE_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended('order-settlement:'||current_order.store_id::text,0));
 if p_method in ('cash','bank') then
  select kind into account_kind from public.bank_accounts where id=p_account and not archived;
  if account_kind is distinct from p_method then raise exception 'PAYMENT_ACCOUNT_KIND_MISMATCH';end if;
 end if;
 delivery_key=md5(p_key::text||':order-delivery-base')::uuid;
 fulfilled=public.fulfill_order_delivery(p_order,p_expected_version,delivery_key);
 receivable_id=(fulfilled->>'receivable_id')::uuid;sales_id=(fulfilled->>'sales_document_id')::uuid;gross=(fulfilled->>'revenue_vnd')::bigint;due=gross;
 for credit in
  select l.id support_line_id,l.support_amount_vnd-
   coalesce((select sum(a.amount_vnd) from public.order_return_credit_applications a where a.support_line_id=l.id),0) available_vnd
  from public.order_return_support_lines l join public.order_return_supports s on s.id=l.support_id join public.deliveries d on d.id=s.delivery_id
  join public.customer_orders prior on prior.id=d.order_id
  where prior.store_id=current_order.store_id and s.returned_on<current_order.delivery_date and s.status='posted' and s.disposition='returned'
   and l.support_amount_vnd>coalesce((select sum(a.amount_vnd) from public.order_return_credit_applications a where a.support_line_id=l.id),0)
  order by s.returned_on,s.created_at,l.id for update of l,s
 loop
  exit when due<=0;available_credit=least(credit.available_vnd::bigint,due);
  if available_credit>0 then
   insert into public.debt_adjustments(receivable_id,adjustment_on,amount_vnd,reason)
    values(receivable_id,current_order.delivery_date,-available_credit,'Cấn giá trị hàng trả từ đơn trước vào đơn '||p_order::text||'; tham chiếu dòng hoàn '||credit.support_line_id::text);
   insert into public.order_return_credit_applications(support_line_id,receivable_id,amount_vnd) values(credit.support_line_id,receivable_id,available_credit);
   insert into public.order_revenue_adjustments(support_line_id,target_receivable_id,business_date,store_id,product_id,kind,amount_vnd,reason)
    select credit.support_line_id,receivable_id,current_order.delivery_date,current_order.store_id,di.product_id,'returned_credit',-available_credit,
     'Cấn hàng trả từ đơn trước vào doanh thu đơn '||p_order::text
    from public.order_return_support_lines rl join public.delivery_items di on di.id=rl.delivery_item_id where rl.id=credit.support_line_id;
   due=due-available_credit;
  end if;
 end loop;
 if p_paid_vnd>due then raise exception 'PAYMENT_EXCEEDS_BALANCE';end if;
 update public.sales_documents set delivery_payment_method=p_method,delivery_paid_vnd=p_paid_vnd,
  delivery_old_deduction_vnd=gross-due where id=sales_id;
 if p_paid_vnd>0 then
  if not private.can('payments','create') then raise exception 'FORBIDDEN';end if;
  insert into public.payment_receipts(store_id,account_id,received_on,amount_vnd,status,note)
   values(current_order.store_id,p_account,current_order.delivery_date,p_paid_vnd,'posted','Thu khi giao đơn '||left(replace(p_order::text,'-',''),8)) returning id into receipt_id;
  insert into public.receipt_allocations(receipt_id,receivable_id,amount_vnd) values(receipt_id,receivable_id,p_paid_vnd);
  insert into public.cash_ledger(account_id,occurred_on,direction,amount_vnd,receipt_id,note)
   values(p_account,current_order.delivery_date,'in',p_paid_vnd,receipt_id,'Thu khi giao đơn '||left(replace(p_order::text,'-',''),8));
 end if;
 return private.finish_request(p_key,jsonb_build_object('order_id',p_order,'delivery_id',fulfilled->>'delivery_id','sales_document_id',sales_id,'receivable_id',receivable_id,
  'revenue_vnd',gross::text,'old_deduction_vnd',(gross-due)::text,'paid_vnd',p_paid_vnd::text,'payment_method',p_method,'outstanding_vnd',(due-p_paid_vnd)::text,'status','fulfilled'));
end $$;

-- Expose the actual next-order credit and canceled amount in the existing
-- daily summary; the receivable balance is already reduced by ledger rows.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.dashboard_summary(date)'::regprocedure) into definition;
 old_fragment=$old$into revenue from public.sales_documents d join public.sales_lines l on l.document_id=d.id where d.status='posted' and d.sold_on=p_date;$old$;
 new_fragment=old_fragment||$add$ if revenue is not null or exists(select 1 from public.order_revenue_adjustments a where a.business_date=p_date) then revenue=coalesce(revenue,0)+coalesce((select sum(a.amount_vnd) from public.order_revenue_adjustments a where a.business_date=p_date),0);end if;$add$;
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_DASHBOARD_REVENUE_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment=$old$into revenue_yesterday from public.sales_documents d join public.sales_lines l on l.document_id=d.id where d.status='posted' and d.sold_on=p_date-1;$old$;
 new_fragment=old_fragment||$add$ if revenue_yesterday is not null or exists(select 1 from public.order_revenue_adjustments a where a.business_date=p_date-1) then revenue_yesterday=coalesce(revenue_yesterday,0)+coalesce((select sum(a.amount_vnd) from public.order_revenue_adjustments a where a.business_date=p_date-1),0);end if;$add$;
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_DASHBOARD_PRIOR_REVENUE_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);

 select pg_get_functiondef('public.order_delivery_detail(uuid)'::regprocedure) into definition;
 old_fragment=$old$'order_status',current_order.status,$old$;
 new_fragment=old_fragment||$add$'return_credit_available_vnd',coalesce((select sum(l.support_amount_vnd-coalesce((select sum(a.amount_vnd) from public.order_return_credit_applications a where a.support_line_id=l.id),0)) from public.order_return_support_lines l join public.order_return_supports rs on rs.id=l.support_id join public.deliveries d on d.id=rs.delivery_id join public.customer_orders prior on prior.id=d.order_id where prior.store_id=current_order.store_id and rs.returned_on<current_order.delivery_date and rs.status='posted' and rs.disposition='returned'),0)::text,$add$;
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_DETAIL_RETURN_CREDIT_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment=$old$'ordered_quantity',i.quantity::text,'price_vnd',i.price_vnd::text,$old$;
 new_fragment=old_fragment||$add$'discount_rate',i.discount_rate::text,$add$;
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_DETAIL_DISCOUNT_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment='''status'',s.status';
 new_fragment='''status'',s.status,''disposition'',s.disposition,''warehouse_id'',s.warehouse_id';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_DETAIL_RETURN_HEADER_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment='''support_amount_vnd'',l.support_amount_vnd::text';
 new_fragment='''support_amount_vnd'',l.support_amount_vnd::text,''pricing_mode'',l.pricing_mode,''discount_rate'',l.discount_rate::text';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_DETAIL_RETURN_LINE_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);

 select pg_get_functiondef('public.order_customer_summary(date)'::regprocedure) into definition;
 old_fragment='''old_deduction_vnd'',null,''cash_received_vnd''';
 new_fragment='''old_deduction_vnd'',coalesce((select sum(a.amount_vnd) from public.order_return_credit_applications a join public.receivables r on r.id=a.receivable_id join public.sales_documents sd on sd.id=r.sales_document_id join public.deliveries d on d.id=sd.delivery_id where d.order_id=o.id),0)::text,''cancelled_loss_vnd'',coalesce((select sum(l.support_amount_vnd) from public.order_return_support_lines l join public.order_return_supports s on s.id=l.support_id where s.delivery_id in(select id from public.deliveries where order_id=o.id) and s.status=''posted'' and s.disposition=''destroyed''),0)::text,''cash_received_vnd''';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_SUMMARY_RETURN_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment='''order_total_vnd'',coalesce(lines.order_total_vnd,0)::bigint::text';
 new_fragment='''order_total_vnd'',greatest(coalesce(lines.order_total_vnd,0)-coalesce((select sum(a.amount_vnd) from public.order_return_credit_applications a join public.receivables r on r.id=a.receivable_id join public.sales_documents sd on sd.id=r.sales_document_id join public.deliveries d on d.id=sd.delivery_id where d.order_id=o.id),0)-coalesce((select sum(l.support_amount_vnd) from public.order_return_support_lines l join public.order_return_supports s on s.id=l.support_id where s.delivery_id in(select id from public.deliveries where order_id=o.id) and s.status=''posted'' and s.disposition=''destroyed''),0),0)::bigint::text';
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_SUMMARY_TOTAL_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment=$old$case when count(distinct a.kind)>1 then 'Tiền mặt + chuyển khoản' when max(a.kind)='cash' then 'Tiền mặt' when max(a.kind)='bank' then 'Chuyển khoản' end$old$;
 new_fragment=$new$coalesce(case max(sd.delivery_payment_method) when 'cash' then 'Tiền mặt' when 'bank' then 'Chuyển khoản' when 'receivable' then 'Công nợ' end,case when count(distinct a.kind)>1 then 'Tiền mặt + chuyển khoản' when max(a.kind)='cash' then 'Tiền mặt' when max(a.kind)='bank' then 'Chuyển khoản' end)$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'ORDER_SUMMARY_PAYMENT_METHOD_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end $patch$;

-- Keep sales dashboards in step with order returns and destroyed goods. These
-- are dated contra-revenue entries; original posted sales lines stay intact.
create or replace function public.strategy_sales_breakdown(p_start date,p_end date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare stores_result jsonb;products_result jsonb;
begin
 if not private.can('dashboard','view') then raise exception 'FORBIDDEN';end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<p_start or p_end-p_start>365 then raise exception 'INVALID_STRATEGY_PERIOD';end if;
 if not private.can('sales','view') then return jsonb_build_object('available',false,'stores','[]'::jsonb,'products','[]'::jsonb);end if;
 with sales as(
  select d.store_id,count(distinct d.id)::integer document_count,
   case when count(l.id)>0 and count(l.id)=count(l.net_revenue_vnd) then sum(l.net_revenue_vnd) end revenue_vnd,
   count(l.id)>0 and count(l.id)=count(l.net_revenue_vnd) complete
  from public.sales_documents d left join public.sales_lines l on l.document_id=d.id
  where d.status='posted' and d.sold_on between p_start and p_end group by d.store_id
 ),adjustments as(
  select a.store_id,sum(a.amount_vnd) amount_vnd from public.order_revenue_adjustments a
  where a.business_date between p_start and p_end group by a.store_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('store_id',x.store_id,'name',case when private.can('stores','view') then st.name end,
  'revenue_vnd',x.revenue_vnd::text,'complete',x.complete,'document_count',x.document_count)
  order by x.revenue_vnd desc nulls last,x.document_count desc),'[]'::jsonb) into stores_result
 from(select coalesce(s.store_id,a.store_id) store_id,coalesce(s.document_count,0) document_count,
   case when s.store_id is null then a.amount_vnd when s.complete then s.revenue_vnd+coalesce(a.amount_vnd,0) end revenue_vnd,
   (s.store_id is null or s.complete) complete from sales s full join adjustments a using(store_id)) x
 left join public.stores st on st.id=x.store_id;
 with sales as(
  select l.product_id,count(*)::integer line_count,
   case when count(*)=count(l.net_revenue_vnd) then sum(l.net_revenue_vnd) end revenue_vnd,
   count(*)=count(l.net_revenue_vnd) complete,sum(l.sold) sold_quantity,sum(l.returned) returned_quantity
  from public.sales_documents d join public.sales_lines l on l.document_id=d.id
  where d.status='posted' and d.sold_on between p_start and p_end group by l.product_id
 ),adjustments as(
  select a.product_id,sum(a.amount_vnd) amount_vnd from public.order_revenue_adjustments a
  where a.business_date between p_start and p_end group by a.product_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('product_id',x.product_id,
  'code',case when private.can('products','view') then pr.code end,'name',case when private.can('products','view') then pr.name end,
  'revenue_vnd',x.revenue_vnd::text,'complete',x.complete,'sold_quantity',x.sold_quantity::text,
  'returned_quantity',x.returned_quantity::text,'line_count',x.line_count)
  order by x.revenue_vnd desc nulls last,x.line_count desc),'[]'::jsonb) into products_result
 from(select coalesce(s.product_id,a.product_id) product_id,coalesce(s.line_count,0) line_count,
   case when s.product_id is null then a.amount_vnd when s.complete then s.revenue_vnd+coalesce(a.amount_vnd,0) end revenue_vnd,
   (s.product_id is null or s.complete) complete,coalesce(s.sold_quantity,0) sold_quantity,coalesce(s.returned_quantity,0) returned_quantity
   from sales s full join adjustments a using(product_id)) x left join public.products pr on pr.id=x.product_id;
 return jsonb_build_object('available',true,'stores',stores_result,'products',products_result,'updated_at',now());
end $$;

revoke all on function public.record_order_return_event(uuid,date,text,uuid,jsonb,text,uuid),public.reverse_order_return_event(uuid,bigint,date,text,uuid),public.fulfill_order_delivery_settle(uuid,bigint,text,uuid,bigint,uuid) from public,anon;
grant execute on function public.record_order_return_event(uuid,date,text,uuid,jsonb,text,uuid),public.reverse_order_return_event(uuid,bigint,date,text,uuid),public.fulfill_order_delivery_settle(uuid,bigint,text,uuid,bigint,uuid) to authenticated;

commit;

begin;
-- Port the legacy physical return lifecycle. Approval does not add stock or revenue.
create table public.kiosk_return_lots (
 id uuid primary key default gen_random_uuid(),
 source_line_id uuid not null references public.sales_lines(id),
 source_line_version bigint not null, source_document_version bigint not null,
 product_id uuid not null references public.products(id), store_id uuid not null references public.stores(id),
 quantity numeric(20,6) not null check(quantity>0),
 approved_on date not null, received_on date, rejected_on date,
 warehouse_id uuid references public.warehouses(id),
 status text not null default 'approved' check(status in ('approved','received','rejected','reversed')),
 note text not null,
 version bigint not null default 1 check(version>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
 check((status='received')=(received_on is not null)),
 check((status='received')=(warehouse_id is not null)),
 check((status='rejected')=(rejected_on is not null)),
 check(received_on is null or received_on>=approved_on),
 check(rejected_on is null or rejected_on>=approved_on)
);
create unique index kiosk_return_source_active_idx on public.kiosk_return_lots(source_line_id) where status<>'reversed';
create index kiosk_return_status_idx on public.kiosk_return_lots(status,approved_on,id);
insert into private.table_modules values('kiosk_return_lots','kiosk');
alter table public.kiosk_return_lots enable row level security;
create policy kiosk_return_lots_read on public.kiosk_return_lots for select to authenticated using((select private.can('kiosk','view')));
create trigger kiosk_return_lots_audit before insert or update or delete on public.kiosk_return_lots for each row execute function private.record_change('kiosk');
revoke all on public.kiosk_return_lots from anon,authenticated;
grant select on public.kiosk_return_lots to authenticated;

alter table public.kiosk_sales add column lot_id uuid references public.kiosk_return_lots(id),
 add column store_id uuid references public.stores(id),
 add column sales_document_id uuid unique references public.sales_documents(id),
 add column cash_receipt_id uuid unique references public.payment_receipts(id),
 add column bank_receipt_id uuid unique references public.payment_receipts(id),
 add column cash_vnd bigint not null default 0 check(cash_vnd>=0),
 add column bank_vnd bigint not null default 0 check(bank_vnd>=0);
create index kiosk_sales_lot_idx on public.kiosk_sales(lot_id,sold_on,id);

create function public.kiosk_report(p_from date,p_to date,p_offset integer default 0,p_inventory_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sources jsonb; inventory jsonb; history jsonb='[]';
begin
 if not private.can('kiosk','view') or not private.can('stores','view') or not private.can('products','view') then raise exception 'FORBIDDEN';end if;
 if p_from is null or p_to is null or p_from>p_to or p_offset is null or p_offset<0 or p_inventory_offset is null or p_inventory_offset<0 then raise exception 'INVALID_FILTER';end if;
 if exists(select 1 from public.kiosk_return_lots r join public.sales_lines l on l.id=r.source_line_id join public.sales_documents d on d.id=l.document_id where r.status<>'reversed' and (l.version<>r.source_line_version or d.version<>r.source_document_version or d.status<>'posted')) then raise exception 'KIOSK_SOURCE_CHANGED';end if;
 select coalesce(jsonb_agg(to_jsonb(page)),'[]') into sources from (
  select l.id,l.version,d.version document_version,d.sold_on,s.name store,p.name product,l.returned::text quantity,
   r.id lot_id,r.version lot_version,coalesce(r.status,'pending') status,r.approved_on,r.received_on,r.rejected_on,
   r.warehouse_id,r.note
  from public.sales_lines l join public.sales_documents d on d.id=l.document_id join public.stores s on s.id=d.store_id join public.products p on p.id=l.product_id
  left join public.kiosk_return_lots r on r.source_line_id=l.id and r.status<>'reversed'
  where d.status='posted' and l.returned>0 and d.sold_on between p_from and p_to
  order by d.sold_on desc,l.id limit 51 offset p_offset
 ) page;
 select coalesce(jsonb_agg(to_jsonb(page)),'[]') into inventory from (
  select r.id,r.version,r.received_on,s.name store,p.name product,w.name warehouse,r.quantity::text received,
   coalesce(sold.quantity,0)::text sold,(r.quantity-coalesce(sold.quantity,0))::text balance
  from public.kiosk_return_lots r join public.stores s on s.id=r.store_id join public.products p on p.id=r.product_id join public.warehouses w on w.id=r.warehouse_id
  left join lateral(select sum(i.quantity) quantity from public.kiosk_sales k join public.kiosk_sale_items i on i.sale_id=k.id where k.lot_id=r.id and k.status='posted' and k.sold_on<=p_to) sold on true
  where r.status='received' and r.received_on<=p_to and r.quantity>coalesce(sold.quantity,0)
  order by r.received_on,r.id limit 51 offset p_inventory_offset
 ) page;
 if private.can('audit','view') then
  select coalesce(jsonb_agg(to_jsonb(page)),'[]') into history from (
   select k.id,k.version,k.lot_id,k.sold_on,p.name product,s.name store,i.quantity::text quantity,i.price_vnd::text price_vnd,k.cash_vnd::text cash_vnd,k.bank_vnd::text bank_vnd,k.status
   from public.kiosk_sales k join public.kiosk_sale_items i on i.sale_id=k.id join public.products p on p.id=i.product_id join public.stores s on s.id=k.store_id
   where k.lot_id is not null and k.sold_on between p_from and p_to order by k.created_at desc,k.id limit 50
  ) page;
 end if;
 return jsonb_build_object('sources',sources,'inventory',inventory,'sales',history,'valuation',null,'checked_at',now());
end $$;

create function public.kiosk_action(p_action text,p_id uuid,p_expected_version bigint,p_date date,p_input jsonb,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; source public.sales_lines; document public.sales_documents; lot public.kiosk_return_lots; sale public.kiosk_sales;
 source_id uuid; new_lot_id uuid; warehouse uuid; destination uuid; quantity numeric; used numeric; price bigint; cash bigint; bank bigint; revenue bigint;
 cash_account uuid; bank_account uuid; sale_id uuid; document_id uuid; debt_id uuid; receipt_id uuid; cash_receipt uuid; bank_receipt uuid;
 entry record; reason_text text; result jsonb;
begin
 if not private.can('kiosk','approve') or not private.can('kiosk','view') or not private.can('stores','view') or not private.can('products','view') then raise exception 'FORBIDDEN';end if;
 if p_action is null or p_action not in ('approve','receive','reject','sell','undo_approval','undo_receive','undo_reject','undo_sale') or p_id is null or p_expected_version is null or p_expected_version<1 or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'INVALID_KIOSK_REQUEST';end if;
 reason_text=trim(coalesce(p_input->>'note',''));if length(reason_text)<5 or length(reason_text)>2000 then raise exception 'KIOSK_REASON_REQUIRED';end if;
 if p_action like 'undo_%' and not private.can('admin','manage') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'kiosk:'||p_action,jsonb_build_object('id',p_id,'version',p_expected_version,'date',p_date,'input',p_input));if cached is not null then return cached;end if;
 perform private.assert_open(p_date);
 if p_action='approve' then source_id=p_id;
 elsif p_action='undo_sale' then
  select r.source_line_id into source_id from public.kiosk_sales k join public.kiosk_return_lots r on r.id=k.lot_id where k.id=p_id;
 else select r.source_line_id into source_id from public.kiosk_return_lots r where r.id=p_id;end if;
 select * into strict source from public.sales_lines where id=source_id for update;
 select * into strict document from public.sales_documents where id=source.document_id for update;
 if document.status<>'posted' or source.returned<=0 then raise exception 'KIOSK_SOURCE_UNAVAILABLE';end if;
 if p_action='approve' then
  if source.version<>p_expected_version or coalesce((p_input->>'document_version')::bigint,-1)<>document.version then raise exception 'VERSION_CONFLICT';end if;
  if p_date<document.sold_on then raise exception 'KIOSK_DATE_BEFORE_SOURCE';end if;
  if exists(select 1 from public.kiosk_return_lots where source_line_id=source.id and status<>'reversed') then raise exception 'KIOSK_ALREADY_PROCESSED';end if;
  insert into public.kiosk_return_lots(source_line_id,source_line_version,source_document_version,product_id,store_id,quantity,approved_on,note)
  values(source.id,source.version,document.version,source.product_id,document.store_id,source.returned,p_date,reason_text) returning id into new_lot_id;
  return private.finish_request(p_key,jsonb_build_object('lot_id',new_lot_id,'status','approved'));
 end if;
 if p_action='undo_sale' then
  select * into strict sale from public.kiosk_sales where id=p_id for update;
  select * into strict lot from public.kiosk_return_lots where id=sale.lot_id for update;
  if sale.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 else
  select * into strict lot from public.kiosk_return_lots where id=p_id for update;
  if lot.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 end if;
 if lot.source_line_version<>source.version or lot.source_document_version<>document.version then raise exception 'KIOSK_SOURCE_CHANGED';end if;
 if p_date<lot.approved_on then raise exception 'KIOSK_DATE_BEFORE_SOURCE';end if;
 if p_action='receive' then
  if lot.status<>'approved' then raise exception 'KIOSK_INVALID_STATUS';end if;
  warehouse=(p_input->>'warehouse_id')::uuid;
  if not exists(select 1 from public.warehouses where id=warehouse and active and kind='kiosk') then raise exception 'KIOSK_WAREHOUSE_REQUIRED';end if;
  update public.kiosk_return_lots set status='received',received_on=p_date,warehouse_id=warehouse,note=reason_text where id=lot.id;
 elsif p_action='reject' then
  if lot.status<>'approved' then raise exception 'KIOSK_INVALID_STATUS';end if;
  update public.kiosk_return_lots set status='rejected',rejected_on=p_date,note=reason_text where id=lot.id;
 elsif p_action='sell' then
  if not private.can('kiosk','create') or not private.can('sales','create') or not private.can('receivables','create') then raise exception 'FORBIDDEN';end if;
  if lot.status<>'received' or p_date<lot.received_on then raise exception 'KIOSK_RECEIPT_REQUIRED';end if;
  if exists(select 1 from public.kiosk_sales where lot_id=lot.id and status='posted' and sold_on>p_date) then raise exception 'KIOSK_BACKDATED_SALE';end if;
  if coalesce(p_input->>'quantity','') !~ '^[0-9]{1,14}([.][0-9]{1,6})?$' or coalesce(p_input->>'price_vnd','') !~ '^[0-9]{1,15}$' or coalesce(p_input->>'cash_vnd','') !~ '^[0-9]{1,15}$' or coalesce(p_input->>'bank_vnd','') !~ '^[0-9]{1,15}$' then raise exception 'INVALID_KIOSK_SALE';end if;
  quantity=(p_input->>'quantity')::numeric;price=(p_input->>'price_vnd')::bigint;cash=(p_input->>'cash_vnd')::bigint;bank=(p_input->>'bank_vnd')::bigint;
  select coalesce(sum(i.quantity),0) into used from public.kiosk_sales k join public.kiosk_sale_items i on i.sale_id=k.id where k.lot_id=lot.id and k.status='posted';
  if quantity<=0 or used+quantity>lot.quantity then raise exception 'KIOSK_INSUFFICIENT_STOCK';end if;
  destination=(p_input->>'store_id')::uuid;
  if destination=lot.store_id or not exists(select 1 from public.stores where id=destination and active) then raise exception 'KIOSK_DESTINATION_REQUIRED';end if;
  if round(quantity*price)>9223372036854775807 then raise exception 'INVALID_KIOSK_SALE';end if;
  revenue=round(quantity*price)::bigint;
  if cash+bank>revenue then raise exception 'KIOSK_OVERPAYMENT';end if;
  cash_account=(p_input->>'cash_account_id')::uuid;bank_account=(p_input->>'bank_account_id')::uuid;
  if cash+bank>0 and (not private.can('cash','create') or not private.can('payments','approve')) then raise exception 'FORBIDDEN';end if;
  if cash>0 and not exists(select 1 from public.bank_accounts where id=cash_account and kind='cash' and not archived) then raise exception 'CASH_ACCOUNT_REQUIRED';end if;
  if bank>0 and not exists(select 1 from public.bank_accounts where id=bank_account and kind='bank' and not archived) then raise exception 'BANK_ACCOUNT_REQUIRED';end if;
  insert into public.sales_documents(store_id,sold_on,status) values(destination,p_date,'posted') returning id into document_id;
  insert into public.sales_lines(document_id,product_id,delivered,sold,returned,store_borne,price_vnd,discount_rate,net_revenue_vnd) values(document_id,lot.product_id,quantity,quantity,0,0,price,0,revenue);
  insert into public.receivables(store_id,sales_document_id,incurred_on,amount_vnd) values(destination,document_id,p_date,revenue) returning id into debt_id;
  for entry in select * from (values(cash,cash_account,'cash'),(bank,bank_account,'bank')) v(amount,account,kind) where amount>0 loop
   insert into public.payment_receipts(store_id,account_id,received_on,amount_vnd,status,note) values(destination,entry.account,p_date,entry.amount,'posted',reason_text) returning id into receipt_id;
   insert into public.receipt_allocations(receipt_id,receivable_id,amount_vnd) values(receipt_id,debt_id,entry.amount);
   insert into public.cash_ledger(account_id,occurred_on,direction,amount_vnd,receipt_id,note) values(entry.account,p_date,'in',entry.amount,receipt_id,reason_text);
   if entry.kind='cash' then cash_receipt=receipt_id;else bank_receipt=receipt_id;end if;
  end loop;
  insert into public.kiosk_sales(warehouse_id,sold_on,status,lot_id,store_id,sales_document_id,cash_receipt_id,bank_receipt_id,cash_vnd,bank_vnd) values(lot.warehouse_id,p_date,'posted',lot.id,destination,document_id,cash_receipt,bank_receipt,cash,bank) returning id into sale_id;
  insert into public.kiosk_sale_items(sale_id,product_id,quantity,price_vnd) values(sale_id,lot.product_id,quantity,price);
  -- The lot version also changes on sale, so stale forms cannot approve another action.
  update public.kiosk_return_lots set note=reason_text where id=lot.id;
  return private.finish_request(p_key,jsonb_build_object('lot_id',lot.id,'sale_id',sale_id,'revenue_vnd',revenue::text,'unpaid_vnd',(revenue-cash-bank)::text,'valuation',null));
 elsif p_action='undo_sale' then
  if not private.can('receivables','edit') or not private.can('sales','approve') then raise exception 'FORBIDDEN';end if;
  if sale.status<>'posted' or p_date<sale.sold_on then raise exception 'KIOSK_INVALID_STATUS';end if;
  perform private.assert_open(sale.sold_on);
  select id into strict debt_id from public.receivables where sales_document_id=sale.sales_document_id for update;
  if exists(select 1 from public.receipt_allocations a join public.payment_receipts r on r.id=a.receipt_id where a.receivable_id=debt_id and r.status='posted' and r.id is distinct from sale.cash_receipt_id and r.id is distinct from sale.bank_receipt_id)
   or exists(select 1 from public.debt_adjustments where receivable_id=debt_id) then raise exception 'KIOSK_LINKED_PAYMENT';end if;
  if (sale.cash_receipt_id is not null or sale.bank_receipt_id is not null) and (not private.can('cash','create') or not private.can('payments','approve')) then raise exception 'FORBIDDEN';end if;
  for entry in select l.* from public.cash_ledger l where l.receipt_id in(sale.cash_receipt_id,sale.bank_receipt_id) order by l.id loop
   perform private.assert_open(entry.occurred_on);
   insert into public.cash_ledger(account_id,occurred_on,direction,amount_vnd,reverses_id,note) values(entry.account_id,p_date,'out',entry.amount_vnd,entry.id,reason_text);
  end loop;
  update public.payment_receipts set status='reversed' where id in(sale.cash_receipt_id,sale.bank_receipt_id);
  select amount_vnd into revenue from public.receivables where id=debt_id;
  if revenue>0 then insert into public.debt_adjustments(receivable_id,adjustment_on,amount_vnd,reason) values(debt_id,p_date,-revenue,reason_text);end if;
  update public.sales_documents set status='reversed' where id=sale.sales_document_id;
  update public.kiosk_sales set status='reversed' where id=sale.id;
  update public.kiosk_return_lots set note=reason_text where id=lot.id;
 elsif p_action='undo_receive' then
  if lot.status<>'received' or p_date<lot.received_on then raise exception 'KIOSK_INVALID_STATUS';end if;
  perform private.assert_open(lot.received_on);
  if exists(select 1 from public.kiosk_sales where lot_id=lot.id and status='posted') then raise exception 'KIOSK_LINKED_SALE';end if;
  update public.kiosk_return_lots set status='approved',received_on=null,warehouse_id=null,note=reason_text where id=lot.id;
 elsif p_action='undo_reject' then
  if lot.status<>'rejected' or p_date<lot.rejected_on then raise exception 'KIOSK_INVALID_STATUS';end if;
  perform private.assert_open(lot.rejected_on);
  update public.kiosk_return_lots set status='approved',rejected_on=null,note=reason_text where id=lot.id;
 elsif p_action='undo_approval' then
  if lot.status<>'approved' then raise exception 'KIOSK_LINKED_RECEIPT';end if;
  perform private.assert_open(lot.approved_on);
  update public.kiosk_return_lots set status='reversed',note=reason_text where id=lot.id;
 end if;
 select jsonb_build_object('lot_id',id,'status',status,'version',version::text) into result from public.kiosk_return_lots where id=lot.id;
 insert into public.audit_logs(actor_id,action,table_name,record_id,after_row) values(auth.uid(),'KIOSK_'||upper(p_action),'kiosk_return_lots',lot.id,jsonb_build_object('note',reason_text,'date',p_date,'sale_id',sale.id));
 return private.finish_request(p_key,result);
end $$;
revoke all on function public.kiosk_report(date,date,integer,integer),public.kiosk_action(text,uuid,bigint,date,jsonb,uuid) from public,anon;
grant execute on function public.kiosk_report(date,date,integer,integer),public.kiosk_action(text,uuid,bigint,date,jsonb,uuid) to authenticated;
commit;

begin;
alter table public.attendance_shifts drop constraint attendance_shifts_employee_id_starts_at_key;
create unique index attendance_posted_start on public.attendance_shifts(employee_id,starts_at) where status='posted';
-- Older API callers must respect a month posted from the shared entry screens.
alter function public.post_attendance(uuid,timestamptz,timestamptz,integer,uuid) set schema private;
revoke all on function private.post_attendance(uuid,timestamptz,timestamptz,integer,uuid) from public,authenticated;
create function public.post_attendance(p_employee uuid,p_start timestamptz,p_end timestamptz,p_break integer,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(170032);
 if exists(select 1 from public.payroll_periods where status='posted' and starts_on<=(p_start at time zone 'Asia/Ho_Chi_Minh')::date and ends_on>=(p_start at time zone 'Asia/Ho_Chi_Minh')::date) then raise exception 'PAYROLL_MONTH_POSTED';end if;
 return private.post_attendance(p_employee,p_start,p_end,p_break,p_key);end $$;
revoke all on function public.post_attendance(uuid,timestamptz,timestamptz,integer,uuid) from public;
grant execute on function public.post_attendance(uuid,timestamptz,timestamptz,integer,uuid) to authenticated;
alter function public.save_monthly_allowance(uuid,date,uuid,text,text,uuid) set schema private;
revoke all on function private.save_monthly_allowance(uuid,date,uuid,text,text,uuid) from public,authenticated;
create function public.save_monthly_allowance(p_employee uuid,p_month date,p_expected_id uuid,p_amount text,p_note text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(170032);
 return private.save_monthly_allowance(p_employee,p_month,p_expected_id,p_amount,p_note,p_key);end $$;
revoke all on function public.save_monthly_allowance(uuid,date,uuid,text,text,uuid) from public;
grant execute on function public.save_monthly_allowance(uuid,date,uuid,text,text,uuid) to authenticated;
-- Entry screens share the existing operational ledgers. Source HTML is archived
-- separately: unallocated legacy totals must never become invented sales/receipts.
create table private.entry_source_rows(
 id uuid primary key default gen_random_uuid(),source_hash text not null,source_key text not null,module text not null,business_date date,payload jsonb not null,
 unique(source_hash,source_key)
);
revoke all on private.entry_source_rows from public,anon,authenticated;
create table public.entry_journal(
 id uuid primary key default gen_random_uuid(),module text not null,action text not null,business_date date not null,input jsonb not null,result jsonb not null,
 replaces_id uuid unique references public.entry_journal(id),version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
create table public.entry_payables(
 id uuid primary key default gen_random_uuid(),code text not null unique,partner text not null,incurred_on date not null,due_on date,amount_vnd bigint not null check(amount_vnd>0),note text not null,
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
create table public.entry_payable_payments(
 id uuid primary key default gen_random_uuid(),payable_id uuid not null references public.entry_payables(id),ledger_id uuid not null unique references public.cash_ledger(id),amount_vnd bigint not null check(amount_vnd>0),
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
do $$declare t text;m text;begin
 for t,m in select * from(values('entry_journal','audit'),('entry_payables','receivables'),('entry_payable_payments','receivables')) x(t,m) loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 insert into private.table_modules values(t,m);
 execute format('create trigger %I before insert or update or delete on public.%I for each row execute function private.record_change(%L)',t||'_audit',t,m);
 execute format('create trigger %I before update or delete on public.%I for each row execute function private.production_material_immutable()',t||'_immutable',t);
 end loop;
end $$;

create function private.entry_module(p_action text) returns text language sql immutable set search_path='' as $$
 select case p_action when 'sale' then 'sales' when 'attendance' then 'attendance' when 'target' then 'targets' when 'loan' then 'loans' when 'loan_payment' then 'loans' when 'debt' then 'receivables' when 'payable' then 'receivables' when 'payable_payment' then 'receivables' when 'receipt' then 'payments' when 'cash' then 'cash' when 'expense' then 'expenses' when 'payroll' then 'payroll' when 'wage_payment' then 'payroll' end
$$;
create function private.entry_money(p_input jsonb,p_field text) returns bigint language plpgsql immutable set search_path='' as $$begin
 if coalesce(p_input->>p_field,'')!~'^\d{1,15}$' then raise exception 'INVALID_MONEY';end if;
 return (p_input->>p_field)::bigint;end $$;

create function private.entry_payroll(p_month date) returns jsonb language sql stable security definer set search_path='' as $$
 with shifts as(select s.employee_id,case when count(distinct s.department_snapshot)=1 then min(s.department_snapshot) else 'MULTI' end department,sum((extract(epoch from(s.ends_at-s.starts_at))/60-s.break_minutes)/60) hours,
 sum(round((extract(epoch from(s.ends_at-s.starts_at))/60-s.break_minutes)/60*p.hourly_rate_vnd)) base,
 sum(coalesce(a.allowance,0)) allowance,sum(coalesce(a.advance,0)) advance,sum(coalesce(a.deduction,0)) deduction
 from public.attendance_shifts s join public.attendance_pay_snapshots p on p.shift_id=s.id
 left join lateral(select sum(amount_vnd) filter(where kind in('daily','support')) allowance,sum(amount_vnd) filter(where kind='advance') advance,sum(amount_vnd) filter(where kind='deduction') deduction from public.attendance_allowances where shift_id=s.id) a on true
 where s.status='posted' and (s.starts_at at time zone 'Asia/Ho_Chi_Minh')::date>=p_month and (s.starts_at at time zone 'Asia/Ho_Chi_Minh')::date<(p_month+interval '1 month') group by s.employee_id),
 monthly as(select distinct on(employee_id) employee_id,amount_vnd from public.employee_monthly_allowances where month=p_month order by employee_id,revision desc),
 numbered as(select *,row_number() over(partition by employee_id order by department) n from shifts),
 rows as(select s.employee_id,e.code,e.name,s.department,s.hours::text, s.base::text base_vnd,(s.allowance+case when s.n=1 then coalesce(m.amount_vnd,0) else 0 end)::text allowance_vnd,s.advance::text advance_vnd,s.deduction::text deduction_vnd,
 (s.base+s.allowance+case when s.n=1 then coalesce(m.amount_vnd,0) else 0 end-s.advance-s.deduction)::text payable_vnd from numbered s join public.employees e on e.id=s.employee_id left join monthly m on m.employee_id=s.employee_id)
 select coalesce(jsonb_agg(to_jsonb(rows) order by department,code),'[]') from rows
$$;
create function private.entry_payroll_version(p_month date) returns text language sql stable security definer set search_path='' as $$
 select md5(private.entry_payroll(p_month)::text||coalesce((select string_agg(id::text||':'||version::text||':'||status,',' order by id) from public.attendance_shifts where (starts_at at time zone 'Asia/Ho_Chi_Minh')::date between p_month and (p_month+interval '1 month -1 day')::date),'')||coalesce((select string_agg(id::text,',' order by id) from public.employee_monthly_allowances where month=p_month),''))
$$;

create function public.entry_workspace(p_module text,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb='[]';options jsonb='{}';sources jsonb;journal jsonb;first_day date=date_trunc('month',p_date)::date;last_day date=(date_trunc('month',p_date)+interval '1 month -1 day')::date;begin
 if p_date is null or not isfinite(p_date) or p_module not in('sales','attendance','targets','loans','receivables','cash','payroll','entry') then raise exception 'INVALID_ENTRY_SCOPE';end if;
 if p_module<>'entry' and not private.can(p_module,'view') then raise exception 'FORBIDDEN';end if;
 if p_module='entry' and not exists(select 1 from public.profiles where id=auth.uid() and enabled) then raise exception 'FORBIDDEN';end if;
 if p_module in('sales','receivables') and private.can('stores','view') then options=options||jsonb_build_object('stores',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name) order by code),'[]') from public.stores where active));end if;
 if p_module='sales' and private.can('products','view') then options=options||jsonb_build_object('products',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'unit',sale_unit) order by code),'[]') from public.products where not archived),'offers',(select coalesce(jsonb_agg(jsonb_build_object('store_id',s.id,'product_id',p.id,'price_vnd',o.price_vnd::text,'discount_rate',o.discount_rate::text)),'[]') from public.stores s cross join public.products p cross join lateral private.commercial_offer(s.id,p.id,p_date) o where s.active and not p.archived));end if;
 if p_module in('sales','receivables','cash','loans','payroll') and private.can('cash','view') then options=options||jsonb_build_object('accounts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name,'kind',kind) order by code),'[]') from public.bank_accounts where not archived));end if;
 if p_module='sales' then
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into rows from(select d.id,d.store_id,s.name store,d.sold_on,d.status,sum(l.net_revenue_vnd)::text amount_vnd,jsonb_agg(jsonb_build_object('product_id',l.product_id,'delivered',l.delivered::text,'sold',l.sold::text,'returned',l.returned::text,'store_borne',l.store_borne::text,'price_vnd',l.price_vnd::text,'discount_rate',l.discount_rate::text)) lines from public.sales_documents d join public.stores s on s.id=d.store_id join public.sales_lines l on l.document_id=d.id where d.sold_on=p_date and d.status='posted' group by d.id,s.name order by d.created_at desc limit 100) t;
 elsif p_module='attendance' then
 if private.can('employees','view') then options=options||jsonb_build_object('employees',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'code',e.code,'name',e.name,'department',d.code) order by e.code),'[]') from public.employees e left join public.departments d on d.id=e.department_id where e.active));end if;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into rows from(select s.id,e.code,e.name,s.department_snapshot department,s.starts_at,s.ends_at,s.break_minutes,((extract(epoch from(s.ends_at-s.starts_at))/60-s.break_minutes)/60)::text hours from public.attendance_shifts s join public.employees e on e.id=s.employee_id where s.status='posted' and(s.starts_at at time zone 'Asia/Ho_Chi_Minh')::date=p_date order by s.starts_at limit 200) t;
 elsif p_module='loans' then
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into rows from(select l.id,l.name,l.lender,l.borrowed_on,l.due_on,l.principal_vnd::text,(l.principal_vnd-coalesce((select sum(principal_vnd) from public.loan_payments where loan_id=l.id and paid_on<=p_date),0))::text balance_vnd,coalesce((select sum(interest_vnd)::text from public.loan_payments where loan_id=l.id and paid_on<=p_date),'0') interest_paid_vnd from public.loans l where l.borrowed_on<=p_date order by l.borrowed_on desc limit 200) t;
 elsif p_module='receivables' then
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into rows from(select r.id,'receivable' kind,s.name partner,r.incurred_on,r.due_on,r.amount_vnd::text,
 (r.amount_vnd+coalesce((select sum(amount_vnd) from public.debt_adjustments where receivable_id=r.id and adjustment_on<=p_date),0)-coalesce((select sum(a.amount_vnd) from public.receipt_allocations a join public.payment_receipts p on p.id=a.receipt_id where a.receivable_id=r.id and p.status='posted' and p.received_on<=p_date),0))::text balance_vnd,r.store_id from public.receivables r join public.stores s on s.id=r.store_id where r.incurred_on<=p_date
 union all select p.id,'payable',p.partner,p.incurred_on,p.due_on,p.amount_vnd::text,(p.amount_vnd-coalesce((select sum(pp.amount_vnd) from public.entry_payable_payments pp join public.cash_ledger cl on cl.id=pp.ledger_id where payable_id=p.id and cl.occurred_on<=p_date),0))::text,null::uuid from public.entry_payables p where p.incurred_on<=p_date order by incurred_on desc limit 300) t;
 elsif p_module='cash' then
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into rows from(select l.id,l.occurred_on,a.name account,l.direction,l.amount_vnd::text,l.note,l.receipt_id,l.loan_payment_id,l.expense_id,l.payroll_line_id,l.reverses_id from public.cash_ledger l join public.bank_accounts a on a.id=l.account_id where l.occurred_on between first_day and last_day order by l.occurred_on desc,l.created_at desc limit 300) t;
 options=options||jsonb_build_object('balances',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from(select a.id,a.name,a.kind,case when exists(select 1 from public.entry_journal j where j.action='cash' and j.input->>'category'='opening' and j.input->>'account_id'=a.id::text and j.business_date<=p_date) then coalesce((select sum(case when direction='in' then amount_vnd else -amount_vnd end)::text from public.cash_ledger where account_id=a.id and occurred_on<=p_date),'0') end balance_vnd from public.bank_accounts a where not archived) t));
 elsif p_module='targets' then
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into rows from(select t.id,t.metric,t.value::text,t.denominator,p.starts_on,p.ends_on from public.targets t join public.target_periods p on p.id=t.period_id where p.starts_on<=p_date and p.ends_on>=p_date order by p.starts_on desc,t.metric) t;
 elsif p_module='payroll' then
 if not private.can('attendance','view') then raise exception 'FORBIDDEN';end if;
 rows=private.entry_payroll(first_day);
 options=options||jsonb_build_object('posted',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from(select l.id,l.employee_id,l.payable_vnd::text,p.starts_on,p.ends_on,exists(select 1 from public.cash_ledger c where c.payroll_line_id=l.id) paid from public.payroll_lines l join public.payroll_periods p on p.id=l.period_id where p.status='posted' and p.starts_on=first_day) t));
 end if;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into sources from(select source_key,business_date,case when p_module='attendance' and not private.can('payroll','view') then payload-'hourly'-'allowance'-'phone' else payload end payload,source_hash from private.entry_source_rows where module=p_module and private.can(module,'view') order by business_date desc nulls last,source_key limit 500) t;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into journal from(select id,action,business_date,case when p_module='attendance' and not private.can('payroll','view') then input-'daily'-'support'-'advance'-'deduction' else input end input,result,replaces_id,created_at,created_by from public.entry_journal where module=p_module and private.can(module,'view') order by created_at desc limit 100) t;
 return jsonb_build_object('rows',rows,'options',options,'sources',sources,'history',journal,'date',p_date,'month',first_day,'payroll_version',case when p_module='payroll' then private.entry_payroll_version(first_day) end);
end $$;

create function public.submit_entry(p_action text,p_date date,p_input jsonb,p_previous uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m text=private.entry_module(p_action);cached jsonb;r jsonb;id uuid;ledger uuid;parent uuid;item jsonb;f text;qty numeric;price bigint;discount numeric;total bigint=0;amount bigint;prior public.entry_journal;department text;pay public.employee_pay_rates;first_day date=date_trunc('month',p_date)::date;last_day date=(date_trunc('month',p_date)+interval '1 month -1 day')::date;begin
 if m is null or not private.can(m,'view') or not private.can(m,'create') or not private.can(m,'approve') then raise exception 'FORBIDDEN';end if;
 if p_date is null or not isfinite(p_date) or jsonb_typeof(p_input) is distinct from 'object' or length(trim(coalesce(p_input->>'note',''))) not between 3 and 2000 then raise exception 'INVALID_ENTRY';end if;
 cached=private.begin_request(p_key,'entry:'||p_action,jsonb_build_object('date',p_date,'input',p_input,'previous',p_previous));if cached is not null then return cached;end if;
 perform private.assert_open(p_date);perform pg_advisory_xact_lock(170032);
 if p_action in('loan_payment','receipt','payable_payment','expense','cash','wage_payment') or(p_action='loan' and coalesce((p_input->>'receive_cash')::boolean,false)) then
 if not private.can('cash','view') or not private.can('cash','create') or not exists(select 1 from public.bank_accounts where public.bank_accounts.id=(p_input->>'account_id')::uuid and not archived) then raise exception 'ACTIVE_CASH_ACCOUNT_REQUIRED';end if;end if;
 if p_previous is not null then
 select * into strict prior from public.entry_journal where public.entry_journal.id=p_previous;
 if prior.action<>p_action or (case when p_action='target' then date_trunc('month',prior.business_date)::date<>first_day else prior.business_date<>p_date end) or exists(select 1 from public.entry_journal where replaces_id=p_previous) then raise exception 'VERSION_CONFLICT';end if;
 if not private.can(m,'edit') then raise exception 'FORBIDDEN';end if;
 -- Financial corrections with settlement need a linked financial adjustment,
 -- never deletion/replay of a complete day over already paid documents.
 if p_action='sale' then
 parent=(prior.result->>'id')::uuid;
 if exists(select 1 from public.receipt_allocations a join public.receivables d on d.id=a.receivable_id where d.sales_document_id=parent) or exists(select 1 from public.kiosk_return_lots k join public.sales_lines l on l.id=k.source_line_id where l.document_id=parent) then raise exception 'SETTLED_DOCUMENT_ADJUSTMENT_REQUIRED';end if;
 update public.sales_documents set status='reversed' where public.sales_documents.id=parent;
 insert into public.debt_adjustments(receivable_id,adjustment_on,amount_vnd,reason) select d.id,p_date,-d.amount_vnd,p_input->>'note' from public.receivables d where sales_document_id=parent and amount_vnd>0;
 elsif p_action='attendance' then
 if exists(select 1 from public.payroll_periods where status='posted' and starts_on<=p_date and ends_on>=p_date) then raise exception 'PAYROLL_MONTH_POSTED';end if;
 if exists(select 1 from public.attendance_allowances where shift_id=(prior.result->>'id')::uuid and amount_vnd>0) and(not private.can('payroll','create') or not private.can('payroll','approve')) then raise exception 'FORBIDDEN_PAYROLL';end if;
 update public.attendance_shifts set status='reversed' where public.attendance_shifts.id=(prior.result->>'id')::uuid;
 elsif p_action<>'target' then raise exception 'LINKED_ADJUSTMENT_REQUIRED';end if;
 end if;
 if p_action='sale' then
 if not private.can('products','view') or not private.can('stores','view') or not private.can('receivables','create') then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.stores where public.stores.id=(p_input->>'store_id')::uuid and active) then raise exception 'INVALID_STORE';end if;
 if jsonb_typeof(p_input->'lines') is distinct from 'array' or jsonb_array_length(p_input->'lines') not between 1 and 100 then raise exception 'INVALID_LINES';end if;
 insert into public.sales_documents(store_id,sold_on,status) values((p_input->>'store_id')::uuid,p_date,'posted') returning public.sales_documents.id into id;
 for item in select value from jsonb_array_elements(p_input->'lines') loop
 foreach f in array array['delivered','sold','returned','store_borne'] loop if coalesce(item->>f,'')!~'^\d{1,12}(\.\d{1,6})?$' then raise exception 'INVALID_QUANTITY';end if;end loop;
 if not exists(select 1 from public.products where public.products.id=(item->>'product_id')::uuid and not archived) then raise exception 'INVALID_PRODUCT';end if;
 select o.price_vnd,o.discount_rate into price,discount from private.commercial_offer((p_input->>'store_id')::uuid,(item->>'product_id')::uuid,p_date) o;
 if price is null then raise exception 'PRICE_REQUIRED';end if;
 qty=(item->>'sold')::numeric+(item->>'store_borne')::numeric;amount=round(qty*price*(1-discount));total=total+amount;
 insert into public.sales_lines(document_id,product_id,delivered,sold,returned,store_borne,price_vnd,discount_rate,net_revenue_vnd) values(id,(item->>'product_id')::uuid,(item->>'delivered')::numeric,(item->>'sold')::numeric,(item->>'returned')::numeric,(item->>'store_borne')::numeric,price,discount,amount);
 end loop;
 insert into public.receivables(store_id,sales_document_id,incurred_on,amount_vnd) values((p_input->>'store_id')::uuid,id,p_date,total);
 r=jsonb_build_object('id',id,'amount_vnd',total::text);
 elsif p_action='attendance' then
 if (p_input->>'starts_at')::timestamptz at time zone 'Asia/Ho_Chi_Minh' is null or ((p_input->>'starts_at')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date<>p_date then raise exception 'SHIFT_DATE_MISMATCH';end if;
 if exists(select 1 from public.payroll_periods where status='posted' and starts_on<=p_date and ends_on>=p_date) then raise exception 'PAYROLL_MONTH_POSTED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_input->>'employee_id',0));
 select coalesce(nullif(p_input->>'department',''),d.code) into department from public.employees e left join public.departments d on d.id=e.department_id where e.id=(p_input->>'employee_id')::uuid and e.active;
 if department is null or department not in('SX','VP','BH') then raise exception 'DEPARTMENT_REQUIRED';end if;
 if exists(select 1 from public.attendance_shifts s where s.employee_id=(p_input->>'employee_id')::uuid and s.status='posted' and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange((p_input->>'starts_at')::timestamptz,(p_input->>'ends_at')::timestamptz,'[)')) then raise exception 'SHIFT_OVERLAP';end if;
 select * into pay from public.employee_pay_rates where employee_id=(p_input->>'employee_id')::uuid and effective_from<=p_date and(effective_to is null or effective_to>=p_date) order by effective_from desc limit 1;
 if pay.id is null then raise exception 'PAY_RATE_MISSING';end if;
 insert into public.attendance_shifts(employee_id,starts_at,ends_at,break_minutes,department_snapshot,status) values((p_input->>'employee_id')::uuid,(p_input->>'starts_at')::timestamptz,(p_input->>'ends_at')::timestamptz,(p_input->>'break_minutes')::integer,department,'posted') returning public.attendance_shifts.id into id;
 insert into public.attendance_pay_snapshots(shift_id,hourly_rate_vnd,default_daily_allowance_vnd) values(id,pay.hourly_vnd,0);
 r=jsonb_build_object('shift_id',id,'hours',((extract(epoch from((p_input->>'ends_at')::timestamptz-(p_input->>'starts_at')::timestamptz))/60-(p_input->>'break_minutes')::integer)/60)::text);
 foreach f in array array['daily','support','advance','deduction'] loop
 amount=private.entry_money(p_input,f);if amount>0 then
 if not private.can('payroll','create') or not private.can('payroll','approve') then raise exception 'FORBIDDEN_PAYROLL';end if;
 insert into public.attendance_allowances(shift_id,kind,amount_vnd,business_date,note) values(id,f,amount,p_date,p_input->>'note');end if;end loop;
 r=r||jsonb_build_object('id',id);
 elsif p_action='target' then
 perform private.assert_open(first_day);perform private.assert_open(last_day);
 if exists(select 1 from public.accounting_periods where status='closed' and starts_on<=last_day and ends_on>=first_day) then raise exception 'PERIOD_CLOSED';end if;
 if coalesce(p_input->>'metric','') not in('revenue','foodCost','productionLabor','managementLabor','fixedRate','depreciationRate','marketingRate','defect','cancel','returnRate','minCash','fixedBudget','profit') or coalesce(p_input->>'value','')!~'^\d{1,15}(\.\d{1,6})?$' then raise exception 'INVALID_TARGET';end if;
 if p_input->>'metric' not in('revenue','minCash','fixedBudget','profit') and(p_input->>'value')::numeric>100 then raise exception 'INVALID_TARGET';end if;
 select j.id into parent from public.entry_journal j where j.action='target' and date_trunc('month',j.business_date)=first_day and j.input->>'metric'=p_input->>'metric' and not exists(select 1 from public.entry_journal n where n.replaces_id=j.id);
 if parent is distinct from p_previous then raise exception 'VERSION_CONFLICT';end if;
 insert into public.target_periods(starts_on,ends_on,name) values(first_day,last_day,to_char(first_day,'MM/YYYY')) on conflict(starts_on,ends_on) do update set name=excluded.name returning public.target_periods.id into parent;
 insert into public.targets(period_id,metric,value,denominator) values(parent,p_input->>'metric',(p_input->>'value')::numeric,case when p_input->>'metric' in('foodCost','productionLabor','managementLabor','fixedRate','depreciationRate','marketingRate') then 'net_revenue' else null end) on conflict(period_id,metric) do update set value=excluded.value,denominator=excluded.denominator returning public.targets.id into id;r=jsonb_build_object('id',id);
 elsif p_action='loan' then
 amount=private.entry_money(p_input,'amount');if amount<=0 or length(trim(coalesce(p_input->>'lender','')))<2 or length(trim(coalesce(p_input->>'name','')))<2 then raise exception 'INVALID_LOAN';end if;
 insert into public.loans(name,lender,borrowed_on,principal_vnd,due_on) values(p_input->>'name',p_input->>'lender',p_date,amount,nullif(p_input->>'due_on','')::date) returning public.loans.id into id;
 -- Existing/opening loans do not imply cash received today.
 if coalesce((p_input->>'receive_cash')::boolean,false) then
 if not private.can('cash','create') then raise exception 'FORBIDDEN';end if;
 insert into public.cash_ledger(account_id,occurred_on,direction,amount_vnd,note) values((p_input->>'account_id')::uuid,p_date,'in',amount,'Nhận vay: '||id||' '||(p_input->>'note'));end if;r=jsonb_build_object('id',id);
 elsif p_action='loan_payment' then
 r=public.pay_loan((p_input->>'loan_id')::uuid,(p_input->>'account_id')::uuid,p_date,private.entry_money(p_input,'principal'),private.entry_money(p_input,'interest'),gen_random_uuid());
 elsif p_action='receipt' then
 if exists(select 1 from jsonb_array_elements(p_input->'allocations') a join public.receivables d on d.id=(a->>'receivable_id')::uuid where d.incurred_on>p_date) then raise exception 'PAYMENT_BEFORE_DEBT';end if;
 r=public.post_payment((p_input->>'store_id')::uuid,(p_input->>'account_id')::uuid,p_date,private.entry_money(p_input,'amount'),p_input->'allocations',p_input->>'note',gen_random_uuid());
 elsif p_action='debt' then
 amount=private.entry_money(p_input,'amount');if amount<=0 then raise exception 'INVALID_MONEY';end if;
 insert into public.receivables(store_id,incurred_on,due_on,amount_vnd,opening_balance) values((p_input->>'store_id')::uuid,p_date,nullif(p_input->>'due_on','')::date,amount,true) returning public.receivables.id into id;r=jsonb_build_object('id',id);
 elsif p_action='payable' then
 if length(trim(coalesce(p_input->>'code','')))<2 or length(trim(coalesce(p_input->>'partner','')))<2 then raise exception 'INVALID_PAYABLE';end if;
 insert into public.entry_payables(code,partner,incurred_on,due_on,amount_vnd,note) values(p_input->>'code',p_input->>'partner',p_date,nullif(p_input->>'due_on','')::date,private.entry_money(p_input,'amount'),p_input->>'note') returning public.entry_payables.id into id;r=jsonb_build_object('id',id);
 elsif p_action='payable_payment' then
 if not private.can('cash','create') then raise exception 'FORBIDDEN';end if;
 parent=(p_input->>'payable_id')::uuid;amount=private.entry_money(p_input,'amount');perform 1 from public.entry_payables where public.entry_payables.id=parent and incurred_on<=p_date for update;if not found then raise exception 'PAYABLE_NOT_FOUND';end if;
 if amount<=0 or amount>(select amount_vnd-coalesce((select sum(amount_vnd) from public.entry_payable_payments where payable_id=parent),0) from public.entry_payables where public.entry_payables.id=parent) then raise exception 'DEBT_OVERPAYMENT';end if;
 insert into public.cash_ledger(account_id,occurred_on,direction,amount_vnd,note) values((p_input->>'account_id')::uuid,p_date,'out',amount,p_input->>'note') returning public.cash_ledger.id into ledger;
 insert into public.entry_payable_payments(payable_id,ledger_id,amount_vnd) values(parent,ledger,amount) returning public.entry_payable_payments.id into id;r=jsonb_build_object('id',id,'ledger_id',ledger);
 elsif p_action='expense' then
 r=public.post_expense((p_input->>'account_id')::uuid,p_date,p_input->>'category',private.entry_money(p_input,'amount'),p_input->>'note',gen_random_uuid());
 elsif p_action='cash' then
 if p_input->>'category' not in('opening','capital','withdrawal','other_in','other_out') then raise exception 'USE_LINKED_DOCUMENT';end if;
 amount=private.entry_money(p_input,'amount');
 if p_input->>'category'='opening' and exists(select 1 from public.cash_ledger where account_id=(p_input->>'account_id')::uuid) then raise exception 'OPENING_RECONCILIATION_REQUIRED';end if;
 if p_input->>'category'='opening' and exists(select 1 from public.entry_journal where action='cash' and input->>'category'='opening' and input->>'account_id'=p_input->>'account_id') then raise exception 'OPENING_ALREADY_RECORDED';end if;
 if amount>0 then insert into public.cash_ledger(account_id,occurred_on,direction,amount_vnd,note) values((p_input->>'account_id')::uuid,p_date,case when p_input->>'category' in('opening','capital','other_in') then 'in' else 'out' end,amount,(p_input->>'category')||': '||(p_input->>'note')) returning public.cash_ledger.id into id;
 elsif p_input->>'category'<>'opening' then raise exception 'INVALID_MONEY';end if;r=jsonb_build_object('id',id);
 elsif p_action='payroll' then
 if not private.can('attendance','view') then raise exception 'FORBIDDEN';end if;
 perform private.assert_open(first_day);perform private.assert_open(last_day);
 if exists(select 1 from public.accounting_periods where status='closed' and starts_on<=last_day and ends_on>=first_day) then raise exception 'PERIOD_CLOSED';end if;
 if exists(select 1 from public.payroll_periods where starts_on<=last_day and ends_on>=first_day and status='posted') then raise exception 'PAYROLL_MONTH_POSTED';end if;
 if p_input->>'expected' is distinct from private.entry_payroll_version(first_day) then raise exception 'VERSION_CONFLICT';end if;
 insert into public.payroll_periods(starts_on,ends_on,status) values(first_day,last_day,'posted') returning public.payroll_periods.id into parent;
 for item in select value from jsonb_array_elements(private.entry_payroll(first_day)) loop
 -- A person can work in multiple departments; monthly money is allocated only once.
 insert into public.payroll_lines(period_id,employee_id,hours,base_vnd,allowance_vnd,advance_vnd,deduction_vnd,bonus_vnd,payable_vnd) values(parent,(item->>'employee_id')::uuid,(item->>'hours')::numeric,(item->>'base_vnd')::bigint,(item->>'allowance_vnd')::bigint,(item->>'advance_vnd')::bigint,(item->>'deduction_vnd')::bigint,0,(item->>'payable_vnd')::bigint)
 on conflict(period_id,employee_id) do update set hours=public.payroll_lines.hours+excluded.hours,base_vnd=public.payroll_lines.base_vnd+excluded.base_vnd,allowance_vnd=public.payroll_lines.allowance_vnd+excluded.allowance_vnd,advance_vnd=public.payroll_lines.advance_vnd+excluded.advance_vnd,deduction_vnd=public.payroll_lines.deduction_vnd+excluded.deduction_vnd,payable_vnd=public.payroll_lines.payable_vnd+excluded.payable_vnd;
 end loop;
 if not exists(select 1 from public.payroll_lines where period_id=parent) then raise exception 'NO_ATTENDANCE';end if;r=jsonb_build_object('id',parent);
 elsif p_action='wage_payment' then
 if not private.can('cash','create') then raise exception 'FORBIDDEN';end if;
 select l.payable_vnd into strict amount from public.payroll_lines l join public.payroll_periods p on p.id=l.period_id where l.id=(p_input->>'payroll_line_id')::uuid and p.status='posted' and p.starts_on<=p_date for update of l;
 insert into public.cash_ledger(account_id,occurred_on,direction,amount_vnd,payroll_line_id,note) values((p_input->>'account_id')::uuid,p_date,'out',amount,(p_input->>'payroll_line_id')::uuid,p_input->>'note') returning public.cash_ledger.id into id;r=jsonb_build_object('id',id);
 end if;
 insert into public.entry_journal(module,action,business_date,input,result,replaces_id) values(m,p_action,p_date,p_input,r,p_previous) returning public.entry_journal.id into id;
 return private.finish_request(p_key,r||jsonb_build_object('journal_id',id));end $$;
revoke all on all functions in schema private from public;
revoke all on function public.entry_workspace(text,date),public.submit_entry(text,date,jsonb,uuid,uuid) from public,anon;
grant execute on function public.entry_workspace(text,date),public.submit_entry(text,date,jsonb,uuid,uuid) to authenticated;
commit;

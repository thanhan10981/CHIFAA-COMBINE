begin;
alter table public.loans add column active boolean not null default true;
alter table public.loan_payments add column active boolean not null default true;
alter table public.receivables add column active boolean not null default true;
alter table public.entry_payables add column active boolean not null default true;
alter table public.entry_payables drop constraint entry_payables_code_key;
create unique index entry_payable_active_code on public.entry_payables(code) where active;
alter table public.entry_payable_payments add column active boolean not null default true;
alter table public.targets add column active boolean not null default true;
create function private.entry_deactivate_only() returns trigger language plpgsql set search_path='' as $$begin
 if TG_OP='DELETE' or not old.active or new.active or(to_jsonb(new)-array['active','version','updated_at','updated_by']) is distinct from(to_jsonb(old)-array['active','version','updated_at','updated_by']) then raise exception 'DOCUMENT_IMMUTABLE';end if;return new;end $$;
drop trigger entry_payables_immutable on public.entry_payables;
drop trigger entry_payable_payments_immutable on public.entry_payable_payments;
create trigger entry_payables_immutable before update or delete on public.entry_payables for each row execute function private.entry_deactivate_only();
create trigger entry_payable_payments_immutable before update or delete on public.entry_payable_payments for each row execute function private.entry_deactivate_only();
alter table public.cash_ledger add column effective boolean not null default true;
alter table public.payroll_periods drop constraint payroll_periods_starts_on_ends_on_key;
create unique index payroll_posted_month on public.payroll_periods(starts_on,ends_on) where status='posted';
alter table public.cash_ledger drop constraint cash_ledger_payroll_line_id_key;
create unique index cash_payroll_effective on public.cash_ledger(payroll_line_id) where effective;
create table public.entry_changes(
 id uuid primary key default gen_random_uuid(),journal_id uuid not null unique references public.entry_journal(id),replacement_id uuid references public.entry_journal(id),
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
alter table public.entry_changes enable row level security;
revoke all on public.entry_changes from public,anon,authenticated;
insert into private.table_modules values('entry_changes','audit');
create trigger entry_changes_audit before insert or update or delete on public.entry_changes for each row execute function private.record_change('audit');
create trigger entry_changes_immutable before update or delete on public.entry_changes for each row execute function private.production_material_immutable();
-- Keep the existing exact-money implementations, now excluding reversed entries.
do $$declare definition text;begin
 select pg_get_functiondef('public.pay_loan(uuid,uuid,date,bigint,bigint,uuid)'::regprocedure) into definition;
 definition=replace(definition,'where loan_id=p_loan;','where loan_id=p_loan and active;');
 definition=replace(definition,'where id=p_loan for update','where id=p_loan and active for update');execute definition;
 select pg_get_functiondef('public.post_payment(uuid,uuid,date,bigint,jsonb,text,uuid)'::regprocedure) into definition;
 definition=replace(definition,$find$from public.receivables where id=(allocation->>'receivable_id')::uuid;$find$,$find$from public.receivables where id=(allocation->>'receivable_id')::uuid and active;$find$);execute definition;

end $$;
alter function public.submit_entry(text,date,jsonb,uuid,uuid) set schema private;
revoke all on function private.submit_entry(text,date,jsonb,uuid,uuid) from public,authenticated;
alter function public.entry_workspace(text,date) set schema private;
revoke all on function private.entry_workspace(text,date) from public,authenticated;
do $$declare definition text;begin
 select pg_get_functiondef('private.submit_entry(text,date,jsonb,uuid,uuid)'::regprocedure) into definition;
 definition=replace(definition,'from public.entry_payable_payments where payable_id=parent','from public.entry_payable_payments where payable_id=parent and active');
 definition=replace(definition,'where public.entry_payables.id=parent and incurred_on<=p_date','where public.entry_payables.id=parent and active and incurred_on<=p_date');
 definition=replace(definition,'where account_id=(p_input->>''account_id'')::uuid) then raise exception ''OPENING_RECONCILIATION_REQUIRED''','where account_id=(p_input->>''account_id'')::uuid and effective) then raise exception ''OPENING_RECONCILIATION_REQUIRED''');
 definition=replace(definition,'from public.entry_journal where action=''cash'' and input->>''category''=''opening''','from public.entry_journal j where not exists(select 1 from public.entry_changes c where c.journal_id=j.id) and action=''cash'' and input->>''category''=''opening''');

 execute definition;
 select pg_get_functiondef('private.entry_workspace(text,date)'::regprocedure) into definition;
 definition=replace(definition,'where c.payroll_line_id=l.id) paid','where c.payroll_line_id=l.id and c.effective) paid');
 definition=replace(definition,'where j.action=''cash'' and j.input->>''category''=''opening''','where not exists(select 1 from public.entry_changes c where c.journal_id=j.id) and j.action=''cash'' and j.input->>''category''=''opening''');
 definition=replace(definition,'where loan_id=l.id and paid_on<=p_date','where loan_id=l.id and active and paid_on<=p_date');
 definition=replace(definition,'where l.borrowed_on<=p_date','where l.borrowed_on<=p_date and l.active');
 definition=replace(definition,'where r.incurred_on<=p_date','where r.incurred_on<=p_date and r.active');
 definition=replace(definition,'where payable_id=p.id and cl.occurred_on<=p_date','where payable_id=p.id and pp.active and cl.occurred_on<=p_date');
 definition=replace(definition,'where p.incurred_on<=p_date','where p.incurred_on<=p_date and p.active');
 definition=replace(definition,'where p.starts_on<=p_date and p.ends_on>=p_date','where p.starts_on<=p_date and p.ends_on>=p_date and t.active');
 execute definition;
end $$;

create function private.reverse_entry(p_journal uuid) returns void language plpgsql security definer set search_path='' as $$
declare j public.entry_journal;d uuid;l record;child record;begin
 select * into strict j from public.entry_journal where id=p_journal for update;
 if not private.can(j.module,'view') or not private.can(j.module,'edit') or not private.can(j.module,'approve') then raise exception 'FORBIDDEN';end if;
 if exists(select 1 from public.entry_changes where journal_id=j.id) or exists(select 1 from public.entry_journal where replaces_id=j.id) then raise exception 'VERSION_CONFLICT';end if;
 perform private.assert_open(j.business_date);
 d=coalesce(j.result->>'id',j.result->>'receipt_id',j.result->>'payment_id',j.result->>'expense_id')::uuid;
 if j.action='sale' then
 if exists(select 1 from public.kiosk_return_lots k join public.sales_lines s on s.id=k.source_line_id where s.document_id=d and k.status<>'reversed') then raise exception 'UNDO_LINKED_RETURN_FIRST';end if;
 for child in select distinct ej.id from public.entry_journal ej join public.receipt_allocations a on a.receipt_id=(ej.result->>'receipt_id')::uuid join public.receivables r on r.id=a.receivable_id where r.sales_document_id=d and ej.action='receipt' and not exists(select 1 from public.entry_changes c where c.journal_id=ej.id) loop
 perform private.reverse_entry(child.id);insert into public.entry_changes(journal_id) values(child.id);end loop;
 if exists(select 1 from public.receipt_allocations a join public.payment_receipts p on p.id=a.receipt_id join public.receivables r on r.id=a.receivable_id where r.sales_document_id=d and p.status='posted') then raise exception 'UNDO_LINKED_PAYMENT_FIRST';end if;
 update public.sales_documents set status='reversed' where id=d;update public.receivables set active=false where sales_document_id=d;
 elsif j.action='attendance' then
 if exists(select 1 from public.payroll_periods p join public.payroll_lines pl on pl.period_id=p.id join public.cash_ledger c on c.payroll_line_id=pl.id and c.effective where p.status='posted' and p.starts_on<=j.business_date and p.ends_on>=j.business_date) then raise exception 'UNDO_PAYROLL_PAYMENT_FIRST';end if;
 update public.payroll_periods set status='reversed' where status='posted' and starts_on<=j.business_date and ends_on>=j.business_date;
 if exists(select 1 from public.attendance_allowances where shift_id=d and amount_vnd>0) and not private.can('payroll','approve') then raise exception 'FORBIDDEN_PAYROLL';end if;
 update public.attendance_shifts set status='reversed' where id=d;
 elsif j.action='target' then update public.targets set active=false where id=d;
 elsif j.action='loan' then
 if exists(select 1 from public.loan_payments where loan_id=d and active) then raise exception 'UNDO_LOAN_PAYMENTS_FIRST';end if;
 update public.loans set active=false where id=d;
 elsif j.action='loan_payment' then update public.loan_payments set active=false where id=d;
 elsif j.action='receipt' then
 if not private.can('receivables','edit') then raise exception 'FORBIDDEN';end if;
 update public.payment_receipts set status='reversed' where id=d;
 elsif j.action='debt' then
 if exists(select 1 from public.receipt_allocations a join public.payment_receipts p on p.id=a.receipt_id where a.receivable_id=d and p.status='posted') then raise exception 'UNDO_LINKED_PAYMENT_FIRST';end if;
 update public.receivables set active=false where id=d;
 elsif j.action='payable' then
 if exists(select 1 from public.entry_payable_payments where payable_id=d and active) then raise exception 'UNDO_LINKED_PAYMENT_FIRST';end if;
 update public.entry_payables set active=false where id=d;
 elsif j.action='payable_payment' then update public.entry_payable_payments set active=false where id=d;
 elsif j.action='expense' then update public.expenses set status='reversed' where id=d;
 elsif j.action='payroll' then
 if exists(select 1 from public.cash_ledger c join public.payroll_lines pl on pl.id=c.payroll_line_id where pl.period_id=d and c.effective) then raise exception 'UNDO_PAYROLL_PAYMENT_FIRST';end if;
 update public.payroll_periods set status='reversed' where id=d;
 elsif j.action not in('cash','wage_payment') then raise exception 'UNSUPPORTED_ADJUSTMENT';end if;
 for l in select * from public.cash_ledger c where c.effective and(c.id=case when j.action in('cash','wage_payment') then d end or c.id=nullif(j.result->>'ledger_id','')::uuid or c.receipt_id=case when j.action='receipt' then d end or c.loan_payment_id=case when j.action='loan_payment' then d end or c.expense_id=case when j.action='expense' then d end or(j.action='loan' and c.note like 'Nhận vay: '||d||' %')) loop
 if not private.can('cash','create') or not private.can('cash','view') then raise exception 'FORBIDDEN_CASH';end if;
 perform private.assert_open(l.occurred_on);
 update public.cash_ledger set effective=false where id=l.id;
 insert into public.cash_ledger(account_id,occurred_on,direction,amount_vnd,reverses_id,note,effective) values(l.account_id,l.occurred_on,case l.direction when 'in' then 'out' else 'in' end,l.amount_vnd,l.id,'Hoàn tác phiếu '||j.id,false);
 end loop;
end $$;

create function public.delete_entry(p_journal uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare cached jsonb;begin
 cached=private.begin_request(p_key,'entry:delete',jsonb_build_object('id',p_journal));
 if cached is not null then
 if not exists(select 1 from public.entry_journal where id=p_journal and private.can(module,'edit') and private.can(module,'approve')) then raise exception 'FORBIDDEN';end if;return cached;end if;
 perform pg_advisory_xact_lock(170032);perform private.reverse_entry(p_journal);
 insert into public.entry_changes(journal_id) values(p_journal);
 return private.finish_request(p_key,jsonb_build_object('id',p_journal,'deleted',true));end $$;

create function public.submit_entry(p_action text,p_date date,p_input jsonb,p_previous uuid,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;r jsonb;j public.entry_journal;clean jsonb;begin
 if not private.can(private.entry_module(p_action),'view') or not private.can(private.entry_module(p_action),'create') or not private.can(private.entry_module(p_action),'approve') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'entry:v3',jsonb_build_object('action',p_action,'date',p_date,'input',p_input,'previous',p_previous));if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(170032);
 clean=coalesce(p_input,'{}')||jsonb_build_object('note',coalesce(nullif(trim(p_input->>'note'),''),'Ghi nhận '||p_action));
 if p_previous is not null and p_action<>'target' then
 select * into strict j from public.entry_journal where id=p_previous;
 if j.action<>p_action or j.business_date<>p_date then raise exception 'VERSION_CONFLICT';end if;
 perform private.reverse_entry(p_previous);
 insert into public.entry_changes(journal_id) values(p_previous);
 clean=clean||jsonb_build_object('previous_entry',p_previous);
 end if;
 r=private.submit_entry(p_action,p_date,clean,case when p_action='target' then p_previous end,gen_random_uuid());
 if p_action='target' then update public.targets set active=true where id=(r->>'id')::uuid;end if;

 return private.finish_request(p_key,r);end $$;

create function public.entry_workspace(p_module text,p_date date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;rows jsonb;journals jsonb;begin
 result=private.entry_workspace(p_module,p_date);
 select coalesce(jsonb_agg(to_jsonb(j)||jsonb_build_object('voided',exists(select 1 from public.entry_changes c where c.journal_id=j.id) or exists(select 1 from public.entry_journal n where n.replaces_id=j.id)) order by j.created_at desc),'[]') into journals from public.entry_journal j where j.module=p_module or(p_module='cash' and j.module in('payments','expenses') and private.can(j.module,'view'));
 if p_module='attendance' and not private.can('payroll','view') then select coalesce(jsonb_agg(jsonb_set(x,'{input}',(x->'input')-'daily'-'support'-'advance'-'deduction')),'[]') into journals from jsonb_array_elements(journals) x;end if;
 select coalesce(jsonb_agg(x||jsonb_build_object('journal_id',j->>'id')),'[]') into rows from jsonb_array_elements(result->'rows') x left join lateral(select z j from jsonb_array_elements(journals) z where not(z->>'voided')::boolean and coalesce(z->'result'->>'id',z->'result'->>'expense_id',z->'result'->>'receipt_id',z->'result'->>'payment_id')=x->>'id' order by z->>'created_at' desc limit 1) a on true where p_module<>'cash' or exists(select 1 from public.cash_ledger c where c.id=(x->>'id')::uuid and c.effective);
 if p_module='cash' then
 select coalesce(jsonb_agg(x||jsonb_build_object('journal_id',j->>'id')),'[]') into rows from jsonb_array_elements(rows) x left join lateral(select z j from jsonb_array_elements(journals) z join public.cash_ledger c on c.id=(x->>'id')::uuid where not(z->>'voided')::boolean and(coalesce(z->'result'->>'id',z->'result'->>'ledger_id')=c.id::text or z->'result'->>'receipt_id'=c.receipt_id::text or z->'result'->>'expense_id'=c.expense_id::text or z->'result'->>'payment_id'=c.loan_payment_id::text) limit 1) a on true;
 end if;
 result=jsonb_set(result,'{rows}',rows);result=jsonb_set(result,'{history}',journals);result=jsonb_set(result,'{sources}','[]'::jsonb);
 if p_module='payroll' then result=result||jsonb_build_object('shifts',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'employee_id',s.employee_id,'date',(s.starts_at at time zone 'Asia/Ho_Chi_Minh')::date,'starts_at',s.starts_at,'ends_at',s.ends_at,'department',s.department_snapshot,'journal_id',j.id,'input',j.input)),'[]') from public.attendance_shifts s left join public.entry_journal j on j.action='attendance' and j.result->>'id'=s.id::text where s.status='posted' and(s.starts_at at time zone 'Asia/Ho_Chi_Minh')::date between date_trunc('month',p_date)::date and(date_trunc('month',p_date)+interval '1 month -1 day')::date));end if;
 return result;end $$;
revoke all on all functions in schema private from public;
revoke all on function public.submit_entry(text,date,jsonb,uuid,uuid),public.entry_workspace(text,date),public.delete_entry(uuid,uuid) from public,anon;
grant execute on function public.submit_entry(text,date,jsonb,uuid,uuid),public.entry_workspace(text,date),public.delete_entry(uuid,uuid) to authenticated;
commit;

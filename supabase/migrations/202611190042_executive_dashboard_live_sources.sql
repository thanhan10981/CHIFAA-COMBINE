begin;

-- Extend the existing read-only executive dashboard with live module totals.
-- Each figure is exposed only when the caller can read its source module.
create or replace function public.dashboard_summary(p_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare revenue numeric; received numeric; produced numeric; hours numeric;
 revenue_yesterday numeric;cash_balance numeric;food_cost numeric;labor_estimate numeric;revenue_target_daily numeric;
 expense_office numeric;expense_fixed numeric;expense_marketing numeric;expense_recovery numeric;expense_other numeric;depreciation numeric;
 target_values jsonb='{}';inventory_low integer;inventory_unknown integer;result jsonb;
begin
 if not private.can('dashboard','view') then raise exception 'FORBIDDEN'; end if;
 if p_date is null or not isfinite(p_date) then raise exception 'INVALID_DATE'; end if;
 if private.can('sales','view') then
  select case when count(*)>0 and count(*)=count(l.net_revenue_vnd) then sum(l.net_revenue_vnd) end
   into revenue from public.sales_documents d join public.sales_lines l on l.document_id=d.id where d.status='posted' and d.sold_on=p_date;
  select case when count(*)>0 and count(*)=count(l.net_revenue_vnd) then sum(l.net_revenue_vnd) end
   into revenue_yesterday from public.sales_documents d join public.sales_lines l on l.document_id=d.id where d.status='posted' and d.sold_on=p_date-1;
 end if;
 if private.can('payments','view') then select sum(amount_vnd) into received from public.payment_receipts where status='posted' and received_on=p_date;end if;
 if private.can('production','view') then
  select sum(l.main_quantity+l.extra_quantity) into produced from public.production_batches b join public.production_batch_lines l on l.batch_id=b.id where b.status='posted' and b.produced_on=p_date;
 end if;
 if private.can('attendance','view') then
  select sum(extract(epoch from(ends_at-starts_at))/3600-break_minutes/60.0) into hours from public.attendance_shifts where status='posted' and department_snapshot='SX' and (starts_at at time zone 'Asia/Ho_Chi_Minh')::date=p_date;
 end if;
 if private.can('cash','view') then
  select case when count(*)>0 and count(*)=count(*) filter(where initialized) then sum(balance) end into cash_balance
  from(select a.id,
   exists(select 1 from public.entry_journal j where j.action='cash' and j.input->>'category'='opening' and j.input->>'account_id'=a.id::text and j.business_date<=p_date) initialized,
   coalesce((select sum(case when c.direction='in' then c.amount_vnd else -c.amount_vnd end) from public.cash_ledger c where c.account_id=a.id and c.occurred_on<=p_date),0)::numeric balance
   from public.bank_accounts a where not a.archived) accounts;
 end if;
 if private.can('production','view') and private.can('inventory','view') then
  select case when count(*)>0 and count(*)=count(l.unit_cost) then sum(abs(l.quantity)*l.unit_cost) end into food_cost
  from public.inventory_movements m join public.inventory_movement_lines l on l.movement_id=m.id
  where m.status='posted' and m.kind='issue' and m.moved_on=p_date and m.source_batch_id is not null;
 end if;
 if private.can('payroll','view') and private.can('attendance','view') then
  select case when count(*)>0 and count(p.shift_id)=count(*) then sum(round(((extract(epoch from(s.ends_at-s.starts_at))/60-s.break_minutes)/60)*p.hourly_rate_vnd)+coalesce(a.allowance,0)) end into labor_estimate
  from public.attendance_shifts s left join public.attendance_pay_snapshots p on p.shift_id=s.id
  left join lateral(select sum(amount_vnd) filter(where kind in('daily','support')) allowance from public.attendance_allowances where shift_id=s.id) a on true
  where s.status='posted' and s.department_snapshot='SX' and (s.starts_at at time zone 'Asia/Ho_Chi_Minh')::date=p_date;
 end if;
 if private.can('expenses','view') then
  select sum(amount_vnd) filter(where category='office'),sum(amount_vnd) filter(where category='fixed'),sum(amount_vnd) filter(where category='marketing'),
   sum(amount_vnd) filter(where category='recovery'),sum(amount_vnd) filter(where category='other')
   into expense_office,expense_fixed,expense_marketing,expense_recovery,expense_other from public.expenses where status='posted' and spent_on=p_date;
 end if;
 if private.can('assets','view') then select sum(amount_vnd) into depreciation from public.depreciation_entries where period_start=p_date;end if;
 if private.can('targets','view') then
  select coalesce(jsonb_object_agg(active.metric,active.value_text),'{}'::jsonb),
   max(active.daily_value) filter(where active.metric='revenue')
   into target_values,revenue_target_daily
  from(select distinct on(t.metric) t.metric,t.value::text value_text,t.value/nullif((p.ends_on-p.starts_on+1),0) daily_value
   from public.targets t join public.target_periods p on p.id=t.period_id where p.starts_on<=p_date and p.ends_on>=p_date
   order by t.metric,p.starts_on desc,p.created_at desc) active;
 end if;
 if private.can('inventory','view') then
  select case when count(*)>0 then count(*) filter(where q.quantity is not null and m.minimum_quantity is not null and q.quantity<m.minimum_quantity) end,
   case when count(*)>0 then count(*) filter(where q.quantity is null and m.minimum_quantity is not null) end
   into inventory_low,inventory_unknown
  from public.materials m cross join public.warehouses w
  cross join lateral(select case when m.usage_unit_id is not null then private.inventory_quantity(w.id,p_date,m.id,m.usage_unit_id) end quantity) q
  where not m.archived and w.active and w.kind='ingredient' and m.minimum_quantity is not null;
 end if;
 result=jsonb_build_object(
  'date',p_date,'net_revenue_vnd',revenue::text,'revenue_yesterday_vnd',revenue_yesterday::text,'received_vnd',received::text,
  'produced',produced::text,'production_hours',hours::text,'cash_balance_vnd',cash_balance::text,
  'food_cost_vnd',food_cost::text,'production_labor_estimate_vnd',labor_estimate::text,'revenue_target_daily_vnd',revenue_target_daily::text,
  'office_expense_vnd',expense_office::text,'fixed_expense_vnd',expense_fixed::text,'marketing_expense_vnd',expense_marketing::text,
  'recovery_expense_vnd',expense_recovery::text,'other_expense_vnd',expense_other::text,'depreciation_vnd',depreciation::text,
  'targets',target_values,'inventory_low_count',inventory_low,'inventory_unknown_count',inventory_unknown,
  'updated_at',now(),
  'completeness',case when revenue is null or received is null or produced is null or hours is null then 'Một số phân hệ chưa có dữ liệu trong kỳ' else 'Đã tải dữ liệu ghi nhận trong kỳ' end);
 return result;
end $$;

revoke all on function public.dashboard_summary(date) from public,anon;
grant execute on function public.dashboard_summary(date) to authenticated;

commit;

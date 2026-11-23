begin;
set local lock_timeout='5s';

-- Make an unposted/absent cost source explicit. A source with permission and
-- no eligible rows contributes zero; incomplete issued costs or payroll
-- snapshots remain NULL and block the after-cost figure.
do $patch$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.dashboard_summary(date)'::regprocedure) into definition;

 old_fragment='expense_office numeric;expense_fixed numeric;expense_marketing numeric;expense_recovery numeric;expense_other numeric;depreciation numeric;';
 new_fragment=old_fragment||'cost_total numeric; revenue_after_costs numeric; costs_complete boolean; staff_estimate numeric; interest_paid numeric;';
 if strpos(definition,old_fragment)=0 then raise exception 'DASHBOARD_AFTER_COST_DECLARATION_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$select case when count(*)>0 and count(*)=count(l.unit_cost) then sum(abs(l.quantity)*l.unit_cost) end into food_cost
  from public.inventory_movements m join public.inventory_movement_lines l on l.movement_id=m.id
  where m.status='posted' and m.kind='issue' and m.moved_on=p_date and m.source_batch_id is not null;$old$;
 new_fragment=$new$select case
   when count(*)=0 and exists(select 1 from public.production_batches b join public.production_batch_lines l2 on l2.batch_id=b.id
     where b.status='posted' and b.produced_on=p_date and l2.main_quantity+l2.extra_quantity>0) then null
   when count(*)=0 then 0
   when count(*)=count(l.unit_cost) then sum(abs(l.quantity)*l.unit_cost)
  end into food_cost
  from public.inventory_movements m join public.inventory_movement_lines l on l.movement_id=m.id
  where m.status='posted' and m.kind='issue' and m.moved_on=p_date and m.source_batch_id is not null;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'DASHBOARD_AFTER_COST_FOOD_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$if private.can('expenses','view') then$old$;
 new_fragment=$new$if private.can('payroll','view') and private.can('attendance','view') then
  select case when count(*)=0 and coalesce(produced,0)=0 then 0
   when count(*)=0 then null
   when count(p.shift_id)=count(*) then sum(round(((extract(epoch from(s.ends_at-s.starts_at))/60-s.break_minutes)/60)*p.hourly_rate_vnd)+coalesce(a.allowance,0)) end
   into staff_estimate
  from public.attendance_shifts s left join public.attendance_pay_snapshots p on p.shift_id=s.id
  left join lateral(select sum(amount_vnd) filter(where kind in('daily','support')) allowance from public.attendance_allowances where shift_id=s.id) a on true
  where s.status='posted' and (s.starts_at at time zone 'Asia/Ho_Chi_Minh')::date=p_date;
 end if;
 if private.can('loans','view') then select coalesce(sum(interest_vnd),0) into interest_paid from public.loan_payments where active and paid_on=p_date;end if;
 if private.can('expenses','view') then$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'DASHBOARD_AFTER_COST_LABOR_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$select sum(amount_vnd) filter(where category='office'),sum(amount_vnd) filter(where category='fixed'),sum(amount_vnd) filter(where category='marketing'),
   sum(amount_vnd) filter(where category='recovery'),sum(amount_vnd) filter(where category='other')
   into expense_office,expense_fixed,expense_marketing,expense_recovery,expense_other from public.expenses where status='posted' and spent_on=p_date;$old$;
 new_fragment=$new$select coalesce(sum(amount_vnd) filter(where category='office'),0),coalesce(sum(amount_vnd) filter(where category='fixed'),0),coalesce(sum(amount_vnd) filter(where category='marketing'),0),
   coalesce(sum(amount_vnd) filter(where category='recovery'),0),coalesce(sum(amount_vnd) filter(where category='other'),0)
   into expense_office,expense_fixed,expense_marketing,expense_recovery,expense_other from public.expenses where status='posted' and spent_on=p_date;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'DASHBOARD_AFTER_COST_EXPENSE_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$if private.can('assets','view') then select sum(amount_vnd) into depreciation from public.depreciation_entries where period_start=p_date;end if;$old$;
 new_fragment=$new$if private.can('assets','view') then select coalesce(sum(amount_vnd),0) into depreciation from public.depreciation_entries where period_start=p_date;end if;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'DASHBOARD_AFTER_COST_DEPRECIATION_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$result=jsonb_build_object($old$;
 new_fragment=$new$costs_complete=food_cost is not null and staff_estimate is not null and interest_paid is not null and expense_office is not null
  and expense_fixed is not null and expense_marketing is not null and expense_recovery is not null
  and expense_other is not null and depreciation is not null;
 if costs_complete and revenue is not null then
  cost_total=food_cost+staff_estimate+interest_paid+expense_office+expense_fixed+expense_marketing+expense_recovery+expense_other+depreciation;
  revenue_after_costs=revenue-cost_total;
 end if;
 result=jsonb_build_object($new$;
 if strpos(definition,old_fragment)=0 then raise exception 'DASHBOARD_AFTER_COST_CALCULATION_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);

 old_fragment=$old$'depreciation_vnd',depreciation::text,$old$;
 new_fragment=$new$'depreciation_vnd',depreciation::text,'staff_cost_estimate_vnd',staff_estimate::text,'interest_paid_vnd',interest_paid::text,'costs_complete',costs_complete,
  'cost_total_vnd',cost_total::text,'revenue_after_costs_vnd',revenue_after_costs::text,$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'DASHBOARD_AFTER_COST_OUTPUT_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end
$patch$;

-- Return one exact, permission-aware aggregate for the entire selected period.
-- Sales with no posted source stay NULL; incomplete sale lines or any missing
-- cost source also keep the final after-cost figure NULL instead of partial.
create or replace function public.dashboard_period_summary(p_start date,p_end date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare days_json jsonb; output_json jsonb; unit_count integer; unit_label text; unit_consistent boolean;
 document_count integer; document_without_lines integer; line_count integer; priced_line_count integer;
 adjustment_count integer; sales_lines numeric; adjustments numeric; sales_revenue numeric;
 food numeric; labor numeric; staff numeric; interest numeric; office numeric; fixed numeric; marketing numeric; recovery numeric; other_cost numeric; depreciation numeric;
 all_costs_complete boolean; total_costs numeric; revenue_after_costs numeric;
begin
 if not private.can('dashboard','view') then raise exception 'FORBIDDEN';end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end)
    or p_end<p_start or p_end-p_start>365 then raise exception 'INVALID_DASHBOARD_PERIOD';end if;
 select coalesce(jsonb_agg(public.dashboard_summary(d::date) order by d),'[]'::jsonb)
  into days_json from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d;

 if private.can('sales','view') then
  select count(distinct d.id)::integer,
   count(distinct d.id) filter(where l.id is null)::integer,
   count(l.id)::integer,count(l.net_revenue_vnd)::integer,coalesce(sum(l.net_revenue_vnd),0)
   into document_count,document_without_lines,line_count,priced_line_count,sales_lines
  from public.sales_documents d left join public.sales_lines l on l.document_id=d.id
  where d.status='posted' and d.sold_on between p_start and p_end;
  select count(*)::integer,coalesce(sum(a.amount_vnd),0) into adjustment_count,adjustments
   from public.order_revenue_adjustments a where a.business_date between p_start and p_end;
  if (document_count>0 or adjustment_count>0) and document_without_lines=0 and line_count=priced_line_count then
   sales_revenue=sales_lines+adjustments;
  end if;
 end if;

 select sum((day->>'food_cost_vnd')::numeric),sum((day->>'production_labor_estimate_vnd')::numeric),sum((day->>'staff_cost_estimate_vnd')::numeric),sum((day->>'interest_paid_vnd')::numeric),
  sum((day->>'office_expense_vnd')::numeric),sum((day->>'fixed_expense_vnd')::numeric),
  sum((day->>'marketing_expense_vnd')::numeric),sum((day->>'recovery_expense_vnd')::numeric),
  sum((day->>'other_expense_vnd')::numeric),sum((day->>'depreciation_vnd')::numeric)
 into food,labor,staff,interest,office,fixed,marketing,recovery,other_cost,depreciation
 from jsonb_array_elements(days_json) as items(day);

 -- Check completeness independently; each boolean is read from its own daily field.
 select bool_and((day->>'food_cost_vnd') is not null)
  and bool_and((day->>'staff_cost_estimate_vnd') is not null)
  and bool_and((day->>'interest_paid_vnd') is not null)
  and bool_and((day->>'office_expense_vnd') is not null)
  and bool_and((day->>'fixed_expense_vnd') is not null)
  and bool_and((day->>'marketing_expense_vnd') is not null)
  and bool_and((day->>'recovery_expense_vnd') is not null)
  and bool_and((day->>'other_expense_vnd') is not null)
  and bool_and((day->>'depreciation_vnd') is not null)
 into all_costs_complete from jsonb_array_elements(days_json) as items(day);
 if all_costs_complete then
  total_costs=food+staff+interest+office+fixed+marketing+recovery+other_cost+depreciation;
  if sales_revenue is not null then revenue_after_costs=sales_revenue-total_costs;end if;
 end if;

 if private.can('production','view') then
  select count(distinct p.sale_unit),max(p.sale_unit) into unit_count,unit_label
  from public.production_batches b join public.production_batch_lines l on l.batch_id=b.id
  join public.products p on p.id=l.product_id
  where b.status='posted' and b.produced_on between p_start and p_end;
  unit_consistent=coalesce(unit_count,0)<=1;
 else unit_consistent=false;unit_label=null;
 end if;
 output_json=jsonb_build_object('start',p_start,'end',p_end,'days',days_json,
  'production_unit_consistent',unit_consistent,'production_unit',case when unit_consistent then unit_label end,
  'sales_revenue_vnd',sales_revenue::text,'costs_complete',coalesce(all_costs_complete,false),
  'costs',jsonb_build_object('food_vnd',case when all_costs_complete then food::text end,
   'production_labor_vnd',case when all_costs_complete then labor::text end,'staff_vnd',case when all_costs_complete then staff::text end,'interest_paid_vnd',case when all_costs_complete then interest::text end,
   'office_vnd',case when all_costs_complete then office::text end,'fixed_vnd',case when all_costs_complete then fixed::text end,
   'marketing_vnd',case when all_costs_complete then marketing::text end,'recovery_vnd',case when all_costs_complete then recovery::text end,
   'other_vnd',case when all_costs_complete then other_cost::text end,'depreciation_vnd',case when all_costs_complete then depreciation::text end),
  'cost_total_vnd',case when all_costs_complete then total_costs::text end,
  'revenue_after_costs_vnd',revenue_after_costs::text,'updated_at',now());
 return output_json;
end $$;

revoke all on function public.dashboard_summary(date),public.dashboard_period_summary(date,date) from public,anon;
grant execute on function public.dashboard_summary(date),public.dashboard_period_summary(date,date) to authenticated;
commit;

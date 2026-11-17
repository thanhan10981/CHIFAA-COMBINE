begin;
-- Monthly manual amounts are independent of hourly pay rates and shift defaults.
-- Legacy columns/snapshots remain for traceability; never migrate them into a month.
create table public.employee_monthly_allowances(
 id uuid primary key default gen_random_uuid(),revision bigint generated always as identity unique,
 employee_id uuid not null references public.employees(id),month date not null check(isfinite(month) and month=date_trunc('month',month)::date),
 amount_vnd bigint not null check(amount_vnd>=0),note text not null check(length(trim(note)) between 5 and 2000),previous_id uuid references public.employee_monthly_allowances(id),
 version bigint not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),updated_by uuid references auth.users(id)
);
create index monthly_allowance_employee_month on public.employee_monthly_allowances(employee_id,month,revision desc);
alter table public.employee_monthly_allowances enable row level security;
create policy monthly_allowance_read on public.employee_monthly_allowances for select to authenticated using((select private.can('payroll','view')) and(select private.can('employees','view')));
grant select on public.employee_monthly_allowances to authenticated;
insert into private.table_modules values('employee_monthly_allowances','payroll');
create trigger monthly_allowance_audit before insert or update or delete on public.employee_monthly_allowances for each row execute function private.record_change('payroll');
create trigger monthly_allowance_immutable before update or delete on public.employee_monthly_allowances for each row execute function private.commercial_immutable();

create function public.monthly_allowances(p_employee uuid,p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$declare rows jsonb;begin
 if not private.can('payroll','view') or not private.can('employees','view') then raise exception 'FORBIDDEN';end if;
 if p_month is null or not isfinite(p_month) or p_month<>date_trunc('month',p_month)::date then raise exception 'INVALID_MONTH';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'revision',a.revision::text,'amount_vnd',a.amount_vnd::text,'month',a.month,'note',a.note,'created_at',a.created_at,'previous_id',a.previous_id) order by a.revision desc),'[]') into rows from(select * from public.employee_monthly_allowances where employee_id=p_employee and month=p_month order by revision desc limit 100) a;
 return jsonb_build_object('current',rows->0,'history',rows);end $$;

create function public.save_monthly_allowance(p_employee uuid,p_month date,p_expected_id uuid,p_amount text,p_note text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb;previous uuid;result uuid;month_end date;
begin
 if not private.can('payroll','create') or not private.can('payroll','approve') or not private.can('employees','view') then raise exception 'FORBIDDEN';end if;
 if p_month is null or not isfinite(p_month) or p_month<>date_trunc('month',p_month)::date then raise exception 'INVALID_MONTH';end if;
 if p_amount is null or p_amount!~'^[0-9]{1,15}$' or length(trim(coalesce(p_note,''))) not between 5 and 2000 then raise exception 'INVALID_ALLOWANCE';end if;
 cached=private.begin_request(p_key,'monthly-allowance',jsonb_build_object('employee',p_employee,'month',p_month,'previous',p_expected_id,'amount',p_amount,'note',p_note));if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(hashtextextended('monthly-allowance:'||p_employee::text||':'||p_month::text,0));
 if not exists(select 1 from public.employees where id=p_employee) then raise exception 'EMPLOYEE_NOT_FOUND';end if;
 month_end=(p_month+interval '1 month -1 day')::date;
 if exists(select 1 from public.payroll_periods where status='posted' and starts_on<=month_end and ends_on>=p_month) then raise exception 'PAYROLL_MONTH_POSTED';end if;
 if exists(select 1 from public.accounting_periods where status='closed' and starts_on<=month_end and ends_on>=p_month) then raise exception 'PERIOD_CLOSED';end if;
 select id into previous from public.employee_monthly_allowances where employee_id=p_employee and month=p_month order by revision desc limit 1;
 if previous is distinct from p_expected_id then raise exception 'VERSION_CONFLICT';end if;
 insert into public.employee_monthly_allowances(employee_id,month,amount_vnd,note,previous_id) values(p_employee,p_month,p_amount::bigint,trim(p_note),previous) returning id into result;
 return private.finish_request(p_key,jsonb_build_object('id',result,'amount_vnd',p_amount,'month',p_month));
end $$;

alter function public.commercial_catalog(text,date,text,text,integer,integer) set schema private;
revoke all on function private.commercial_catalog(text,date,text,text,integer,integer) from public,authenticated;
create function public.commercial_catalog(p_kind text,p_date date,p_search text,p_status text,p_offset integer,p_limit integer) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;rows jsonb;begin
 result=private.commercial_catalog(p_kind,p_date,p_search,p_status,p_offset,p_limit);
 if p_kind='employees' then
  select coalesce(jsonb_agg((value-'daily_allowance_vnd')||jsonb_build_object('monthly_allowance_vnd',case when private.can('payroll','view') then(select a.amount_vnd::text from public.employee_monthly_allowances a where a.employee_id=(value->>'id')::uuid and a.month=date_trunc('month',p_date)::date order by a.revision desc limit 1) else null end) order by position),'[]') into rows from jsonb_array_elements(result->'rows') with ordinality as source(value,position);
  result=jsonb_set(result,'{rows}',rows);
 end if;return result;end $$;
alter function public.commercial_history(text,uuid) set schema private;
revoke all on function private.commercial_history(text,uuid) from public,authenticated;
create function public.commercial_history(p_kind text,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 result=private.commercial_history(p_kind,p_id);
 if p_kind='pay' then select coalesce(jsonb_agg(value-'daily_allowance_vnd'-'allowance_confirmed' order by position),'[]') into result from jsonb_array_elements(result) with ordinality as source(value,position);end if;
 return result;end $$;
revoke all on function public.monthly_allowances(uuid,date),public.save_monthly_allowance(uuid,date,uuid,text,text,uuid),public.commercial_catalog(text,date,text,text,integer,integer),public.commercial_history(text,uuid) from public;
grant execute on function public.monthly_allowances(uuid,date),public.save_monthly_allowance(uuid,date,uuid,text,text,uuid),public.commercial_catalog(text,date,text,text,integer,integer),public.commercial_history(text,uuid) to authenticated;
-- Function replacements follow below. Keep old immutable wage/shift records intact.
create or replace function public.save_commercial_terms(p_kind text,p_id uuid,p_expected_version bigint,p_input jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare module text;tab text;cached jsonb;ver bigint;result uuid;day date;item jsonb;rate numeric;amount bigint;parent uuid;
begin
 module=case p_kind when 'pay' then 'payroll' when 'price' then 'prices' when 'store_price' then 'prices' when 'discount' then 'prices' when 'recipe' then 'recipes' end;
 tab=case p_kind when 'pay' then 'employees' when 'price' then 'products' when 'store_price' then 'stores' when 'discount' then 'stores' when 'recipe' then 'products' end;
 if module is null or not private.can(module,'create') or not private.can(module,'approve') or not private.can(tab,'view') then raise exception 'FORBIDDEN';end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or length(trim(coalesce(p_input->>'evidence','')))<5 or length(p_input->>'evidence')>2000 or exists(select 1 from jsonb_object_keys(p_input) k where k<>all(array['date','evidence','amount','product_id','common_rate','enabled','note','items','recipe_version_id','quantity'])) then raise exception 'INVALID_FIELDS';end if;
 day=coalesce(nullif(p_input->>'date','')::date,'0001-01-01');if day<'0001-01-01'::date then raise exception 'INVALID_DATE';end if;
 if p_kind<>'discount' and nullif(p_input->>'date','') is null then raise exception 'DATE_REQUIRED';end if;
 cached=private.begin_request(p_key,'commercial-terms:'||p_kind,jsonb_build_object('id',p_id,'version',p_expected_version,'input',p_input));if cached is not null then return cached;end if;
 perform pg_advisory_xact_lock(170025);
 execute format('select version from public.%I where id=$1 for update',tab) into ver using p_id;
 if ver is null or p_expected_version is null or ver<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;
 if p_kind in ('price','store_price','pay') then
  if coalesce(p_input->>'amount','')!~'^[0-9]{1,15}$' then raise exception 'INVALID_MONEY';end if;amount=(p_input->>'amount')::bigint;
 end if;
 if p_kind='price' then insert into public.product_prices(product_id,price_vnd,effective_from,evidence) values(p_id,amount,day,p_input->>'evidence') returning id into result;
 elsif p_kind='store_price' then
  if not private.can('products','view') then raise exception 'FORBIDDEN';end if;
  insert into public.store_product_prices(store_id,product_id,price_vnd,effective_from) values(p_id,(p_input->>'product_id')::uuid,amount,day) returning id into result;
 elsif p_kind='pay' then

  insert into public.employee_pay_rates(employee_id,hourly_vnd,daily_allowance_vnd,allowance_confirmed,effective_from) values(p_id,amount,0,false,day) returning id into result;
 elsif p_kind='recipe' then
  if not exists(select 1 from public.recipe_versions where id=(p_input->>'recipe_version_id')::uuid and status='published' and effective_from<=day) then raise exception 'PUBLISHED_RECIPE_REQUIRED';end if;
  if coalesce(p_input->>'quantity','')!~'^[0-9]+(\.[0-9]{1,6})?$' then raise exception 'INVALID_QUANTITY';end if;
  insert into public.product_recipe_links(product_id,recipe_version_id,output_quantity_per_product,effective_from) values(p_id,(p_input->>'recipe_version_id')::uuid,(p_input->>'quantity')::numeric,day) returning id into result;
 else
  if not private.can('products','view') then raise exception 'FORBIDDEN';end if;
  if coalesce(p_input->>'common_rate','')!~'^[0-9]+(\.[0-9]{1,6})?$' then raise exception 'INVALID_RATE';end if;rate=(p_input->>'common_rate')::numeric;
  if jsonb_typeof(p_input->'items') is distinct from 'array' or jsonb_array_length(p_input->'items')>1000 then raise exception 'INVALID_ITEMS';end if;
  if exists(select 1 from jsonb_array_elements(p_input->'items') i where not exists(select 1 from public.products where id=(i->>'product_id')::uuid and not archived)) or (select count(distinct i->>'product_id') from jsonb_array_elements(p_input->'items') i)<>(select count(*) from public.products where not archived) or jsonb_array_length(p_input->'items')<>(select count(*) from public.products where not archived) then raise exception 'PRODUCT_LIST_CHANGED';end if;
  insert into public.store_discount_policies(store_id,effective_from,common_rate,enabled,note,evidence) values(p_id,day,rate,coalesce((p_input->>'enabled')::boolean,true),coalesce(p_input->>'note',''),p_input->>'evidence') returning id into result;
  for item in select * from jsonb_array_elements(p_input->'items') loop
   if jsonb_typeof(item->'eligible') is distinct from 'boolean' then raise exception 'INVALID_ITEMS';end if;
   insert into public.store_discount_policy_items(policy_id,product_id,eligible,override_rate) values(result,(item->>'product_id')::uuid,(item->>'eligible')::boolean,nullif(item->>'override_rate','')::numeric);
  end loop;
 end if;
 insert into private.catalog_sources(entity,entity_id,source_hash,source_data) values('terms:'||p_kind,result,p_key::text,p_input);
 execute format('update public.%I set updated_at=now() where id=$1 returning version',tab) into ver using p_id;
 return private.finish_request(p_key,jsonb_build_object('id',result,'version',ver::text));
end $$;


create or replace function public.post_attendance(p_employee uuid,p_start timestamptz,p_end timestamptz,p_break integer,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cached jsonb; employee public.employees; pay public.employee_pay_rates; shift_id uuid; department text; business_date date;
begin
 if not private.can('attendance','approve') then raise exception 'FORBIDDEN';end if;
 cached=private.begin_request(p_key,'attendance:post',jsonb_build_object('employee',p_employee,'start',p_start,'end',p_end,'break',p_break));if cached is not null then return cached;end if;
 business_date=(p_start at time zone 'Asia/Ho_Chi_Minh')::date;perform private.assert_open(business_date);
 perform pg_advisory_xact_lock(hashtextextended(p_employee::text,0));
 select * into strict employee from public.employees where id=p_employee and active;
 select code into department from public.departments where id=employee.department_id;
 if exists(select 1 from public.attendance_shifts s where s.employee_id=p_employee and s.status='posted' and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(p_start,p_end,'[)')) then raise exception 'SHIFT_OVERLAP';end if;
 select * into pay from public.employee_pay_rates where employee_id=p_employee and effective_from<=business_date and(effective_to is null or effective_to>=business_date) order by effective_from desc limit 1;
 if pay.id is null then raise exception 'PAY_RATE_MISSING';end if;
 insert into public.attendance_shifts(employee_id,starts_at,ends_at,break_minutes,department_snapshot,status) values(p_employee,p_start,p_end,p_break,department,'posted') returning id into shift_id;
 insert into public.attendance_pay_snapshots(shift_id,hourly_rate_vnd,default_daily_allowance_vnd) values(shift_id,pay.hourly_vnd,0);
 return private.finish_request(p_key,jsonb_build_object('shift_id',shift_id,'hours',((extract(epoch from(p_end-p_start))/60-p_break)/60)::text,'status','posted'));
end $$;

commit;

begin;

-- A wage is effective for one employee and one department. Existing rates are
-- assigned to the employee's current home department; their shift snapshots
-- remain unchanged.
alter table public.employee_pay_rates add column department_id uuid references public.departments(id);
update public.employee_pay_rates r set department_id=e.department_id from public.employees e where e.id=r.employee_id;
alter table public.employee_pay_rates drop constraint if exists employee_pay_rates_employee_id_effective_from_key;
create unique index employee_pay_rates_employee_department_effective_key on public.employee_pay_rates(employee_id,department_id,effective_from) where department_id is not null;
create unique index employee_pay_rates_employee_general_effective_key on public.employee_pay_rates(employee_id,effective_from) where department_id is null;

create or replace function private.default_employee_pay_rate_department() returns trigger language plpgsql set search_path='' as $$
begin
 if new.department_id is null then select department_id into new.department_id from public.employees where id=new.employee_id;end if;
 return new;
end $$;
create trigger employee_pay_rate_department_default before insert on public.employee_pay_rates for each row execute function private.default_employee_pay_rate_department();

-- Preserve the employee's home department at shift time so later profile edits
-- cannot rewrite whether that shift was a temporary position change.
alter table public.attendance_shifts add column home_department_snapshot text check(home_department_snapshot is null or home_department_snapshot in ('SX','VP','BH'));
-- Store the pay for the employee's home role too, so payroll can compare the
-- temporary role rate against the role the employee normally works.
alter table public.attendance_pay_snapshots add column home_hourly_rate_vnd bigint check(home_hourly_rate_vnd is null or home_hourly_rate_vnd>=0);

do $upgrade$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('private.commercial_catalog(text,date,text,text,integer,integer)'::regprocedure) into definition;
 old_fragment='where x.employee_id=e.id and x.effective_from<=p_date and(x.effective_to is null or x.effective_to>=p_date) order by x.effective_from desc limit 1) pay';
 new_fragment='where x.employee_id=e.id and x.department_id is not distinct from e.department_id and x.effective_from<=p_date and(x.effective_to is null or x.effective_to>=p_date) order by x.effective_from desc limit 1) pay';
 if strpos(definition,old_fragment)=0 then raise exception 'DEPARTMENT_PAY_CATALOG_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);

 select pg_get_functiondef('private.commercial_history(text,uuid)'::regprocedure) into definition;
 old_fragment=$old$select jsonb_agg(to_jsonb(x)||jsonb_build_object('hourly_vnd',x.hourly_vnd::text,'daily_allowance_vnd',case when x.allowance_confirmed then x.daily_allowance_vnd::text else null end)) into result from(select * from public.employee_pay_rates where employee_id=p_id order by effective_from desc limit 100) x;$old$;
 new_fragment=$new$select jsonb_agg(to_jsonb(x)||jsonb_build_object('hourly_vnd',x.hourly_vnd::text,'daily_allowance_vnd',case when x.allowance_confirmed then x.daily_allowance_vnd::text else null end,'department_code',d.code,'department_name',d.name)) into result from(select * from public.employee_pay_rates where employee_id=p_id order by effective_from desc,department_id limit 100) x left join public.departments d on d.id=x.department_id;$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'DEPARTMENT_PAY_HISTORY_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);

 select pg_get_functiondef('public.save_commercial_terms(text,uuid,bigint,jsonb,uuid)'::regprocedure) into definition;
 old_fragment='array[''date'',''evidence'',''amount'',''product_id'',''common_rate'',''enabled'',''note'',''items'',''recipe_version_id'',''quantity'']';
 new_fragment='array[''date'',''evidence'',''amount'',''department_id'',''product_id'',''common_rate'',''enabled'',''note'',''items'',''recipe_version_id'',''quantity'']';
 if strpos(definition,old_fragment)=0 then raise exception 'DEPARTMENT_PAY_INPUT_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment='insert into public.employee_pay_rates(employee_id,hourly_vnd,daily_allowance_vnd,allowance_confirmed,effective_from) values(p_id,amount,0,false,day) returning id into result;';
 new_fragment='insert into public.employee_pay_rates(employee_id,department_id,hourly_vnd,daily_allowance_vnd,allowance_confirmed,effective_from) values(p_id,nullif(p_input->>''department_id'','''')::uuid,amount,0,false,day) returning id into result;';
 if strpos(definition,old_fragment)=0 then raise exception 'DEPARTMENT_PAY_SAVE_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);

 select pg_get_functiondef('private.submit_entry(text,date,jsonb,uuid,uuid)'::regprocedure) into definition;
 old_fragment='department text;pay public.employee_pay_rates;';
 new_fragment='department text;home_department text;selected_department_id uuid;home_rate bigint;pay public.employee_pay_rates;';
 if strpos(definition,old_fragment)=0 then raise exception 'ATTENDANCE_DEPARTMENT_DECLARATION_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment='select coalesce(nullif(p_input->>''department'',''''),d.code) into department from public.employees e left join public.departments d on d.id=e.department_id where e.id=(p_input->>''employee_id'')::uuid and e.active;';
 new_fragment='select d.code into home_department from public.employees e left join public.departments d on d.id=e.department_id where e.id=(p_input->>''employee_id'')::uuid and e.active; if not found then raise exception ''DEPARTMENT_REQUIRED'';end if; department=coalesce(nullif(p_input->>''department'',''''),home_department);select d.id into selected_department_id from public.departments d where d.code=department;if selected_department_id is null then raise exception ''DEPARTMENT_REQUIRED'';end if;';
 if strpos(definition,old_fragment)=0 then raise exception 'ATTENDANCE_HOME_DEPARTMENT_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment='select * into pay from public.employee_pay_rates where employee_id=(p_input->>''employee_id'')::uuid and effective_from<=p_date and(effective_to is null or effective_to>=p_date) order by effective_from desc limit 1;';
 new_fragment='select * into pay from public.employee_pay_rates where employee_id=(p_input->>''employee_id'')::uuid and department_id=selected_department_id and effective_from<=p_date and(effective_to is null or effective_to>=p_date) order by effective_from desc limit 1;';
 if strpos(definition,old_fragment)=0 then raise exception 'ATTENDANCE_DEPARTMENT_RATE_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment='if pay.id is null then raise exception ''PAY_RATE_MISSING'';end if;';
 new_fragment='if pay.id is null then raise exception ''PAY_RATE_MISSING_FOR_DEPARTMENT'';end if;';
 if strpos(definition,old_fragment)=0 then raise exception 'ATTENDANCE_DEPARTMENT_RATE_ERROR_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment='insert into public.attendance_shifts(employee_id,starts_at,ends_at,break_minutes,department_snapshot,status) values((p_input->>''employee_id'')::uuid,(p_input->>''starts_at'')::timestamptz,(p_input->>''ends_at'')::timestamptz,(p_input->>''break_minutes'')::integer,department,''posted'') returning public.attendance_shifts.id into id;';
 new_fragment='insert into public.attendance_shifts(employee_id,starts_at,ends_at,break_minutes,department_snapshot,home_department_snapshot,status) values((p_input->>''employee_id'')::uuid,(p_input->>''starts_at'')::timestamptz,(p_input->>''ends_at'')::timestamptz,(p_input->>''break_minutes'')::integer,department,home_department,''posted'') returning public.attendance_shifts.id into id;';
 if strpos(definition,old_fragment)=0 then raise exception 'ATTENDANCE_DEPARTMENT_SNAPSHOT_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 old_fragment='insert into public.attendance_pay_snapshots(shift_id,hourly_rate_vnd,default_daily_allowance_vnd) values(id,pay.hourly_vnd,0);';
 new_fragment='home_rate=null;if home_department=department then home_rate=pay.hourly_vnd;elsif home_department is not null then select r.hourly_vnd into home_rate from public.employee_pay_rates r join public.departments d on d.id=r.department_id where r.employee_id=(p_input->>''employee_id'')::uuid and d.code=home_department and r.effective_from<=p_date and(r.effective_to is null or r.effective_to>=p_date) order by r.effective_from desc limit 1;end if;insert into public.attendance_pay_snapshots(shift_id,hourly_rate_vnd,home_hourly_rate_vnd,default_daily_allowance_vnd) values(id,pay.hourly_vnd,home_rate,0);';
 if strpos(definition,old_fragment)=0 then raise exception 'ATTENDANCE_HOME_PAY_SNAPSHOT_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);

 select pg_get_functiondef('private.post_attendance(uuid,timestamptz,timestamptz,integer,uuid)'::regprocedure) into definition;
 old_fragment='select code into department from public.departments where id=employee.department_id;';
 new_fragment=old_fragment||' if department is null then raise exception ''DEPARTMENT_REQUIRED'';end if;';
 if strpos(definition,old_fragment)=0 then raise exception 'POST_ATTENDANCE_DEPARTMENT_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 definition=regexp_replace(definition,'where\s+(?:(?:public\.)?employee_pay_rates\.)?employee_id\s*=\s*p_employee\s+and\s+(?:(?:public\.)?employee_pay_rates\.)?effective_from\s*<=\s*business_date','where employee_id=p_employee and department_id=employee.department_id and effective_from<=business_date');
 if definition not like '%department_id=employee.department_id%' then raise exception 'POST_ATTENDANCE_RATE_PATCH_MISMATCH';end if;
 old_fragment='insert into public.attendance_pay_snapshots(shift_id,hourly_rate_vnd,default_daily_allowance_vnd) values(shift_id,pay.hourly_vnd,0);';
 new_fragment='insert into public.attendance_pay_snapshots(shift_id,hourly_rate_vnd,home_hourly_rate_vnd,default_daily_allowance_vnd) values(shift_id,pay.hourly_vnd,pay.hourly_vnd,0);';
 if strpos(definition,old_fragment)=0 then raise exception 'POST_ATTENDANCE_HOME_PAY_SNAPSHOT_PATCH_MISMATCH';end if;
 definition=replace(definition,old_fragment,new_fragment);
 execute definition;
end $upgrade$;

create or replace function private.entry_payroll(p_month date) returns jsonb language sql stable security definer set search_path='' as $$
 with by_rate as(
  select s.employee_id,s.department_snapshot department,p.hourly_rate_vnd,
   sum((extract(epoch from(s.ends_at-s.starts_at))/60-s.break_minutes)/60) hours,
   sum(round((extract(epoch from(s.ends_at-s.starts_at))/60-s.break_minutes)/60*p.hourly_rate_vnd)) base,
   sum(coalesce(a.allowance,0)) allowance,sum(coalesce(a.advance,0)) advance,sum(coalesce(a.deduction,0)) deduction,
   bool_or(s.department_snapshot is distinct from coalesce(s.home_department_snapshot,s.department_snapshot)) role_changed
  from public.attendance_shifts s join public.attendance_pay_snapshots p on p.shift_id=s.id
  left join lateral(select sum(amount_vnd) filter(where kind in('daily','support')) allowance,sum(amount_vnd) filter(where kind='advance') advance,sum(amount_vnd) filter(where kind='deduction') deduction from public.attendance_allowances where shift_id=s.id) a on true
  where s.status='posted' and (s.starts_at at time zone 'Asia/Ho_Chi_Minh')::date>=p_month and (s.starts_at at time zone 'Asia/Ho_Chi_Minh')::date<(p_month+interval '1 month')
  group by s.employee_id,s.department_snapshot,p.hourly_rate_vnd
 ),shifts as(
  select employee_id,department,sum(hours) hours,sum(base) base,
   jsonb_agg(jsonb_build_object('hourly_vnd',hourly_rate_vnd::text,'hours',hours::text) order by hourly_rate_vnd) rate_details,
   bool_or(role_changed) role_changed,sum(allowance) allowance,sum(advance) advance,sum(deduction) deduction
  from by_rate group by employee_id,department
 ),monthly as(
  select distinct on(employee_id) employee_id,amount_vnd from public.employee_monthly_allowances where month=p_month order by employee_id,revision desc
 ),numbered as(
  select *,row_number() over(partition by employee_id order by department) n from shifts
 ),rows as(
  select s.employee_id,e.code,e.name,s.department,s.role_changed,s.rate_details,s.hours::text,s.base::text base_vnd,
   (s.allowance+case when s.n=1 then coalesce(m.amount_vnd,0) else 0 end)::text allowance_vnd,
   s.advance::text advance_vnd,s.deduction::text deduction_vnd,
   (s.base+s.allowance+case when s.n=1 then coalesce(m.amount_vnd,0) else 0 end-s.advance-s.deduction)::text payable_vnd
  from numbered s join public.employees e on e.id=s.employee_id left join monthly m on m.employee_id=s.employee_id
 ) select coalesce(jsonb_agg(to_jsonb(rows) order by department,code),'[]') from rows
$$;

do $upgrade$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('public.entry_workspace(text,date)'::regprocedure) into definition;
 old_fragment=$old$'department',s.department_snapshot,'journal_id',j.id,'input',j.input)),'[]') from public.attendance_shifts s left join public.entry_journal j on j.action='attendance' and j.result->>'id'=s.id::text$old$;
 new_fragment=$new$'department',s.department_snapshot,'home_department',coalesce(s.home_department_snapshot,s.department_snapshot),'role_changed',s.department_snapshot is distinct from coalesce(s.home_department_snapshot,s.department_snapshot),'hourly_vnd',p.hourly_rate_vnd::text,'home_hourly_vnd',p.home_hourly_rate_vnd::text,'journal_id',j.id,'input',j.input)),'[]') from public.attendance_shifts s join public.attendance_pay_snapshots p on p.shift_id=s.id left join public.entry_journal j on j.action='attendance' and j.result->>'id'=s.id::text$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'PAYROLL_SHIFT_DETAIL_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end $upgrade$;

revoke all on function private.default_employee_pay_rate_department() from public,anon,authenticated;
commit;

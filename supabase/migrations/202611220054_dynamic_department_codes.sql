begin;

-- Department codes are user-managed shared catalog values. Existing fixed
-- codes remain valid; new codes can be referenced by employees, pay rates and
-- attendance snapshots through the same department rows.
alter table public.departments drop constraint if exists departments_code_check;
alter table public.departments add constraint departments_code_check check(code ~ '^[A-Z0-9][A-Z0-9_-]{0,19}$');

alter table public.attendance_shifts drop constraint if exists attendance_shifts_department_snapshot_check;
alter table public.attendance_shifts add constraint attendance_shifts_department_snapshot_check check(department_snapshot ~ '^[A-Z0-9][A-Z0-9_-]{0,19}$');
alter table public.attendance_shifts drop constraint if exists attendance_shifts_home_department_snapshot_check;
alter table public.attendance_shifts add constraint attendance_shifts_home_department_snapshot_check check(home_department_snapshot is null or home_department_snapshot ~ '^[A-Z0-9][A-Z0-9_-]{0,19}$');

do $upgrade$
declare definition text; old_fragment text; new_fragment text;
begin
 select pg_get_functiondef('private.commercial_catalog(text,date,text,text,integer,integer)'::regprocedure) into definition;
 old_fragment='select e.*,d.name department_name,pay.hourly_vnd::text';
 new_fragment='select e.*,d.code department_code,d.name department_name,pay.hourly_vnd::text';
 if strpos(definition,old_fragment)=0 then raise exception 'DYNAMIC_DEPARTMENT_EMPLOYEE_CATALOG_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);

 select pg_get_functiondef('private.submit_entry(text,date,jsonb,uuid,uuid)'::regprocedure) into definition;
 old_fragment='if department is null or department not in(''SX'',''VP'',''BH'') then raise exception ''DEPARTMENT_REQUIRED'';end if;';
 new_fragment='if department is null then raise exception ''DEPARTMENT_REQUIRED'';end if;';
 if strpos(definition,old_fragment)=0 then raise exception 'DYNAMIC_DEPARTMENT_ATTENDANCE_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);

 select pg_get_functiondef('private.entry_payroll(date)'::regprocedure) into definition;
 old_fragment='select s.employee_id,e.code,e.name,s.department,s.role_changed,s.rate_details,';
 new_fragment='select s.employee_id,e.code,e.name,s.department,(select d.name from public.departments d where d.code=s.department) department_name,s.role_changed,s.rate_details,';
 if strpos(definition,old_fragment)=0 then raise exception 'DYNAMIC_DEPARTMENT_PAYROLL_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);

 select pg_get_functiondef('public.entry_workspace(text,date)'::regprocedure) into definition;
 old_fragment=$old$'department',s.department_snapshot,'home_department',coalesce(s.home_department_snapshot,s.department_snapshot),'role_changed',$old$;
 new_fragment=$new$'department',s.department_snapshot,'department_name',(select d.name from public.departments d where d.code=s.department_snapshot),'home_department',coalesce(s.home_department_snapshot,s.department_snapshot),'home_department_name',(select d.name from public.departments d where d.code=coalesce(s.home_department_snapshot,s.department_snapshot)),'role_changed',$new$;
 if strpos(definition,old_fragment)=0 then raise exception 'DYNAMIC_DEPARTMENT_SHIFT_DETAIL_PATCH_MISMATCH';end if;
 execute replace(definition,old_fragment,new_fragment);
end $upgrade$;

commit;

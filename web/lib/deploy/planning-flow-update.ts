export function buildPlanningFlowUpdate(migration:string){
 const sql=migration.trim();if(!/^begin;/i.test(sql)||!/commit;$/i.test(sql))throw new Error('Transaction-wrapped migration031 required');
 return `-- CHIFAA DEV031: AFTER030. Run the ENTIRE file as postgres. Read-only planning preview; no business data import.
do $patch031$ begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 perform pg_advisory_xact_lock(170031);
 if to_regprocedure('public.inventory_workspace(uuid,date,date,text,text,text,integer)') is null then raise exception 'PATCH_030_REQUIRED';end if;
 if to_regprocedure('public.production_plan_requirements(uuid,date,uuid,text,jsonb)') is not null then raise exception 'PATCH_031_ALREADY_PRESENT';end if;
 execute $migration031$${sql.replace(/^begin;/i,'').replace(/commit;$/i,'')}$migration031$;
end $patch031$;
notify pgrst, 'reload schema';
select case when to_regprocedure('public.production_plan_requirements(uuid,date,uuid,text,jsonb)') is not null then '031_READY' else '031_MISSING' end as status_031;
`;
}

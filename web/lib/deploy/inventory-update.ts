export function buildInventoryUpdate(migration:string){
 const sql=migration.trim();if(!/^begin;/i.test(sql)||!/commit;$/i.test(sql))throw new Error('Transaction-wrapped migration030 required');
 return `-- CHIFAA DEV030: run AFTER029. Execute the entire file as postgres.
-- Adds inventory readers. No business data is created or imported.
do $patch030$ begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 perform pg_advisory_xact_lock(170030);
 if to_regclass('public.production_day_adjustments') is null then raise exception 'PATCH_029_REQUIRED';end if;
 if to_regprocedure('public.inventory_workspace(uuid,date,date,text,text,text,integer)') is not null then raise exception 'PATCH_030_ALREADY_PRESENT';end if;
 execute $migration030$${sql.replace(/^begin;/i,'').replace(/commit;$/i,'')}$migration030$;
end $patch030$;
notify pgrst, 'reload schema';
select case when to_regprocedure('public.inventory_workspace(uuid,date,date,text,text,text,integer)') is not null then '030_READY' else '030_MISSING' end as status_030;
`;
}

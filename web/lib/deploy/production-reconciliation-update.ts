export function buildProductionReconciliationUpdate(migration:string){
 const sql=migration.trim();
 if(!/^begin;/i.test(sql)||!/commit;$/i.test(sql))throw new Error('Transaction-wrapped migration029 required');
 return `-- CHIFAA DEV029: run AFTER028. Execute this whole DO once as postgres.
-- Keeps all prior history. Does not rewrite sales, payments or approved reports.
do $patch029$ begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 perform pg_advisory_xact_lock(170029);
 if to_regclass('public.production_plan_revisions') is null then raise exception 'PATCH_028_REQUIRED';end if;
 if to_regclass('public.production_day_adjustments') is not null then raise exception 'PATCH_029_ALREADY_PRESENT';end if;
 execute $migration029$${sql.replace(/^begin;/i,'').replace(/commit;$/i,'')}$migration029$;
end $patch029$;
`;
}

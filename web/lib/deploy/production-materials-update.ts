export function buildProductionMaterialsUpdate(migration:string){
 const sql=migration.trim();
 if(!/^begin;/i.test(sql)||!/commit;$/i.test(sql))throw new Error('Transaction-wrapped migration028 required');
 return `-- CHIFAA DEV 028: production planning and material usage. Run AFTER027.
-- Execute the whole DO once as postgres in DEV. No business data import.
do $patch028$ begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 perform pg_advisory_xact_lock(170028);
 if to_regclass('public.recipe_unresolved_items') is null then raise exception 'PATCH_027_REQUIRED';end if;
 if to_regclass('public.production_plan_revisions') is not null then raise exception 'PATCH_028_ALREADY_PRESENT';end if;
 execute $migration028$${sql.replace(/^begin;/i,'').replace(/commit;$/i,'')}$migration028$;
end $patch028$;
`;
}

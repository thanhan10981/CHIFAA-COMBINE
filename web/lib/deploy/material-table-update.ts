export function buildMaterialTableUpdate(migration:string){
 const sql=migration.trim();
 if(!/^begin;/i.test(sql)||!/commit;$/i.test(sql))throw new Error('Transaction migration required');
 return `-- CHIFAA DEV034 after033. Owner SQL Editor: run the entire file.
-- Adds one atomic catalog edit RPC; no business data import or history rewrite.
do $patch034$ begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 perform pg_advisory_xact_lock(170034);
 if to_regclass('public.entry_changes') is null then raise exception 'PATCH_033_REQUIRED';end if;
 if to_regprocedure('public.save_material_table(uuid,bigint,jsonb,uuid)') is not null then raise exception 'PATCH_034_ALREADY_PRESENT';end if;
 execute $migration034$${sql.replace(/^begin;/i,'').replace(/commit;$/i,'')}$migration034$;
end $patch034$;
notify pgrst,'reload schema';
select '034_READY' as status;
`;
}

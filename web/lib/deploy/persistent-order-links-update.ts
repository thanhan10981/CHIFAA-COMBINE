export function buildPersistentOrderLinksUpdate(migration:string){
 const sql=migration.trim();
 if(!/^begin;/i.test(sql)||!/commit;$/i.test(sql))throw new Error('Transaction migration required');
 return `-- CHIFAA 091: persistent store links. Run as owner on the intended project.
begin;
do $patch091$ begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 perform pg_advisory_xact_lock(170091);
 if to_regprocedure('public.public_order_links_v2()') is not null then return;end if;
 if to_regprocedure('public.create_public_order_link(uuid,uuid)') is null then raise exception 'PATCH_036_REQUIRED';end if;
 execute $migration091$${sql.replace(/^begin;/i,'').replace(/commit;$/i,'')}$migration091$;
end $patch091$;
notify pgrst,'reload schema';
commit;
select to_regprocedure('public.public_order_links_v2()') is not null as persistent_store_links_ready;
`;
}

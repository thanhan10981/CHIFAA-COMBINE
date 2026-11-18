export function buildPublicOrderLinksUpdate(migration:string){
 const sql=migration.trim();if(!/^begin;/i.test(sql)||!/commit;$/i.test(sql))throw new Error('Transaction migration required');
 return `-- CHIFAA DEV036 after035. Run the entire file as owner in DEV SQL Editor.
do $patch036$ begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 perform pg_advisory_xact_lock(170036);
 if to_regprocedure('public.create_public_order_link(uuid,uuid)') is not null then raise exception 'PATCH_036_ALREADY_PRESENT';end if;
 if to_regprocedure('public.submit_public_order(date,text,jsonb,jsonb,text,uuid)') is null then raise exception 'PATCH_035_REQUIRED';end if;
 execute $migration036$${sql.replace(/^begin;/i,'').replace(/commit;$/i,'')}$migration036$;
end $patch036$;
notify pgrst,'reload schema';
select '036_READY' as status;
`;
}

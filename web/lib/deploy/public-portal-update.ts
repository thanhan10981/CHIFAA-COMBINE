export function buildPublicPortalUpdate(migration:string){
 const sql=migration.trim();if(!/^begin;/i.test(sql)||!/commit;$/i.test(sql))throw new Error('Transaction migration required');
 return `-- CHIFAA DEV035 after034. Run the entire file as owner in DEV SQL Editor.
-- Public catalog and submit RPCs only; no anonymous table/order/contact reads.
do $patch035$ begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 perform pg_advisory_xact_lock(170035);
 if to_regprocedure('public.save_material_table(uuid,bigint,jsonb,uuid)') is null then raise exception 'PATCH_034_REQUIRED';end if;
 if to_regprocedure('public.public_order_catalog(date,integer,integer)') is not null then raise exception 'PATCH_035_ALREADY_PRESENT';end if;
 execute $migration035$${sql.replace(/^begin;/i,'').replace(/commit;$/i,'')}$migration035$;
end $patch035$;
notify pgrst,'reload schema';
select '035_READY' as status;
`;
}

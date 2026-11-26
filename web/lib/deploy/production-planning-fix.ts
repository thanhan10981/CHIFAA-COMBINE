export function buildProductionPlanningFix(migration:string){
 const sql=migration.trim();
 if(!/^begin;/i.test(sql)||!/commit;$/i.test(sql))throw new Error('Transaction migration required');
 return `-- CHIFAA 093: production recipe lookup and planning sources.
-- Run as owner on the intended project. Does not rewrite saved quantities,
-- production, stock, orders or snapshots. Replay skips an installed patch.
begin;
set local lock_timeout='5s';
do $patch093$ begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 perform pg_advisory_xact_lock(170093);
 if to_regprocedure('private.production_demand_lines(uuid,date)') is not null then return;end if;
 if to_regprocedure('private.recipe_formula_line(uuid,uuid,numeric,date)') is null then raise exception 'PATCH_089_REQUIRED';end if;
 execute $migration093$${sql.replace(/^begin;/i,'').replace(/commit;$/i,'')}$migration093$;
end $patch093$;
notify pgrst,'reload schema';
commit;
select to_regprocedure('private.production_demand_lines(uuid,date)') is not null as production_planning_ready;
`;
}

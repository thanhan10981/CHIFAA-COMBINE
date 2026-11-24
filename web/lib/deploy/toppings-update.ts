export const toppingMigrations=[
 '202611240081_publish_toppings_with_product.sql',
 '202611240082_publish_recipe_dependencies_and_toppings.sql',
 '202611240083_connect_saved_recipe_toppings_to_orders.sql',
] as const;

type Migration={name:string;sql:string};

/** SQL Editor update for an existing installation; never executes cloud SQL. */
export function buildToppingsUpdate(migrations:Migration[]){
 if(migrations.length!==toppingMigrations.length||migrations.some((migration,index)=>migration.name!==toppingMigrations[index]))throw new Error('Topping update requires migrations 081, 082 and 083 in order.');
 const conditions=[
  "not exists(select 1 from information_schema.columns where table_schema='public' and table_name='recipe_topping_options' and column_name='topping_version_id')",
  "to_regprocedure('private.publish_recipe_tree(uuid,uuid[],boolean)') is null",
  "to_regprocedure('private.order_topping_configuration(date)') is null",
 ];
 const sections=migrations.map(({name,sql},index)=>{
  const text=sql.replace(/^\uFEFF/,'').trim();
  if(!/^begin\s*;/i.test(text)||!/commit\s*;$/i.test(text))throw new Error('Migration must be transaction wrapped: '+name);
  const body=text.replace(/^begin\s*;\s*/i,'').replace(/\s*commit\s*;$/i,'');
  if(/^\s*(?:begin|commit|rollback)\s*;/im.test(body))throw new Error('Unexpected transaction boundary: '+name);
  const tag='$topping_migration_'+index+'$';
  if(body.includes(tag))throw new Error('Reserved migration delimiter: '+name);
  return `-- ${name}\ndo $install_${index}$\nbegin\n if ${conditions[index]} then\n  execute ${tag}${body}${tag};\n end if;\nend $install_${index}$;`;
 });
 return `-- CHIFAA: connect saved recipe toppings to the public ordering portal.
-- Existing schema through migration 078 or later is required. Missing 081/082
-- prerequisites are installed in order; already installed steps are skipped.
-- The update changes schema and 081 may backfill existing option version IDs.
-- It does not publish historical drafts or modify saved order snapshots.
-- SQL Editor does not register Supabase CLI migration history.
begin;
set local lock_timeout='5s';
set local statement_timeout='180s';
do $guard$
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 if to_regclass('public.recipe_topping_options') is null
  or to_regprocedure('public.submit_public_order_with_toppings(date,text,jsonb,jsonb,text,text,text,uuid)') is null
 then raise exception 'CHIFAA_TOPPING_BASE_073_REQUIRED';end if;
 if strpos(pg_get_functiondef('public.submit_public_order_with_toppings(date,text,jsonb,jsonb,text,text,text,uuid)'::regprocedure),'INVALID_TOPPING_ALLOCATION')=0
 then raise exception 'CHIFAA_TOPPING_ALLOCATION_078_REQUIRED';end if;
 if (to_regprocedure('private.order_topping_configuration(date)') is null)
  <> (to_regprocedure('public.public_order_topping_catalog_v2(date)') is null)
 then raise exception 'CHIFAA_TOPPING_UPDATE_PARTIAL';end if;
 if to_regprocedure('private.publish_recipe_tree(uuid,uuid[],boolean)') is not null
  and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='recipe_topping_options' and column_name='topping_version_id')
 then raise exception 'CHIFAA_TOPPING_UPDATE_PARTIAL';end if;
end $guard$;
${sections.join('\n\n')}
notify pgrst,'reload schema';
commit;
select public.public_order_topping_catalog_v2((now() at time zone 'Asia/Ho_Chi_Minh')::date) as topping_catalog;
`;
}

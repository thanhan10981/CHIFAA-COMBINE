export const recipePublicationMigrations=[
 '202611250087_explain_recipe_publication_unit_blocker.sql',
 '202611250088_order_demand_uses_formula_units.sql',
 '202611250089_recipe_formula_conversion_and_reports.sql',
 '202611250090_publish_recipe_tree_at_selected_date.sql',
] as const;

type Migration={name:string;sql:string};

/** Prepare a replayable SQL Editor release; never connects to a database. */
export function buildRecipePublicationUpdate(migrations:Migration[]){
 if(migrations.length!==recipePublicationMigrations.length||migrations.some((migration,index)=>migration.name!==recipePublicationMigrations[index]))throw new Error('Recipe publication update requires migrations 087 through 090 in order.');
 const installed=[
  "strpos(pg_get_functiondef('private.bom(uuid,numeric,date)'::regprocedure),'UNIT_NEEDS_VERIFICATION|material=%s')>0",
  "to_regprocedure('private.order_demand_formula_units(jsonb,date)') is not null",
  "to_regprocedure('private.recipe_formula_line(uuid,uuid,numeric,date)') is not null",
  "to_regprocedure('public.publish_recipe_at(uuid,bigint,date,uuid)') is not null",
 ];
 const sections=migrations.map(({name,sql},index)=>{
  const text=sql.replace(/^\uFEFF/,'').trim();
  if(!/^begin\s*;/i.test(text)||!/commit\s*;$/i.test(text))throw new Error('Migration must be transaction wrapped: '+name);
  const body=text.replace(/^begin\s*;\s*/i,'').replace(/\s*commit\s*;$/i,'');
  if(/^\s*(?:begin|commit|rollback)\s*;/im.test(body))throw new Error('Unexpected transaction boundary: '+name);
  const tag='$recipe_migration_'+index+'$';
  if(body.includes(tag))throw new Error('Reserved migration delimiter: '+name);
  return `-- ${name}\ndo $install_recipe_${index}$\nbegin\n if not (${installed[index]}) then\n  execute ${tag}${body}${tag};\n end if;\nend $install_recipe_${index}$;`;
 });
 return `-- CHIFAA: recipe formula conversions, dated publication and material demand.
-- Requires the existing installation through migration 086. Installs only
-- missing steps 087-090, atomically; a repeated run preserves business data.
-- Does not publish drafts, change material ratios or rewrite posted snapshots.
-- Deploy the matching frontend (publish_recipe_at) after this SQL succeeds.
-- SQL Editor does not register Supabase CLI migration history.
begin;
set local lock_timeout='5s';
set local statement_timeout='180s';
do $recipe_guard$
declare diagnostics_ready boolean;demand_ready boolean;formula_ready boolean;publication_ready boolean;
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 if to_regprocedure('private.planning_needs(date,jsonb)') is null
  or to_regprocedure('private.bom(uuid,numeric,date)') is null
  or to_regprocedure('private.publish_recipe_tree(uuid,uuid[],boolean)') is null
  or to_regprocedure('public.recipe_material_units(date)') is null
 then raise exception 'CHIFAA_RECIPE_BASE_SCHEMA_REQUIRED';end if;
 if strpos(pg_get_functiondef('private.planning_needs(date,jsonb)'::regprocedure),'same_code.output_quantity_per_product')=0
 then raise exception 'CHIFAA_RECIPE_MIGRATION_086_REQUIRED';end if;
 diagnostics_ready=strpos(pg_get_functiondef('private.bom(uuid,numeric,date)'::regprocedure),'UNIT_NEEDS_VERIFICATION|material=%s')>0;
 demand_ready=to_regprocedure('private.order_demand_formula_units(jsonb,date)') is not null;
 formula_ready=to_regprocedure('private.recipe_formula_line(uuid,uuid,numeric,date)') is not null;
 publication_ready=to_regprocedure('public.publish_recipe_at(uuid,bigint,date,uuid)') is not null;
 if formula_ready <> (to_regprocedure('private.formula_inventory_quantity(uuid,date,uuid,uuid)') is not null)
  or publication_ready <> (to_regprocedure('private.prepare_recipe_publication(uuid,date,uuid,uuid[])') is not null)
  or (demand_ready and not diagnostics_ready)
  or (formula_ready and not demand_ready)
  or (publication_ready and not formula_ready)
 then raise exception 'CHIFAA_RECIPE_UPDATE_PARTIAL';end if;
 if formula_ready and (
  strpos(pg_get_functiondef('private.bom(uuid,numeric,date)'::regprocedure),'formula_from=%s')=0
  or strpos(pg_get_functiondef('public.recipe_detail(uuid,date)'::regprocedure),'private.recipe_formula_line(')=0
  or strpos(pg_get_functiondef('public.order_material_demand(date)'::regprocedure),'private.formula_inventory_quantity(')=0)
 then raise exception 'CHIFAA_RECIPE_UPDATE_PARTIAL';end if;
 if publication_ready and (
  strpos(pg_get_functiondef(to_regprocedure('public.publish_recipe_at(uuid,bigint,date,uuid)')),'private.prepare_recipe_publication(')=0
  or strpos(pg_get_functiondef('public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid)'::regprocedure),'private.prepare_recipe_publication(')=0
  or to_regclass('public.recipe_published_date') is not null)
 then raise exception 'CHIFAA_RECIPE_UPDATE_PARTIAL';end if;
end $recipe_guard$;
${sections.join('\n\n')}
notify pgrst,'reload schema';
commit;
select to_regprocedure('public.publish_recipe_at(uuid,bigint,date,uuid)') is not null as recipe_publication_ready,
 to_regprocedure('private.recipe_formula_line(uuid,uuid,numeric,date)') is not null as formula_units_ready;
`;
}

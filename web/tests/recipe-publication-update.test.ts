import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {PGlite} from '@electric-sql/pglite';
import {database} from './database-fixture';
import {buildRecipePublicationUpdate,recipePublicationMigrations} from '../lib/deploy/recipe-publication-update';

const base='202611240086_use_same_code_recipe_for_order_demand.sql';
const migrations=await Promise.all(recipePublicationMigrations.map(async name=>({name,sql:await fs.readFile(path.resolve('../supabase/migrations',name),'utf8')})));
const sql=buildRecipePublicationUpdate(migrations);
async function state(db:PGlite){
 const tables=['recipes','recipe_versions','recipe_items','product_recipe_links','inventory_movements','inventory_movement_lines','ingredient_requirement_snapshots','idempotency_keys','audit_logs'];
 const result:Record<string,unknown>={};
 for(const table of tables)result[table]=(await db.query(`select * from public.${table} t order by to_jsonb(t)::text`)).rows;
 result.functions=(await db.query("select n.nspname,p.proname,p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private') and p.prokind='f' order by n.nspname,p.proname,p.oid::regprocedure::text")).rows;
 return result;
}
for(const boundary of [base,...recipePublicationMigrations]){
 test('recipe SQL bundle upgrades '+boundary+' and replays without writes',async()=>{
  const db=await database(boundary);
  try{
   // A real draft makes accidental automatic publication visible on replay.
   await db.exec("insert into recipes(code,name,kind) values('RELEASE-DRAFT','Synthetic release draft','product');insert into material_units(code,name,dimension) values('RELEASE-PORTION','Synthetic portion','count');insert into recipe_versions(recipe_id,revision,effective_from,output_quantity,output_unit_id) select r.id,1,'2091-01-01',1,u.id from recipes r cross join material_units u where r.code='RELEASE-DRAFT' and u.code='RELEASE-PORTION';");
   const businessBefore=(await db.query('select * from recipe_versions order by id')).rows;
   await db.exec(sql);
   assert.notEqual((await db.query<{ready:string|null}>("select to_regprocedure('public.publish_recipe_at(uuid,bigint,date,uuid)')::text ready")).rows[0].ready,null);
   assert.deepEqual((await db.query('select * from recipe_versions order by id')).rows,businessBefore);
   await db.exec(await fs.readFile(path.resolve('../supabase/diagnostics/recipe_publication_readiness.sql'),'utf8'));
   const installed=await state(db);
   await db.exec(sql);
   assert.deepEqual(await state(db),installed);
  }finally{await db.close();}
 });
}
test('failure inside migration 090 rolls back all earlier recipe update steps',async()=>{
 const db=await database(base);
 try{
  const before=await state(db);
  const broken=migrations.map(m=>({...m,sql:m.name===recipePublicationMigrations[3]?m.sql.replace("old_fragment='values(p_product,p_version,p_output_per_product,current_row.effective_from);';","old_fragment='SYNTHETIC_MISSING_FRAGMENT';"):m.sql}));
  await assert.rejects(()=>db.exec(buildRecipePublicationUpdate(broken)),/RECIPE_SAME_DAY_LINK_PATCH_MISMATCH/);
  await db.exec('rollback');
  assert.deepEqual(await state(db),before);
 }finally{await db.close();}
});
test('release refuses a partial installation or missing 086 before writing',async()=>{
 for(const boundary of ['202611240085_prefill_public_order_contact_from_store.sql',recipePublicationMigrations[2]]){
  const db=await database(boundary);
  try{
   if(boundary===recipePublicationMigrations[2])await db.exec('drop function private.formula_inventory_quantity(uuid,date,uuid,uuid)');
   const before=await state(db);
   await assert.rejects(()=>db.exec(sql),/CHIFAA_RECIPE_(MIGRATION_086_REQUIRED|UPDATE_PARTIAL)/);
   await db.exec('rollback');
   assert.deepEqual(await state(db),before);
  }finally{await db.close();}
 }
});

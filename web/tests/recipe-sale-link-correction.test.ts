import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
import {buildRecipeSaleLinkCorrection,buildRecipeSaleLinkDiagnosis,type ConfirmedRecipeSaleLink} from '../lib/deploy/recipe-sale-link-correction';

const date='2026-11-25';
const config:ConfirmedRecipeSaleLink[]=[14,16].map(quantity=>({productCode:'FIX-SALE-'+quantity,recipeCode:'FIX-SALE-'+quantity,saleUnit:'FIX-TREE',outputUnit:'FIX-SLICE',quantity:String(quantity),evidence:'Synthetic owner-confirmed one whole roll per recipe batch'}));
async function setup(){
 const db=await database();
 try{
 const units=Object.fromEntries((await db.query<{id:string;code:string}>("insert into material_units(code,name,dimension) values('FIX-KG','Synthetic kg','mass'),('FIX-SLICE','Synthetic slice','count') returning id,code")).rows.map(row=>[row.code,row.id]));
 const material=(await db.query<{id:string}>("insert into materials(code,name,usage_unit_id,purchase_unit_id) values('FIX-M','Synthetic material',$1,$1) returning id",[units['FIX-KG']])).rows[0].id;
 await db.query("insert into material_prices(material_id,basis_unit_id,amount,effective_from,verification) values($1,$2,1000,'2020-01-01','verified')",[material,units['FIX-KG']]);
 const products:string[]=[],versions:string[]=[];
 for(const entry of config){
  products.push((await db.query<{id:string}>('insert into products(code,name,sale_unit) values($1,$1,$2) returning id',[entry.productCode,entry.saleUnit])).rows[0].id);
  const recipe=(await db.query<{id:string}>("insert into recipes(code,name,kind) values($1,$1,'product') returning id",[entry.recipeCode])).rows[0].id;
  const version=(await db.query<{id:string}>("insert into recipe_versions(recipe_id,revision,effective_from,output_quantity,output_unit_id) values($1,1,'2020-01-01',$2,$3) returning id",[recipe,entry.quantity,units['FIX-SLICE']])).rows[0].id;
  await db.query('insert into recipe_items(recipe_version_id,material_id,quantity,unit_id) values($1,$2,$3,$4)',[version,material,String(Number(entry.quantity)/100),units['FIX-KG']]);versions.push(version);
  await db.query("update recipe_versions set status='published' where id=$1",[version]);
 }
 const warehouse=(await db.query<{id:string}>("insert into warehouses(code,name,kind) values('FIX-W','Synthetic warehouse','ingredient') returning id")).rows[0].id;
 const history=(await db.query<{id:string}>("insert into products(code,name,sale_unit) values('FIX-HISTORY','Synthetic existing production','FIX-TREE') returning id")).rows[0].id;
 await db.query("insert into product_recipe_links(product_id,recipe_version_id,output_quantity_per_product,effective_from) values($1,$2,14,'2020-01-01')",[history,versions[0]]);
 await asUser(db,identities.admin,()=>db.query("select public.post_inventory($1,'2026-11-20','receipt',$2,'Synthetic old receipt',$3)",[warehouse,[{material_id:material,unit_id:units['FIX-KG'],quantity:'10',unit_cost:'1000'}],randomUUID()]));
 await asUser(db,identities.admin,()=>db.query("select public.post_production($1,'2026-11-20',$2,$3)",[warehouse,[{product_id:history,recipe_version_id:versions[0],main_quantity:'1',extra_quantity:'0',rejected_quantity:'0'}],randomUUID()]));
 return {db,products,versions,material};
 }catch(error){await db.close();throw error;}
}
async function protectedState(db:PGlite){
 const result:Record<string,unknown>={};
 for(const table of ['products','recipe_versions','recipe_items','inventory_movements','inventory_movement_lines','production_batches','production_batch_lines','ingredient_requirement_snapshots','material_resolutions','material_prices'])result[table]=(await db.query(`select ${table==='products'?"to_jsonb(t)-'version'-'updated_at'-'updated_by' row":'*'} from public.${table} t order by to_jsonb(t)::text`)).rows;
 return result;
}
const needs=async(db:PGlite,product:string,day=date)=>(await db.query<{r:{issue?:string;quantity?:string;output_factor?:string;recipe_version_id?:string}[]}>('select private.planning_needs($1,$2) r',[day,[{product_id:product,quantity:'2'}]])).rows[0].r;

test('confirmed owner correction fixes both sale ratios, keeps posted history and replays without any writes',async()=>{
 const {db,products,versions}=await setup();
 try{
  for(const product of products)assert.equal((await needs(db,product))[0].issue,'PRODUCT_RECIPE_RATIO_REQUIRED');
  // A same-code published recipe still needs the confirmed sale conversion.
  const protectedBefore=await protectedState(db);assert.ok((await db.query('select * from ingredient_requirement_snapshots')).rows.length>0);
  const productVersions=(await db.query<{id:string;version:number}>('select id,version from products order by id')).rows;
  await db.exec(buildRecipeSaleLinkDiagnosis(config));
  const sql=buildRecipeSaleLinkCorrection(date,config);await db.exec(sql);
  for(let i=0;i<products.length;i++){
   const rows=await needs(db,products[i]);assert.equal(rows.length,1);assert.equal(rows[0].issue,undefined);assert.equal(Number(rows[0].quantity),Number(config[i].quantity)/50);
   const oneSale=(await db.query<{quantity:string}>("select n->>'quantity' quantity from jsonb_array_elements(private.planning_needs($1,$2)) n",[date,[{product_id:products[i],quantity:'1'}]])).rows;
   const oneBatch=(await db.query<{quantity:string}>('select quantity::text from private.bom($1,$2,$3)',[versions[i],config[i].quantity,date])).rows;
   assert.equal(oneSale.length,1);assert.equal(Number(oneSale[0].quantity),Number(oneBatch[0].quantity));
   assert.equal((await needs(db,products[i],'2026-11-24'))[0].issue,'PRODUCT_RECIPE_RATIO_REQUIRED');
  }
  assert.deepEqual(await protectedState(db),protectedBefore);
  const afterProductVersions=(await db.query<{id:string;version:number}>('select id,version from products order by id')).rows;
  for(const before of productVersions)assert.equal(Number(afterProductVersions.find(row=>row.id===before.id)?.version),Number(before.version)+(products.includes(before.id)?1:0));
  const provenance=(await db.query<{source_data:{evidence:string}}>("select source_data from private.catalog_sources where entity='terms:recipe' order by source_data->>'quantity'")).rows;
  assert.deepEqual(provenance.map(row=>row.source_data.evidence),config.map(link=>link.evidence));
  const links=(await db.query('select * from product_recipe_links order by id')).rows,audit=(await db.query('select * from audit_logs order by id')).rows;
  const sources=(await db.query('select * from private.catalog_sources order by entity,entity_id,source_hash')).rows;
  assert.equal((await db.query("select * from audit_logs where action='CONFIRMED_RECIPE_SALE_LINK'")).rows.length,2);
  await db.exec(sql);assert.deepEqual((await db.query('select * from product_recipe_links order by id')).rows,links);assert.deepEqual((await db.query('select * from audit_logs order by id')).rows,audit);
  assert.deepEqual((await db.query('select id,version from products order by id')).rows,afterProductVersions);
  assert.deepEqual((await db.query('select * from private.catalog_sources order by entity,entity_id,source_hash')).rows,sources);
 }finally{await db.close();}
});

test('a contradictory second recipe, same-day conflict and closed period roll back the entire correction',async()=>{
 const {db,products,versions}=await setup();
 try{
  const before=(await db.query('select * from product_recipe_links order by id')).rows;
  const rejected=async(sql:string,pattern:RegExp)=>{await assert.rejects(()=>db.exec(sql),pattern);await db.exec('rollback');};
  await rejected(buildRecipeSaleLinkCorrection(date,[config[0],{...config[1],quantity:'15'}]),/CONFIRMED_BATCH_OUTPUT_MISMATCH/);
  assert.deepEqual((await db.query('select * from product_recipe_links order by id')).rows,before);
  await db.query('insert into product_recipe_links(product_id,recipe_version_id,output_quantity_per_product,effective_from) values($1,$2,1,$3)',[products[1],versions[1],date]);
  const conflict=(await db.query('select * from product_recipe_links order by id')).rows;
  await rejected(buildRecipeSaleLinkCorrection(date,config),/SAME_DAY_RECIPE_LINK_CONFLICT/);assert.deepEqual((await db.query('select * from product_recipe_links order by id')).rows,conflict);
  await db.query("insert into accounting_periods(starts_on,ends_on,status) values('2026-11-01','2026-11-30','closed')");
  await rejected(buildRecipeSaleLinkCorrection(date,config),/PERIOD_CLOSED/);assert.deepEqual((await db.query('select * from product_recipe_links order by id')).rows,conflict);
 }finally{await db.close();}
});

test('saved ratios remain effective on future delivery dates and follow newly published recipes without rewriting earlier days',async()=>{
 const {db,products,versions,material}=await setup();
 try{
  await db.exec(buildRecipeSaleLinkCorrection(date,config));
  const originalNeeds=await Promise.all(products.map(product=>needs(db,product)));
  const protectedBefore=await protectedState(db);
  const oldVersions=(await db.query('select * from recipe_versions where id=any($1) order by id',[versions])).rows;
  for(let i=0;i<products.length;i++){
   for(const day of ['2026-11-26','2026-12-01','2027-11-25']){
    const rows=await needs(db,products[i],day);
    assert.equal(rows[0].issue,undefined);assert.equal(Number(rows[0].output_factor),Number(config[i].quantity));
    assert.equal(rows[0].recipe_version_id,versions[i]);assert.equal(Number(rows[0].quantity),Number(config[i].quantity)/50);
   }
   const source=(await db.query<{recipe_id:string;recipe_version:string;output_unit_id:string;unit_id:string}>(
    'select r.id recipe_id,r.version::text recipe_version,v.output_unit_id,i.unit_id from recipes r join recipe_versions v on v.recipe_id=r.id join recipe_items i on i.recipe_version_id=v.id where v.id=$1',[versions[i]])).rows[0];
   const saved=(await asUser(db,identities.admin,()=>db.query<{r:{version_id:string}}>(
    'select public.save_recipe_revision($1,$2,$3,$4,$5,$6) r',[source.recipe_id,source.recipe_version,
     {code:config[i].recipeCode,name:'Synthetic future revision',kind:'product',effective_from:'2026-11-26',output_quantity:config[i].quantity,output_unit_id:source.output_unit_id},
     [{material_id:material,unit_id:source.unit_id,quantity:String(Number(config[i].quantity)/50)}],
     'Synthetic ingredient update with unchanged whole-roll sale specification',randomUUID()]))).rows[0].r;
   const expected=(await db.query<{version:string}>('select version::text from recipe_versions where id=$1',[saved.version_id])).rows[0].version;
   await asUser(db,identities.admin,()=>db.query('select public.publish_recipe_at($1,$2,$3,$4)',[saved.version_id,expected,'2026-11-26',randomUUID()]));
   for(const day of ['2026-11-26','2026-12-01','2027-11-25']){
    const rows=await needs(db,products[i],day);
    assert.equal(rows[0].issue,undefined);assert.equal(Number(rows[0].output_factor),Number(config[i].quantity));
    assert.equal(rows[0].recipe_version_id,saved.version_id);assert.equal(Number(rows[0].quantity),Number(config[i].quantity)/25);
   }
   assert.deepEqual(await needs(db,products[i],date),originalNeeds[i]);
  }
  assert.deepEqual((await db.query('select * from recipe_versions where id=any($1) order by id',[versions])).rows,oldVersions);
  const protectedAfter=await protectedState(db);
  for(const table of ['products','inventory_movements','inventory_movement_lines','production_batches','production_batch_lines','ingredient_requirement_snapshots','material_resolutions','material_prices'])assert.deepEqual(protectedAfter[table],protectedBefore[table]);
 }finally{await db.close();}
});

test('correction requires a real explicit date, confirmed fields and the SQL owner role',async()=>{
 for(const invalid of ['', '2026-02-30','0000-01-01','today'])assert.throws(()=>buildRecipeSaleLinkCorrection(invalid,config),/explicit delivery/);
 assert.throws(()=>buildRecipeSaleLinkCorrection(date,[{...config[0],quantity:'0'}]),/confirmed product/);
 const {db}=await setup();
 try{
  await db.exec('set role authenticated');await assert.rejects(()=>db.exec(buildRecipeSaleLinkCorrection(date,config)),/SQL_EDITOR_OWNER_REQUIRED/);await db.exec('rollback');await db.exec('reset role');
 }finally{await db.close();}
});

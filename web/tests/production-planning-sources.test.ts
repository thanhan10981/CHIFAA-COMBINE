import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
import {readFile} from 'node:fs/promises';
import {buildProductionPlanningFix} from '../lib/deploy/production-planning-fix';
type Row=Record<string,unknown>;
const rpc=async<T=Row>(db:PGlite,name:string,args:unknown[])=>(await asUser(db,identities.admin,()=>db.query<{r:T}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args))).rows[0].r;
async function setup(){
 const db=await database(),date='2095-04-12';
 const kg=(await db.query<{id:string}>("insert into material_units(code,name,dimension) values('SRC-KG','Synthetic kilogram','mass') returning id")).rows[0].id;
 const portion=(await db.query<{id:string}>("insert into material_units(code,name,dimension) values('SRC-PORTION','Synthetic portion','count') returning id")).rows[0].id;
 const warehouse=(await db.query<{id:string}>("insert into warehouses(code,name,kind) values('SRC-W','Synthetic ingredient warehouse','ingredient') returning id")).rows[0].id;
 const material=(await db.query<{id:string}>("insert into materials(code,name,usage_unit_id,purchase_unit_id) values('SRC-M','Synthetic ingredient',$1,$1) returning id",[kg])).rows[0].id;
 const product=(await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values('SRC-P','Synthetic same-code dish','SRC-PORTION',true) returning id")).rows[0].id;
 const saved=await rpc(db,'save_recipe',[{code:'SRC-P',name:'Synthetic published recipe',kind:'product',effective_from:date,output_quantity:'1',output_unit_id:portion},[{material_id:material,quantity:'0.1',unit_id:kg}],randomUUID()]);
 await rpc(db,'publish_recipe',[saved.version_id,'1',null,null,randomUUID()]);
 await rpc(db,'post_inventory',[warehouse,date,'receipt',[{material_id:material,unit_id:kg,quantity:'100'}],'Synthetic opening stock',randomUUID()]);
 return {db,date,warehouse,material,product,version:saved.version_id as string};
}
test('production finds same-code effective published recipes without explicit links, posts exact stock once and rejects future/unrelated recipes',async()=>{
 const {db,date,warehouse,material,product,version}=await setup();
 try{
  const read=async(day=date)=>rpc<{products:Row[];plan_lines:Row[]}>(db,'production_material_workspace',[warehouse,day,day,'actual']);
  const productRow=(await read()).products.find(p=>p.id===product)!;assert.equal(productRow.recipe_version_id,version);assert.equal(productRow.recipe_issue,null);
  assert.equal((await db.query('select * from product_recipe_links where product_id=$1',[product])).rows.length,0);
  assert.equal((await read('2095-04-11')).products.find(p=>p.id===product)!.recipe_version_id,null);
  const key=randomUUID(),lines=[{product_id:product,recipe_version_id:version,main_quantity:'5',extra_quantity:'0',rejected_quantity:'0'}];
  const run=()=>rpc(db,'post_production_run',[warehouse,date,date+'T00:00:00+07:00',date+'T07:00:00+07:00',date,lines,'Synthetic same-code production',key]);
  const result=await run();assert.deepEqual(await run(),result);
  const stock=(await db.query<{q:string}>('select sum(l.quantity)::text q from inventory_movement_lines l join inventory_movements m on m.id=l.movement_id where m.warehouse_id=$1 and l.material_id=$2',[warehouse,material])).rows[0].q;assert.equal(Number(stock),99.5);
  assert.equal((await db.query('select * from production_batches')).rows.length,1);
  await assert.rejects(()=>rpc(db,'post_production',[warehouse,'2095-04-11',lines,randomUUID()]),/PUBLISHED_PRODUCT_RECIPE_REQUIRED/);
  await assert.rejects(()=>rpc(db,'post_production',[warehouse,date,[{...lines[0],recipe_version_id:randomUUID()}],randomUUID()]),/PUBLISHED_PRODUCT_RECIPE_REQUIRED/);
  assert.equal((await db.query('select * from production_batches')).rows.length,1);
  await db.query("update products set sale_unit='SRC-WHOLE' where id=$1",[product]);
  const missingRatio=(await read()).products.find(p=>p.id===product)!;assert.equal(missingRatio.recipe_version_id,version);assert.equal(missingRatio.recipe_issue,'PRODUCT_RECIPE_RATIO_REQUIRED');
  await assert.rejects(()=>rpc(db,'post_production',[warehouse,date,lines,randomUUID()]),/PRODUCT_RECIPE_RATIO_REQUIRED/);
 }finally{await db.close();}
});
test('production planning owner package applies and replays without rewriting saved manual plans, order quantities, snapshots or audit',async()=>{
 const db=await database('202611260092_order_quantity_discounts.sql');
 try{
  const warehouse=(await db.query<{id:string}>("insert into warehouses(code,name,kind) values('PATCH-W','Synthetic patch warehouse','ingredient') returning id")).rows[0].id;
  await db.query("insert into production_plan_revisions(warehouse_id,business_date,lines,needs,reason) values($1,'2095-04-12','[]','[]','Synthetic preserved source')",[warehouse]);
  const tables=['production_plan_revisions','customer_orders','customer_order_items','production_plans','production_plan_lines','production_batches','ingredient_requirement_snapshots','inventory_movements','audit_logs'];
  const snapshot=()=>Promise.all(tables.map(table=>db.query('select to_jsonb(t) r from '+table+' t order by to_jsonb(t)::text').then(r=>r.rows)));
  const before=await snapshot(),migration=await readFile('../supabase/migrations/202611260093_production_planning_sources.sql','utf8');
  const broken=buildProductionPlanningFix(migration.replace('p.sale_unit,l.recipe_version_id,','intentional missing fragment'));
  await assert.rejects(()=>db.exec(broken),/PRODUCTION_SOURCE_PATCH_MISMATCH/);await db.exec('rollback;');
  assert.equal((await db.query<{ready:boolean}>("select to_regprocedure('private.production_demand_lines(uuid,date)') is not null ready")).rows[0].ready,false);
  const sql=buildProductionPlanningFix(migration);await db.exec(sql);await db.exec(sql);assert.deepEqual(await snapshot(),before);
  await db.exec('begin;set local role anon;');await assert.rejects(()=>db.query('select * from private.production_demand_lines($1,current_date)',[warehouse]),/permission denied/);await db.exec('rollback;');
 }finally{await db.close();}
});
test('manual source remains separate while approved orders refresh once, preview matches and multiple warehouses never duplicate unassigned demand',async()=>{
 const {db,date,warehouse,product}=await setup();
 try{
  const manual=await rpc(db,'save_production_plan',[warehouse,date,null,'append',[{product_id:product,quantity:'3'}],'Synthetic outside-order plan',randomUUID()]);
  const store=(await db.query<{id:string}>("insert into stores(code,name) values('SRC-S','Synthetic store') returning id")).rows[0].id;
  const plan=(await db.query<{id:string}>("insert into production_plans(production_date,delivery_date,shift,status,ingredient_warehouse_id) values($1,$1,'AM','approved',$2) returning id",[date,warehouse])).rows[0].id;
  await db.query('insert into production_plan_lines(plan_id,product_id,planned_quantity) values($1,$2,9)',[plan,product]);
  const scheduled=(await db.query<{id:string}>("insert into customer_orders(store_id,customer_id,delivery_date,shift,status,plan_id) values($1,$2,$3,'AM','scheduled',$4) returning id",[store,identities.a,date,plan])).rows[0].id;
  const unplanned=(await db.query<{id:string}>("insert into customer_orders(store_id,customer_id,delivery_date,shift,status) values($1,$2,$3,'PM','approved') returning id",[store,identities.a,date])).rows[0].id;
  for(const [order,q] of [[scheduled,'9'],[unplanned,'7']])await db.query('insert into customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate) values($1,$2,$3,15000,0)',[order,product,q]);
  const snapshot=async()=>Promise.all(['production_plan_revisions','production_plans','production_plan_lines','production_batches','customer_orders','customer_order_items','audit_logs'].map(table=>db.query('select to_jsonb(t) r from '+table+' t order by to_jsonb(t)::text').then(r=>r.rows)));
  const before=await snapshot();
  const read=()=>rpc<{products:Row[];plan_lines:Row[];manual_source:Row;materials:Row[]}>(db,'production_material_workspace',[warehouse,date,date,'planned']);
  let w=await read();assert.equal(Number(w.products.find(p=>p.id===product)!.approved_quantity),16);assert.equal(Number(w.plan_lines[0].quantity),3);assert.equal(w.manual_source.id,manual.id);assert.equal(Number(w.materials.find(m=>m.quantity!==null)!.quantity),1.9);
  const preview=await rpc<{products:Row[]}>(db,'production_plan_requirements',[warehouse,date,manual.id,'append',[{product_id:product,quantity:'2'}]]);assert.equal(Number(preview.products[0].quantity),21);
  await read();assert.deepEqual(await snapshot(),before,'reading or preview never saves copied orders or posts production');
  await db.query('update customer_order_items set quantity=8 where order_id=$1',[unplanned]);w=await read();assert.equal(Number(w.products.find(p=>p.id===product)!.approved_quantity),17);assert.equal(Number(w.plan_lines[0].quantity),3);
  const other=(await db.query<{id:string}>("insert into warehouses(code,name,kind) values('SRC-W2','Synthetic second warehouse','ingredient') returning id")).rows[0].id;
  w=await read();assert.equal(Number(w.products.find(p=>p.id===product)!.approved_quantity),9);
  const elsewhere=await rpc<{products:Row[]}>(db,'production_material_workspace',[other,date,date,'planned']);assert.equal(elsewhere.products.find(p=>p.id===product)!.approved_quantity,null);
 }finally{await db.close();}
});

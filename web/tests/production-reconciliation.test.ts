import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
import {buildProductionReconciliationUpdate} from '../lib/deploy/production-reconciliation-update';
let db:PGlite;const kg=randomUUID(),portion=randomUUID(),mat=randomUUID(),warehouse=randomUUID(),product=randomUUID();let recipe:string;
type R=Record<string,unknown>;
const rpc=async(name:string,args:unknown[],user=identities.admin)=>(await asUser(db,user,()=>db.query<{r:R}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args))).rows[0].r;
const workspace=(date:string)=>rpc('production_material_workspace',[warehouse,date,date,'actual']);
const line=(q:string)=>({product_id:product,recipe_version_id:recipe,main_quantity:q,extra_quantity:'0',rejected_quantity:'0'});
const run=(date:string,q='100')=>rpc('post_production_run',[warehouse,date,date+'T00:00:00+07:00',date+'T07:00:00+07:00',date,[line(q)],'Synthetic run',randomUUID()]);
const correct=async(date:string,q:string,key=randomUUID(),token?:string)=>rpc('replace_production_day',[warehouse,date,token??(await workspace(date)).production_version,date+'T00:00:00+07:00',date+'T07:00:00+07:00',date,q==='0'?[]:[line(q)],'Synthetic correction with source review',key]);
before(async()=>{
 db=await database();await db.query("insert into material_units(id,code,name,dimension) values($1,'kg','kg','mass'),($2,'portion','portion','count')",[kg,portion]);
 await db.query("insert into materials(id,code,name,purchase_unit_id,usage_unit_id) values($1,'REC-M','Synthetic reconciliation material',$2,$2)",[mat,kg]);
 await db.query("insert into warehouses(id,code,name,kind) values($1,'REC-W','Synthetic warehouse','ingredient')",[warehouse]);await db.query("insert into products(id,code,name,sale_unit) values($1,'REC-P','Synthetic product','portion')",[product]);
 const r=await rpc('save_recipe',[{code:'REC-R',name:'Synthetic recipe',kind:'product',effective_from:'2020-01-01',output_quantity:'1',output_unit_id:portion},[{material_id:mat,quantity:'0.004',unit_id:kg}],randomUUID()]);recipe=r.version_id as string;await rpc('publish_recipe',[recipe,'1',product,'1',randomUUID()]);
 await rpc('post_inventory',[warehouse,'2026-11-01','receipt',[{material_id:mat,unit_id:kg,quantity:'100'}],'Synthetic opening',randomUUID()]);
});after(async()=>{await db?.close();});
test('KH-09 correction with posted delivery and linked sales preserves financial history and counts shipped quantities once',async()=>{
 await run('2026-11-10','130');
 const store=randomUUID(),delivery=randomUUID(),sale=randomUUID();await db.query("insert into stores(id,code,name) values($1,'REC-S','Synthetic store')",[store]);
 await db.query("insert into deliveries(id,store_id,delivery_date,status) values($1,$2,'2026-11-10','posted')",[delivery,store]);await db.query('insert into delivery_items(delivery_id,product_id,quantity) values($1,$2,100)',[delivery,product]);
 await db.query("insert into sales_documents(id,store_id,sold_on,delivery_id,status) values($1,$2,'2026-11-10',$3,'posted')",[sale,store,delivery]);await db.query('insert into sales_lines(document_id,product_id,delivered,sold,returned,store_borne,price_vnd,discount_rate) values($1,$2,100,80,10,10,15000,0.15)',[sale,product]);
 const before=(await db.query('select * from sales_lines')).rows;
 await correct('2026-11-10','100');assert.equal(Number(((await workspace('2026-11-10')).products as R[])[0].main_quantity),100);
 assert.deepEqual((await db.query('select * from sales_lines')).rows,before);
 const w=await workspace('2026-11-10');assert.equal((w.adjustments as R[]).length,1);assert.equal(((w.adjustments as R[])[0].documents as R[]).length,2);
 await assert.rejects(()=>correct('2026-11-10','90'),/CORRECTED_PRODUCTION_BELOW_DELIVERED/);
 assert.deepEqual((await db.query('select * from sales_lines')).rows,before);
});
test('KH-09 cancel erroneous production to explicit zero, reverse its stock once and allow a later corrected run',async()=>{
 await run('2026-11-11','100');const token=(await workspace('2026-11-11')).production_version as string,key=randomUUID();
 const a=await correct('2026-11-11','0',key,token);assert.equal(a.cancelled_entry,true);assert.deepEqual(await correct('2026-11-11','0',key,token),a);
 const w=await workspace('2026-11-11');assert.equal(Number((w.products as R[])[0].main_quantity),0);assert.equal(Number((w.materials as R[])[0].quantity),0);assert.equal((w.materials as R[])[0].percent,null);
 await correct('2026-11-11','90');assert.equal(Number(((await workspace('2026-11-11')).materials as R[])[0].quantity),.36);
 await assert.rejects(()=>correct('2026-11-11','10',randomUUID(),token),/VERSION_CONFLICT/);
});
test('KH-01 certify daily physical counts, classify unknown flow and derive all four quantities without using theoretical issues as actual',async()=>{
 const count=async(date:string,q:string)=>{const s=await rpc('stock_count_snapshot',[warehouse,date,'',0]);return rpc('post_stock_count',[warehouse,date,[{material_id:mat,counted_quantity:q}],s.inventory_version,randomUUID()]);};
 const a=await count('2026-11-17','10');await run('2026-11-18','100');
 await rpc('post_inventory',[warehouse,'2026-11-18','receipt',[{material_id:mat,unit_id:kg,quantity:'2'}],'Synthetic purchase',randomUUID()]);
 const issue=await rpc('post_inventory',[warehouse,'2026-11-18','issue',[{material_id:mat,unit_id:kg,quantity:'-1'}],'Synthetic transfer outside production',randomUUID()]);
 const b=await count('2026-11-18','9.5');
 let e=await rpc('material_usage_evidence',[warehouse,'2026-11-18',mat]);assert.equal(e.complete,false);assert.equal(e.unclassified,1);assert.equal((e.values as R).opening,null);
 for(const [id,date] of [[a.count_id,'2026-11-17'],[b.count_id,'2026-11-18']]){const row=(await db.query<{version:string}>('select version::text from stock_counts where id=$1',[id])).rows[0];await rpc('certify_stock_count',[id,row.version,null,date+'T23:00:00+07:00','Synthetic final count, no later flows',randomUUID()]);}
 const stale=(await rpc('material_usage_evidence',[warehouse,'2026-11-18',mat])).version;
 await rpc('classify_inventory_flow',[issue.movement_id,null,'physical','Synthetic outward transfer evidence',randomUUID()]);
 e=await rpc('material_usage_evidence',[warehouse,'2026-11-18',mat]);assert.equal(e.complete,true);assert.deepEqual(Object.fromEntries(Object.entries(e.values as R).map(([k,v])=>[k,Number(v)])),{opening:10,incoming:2,closing:9.5,other_out:1});
 await assert.rejects(()=>rpc('save_material_usage_from_evidence',[warehouse,'2026-11-18',mat,null,stale,'Synthetic stale',randomUUID()]),/VERSION_CONFLICT/);
 const key=randomUUID(),args=[warehouse,'2026-11-18',mat,null,e.version,'Synthetic complete document reconciliation',key],saved=await rpc('save_material_usage_from_evidence',args);assert.deepEqual(await rpc('save_material_usage_from_evidence',args),saved);
 const current=await workspace('2026-11-18');assert.equal(Number((current.materials as R[])[0].actual),1.5);assert.equal((current.usage_sources as R[]).length,1);
 const record=(await db.query<{source_snapshot:R}>('select source_snapshot from material_usage_checks where id=$1',[saved.id])).rows[0];assert.equal(record.source_snapshot.complete,true);
 await assert.rejects(()=>db.query("update material_usage_checks set source_snapshot='{}' where id=$1",[saved.id]),/DOCUMENT_IMMUTABLE/);
});
test('KH-10 scoped permissions and closed periods protect certification, classifications and document-derived writes',async()=>{
 await assert.rejects(()=>rpc('material_usage_evidence',[warehouse,'2026-11-18',mat],identities.accountant),/FORBIDDEN/);
 await assert.rejects(()=>rpc('classify_inventory_flow',[randomUUID(),null,'physical','Synthetic denied',randomUUID()],identities.accountant),/FORBIDDEN/);
 await db.exec("insert into accounting_periods(starts_on,ends_on,status) values('2026-11-01','2026-11-30','closed')");
 await assert.rejects(()=>correct('2026-11-11','80'),/PERIOD_CLOSED/);
 await assert.rejects(()=>rpc('save_material_usage_from_evidence',[warehouse,'2026-11-18',mat,null,'stale','Synthetic closed',randomUUID()]),/PERIOD_CLOSED/);
});
test('DEV029 package upgrades028 atomically, preserves its data and refuses replay',async()=>{
 const local=await database('202611180028_production_materials.sql');try{
  const migration=await fs.readFile('../supabase/migrations/202611180029_production_reconciliation.sql','utf8'),sql=buildProductionReconciliationUpdate(migration);
  const before=(await local.query('select * from profiles order by id')).rows;
  await assert.rejects(()=>local.exec(buildProductionReconciliationUpdate(migration.replace(/commit;\s*$/,'select 1/0;commit;'))),/division by zero/);
  assert.equal((await local.query<{t:string|null}>("select to_regclass('public.production_day_adjustments')::text t")).rows[0].t,null);
  await local.exec(sql);await assert.rejects(()=>local.exec(sql),/PATCH_029_ALREADY_PRESENT/);assert.deepEqual((await local.query('select * from profiles order by id')).rows,before);
 }finally{await local.close();}
});

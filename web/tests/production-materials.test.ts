import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
import fs from 'node:fs/promises';
import {buildProductionMaterialsUpdate} from '../lib/deploy/production-materials-update';
let db:PGlite;
const kg=randomUUID(),g=randomUUID(),portion=randomUUID(),material=randomUUID(),warehouse=randomUUID(),product=randomUUID(),product2=randomUUID();
let version:string;
type Row=Record<string,unknown>;
const call=async(name:string,args:unknown[],user=identities.admin)=>(await asUser(db,user,()=>db.query<{r:Row}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args))).rows[0].r;
const workspace=(from='2026-11-17',to=from,mode='actual',user=identities.admin)=>call('production_material_workspace',[warehouse,from,to,mode],user);
const plan=(previous:string|null,mode:string,q:string,key=randomUUID())=>call('save_production_plan',[warehouse,'2026-11-17',previous,mode,[{product_id:product,quantity:q}],'Synthetic plan evidence',key]);
const usage=(date:string,previous:string|null,closing:string,key=randomUUID())=>call('save_material_usage',[warehouse,date,material,previous,{opening:'10',incoming:'0',closing,other_out:'0'},'Synthetic opening/closing and all flow documents verified',key]);
const run=(date='2026-11-17',key=randomUUID(),main='100',extra='0')=>call('post_production_run',[warehouse,date,date+'T00:00:00+07:00',date+'T07:00:00+07:00',date,[{product_id:product,recipe_version_id:version,main_quantity:main,extra_quantity:extra,rejected_quantity:'0'}],'Synthetic production evidence',key]);
before(async()=>{
 db=await database();
 await db.query("insert into material_units(id,code,name,dimension) values($1,'kg','kg','mass'),($2,'g','g','mass'),($3,'phần','phần','count')",[kg,g,portion]);
 await db.query("insert into materials(id,code,name,purchase_unit_id,usage_unit_id) values($1,'PM-M','Synthetic material',$2,$2)",[material,kg]);
 await db.query("insert into warehouses(id,code,name,kind) values($1,'PM-W','Synthetic warehouse','ingredient')",[warehouse]);
 await db.query("insert into products(id,code,name,sale_unit) values($1,'PM-P','Synthetic product','phần'),($2,'PM-P2','Synthetic product two','phần')",[product,product2]);
 const r=await call('save_recipe',[{code:'PM-R',name:'Synthetic recipe',kind:'product',effective_from:'2020-01-01',output_quantity:'1',output_unit_id:portion},[{material_id:material,quantity:'4',unit_id:g}],randomUUID()]);
 version=r.version_id as string;await call('publish_recipe',[version,'1',product,'1',randomUUID()]);
 await db.query("insert into product_recipe_links(product_id,recipe_version_id,output_quantity_per_product,effective_from) values($1,$2,1,'2020-01-01')",[product2,version]);
 await call('post_inventory',[warehouse,'2026-11-01','receipt',[{material_id:material,unit_id:kg,quantity:'100'}],'Synthetic opening stock',randomUUID()]);
});
after(async()=>{await db?.close();});
test('KH-01/09 manual plans append 100+30, replace 90, retain history, reject stale writes and replay safely',async()=>{
 const key=randomUUID(),a=await plan(null,'append','100',key);assert.deepEqual(await plan(null,'append','100',key),a);
 const b=await plan(a.id as string,'append','30');let w=await workspace('2026-11-17',undefined,'planned');
 assert.equal(Number((w.plan_lines as Row[])[0].quantity),130);assert.equal(Number((w.materials as Row[])[0].quantity),.52);
 await assert.rejects(()=>plan(a.id as string,'replace','90'),/VERSION_CONFLICT/);
 await plan(b.id as string,'replace','90');w=await workspace('2026-11-17',undefined,'planned');assert.equal(Number((w.materials as Row[])[0].quantity),.36);
 assert.equal((w.history as Row[]).length,3);assert.equal((await db.query('select * from production_batches')).rows.length,0);
 await assert.rejects(()=>db.exec("update production_plan_revisions set reason='Silently changed'"),/DOCUMENT_IMMUTABLE/);
});
test('KH-01 shared ingredients aggregate across products, missing recipe is visible and quantities need no verified price',async()=>{
 const head=(await workspace('2026-11-17',undefined,'planned')).plan_id;
 await call('save_production_plan',[warehouse,'2026-11-17',head,'replace',[{product_id:product,quantity:'100'},{product_id:product2,quantity:'100'}],'Synthetic shared ingredient',randomUUID()]);
 const w=await workspace('2026-11-17',undefined,'planned');assert.equal(Number((w.materials as Row[])[0].quantity),.8);assert.equal((w.sources as Row[]).length,2);
 const missing=randomUUID();await db.query("insert into products(id,code,name,sale_unit) values($1,'PM-NO-RECIPE','Synthetic missing','phần')",[missing]);
 await call('save_production_plan',[warehouse,'2026-11-18',null,'append',[{product_id:missing,quantity:'100'}],'Synthetic missing recipe',randomUUID()]);
 const incomplete=await workspace('2026-11-18',undefined,'planned');assert.equal((incomplete.sources as Row[])[0].issue,'PUBLISHED_PRODUCT_RECIPE_REQUIRED');
});
test('KH-01 approved orders enter only their assigned warehouse demand once and stale assignments fail',async()=>{
 const id=randomUUID(),other=randomUUID();await db.query("insert into warehouses(id,code,name,kind) values($1,'PM-W2','Synthetic second warehouse','ingredient')",[other]);
 await db.query("insert into production_plans(id,delivery_date,production_date,shift,status) values($1,'2026-11-20','2026-11-19','Synthetic approved','approved')",[id]);
 await db.query('insert into production_plan_lines(plan_id,product_id,planned_quantity) values($1,$2,100)',[id,product]);
 assert.equal(((await workspace('2026-11-20',undefined,'planned')).sources as Row[]).length,0);
 const key=randomUUID();await call('assign_production_plan',[id,warehouse,'1',key]);await call('assign_production_plan',[id,warehouse,'1',key]);
 assert.equal(Number(((await workspace('2026-11-20',undefined,'planned')).materials as Row[])[0].quantity),.4);
 const otherDemand=await call('production_material_workspace',[other,'2026-11-20','2026-11-20','planned']);assert.equal((otherDemand.sources as Row[]).length,0);
 await assert.rejects(()=>call('assign_production_plan',[id,other,'1',randomUUID()]),/VERSION_CONFLICT/);
});
test('KH-01 incomplete purchase packages do not hide valid theoretical quantities or fabricate conversions',async()=>{
 const unknown=randomUUID();await db.query("insert into materials(id,code,name,usage_unit_id) values($1,'PM-UNKNOWN-PACKAGE','Synthetic missing purchase unit',$2)",[unknown,kg]);
 const w=await workspace('2026-11-17',undefined,'planned'),missing=(w.materials as Row[]).find(m=>m.material_id===unknown)!;
 assert.equal((missing.package as Row).verified,false);assert.equal((missing.package as Row).usage_per_package,null);assert.equal(missing.stock,null);
 assert.equal(Number((w.materials as Row[]).find(m=>m.material_id===material)!.quantity),.8);
});
test('KH-03 production main+extra snapshots once, overnight timestamps stay separate and failed runs leave no stock effect',async()=>{
 const key=randomUUID(),a=await run('2026-11-17',key,'100','30');assert.deepEqual(await run('2026-11-17',key,'100','30'),a);
 const w=await workspace();assert.equal(Number((w.materials as Row[])[0].quantity),.52);assert.equal((w.materials as Row[])[0].actual,null);
 assert.equal((await db.query('select * from production_batches')).rows.length,1);
 const row=(await db.query<{started_at:string;delivery_date:string}>('select started_at,delivery_date::text from production_batches')).rows[0];assert.ok(row.started_at);assert.equal(row.delivery_date,'2026-11-17');
 await assert.rejects(()=>run('2026-11-17',randomUUID(),'100000','0'),/INSUFFICIENT_STOCK/);assert.equal((await db.query('select * from production_batches')).rows.length,1);
 await assert.rejects(()=>run('2026-11-17',randomUUID(),'NaN','0'),/INVALID_QUANTITY/);
});
test('KH-01 compare only checked production days, retain zero versus missing and expose source evidence',async()=>{
 await run('2026-11-18');await usage('2026-11-17',null,'9.4384');
 const w=await workspace('2026-11-17','2026-11-18'),m=(w.materials as Row[])[0];
 assert.equal(Number(m.quantity),.92);assert.equal(Number(m.checked_theory),.52);assert.equal(Number(m.actual),.5616);assert.equal(Number(m.percent),8);assert.equal(m.checked_days,1);assert.equal(m.theory_days,2);
 assert.equal((w.checks as Row[]).length,1);assert.match(String((w.checks as Row[])[0].evidence),/all flow/);
 const key=randomUUID(),first=await usage('2026-11-18',null,'10',key);assert.deepEqual(await usage('2026-11-18',null,'10',key),first);
 assert.equal(Number(((await workspace('2026-11-18')).materials as Row[])[0].actual),0);
 await assert.rejects(()=>usage('2026-11-18',null,'9.6'),/VERSION_CONFLICT/);
 await assert.rejects(()=>call('save_material_usage',[warehouse,'2026-11-19',material,null,{opening:'10',incoming:'0',closing:'9'},'Synthetic incomplete',randomUUID()]),/INCOMPLETE_USAGE/);
});
test('KH-01/10 frozen reports survive later physical corrections and newer recipe publications',async()=>{
 const snap=await call('freeze_consumption_report',[warehouse,'2026-11-17','2026-11-18',randomUUID()]);
 const before=JSON.stringify(snap.payload),current=await workspace('2026-11-18'),head=((current.materials as Row[])[0].check as Row).id;
 await usage('2026-11-18',head as string,'9.6');
 const r=await call('save_recipe',[{code:'PM-R-NEW',name:'Synthetic new recipe',kind:'product',effective_from:'2026-11-19',output_quantity:'1',output_unit_id:portion},[{material_id:material,quantity:'8',unit_id:g}],randomUUID()]);
 await call('publish_recipe',[r.version_id,'1',product,'1',randomUUID()]);
 assert.equal(JSON.stringify((await call('consumption_report_history',[warehouse,snap.id])).payload),before);
 assert.equal(Number(((await workspace('2026-11-17')).materials as Row[])[0].quantity),.52);
 assert.equal(Number(((await workspace('2026-11-18')).materials as Row[])[0].actual),.4);
 const viewUser=identities.accountant;
 for(const scope of ['reports','counts','requirements','production','inventory'])await db.query('insert into user_permissions(user_id,module,action,allowed) values($1,$2,\'view\',true)',[viewUser,scope]);
 const restricted=await call('consumption_report_history',[warehouse,snap.id],viewUser);assert.ok(((restricted.payload as Row).products as Row[]).every(p=>!('sales' in p)));
 await db.query("update user_permissions set allowed=false where user_id=$1 and module='inventory'",[viewUser]);
 await assert.rejects(()=>call('consumption_report_history',[warehouse,snap.id],viewUser),/FORBIDDEN/);
});
test('KH-09 production replacement reverses old stock once, retains snapshots and rejects stale/failed correction',async()=>{
 const w=await workspace('2026-11-17'),key=randomUUID();
 const args=[warehouse,'2026-11-17',w.production_version,'2026-11-16T23:00:00+07:00','2026-11-17T07:00:00+07:00','2026-11-17',[{product_id:product,recipe_version_id:version,main_quantity:'90',extra_quantity:'0',rejected_quantity:'0'}],'Synthetic replace 130 with 90',key];
 const before=(await db.query<{q:string}>('select sum(l.quantity)::text q from inventory_movement_lines l')).rows[0].q;
 const result=await call('replace_production_day',args);assert.deepEqual(await call('replace_production_day',args),result);
 assert.equal(Number(((await workspace('2026-11-17')).materials as Row[])[0].quantity),.36);
 const after=(await db.query<{q:string}>('select sum(l.quantity)::text q from inventory_movement_lines l')).rows[0].q;assert.ok(Math.abs(Number(after)-Number(before)-.16)<1e-9);
 assert.equal((await db.query("select * from production_batches where status='reversed' and replaced_by_id is not null")).rows.length,1);
 await assert.rejects(()=>call('replace_production_day',[...args.slice(0,-1),randomUUID()]),/VERSION_CONFLICT/);
 const fresh=await workspace('2026-11-17');
 await assert.rejects(()=>call('replace_production_day',[warehouse,'2026-11-17',fresh.production_version,args[3],args[4],args[5],[{product_id:product,recipe_version_id:version,main_quantity:'9999999',extra_quantity:'0',rejected_quantity:'0'}],'Synthetic failed correction',randomUUID()]),/INSUFFICIENT_STOCK/);
 assert.equal(Number(((await workspace('2026-11-17')).materials as Row[])[0].quantity),.36);
 const store=randomUUID();await db.query("insert into stores(id,code,name) values($1,'PM-STORE','Synthetic store')",[store]);
 const shipped=await db.query<{id:string}>("insert into deliveries(store_id,delivery_date,status) values($1,'2026-11-17','posted') returning id",[store]);await db.query('insert into delivery_items(delivery_id,product_id,quantity) values($1,$2,100)',[shipped.rows[0].id,product]);
 const guarded=await workspace('2026-11-17');
 await assert.rejects(()=>call('replace_production_day',[warehouse,'2026-11-17',guarded.production_version,args[3],args[4],'2026-11-25',args[6],'Synthetic linked correction rejected',randomUUID()]),/CORRECTED_PRODUCTION_BELOW_DELIVERED/);
});
test('KH-09/10 period locks, scoped reads/RLS and revoked live permissions protect all new documents',async()=>{
 await assert.rejects(()=>workspace('2026-11-17',undefined,'actual',identities.accountant),/FORBIDDEN/);
 await assert.rejects(()=>call('save_production_plan',[warehouse,'2026-11-19',null,'append',[],'Synthetic forbidden',randomUUID()],identities.accountant),/FORBIDDEN/);
 await assert.rejects(()=>asUser(db,identities.accountant,()=>db.exec('select * from material_usage_checks')),/permission denied/);
 await db.exec("insert into accounting_periods(starts_on,ends_on,status) values('2026-11-01','2026-11-30','closed')");
 await assert.rejects(()=>usage('2026-11-19',null,'9'),/PERIOD_CLOSED/);
 await assert.rejects(()=>call('freeze_consumption_report',[warehouse,'2026-11-17','2026-11-18',randomUUID()]),/PERIOD_CLOSED/);
 await assert.rejects(()=>workspace('2026-11-20','2026-11-19'),/INVALID_PERIOD/);
});
test('DEV028 forward package is atomic, preserves existing data and rejects replay',async()=>{
 const local=await database('202611170027_recipe_catalog.sql');
 try{
  const migration=await fs.readFile('../supabase/migrations/202611180028_production_materials.sql','utf8'),sql=buildProductionMaterialsUpdate(migration);
  const profiles=(await local.query('select * from profiles order by id')).rows;
  const failing=buildProductionMaterialsUpdate(migration.replace(/commit;\s*$/,'select 1/0;commit;'));
  await assert.rejects(()=>local.exec(failing),/division by zero/);
  assert.equal((await local.query<{t:string|null}>("select to_regclass('public.production_plan_revisions')::text t")).rows[0].t,null);
  await local.exec(sql);await assert.rejects(()=>local.exec(sql),/PATCH_028_ALREADY_PRESENT/);
  assert.deepEqual((await local.query('select * from profiles order by id')).rows,profiles);
 }finally{await local.close();}
});

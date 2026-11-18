import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
import {buildPlanningFlowUpdate} from '../lib/deploy/planning-flow-update';
let db:PGlite,recipe:string;const warehouse=randomUUID(),rice=randomUUID(),sausage=randomUUID(),wrapper=randomUUID(),product=randomUUID(),missing=randomUUID(),kg=randomUUID(),each=randomUUID();
type R=Record<string,unknown>;type Preview={plan_id:string|null;complete:boolean;products:{quantity:string}[];materials:{material_id:string;quantity:string;shortage:string|null}[];sources:R[]};
const rpc=async<T=R>(name:string,args:unknown[],user=identities.admin)=>(await asUser(db,user,()=>db.query<{r:T}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args))).rows[0].r;
const lines=(quantity:string)=>[{product_id:product,quantity}];
const preview=(date:string,quantity:string,previous:string|null=null,mode='replace')=>rpc<Preview>('production_plan_requirements',[warehouse,date,previous,mode,lines(quantity)]);
const version=async()=>(await db.query<{v:string}>("select coalesce((select version::text from data_versions where module='inventory'),'0') v")).rows[0].v;
before(async()=>{
 db=await database();await db.query("insert into material_units(id,code,name,dimension) values($1,'kg','kg','mass'),($2,'each','each','count')",[kg,each]);await db.query("insert into warehouses(id,code,name,kind) values($1,'FLOW-W','Synthetic shared warehouse','ingredient')",[warehouse]);
 await db.query("insert into materials(id,code,name,usage_unit_id,purchase_unit_id) values($1,'FLOW-R','Synthetic rice',$4,$4),($2,'FLOW-S','Synthetic sausage',$4,$4),($3,'FLOW-B','Synthetic wrapper',$5,$5)",[rice,sausage,wrapper,kg,each]);await db.query("insert into products(id,code,name,sale_unit) values($1,'FLOW-P','Synthetic planned meal','portion'),($2,'FLOW-M','Synthetic missing recipe','portion')",[product,missing]);
 const child=await rpc('save_recipe',[{code:'FLOW-CH',name:'Synthetic cooked rice',kind:'rice',effective_from:'2020-01-01',output_quantity:'1',output_unit_id:kg},[{material_id:rice,quantity:'0.5',unit_id:kg}],randomUUID()]);await rpc('publish_recipe',[child.version_id,'1',null,'1',randomUUID()]);
 const meal=await rpc('save_recipe',[{code:'FLOW-MEAL',name:'Synthetic meal recipe',kind:'product',effective_from:'2020-01-01',output_quantity:'1',output_unit_id:each},[{child_version_id:child.version_id,quantity:'0.1',unit_id:kg},{material_id:sausage,quantity:'0.01',unit_id:kg},{material_id:wrapper,quantity:'1',unit_id:each}],randomUUID()]);recipe=meal.version_id as string;await rpc('publish_recipe',[recipe,'1',product,'1',randomUUID()]);
 await rpc('post_inventory',[warehouse,'2026-11-01','receipt',[{material_id:rice,unit_id:kg,quantity:'10'},{material_id:sausage,unit_id:kg,quantity:'10'},{material_id:wrapper,unit_id:each,quantity:'1000'}],'Synthetic opening evidence',randomUUID()]);
});after(async()=>{await db?.close();});
test('KH-01 plan100 expands nested recipe and packaging without stock write; append30/replace90 match saved plan exactly',async()=>{
 const before=(await db.query('select * from inventory_movement_lines order by id')).rows;
 const p=await preview('2026-11-19','100');assert.equal(p.complete,true);assert.equal(Number(p.materials.find(m=>m.material_id===rice)?.quantity),5);assert.equal(Number(p.materials.find(m=>m.material_id===sausage)?.quantity),1);assert.equal(Number(p.materials.find(m=>m.material_id===wrapper)?.quantity),100);
 assert.deepEqual((await db.query('select * from inventory_movement_lines order by id')).rows,before);assert.equal((await db.query('select * from production_plan_revisions')).rows.length,0);
 const saved=await rpc('save_production_plan',[warehouse,'2026-11-19',null,'replace',lines('100'),'Synthetic plan100',randomUUID()]);
 const appended=await preview('2026-11-19','30',saved.id as string,'append');assert.equal(Number(appended.materials.find(m=>m.material_id===rice)?.quantity),6.5);
 const replaced=await preview('2026-11-19','90',saved.id as string);assert.equal(Number(replaced.materials.find(m=>m.material_id===rice)?.quantity),4.5);
 await assert.rejects(()=>preview('2026-11-19','100'),/VERSION_CONFLICT/);assert.deepEqual((await db.query('select * from inventory_movement_lines order by id')).rows,before);
});
test('KH-01 missing recipe stays incomplete and missing stock stays null, preview respects live permissions',async()=>{
 const p=await rpc<Preview>('production_plan_requirements',[warehouse,'2026-11-20',null,'replace',[{product_id:missing,quantity:'100'}]]);assert.equal(p.complete,false);assert.equal(p.materials.length,0);assert.ok(p.sources.some(s=>s.issue==='PUBLISHED_PRODUCT_RECIPE_REQUIRED'));
 await assert.rejects(()=>rpc('production_plan_requirements',[warehouse,'2026-11-20',null,'replace',lines('100')],identities.a),/FORBIDDEN/);
});
test('KH-01/03 one shared stock count feeds reconciliation; planning does not issue, actual production does once',async()=>{
 const opening=await rpc('post_stock_count',[warehouse,'2026-11-20',[{material_id:rice,counted_quantity:'10'}],await version(),randomUUID()]);await rpc('certify_stock_count',[opening.count_id,'2',null,'2026-11-20T23:00:00+07:00','Synthetic end of day',randomUUID()]);
 const runKey=randomUUID(),runArgs=[warehouse,'2026-11-21','2026-11-20T23:30:00+07:00','2026-11-21T06:00:00+07:00','2026-11-21',[{product_id:product,recipe_version_id:recipe,main_quantity:'100',extra_quantity:'0',rejected_quantity:'0'}],'Synthetic real production',runKey];await rpc('post_production_run',runArgs);await rpc('post_production_run',runArgs);
 const closing=await rpc('post_stock_count',[warehouse,'2026-11-21',[{material_id:rice,counted_quantity:'4'}],await version(),randomUUID()]);await rpc('certify_stock_count',[closing.count_id,'2',null,'2026-11-21T23:00:00+07:00','Synthetic end of day',randomUUID()]);
 const evidence=await rpc<{version:string;complete:boolean;opening_count:{id:string};closing_count:{id:string};values:{opening:string;closing:string};counts:{id:string}[]}>('material_usage_evidence',[warehouse,'2026-11-21',rice]);assert.equal(evidence.complete,true);assert.equal(evidence.opening_count.id,opening.count_id);assert.equal(evidence.closing_count.id,closing.count_id);assert.equal(evidence.counts.length,2);
 await rpc('save_material_usage_from_evidence',[warehouse,'2026-11-21',rice,null,evidence.version,'Synthetic shared stock evidence',randomUUID()]);
 const result=await rpc<{materials:{material_id:string;quantity:string;actual:string;difference:string}[]}>('production_material_workspace',[warehouse,'2026-11-21','2026-11-21','actual']);const row=result.materials.find(m=>m.material_id===rice)!;assert.equal(Number(row.quantity),5);assert.equal(Number(row.actual),6);assert.equal(Number(row.difference),1);
 assert.equal((await db.query('select * from stock_counts')).rows.length,2);
});
test('031 forward package preserves records, adds read-only preview and rejects replay',async()=>{
 const prior=await database('202611180030_inventory_workspace.sql');try{const sql=buildPlanningFlowUpdate(await fs.readFile('../supabase/migrations/202611180031_plan_requirement_preview.sql','utf8'));await prior.exec(sql);await assert.rejects(()=>prior.exec(sql),/PATCH_031_ALREADY_PRESENT/);await prior.exec('rollback');assert.equal((await prior.query<{ready:boolean}>("select to_regprocedure('public.production_plan_requirements(uuid,date,uuid,text,jsonb)') is not null ready")).rows[0].ready,true);}finally{await prior.close();}
});

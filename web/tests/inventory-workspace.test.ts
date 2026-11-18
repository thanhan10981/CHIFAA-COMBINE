import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
import {buildInventoryUpdate} from '../lib/deploy/inventory-update';
let db:PGlite;const kg=randomUUID(),warehouse=randomUUID(),other=randomUUID(),mat=randomUUID(),zero=randomUUID(),missing=randomUUID(),product=randomUUID();
type Row={id:string;quantity:string|null;needed:string|null;suggested:string|null;status:string};
const rpc=async<T=Record<string,unknown>>(name:string,args:unknown[],user=identities.admin)=>(await asUser(db,user,()=>db.query<{r:T}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args))).rows[0].r;
const read=(scope=warehouse,status='all',search='')=>rpc<{rows:Row[];total:number;needs_complete:boolean}>('inventory_workspace',[scope,'2026-11-18','2026-11-19',search,'',status,0]);
before(async()=>{db=await database();await db.query("insert into material_units(id,code,name,dimension) values($1,'kg','kg','mass')",[kg]);await db.query("insert into warehouses(id,code,name,kind) values($1,'INV-W','Synthetic inventory warehouse','ingredient'),($2,'INV-W2','Synthetic other warehouse','ingredient')",[warehouse,other]);await db.query("insert into materials(id,code,name,usage_unit_id,minimum_quantity) values($1,'INV-M','Synthetic stock material',$4,3),($2,'INV-Z','Synthetic zero material',$4,0),($3,'INV-N','Synthetic missing unit',null,null)",[mat,zero,missing,kg]);});
after(async()=>{await db?.close();});
test('KH-01 catalogue materials are visible before receipts, scope stays per warehouse, unknown differs from confirmed zero',async()=>{
 let page=await read();assert.equal(page.total,3);assert.ok(page.rows.every(r=>r.quantity===null));assert.equal(page.rows.find(r=>r.id===missing)?.status,'unit_missing');
 const version=(await db.query<{v:string}>("select coalesce((select version::text from data_versions where module='inventory'),'0') v")).rows[0].v;
 await rpc('post_stock_count',[warehouse,'2026-11-17',[{material_id:zero,counted_quantity:'0'}],version,randomUUID()]);
 page=await read();assert.equal(Number(page.rows.find(r=>r.id===zero)?.quantity),0);assert.equal(page.rows.find(r=>r.id===mat)?.quantity,null);
 const snapshot=await rpc<{rows:{id:string;quantity:string|null}[]}>('stock_count_snapshot',[warehouse,'2026-11-18','',0]);assert.equal(Number(snapshot.rows.find(r=>r.id===zero)?.quantity),0);
 const balance=await asUser(db,identities.admin,()=>db.query<{quantity:string|null}>('select quantity from inventory_balance($1,$2) where material_id=$3',[warehouse,'2026-11-18',zero]));assert.equal(Number(balance.rows[0].quantity),0);
 const zeroHistory=await rpc<{kind:string;quantity:string}[]>('inventory_history',[warehouse,'2026-11-18',zero,0]);assert.equal(zeroHistory[0].kind,'count');assert.equal(Number(zeroHistory[0].quantity),0);
 assert.ok((await read(other)).rows.every(r=>r.quantity===null));assert.equal(page.needs_complete,false);assert.equal(page.rows.find(r=>r.id===zero)?.suggested,null);
});
test('new catalogue entries appear without warehouse membership rows and pages never truncate the catalogue',async()=>{
 await db.query("insert into materials(code,name,usage_unit_id) select 'PAGE-'||i,'Synthetic paged material '||i,$1 from generate_series(1,55) i",[kg]);
 const first=await rpc<{rows:Row[];total:number}>('inventory_workspace',[warehouse,'2026-11-18','2026-11-19','PAGE-','','all',0]);
 const second=await rpc<{rows:Row[];total:number}>('inventory_workspace',[warehouse,'2026-11-18','2026-11-19','PAGE-','','all',50]);
 assert.equal(first.total,55);assert.equal(first.rows.length,50);assert.equal(second.rows.length,5);assert.equal(new Set([...first.rows,...second.rows].map(r=>r.id)).size,55);assert.ok(first.rows.every(r=>r.quantity===null));
});
test('KH-09 receipts add once under retry, issues reject negative closing, history retains source and count',async()=>{
 const key=randomUUID(),args=[warehouse,'2026-11-18','receipt',[{material_id:mat,unit_id:kg,quantity:'10'}],'Synthetic receipt evidence',key];await rpc('post_inventory',args);await rpc('post_inventory',args);
 await rpc('post_inventory',[warehouse,'2026-11-18','receipt',[{material_id:mat,unit_id:kg,quantity:'2.5'}],'Synthetic additional receipt',randomUUID()]);await rpc('post_inventory',[warehouse,'2026-11-18','issue',[{material_id:mat,unit_id:kg,quantity:'-1'}],'Synthetic outside production issue',randomUUID()]);
 assert.equal(Number((await read()).rows.find(r=>r.id===mat)?.quantity),11.5);
 await assert.rejects(()=>rpc('post_inventory',[warehouse,'2026-11-18','issue',[{material_id:mat,unit_id:kg,quantity:'-12'}],'Synthetic overdraw',randomUUID()]),/INSUFFICIENT_STOCK/);
 const history=await rpc<{quantity:string;note:string;created_by:string}[]>('inventory_history',[warehouse,'2026-11-18',mat,0]);assert.equal(history.length,3);assert.ok(history.every(r=>r.created_by===identities.admin));assert.ok(history.some(r=>r.quantity==='-1.000000'));
});
test('KH-01 proposal uses same-unit planned demand and minimum, retains null minima, filters and permissions',async()=>{
 await db.query("insert into products(id,code,name,sale_unit) values($1,'INV-P','Synthetic inventory product','portion')",[product]);
 await db.query("insert into production_plan_revisions(warehouse_id,business_date,lines,needs,reason) values($1,'2026-11-19','[]',$2,'Synthetic verified plan')",[warehouse,JSON.stringify([{material_id:mat,unit_id:kg,quantity:'12',product_id:product}])]);
 const page=await read();assert.equal(page.needs_complete,true);assert.equal(Number(page.rows.find(r=>r.id===mat)?.needed),12);assert.equal(Number(page.rows.find(r=>r.id===mat)?.suggested),3.5);assert.equal((await read(warehouse,'attention','INV-M')).total,1);
 await assert.rejects(()=>read(warehouse,'invalid'),/INVALID_FILTER/);await assert.rejects(()=>rpc('inventory_workspace',[warehouse,'2026-11-18','2026-11-19','','','all',0],identities.a),/FORBIDDEN/);
 await db.query("insert into production_plan_revisions(warehouse_id,business_date,lines,needs,reason) values($1,'2026-11-19','[]',$2,'Synthetic incomplete plan')",[other,JSON.stringify([{product_id:product,issue:'PUBLISHED_PRODUCT_RECIPE_REQUIRED'}])]);assert.equal((await read(other)).needs_complete,false);
});
test('030 forward package applies atomically from 029, preserves business rows and refuses replay',async()=>{
 const prior=await database('202611180029_production_reconciliation.sql');try{await prior.query("insert into material_units(code,name,dimension) values('pkg-kg','Synthetic package kg','mass')");const sql=buildInventoryUpdate(await fs.readFile('../supabase/migrations/202611180030_inventory_workspace.sql','utf8'));await prior.exec(sql);assert.equal((await prior.query("select * from material_units where code='pkg-kg'")).rows.length,1);await assert.rejects(()=>prior.exec(sql),/PATCH_030_ALREADY_PRESENT/);await prior.exec('rollback');assert.equal((await prior.query("select * from material_units where code='pkg-kg'")).rows.length,1);}finally{await prior.close();}
});

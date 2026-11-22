import test from 'node:test';
import assert from 'node:assert/strict';
import {asUser,database,identities} from './database-fixture';

test('material catalog sorts the full filtered set by name and creation date before paging',async()=>{
 const db=await database();
 try{
  const unit=(await db.query<{id:string}>("select id from material_units where code='kg' limit 1")).rows[0]?.id??null;
  await db.query(`insert into materials(code,name,category,purchase_unit_id,usage_unit_id,created_at) values
   ('SORT-A','Zulu','ingredient',$1,$1,'2026-11-20T00:00:00Z'),
   ('SORT-B','Bravo','ingredient',$1,$1,'2026-11-10T00:00:00Z'),
   ('SORT-C','Alpha','ingredient',$1,$1,'2026-11-30T00:00:00Z'),
   ('SORT-D','Mike','ingredient',$1,$1,'2026-11-15T00:00:00Z')`,[unit]);
  const page=async(sort:string,offset:number,limit:number)=>asUser(db,identities.admin,()=>db.query<{catalog:{rows:{code:string;created_at?:string}[]}}>(
   'select material_catalog_sorted($1,$2,$3,$4,$5,$6) catalog',['2026-11-22','','',sort,offset,limit]));
  const codes=async(sort:string,offset=0,limit=100)=>(await page(sort,offset,limit)).rows[0].catalog.rows.map(row=>row.code);
  assert.deepEqual(await codes('default'),['SORT-A','SORT-B','SORT-C','SORT-D']);
  assert.deepEqual(await codes('name_asc'),['SORT-C','SORT-B','SORT-D','SORT-A']);
  assert.deepEqual(await codes('name_desc'),['SORT-A','SORT-D','SORT-B','SORT-C']);
  assert.deepEqual(await codes('newest',0,2),['SORT-C','SORT-A']);
  assert.deepEqual(await codes('newest',2,2),['SORT-D','SORT-B']);
  assert.deepEqual(await codes('oldest'),['SORT-B','SORT-D','SORT-A','SORT-C']);
  const filtered=await asUser(db,identities.admin,()=>db.query<{catalog:{rows:{code:string}[];total:string}}>(
   'select material_catalog_sorted($1,$2,$3,$4,$5,$6) catalog',['2026-11-22','i','ingredient','name_asc',0,100]));
  assert.deepEqual(filtered.rows[0].catalog.rows.map(row=>row.code),['SORT-D']);
  assert.equal(filtered.rows[0].catalog.total,'1');
  assert.ok(filtered.rows[0].catalog.rows.every(row=>!('created_at' in row)));
  await assert.rejects(()=>asUser(db,identities.admin,()=>db.query(
   'select material_catalog_sorted($1,$2,$3,$4,$5,$6)',['2026-11-22','','','unknown',0,10])),/INVALID_FILTER/);
  await assert.rejects(()=>asUser(db,identities.a,()=>db.query(
   'select material_catalog_sorted($1,$2,$3,$4,$5,$6)',['2026-11-22','','','name_asc',0,10])),/FORBIDDEN/);
 }finally{await db.close();}
});

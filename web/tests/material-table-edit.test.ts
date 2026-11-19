import test from 'node:test';
import assert from 'node:assert/strict';
import {database,asUser,identities} from './database-fixture';
import {buildMaterialImport} from '../lib/deploy/material-import';
import {materialMissingFields} from '../features/catalog/material-table';
import {ensurePriceBasis,type MaterialRow} from '../features/catalog/material-types';
import {readFile} from 'node:fs/promises';
import {buildMaterialTableUpdate} from '../lib/deploy/material-table-update';

test('DEV034 forward package installs after033 and rejects replay',async()=>{
 const db=await database('202611180033_entry_compact_actions.sql');try{
  assert.equal((await db.query<{rpc:string|null}>("select to_regprocedure('public.save_material_table(uuid,bigint,jsonb,uuid)') rpc")).rows[0].rpc,null);
  const sql=buildMaterialTableUpdate(await readFile('../supabase/migrations/202611180034_material_table_edit.sql','utf8'));
  await db.exec(sql);
  assert.notEqual((await db.query<{rpc:string|null}>("select to_regprocedure('public.save_material_table(uuid,bigint,jsonb,uuid)') rpc")).rows[0].rpc,null);
  await assert.rejects(()=>db.exec(sql),/PATCH_034_ALREADY_PRESENT/);
 }finally{await db.close();}
});

test('catalog column edit appends same-day prices atomically, retains history/units and replays once',async()=>{
 const db=await database();try{
  await db.exec(buildMaterialImport([{position:1,code:'TABLE-M',name:'Original',category:'ingredient',unit:'kg',amount:'16000',minimum:'0',reference:null,specification:'1 kg = 1000 g'}],'d'.repeat(64),'2026-11-17'));
  const m=(await db.query<{id:string;version:string;purchase_unit_id:string;usage_unit_id:string}>('select * from materials')).rows[0];
  const input={code:'TABLE-M',name:'Edited',category:'ingredient',purchase_unit_id:m.purchase_unit_id,basis_unit_id:m.purchase_unit_id,price_amount:'17000',minimum_quantity:'0',specification:'Edited specification'};
  const key=crypto.randomUUID(),run=(version:string|null,payload:typeof input,k=crypto.randomUUID(),user=identities.admin)=>asUser(db,user,()=>db.query<{r:{version:string}}>('select save_material_table($1,$2,$3,$4) r',[m.id,version,payload,k]));
  const saved=await run(m.version,input,key);assert.deepEqual(await run(m.version,input,key),saved);
  assert.equal((await db.query('select * from material_resolutions')).rows.length,1);
  assert.equal((await db.query<{amount:string}>('select amount::text from material_prices')).rows[0].amount,'16000.000000');
  assert.equal((await db.query<{usage_unit_id:string}>('select usage_unit_id from materials')).rows[0].usage_unit_id,m.usage_unit_id);
  await assert.rejects(()=>run(m.version,{...input,name:'Stale'}),/VERSION_CONFLICT/);
  const second=await run(saved.rows[0].r.version,{...input,price_amount:'18000'});
  assert.equal((await db.query('select * from material_resolutions')).rows.length,2);
  assert.ok((await db.query<{verification:string}>('select verification from material_resolutions')).rows.every(row=>row.verification==='needs_verification'));
  assert.equal((await db.query('select * from inventory_movements')).rows.length,0);
  // A failure in the second stage must roll back the metadata change as well.
  const future=(await db.query<{id:string}>('select id from material_resolutions order by revision desc limit 1')).rows[0].id;
  await db.exec('alter table material_resolutions disable trigger resolution_immutable');
  await db.query("update material_resolutions set effective_from='2099-01-01' where id=$1",[future]);
  await db.exec('alter table material_resolutions enable trigger resolution_immutable');
  await assert.rejects(()=>run(second.rows[0].r.version,{...input,name:'Must rollback',price_amount:'19000'}),/EFFECTIVE_DATE_BEFORE_LATEST_REVIEW/);
  assert.equal((await db.query<{name:string}>('select name from materials')).rows[0].name,'Edited');
  await db.query("insert into user_permissions values($1,'materials','edit',true)",[identities.a]);
  await assert.rejects(()=>run(second.rows[0].r.version,{...input,price_amount:'19000'},crypto.randomUUID(),identities.a),/FORBIDDEN_VERIFICATION/);
  await assert.rejects(()=>run(second.rows[0].r.version,{...input,price_amount:'NaN'}),/INVALID_PRICE/);
 }finally{await db.close();}
});

test('catalog metadata edit preserves verification, independent price basis, package conversions and nulls',async()=>{
 const db=await database();try{
  await db.exec(buildMaterialImport([{position:1,code:'PACK-M',name:'Package',category:'ingredient',unit:'kg',amount:'16000',minimum:null,reference:null,specification:'Package'}],'e'.repeat(64),'2026-11-17'));
  let m=(await db.query<{id:string;version:string;purchase_unit_id:string;usage_unit_id:string}>('select * from materials')).rows[0];
  const units=Object.fromEntries((await db.query<{id:string;code:string}>('select id,code from material_units')).rows.map(row=>[row.code,row.id]));
  const today=(await db.query<{date_value:string}>("select to_char(now() at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD') as date_value")).rows[0].date_value;
  await asUser(db,identities.admin,()=>db.query('select resolve_material($1,$2,$3,$4,$5)',[m.id,m.version,today,{purchase_unit_id:units.kg,usage_unit_id:units.g,basis_unit_id:units.kg,amount:'16000',verification:'verified',package_unit_id:units.kg,package_content_unit_id:units.g,package_quantity:'1000',package_verified:true,evidence:'Synthetic verified package'},crypto.randomUUID()]));
  m=(await db.query<typeof m>('select * from materials')).rows[0];
  const input={code:'PACK-M',name:'Metadata edit',category:'ingredient',purchase_unit_id:units.kg,basis_unit_id:units.kg,price_amount:'16000',minimum_quantity:null,specification:'Updated text'};
  await db.query("insert into user_permissions values($1,'materials','edit',true)",[identities.a]);
  const save=await asUser(db,identities.a,()=>db.query<{r:{version:string}}>('select save_material_table($1,$2,$3,$4) r',[m.id,m.version,input,crypto.randomUUID()]));
  assert.equal((await db.query('select * from material_resolutions')).rows.length,1);
  assert.equal((await db.query<{verification:string}>('select verification from material_resolutions')).rows[0].verification,'verified');
  await asUser(db,identities.admin,()=>db.query('select save_material_table($1,$2,$3,$4)',[m.id,save.rows[0].r.version,{...input,price_amount:null},crypto.randomUUID()]));
  const latest=(await db.query<{package_verified:boolean;amount:string|null}>('select * from material_resolutions order by revision desc limit 1')).rows[0];
  assert.equal(latest.package_verified,true);assert.equal(latest.amount,null);
  assert.match((await db.query<{q:string}>('select private.convert_quantity_at($1,$2,$3,1,$4)::text q',[m.id,units.kg,units.g,today])).rows[0].q,/^1000(?:\.0+)?$/);
  assert.equal((await db.query<{minimum_quantity:string|null}>('select minimum_quantity from materials')).rows[0].minimum_quantity,null);
 }finally{await db.close();}
});

test('catalog warnings describe empty columns only; zero and unverified filled values are not blank',()=>{
 const row={code:'M',name:'Material',category:'ingredient',purchase_unit_id:'kg',price_amount:'0',minimum_quantity:'0',stock_quantity:'0',stock_reference:null,specification:'1 kg',price_issue:'Review source',price_verification:'needs_verification'} as MaterialRow;
 assert.deepEqual(materialMissingFields(row),[]);
 assert.deepEqual(materialMissingFields({...row,price_amount:null,minimum_quantity:null,stock_quantity:null,specification:'  '}),['Đơn giá','Tồn tối thiểu','Tồn hiện tại','Quy cách']);
 assert.deepEqual(materialMissingFields({...row,stock_quantity:null,stock_reference:'0'}),['Tồn hiện tại']);
});
test('retrying a saved material verification draft fills a missing price basis from the purchase unit',()=>{
 const stale={purchase_unit_id:'bag-id',usage_unit_id:'piece-id',basis_unit_id:null,amount:'12000',verification:'verified'};
 assert.deepEqual(ensurePriceBasis(stale,'bag-id'),{...stale,basis_unit_id:'bag-id'});
 assert.deepEqual(ensurePriceBasis({...stale,basis_unit_id:'piece-id'},'bag-id'),{...stale,basis_unit_id:'piece-id'});
});

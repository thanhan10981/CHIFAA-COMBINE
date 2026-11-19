import test from 'node:test';
import assert from 'node:assert/strict';
import {database,asUser,identities} from './database-fixture';
import {buildMaterialImport,type MaterialImportRow} from '../lib/deploy/material-import';
import {formatVnd,formatVndCurrency,moneyInputValue,parseMoneyInput} from '../lib/format';
const hash='a'.repeat(64),day='2026-11-17';
const rows:MaterialImportRow[]=[{position:1,code:'TEST-A',name:'Vật tư kiểm tra',category:'ingredient',unit:'kg',amount:'16000',minimum:'0',reference:null,specification:'1 kg = 1.000 g'},{position:2,code:'ĐV',name:'Mã có dấu',category:'packaging',unit:'túi',amount:'0',minimum:null,reference:'1',specification:'Theo đơn vị danh mục'},{position:3,code:'DV',name:'Mã không dấu',category:'ingredient',unit:'kg',amount:null,minimum:'1.5',reference:null,specification:'1 kg = 1.000 g'}];

test('material source import preserves Unicode codes, zero/NULL, original identities and ledger; replay is a no-op',async()=>{
 const db=await database();try{
  const sql=buildMaterialImport(rows,hash,day);
  assert.doesNotMatch(sql,/create temporary table|chifaa_material_source/i);
  const standalone=sql.slice(sql.indexOf('do $import$'),sql.indexOf('end $import$;')+'end $import$;'.length);
  // SQL Editor/pool may execute statements separately. The import must stand alone.
  await db.exec(standalone);
  const before=(await db.query('select id,code from materials order by code')).rows;
  const audit=(await db.query('select count(*) n from audit_logs')).rows;
  await db.exec(buildMaterialImport(rows,hash,day));
  assert.deepEqual((await db.query('select id,code from materials order by code')).rows,before);
  assert.deepEqual((await db.query('select count(*) n from audit_logs')).rows,audit);
  assert.equal((await db.query('select * from inventory_movements')).rows.length,0);
  const result=await asUser(db,identities.admin,()=>db.query<{catalog:{metrics:unknown;rows:{code:string;price_amount:string|null;stock_quantity:string|null;stock_reference:string|null}[]}}>('select material_catalog($1) catalog',[day]));
  assert.deepEqual(result.rows[0].catalog.metrics,{total:3,kg:2,categories:2,unpriced:2});
  assert.equal(result.rows[0].catalog.rows.find(row=>row.code==='ĐV')?.price_amount,'0.000000');
  assert.equal(result.rows[0].catalog.rows.find(row=>row.code==='DV')?.price_amount,null);
  assert.equal(result.rows[0].catalog.rows.find(row=>row.code==='ĐV')?.stock_quantity,null);
 }finally{await db.close();}
});

test('material save atomically versions prices, rejects stale/null versions and preserves history on conflicting dates',async()=>{
 const db=await database();try{
  await db.exec(buildMaterialImport(rows,hash,day));
  const material=(await db.query<{id:string;version:string;purchase_unit_id:string;usage_unit_id:string}>('select * from materials where code=$1',['TEST-A'])).rows[0];
  const input={code:'TEST-A',name:'Tên mới',category:'ingredient',purchase_unit_id:material.purchase_unit_id,usage_unit_id:material.usage_unit_id,minimum_quantity:'0',source_unit_label:'kg',specification:'1 kg = 1.000 g'};
  const run=(version:string|null,date:string,amount:string,key=crypto.randomUUID())=>asUser(db,identities.admin,()=>db.query('select save_material($1,$2,$3,$4,$5)',[material.id,version,input,{amount,effective_from:date,verification:'verified',source_reference:'Báo giá đã được đối chiếu'},key]));
  await assert.rejects(()=>run(null,'2026-11-18','17000'),/VERSION_CONFLICT/);
  await assert.rejects(()=>run(material.version,day,'17000'),/PRICE_DATE_EXISTS/);
  assert.equal((await db.query<{name:string}>('select name from materials where id=$1',[material.id])).rows[0].name,'Vật tư kiểm tra');
  const key=crypto.randomUUID();await run(material.version,'2026-11-18','17000',key);await run(material.version,'2026-11-18','17000',key);
  assert.equal((await db.query('select * from material_prices where material_id=$1',[material.id])).rows.length,2);
  await assert.rejects(()=>run(material.version,'2026-11-19','18000'),/VERSION_CONFLICT/);
  const current=(await db.query<{version:string}>('select version from materials where id=$1',[material.id])).rows[0].version;
  await assert.rejects(()=>run(current,'2026-11-19','NaN'),/INVALID_PRICE/);
 }finally{await db.close();}
});

test('material table accepts a new item with a price and minimum in the selected purchase unit',async()=>{
 const db=await database();try{
  await db.exec(buildMaterialImport(rows,hash,day));
  const unit=(await db.query<{id:string}>("select id from material_units where code='kg'")).rows[0];
  assert.ok(unit,'Fixture requires the kg unit');
  const input={code:'TEST-NEW-BI',name:'Test danh muc vat tu',category:'ingredient',purchase_unit_id:unit.id,basis_unit_id:unit.id,minimum_quantity:'1',specification:'',price_amount:'11'};
  const result=await asUser(db,identities.admin,()=>db.query<{result:{id:string}}>('select save_material_table($1,$2,$3,$4) result',[null,null,input,crypto.randomUUID()]));
  const id=result.rows[0].result.id;
  const saved=(await db.query<{purchase_unit_id:string;usage_unit_id:string;amount:string;verification:string;basis_unit_id:string}>('select m.purchase_unit_id,m.usage_unit_id,r.amount::text,r.verification,r.basis_unit_id from materials m join material_resolutions r on r.material_id=m.id where m.id=$1',[id])).rows[0];
  assert.equal(saved.purchase_unit_id,unit.id);assert.equal(saved.usage_unit_id,unit.id);assert.equal(saved.amount,'11.000000');assert.equal(saved.basis_unit_id,unit.id);assert.equal(saved.verification,'needs_verification');
 }finally{await db.close();}
});

test('material API uses live permissions, hides ledger values without inventory scope, and failed imports roll back',async()=>{
 const db=await database();try{
  await db.exec(buildMaterialImport(rows,hash,day));
  await assert.rejects(()=>asUser(db,identities.a,()=>db.query('select material_catalog($1)',[day])),/FORBIDDEN/);
  await db.query("insert into user_permissions values($1,'materials','view',true)",[identities.a]);
  const result=await asUser(db,identities.a,()=>db.query<{catalog:{rows:{stock_quantity:string|null;stock_reference:string|null}[]}}>('select material_catalog($1) catalog',[day]));
  assert.ok(result.rows[0].catalog.rows.every(row=>row.stock_quantity===null&&row.stock_reference===null));
  const material=(await db.query<{id:string;version:string;purchase_unit_id:string}>('select * from materials where code=$1',['TEST-A'])).rows[0];
  const input={code:'TEST-A',name:'Material',category:'ingredient',purchase_unit_id:material.purchase_unit_id,usage_unit_id:material.purchase_unit_id};
  await db.query("insert into user_permissions values($1,'materials','edit',true)",[identities.a]);
  await assert.rejects(()=>asUser(db,identities.a,()=>db.query('select save_material($1,$2,$3,$4,$5)',[material.id,material.version,input,{amount:'100',verification:'verified',effective_from:day,source_reference:'Source document'},crypto.randomUUID()])),/FORBIDDEN_VERIFICATION/);
  const recipe=(await db.query<{id:string}>("insert into recipes(code,name,kind) values('TEST-R','Recipe','product') returning id")).rows[0].id;
  const version=(await db.query<{id:string}>("insert into recipe_versions(recipe_id,revision,effective_from,output_quantity,output_unit_id) values($1,1,$2,1,$3) returning id",[recipe,day,material.purchase_unit_id])).rows[0].id;
  await db.query('insert into recipe_items(recipe_version_id,material_id,quantity,unit_id) values($1,$2,1,$3)',[version,material.id,material.purchase_unit_id]);
  const grams=(await db.query<{id:string}>("select id from material_units where code='g'")).rows[0].id;
  await assert.rejects(()=>asUser(db,identities.admin,()=>db.query('select save_material($1,$2,$3,null,$4)',[material.id,material.version,{...input,usage_unit_id:grams},crypto.randomUUID()])),/UNIT_MIGRATION_REQUIRED/);
  await assert.rejects(()=>db.exec(buildMaterialImport(rows.map(row=>({...row,amount:'99999'})),'b'.repeat(64),day)),/EXISTING_PRICE_CONFLICT/);await db.exec('rollback');
  assert.equal((await db.query("select value from app_settings where key=$1",['material_import:'+'b'.repeat(64)])).rows.length,0);
  assert.equal((await db.query<{amount:string}>('select amount from material_prices p join materials m on m.id=p.material_id where m.code=$1',['TEST-A'])).rows[0].amount,'16000.000000');
 }finally{await db.close();}
});

test('Vietnamese money presentation remains exact for bigint/decimal amounts and preserves input values',()=>{
 assert.equal(formatVnd('9007199254740993'),'9.007.199.254.740.993');
 assert.equal(formatVnd('16000.000000'),'16.000');assert.equal(formatVnd('0'),'0');assert.equal(formatVnd(null),'—');
 assert.equal(formatVnd('16000.125000'),'16.000,125');assert.equal(formatVnd('-0.5'),'-0,5');
 assert.equal(formatVndCurrency('260000000.00000000006'),'260.000.000');
 assert.equal(formatVndCurrency('12.5'),'13');assert.equal(formatVndCurrency('-12.5'),'-13');
 assert.equal(moneyInputValue('260000.50'),'260.000,50');assert.equal(parseMoneyInput('260.000,50 đ'),'260000.50');
 assert.equal(parseMoneyInput(''),'');assert.equal(parseMoneyInput('1.000'),'1000');assert.equal(parseMoneyInput('-1'),null);
});

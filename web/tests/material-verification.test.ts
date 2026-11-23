import test from 'node:test';
import assert from 'node:assert/strict';
import {database,asUser,identities} from './database-fixture';
import {buildMaterialImport,type MaterialImportRow} from '../lib/deploy/material-import';
import {buildMaterialReconciliation,type ReconciledMaterial} from '../lib/deploy/material-reconciliation';
const day='2026-11-17';
const originals:MaterialImportRow[]=['TEST-MASS','TEST-EGG','TEST-LEAF','TEST-VOLUME'].map((code,index)=>({position:index+1,code,name:code,category:'ingredient',unit:'kg',amount:'100000',minimum:'1',reference:null,specification:'Original source'}));
const reconciled:ReconciledMaterial[]=originals.map((row,index)=>({...row,purchase:index===0?'chai':index===1?'vỉ':index===2?'túi':'can',usage:index===0?'g':index===1?'quả':index===2?'lá':'l',basis:index===0?'kg':index===1?'quả':null,verification:index===0?'verified':'needs_verification',packageUnit:index===0?'chai':index===1?'vỉ':index===2?'túi':'can',contentUnit:index===0?'g':index===1?'quả':index===2?'lá':'l',packageQuantity:index===0?'250':index===1?'30':index===2?'100':'5',packageVerified:index!==2,minimumInUsage:null,issue:index===0?'':'Unconfirmed source',original:{unit:'Original unit',price:'100000',conflict:'Retain source'}}));
async function setup(){const db=await database();await db.exec(buildMaterialImport(originals,'a'.repeat(64),day));await db.exec(buildMaterialReconciliation(reconciled,'c'.repeat(64),'2026-11-18'));return db;}
test('reconciliation separates price/purchase/usage, overrides unsafe legacy prices without erasing them, and replays safely',async()=>{
 const db=await setup();try{
  const rows=(await db.query<{code:string;unit:string;amount:string;verification:string}>("select m.code,u.code unit,p.amount::text,p.verification from materials m cross join lateral private.effective_material_price(m.id,'2026-11-18') p left join material_units u on u.id=p.basis_unit_id order by m.code")).rows;
  assert.equal(rows.find(r=>r.code==='TEST-MASS')?.unit,'kg');assert.equal(rows.find(r=>r.code==='TEST-EGG')?.verification,'needs_verification');assert.equal(rows.find(r=>r.code==='TEST-LEAF')?.unit,null);
  assert.equal((await db.query('select * from material_prices')).rows.length,4);
  const before=(await db.query('select id,code from materials order by code')).rows;
  const audit=(await db.query('select count(*) n from audit_logs')).rows;
  await db.exec(buildMaterialReconciliation(reconciled,'c'.repeat(64),'2026-11-18'));
  assert.deepEqual((await db.query('select id,code from materials order by code')).rows,before);assert.deepEqual((await db.query('select count(*) n from audit_logs')).rows,audit);
  assert.equal((await db.query('select * from inventory_movements')).rows.length,0);
  await assert.rejects(()=>db.query("update material_resolutions set amount=1"),/RESOLUTION_IMMUTABLE/);
  await assert.rejects(()=>db.query("update material_prices set amount=1"),/USE_MATERIAL_VERIFICATION/);
 }finally{await db.close();}
});
test('date-aware BOM only costs verified bases, retains unknowns and rejects unconfirmed packaging/density',async()=>{
 const db=await setup();try{
  const units=Object.fromEntries((await db.query<{id:string;code:string}>('select id,code from material_units')).rows.map(r=>[r.code,r.id]));
  const materials=Object.fromEntries((await db.query<{id:string;code:string}>('select id,code from materials')).rows.map(r=>[r.code,r.id]));
  const preview=await asUser(db,identities.admin,()=>db.query<{p:{usage_cost_vnd:string;purchase_cost_vnd:string;official_ready:boolean}}>('select material_cost_basis($1,$2) p',[materials['TEST-MASS'],'2026-11-18']));
  assert.equal(Number(preview.rows[0].p.usage_cost_vnd),100);assert.equal(Number(preview.rows[0].p.purchase_cost_vnd),25000);assert.equal(preview.rows[0].p.official_ready,true);
  const unknown=await asUser(db,identities.admin,()=>db.query<{p:{usage_cost_vnd:string|null;official_ready:boolean}}>('select material_cost_basis($1,$2) p',[materials['TEST-EGG'],'2026-11-18']));assert.equal(unknown.rows[0].p.usage_cost_vnd,null);assert.equal(unknown.rows[0].p.official_ready,false);
  assert.equal((await db.query<{q:string}>('select private.convert_quantity_at($1,$2,$3,1,$4)::text q',[materials['TEST-MASS'],units.chai,units.g,'2026-11-18'])).rows[0].q,'250.000000000');
  await assert.rejects(()=>db.query('select private.convert_quantity_at($1,$2,$3,1,$4)',[materials['TEST-LEAF'],units['túi'],units['lá'],'2026-11-18']),/UNIT_NEEDS_VERIFICATION/);
  await assert.rejects(()=>db.query('select private.convert_quantity_at($1,$2,$3,1,$4)',[materials['TEST-VOLUME'],units.can,units.kg,'2026-11-18']),/UNIT_NEEDS_VERIFICATION/);
  const recipe=(await db.query<{id:string}>("insert into recipes(code,name,kind) values('TEST','Test','product') returning id")).rows[0].id;
  const version=(await db.query<{id:string}>('insert into recipe_versions(recipe_id,revision,effective_from,output_quantity,output_unit_id) values($1,1,$2,1,$3) returning id',[recipe,day,units.g])).rows[0].id;
  await db.query('insert into recipe_items(recipe_version_id,material_id,quantity,unit_id) values($1,$2,100,$3)',[version,materials['TEST-MASS'],units.g]);
  const cost=await asUser(db,identities.admin,()=>db.query<{cost:{complete:boolean;total_vnd:string}}>('select recipe_cost($1,1,$2) cost',[version,'2026-11-18']));
  assert.equal(cost.rows[0].cost.total_vnd,'10000');assert.equal(cost.rows[0].cost.complete,true);
  await db.query('insert into recipe_items(recipe_version_id,material_id,quantity,unit_id) values($1,$2,1,$3)',[version,materials['TEST-EGG'],units['quả']]);
  const incomplete=await asUser(db,identities.admin,()=>db.query<{cost:{complete:boolean;total_vnd:string|null}}>('select recipe_cost($1,1,$2) cost',[version,'2026-11-18']));assert.equal(incomplete.rows[0].cost.complete,false);assert.equal(incomplete.rows[0].cost.total_vnd,null);
 }finally{await db.close();}
});
test('editing a verified conversion keeps its previous factor for earlier recipe dates',async()=>{
 const db=await setup();try{
  const material=(await db.query<{id:string;code:string}>('select id,code from materials where code=$1',['TEST-LEAF'])).rows[0];
  const units=Object.fromEntries((await db.query<{id:string;code:string}>('select id,code from material_units')).rows.map(row=>[row.code,row.id]));
  await asUser(db,identities.admin,()=>db.query('select save_catalog($1,null,null,$2,$3)',[
   'unit_conversions',{material_id:material.id,from_unit_id:units['túi'],to_unit_id:units['lá'],factor:80,verified:true,evidence:'Owner checked package label'},crypto.randomUUID()]));
  const conversion=(await db.query<{id:string;version:string}>('select id,version from unit_conversions where material_id=$1 and from_unit_id=$2 and to_unit_id=$3',[material.id,units['túi'],units['lá']])).rows[0];
  const historical=(await db.query<{factor:string}>('select private.convert_quantity_at($1,$2,$3,1,$4)::text factor',[material.id,units['túi'],units['lá'],'2026-11-19'])).rows[0];
  assert.equal(Number(historical.factor),80);
  await asUser(db,identities.admin,()=>db.query('select save_catalog($1,$2,$3,$4,$5)',[
   'unit_conversions',conversion.id,Number(conversion.version),{factor:90,verified:true,evidence:'Owner corrected package label'},crypto.randomUUID()]));
  const oldFactor=(await db.query<{factor:string}>('select private.convert_quantity_at($1,$2,$3,1,$4)::text factor',[material.id,units['túi'],units['lá'],'2026-11-19'])).rows[0];
  const currentDate=(await db.query<{d:string}>("select (now() at time zone 'Asia/Ho_Chi_Minh')::date::text d")).rows[0].d;
  const newFactor=(await db.query<{factor:string}>('select private.convert_quantity_at($1,$2,$3,1,$4)::text factor',[material.id,units['túi'],units['lá'],currentDate])).rows[0];
  assert.equal(Number(oldFactor.factor),80);assert.equal(Number(newFactor.factor),90);
  assert.equal((await db.query('select factor from private.material_unit_conversion_history where conversion_id=$1',[conversion.id])).rows.length,1);
 }finally{await db.close();}
});
test('historical materials can change stock units while receipts and recipe lines retain their original units',async()=>{
 const db=await database();try{
  const original:MaterialImportRow={position:1,code:'TEST-BAG-MASS',name:'TEST-BAG-MASS',category:'ingredient',unit:'kg',amount:'260000',minimum:null,reference:null,specification:'Owner confirmed package size'};
  await db.exec(buildMaterialImport([original],'b'.repeat(64),day));
  const resolved:ReconciledMaterial={...original,purchase:'túi',usage:'kg',basis:'túi',verification:'verified',packageUnit:'túi',contentUnit:'g',packageQuantity:'100',packageVerified:true,minimumInUsage:null,issue:'',original:{unit:'kg',price:'260000'}};
  await db.exec(buildMaterialReconciliation([resolved],'d'.repeat(64),'2026-11-18'));
  const units=Object.fromEntries((await db.query<{id:string;code:string}>('select id,code from material_units')).rows.map(row=>[row.code,row.id]));
  const material=(await db.query<{id:string;version:string;usage_unit_id:string}>("select id,version,usage_unit_id from materials where code='TEST-BAG-MASS'")).rows[0];
  const before=await asUser(db,identities.admin,()=>db.query<{cost:{usage_unit_id:string;usage_unit_locked:boolean}}>('select material_cost_basis($1,$2) cost',[material.id,'2026-11-19']));
  assert.equal(before.rows[0].cost.usage_unit_id,units.kg);assert.equal(before.rows[0].cost.usage_unit_locked,false);
  const warehouse=(await db.query<{id:string}>("insert into warehouses(code,name,kind) values('TEST-BAG-W','Test warehouse','ingredient') returning id")).rows[0].id;
  const movement=(await db.query<{id:string}>("insert into inventory_movements(warehouse_id,moved_on,kind) values($1,'2026-11-18','receipt') returning id",[warehouse])).rows[0].id;
  await db.query('insert into inventory_movement_lines(movement_id,material_id,unit_id,quantity,unit_cost) values($1,$2,$3,1,260000)',[movement,material.id,units.kg]);
  const recipe=(await db.query<{id:string}>("insert into recipes(code,name,kind) values('TEST-BAG-RECIPE','Test bag recipe','product') returning id")).rows[0].id;
  const recipeVersion=(await db.query<{id:string}>('insert into recipe_versions(recipe_id,revision,effective_from,output_quantity,output_unit_id) values($1,1,$2,1,$3) returning id',[recipe,day,units.g])).rows[0].id;
  await db.query('insert into recipe_items(recipe_version_id,material_id,quantity,unit_id) values($1,$2,1,$3)',[recipeVersion,material.id,units.kg]);
  const unlocked=await asUser(db,identities.admin,()=>db.query<{cost:{usage_unit_id:string;usage_unit_locked:boolean}}>('select material_cost_basis($1,$2) cost',[material.id,'2026-11-19']));
  assert.equal(unlocked.rows[0].cost.usage_unit_id,units.kg);assert.equal(unlocked.rows[0].cost.usage_unit_locked,false);
  await assert.rejects(()=>asUser(db,identities.a,()=>db.query('select material_cost_basis($1,$2)',[material.id,'2026-11-19'])),/FORBIDDEN/);
  const previous=(await db.query<Record<string,unknown>>('select purchase_unit_id,usage_unit_id,basis_unit_id,amount,verification,package_unit_id,package_content_unit_id,package_quantity,package_verified,issue,evidence from material_resolutions where material_id=$1 order by revision desc limit 1',[material.id])).rows[0];
  const save=(input:Record<string,unknown>,key:string)=>asUser(db,identities.admin,()=>db.query('select resolve_material($1,$2,$3,$4,$5)',[material.id,material.version,'2026-11-19',input,key]));
  await save({...previous,usage_unit_id:units.g,package_unit_id:units['túi'],package_content_unit_id:units.g,package_quantity:'100',package_verified:true},crypto.randomUUID());
  assert.equal((await db.query<{usage_unit_id:string}>('select usage_unit_id from materials where id=$1',[material.id])).rows[0].usage_unit_id,units.g);
  assert.equal(Number((await db.query<{q:string}>('select private.convert_quantity_at($1,$2,$3,1,$4)::text q',[material.id,units['túi'],units.kg,'2026-11-19'])).rows[0].q),0.1);
  assert.equal((await db.query('select * from inventory_movement_lines where material_id=$1',[material.id])).rows.length,1);
  assert.equal((await db.query('select * from recipe_items where material_id=$1',[material.id])).rows.length,1);
  const balance=await asUser(db,identities.admin,()=>db.query<{quantity:string}>('select quantity from inventory_balance($1,$2)',[warehouse,'2026-11-19']));
  assert.equal(Number(balance.rows[0].quantity),1000);
  const catalog=await asUser(db,identities.admin,()=>db.query<{result:{rows:{code:string;stock_quantity:string}[]}}>("select material_catalog_sorted('2026-11-19','','','default',0,100) result"));
  assert.equal(Number(catalog.rows[0].result.rows.find(row=>row.code==='TEST-BAG-MASS')?.stock_quantity),1000);
  const detail=await asUser(db,identities.admin,()=>db.query<{value:{lines:{quantity:string;unit:string;converted:string;stock_unit:string}[]}}>('select recipe_detail($1,$2) value',[recipeVersion,'2026-11-19']));
  assert.equal(detail.rows[0].value.lines[0].quantity,'1.000000');assert.equal(detail.rows[0].value.lines[0].unit,'kg');
  assert.equal(Number(detail.rows[0].value.lines[0].converted),1000);assert.equal(detail.rows[0].value.lines[0].stock_unit,'g');
 }finally{await db.close();}
});
test('Admin verification is versioned/idempotent, checks live authority and protects source/history and unit identities',async()=>{
 const db=await setup();try{
  const m=(await db.query<{id:string;version:string}>("select * from materials where code='TEST-EGG'")).rows[0];
  const r=(await db.query<Record<string,unknown>>('select * from material_resolutions where material_id=$1',[m.id])).rows[0];
  const input={purchase_unit_id:r.purchase_unit_id,usage_unit_id:r.usage_unit_id,basis_unit_id:r.basis_unit_id,amount:'1000',verification:'verified',package_unit_id:r.package_unit_id,package_content_unit_id:r.package_content_unit_id,package_quantity:r.package_quantity,package_verified:true,evidence:'Owner checked invoice',issue:''};
  const run=(id:string,version:string|null,key:string,changes={})=>asUser(db,id,()=>db.query('select resolve_material($1,$2,$3,$4,$5)',[m.id,version,'2026-11-18',{...input,...changes},key]));
  await db.query("insert into user_permissions values($1,'materials','approve',true)",[identities.a]);await assert.rejects(()=>run(identities.a,m.version,crypto.randomUUID()),/FORBIDDEN/);
  await assert.rejects(()=>run(identities.admin,null,crypto.randomUUID()),/VERSION_CONFLICT/);
  await assert.rejects(()=>run(identities.admin,m.version,crypto.randomUUID(),{amount:'NaN'}),/INVALID_PRICE/);
  const key=crypto.randomUUID();await run(identities.admin,m.version,key);await run(identities.admin,m.version,key);
  const revisions=(await db.query<{source_data:unknown}>('select source_data from material_resolutions where material_id=$1 order by revision',[m.id])).rows;
  assert.equal(revisions.length,2);assert.deepEqual(revisions[1].source_data,revisions[0].source_data);
  const before=(await db.query<{verification:string}>('select verification from private.effective_material_price($1,$2)',[m.id,day])).rows[0];assert.equal(before.verification,'verified');
  await assert.rejects(()=>run(identities.admin,m.version,crypto.randomUUID()),/VERSION_CONFLICT/);
 }finally{await db.close();}
});
test('Admin can confirm a zero-price material without entering evidence text',async()=>{
 const db=await setup();try{
  const m=(await db.query<{id:string;version:string}>("select * from materials where code='TEST-EGG'")).rows[0];
  const resolution=(await db.query<Record<string,unknown>>('select * from material_resolutions where material_id=$1',[m.id])).rows[0];
  const input={purchase_unit_id:resolution.purchase_unit_id,usage_unit_id:resolution.usage_unit_id,basis_unit_id:resolution.usage_unit_id,amount:'0',verification:'verified',package_unit_id:null,package_content_unit_id:null,package_quantity:null,package_verified:false,issue:''};
  await asUser(db,identities.admin,()=>db.query('select resolve_material($1,$2,$3,$4,$5)',[m.id,m.version,'2026-11-18',input,crypto.randomUUID()]));
  const saved=(await db.query<{amount:string;evidence:string}>('select amount::text,evidence from material_resolutions where material_id=$1 order by revision desc limit 1',[m.id])).rows[0];
  assert.equal(saved.amount,'0.000000');assert.equal(saved.evidence,'');
  const cost=(await asUser(db,identities.admin,()=>db.query<{cost:{usage_cost_vnd:string;official_ready:boolean}}>('select material_cost_basis($1,$2) cost',[m.id,'2026-11-18']))).rows[0].cost;
  assert.equal(Number(cost.usage_cost_vnd),0);assert.equal(cost.official_ready,true);
 }finally{await db.close();}
});
test('Admin verification defaults a missing price basis to the selected purchase unit',async()=>{
 const db=await setup();try{
  const m=(await db.query<{id:string;version:string}>("select * from materials where code='TEST-LEAF'")).rows[0];
  const resolution=(await db.query<Record<string,unknown>>('select * from material_resolutions where material_id=$1',[m.id])).rows[0];
  const purchase=resolution.purchase_unit_id as string;
  const input={purchase_unit_id:purchase,usage_unit_id:resolution.usage_unit_id,basis_unit_id:null,amount:'12000',verification:'verified',package_unit_id:null,package_content_unit_id:null,package_quantity:null,package_verified:false,issue:''};
  await asUser(db,identities.admin,()=>db.query('select resolve_material($1,$2,$3,$4,$5)',[m.id,m.version,'2026-11-18',input,crypto.randomUUID()]));
  const saved=(await db.query<{basis_unit_id:string;amount:string}>('select basis_unit_id,amount::text from material_resolutions where material_id=$1 order by revision desc limit 1',[m.id])).rows[0];
  assert.equal(saved.basis_unit_id,purchase);assert.equal(saved.amount,'12000.000000');
 }finally{await db.close();}
});
test('formula-only unit conversion lets recipes use pieces while inventory stays in bags',async()=>{
 const db=await setup();try{
  const bag=(await db.query<{id:string}>("insert into material_units(code,name,dimension) values('TEST-BAG','Bì','package') returning id")).rows[0].id;
  const piece=(await db.query<{id:string}>("insert into material_units(code,name,dimension) values('TEST-PIECE','Cái','count') returning id")).rows[0].id;
  const material=(await db.query<{id:string;version:string}>("insert into materials(code,name,purchase_unit_id,usage_unit_id) values('TEST-FORMULA-BAG','Đũa kiểm thử', $1,$1) returning id,version",[bag])).rows[0];

  await asUser(db,identities.admin,()=>db.query('select resolve_material($1,$2,$3,$4::jsonb,$5)',[
   material.id,material.version,'2026-11-18',JSON.stringify({purchase_unit_id:bag,usage_unit_id:bag,basis_unit_id:bag,amount:'12000',verification:'verified',package_unit_id:null,package_content_unit_id:null,package_quantity:null,package_verified:false,formula_unit_id:piece,formula_quantity:'100',issue:''}),crypto.randomUUID()
  ]));

  const materialUnits=await asUser(db,identities.admin,()=>db.query<{rows:{id:string;usage_unit_id:string;formula_unit_id:string;formula_quantity:string;formula_verified:boolean}[]}>('select recipe_material_units($1) rows',['2026-11-18']));
  const available=materialUnits.rows[0].rows.find(row=>row.id===material.id);
  assert.equal(available?.usage_unit_id,bag);assert.equal(available?.formula_unit_id,piece);assert.equal(available?.formula_quantity,'100.000000000');assert.equal(available?.formula_verified,true);
  const current=(await db.query<{version:string}>('select version from materials where id=$1',[material.id])).rows[0];
  await asUser(db,identities.admin,()=>db.query('select save_material_table($1,$2,$3,$4)',[material.id,current.version,{code:'TEST-FORMULA-BAG',name:'Đũa kiểm thử đã cập nhật',category:'ingredient',purchase_unit_id:bag,basis_unit_id:bag,price_amount:'12000',minimum_quantity:null,specification:'1 bì = 100 cái'},crypto.randomUUID()]));
  const retained=(await db.query<{formula_unit_id:string;formula_quantity:string;formula_verified:boolean}>('select formula_unit_id,formula_quantity::text,formula_verified from material_resolutions where material_id=$1 order by effective_from desc,revision desc limit 1',[material.id])).rows[0];
  assert.equal(retained.formula_unit_id,piece);assert.equal(retained.formula_quantity,'100.000000000');assert.equal(retained.formula_verified,true);
  assert.equal(Number((await db.query<{quantity:string}>('select private.recipe_convert_quantity_at($1,$2,$3,100,$4)::text quantity',[material.id,piece,bag,'2026-11-18'])).rows[0].quantity),1);
  assert.equal(Number((await db.query<{quantity:string}>('select private.recipe_convert_quantity_at($1,$2,$3,1,$4)::text quantity',[material.id,bag,piece,'2026-11-18'])).rows[0].quantity),100);
  await assert.rejects(()=>db.query('select private.convert_quantity_at($1,$2,$3,1,$4)',[material.id,bag,piece,'2026-11-18']),/UNIT_NEEDS_VERIFICATION/);

  const recipe=await asUser(db,identities.admin,()=>db.query<{result:{recipe_id:string;version_id:string}}>("select save_recipe_revision(null,null,$1::jsonb,$2::jsonb,'',$3) result",[
   JSON.stringify({code:'TEST-BAG-FORMULA',name:'Công thức dùng đũa',kind:'product',effective_from:'2026-11-18',output_quantity:'100',output_unit_id:piece}),
   JSON.stringify([{material_id:material.id,child_version_id:null,quantity:'100',unit_id:piece,cost_exempt:false}]),crypto.randomUUID()
  ]));
  const version=recipe.rows[0].result.version_id;
  const cost=await asUser(db,identities.admin,()=>db.query<{cost:{complete:boolean;total_vnd:string;lines:{quantity:string;unit:string;unit_cost_vnd:string;line_cost_vnd:string}[]}}>('select recipe_cost($1,100,$2) cost',[version,'2026-11-18']));
  assert.equal(cost.rows[0].cost.complete,true);assert.equal(cost.rows[0].cost.total_vnd,'12000');
  assert.equal(Number(cost.rows[0].cost.lines[0].quantity),1);assert.equal(cost.rows[0].cost.lines[0].unit,'TEST-BAG');
  const detail=await asUser(db,identities.admin,()=>db.query<{value:{lines:{quantity:string;unit:string;converted:string;stock_unit:string;unit_cost_vnd:string;line_cost_vnd:string}[]}}>('select recipe_detail($1,$2) value',[version,'2026-11-18']));
  assert.equal(detail.rows[0].value.lines[0].quantity,'100.000000');assert.equal(detail.rows[0].value.lines[0].unit,'TEST-PIECE');
  assert.equal(Number(detail.rows[0].value.lines[0].converted),1);assert.equal(detail.rows[0].value.lines[0].stock_unit,'TEST-BAG');
  assert.equal(Number(detail.rows[0].value.lines[0].unit_cost_vnd),120);assert.equal(detail.rows[0].value.lines[0].line_cost_vnd,'12000');

  const warehouse=(await db.query<{id:string}>("insert into warehouses(code,name,kind) values('TEST-FORMULA-W','Formula stock test','ingredient') returning id")).rows[0].id;
  await asUser(db,identities.admin,()=>db.query('select post_inventory($1,$2,$3,$4::jsonb,$5,$6)',[warehouse,'2026-11-18','receipt',JSON.stringify([{material_id:material.id,unit_id:bag,quantity:'2',unit_cost:'12000'}]),'Bag-only stock test',crypto.randomUUID()]));
  assert.equal((await db.query<{quantity:string}>('select private.inventory_quantity($1,$2,$3,$4)::text quantity',[warehouse,'2026-11-18',material.id,bag])).rows[0].quantity,'2.000000');
 }finally{await db.close();}
});
test('reconciliation preserves posted ledger costs and receipts keep their entered price separate from catalog prices',async()=>{
 const db=await database();try{
  await db.exec(buildMaterialImport(originals,'a'.repeat(64),day));
  const m=(await db.query<{id:string;usage_unit_id:string}>("select * from materials where code='TEST-EGG'")).rows[0];
  const w=(await db.query<{id:string}>("insert into warehouses(code,name,kind) values('TEST-W','Warehouse','ingredient') returning id")).rows[0].id;
  const movement=(await db.query<{id:string}>("insert into inventory_movements(warehouse_id,moved_on,kind) values($1,$2,'receipt') returning id",[w,day])).rows[0].id;
  await db.query('insert into inventory_movement_lines(movement_id,material_id,unit_id,quantity,unit_cost) values($1,$2,$3,2,999)',[movement,m.id,m.usage_unit_id]);
  await db.exec(buildMaterialReconciliation(reconciled,'c'.repeat(64),day));
  assert.equal((await db.query<{usage_unit_id:string}>('select usage_unit_id from materials where id=$1',[m.id])).rows[0].usage_unit_id,m.usage_unit_id);
  assert.equal((await db.query<{verification:string}>('select verification from private.effective_material_price($1,$2)',[m.id,day])).rows[0].verification,'needs_verification');
  await asUser(db,identities.admin,()=>db.query('select post_inventory($1,$2,$3,$4,$5,$6)',[w,day,'receipt',[{material_id:m.id,unit_id:m.usage_unit_id,quantity:'1',unit_cost:'999'}],'Test receipt',crypto.randomUUID()]));
  const costs=(await db.query<{unit_cost:string|null}>('select unit_cost from inventory_movement_lines where material_id=$1 order by created_at,id',[m.id])).rows;
  assert.equal(costs.length,2);assert.ok(costs.every(row=>Number(row.unit_cost)===999));
  const mass=(await db.query<{id:string;usage_unit_id:string}>("select id,usage_unit_id from materials where code='TEST-MASS'")).rows[0];
  await asUser(db,identities.admin,()=>db.query('select post_inventory($1,$2,$3,$4,$5,$6)',[w,day,'receipt',[{material_id:mass.id,unit_id:mass.usage_unit_id,quantity:'1',unit_cost:'999999'}],'Verified cost receipt',crypto.randomUUID()]));
  assert.equal(Number((await db.query<{unit_cost:string}>('select unit_cost from inventory_movement_lines where material_id=$1',[mass.id])).rows[0].unit_cost),999999);
 }finally{await db.close();}
});

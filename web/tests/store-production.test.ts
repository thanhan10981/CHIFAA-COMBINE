import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {database,asUser,identities} from './database-fixture';
import {storeProductionLines,storeProductionInputsAreZero,isValidFinishedGoodsQuantity} from '../features/operations/store-production-input';
import {storeProductionError,type FinishedStockCheck} from '../features/operations/store-production-errors';

test('store production requires explicit actual quantities and reports recipe and input errors separately',()=>{
 const items=[{product_id:'p',name:'Món thử'}],products=[{id:'p',name:'Món thử',code:'P',recipe_version_id:'v'}];
 assert.throws(()=>storeProductionLines(items,products),/Món thử: nhập sản xuất chính/);
 assert.throws(()=>storeProductionLines(items,products,{p:{main:'6',extra:'0',defect:''}}),/lỗi SX/);
 assert.throws(()=>storeProductionLines(items,[{...products[0],recipe_issue:'PRODUCT_RECIPE_RATIO_REQUIRED'}],{p:{main:'1',extra:'0',defect:'0'}}),/Thiếu tỷ lệ quy đổi/);
 assert.throws(()=>storeProductionLines(items,products,{p:{main:'6',extra:'0',defect:'7'}}),/không được vượt tổng/);
 assert.deepEqual(storeProductionLines(items,products,{p:{main:'6',extra:'0',defect:'0'}}),[{product_id:'p',recipe_version_id:'v',main_quantity:'6',extra_quantity:'0',rejected_quantity:'0'}]);
 const zero={p:{main:'0',extra:'0',defect:'0'}};
 assert.throws(()=>storeProductionLines(items,products,zero),/phải lớn hơn 0/,'ordinary production runs still require positive output');
 assert.deepEqual(storeProductionLines(items,[{...products[0],recipe_version_id:null}],zero,{allowZeroProduction:true}),[],'zero output skips the recipe and produces no batch line');
 assert.equal(storeProductionInputsAreZero(items,zero),true);
 assert.equal(storeProductionInputsAreZero(items),false,'blank inputs are not treated as zero');
 assert.deepEqual(storeProductionLines([{product_id:'p',name:'Món thử'},{product_id:'q',name:'Món khác'}],[products[0],{...products[0],id:'q'}],{...zero,q:{main:'2',extra:'0',defect:'0'}},{allowZeroProduction:true}),[{product_id:'q',recipe_version_id:'v',main_quantity:'2',extra_quantity:'0',rejected_quantity:'0'}],'zero rows are omitted from mixed production requests');
});

test('store production errors explain finished goods, raw materials and unavailable schema without inventing shortages',()=>{
 const product:FinishedStockCheck={product_id:'p',code:'CC',name:'Cơm cuộn',unit:'Hộp',required_quantity:'12',available_quantity:'7',shortage_quantity:'5'};
 const finished=storeProductionError({message:'INSUFFICIENT_FINISHED_GOODS',details:JSON.stringify({store_name:'Điểm thử',products:[product]})});
 for(const text of ['Điểm thử','CC · Cơm cuộn','cần 12 Hộp','tồn 7 Hộp','thiếu 5 Hộp'])assert.ok(finished.includes(text),text);
 const raw=storeProductionError({message:'INSUFFICIENT_STOCK',details:JSON.stringify({material_code:'GA',material_name:'Gà',unit_code:'kg',requested_quantity:'3',available_quantity:'1',shortage_quantity:'2'})});
 assert.match(raw,/GA · Gà/);assert.match(raw,/thiếu 2 kg/);
 assert.match(storeProductionError({code:'PGRST202',message:'Missing function'}),/cập nhật SQL/);
 assert.match(storeProductionError({message:'FORBIDDEN'}),/thiếu quyền/);
 assert.doesNotMatch(storeProductionError({message:'Failed to fetch'}),/thiếu thành phẩm/);
 assert.match(storeProductionError({message:'INSUFFICIENT_FINISHED_GOODS',details:'invalid json'}),/không đủ/);
});

test('finished goods stock correction accepts only nonnegative whole quantities',()=>{
 assert.equal(isValidFinishedGoodsQuantity('0'),true);
 assert.equal(isValidFinishedGoodsQuantity('76'),true);
 assert.equal(isValidFinishedGoodsQuantity('0.002'),false);
 assert.equal(isValidFinishedGoodsQuantity('-1'),false);
 assert.equal(isValidFinishedGoodsQuantity(''),false);
 assert.equal(isValidFinishedGoodsQuantity('100000000000000'),false);
 assert.match(storeProductionError({message:'new row violates check constraint "finished_goods_stock_adjustments_after_quantity_integer"'}),/số nguyên/);
});

test('store readiness diagnoses exact stock, rejects shared shortages atomically, keeps audit and never consumes stock',async()=>{
 const db=await database(),date='2095-04-12';
 const rpc=async<T=Record<string,unknown>>(name:string,args:unknown[])=>(await asUser(db,identities.admin,()=>db.query<{r:T}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args))).rows[0].r;
 try{
  const unit=(await db.query<{id:string}>("insert into material_units(code,name,dimension) values('READY-U','Synthetic portion','count') returning id")).rows[0].id;
  const warehouse=(await db.query<{id:string}>("insert into warehouses(code,name,kind) values('READY-W','Synthetic warehouse','ingredient') returning id")).rows[0].id;
  const material=(await db.query<{id:string}>("insert into materials(code,name,usage_unit_id,purchase_unit_id) values('READY-M','Synthetic raw material',$1,$1) returning id",[unit])).rows[0].id;
  const product=(await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values('READY-P','Synthetic dish','READY-U',true) returning id")).rows[0].id;
  const saved=await rpc('save_recipe',[{code:'READY-P',name:'Synthetic recipe',kind:'product',effective_from:date,output_quantity:'1',output_unit_id:unit},[{material_id:material,quantity:'1',unit_id:unit}],randomUUID()]);
  await rpc('publish_recipe',[saved.version_id,'1',null,null,randomUUID()]);
  await rpc('post_inventory',[warehouse,date,'receipt',[{material_id:material,unit_id:unit,quantity:'100'}],'Synthetic opening',randomUUID()]);
  const stores:string[]=[],orders:string[]=[];
  for(const [index,quantity] of ['6','8'].entries()){
   const store=(await db.query<{id:string}>("insert into stores(code,name) values($1,$2) returning id",['READY-S'+index,'Synthetic store '+index])).rows[0].id;stores.push(store);
   const order=(await db.query<{id:string}>("insert into customer_orders(store_id,customer_id,delivery_date,shift,status) values($1,$2,$3,'AM','approved') returning id",[store,identities.a,date])).rows[0].id;orders.push(order);
   await db.query('insert into customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate) values($1,$2,$3,15000,0)',[order,product,quantity]);
  }
  type Diagnostic={products:FinishedStockCheck[];stores:Record<string,FinishedStockCheck[]>};
  const snapshot=async()=>Promise.all(['production_batches','inventory_movements','store_production_readiness','audit_logs'].map(t=>db.query('select to_jsonb(x) r from '+t+' x order by to_jsonb(x)::text').then(r=>r.rows)));
  const before=await snapshot(),d=await rpc<Diagnostic>('store_production_diagnostics',[date]);
  assert.equal(Number(d.products[0].required_quantity),14);assert.equal(Number(d.stores[stores[0]][0].shortage_quantity),6);
  assert.deepEqual(await snapshot(),before,'diagnostics never write');
  await db.exec(await readFile('../supabase/migrations/202611270099_store_production_diagnostics.sql','utf8'));
  assert.deepEqual(await snapshot(),before,'migration replay keeps existing documents, stock and audit');
  await db.exec(await readFile('../supabase/migrations/202611270100_complete_store_production_for_delivery.sql','utf8'));
  await assert.rejects(()=>rpc('confirm_store_production_ready',[date,stores[0],'Synthetic readiness',randomUUID()]),(error:unknown)=>{
   const e=error as {message:string;detail:string};assert.match(e.message,/INSUFFICIENT_FINISHED_GOODS/);const detail=JSON.parse(e.detail);assert.equal(detail.store_name,'Synthetic store 0');assert.equal(detail.products[0].code,'READY-P');assert.equal(Number(detail.products[0].available_quantity),0);assert.equal(Number(detail.products[0].shortage_quantity),6);return true;
  });
  const lines=(quantity:string)=>[{product_id:product,recipe_version_id:saved.version_id,main_quantity:quantity,extra_quantity:'0',rejected_quantity:'0'}];
  const post=(quantity:string)=>rpc('post_store_production_run',[warehouse,date,date+'T00:00:00+07:00',date+'T07:00:00+07:00',date,lines(quantity),'Synthetic production',stores[0],[orders[0]],randomUUID()]);
  await assert.rejects(()=>post('101'),(error:unknown)=>{const e=error as {message:string;detail:string};assert.match(e.message,/INSUFFICIENT_STOCK/);assert.equal(JSON.parse(e.detail).material_code,'READY-M');return true;});
  assert.equal((await db.query('select * from production_batches')).rows.length,0,'failed raw stock posting rolls back');
  const beforeCombinedFailure=await snapshot();
  await assert.rejects(()=>rpc('complete_store_production_for_delivery',[warehouse,date,date,lines('4'),stores[0],[orders[0]],randomUUID()]),/INSUFFICIENT_FINISHED_GOODS/);
  assert.deepEqual(await snapshot(),beforeCombinedFailure,'failed readiness rolls the production batch, stock issue and audit back');
  const key=randomUUID(),complete=()=>rpc('complete_store_production_for_delivery',[warehouse,date,date,lines('10'),stores[0],[orders[0]],key]);
  const completed=await complete();assert.equal(completed.status,'ready');assert.deepEqual(await complete(),completed,'combined completion replays without another batch');
  assert.equal((await db.query("select * from production_batches where status='posted'")).rows.length,1,'production and readiness commit together');
  const afterSingle=await snapshot();
  await assert.rejects(()=>rpc('confirm_all_store_production_ready',[date,'Synthetic all readiness',randomUUID()]),(error:unknown)=>{const e=error as {message:string;detail:string};assert.match(e.message,/INSUFFICIENT_FINISHED_GOODS/);assert.equal(JSON.parse(e.detail).store_name,'tất cả điểm bán');assert.equal(Number(JSON.parse(e.detail).products[0].shortage_quantity),4);return true;});
  assert.deepEqual(await snapshot(),afterSingle,'bulk shortage has no partial writes');
  await post('4');
  const stockBefore=(await db.query('select * from inventory_movement_lines')).rows;
  const batchesBeforeReadiness=(await db.query('select * from production_batches')).rows;const bulkKey=randomUUID(),bulk=()=>rpc('confirm_all_store_production_ready',[date,'Synthetic all readiness',bulkKey]);const result=await bulk();assert.equal(result.stores_confirmed,1);assert.deepEqual(await bulk(),result);
  assert.deepEqual((await db.query('select * from production_batches')).rows,batchesBeforeReadiness,'readiness from sufficient finished stock creates no production batch');
  assert.deepEqual((await db.query('select * from inventory_movement_lines')).rows,stockBefore,'readiness never consumes raw materials');
  assert.equal(Number((await rpc<Diagnostic>('store_production_diagnostics',[date])).products[0].available_quantity),14,'readiness never consumes finished goods');
  assert.equal((await db.query("select * from audit_logs where action='STORE_PRODUCTION_READY'")).rows.length,2);
  const readiness=await rpc<Record<string,{status:string}>>('store_production_readiness',[date]);assert.equal(readiness[stores[0]].status,'ready');
  await db.query('update customer_order_items set quantity=7 where order_id=$1',[orders[0]]);
  const changed=await rpc<Record<string,unknown>>('store_production_readiness',[date]);assert.equal(changed[stores[0]],undefined,'changed items need approval again');assert.ok(changed[stores[1]]);
  assert.equal((await db.query('select * from store_production_readiness')).rows.length,2,'readiness history preserved');
  for(const [status,delivery,cancelled] of [['submitted',date,false],['approved','2095-04-13',false],['approved',date,true]] as const){
   const excluded=(await db.query<{id:string}>("insert into customer_orders(store_id,customer_id,delivery_date,shift,status) values($1,$2,$3,'PM',$4) returning id",[stores[0],identities.a,delivery,status])).rows[0].id;
   await db.query('insert into customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate,cancelled_at) values($1,$2,90,15000,0,$3)',[excluded,product,cancelled?date+'T00:00:00Z':null]);
  }
  assert.equal(Number((await rpc<Diagnostic>('store_production_diagnostics',[date])).products[0].required_quantity),15,'submitted, other-date and cancelled items excluded');
  await db.exec('begin;set local role anon;');await assert.rejects(()=>db.query('select public.store_production_diagnostics($1)',[date]),/permission denied/);await db.exec('rollback;');
  await assert.rejects(()=>asUser(db,identities.a,()=>db.query('select public.store_production_diagnostics($1)',[date])),/FORBIDDEN/);
  await assert.rejects(()=>asUser(db,identities.a,()=>db.query('select private.store_finished_goods_checks($1,null)',[date])),/permission denied/);
 }finally{await db.close();}
});

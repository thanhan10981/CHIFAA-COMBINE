import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
import {authTarget} from '../lib/auth/target';
import {publicOrderShift} from '../features/orders/public-order-shift';
import {readFile} from 'node:fs/promises';
import {buildPublicPortalUpdate} from '../lib/deploy/public-portal-update';
import {buildPublicOrderLinksUpdate} from '../lib/deploy/public-order-links-update';

test('public order shift follows Vietnam local time and changes at noon',()=>{
 assert.equal(publicOrderShift(new Date('2026-11-18T04:59:00.000Z')),'AM');
 assert.equal(publicOrderShift(new Date('2026-11-18T05:00:00.000Z')),'PM');
 assert.equal(publicOrderShift(new Date('2026-11-17T17:00:00.000Z')),'AM');
});

test('DEV035 package preserves existing authenticated orders and rejects replay',async()=>{
 const db=await database('202611180034_material_table_edit.sql');try{
  const store=(await db.query<{id:string}>("insert into stores(code,name) values('OLD-S','Existing store') returning id")).rows[0].id;
  await db.query("insert into customer_orders(store_id,customer_id,delivery_date,shift) values($1,$2,current_date,'AM')",[store,identities.a]);
  const sql=buildPublicPortalUpdate(await readFile('../supabase/migrations/202611180035_public_order_portal.sql','utf8'));await db.exec(sql);
  const order=(await db.query<{customer_id:string;store_id:string;guest_name:string|null}>('select * from customer_orders')).rows[0];
  assert.equal(order.customer_id,identities.a);assert.equal(order.store_id,store);assert.equal(order.guest_name,null);
  await assert.rejects(()=>db.exec(sql),/PATCH_035_ALREADY_PRESENT/);
 }finally{await db.close();}
});

test('DEV036 store links are private, idempotent, revocable and route orders to the selected store',async()=>{
 const db=await database('202611180035_public_order_portal.sql');try{
  const store=(await db.query<{id:string}>("insert into stores(code,name,active) values('LINK-STORE','Link target',true) returning id")).rows[0].id;
  const sql=buildPublicOrderLinksUpdate(await readFile('../supabase/migrations/202611180036_store_order_links.sql','utf8'));await db.exec(sql);
  const createKey=randomUUID(),create=()=>asUser(db,identities.admin,()=>db.query<{result:{link_id:string;token:string;store_id:string}}> ('select create_public_order_link($1,$2) result',[store,createKey]));
  const first=(await create()).rows[0].result;assert.deepEqual((await create()).rows[0].result,first);assert.equal(first.store_id,store);assert.match(first.token,/^[0-9a-f]{64}$/);
  assert.equal((await db.query<{token_hash:string}>('select token_hash from private.public_order_links')).rows[0].token_hash,createHash('sha256').update(first.token).digest('hex'));
  await assert.rejects(()=>anonymous(db,()=>db.query('select * from private.public_order_links')),/permission denied/);
  await assert.rejects(()=>anonymous(db,()=>db.query('select public_order_links()')),/permission denied/);
  await assert.rejects(()=>asUser(db,identities.a,()=>db.query('select create_public_order_link($1,$2)',[store,randomUUID()])),/FORBIDDEN/);
  const product=(await db.query<{id:string}> ("insert into products(code,name,sale_unit,published,archived) values('LINK-PRODUCT','Link product','Phần',true,false) returning id")).rows[0].id;
  await db.query("insert into product_prices(product_id,price_vnd,effective_from,evidence) values($1,15000,current_date-1,'Synthetic link price')",[product]);
  const day=(await db.query<{date_value:string}>("select to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date+1,'YYYY-MM-DD') date_value")).rows[0].date_value;
  const payload=[{product_id:product,quantity:'2',price_vnd:'15000'}],key=randomUUID(),submit=()=>anonymous(db,()=>db.query<{result:{order_id:string;status:string}}> ('select submit_store_link_order($1,$2,$3,$4,$5,$6,$7) result',[day,'AM',{name:'Link visitor',phone:'0900000036',address:'Link delivery address'},payload,'Store order',first.token,key]));
  const accepted=(await submit()).rows[0].result;assert.deepEqual((await submit()).rows[0].result,accepted);
  const order=(await db.query<{store_id:string|null;status:string}>('select store_id,status from customer_orders where id=$1',[accepted.order_id])).rows[0];assert.equal(order.store_id,store);assert.equal(order.status,'submitted');
  await asUser(db,identities.admin,()=>db.query('select revoke_public_order_link($1,$2)',[first.link_id,randomUUID()]));
  assert.deepEqual((await submit()).rows[0].result,accepted,'an uncertain submission remains safely replayable after link revocation');
  await assert.rejects(()=>anonymous(db,()=>db.query('select submit_store_link_order($1,$2,$3,$4,$5,$6,$7)',[day,'AM',{name:'Other visitor',phone:'0900000037',address:'Another delivery address'},payload,'Revoked link',first.token,randomUUID()])),/INVALID_LINK/);
  assert.equal((await db.query<{count:string}>("select count(*)::text count from customer_orders where status='submitted'")).rows[0].count,'1');
  assert.equal((await db.query<{revoked_at:string|null}>('select revoked_at from private.public_order_links where id=$1',[first.link_id])).rows[0].revoked_at!==null,true);
  await assert.rejects(()=>db.exec(sql),/PATCH_036_ALREADY_PRESENT/);
 }finally{await db.close();}
});

test('store-linked and review-assigned orders snapshot discounts and payment choice',async()=>{
 const db=await database();try{
  const store=(await db.query<{id:string}>("insert into stores(code,name,address,contact,active) values('PAY-STORE','Payment store','Synthetic store delivery address','0900000055',true) returning id")).rows[0].id;
  const product=(await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values('PAY-PRODUCT','Payment dish','Phần',true) returning id")).rows[0].id;
  await db.query("insert into product_prices(product_id,price_vnd,effective_from,evidence) values($1,10000,current_date-1,'Synthetic public price')",[product]);
  await db.query("insert into warehouses(code,name,kind) values('PAY-ING','Payment ingredient warehouse','ingredient')");
  const unit=(await db.query<{id:string}>("insert into material_units(code,name,dimension) values('PAY-U','Unit','count') returning id")).rows[0].id;
  const material=(await db.query<{id:string}>("insert into materials(code,name,usage_unit_id) values('PAY-M','Planning material',$1) returning id",[unit])).rows[0].id;
  const recipe=(await db.query<{id:string}>("insert into recipes(code,name,kind) values('PAY-R','Payment recipe','product') returning id")).rows[0].id;
  const version=(await db.query<{id:string}>("insert into recipe_versions(recipe_id,revision,effective_from,output_quantity,output_unit_id,status) values($1,1,current_date-1,1,$2,'draft') returning id",[recipe,unit])).rows[0].id;
  await db.query('insert into recipe_items(recipe_version_id,material_id,quantity,unit_id) values($1,$2,1,$3)',[version,material,unit]);
  await asUser(db,identities.admin,()=>db.query('select publish_recipe($1,1,$2,1,$3)',[version,product,randomUUID()]));
  const policy=(await db.query<{id:string}>("insert into store_discount_policies(store_id,effective_from,common_rate,note,evidence) values($1,current_date-1,0.15,'Synthetic rate','Synthetic policy evidence') returning id",[store])).rows[0].id;
  await db.query('insert into store_discount_policy_items(policy_id,product_id,eligible) values($1,$2,true)',[policy,product]);
  const token='a'.repeat(64);await db.query('insert into private.public_order_links(token_hash,store_id,created_by) values($1,$2,$3)',[createHash('sha256').update(token).digest('hex'),store,identities.admin]);
  const date=(await db.query<{delivery_day:string}>("select to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date+1,'YYYY-MM-DD') delivery_day")).rows[0].delivery_day;
  const linked=await anonymous(db,()=>db.query<{result:{rows:Record<string,unknown>[];store_contact:{name:string;phone:string;address:string}}}>('select public_order_catalog_linked($1,0,100,$2) result',[date,token]));
  assert.equal(linked.rows[0].result.rows[0].price_vnd,'10000');assert.equal(linked.rows[0].result.rows[0].discount_rate,'0.150000');
  assert.deepEqual(linked.rows[0].result.store_contact,{name:'Payment store',phone:'0900000055',address:'Synthetic store delivery address'});
  await assert.rejects(()=>anonymous(db,()=>db.query('select public_order_catalog_linked($1,0,100,$2)',[date,'b'.repeat(64)])),/INVALID_LINK/);
  const payload=[{product_id:product,quantity:'2',price_vnd:'10000'}],key=randomUUID(),submit=()=>anonymous(db,()=>db.query<{result:{order_id:string}}>('select submit_store_link_order_v2($1,$2,$3,$4,$5,$6,$7,$8) result',[date,'AM',{name:'Discount visitor',phone:'0900000055',address:'Discount delivery address'},payload,'Rate snapshot',token,'bank',key]));
  const first=(await submit()).rows[0].result;assert.deepEqual((await submit()).rows[0].result,first);
  const snapshot=(await db.query<{discount_rate:string;customer_payment_method:string}>('select i.discount_rate::text,o.customer_payment_method from customer_order_items i join customer_orders o on o.id=i.order_id where o.id=$1',[first.order_id])).rows[0];
  assert.equal(snapshot.discount_rate,'0.150000');assert.equal(snapshot.customer_payment_method,'bank');
  await assert.rejects(()=>anonymous(db,()=>db.query('select submit_store_link_order_v2($1,$2,$3,$4,$5,$6,$7,$8)',[date,'AM',{name:'Discount visitor',phone:'0900000055',address:'Discount delivery address'},payload,'Rate snapshot',token,'cash',key])),/IDEMPOTENCY_CONFLICT/);
  const guestKey=randomUUID(),guest=(await anonymous(db,()=>db.query<{result:{order_id:string}}>('select submit_public_order_v2($1,$2,$3,$4,$5,$6,$7) result',[date,'AM',{name:'Unlinked visitor',phone:'0900000056',address:'Unlinked delivery address'},payload,'Assign store on review','cash',guestKey]))).rows[0].result;
  const guestVersion=(await db.query<{version:string}>('select version::text from customer_orders where id=$1',[guest.order_id])).rows[0].version;
  await asUser(db,identities.admin,()=>db.query('select review_public_order($1,$2,$3,true,\'\',$4)',[guest.order_id,guestVersion,store,randomUUID()]));
  const summary=(await asUser(db,identities.admin,()=>db.query<{result:{orders:{id:string;discount_vnd:string;order_total_vnd:string}[]}}>('select order_customer_summary($1) result',[date]))).rows[0].result;
  const reviewed=summary.orders.find(order=>order.id===guest.order_id)!;assert.equal(reviewed.discount_vnd,'3000');assert.equal(reviewed.order_total_vnd,'17000');
 }finally{await db.close();}
});

test('contact prefill patch repairs a newer database missing 085 without changing prices, data or link privacy',async()=>{
 // Reproduce the pre-discount schema: 097 depends on the skipped 092/096 helpers.
 const db=await database(undefined,['202611240085_prefill_public_order_contact_from_store.sql','202611260092_order_quantity_discounts.sql','202611270096_store_order_discount_tiers.sql','202611270097_order_discount_respects_selected_products.sql']);try{
  assert.equal((await db.query<{ready:boolean}>("select to_regprocedure('public.publish_recipe_at(uuid,bigint,date,uuid)') is not null ready")).rows[0].ready,true);
  const stores=(await db.query<{id:string;code:string}>("insert into stores(code,name,address,contact,active) values('PREFILL-A','Synthetic first store','First synthetic delivery address','0900000085',true),('PREFILL-B','Synthetic second store','Second synthetic delivery address','0900000086',true) returning id,code")).rows;
  const product=(await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values('PREFILL-DISH','Synthetic prefill dish','Phần',true) returning id")).rows[0].id;
  await db.query("insert into product_prices(product_id,price_vnd,effective_from,evidence) values($1,10000,current_date-1,'Synthetic common price')",[product]);
  const tokens=['a'.repeat(64),'b'.repeat(64)];
  for(const [index,store] of stores.entries()){
   await db.query('insert into private.public_order_links(token_hash,store_id,created_by) values($1,$2,$3)',[createHash('sha256').update(tokens[index]).digest('hex'),store.id,identities.admin]);
   await db.query('insert into store_product_prices(store_id,product_id,price_vnd,effective_from) values($1,$2,$3,current_date-1)',[store.id,product,3500+index*1000]);
   const policy=(await db.query<{id:string}>("insert into store_discount_policies(store_id,effective_from,common_rate,note,evidence) values($1,current_date-1,$2,'Synthetic discount','Synthetic policy evidence') returning id",[store.id,index===0?'0.17':'0.12'])).rows[0].id;
   await db.query('insert into store_discount_policy_items(policy_id,product_id,eligible) values($1,$2,true)',[policy,product]);
  }
  const date=(await db.query<{delivery_day:string}>("select to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date+1,'YYYY-MM-DD') delivery_day")).rows[0].delivery_day;
  type Catalog={rows:Record<string,unknown>[];total:string;store_contact?:{name:string;phone:string;address:string}};
  const linked=async(token:string)=>(await anonymous(db,()=>db.query<{result:Catalog}>('select public_order_catalog_linked($1,0,100,$2) result',[date,token]))).rows[0].result;
  const before=[];for(const token of tokens)before.push(await linked(token));
  for(const response of before)assert.equal(Object.hasOwn(response,'store_contact'),false,'the older RPC reproduces the blank contact fields');
  const protectedTables=['public.stores','private.public_order_links','public.products','public.product_prices','public.store_product_prices','public.store_discount_policies','public.store_discount_policy_items','public.customer_orders','public.customer_order_items','public.audit_logs'];
  const snapshot=async()=>{const result=[];for(const table of protectedTables)result.push((await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') value from ${table} t`)).rows[0]);return result;};
  const originalData=await snapshot(),migration=await readFile('../supabase/migrations/202611240085_prefill_public_order_contact_from_store.sql','utf8');
  await db.exec(migration);assert.deepEqual(await snapshot(),originalData,'installing contact prefill must not write business data or audit rows');
  const contacts=[{name:'Synthetic first store',phone:'0900000085',address:'First synthetic delivery address'},{name:'Synthetic second store',phone:'0900000086',address:'Second synthetic delivery address'}];
  for(const [index,token] of tokens.entries()){
   const after=await linked(token);assert.deepEqual(after.store_contact,contacts[index]);
   assert.deepEqual(after.rows,before[index].rows);assert.equal(after.total,before[index].total);
   assert.equal(after.rows[0].price_vnd,'10000');assert.equal(after.rows[0].discount_rate,index===0?'0.170000':'0.120000');
   assert.equal(JSON.stringify(after).includes(contacts[1-index].phone),false,'one link must not expose another store contact');
  }
  const normal=(await anonymous(db,()=>db.query<{result:Catalog}>('select public_order_catalog($1,0,100) result',[date]))).rows[0].result;
  assert.equal(Object.hasOwn(normal,'store_contact'),false);
  for(const table of ['public.stores','private.public_order_links','public.customer_orders','public.customer_order_items','public.store_product_prices','public.audit_logs'])await assert.rejects(()=>anonymous(db,()=>db.query('select * from '+table)),/permission denied/);
  await assert.rejects(()=>linked('c'.repeat(64)),/INVALID_LINK/);
  await db.query('update stores set active=false where id=$1',[stores[1].id]);await assert.rejects(()=>linked(tokens[1]),/INVALID_LINK/);
  await db.query('update stores set active=true where id=$1',[stores[1].id]);
  await db.query('update private.public_order_links set revoked_at=now() where store_id=$1',[stores[0].id]);await assert.rejects(()=>linked(tokens[0]),/INVALID_LINK/);
  const beforeReplay=await snapshot();await db.exec(migration);assert.deepEqual(await snapshot(),beforeReplay,'replaying the schema correction must not alter business rows or audit history');
  assert.deepEqual((await linked(tokens[1])).store_contact,contacts[1]);
 }finally{await db.close();}
});

test('order review queue shows the assigned store with orders:view and does not require stores:view',async()=>{
 const db=await database();try{
  const store=(await db.query<{id:string}>("insert into stores(code,name) values('QUEUE-STORE','Review queue store') returning id")).rows[0].id;
  const order=(await db.query<{id:string}> ("insert into customer_orders(store_id,delivery_date,shift,guest_name,guest_phone,guest_address,customer_payment_method) values($1,current_date,'PM','Synthetic guest','0900000048','Queue test address','bank') returning id",[store])).rows[0].id;
  await db.query("insert into public.user_permissions(user_id,module,action,allowed) values($1,'orders','view',true),($1,'stores','view',false)",[identities.a]);
  const rows=await asUser(db,identities.a,()=>db.query<{id:string;store_code:string;store_name:string;guest_name:string;customer_payment_method:string}>('select * from public.order_review_queue(0,25)'));
  assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].id,order);assert.equal(rows.rows[0].guest_name,'Synthetic guest');assert.equal(rows.rows[0].store_code,'QUEUE-STORE');assert.equal(rows.rows[0].store_name,'Review queue store');assert.equal(rows.rows[0].customer_payment_method,'bank');
  await assert.rejects(()=>anonymous(db,()=>db.query('select * from public.order_review_queue(0,25)')),/permission denied/);
  await assert.rejects(()=>asUser(db,identities.b,()=>db.query('select * from public.order_review_queue(0,25)')),/FORBIDDEN/);
  await assert.rejects(()=>asUser(db,identities.a,()=>db.query('select * from public.order_review_queue(-1,25)')),/INVALID_FILTER/);
 }finally{await db.close();}
});

async function anonymous<T>(db:PGlite,run:()=>Promise<T>){await db.exec('begin;set local role anon;');await db.query("select set_config('request.jwt.claim.sub','',true)");try{const result=await run();await db.exec('commit');return result;}catch(error){await db.exec('rollback');throw error;}}
async function setup(){
 const db=await database();
 const day=(await db.query<{date_value:string}>("select to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date+1,'YYYY-MM-DD') date_value")).rows[0].date_value;
 const products=(await db.query<{id:string;code:string}>("insert into products(code,name,sale_unit,published,archived) values('PUBLIC-A','Published rice','Phần',true,false),('PRIVATE-B','Internal dish','Hộp',false,false),('ARCHIVE-C','Archived','Hộp',true,true),('NO-PRICE','Waiting price','Phần',true,false) returning id,code")).rows;
 const ids=Object.fromEntries(products.map(p=>[p.code,p.id]));
 await db.query("insert into product_prices(product_id,price_vnd,effective_from,evidence) values($1,15000,current_date-1,'Synthetic public price'),($2,9000,current_date-1,'Synthetic private price')",[ids['PUBLIC-A'],ids['PRIVATE-B']]);
 const store=(await db.query<{id:string}>("insert into stores(code,name,active) values('PUBLIC-STORE','Assigned internal store',true) returning id")).rows[0].id;
 await db.query("insert into warehouses(code,name,kind) values('PUBLIC-ING','Public order ingredient warehouse','ingredient')");
 const unit=(await db.query<{id:string}>("insert into material_units(code,name,dimension) values('PUBLIC-U','Public order unit','count') returning id")).rows[0].id;
 const material=(await db.query<{id:string}>("insert into materials(code,name,usage_unit_id) values('PUBLIC-M','Public order ingredient',$1) returning id",[unit])).rows[0].id;
 const recipe=(await db.query<{id:string}>("insert into recipes(code,name,kind) values('PUBLIC-R','Public rice recipe','product') returning id")).rows[0].id;
 const version=(await db.query<{id:string}>("insert into recipe_versions(recipe_id,revision,effective_from,output_quantity,output_unit_id,status) values($1,1,current_date-1,1,$2,'draft') returning id",[recipe,unit])).rows[0].id;
 await db.query('insert into recipe_items(recipe_version_id,material_id,quantity,unit_id) values($1,$2,1,$3)',[version,material,unit]);
 await asUser(db,identities.admin,()=>db.query('select publish_recipe($1,1,$2,1,$3)',[version,ids['PUBLIC-A'],randomUUID()]));
 await db.query("insert into store_product_prices(store_id,product_id,price_vnd,effective_from) values($1,$2,123,current_date-1)",[store,ids['PUBLIC-A']]);
 const contact={name:'Synthetic visitor',phone:'0900000035',address:'Synthetic delivery address'};
 const items=[{product_id:ids['PUBLIC-A'],quantity:'2',price_vnd:'15000'}];
 const submit=(lines:unknown=items,key=randomUUID(),person=contact,date=day)=>anonymous(db,()=>db.query<{result:{order_id:string;status:string}}>('select submit_public_order($1,$2,$3,$4,$5,$6) result',[date,'AM',person,lines,'Synthetic guest order',key]));
 return {db,day,ids,store,contact,items,submit};
}

test('anonymous catalog exposes only published active dishes and common prices; publication takes effect immediately',async()=>{
 const {db,day,ids}=await setup();try{
  const catalog=()=>anonymous(db,()=>db.query<{result:{total:string;rows:Record<string,unknown>[]}}>('select public_order_catalog($1,0,100) result',[day]));
  const result=(await catalog()).rows[0].result;
  assert.equal(result.total,'2');assert.equal(result.rows.find(row=>row.code==='PUBLIC-A')?.price_vnd,'15000');
  assert.equal(result.rows.find(row=>row.code==='NO-PRICE')?.price_vnd,null);
  assert.ok(result.rows.every(row=>Object.keys(row).sort().join(',')==='code,image_path,name,price_vnd,product_id,sale_unit'));
  await db.query('update products set published=true where id=$1',[ids['PRIVATE-B']]);assert.equal((await catalog()).rows[0].result.total,'3');
  await db.query('update products set published=false where id=$1',[ids['PUBLIC-A']]);assert.ok(!(await catalog()).rows[0].result.rows.some(row=>row.code==='PUBLIC-A'));
  for(const table of ['products','product_prices','store_product_prices','stores','customer_orders','customer_order_items','materials','audit_logs'])await assert.rejects(()=>anonymous(db,()=>db.query('select * from public.'+table)),/permission denied/);
 }finally{await db.close();}
});

test('anonymous submit snapshots common price/contact; approval plans production without posting revenue, cash or stock',async()=>{
 const {db,submit,items,contact,store}=await setup();try{
  const key=randomUUID(),first=await submit(items,key);assert.deepEqual(await submit(items,key),first);
  assert.equal((await db.query('select * from customer_orders')).rows.length,1);
  const order=(await db.query<{id:string;version:string;guest_phone:string;store_id:string|null;customer_id:string|null}>('select * from customer_orders')).rows[0];
  assert.equal(order.guest_phone,contact.phone);assert.equal(order.store_id,null);assert.equal(order.customer_id,null);
  const line=(await db.query<{price_vnd:string;product_name:string}>('select * from customer_order_items')).rows[0];assert.equal(line.price_vnd,15000);assert.equal(line.product_name,'Published rice');
  await assert.rejects(()=>submit([{...items[0],quantity:'3'}],key),/IDEMPOTENCY_CONFLICT/);
  await assert.rejects(()=>anonymous(db,()=>db.query('select review_public_order($1,$2,$3,true,\'\',$4)',[order.id,order.version,store,randomUUID()])),/permission denied/);
  await assert.rejects(()=>asUser(db,identities.a,()=>db.query('select review_public_order($1,$2,$3,true,\'\',$4)',[order.id,order.version,store,randomUUID()])),/FORBIDDEN/);
  await assert.rejects(()=>asUser(db,identities.admin,()=>db.query('select review_public_order($1,null,$2,true,\'\',$3)',[order.id,store,randomUUID()])),/VERSION_CONFLICT/);
  await assert.rejects(()=>asUser(db,identities.admin,()=>db.query('select review_order($1,$2,true,\'\',$3)',[order.id,order.version,randomUUID()])),/STORE_REQUIRED/);
  const reviewKey=randomUUID(),review=()=>asUser(db,identities.admin,()=>db.query('select review_public_order($1,$2,$3,true,\'\',$4)',[order.id,order.version,store,reviewKey]));
  await review();await review();
  assert.equal((await db.query<{status:string}>('select status from customer_orders')).rows[0].status,'scheduled');
  assert.equal((await db.query('select * from order_status_history')).rows.length,3);
  assert.equal((await db.query('select * from production_plans')).rows.length,1);
  for(const table of ['sales_documents','cash_ledger','inventory_movements','notifications'])assert.equal((await db.query('select * from '+table)).rows.length,0);
 }finally{await db.close();}
});

test('approval succeeds when recipe conversion is missing and leaves the order unscheduled',async()=>{
 const {db,store}=await setup();try{
  const product=(await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values('NO-RECIPE-APPROVAL','Unconfigured dish','Phần',true) returning id")).rows[0].id;
  await db.query("insert into product_prices(product_id,price_vnd,effective_from,evidence) values($1,12000,current_date-1,'Synthetic order price')",[product]);
  const date=(await db.query<{delivery_day:string}>("select to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date+1,'YYYY-MM-DD') delivery_day")).rows[0].delivery_day;
  const submitted=(await anonymous(db,()=>db.query<{result:{order_id:string}}>("select submit_public_order_v2($1,'AM',$2,$3,'Unconfigured recipe order','cash',$4) result",[date,{name:'Unconfigured visitor',phone:'0900000060',address:'Review test address'},[{product_id:product,quantity:'3',price_vnd:'12000'}],randomUUID()]))).rows[0].result;
  const version=(await db.query<{version:string}>('select version::text from customer_orders where id=$1',[submitted.order_id])).rows[0].version;
  const reviewed=await asUser(db,identities.admin,()=>db.query<{result:{status:string;plan_id:string|null}}>('select review_public_order($1,$2,$3,true,\'\',$4) result',[submitted.order_id,version,store,randomUUID()]));
  assert.equal(reviewed.rows[0].result.status,'approved');assert.equal(reviewed.rows[0].result.plan_id,null);
  assert.equal((await db.query<{status:string}>('select status from customer_orders where id=$1',[submitted.order_id])).rows[0].status,'approved');
  assert.equal((await db.query('select * from production_plans')).rows.length,0);
  assert.equal((await db.query<{count:number}>("select count(*)::int count from order_status_history where order_id=$1 and to_status='approved'",[submitted.order_id])).rows[0].count,1);
  assert.equal((await db.query('select * from notifications')).rows.length,0,'guest approval must not notify a nonexistent account');
 }finally{await db.close();}
});

test('order item quantity revisions reject fractional quantities at the database boundary',async()=>{
 const {db,submit,items}=await setup();try{
  const submitted=(await submit()).rows[0].result;
  const version=(await db.query<{version:string}>('select version::text from customer_orders where id=$1',[submitted.order_id])).rows[0].version;
  await assert.rejects(()=>asUser(db,identities.admin,()=>db.query("select revise_submitted_order_item($1,$2,'edit',$3,1.5,'Customer change', $4)",[submitted.order_id,version,items[0].product_id,randomUUID()])),/INVALID_ORDER_QUANTITY/);
  assert.equal((await db.query<{quantity:string}>('select quantity::text from customer_order_items where order_id=$1',[submitted.order_id])).rows[0].quantity,'2.000000');
  assert.equal((await db.query('select * from customer_order_item_changes where order_id=$1',[submitted.order_id])).rows.length,0);
 }finally{await db.close();}
});

test('guest validation, price changes, missing/unpublished dishes, capacity and rate limits roll back entire requests',async()=>{
 const {db,submit,items,ids,contact,day}=await setup();try{
  for(const lines of [[{...items[0],price_vnd:'1'}],[{...items[0],quantity:'0'}],[items[0],items[0]],[{...items[0],product_id:ids['PRIVATE-B']}],[{...items[0],product_id:ids['NO-PRICE']}],[{...items[0],quantity:'NaN'}],[{...items[0],discount_rate:'1'}]])await assert.rejects(()=>submit(lines),/PRICE_CHANGED|INVALID_ORDER_ITEMS|DUPLICATE_PRODUCT|PRODUCT_NOT_AVAILABLE/);
  await assert.rejects(()=>submit(items,randomUUID(),{...contact,phone:'x'}),/INVALID_CONTACT/);
  await db.query("insert into app_settings(key,value) values('order_policy',$1)",[{daily_capacity:1}]);
  await assert.rejects(()=>submit(),/DAILY_CAPACITY/);
  assert.equal((await db.query('select * from customer_orders')).rows.length,0);
  assert.equal((await db.query('select * from private.public_order_requests')).rows.length,0);
  await db.query("update app_settings set value='{}' where key='order_policy'");
  for(let i=0;i<5;i++)await submit();await assert.rejects(()=>submit(),/RATE_LIMIT/);
  assert.equal((await db.query('select * from customer_orders')).rows.length,5);
  const o=(await db.query<{id:string;version:string}>('select * from customer_orders limit 1')).rows[0];
  await asUser(db,identities.admin,()=>db.query('select review_public_order($1,$2,null,false,$3,$4)',[o.id,o.version,'Synthetic rejection',randomUUID()]));
  assert.equal((await db.query<{status:string}>('select status from customer_orders where id=$1',[o.id])).rows[0].status,'rejected');
  const other=(await db.query<{id:string}>('select id from customer_orders where id<>$1 limit 1',[o.id])).rows[0].id;
  assert.equal((await asUser(db,identities.a,()=>db.query('select * from customer_orders where id=$1',[other]))).rows.length,0);
  assert.ok(day);
 }finally{await db.close();}
});

test('login return targets accept the public portal and reject obsolete or external redirects',()=>{
 assert.equal(authTarget('/portal/account'),'/app');assert.equal(authTarget('/portal'),'/portal');
 for(const value of ['https://example.com','//example.com','/portal/../../evil',null])assert.equal(authTarget(value),'/app');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
import {authTarget} from '../lib/auth/target';
import {readFile} from 'node:fs/promises';
import {buildPublicPortalUpdate} from '../lib/deploy/public-portal-update';
import {buildPublicOrderLinksUpdate} from '../lib/deploy/public-order-links-update';

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

async function anonymous<T>(db:PGlite,run:()=>Promise<T>){await db.exec('begin;set local role anon;');await db.query("select set_config('request.jwt.claim.sub','',true)");try{const result=await run();await db.exec('commit');return result;}catch(error){await db.exec('rollback');throw error;}}
async function setup(){
 const db=await database();
 const day=(await db.query<{date_value:string}>("select to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date+1,'YYYY-MM-DD') date_value")).rows[0].date_value;
 const products=(await db.query<{id:string;code:string}>("insert into products(code,name,sale_unit,published,archived) values('PUBLIC-A','Published rice','Phần',true,false),('PRIVATE-B','Internal dish','Hộp',false,false),('ARCHIVE-C','Archived','Hộp',true,true),('NO-PRICE','Waiting price','Phần',true,false) returning id,code")).rows;
 const ids=Object.fromEntries(products.map(p=>[p.code,p.id]));
 await db.query("insert into product_prices(product_id,price_vnd,effective_from,evidence) values($1,15000,current_date-1,'Synthetic public price'),($2,9000,current_date-1,'Synthetic private price')",[ids['PUBLIC-A'],ids['PRIVATE-B']]);
 const store=(await db.query<{id:string}>("insert into stores(code,name,active) values('PUBLIC-STORE','Assigned internal store',true) returning id")).rows[0].id;
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
  assert.ok(result.rows.every(row=>Object.keys(row).sort().join(',')==='code,name,price_vnd,product_id,sale_unit'));
  await db.query('update products set published=true where id=$1',[ids['PRIVATE-B']]);assert.equal((await catalog()).rows[0].result.total,'3');
  await db.query('update products set published=false where id=$1',[ids['PUBLIC-A']]);assert.ok(!(await catalog()).rows[0].result.rows.some(row=>row.code==='PUBLIC-A'));
  for(const table of ['products','product_prices','store_product_prices','stores','customer_orders','customer_order_items','materials','audit_logs'])await assert.rejects(()=>anonymous(db,()=>db.query('select * from public.'+table)),/permission denied/);
 }finally{await db.close();}
});

test('anonymous submit snapshots common price/contact, replays once and never posts revenue, cash, stock or plans',async()=>{
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
  assert.equal((await db.query<{status:string}>('select status from customer_orders')).rows[0].status,'approved');
  assert.equal((await db.query('select * from order_status_history')).rows.length,2);
  for(const table of ['sales_documents','cash_ledger','inventory_movements','production_plans','notifications'])assert.equal((await db.query('select * from '+table)).rows.length,0);
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

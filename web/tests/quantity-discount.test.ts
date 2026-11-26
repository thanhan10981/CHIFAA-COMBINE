import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {database,asUser,identities} from './database-fixture';
import {quantityDiscountRate} from '../features/orders/quantity-discount';
import {readFile} from 'node:fs/promises';
import {buildOrderQuantityDiscountsUpdate} from '../lib/deploy/order-quantity-discounts-update';
const rule={version:2,threshold:'50',base_rate:'0.150000',upgraded_rate:'0.17'};
test('store order quantity aggregates across dishes and upgrades only a configured 15% store above 50',()=>{
 for(const [quantity,rate] of [['49','0.15'],['50','0.15'],['51','0.17']])assert.equal(quantityDiscountRate({},quantity,rule),rate);
 assert.equal(quantityDiscountRate({},'100',{...rule,base_rate:'0.17'}),'0.17');
 assert.equal(quantityDiscountRate({},'100',{...rule,base_rate:'0'}),'0');
 assert.equal(quantityDiscountRate({},'25'),'0');
});
test('server snapshots quantity tiers, rejects supplied discounts, replays and revises submitted lines without changing past orders',async()=>{
 const db=await database();
 try{
  const store=(await db.query<{id:string}>("insert into stores(code,name) values('QTY-S','Synthetic quantity store') returning id")).rows[0].id;
  const products=(await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values('QTY-A','First dish','phần',true),('QTY-B','Second dish','phần',true),('QTY-C','Excluded whole roll','cây',true) returning id")).rows;
  for(const p of products)await db.query("insert into product_prices(product_id,price_vnd,effective_from,evidence) values($1,15000,current_date-1,'Synthetic price')",[p.id]);
  const policy=(await db.query<{id:string}>("insert into store_discount_policies(store_id,effective_from,common_rate,note,evidence) values($1,current_date-1,0.15,'Synthetic tiers','Synthetic policy') returning id",[store])).rows[0].id;
  for(const [i,p] of products.entries())await db.query('insert into store_discount_policy_items(policy_id,product_id,eligible) values($1,$2,$3)',[policy,p.id,i<2]);
  const link=(await asUser(db,identities.admin,()=>db.query<{result:{token:string}}>('select create_public_order_link($1,$2) result',[store,randomUUID()]))).rows[0].result;
  const day=(await db.query<{delivery_day:string}>("select to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date+1,'YYYY-MM-DD') delivery_day")).rows[0].delivery_day;
  const anon=async<T>(fn:()=>Promise<T>)=>{await db.exec('begin;set local role anon;');try{const r=await fn();await db.exec('commit;');return r;}catch(e){await db.exec('rollback;');throw e;}};
  const catalog=(await anon(()=>db.query<{result:{quantity_discount_rule:typeof rule;rows:{product_id:string;discount_eligible:boolean}[]}}>('select public_order_catalog_linked($1,0,100,$2) result',[day,link.token]))).rows[0].result;
  assert.deepEqual(catalog.quantity_discount_rule,rule);assert.equal(catalog.rows.find(p=>p.product_id===products[2].id)?.discount_eligible,false);
  const payload=products.map((p,i)=>({product_id:p.id,quantity:i===0?'49':i===1?'50':'51',price_vnd:'15000',toppings:[]})),key=randomUUID();
  const submit=()=>anon(()=>db.query<{result:{order_id:string}}>("select submit_public_order_with_toppings($1,'AM',$2,$3,'Synthetic tier check',$4,'cash',$5) result",[day,{name:'Quantity visitor',phone:'0900000092',address:'Synthetic quantity address'},payload,link.token,key]));
  const order=(await submit()).rows[0].result;assert.deepEqual((await submit()).rows[0].result,order);
  const rates=async()=> (await db.query<{product_id:string;quantity:string;rate:string}>('select product_id,quantity::text,discount_rate::text rate from customer_order_items where order_id=$1 order by product_id',[order.order_id])).rows;
  const before=await rates();
  assert(before.every(p=>p.rate==='0.170000'),'combined 150 portions use 17% on every dish regardless of item eligibility');
  const version=(await db.query<{version:string}>('select version::text from customer_orders where id=$1',[order.order_id])).rows[0].version;
  await asUser(db,identities.admin,()=>db.query("select revise_submitted_order_item($1,$2,'edit',$3,50,'Synthetic quantity correction',$4)",[order.order_id,version,products[0].id,randomUUID()]));
  assert((await rates()).every(p=>p.rate==='0.170000'));
  const summary=(await asUser(db,identities.admin,()=>db.query<{result:{orders:{id:string;order_total_vnd:string}[]}}>('select order_customer_summary($1) result',[day]))).rows[0].result;
  assert.equal(summary.orders.find(o=>o.id===order.order_id)?.order_total_vnd,'1879950');
  for(const quantity of [51,49]){
   const currentVersion=(await db.query<{version:string}>('select version::text from customer_orders where id=$1',[order.order_id])).rows[0].version;
   await asUser(db,identities.admin,()=>db.query("select revise_submitted_order_item($1,$2,'edit',$3,$4,'Synthetic crossing threshold',$5)",[order.order_id,currentVersion,products[0].id,quantity,randomUUID()]));
   assert((await rates()).every(p=>p.rate==='0.170000'),'other dish quantities keep the combined order above 50');
  }
  const split=products.slice(0,2).map(p=>({product_id:p.id,quantity:'25',price_vnd:'15000',toppings:[]}));
  const splitOrder=(await anon(()=>db.query<{result:{order_id:string}}>("select submit_public_order_with_toppings($1,'AM',$2,$3,'Two dishes do not combine',$4,'cash',$5) result",[day,{name:'Quantity visitor',phone:'0900000092',address:'Synthetic quantity address'},split,link.token,randomUUID()]))).rows[0].result;
  assert.equal((await db.query<{count:number}>("select count(*)::int count from customer_order_items where order_id=$1 and discount_rate=0.15",[splitOrder.order_id])).rows[0].count,2,'two dishes of 25 portions each stay at 15% at exactly 50');
  const approvedStore=(await db.query<{id:string}>("insert into stores(code,name) values('QTY-APP-S','Synthetic approved quantity store') returning id")).rows[0].id;
  await db.query("insert into store_discount_policies(store_id,effective_from,common_rate,note,evidence) values($1,current_date-1,0.15,'Synthetic approved tiers','Synthetic policy')",[approvedStore]);
  const approved=(await db.query<{id:string;version:string}>("insert into customer_orders(store_id,customer_id,delivery_date,shift,status) values($1,$2,$3,'AM','approved') returning id,version::text",[approvedStore,identities.a,day])).rows[0];
  for(const p of products.slice(0,2))await db.query('insert into customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate) values($1,$2,25,15000,0.15)',[approved.id,p.id]);
  await asUser(db,identities.admin,()=>db.query("select revise_approved_order_item($1,$2,'edit',$3,26,'Synthetic approved tier crossing',$4)",[approved.id,approved.version,products[0].id,randomUUID()]));
  assert.equal((await db.query<{count:number}>('select count(*)::int count from customer_order_items where order_id=$1 and discount_rate=0.17',[approved.id])).rows[0].count,2,'approved order edit recalculates all lines when total crosses 50');
  const bad=payload.map((p,i)=>i===0?{...p,discount_rate:'1'}:p);
  await assert.rejects(()=>anon(()=>db.query("select submit_public_order_with_toppings($1,'AM',$2,$3,'Bad discount',$4,'cash',$5)",[day,{name:'Quantity visitor',phone:'0900000092',address:'Synthetic quantity address'},bad,link.token,randomUUID()])),/INVALID_ORDER_ITEMS/);
  const frozen=await rates();
  await db.query("insert into store_discount_policies(store_id,effective_from,common_rate,enabled,note,evidence) values($1,$2,0.17,false,'Synthetic disabled policy','Synthetic policy update')",[store,day]);
  assert.equal((await db.query<{rate:string}>('select private.store_order_discount_rate($1,$2,51)::text rate',[store,day])).rows[0].rate,'0');
  assert.deepEqual((await submit()).rows[0].result,order);assert.deepEqual(await rates(),frozen,'later policy changes and retry never rewrite an accepted snapshot');
 }finally{await db.close();}
});

test('owner quantity-discount bundle applies and replays while preserving existing order snapshots and business records',async()=>{
 const db=await database('202611250090_publish_recipe_tree_at_selected_date.sql');
 try{
  const store=(await db.query<{id:string}>("insert into stores(code,name) values('OLD-QTY-S','Synthetic past store') returning id")).rows[0].id;
  const product=(await db.query<{id:string}>("insert into products(code,name,sale_unit) values('OLD-QTY-P','Synthetic old dish','phần') returning id")).rows[0].id;
  const order=(await db.query<{id:string}>("insert into customer_orders(store_id,customer_id,delivery_date,shift,status) values($1,$2,current_date-1,'AM','fulfilled') returning id",[store,identities.a])).rows[0].id;
  await db.query('insert into customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate) values($1,$2,50,15000,0.12)',[order,product]);
  const snapshot=async()=>Promise.all(['customer_orders','customer_order_items','sales_documents','cash_ledger','receivables','audit_logs'].map(table=>db.query('select * from '+table+' order by id').then(result=>result.rows)));
  const before=await snapshot();
  const linksSql=await readFile('../supabase/migrations/202611260091_persistent_store_order_links.sql','utf8'),discountSql=await readFile('../supabase/migrations/202611260092_order_quantity_discounts.sql','utf8');
  const failedSql=buildOrderQuantityDiscountsUpdate(linksSql,discountSql.replace('product.price_vnd,0,product.name','intentional missing fragment'));
  await assert.rejects(()=>db.exec(failedSql),/QUANTITY_DISCOUNT_PATCH_MISMATCH/);await db.exec('rollback;');
  assert.equal((await db.query<{ready:boolean}>("select to_regprocedure('public.public_order_links_v2()') is not null ready")).rows[0].ready,false,'failed discount patch rolls back the link patch too');
  const sql=buildOrderQuantityDiscountsUpdate(linksSql,discountSql);
  await db.exec(sql);await db.exec(sql);assert.deepEqual(await snapshot(),before);
  await db.exec('begin;set local role anon;');await assert.rejects(()=>db.query('select private.order_quantity_discount_rate($1,$2,current_date,50)',[store,product]),/permission denied/);await db.exec('rollback;');
 }finally{await db.close();}
});

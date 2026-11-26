import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {database,asUser,identities} from './database-fixture';

test('order review queue filters by delivery date on the server',async()=>{
 const db=await database();try{
  const store=(await db.query<{id:string}>("insert into stores(code,name) values('DATE-FILTER','Date filter test') returning id")).rows[0].id;
  const dates=(await db.query<{tomorrow:string;later:string}>("select (current_date+1)::text tomorrow,(current_date+2)::text later")).rows[0];
  const ids=[] as string[];
  for(const date of [dates.tomorrow,dates.later])ids.push((await db.query<{id:string}>("insert into customer_orders(store_id,customer_id,delivery_date,shift) values($1,$2,$3,'AM') returning id",[store,identities.a,date])).rows[0].id);
  const rows=await asUser(db,identities.admin,()=>db.query<{id:string}>('select id from order_review_queue(0,25,$1)',[dates.tomorrow]));
  assert.deepEqual(rows.rows.map(row=>row.id),[ids[0]]);
 }finally{await db.close();}
});

test('approved order edits update its reserved plan quantity and cancellation preserves audit history',async()=>{
 const db=await database();try{
  const store=(await db.query<{id:string}>("insert into stores(code,name) values('APPROVED-EDIT','Approved edit test') returning id")).rows[0].id;
  const product=(await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values('APPROVED-EDIT-P','Approved edit product','Phần',true) returning id")).rows[0].id;
  const plan=(await db.query<{id:string}>("insert into production_plans(delivery_date,production_date,shift,status) values(current_date+1,current_date,'AM','approved') returning id")).rows[0].id;
  const order=(await db.query<{id:string}>("insert into customer_orders(store_id,customer_id,delivery_date,shift,status,plan_id) values($1,$2,current_date+1,'AM','scheduled',$3) returning id",[store,identities.a,plan])).rows[0].id;
  const item=(await db.query<{id:string}>("insert into customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate) values($1,$2,10,15000,0) returning id",[order,product])).rows[0].id;
  await db.query('insert into production_plan_lines(plan_id,product_id,planned_quantity) values($1,$2,10)',[plan,product]);
  const version=Number((await db.query<{version:string}>('select version::text from customer_orders where id=$1',[order])).rows[0].version);
  await asUser(db,identities.admin,()=>db.query("select revise_approved_order_item($1,$2,'edit',$3,14,'Customer confirmed new quantity',$4)",[order,version,product,randomUUID()]));
  assert.equal(Number((await db.query<{q:string}>('select planned_quantity::text q from production_plan_lines where plan_id=$1 and product_id=$2',[plan,product])).rows[0].q),14);
  const nextVersion=Number((await db.query<{version:string}>('select version::text from customer_orders where id=$1',[order])).rows[0].version);
  await asUser(db,identities.admin,()=>db.query('select cancel_approved_order($1,$2,$3,$4)',[order,nextVersion,'Customer cancelled before production',randomUUID()]));
  assert.equal((await db.query<{status:string}>('select status from customer_orders where id=$1',[order])).rows[0].status,'cancelled');
  assert.equal(Number((await db.query<{q:string}>('select planned_quantity::text q from production_plan_lines where plan_id=$1 and product_id=$2',[plan,product])).rows[0].q),0);
  assert.equal((await db.query<{count:string}>("select count(*)::text count from order_status_history where order_id=$1 and to_status='cancelled'",[order])).rows[0].count,'1');
  assert.equal((await db.query<{cancelled_at:string|null}>('select cancelled_at from customer_order_items where id=$1',[item])).rows[0].cancelled_at,null,'cancellation preserves original order lines');
  await assert.rejects(()=>asUser(db,identities.admin,()=>db.query('select cancel_approved_order($1,$2,$3,$4)',[order,nextVersion,'Repeated cancellation',randomUUID()])),/VERSION_CONFLICT|ORDER_NOT_CANCELLABLE/);
 }finally{await db.close();}
});

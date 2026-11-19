import test from 'node:test';
import assert from 'node:assert/strict';
import {database,asUser,identities} from './database-fixture';

test('executive dashboard reads posted sales and active targets from source modules',async()=>{
 const db=await database();try{
  const store=(await db.query<{id:string}>("insert into stores(code,name) values('DASH-S','Dashboard store') returning id")).rows[0].id;
  const product=(await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values('DASH-P','Dashboard product','phần',true) returning id")).rows[0].id;
  const document=(await db.query<{id:string}>("insert into sales_documents(store_id,sold_on,status) values($1,'2026-11-19','posted') returning id",[store])).rows[0].id;
  await db.query("insert into sales_lines(document_id,product_id,delivered,sold,returned,store_borne,price_vnd,discount_rate,net_revenue_vnd) values($1,$2,2,2,0,0,15000,0,30000)",[document,product]);
  const period=(await db.query<{id:string}>("insert into target_periods(starts_on,ends_on,name) values('2026-11-01','2026-11-30','November') returning id")).rows[0].id;
  await db.query("insert into targets(period_id,metric,value) values($1,'revenue',300000),($1,'foodCost',32.2),($1,'minCash',15000)",[period]);
  const result=(await asUser(db,identities.admin,()=>db.query<{summary:Record<string,unknown>}>('select dashboard_summary($1) summary',['2026-11-19']))).rows[0].summary;
  assert.equal(result.net_revenue_vnd,'30000');
  assert.equal(Number(result.revenue_target_daily_vnd),10000);
  assert.equal((result.targets as Record<string,string>).foodCost,'32.200000');
  assert.equal(result.revenue_yesterday_vnd,null);
  assert.equal(result.cash_balance_vnd,null);
 }finally{await db.close();}
});

test('operating dashboard returns permission-aware daily snapshots for a selected range',async()=>{
 const db=await database();try{
  const store=(await db.query<{id:string}>("insert into stores(code,name) values('RANGE-S','Range dashboard store') returning id")).rows[0].id;
  const product=(await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values('RANGE-P','Range dashboard product','phần',true) returning id")).rows[0].id;
  const document=(await db.query<{id:string}>("insert into sales_documents(store_id,sold_on,status) values($1,'2026-11-18','posted') returning id",[store])).rows[0].id;
  await db.query("insert into sales_lines(document_id,product_id,delivered,sold,returned,store_borne,price_vnd,discount_rate,net_revenue_vnd) values($1,$2,1,1,0,0,25000,0,25000)",[document,product]);
  const result=(await asUser(db,identities.admin,()=>db.query<{summary:Record<string,unknown>}>('select dashboard_period_summary($1,$2) summary',['2026-11-17','2026-11-19']))).rows[0].summary;
  const days=result.days as Array<Record<string,unknown>>;
  assert.equal(days.length,3);
  assert.deepEqual(days.map(day=>day.date),['2026-11-17','2026-11-18','2026-11-19']);
  assert.equal(days[1].net_revenue_vnd,'25000');
  assert.equal(days[0].net_revenue_vnd,null);
  await assert.rejects(()=>asUser(db,identities.admin,()=>db.query('select dashboard_period_summary($1,$2)',['2025-01-01','2026-11-19'])),/INVALID_DASHBOARD_PERIOD/);
 }finally{await db.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { database } from './database-fixture';
import { buildOrderKioskUpdate, orderKioskMigrations } from '../lib/deploy/order-kiosk-update';

const skipped = ['202611170021_kiosk_workflow.sql', '202611170022_workflow_guards.sql'];
async function patch() {
 return buildOrderKioskUpdate(await Promise.all(orderKioskMigrations.map(async name => ({
  name,
  sql: await fs.readFile('../supabase/migrations/' + name, 'utf8'),
 }))));
}

test('installs the missing kiosk workflow then applies order settlement over the existing 056-060 schema', async () => {
 const db = await database('202611230060_order_delivery_sales.sql', skipped);
 try {
  await db.exec("insert into stores(code,name) values('KEEP','Existing production data')");
  const sql = await patch();
  await db.exec(sql);
  assert.equal((await db.query<{ present: string | null }>("select to_regclass('public.kiosk_return_lots')::text present")).rows[0].present, 'kiosk_return_lots');
  assert.equal((await db.query<{ present: string | null }>("select to_regprocedure('public.kiosk_action(text,uuid,bigint,date,jsonb,uuid)')::text present")).rows[0].present, 'kiosk_action(text,uuid,bigint,date,jsonb,uuid)');
  assert.equal((await db.query<{ present: string | null }>("select to_regprocedure('public.kiosk_report(date,date,integer,integer)')::text present")).rows[0].present, 'kiosk_report(date,date,integer,integer)');
  assert.equal((await db.query<{ present: string | null }>("select to_regclass('public.order_return_credit_applications')::text present")).rows[0].present, 'order_return_credit_applications');
  assert.equal((await db.query<{ present: string | null }>("select to_regclass('public.order_revenue_adjustments')::text present")).rows[0].present, 'order_revenue_adjustments');
  assert.equal((await db.query<{ present: string | null }>("select to_regprocedure('public.fulfill_order_delivery_settle(uuid,bigint,text,uuid,bigint,uuid)')::text present")).rows[0].present, 'fulfill_order_delivery_settle(uuid,bigint,text,uuid,bigint,uuid)');
  assert.equal((await db.query<{ count: number }>("select count(*)::int count from stores where code='KEEP'")).rows[0].count, 1);
  await assert.rejects(() => db.exec(sql), /CHIFAA_ORDER_KIOSK_PATCH_PARTIAL_OR_ALREADY_APPLIED/);
 } finally { await db.close(); }
});

test('preflight refuses a database without the order-support foundation before creating kiosk tables', async () => {
 const db = await database('202611170020_stock_count_snapshot.sql');
 try {
  const sql = await patch();
  await assert.rejects(() => db.exec(sql), /CHIFAA_ORDER_MIGRATIONS_056_060_REQUIRED/);
  await db.exec('rollback');
  assert.equal((await db.query<{ present: string | null }>("select to_regclass('public.kiosk_return_lots')::text present")).rows[0].present, null);
 } finally { await db.close(); }
});

test('a failed bundled update rolls back kiosk, return-credit and settlement changes together', async () => {
 const db = await database('202611230060_order_delivery_sales.sql', skipped);
 try {
  const sql = (await patch()).replace(/\ncommit;\s*$/, '\nselect order_kiosk_update_forced_failure();\ncommit;\n');
  await assert.rejects(() => db.exec(sql), /order_kiosk_update_forced_failure/);
  await db.exec('rollback');
  assert.equal((await db.query<{ present: string | null }>("select to_regclass('public.kiosk_return_lots')::text present")).rows[0].present, null);
  assert.equal((await db.query<{ present: string | null }>("select to_regclass('public.order_revenue_adjustments')::text present")).rows[0].present, null);
  assert.equal((await db.query<{ count: number }>("select count(*)::int count from information_schema.columns where table_schema='public' and table_name='sales_documents' and column_name='delivery_payment_method'")).rows[0].count, 0);
 } finally { await db.close(); }
});

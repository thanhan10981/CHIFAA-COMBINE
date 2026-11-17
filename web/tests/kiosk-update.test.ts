import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {database} from './database-fixture';
import {buildKioskUpdate,kioskMigrations} from '../lib/deploy/kiosk-update';
async function patch(){return buildKioskUpdate(await Promise.all(kioskMigrations.map(async name=>({name,sql:await fs.readFile('../supabase/migrations/'+name,'utf8')}))));}
test('forward kiosk SQL applies to the 20-migration DEV without replacing history and refuses replay',async()=>{
 const db=await database('202611170020_stock_count_snapshot.sql');try{
  await db.exec("insert into stores(code,name) values('KEEP','Keep existing record')");const sql=await patch();await db.exec(sql);
  assert.equal((await db.query<{count:number}>("select count(*)::int count from stores where code='KEEP'")).rows[0].count,1);
  assert.equal((await db.query<{present:string|null}>("select to_regclass('public.kiosk_return_lots')::text present")).rows[0].present,'kiosk_return_lots');
  await assert.rejects(()=>db.exec(sql),/CHIFAA_KIOSK_PATCH_ALREADY_APPLIED/);await db.exec('rollback');
  assert.equal((await db.query<{count:number}>("select count(*)::int count from stores where code='KEEP'")).rows[0].count,1);
 }finally{await db.close();}
});
test('a failure in the forward update rolls back new tables, columns and function replacements together',async()=>{
 const db=await database('202611170020_stock_count_snapshot.sql');try{
  const sql=(await patch()).replace(/\ncommit;\s*$/,'\nselect kiosk_update_forced_failure();\ncommit;\n');
  await assert.rejects(()=>db.exec(sql),/kiosk_update_forced_failure/);await db.exec('rollback');
  assert.equal((await db.query<{present:string|null}>("select to_regclass('public.kiosk_return_lots')::text present")).rows[0].present,null);
  assert.equal((await db.query<{count:number}>("select count(*)::int count from information_schema.columns where table_name='kiosk_sales' and column_name='lot_id'")).rows[0].count,0);
 }finally{await db.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {database,asUser,identities} from './database-fixture';
import {buildPersistentOrderLinksUpdate} from '../lib/deploy/persistent-order-links-update';

test('persistent links recover existing URLs, reuse across keys, isolate permissions and preserve revocation',async()=>{
 const db=await database('202611250090_publish_recipe_tree_at_selected_date.sql');
 try{
  const stores=(await db.query<{id:string}>("insert into stores(code,name) values('LINK-A','First synthetic store'),('LINK-B','Second synthetic store') returning id")).rows;
  const create=(store:string,key=randomUUID())=>asUser(db,identities.admin,()=>db.query<{result:{token:string;link_id:string}}>('select create_public_order_link($1,$2) result',[store,key]));
  const first=(await create(stores[0].id)).rows[0].result;
  const secondKey=randomUUID(),second=(await create(stores[0].id,secondKey)).rows[0].result;
  const countBefore=(await db.query('select id,revoked_at from private.public_order_links order by id')).rows;
  const sql=buildPersistentOrderLinksUpdate(await readFile('../supabase/migrations/202611260091_persistent_store_order_links.sql','utf8'));
  await db.exec(sql);await db.exec(sql);
  assert.deepEqual((await db.query('select id,revoked_at from private.public_order_links order by id')).rows,countBefore);
  const saved=(await asUser(db,identities.admin,()=>db.query<{token:string;link_id:string}>('select * from public_order_links_v2()'))).rows;
  assert.equal(saved.length,1);assert.ok([first.token,second.token].includes(saved[0].token));
  const reused=(await create(stores[0].id)).rows[0].result;
  assert.deepEqual((await create(stores[0].id,secondKey)).rows[0].result,second,'legacy request replay remains exact');
  assert.equal(reused.token,saved[0].token);assert.equal(reused.link_id,saved[0].link_id);
  assert.equal((await db.query('select * from private.public_order_links')).rows.length,2,'no duplicate links from new request keys');
  const newKey=randomUUID(),other=(await create(stores[1].id,newKey)).rows[0].result;
  assert.notEqual(other.token,reused.token);assert.deepEqual((await create(stores[1].id,newKey)).rows[0].result,other);
  await assert.rejects(()=>asUser(db,identities.a,()=>db.query('select * from public_order_links_v2()')),/FORBIDDEN/);
  await db.exec('begin;set local role anon;');
  await assert.rejects(()=>db.query('select * from public_order_links_v2()'),/permission denied/);await db.exec('rollback;');
  await assert.rejects(()=>asUser(db,identities.admin,()=>db.query('select saved_token from private.public_order_links')),/permission denied/);
  assert.equal(JSON.stringify((await db.query('select * from audit_logs')).rows).includes(other.token),false);
  await asUser(db,identities.admin,()=>db.query('select revoke_public_order_link($1,$2)',[other.link_id,randomUUID()]));
  await assert.rejects(()=>create(stores[1].id,newKey),/LINK_REVOKED/);
  const replacement=(await create(stores[1].id)).rows[0].result;assert.notEqual(replacement.token,other.token);
  await assert.rejects(()=>create(stores[1].id,newKey),/LINK_REVOKED/);
  await db.query('update stores set active=false where id=$1',[stores[1].id]);
  await assert.rejects(()=>create(stores[1].id),/query returned no rows/);
  const rows=(await asUser(db,identities.admin,()=>db.query<{store_id:string}>('select * from public_order_links_v2()'))).rows;
  assert.equal(rows.some(row=>row.store_id===stores[1].id),false);
  const oldHashes=(await db.query<{token_hash:string}>('select token_hash from private.public_order_links where store_id=$1',[stores[0].id])).rows.map(row=>row.token_hash);
  assert.ok(oldHashes.includes(createHash('sha256').update(first.token).digest('hex')));
 }finally{await db.close();}
});

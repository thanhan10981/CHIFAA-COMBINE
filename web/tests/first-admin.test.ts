import test from 'node:test';
import assert from 'node:assert/strict';
import {database,asUser,identities} from './database-fixture';
import {buildFirstAdminSql} from '../lib/deploy/first-admin';

test('owner SQL bootstrap enables only the named confirmed account, audits once, and restores usable backend permissions',async()=>{
 const db=await database();
 try {
  await db.exec('update profiles set enabled=false');
  await db.query("update auth.users set email='owner@example.test',email_confirmed_at=now() where id=$1",[identities.a]);
  const sql=buildFirstAdminSql(' OWNER@example.test ');
  await db.exec(sql);
  const access=await asUser(db,identities.a,()=>db.query<{access:{enabled:boolean;permissions:{module:string;action:string}[]}}>('select my_access() as access'));
  assert.equal(access.rows[0].access.enabled,true);
  assert.ok(access.rows[0].access.permissions.some(p=>p.module==='admin'&&p.action==='manage'));
  assert.ok(access.rows[0].access.permissions.some(p=>p.module==='inventory'&&p.action==='create'));
  assert.equal((await db.query('select * from profiles where enabled')).rows.length,1);
  await db.exec(sql);
  assert.equal((await db.query("select * from audit_logs where action='ADMIN_BOOTSTRAP'")).rows.length,1);
  assert.equal((await db.query("select * from user_roles where user_id=$1 and role_id='admin'",[identities.a])).rows.length,1);
 } finally {await db.close();}
});

test('first Admin bootstrap rejects missing/unconfirmed identities, existing managers, deny overrides and API roles',async()=>{
 const db=await database();
 const rejected=async(email:string,pattern:RegExp)=>{await assert.rejects(()=>db.exec(buildFirstAdminSql(email)),pattern);await db.exec('rollback');};
 try {
  await db.query("update auth.users set email='owner@example.test' where id=$1",[identities.a]);
  await rejected('missing@example.test',/OWNER_AUTH_ACCOUNT_NOT_UNIQUE/);
  await rejected('owner@example.test',/OWNER_EMAIL_NOT_CONFIRMED/);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[identities.a]);
  await rejected('owner@example.test',/ADMIN_ALREADY_INITIALIZED/);
  await db.exec('update profiles set enabled=false');
  await db.query("insert into user_permissions values($1,'materials','view',false)",[identities.a]);
  await rejected('owner@example.test',/OWNER_HAS_PERMISSION_OVERRIDES/);
  await db.exec('set role authenticated');
  await rejected('owner@example.test',/SQL_EDITOR_OWNER_REQUIRED/);
  await db.exec('reset role');
  assert.equal((await db.query("select * from audit_logs where action='ADMIN_BOOTSTRAP'")).rows.length,0);
  assert.equal((await db.query('select * from profiles where enabled')).rows.length,0);
  assert.throws(()=>buildFirstAdminSql("owner@example.test';select 1;--"),/valid confirmed owner email/);
 } finally {await db.close();}
});

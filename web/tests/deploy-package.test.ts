import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {buildDevBootstrap} from '../lib/deploy/bootstrap';

test('SQL Editor package installs atomically and rejects a second run without changing tables',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
   grant usage on schema auth to authenticated,anon;
   create schema storage;create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,metadata jsonb default '{}',unique(bucket_id,name));create function storage.foldername(name text) returns text[] language sql immutable as $$select array[split_part(name,'/',1)]$$;alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant execute on function storage.foldername(text) to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated,anon;`);
  const dir=path.resolve('../supabase/migrations');
  const names=(await fs.readdir(dir)).filter(name=>name.endsWith('.sql')).sort();
  const migrations=await Promise.all(names.map(async name=>({name,sql:await fs.readFile(path.join(dir,name),'utf8')})));
  const sql=buildDevBootstrap(migrations);
  await db.exec(sql);
  const state=await db.query<{tablename:string;rowsecurity:boolean}>("select tablename,rowsecurity from pg_tables where schemaname='public' order by tablename");
  assert.equal(state.rows.length,99,'order settlement adds two audited ledger tables');
  assert.ok(state.rows.every(row=>row.rowsecurity));
  await assert.rejects(()=>db.exec(sql),/CHIFAA_DEV_NOT_EMPTY/);
  await db.exec('rollback');
  assert.deepEqual((await db.query("select tablename,rowsecurity from pg_tables where schemaname='public' order by tablename")).rows,state.rows);
  assert.throws(()=>buildDevBootstrap([{name:'202611170001_bad.sql',sql:'begin; create table x(id int);'}]),/Unmatched transaction/);
 } finally {await db.close();}
});

test('a failing migration rolls back the entire fresh DEV package',async()=>{
 const db=new PGlite();
 try {
  const sql=buildDevBootstrap([{name:'202611170001_first.sql',sql:'begin;create table public.bootstrap_probe(id int);commit;'},
   {name:'202611170002_fail.sql',sql:"select 1/0;"}]);
  await assert.rejects(()=>db.exec(sql),/division by zero/);
  await db.exec('rollback');
  assert.equal((await db.query<{exists:boolean}>("select to_regclass('public.bootstrap_probe') is not null as exists")).rows[0].exists,false);
 } finally {await db.close();}
});

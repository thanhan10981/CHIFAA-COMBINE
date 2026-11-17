import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';import path from 'node:path';
export const identities={admin:'10000000-0000-4000-8000-000000000001',accountant:'10000000-0000-4000-8000-000000000002',a:'10000000-0000-4000-8000-000000000003',b:'10000000-0000-4000-8000-000000000004'};
export async function database(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 const folder=path.resolve('../supabase/migrations');for(const name of (await fs.readdir(folder)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await fs.readFile(path.join(folder,name),'utf8'));
 for(const [role,id] of Object.entries(identities)){await db.query('insert into auth.users(id) values($1)',[id]);await db.query('insert into public.profiles(id,enabled) values($1,true) on conflict(id) do update set enabled=true',[id]);await db.query('insert into public.user_roles values($1,$2)',[id,role==='a'||role==='b'?'customer':role]);}
 return db;
}
export async function asUser<T>(db:PGlite,id:string,run:()=>Promise<T>){await db.exec('begin;set local role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);try{const result=await run();await db.exec('commit');return result;}catch(error){await db.exec('rollback');throw error;}}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {database} from './database-fixture';
import {buildToppingsUpdate,toppingMigrations} from '../lib/deploy/toppings-update';

const migrations=await Promise.all(toppingMigrations.map(async name=>({name,sql:await fs.readFile(path.resolve('../supabase/migrations',name),'utf8')})));
const sql=buildToppingsUpdate(migrations);
for(const boundary of ['202611240080_auto_order_production_plan.sql',toppingMigrations[0],toppingMigrations[1]]){
 test('SQL Editor topping bundle upgrades '+boundary+' and replays without changing data',async()=>{
  const db=await database(boundary);
  try{
   await db.exec(sql);
   const first=(await db.query<{result:{schema_version:number;rows:unknown[]}}>('select public.public_order_topping_catalog_v2(current_date) result')).rows[0].result;
   assert.deepEqual(first,{schema_version:1,rows:[]});
   await db.exec(await fs.readFile(path.resolve('../supabase/diagnostics/order_topping_configuration.sql'),'utf8'));
   const definition=(await db.query<{body:string}>("select pg_get_functiondef('public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid)'::regprocedure) body")).rows[0].body;
   await db.exec(sql);
   assert.equal((await db.query<{body:string}>("select pg_get_functiondef('public.save_recipe_revision(uuid,bigint,jsonb,jsonb,text,uuid)'::regprocedure) body")).rows[0].body,definition);
   assert.equal((await db.query('select * from customer_orders')).rows.length,0);
   assert.equal((await db.query('select * from recipe_versions')).rows.length,0);
  }finally{await db.close();}
 });
}

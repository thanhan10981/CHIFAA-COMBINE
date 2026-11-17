import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
let db:PGlite;
const ids={unit:randomUUID(),material:randomUUID(),recipe:randomUUID(),version:randomUUID(),store:randomUUID(),product:randomUUID(),plan:randomUUID()};
const rpc=(name:string,args:unknown[])=>asUser(db,identities.admin,()=>db.query<Record<string,unknown>>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args));
before(async()=>{db=await database();await db.query<Record<string,unknown>>("insert into material_units(id,code,name,dimension) values($1,'GUARD-U','Unit','count')",[ids.unit]);await db.query<Record<string,unknown>>("insert into materials(id,code,name,usage_unit_id) values($1,'GUARD-M','Material',$2)",[ids.material,ids.unit]);await db.query<Record<string,unknown>>("insert into recipes(id,code,name,kind) values($1,'GUARD-R','Recipe','product')",[ids.recipe]);await db.query<Record<string,unknown>>("insert into recipe_versions(id,recipe_id,revision,effective_from,output_quantity,output_unit_id) values($1,$2,1,'2026-11-17',1,$3)",[ids.version,ids.recipe,ids.unit]);await db.query<Record<string,unknown>>('insert into recipe_items(recipe_version_id,material_id,quantity,unit_id) values($1,$2,1,$3)',[ids.version,ids.material,ids.unit]);await db.query<Record<string,unknown>>("insert into stores(id,code,name) values($1,'GUARD-S','Store')",[ids.store]);await db.query<Record<string,unknown>>("insert into products(id,code,name,sale_unit) values($1,'GUARD-P','Product','portion')",[ids.product]);});
after(async()=>{await db?.close();});
async function order(){const id=randomUUID();await db.query<Record<string,unknown>>("insert into customer_orders(id,store_id,customer_id,delivery_date,shift) values($1,$2,$3,'2026-11-18','AM')",[id,ids.store,identities.a]);return id;}
test('publish/revise/review require an explicit matching version and review rejects null approval without changing state',async()=>{
 await assert.rejects(()=>rpc('publish_recipe',[ids.version,null,null,null,randomUUID()]),/VERSION_CONFLICT/);
 await assert.rejects(()=>rpc('revise_recipe',[ids.recipe,null,'2026-11-18',1,ids.unit,[{material_id:ids.material,quantity:'1',unit_id:ids.unit}],randomUUID()]),/VERSION_CONFLICT/);
 const id=await order();await assert.rejects(()=>rpc('review_order',[id,null,true,'',randomUUID()]),/VERSION_CONFLICT/);
 await assert.rejects(()=>rpc('review_order',[id,1,null,'',randomUUID()]),/INVALID_APPROVAL/);
 assert.equal((await db.query<Record<string,unknown>>('select status from customer_orders where id=$1',[id])).rows[0].status,'submitted');
 assert.equal((await db.query<Record<string,unknown>>('select count(*)::int count from recipe_versions where recipe_id=$1',[ids.recipe])).rows[0].count,1);
});
test('linking two 40-unit orders into a 50-unit plan rejects the second and replay never reserves twice',async()=>{
 await db.query<Record<string,unknown>>("insert into production_plans(id,delivery_date,production_date,shift) values($1,'2026-11-18','2026-11-18','AM')",[ids.plan]);await db.query<Record<string,unknown>>('insert into production_plan_lines(plan_id,product_id,planned_quantity) values($1,$2,50)',[ids.plan,ids.product]);
 const orders=[await order(),await order()];for(const id of orders){await db.query<Record<string,unknown>>("update customer_orders set status='approved' where id=$1",[id]);await db.query<Record<string,unknown>>('insert into customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate) values($1,$2,40,10000,0)',[id,ids.product]);}
 const key=randomUUID();await rpc('schedule_order',[orders[0],ids.plan,key]);await rpc('schedule_order',[orders[0],ids.plan,key]);
 await assert.rejects(()=>rpc('schedule_order',[orders[1],ids.plan,randomUUID()]),/PLAN_QUANTITY_INSUFFICIENT/);
 assert.equal((await db.query<Record<string,unknown>>('select plan_id from customer_orders where id=$1',[orders[1]])).rows[0].plan_id,null);
 assert.equal((await db.query<Record<string,unknown>>('select planned_quantity::text quantity from production_plan_lines where plan_id=$1',[ids.plan])).rows[0].quantity,'50.000000');
});

test('cash account setup uses catalog permissions and cannot relabel a cash account with ledger history as a bank',async()=>{
 const input={code:'GUARD-CASH',name:'Cash desk',kind:'cash',archived:false};
 await assert.rejects(()=>asUser(db,identities.accountant,()=>db.query('select save_catalog($1,null,null,$2,$3)',['bank_accounts',input,randomUUID()])),/FORBIDDEN/);
 const saved=await asUser(db,identities.admin,()=>db.query<{result:{id:string}}> ('select save_catalog($1,null,null,$2,$3) result',['bank_accounts',input,randomUUID()]));const id=saved.rows[0].result.id;
 await db.query("insert into cash_ledger(account_id,occurred_on,direction,amount_vnd,note) values($1,'2026-11-18','in',1000,'Opening balance fixture')",[id]);
 await assert.rejects(()=>rpc('save_catalog',['bank_accounts',id,1,{kind:'bank'},randomUUID()]),/BANK_ACCOUNT_KIND_IMMUTABLE/);
 await rpc('save_catalog',['bank_accounts',id,1,{name:'Renamed cash desk'},randomUUID()]);
 assert.equal((await db.query<{kind:string}>('select kind from bank_accounts where id=$1',[id])).rows[0].kind,'cash');
});

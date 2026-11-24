import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';

type Saved={recipe_id:string;version_id:string;toppings_ready?:boolean};
type Option={version_id:string;code:string;name:string;unit:string};
type Config={product_id:string;required:boolean;unavailable_count:number;options:Option[]};
type Allocation={version_id:string;quantity:string};
let db:PGlite;let unit:string;let material:string;let date:string;let earlier:string;
let phone=100;
const call=async<T>(name:string,args:unknown[],user=identities.admin)=>(await asUser(db,user,()=>db.query<{result:T}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args))).rows[0].result;
async function anon<T>(name:string,args:unknown[]){
 await db.exec('begin;set local role anon;');
 await db.query("select set_config('request.jwt.claim.sub','',true)");
 try{const result=(await db.query<{result:T}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;await db.exec('commit');return result;}
 catch(error){await db.exec('rollback');throw error;}
}
const metadata=(code:string,kind='product',effective=date)=>({code,name:'Synthetic '+code,kind,effective_from:effective,output_quantity:'1',output_unit_id:unit});
const ingredient=(quantity='1')=>({material_id:material,child_version_id:null,quantity,unit_id:unit});
async function save(code:string,kind='product',tops:string[]=[],previous?:Saved,items:unknown[]=[ingredient()],user=identities.admin,effective=date){
 const version=previous?(await db.query<{version:string}>('select version::text from recipes where id=$1',[previous.recipe_id])).rows[0].version:null;
 return call<Saved>('save_recipe_revision',[previous?.recipe_id??null,version,{...metadata(code,kind,effective),topping_version_ids:tops},items,'',randomUUID()],user);
}
async function product(code:string){return (await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values($1,$2,'portion',true) returning id",[code,'Synthetic '+code])).rows[0].id;}
async function price(id:string){await db.query("insert into product_prices(product_id,price_vnd,effective_from,evidence) values($1,15000,$2,'Synthetic price')",[id,earlier]);}
const catalog=()=>anon<Config[]>('public_order_topping_catalog',[date]);
const contact=()=>({name:'Synthetic topping customer',phone:'090000'+String(phone++).padStart(4,'0'),address:'Synthetic delivery address'});
const payload=(id:string,quantity='10',toppings:Allocation[]=[])=>[{product_id:id,quantity,price_vnd:'15000',toppings}];
const submit=(items:unknown[],key=randomUUID(),person=contact())=>anon<{order_id:string;status:string}>('submit_public_order_with_toppings',[date,'AM',person,items,'',null,'cash',key]);

before(async()=>{
 db=await database();
 unit=(await db.query<{id:string}>("insert into material_units(code,name,dimension) values('TOP-U','Synthetic portion','count') returning id")).rows[0].id;
 material=(await db.query<{id:string}>("insert into materials(code,name,purchase_unit_id,usage_unit_id) values('TOP-M','Synthetic topping ingredient',$1,$1) returning id",[unit])).rows[0].id;
 const dates=(await db.query<{date:string;earlier:string}>("select to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date+1,'YYYY-MM-DD') date,to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date-1,'YYYY-MM-DD') earlier")).rows[0];date=dates.date;earlier=dates.earlier;
 await db.query("insert into material_prices(material_id,basis_unit_id,amount,effective_from,verification) values($1,$2,100,$3,'verified')",[material,unit,earlier]);
});
after(async()=>{await db?.close();});

test('saved draft dish configuration overrides an older linked revision and publishes only selected topping trees',async()=>{
 const id=await product('TOP-DRAFT'),first=await save('TOP-DRAFT','product',[],undefined,undefined,undefined,earlier);
 await call('publish_recipe',[first.version_id,'1',id,'1',randomUUID()]);
 const child=await save('TOP-CHILD','sauce');
 const topping=await save('TOP-A','topping',[],undefined,[{material_id:null,child_version_id:child.version_id,quantity:'1',unit_id:unit}]);
 const unresolved=await save('TOP-UNRESOLVED','sauce');
 await db.query("insert into recipe_unresolved_items(recipe_version_id,label,quantity,unit_label,issue,sort_order) values($1,'Missing mapping',1,'portion','Needs review',1)",[unresolved.version_id]);
 const current=await save('TOP-DRAFT','product',[topping.version_id],first,[{material_id:null,child_version_id:unresolved.version_id,quantity:'1',unit_id:unit}]);
 assert.equal(current.toppings_ready,true);
 const statuses=(await db.query<{status:string}>('select status from recipe_versions where id=any($1::uuid[]) order by id',[[current.version_id,topping.version_id,child.version_id]])).rows.map(r=>r.status);
 assert.deepEqual(statuses.sort(),['draft','published','published']);
 assert.equal((await db.query<{recipe_version_id:string}>('select recipe_version_id from product_recipe_links where product_id=$1',[id])).rows[0].recipe_version_id,first.version_id);
 const row=(await catalog()).find(c=>c.product_id===id)!;
 assert.equal(row.required,true);assert.equal(row.unavailable_count,0);assert.equal(row.options[0].version_id,topping.version_id);
 assert.deepEqual(Object.keys(row.options[0]).sort(),['code','name','unit','version_id']);
 assert.doesNotMatch(JSON.stringify(row),/cost|material_id|recipe_items|review_issue/);
 const capability=await anon<{schema_version:number;rows:Config[]}>('public_order_topping_catalog_v2',[date]);
 assert.equal(capability.schema_version,1);assert.deepEqual(capability.rows,await catalog());
 assert.doesNotMatch(JSON.stringify(capability),/cost|material_id|recipe_items|review_issue/);
});

test('anonymous submission requires a complete valid allocation and snapshots each split topping cost once',async()=>{
 const id=await product('TOP-SPLIT');await price(id);
 const a=await save('TOP-SPLIT-A','topping'),b=await save('TOP-SPLIT-B','topping',[],undefined,[ingredient('2')]);
 const dish=await save('TOP-SPLIT','product',[a.version_id,b.version_id]);
 for(const toppings of [[],[{version_id:a.version_id,quantity:'3'}]])await assert.rejects(()=>submit(payload(id,'10',toppings)),/TOPPING_REQUIRED/);
 await assert.rejects(()=>submit(payload(id,'10',[{version_id:a.version_id,quantity:'11'}])),/TOPPING_ALLOCATION_EXCEEDS_ORDER_QUANTITY/);
 await assert.rejects(()=>submit(payload(id,'10',[{version_id:randomUUID(),quantity:'10'}])),/TOPPING_NOT_AVAILABLE/);
 await assert.rejects(()=>submit(payload(id,'10',[{version_id:a.version_id,quantity:'0'}])),/INVALID_TOPPING_ALLOCATION/);
 await assert.rejects(()=>submit(payload(id,'10',[{version_id:a.version_id,quantity:'5'},{version_id:a.version_id,quantity:'5'}])),/DUPLICATE_TOPPING/);
 const foreign=await product('TOP-FOREIGN');await price(foreign);await save('TOP-FOREIGN');
 await assert.rejects(()=>submit(payload(foreign,'10',[{version_id:a.version_id,quantity:'10'}])),/TOPPING_NOT_AVAILABLE/);
 assert.equal((await db.query('select * from customer_orders')).rows.length,0,'rejected attempts must not leave orders');
 const key=randomUUID(),person=contact(),items=payload(id,'10',[{version_id:a.version_id,quantity:'3'},{version_id:b.version_id,quantity:'7'}]);
 const accepted=await submit(items,key,person);
 assert.equal(accepted.status,'submitted');assert.deepEqual(await submit(items,key,person),accepted);
 const snapshots=(await db.query<{topping_version_id:string;quantity:string;cost_vnd:string;cost_complete:boolean}>("select t.topping_version_id,t.quantity::text,t.cost_vnd::text,t.cost_complete from customer_order_item_toppings t join customer_order_items i on i.id=t.order_item_id where i.order_id=$1 order by t.topping_code",[accepted.order_id])).rows;
 assert.deepEqual(snapshots,[{topping_version_id:a.version_id,quantity:'3.000',cost_vnd:'300.00',cost_complete:true},{topping_version_id:b.version_id,quantity:'7.000',cost_vnd:'1400.00',cost_complete:true}]);
 const prices=(await db.query<{price_vnd:string;discount_rate:string}>('select price_vnd::text,discount_rate::text from customer_order_items where order_id=$1',[accepted.order_id])).rows[0];
 assert.equal(prices.price_vnd,'15000');assert.equal(Number(prices.discount_rate),0);
 for(const table of ['production_plans','inventory_movements','sales_documents'])assert.equal((await db.query('select * from '+table)).rows.length,0);
 await save('TOP-SPLIT','product',[],dish);
 assert.equal((await catalog()).find(c=>c.product_id===id),undefined,'unticking all options must not restore historical options');
 assert.deepEqual(await submit(items,key,person),accepted,'completed request retains its original selection after configuration changes');
 assert.deepEqual((await db.query('select topping_version_id,quantity::text,cost_vnd::text,cost_complete from customer_order_item_toppings order by topping_code')).rows,snapshots);
 await assert.rejects(()=>submit(payload(id,'10'),key,person),/IDEMPOTENCY_CONFLICT/);
});

test('saved unpublished selections remain visible as unavailable and never expose mutable topping versions',async()=>{
 await db.query("insert into user_permissions(user_id,module,action,allowed) values($1,'recipes','create',true),($1,'materials','view',true)",[identities.a]);
 const id=await product('TOP-PENDING');await price(id);
 const draft=await save('TOP-PENDING-A','topping');
 const dish=await save('TOP-PENDING','product',[draft.version_id],undefined,undefined,identities.a);
 assert.equal(dish.toppings_ready,false);
 assert.equal((await db.query<{status:string}>('select status from recipe_versions where id=$1',[draft.version_id])).rows[0].status,'draft');
 const row=(await catalog()).find(c=>c.product_id===id)!;
 assert.equal(row.required,true);assert.equal(row.unavailable_count,1);assert.deepEqual(row.options,[]);
 await assert.rejects(()=>submit(payload(id,'1',[{version_id:draft.version_id,quantity:'1'}])),/TOPPING_NOT_AVAILABLE/);
 await assert.rejects(()=>anon('public_order_topping_catalog',[null]),/INVALID_FILTER/);
});

test('invalid topping publication rolls back the saved dish configuration and keeps draft history intact',async()=>{
 const topping=await save('TOP-BAD-A','topping');
 await db.query("insert into recipe_unresolved_items(recipe_version_id,label,quantity,unit_label,issue,sort_order) values($1,'Missing mapping',1,'portion','Needs review',1)",[topping.version_id]);
 await assert.rejects(()=>save('TOP-BAD','product',[topping.version_id]),/RECIPE_NEEDS_REVIEW/);
 assert.equal((await db.query("select * from recipes where code='TOP-BAD'")).rows.length,0);
 assert.equal((await db.query<{status:string}>('select status from recipe_versions where id=$1',[topping.version_id])).rows[0].status,'draft');
});

test('all legacy public submit entry points reject missing required toppings but replay earlier accepted orders',async()=>{
 const id=await product('TOP-LEGACY');await price(id);const original=await save('TOP-LEGACY');
 const person=contact(),key=randomUUID(),plain=payload(id,'1').map(item=>({product_id:item.product_id,quantity:item.quantity,price_vnd:item.price_vnd}));
 const originalArgs=[date,'AM',person,plain,'',key];
 const accepted=await anon('submit_public_order',originalArgs);
 const topping=await save('TOP-LEGACY-A','topping');await save('TOP-LEGACY','product',[topping.version_id],original);
 assert.deepEqual(await anon('submit_public_order',originalArgs),accepted);
 await assert.rejects(()=>submit(payload(id,'1',[{version_id:topping.version_id,quantity:'1'}]),key,person),/IDEMPOTENCY_CONFLICT/);
 assert.equal((await db.query('select * from customer_order_item_toppings t join customer_order_items i on i.id=t.order_item_id where i.order_id=$1',[(accepted as {order_id:string}).order_id])).rows.length,0,'a legacy request key cannot amend an earlier order with toppings');
 const calls:[string,unknown[]][]=[
  ['submit_public_order',[date,'AM',contact(),plain,'',randomUUID()]],
  ['submit_store_link_order',[date,'AM',contact(),plain,'','a'.repeat(64),randomUUID()]],
  ['submit_public_order_v2',[date,'AM',contact(),plain,'','cash',randomUUID()]],
  ['submit_store_link_order_v2',[date,'AM',contact(),plain,'','a'.repeat(64),'bank',randomUUID()]],
 ];
 for(const [name,args] of calls)await assert.rejects(()=>anon(name,args),/TOPPING_REQUIRED/);
 assert.equal((await db.query('select * from customer_orders where id=$1',[(accepted as {order_id:string}).order_id])).rows.length,1);
});

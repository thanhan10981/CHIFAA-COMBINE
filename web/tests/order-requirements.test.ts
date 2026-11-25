import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Decimal from 'decimal.js';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';

// KH-01/KH-10/KH-12: approved customer orders are a demand source even when
// approval could not schedule production before the sale conversion existed.
const start='2094-03-01',deliveryDay='2094-03-03',nextDeliveryDay='2094-03-04';
const ids={kg:randomUUID(),each:randomUUID(),slice:randomUUID(),rice:randomUUID(),wrapper:randomUUID(),warehouse:randomUUID(),product:randomUUID(),cancelled:randomUUID(),historical:randomUUID(),store:randomUUID()};
let db:PGlite,recipe:string;
const approvedOrders:string[]=[];
type Row=Record<string,unknown>;
type Demand={date:string;products:{product_id:string;quantity:string}[];issues:{issue:string;product_id?:string}[];materials:{material_id:string;quantity:string;stock_quantity:string|null;sources:{product_id:string;quantity:string}[]}[]};
type Workspace={materials:{material_id:string;quantity:string|null}[];sources:Row[];plan_id:string|null;approved_plans:Row[];batches:Row[]};
const rpc=async<T=Row>(name:string,args:unknown[],user=identities.admin)=>(await asUser(db,user,()=>db.query<{r:T}>(`select public.${name}(${args.map((_,index)=>'$'+(index+1)).join(',')}) r`,args))).rows[0].r;
const demand=(date=deliveryDay,user=identities.admin)=>rpc<Demand>('order_material_demand',[date],user);
const workspace=(mode='planned',user=identities.admin)=>rpc<Workspace>('production_material_workspace',[ids.warehouse,deliveryDay,deliveryDay,mode],user);
const submit=async(quantity:string,date=deliveryDay)=>rpc<{order_id:string}>('submit_order',[ids.store,date,'AM',[{product_id:ids.product,quantity}],'Synthetic order requirement fixture',randomUUID()],identities.a);
const operationalTables=['customer_orders','customer_order_items','production_plans','production_plan_lines','production_plan_revisions','production_batches','production_batch_lines','ingredient_requirement_snapshots','inventory_movements','inventory_movement_lines','consumption_report_snapshots','audit_logs','data_versions'] as const;
async function operationalSnapshot(){
 const rows:Record<string,unknown[]>={};
 for(const table of operationalTables)rows[table]=(await db.query(`select * from public.${table} t order by to_jsonb(t)::text`)).rows;
 return rows;
}
function assertNoProductionDemand(report:Workspace){
 assert.deepEqual(report.sources,[]);
 assert.deepEqual(report.approved_plans,[]);
 assert.equal(report.plan_id,null);
 assert.ok(report.materials.every(material=>material.quantity===null||new Decimal(material.quantity).isZero()));
}

before(async()=>{
 db=await database();
 await db.query("insert into material_units(id,code,name,dimension) values($1,'OREQ-KG','Synthetic kilogram','mass'),($2,'OREQ-EACH','Synthetic wrapper unit','count'),($3,'OREQ-SLICE','Synthetic slice','count')",[ids.kg,ids.each,ids.slice]);
 await db.query("insert into materials(id,code,name,usage_unit_id,purchase_unit_id) values($1,'OREQ-RICE','Synthetic requirement rice',$3,$3),($2,'OREQ-WRAP','Synthetic requirement wrapper',$4,$4)",[ids.rice,ids.wrapper,ids.kg,ids.each]);
 await db.query("insert into warehouses(id,code,name,kind) values($1,'OREQ-W','Synthetic requirement warehouse','ingredient')",[ids.warehouse]);
 await db.query("insert into products(id,code,name,sale_unit,published) values($1,'OREQ-MEAL','Synthetic whole meal','OREQ-WHOLE',true),($2,'OREQ-CANCELLED','Synthetic removed line','OREQ-WHOLE',false),($3,'OREQ-HISTORY','Synthetic historical slice','OREQ-SLICE',false)",[ids.product,ids.cancelled,ids.historical]);
 await db.query("insert into stores(id,code,name) values($1,'OREQ-S','Synthetic requirement store')",[ids.store]);
 await db.query('insert into store_users(store_id,user_id) values($1,$2)',[ids.store,identities.a]);
 await db.query('insert into store_product_prices(store_id,product_id,price_vnd,effective_from) values($1,$2,12000,$3)',[ids.store,ids.product,start]);
 const saved=await rpc<{version_id:string}>('save_recipe',[{code:'OREQ-MEAL',name:'Synthetic six-slice batch',kind:'product',effective_from:start,output_quantity:'6',output_unit_id:ids.slice},[{material_id:ids.rice,quantity:'0.6',unit_id:ids.kg},{material_id:ids.wrapper,quantity:'2',unit_id:ids.each}],randomUUID()]);
 recipe=saved.version_id;
 await rpc('publish_recipe',[recipe,'1',null,null,randomUUID()]);
 await rpc('post_inventory',[ids.warehouse,start,'receipt',[{material_id:ids.rice,unit_id:ids.kg,quantity:'10'},{material_id:ids.wrapper,unit_id:ids.each,quantity:'100'}],'Synthetic opening stock',randomUUID()]);
 await db.query('insert into product_recipe_links(product_id,recipe_version_id,output_quantity_per_product,effective_from) values($1,$2,1,$3)',[ids.historical,recipe,start]);
 await rpc('post_production',[ids.warehouse,'2094-03-02',[{product_id:ids.historical,recipe_version_id:recipe,main_quantity:'6',extra_quantity:'0',rejected_quantity:'0'}],randomUUID()]);
});
after(async()=>{await db?.close();});

test('approved unscheduled orders become full dated material demand after a verified sale conversion without creating a plan or production',async()=>{
 for(const [quantity,date] of [['2',deliveryDay],['1',deliveryDay],['5',nextDeliveryDay]]){
  const submitted=await submit(quantity,date);
  if(approvedOrders.length===0)await db.query('insert into customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate,cancelled_at) values($1,$2,999,0,0,now())',[submitted.order_id,ids.cancelled]);
  const reviewed=await rpc<{status:string;plan_id:string|null}>('review_order',[submitted.order_id,'1',true,'',randomUUID()]);
  assert.equal(reviewed.status,'approved');assert.equal(reviewed.plan_id,null);
  approvedOrders.push(submitted.order_id);
 }
 const pending=await submit('99');
 const state=(await db.query<{status:string;plan_id:string|null;created_on:string;delivery_date:string}>("select status,plan_id,(created_at at time zone 'Asia/Ho_Chi_Minh')::date::text created_on,delivery_date::text from customer_orders order by id")).rows;
 assert.equal(state.filter(order=>order.status==='approved'&&order.plan_id===null).length,3);
 assert.ok(state.every(order=>order.created_on!==order.delivery_date),'delivery date, rather than creation date, selects requirement orders');
 const beforeLink=await demand();
 assert.deepEqual(beforeLink.materials,[]);
 assert.equal(beforeLink.issues.length,1);assert.equal(beforeLink.issues[0].issue,'PRODUCT_RECIPE_RATIO_REQUIRED');
 assert.equal(beforeLink.products.length,1);assert.equal(new Decimal(beforeLink.products[0].quantity).toString(),'3');
 assertNoProductionDemand(await workspace());

 const version=(await db.query<{version:string}>('select version::text from products where id=$1',[ids.product])).rows[0].version;
 await rpc('save_commercial_terms',['recipe',ids.product,version,{date:deliveryDay,recipe_version_id:recipe,quantity:'6',evidence:'Synthetic verified six recipe slices per whole sale'},randomUUID()]);
 const protectedRows=await operationalSnapshot();
 assert.ok(protectedRows.ingredient_requirement_snapshots.length>=2,'the fixture protects non-empty historical snapshots');
 assert.equal(protectedRows.production_plans.length,0);

 const report=await demand();
 assert.equal(report.date,deliveryDay);assert.deepEqual(report.issues,[]);
 assert.deepEqual(report.products.map(product=>[product.product_id,new Decimal(product.quantity).toString()]),[[ids.product,'3']]);
 assert.equal(report.materials.length,2);
 for(const [material,quantity,stock] of [[ids.rice,'1.8','9.4'],[ids.wrapper,'6','98']] as const){
  const line=report.materials.find(item=>item.material_id===material)!;
  assert.ok(line);assert.equal(new Decimal(line.quantity).toString(),quantity);
  assert.equal(new Decimal(line.stock_quantity!).toString(),stock);
  assert.deepEqual(line.sources.map(source=>[source.product_id,new Decimal(source.quantity).toString()]),[[ids.product,quantity]]);
 }
 assertNoProductionDemand(await workspace());
 const actual=await workspace('actual');assertNoProductionDemand(actual);assert.deepEqual(actual.batches,[]);
 const nextDay=await demand(nextDeliveryDay);
 assert.deepEqual(nextDay.issues,[]);assert.equal(new Decimal(nextDay.products[0].quantity).toString(),'5');
 assert.equal(new Decimal(nextDay.materials.find(material=>material.material_id===ids.rice)!.quantity).toString(),'3');
 const beforeDelivery=await demand('2094-03-02');assert.deepEqual(beforeDelivery.products,[]);assert.deepEqual(beforeDelivery.materials,[]);assert.deepEqual(beforeDelivery.issues,[]);
 assert.deepEqual(await demand(),report,'repeated reads cannot append or duplicate order requirements');
 assert.deepEqual(await operationalSnapshot(),protectedRows,'requirement reads must not change orders, plans, posted inventory, production, snapshots or audit');
 assert.equal((await db.query<{status:string}>('select status from customer_orders where id=$1',[pending.order_id])).rows[0].status,'submitted');
 assert.ok((await db.query<{plan_id:string|null}>('select plan_id from customer_orders where id=any($1::uuid[])',[approvedOrders])).rows.every(order=>order.plan_id===null));
});

test('approved order requirements require live orders view permission separately from planned production access',async()=>{
 for(const scope of ['orders','requirements','inventory','production'])await db.query("insert into user_permissions(user_id,module,action,allowed) values($1,$2,'view',true)",[identities.accountant,scope]);
 const allowed=await demand(deliveryDay,identities.accountant);assert.equal(allowed.materials.length,2);
 await db.query("update user_permissions set allowed=false where user_id=$1 and module='orders' and action='view'",[identities.accountant]);
 const protectedRows=await operationalSnapshot();
 await assert.rejects(()=>demand(deliveryDay,identities.accountant),/FORBIDDEN/);
 assertNoProductionDemand(await workspace('planned',identities.accountant));
 await assert.rejects(()=>demand(deliveryDay,identities.a),/FORBIDDEN/);
 assert.deepEqual(await operationalSnapshot(),protectedRows);
});

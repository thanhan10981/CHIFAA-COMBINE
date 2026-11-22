import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import type {PGlite} from '@electric-sql/pglite';import {database,asUser,identities} from './database-fixture';
let db:PGlite;const ids={g:randomUUID(),kg:randomUUID(),portion:randomUUID(),rice:randomUUID(),warehouse:randomUUID(),product:randomUUID(),storeA:randomUUID(),storeB:randomUUID(),plan:randomUUID()};let riceVersion:string,productVersion:string,orderA:string;
const rpc=async(name:string,args:unknown[],user=identities.admin)=>asUser(db,user,()=>db.query<{result:Record<string,unknown>}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args));
before(async()=>{
 db=await database();
 for(const [id,code,dimension] of [[ids.g,'g','mass'],[ids.kg,'kg','mass'],[ids.portion,'portion','count']])await db.query('insert into material_units(id,code,name,dimension) values($1,$2,$2,$3)',[id,code,dimension]);
 await db.query("insert into materials(id,code,name,usage_unit_id,purchase_unit_id) values($1,'RICE','Gạo',$2,$3)",[ids.rice,ids.g,ids.kg]);
 await db.query("insert into unit_conversions(material_id,from_unit_id,to_unit_id,factor,verified,evidence) values($1,$2,$3,1000,true,'Physical kg to g')",[ids.rice,ids.kg,ids.g]);
 await db.query("insert into material_prices(material_id,basis_unit_id,amount,effective_from,verification) values($1,$2,16000,'2020-01-01','verified')",[ids.rice,ids.kg]);
 await db.query("insert into warehouses(id,code,name,kind) values($1,'ING','Kho nguyên liệu','ingredient')",[ids.warehouse]);
 await db.query("insert into products(id,code,name,sale_unit,published) values($1,'PRODUCT','Cơm','phần',true)",[ids.product]);
 for(const [id,code,user] of [[ids.storeA,'STORE-A',identities.a],[ids.storeB,'STORE-B',identities.b]]){await db.query('insert into stores(id,code,name) values($1,$2,$2)',[id,code]);await db.query('insert into store_users(store_id,user_id) values($1,$2)',[id,user]);await db.query("insert into store_product_prices(store_id,product_id,price_vnd,effective_from) values($1,$2,$3,'2020-01-01')",[id,ids.product,code==='STORE-A'?15000:17000]);}
});after(async()=>{await db?.close();});

test('count worksheet pages with a string version and rejects missing tokens or non-finite counts atomically',async()=>{
 const snapshot=(await rpc('stock_count_snapshot',[ids.warehouse,'2026-11-17','RICE',0])).rows[0].result;
 assert.equal(typeof snapshot.inventory_version,'string');
 assert.equal((snapshot.rows as {code:string}[])[0].code,'RICE');
 await assert.rejects(()=>rpc('stock_count_snapshot',[ids.warehouse,'2026-11-17','',0],identities.a),/FORBIDDEN/);
 await assert.rejects(()=>rpc('stock_count_snapshot',[ids.warehouse,'2026-11-17','',-1]),/INVALID_FILTER/);
 const original=(await db.query('select * from stock_counts')).rows.length;
 await assert.rejects(()=>rpc('post_stock_count',[ids.warehouse,'2026-11-17',[{material_id:ids.rice,counted_quantity:'0'}],null,randomUUID()]),/INVENTORY_VERSION_CONFLICT/);
 for(const bad of ['NaN','Infinity','-1','1.1234567',''])await assert.rejects(()=>rpc('post_stock_count',[ids.warehouse,'2026-11-17',[{material_id:ids.rice,counted_quantity:bad}],snapshot.inventory_version,randomUUID()]),/INVALID_COUNT_QUANTITY/);
 await assert.rejects(()=>rpc('post_stock_count',[randomUUID(),'2026-11-17',[{material_id:ids.rice,counted_quantity:'0'}],snapshot.inventory_version,randomUUID()]),/INGREDIENT_WAREHOUSE_REQUIRED/);
 assert.equal((await db.query('select * from stock_counts')).rows.length,original);
 const key=randomUUID(),args=[ids.warehouse,'2026-11-17',[{material_id:ids.rice,counted_quantity:'0'}],snapshot.inventory_version,key];
 const zero=(await rpc('post_stock_count',args)).rows[0].result;
 assert.equal(zero.movement_id,null);
 assert.deepEqual((await rpc('post_stock_count',args)).rows[0].result,zero);
 assert.equal((await db.query('select * from stock_counts')).rows.length,original+1);
});
test('multilevel recipes preserve configured cooked yield and exact unit/price basis; cycle is rejected',async()=>{
 const child=(await rpc('save_recipe',[{code:'RICE-COOKED',name:'Cơm chín',kind:'rice',effective_from:'2020-01-01',output_quantity:2500,output_unit_id:ids.g},[{material_id:ids.rice,quantity:1000,unit_id:ids.g}],randomUUID()])).rows[0].result;riceVersion=String(child.version_id);
 await rpc('publish_recipe',[riceVersion,1,null,null,randomUUID()]);
 const parent=(await rpc('save_recipe',[{code:'RICE-PORTION',name:'Cơm phần',kind:'product',effective_from:'2020-01-01',output_quantity:1,output_unit_id:ids.portion},[{child_version_id:riceVersion,quantity:100,unit_id:ids.g}],randomUUID()])).rows[0].result;productVersion=String(parent.version_id);
 const bom=await asUser(db,identities.admin,()=>db.query<{quantity:string;unit_cost:string}>("select * from recipe_bom($1,2,'2026-11-17')",[productVersion]));assert.equal(Number(bom.rows[0].quantity),80);assert.equal(Number(bom.rows[0].unit_cost),16);
 await rpc('publish_recipe',[productVersion,1,ids.product,1,randomUUID()]);
 const a=randomUUID(),b=randomUUID(),av=randomUUID(),bv=randomUUID();await db.query("insert into recipes(id,code,name,kind) values($1,'CYCLE-A','A','sauce'),($2,'CYCLE-B','B','sauce')",[a,b]);await db.query("insert into recipe_versions(id,recipe_id,revision,effective_from,output_quantity,output_unit_id) values($1,$2,1,'2020-01-01',1,$5),($3,$4,1,'2020-01-01',1,$5)",[av,a,bv,b,ids.g]);await db.query('insert into recipe_items(recipe_version_id,child_version_id,quantity,unit_id) values($1,$2,1,$3)',[av,bv,ids.g]);await assert.rejects(()=>db.query('insert into recipe_items(recipe_version_id,child_version_id,quantity,unit_id) values($1,$2,1,$3)',[bv,av,ids.g]),/RECIPE_CYCLE/);
});
test('production posts main+extra, snapshots BOM/cost and issues inventory once; stock failure rolls back',async()=>{
 await rpc('post_inventory',[ids.warehouse,'2026-11-16','receipt',[{material_id:ids.rice,unit_id:ids.kg,quantity:10,unit_cost:16}],'Opening verified fixture',randomUUID()]);
 const key=randomUUID(),lines=[{product_id:ids.product,recipe_version_id:productVersion,main_quantity:100,extra_quantity:30,rejected_quantity:5}];const first=await rpc('post_production',[ids.warehouse,'2026-11-17',lines,key]);const retry=await rpc('post_production',[ids.warehouse,'2026-11-17',lines,key]);assert.deepEqual(first.rows[0].result,retry.rows[0].result);
 const balance=await asUser(db,identities.admin,()=>db.query<{quantity:string}>("select * from inventory_balance($1,'2026-11-17')",[ids.warehouse]));assert.equal(Number(balance.rows[0].quantity),4800);
 const snapshots=await db.query<{quantity:string;unit_cost:string}>('select * from ingredient_requirement_snapshots');assert.equal(Number(snapshots.rows[0].quantity),5200);assert.equal(Number(snapshots.rows[0].unit_cost),16);
 await db.query("insert into material_prices(material_id,basis_unit_id,amount,effective_from,verification) values($1,$2,18000,'2026-11-18','verified')",[ids.rice,ids.kg]);assert.equal(Number((await db.query<{unit_cost:string}>('select unit_cost from ingredient_requirement_snapshots')).rows[0].unit_cost),16);
 const before=await db.query('select * from production_batches');await assert.rejects(()=>rpc('post_production',[ids.warehouse,'2026-11-17',[{...lines[0],main_quantity:10000}],randomUUID()]),/INSUFFICIENT_STOCK/);assert.equal((await db.query('select * from production_batches')).rows.length,before.rows.length);
});
test('count adjusts stock without rewriting history; stale inventory version and locked period reject',async()=>{
 const version=Number((await db.query<{version:string}>("select version from data_versions where module='inventory'")).rows[0].version),before=(await db.query('select * from inventory_movements')).rows.length;
 await rpc('post_stock_count',[ids.warehouse,'2026-11-17',[{material_id:ids.rice,counted_quantity:4700}],version,randomUUID()]);assert.equal((await db.query('select * from inventory_movements')).rows.length,before+1);
 await assert.rejects(()=>rpc('post_stock_count',[ids.warehouse,'2026-11-17',[{material_id:ids.rice,counted_quantity:4600}],version,randomUUID()]),/INVENTORY_VERSION_CONFLICT/);
 await db.exec("insert into accounting_periods(starts_on,ends_on,status) values('2026-11-17','2026-11-17','closed')");await assert.rejects(()=>rpc('post_inventory',[ids.warehouse,'2026-11-17','receipt',[{material_id:ids.rice,unit_id:ids.g,quantity:1}],'Locked',randomUUID()]),/PERIOD_CLOSED/);
});
test('material conversions keep date history and verified price rows cannot be overwritten',async()=>{
 const conversion=(await db.query<{id:string;version:string}>('select id,version from unit_conversions where material_id=$1',[ids.rice])).rows[0],price=(await db.query<{id:string;version:string}>('select id,version from material_prices where material_id=$1 order by effective_from limit 1',[ids.rice])).rows[0];
 await assert.rejects(()=>rpc('save_catalog',['unit_conversions',conversion.id,Number(conversion.version),{factor:900},randomUUID()]),/UNIT_RATIO_MISMATCH/);
 await assert.rejects(()=>rpc('save_catalog',['material_prices',price.id,Number(price.version),{amount:1},randomUUID()]),/PRICE_VERSION_IMMUTABLE/);
 await assert.rejects(()=>rpc('save_catalog',['materials',null,null,{code:'MISSING-PRICE',name:'Missing',price_status:'verified'},randomUUID()]),/VERIFIED_PRICE_ROW_REQUIRED/);
 await assert.rejects(()=>db.query("insert into material_prices(material_id,basis_unit_id,amount,effective_from,verification) values($1,$2,null,'2099-01-01','verified')",[ids.rice,ids.kg]),/check constraint/);
});
test('customer A cannot see prices/orders of B, internal recipe/payroll or submit to another store',async()=>{
 const date='2090-01-01';const own=await asUser(db,identities.a,()=>db.query<{price_vnd:string}>('select * from portal_catalog($1,$2)',[ids.storeA,date]));assert.equal(own.rows[0].price_vnd,'15000');await assert.rejects(()=>asUser(db,identities.a,()=>db.query('select * from portal_catalog($1,$2)',[ids.storeB,date])),/FORBIDDEN/);
 await asUser(db,identities.a,async()=>{assert.equal((await db.query('select * from recipes')).rows.length,0);assert.equal((await db.query('select * from payroll_lines')).rows.length,0);assert.equal((await db.query('select * from store_product_prices')).rows.length,0);});
 const key=randomUUID(),items=[{product_id:ids.product,quantity:100,price_vnd:1,discount_rate:1}],first=await rpc('submit_order',[ids.storeA,date,'AM',items,'Fixture',key],identities.a);orderA=String(first.rows[0].result.order_id);assert.equal((await rpc('submit_order',[ids.storeA,date,'AM',items,'Fixture',key],identities.a)).rows[0].result.order_id,orderA);
 assert.equal((await db.query<{price_vnd:string}>('select price_vnd from customer_order_items where order_id=$1',[orderA])).rows[0].price_vnd,15000);
 await asUser(db,identities.b,async()=>{assert.equal((await db.query('select * from customer_orders where id=$1',[orderA])).rows.length,0);assert.equal((await db.query('select * from customer_order_items where order_id=$1',[orderA])).rows.length,0);});
 await assert.rejects(()=>rpc('submit_order',[ids.storeB,date,'AM',items,'Tamper',randomUUID()],identities.a),/FORBIDDEN/);
});
test('approval/scheduling audit statuses but never creates revenue or double-adds a manual plan',async()=>{
 await assert.rejects(()=>rpc('review_order',[orderA,1,true,'',randomUUID()],identities.b),/FORBIDDEN/);
 await rpc('review_order',[orderA,1,true,'',randomUUID()]);await db.query("insert into production_plans(id,delivery_date,production_date,shift) values($1,'2090-01-01','2089-12-31','AM')",[ids.plan]);await db.query('insert into production_plan_lines(plan_id,product_id,planned_quantity) values($1,$2,100)',[ids.plan,ids.product]);
 const key=randomUUID();await rpc('schedule_order',[orderA,ids.plan,key]);await rpc('schedule_order',[orderA,ids.plan,key]);assert.equal(Number((await db.query<{planned_quantity:string}>('select planned_quantity from production_plan_lines where plan_id=$1',[ids.plan])).rows[0].planned_quantity),100);
 await assert.rejects(()=>rpc('schedule_order',[orderA,ids.plan,randomUUID()]),/ORDER_ALREADY_LINKED/);assert.equal((await db.query('select * from sales_documents')).rows.length,0);assert.equal((await db.query('select * from cash_ledger')).rows.length,0);assert.equal((await db.query('select * from order_status_history where order_id=$1',[orderA])).rows.length,3);
});
test('order delivery consumes finished goods once and return support never restores stock or posts money',async()=>{
 const today=(await db.query<{date:string}>("select (now() at time zone 'Asia/Ho_Chi_Minh')::date::text date")).rows[0].date;
 const batch=(await db.query<{id:string}>('insert into production_batches(warehouse_id,produced_on,delivery_date,status) values($1,$2,$2,$3) returning id',[ids.warehouse,today,'posted'])).rows[0].id;
 await db.query('insert into production_batch_lines(batch_id,product_id,recipe_version_id,main_quantity,extra_quantity,rejected_quantity) values($1,$2,$3,100,0,0)',[batch,ids.product,productVersion]);
 const available=Number((await db.query<{balance:string}>('select private.finished_goods_balance($1,$2) balance',[ids.product,today])).rows[0].balance),overQuantity=available+1;
 const overOrder=String((await rpc('submit_order',[ids.storeA,today,'PM',[{product_id:ids.product,quantity:overQuantity}],'Over-stock fixture',randomUUID()],identities.a)).rows[0].result.order_id);
 assert.equal(Number((await db.query<{quantity:string}>('select quantity from customer_order_items where order_id=$1',[overOrder])).rows[0].quantity),overQuantity);
 await rpc('review_order',[overOrder,1,true,'',randomUUID()]);
 await assert.rejects(()=>rpc('fulfill_order_delivery',[overOrder,2,randomUUID()]),/INSUFFICIENT_FINISHED_GOODS/);
 assert.equal((await db.query('select * from deliveries where order_id=$1',[overOrder])).rows.length,0);
 const deliveryOrder=String((await rpc('submit_order',[ids.storeA,today,'AM',[{product_id:ids.product,quantity:100}],'Delivery fixture',randomUUID()],identities.a)).rows[0].result.order_id);
 await rpc('review_order',[deliveryOrder,1,true,'',randomUUID()]);
 const beforeMovements=(await db.query('select * from inventory_movements')).rows.length,key=randomUUID(),orderVersion=Number((await db.query<{version:string}>('select version from customer_orders where id=$1',[deliveryOrder])).rows[0].version),args=[deliveryOrder,orderVersion,key];
 const delivered=(await rpc('fulfill_order_delivery',args)).rows[0].result;
 assert.equal(delivered.status,'fulfilled');
 assert.deepEqual((await rpc('fulfill_order_delivery',args)).rows[0].result,delivered);
 assert.equal((await db.query<{status:string}>('select status from customer_orders where id=$1',[deliveryOrder])).rows[0].status,'fulfilled');
 assert.equal((await db.query('select * from deliveries where order_id=$1 and status=$2',[deliveryOrder,'posted'])).rows.length,1);
 assert.equal((await db.query('select * from delivery_items where delivery_id=$1',[delivered.delivery_id])).rows.length,1);
 assert.equal((await db.query('select * from inventory_movements')).rows.length,beforeMovements,'delivery does not issue raw ingredients a second time');
 assert.equal(Number((await db.query<{balance:string}>('select private.finished_goods_balance($1,$2) balance',[ids.product,today])).rows[0].balance),available-100);
 const detail=(await rpc('order_delivery_detail',[deliveryOrder])).rows[0].result as {delivery:{id:string};items:{delivery_item_id:string;returned_quantity:string}[]};
 const lineId=detail.items[0].delivery_item_id,supportKey=randomUUID();
 const support=(await rpc('record_order_return_support',[detail.delivery.id,today,[{delivery_item_id:lineId,quantity:15,support_unit_price_vnd:12345}],'Hỗ trợ hàng hoàn',supportKey])).rows[0].result;
 assert.equal(support.total_support_vnd,'185175');assert.equal(support.inventory_returned,false);assert.equal(support.automatically_paid,false);
 assert.equal(Number((await db.query<{balance:string}>('select private.finished_goods_balance($1,$2) balance',[ids.product,today])).rows[0].balance),available-100);
 await assert.rejects(()=>rpc('record_order_return_support',[detail.delivery.id,today,[{delivery_item_id:lineId,quantity:86,support_unit_price_vnd:1}],'Excess return',randomUUID()]),/RETURN_QUANTITY_EXCEEDS_DELIVERY/);
 const saved=(await db.query<{id:string;version:string}>('select id,version from order_return_supports where delivery_id=$1',[detail.delivery.id])).rows[0];
 await rpc('reverse_order_return_support',[saved.id,Number(saved.version),today,'Điều chỉnh chứng từ hỗ trợ',randomUUID()]);
 const afterReverse=(await rpc('order_delivery_detail',[deliveryOrder])).rows[0].result as {items:{returned_quantity:string}[]};
 assert.equal(afterReverse.items[0].returned_quantity,'0');
 assert.equal(Number((await db.query<{balance:string}>('select private.finished_goods_balance($1,$2) balance',[ids.product,today])).rows[0].balance),available-100);
 assert.equal((await db.query('select * from sales_documents')).rows.length,0);
 assert.equal((await db.query('select * from cash_ledger')).rows.length,0);
});
test('Portal capacity and unavailable-product validation roll back the entire order',async()=>{
 await db.exec("insert into app_settings(key,value) values('order_policy','{\"daily_capacity\":5}')");
 const before=(await db.query('select * from customer_orders')).rows.length;
 await assert.rejects(()=>rpc('submit_order',[ids.storeA,'2090-01-02','AM',[{product_id:ids.product,quantity:6}],'Capacity',randomUUID()],identities.a),/DAILY_CAPACITY/);
 await assert.rejects(()=>rpc('submit_order',[ids.storeA,'2090-01-02','AM',[{product_id:randomUUID(),quantity:1}],'Unknown',randomUUID()],identities.a),/PRODUCT_NOT_AVAILABLE/);
 assert.equal((await db.query('select * from customer_orders')).rows.length,before);
 await db.exec("delete from app_settings where key='order_policy'");
});
test('recipe revision creates a new version and preserves the published BOM',async()=>{
 const recipe=(await db.query<{id:string;version:string}>('select r.id,r.version from recipes r join recipe_versions v on v.recipe_id=r.id where v.id=$1',[productVersion])).rows[0],payload=[{child_version_id:riceVersion,quantity:120,unit_id:ids.g}];
 const revised=await rpc('revise_recipe',[recipe.id,Number(recipe.version),'2026-12-01',1,ids.portion,payload,randomUUID()]);assert.equal(revised.rows[0].result.revision,2);
 const old=await asUser(db,identities.admin,()=>db.query<{quantity:string}>("select * from recipe_bom($1,1,'2026-11-17')",[productVersion]));assert.equal(Number(old.rows[0].quantity),40);
 await assert.rejects(()=>rpc('revise_recipe',[recipe.id,Number(recipe.version),'2027-01-01',1,ids.portion,payload,randomUUID()]),/VERSION_CONFLICT/);
});
test('SI conversion and confirmed package ratios work both ways without inventing oil density or price basis',async()=>{
 const l=randomUUID(),ml=randomUUID(),can=randomUUID(),oil=randomUUID();await db.query("insert into material_units(id,code,name,dimension) values($1,'l','Litre','volume'),($2,'ml','Millilitre','volume'),($3,'can','Can','package')",[l,ml,can]);await db.query("insert into materials(id,code,name,usage_unit_id) values($1,'OIL','Oil',$2)",[oil,ml]);
 assert.equal(Number((await db.query<{quantity:string}>('select private.convert_quantity($1,$2,$3,1000) quantity',[ids.rice,ids.g,ids.kg])).rows[0].quantity),1);
 await db.query("insert into unit_conversions(material_id,from_unit_id,to_unit_id,factor,verified,evidence) values($1,$2,$3,5000,true,'Confirmed five litre package')",[oil,can,ml]);
 assert.equal(Number((await db.query<{quantity:string}>('select private.convert_quantity($1,$2,$3,1) quantity',[oil,can,ml])).rows[0].quantity),5000);
 assert.equal(Number((await db.query<{quantity:string}>('select private.convert_quantity($1,$2,$3,5000) quantity',[oil,ml,can])).rows[0].quantity),1);
 await assert.rejects(()=>db.query('select private.convert_quantity($1,$2,$3,1)',[oil,l,ids.kg]),/UNIT_NEEDS_VERIFICATION/);
 await assert.rejects(()=>db.query("insert into unit_conversions(material_id,from_unit_id,to_unit_id,factor,verified,evidence) values($1,$2,$3,900,true,'Invalid kg gram factor')",[oil,ids.kg,ids.g]),/UNIT_RATIO_MISMATCH/);
 await assert.rejects(()=>db.query("insert into material_prices(material_id,basis_unit_id,amount,effective_from,verification) values($1,$2,16,'2020-01-01','verified')",[ids.rice,ids.g]),/unique constraint/);
});
test('cost API returns exact decimal strings and missing prices stay unknown',async()=>{
 const known=(await rpc('recipe_cost',[productVersion,'2','2026-11-17'])).rows[0].result;assert.equal(known.total_vnd,'1280');assert.equal(known.complete,true);
 await db.query("insert into material_prices(material_id,basis_unit_id,effective_from,verification) values($1,$2,'2099-01-01','needs_verification')",[ids.rice,ids.kg]);
 const unknown=(await rpc('recipe_cost',[productVersion,'2','2099-01-01'])).rows[0].result;assert.equal(unknown.total_vnd,null);assert.equal(unknown.complete,false);
});
test('a recipe cannot publish using a child version that is only effective in the future',async()=>{
 const child=(await rpc('save_recipe',[{code:'FUTURE-CHILD',name:'Future child',kind:'rice',effective_from:'2099-01-01',output_quantity:1,output_unit_id:ids.g},[{material_id:ids.rice,quantity:1,unit_id:ids.g}],randomUUID()])).rows[0].result;await rpc('publish_recipe',[child.version_id,1,null,null,randomUUID()]);
 const parent=(await rpc('save_recipe',[{code:'PAST-PARENT',name:'Past parent',kind:'product',effective_from:'2020-01-01',output_quantity:1,output_unit_id:ids.portion},[{child_version_id:child.version_id,quantity:1,unit_id:ids.g}],randomUUID()])).rows[0].result;
 await assert.rejects(()=>rpc('publish_recipe',[parent.version_id,1,null,null,randomUUID()]),/CHILD_RECIPE_NOT_EFFECTIVE/);
 assert.equal((await db.query<{status:string}>('select status from recipe_versions where id=$1',[parent.version_id])).rows[0].status,'draft');
});

import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';

// KH-01/KH-10/KH-11: formula quantities, cost, approval and reports share the
// verified material specification while posted inventory keeps its own unit.
const day='2090-01-02',start='2090-01-01';
let db:PGlite,parent:string,packaging:string,approvedOrder:string;
const ids={bag:randomUUID(),piece:randomUUID(),can:randomUUID(),g:randomUUID(),kg:randomUUID(),portion:randomUUID(),sticks:randomUUID(),sauce:randomUUID(),warehouse:randomUUID(),product:randomUUID(),decoy:randomUUID(),store:randomUUID()};
type Row=Record<string,unknown>;
type Recipe={recipe_id:string;version_id:string};
type DetailLine={target_id:string;formula_unit:string|null;formula_quantity:string|null;formula_verified:boolean;formula_converted:string|null;formula_effective_from:string|null;formula_source_unit:string|null;unit_cost_vnd:string|null;line_cost_vnd:string|null};
type Material={material_id:string;unit_code:string;quantity:string;stock_quantity:string|null;minimum_quantity:string|null;shortage_quantity:string|null;sources:{product_id:string;quantity:string}[]};
type Demand={materials:Material[];issues:Row[];products:{product_id:string;quantity:string}[]};
type Preview={complete:boolean;materials:{material_id:string;unit:string;quantity:string;stock:string|null;shortage:string|null;package:{usage_per_package:string|null}}[];sources:{material_id:string;unit_id:string;quantity:string;issue?:string}[]};
const rpc=async<T=Row>(name:string,args:unknown[],user=identities.admin)=>(await asUser(db,user,()=>db.query<{r:T}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args))).rows[0].r;
const resolve=async(material:string,unit:string,formula:string,quantity:string,effective=start)=>{
 const version=(await db.query<{version:string}>('select version from materials where id=$1',[material])).rows[0].version;
 return rpc('resolve_material',[material,version,effective,{purchase_unit_id:unit,usage_unit_id:unit,basis_unit_id:unit,amount:material===ids.sauce?'10000':'12000',verification:'verified',package_unit_id:null,package_content_unit_id:null,package_quantity:null,package_verified:false,formula_unit_id:formula,formula_quantity:quantity,evidence:'Synthetic owner-verified formula specification',issue:''},randomUUID()]);
};
const recipe=(code:string,kind:string,items:Row[],effective=start)=>rpc<Recipe>('save_recipe_revision',[null,null,{code,name:code,kind,effective_from:effective,output_quantity:'1',output_unit_id:ids.portion},items,'Synthetic verified recipe fixture',randomUUID()]);
const demand=()=>rpc<Demand>('order_material_demand',[day]);
before(async()=>{
 db=await database();
 for(const [key,code,dimension] of [['bag','FORM-BAG','package'],['piece','FORM-PIECE','count'],['can','FORM-CAN','package'],['g','g','mass'],['kg','kg','mass'],['portion','FORM-PORTION','count']] as const)await db.query('insert into material_units(id,code,name,dimension) values($1,$2,$2,$3)',[ids[key],code,dimension]);
 await db.query("insert into materials(id,code,name,usage_unit_id,purchase_unit_id,minimum_quantity) values($1,'FORM-STICKS','Synthetic sticks',$2,$2,0.5),($3,'FORM-SAUCE','Synthetic sauce',$4,$4,0.2)",[ids.sticks,ids.bag,ids.sauce,ids.can]);
 await db.query("insert into warehouses(id,code,name,kind) values($1,'FORM-W','Synthetic formula warehouse','ingredient')",[ids.warehouse]);
 await db.query("insert into products(id,code,name,sale_unit,published) values($1,'FORM-MEAL','Synthetic meal','FORM-PORTION',true),($2,'FORM-REMOVED','Synthetic removed item','FORM-PORTION',true)",[ids.product,ids.decoy]);
 await db.query("insert into stores(id,code,name) values($1,'FORM-STORE','Synthetic formula store')",[ids.store]);
 await db.query('insert into store_users(store_id,user_id) values($1,$2)',[ids.store,identities.a]);
 await db.query('insert into store_product_prices(store_id,product_id,price_vnd,effective_from) values($1,$2,15000,$3)',[ids.store,ids.product,start]);
});
after(async()=>{await db?.close();});

test('formula-only specification publishes nested recipes and reports approved demand in formula units without inventory writes',async()=>{
 await resolve(ids.sticks,ids.bag,ids.piece,'100');await resolve(ids.sauce,ids.can,ids.g,'1000');
 assert.equal((await db.query('select * from unit_conversions where material_id in($1,$2)',[ids.sticks,ids.sauce])).rows.length,0,'formula verification must not create an inventory ratio');
 await assert.rejects(()=>db.query('select private.convert_quantity_at($1,$2,$3,1,$4)',[ids.sticks,ids.bag,ids.piece,day]),/UNIT_NEEDS_VERIFICATION/);
 const child=await recipe('FORM-PACK','packaging',[{material_id:ids.sticks,quantity:'1',unit_id:ids.piece}]);packaging=child.version_id;
 const meal=await recipe('FORM-MEAL','product',[{child_version_id:packaging,quantity:'1',unit_id:ids.portion},{material_id:ids.sauce,quantity:'0.05',unit_id:ids.kg}]);parent=meal.version_id;
 await rpc('publish_recipe',[parent,'1',ids.product,'1',randomUUID()]);
 assert.deepEqual((await db.query<{status:string}>('select status from recipe_versions where id in($1,$2)',[packaging,parent])).rows.map(row=>row.status),['published','published']);
 const packagingDetail=await rpc<{lines:DetailLine[]}>('recipe_detail',[packaging,day]);
 const sticks=packagingDetail.lines.find(line=>line.target_id===ids.sticks)!;
 assert.equal(sticks.formula_unit,'FORM-PIECE');assert.equal(sticks.formula_verified,true);assert.equal(Number(sticks.formula_quantity),100);assert.equal(Number(sticks.formula_converted),1);assert.equal(sticks.formula_effective_from,start);assert.equal(sticks.formula_source_unit,'FORM-BAG');
 assert.equal(Number(sticks.unit_cost_vnd),120);assert.equal(Number(sticks.line_cost_vnd),120);
 const sauce=(await rpc<{lines:DetailLine[]}>('recipe_detail',[parent,day])).lines.find(line=>line.target_id===ids.sauce)!;
 assert.equal(sauce.formula_unit,'g');assert.equal(Number(sauce.formula_converted),50,'0.05kg must bridge through the verified 1000g per can');
 assert.equal(Number(sauce.unit_cost_vnd),10000);assert.equal(Number(sauce.line_cost_vnd),500);
 const cost=await rpc<{complete:boolean;total_vnd:string;lines:{unit:string;quantity:string}[]}>('recipe_cost',[parent,'1',day]);
 assert.equal(cost.complete,true);assert.equal(cost.total_vnd,'620');assert.deepEqual(cost.lines.map(line=>[line.unit,Number(line.quantity)]).sort(),[['FORM-BAG',0.01],['FORM-CAN',0.05]]);
 await rpc('post_inventory',[ids.warehouse,start,'receipt',[{material_id:ids.sticks,unit_id:ids.bag,quantity:'2',unit_cost:'12000'},{material_id:ids.sauce,unit_id:ids.can,quantity:'1',unit_cost:'10000'}],'Synthetic opening stock',randomUUID()]);
 const stockBefore=(await db.query('select * from inventory_movement_lines order by id')).rows;
 const submitted=await rpc<{order_id:string}>('submit_order',[ids.store,day,'AM',[{product_id:ids.product,quantity:'10'}],'Synthetic formula order',randomUUID()],identities.a);approvedOrder=submitted.order_id;
 await db.query('insert into customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate,cancelled_at) values($1,$2,999,0,0,now())',[approvedOrder,ids.decoy]);
 const reviewed=await rpc<{status:string;plan_id:string}>('review_order',[approvedOrder,'1',true,'',randomUUID()]);assert.equal(reviewed.status,'scheduled');assert.ok(reviewed.plan_id);
 const report=await demand();assert.deepEqual(report.issues,[]);assert.equal(report.materials.length,2);
 for(const [material,unit,quantity,stock,minimum] of [[ids.sticks,'FORM-PIECE',10,200,50],[ids.sauce,'g',500,1000,200]] as const){
  const row=report.materials.find(item=>item.material_id===material)!;assert.equal(row.unit_code,unit);assert.equal(Number(row.quantity),quantity);assert.equal(Number(row.stock_quantity),stock);assert.equal(Number(row.minimum_quantity),minimum);assert.equal(Number(row.shortage_quantity),0);
  assert.equal(row.sources.length,1);assert.equal(row.sources[0].product_id,ids.product);assert.equal(Number(row.sources[0].quantity),quantity);
 }
 const preview=await rpc<Preview>('production_plan_requirements',[ids.warehouse,day,null,'replace',[]]);assert.equal(preview.complete,true);
 for(const [material,unit,quantity,stock,perPackage] of [[ids.sticks,'FORM-PIECE',10,200,100],[ids.sauce,'g',500,1000,1000]] as const){
  const row=preview.materials.find(item=>item.material_id===material)!;assert.equal(row.unit,unit);assert.equal(Number(row.quantity),quantity);assert.equal(Number(row.stock),stock);assert.equal(Number(row.package.usage_per_package),perPackage);
  const sources=preview.sources.filter(source=>source.material_id===material);assert.equal(sources.length,1);assert.equal(Number(sources[0].quantity),quantity);
 }
 assert.deepEqual((await db.query('select * from inventory_movement_lines order by id')).rows,stockBefore,'approval and demand reads cannot consume inventory');
 await assert.rejects(()=>demandAsCustomer(),/FORBIDDEN/);await assert.rejects(()=>rpc('production_plan_requirements',[ids.warehouse,day,null,'replace',[]],identities.a),/FORBIDDEN/);
 await assert.rejects(()=>rpc('recipe_cost',[parent,'1',day],identities.a),/FORBIDDEN/);
 await assert.rejects(()=>rpc('resolve_material',[ids.sticks,'2',day,{},randomUUID()],identities.a),/FORBIDDEN/);
});
const demandAsCustomer=()=>rpc('order_material_demand',[day],identities.a);

test('order demand includes approved, scheduled and fulfilled quantities once and excludes cancelled orders/lines',async()=>{
 for(const [status,quantity] of [['approved',2],['fulfilled',3],['cancelled',9]] as const){
  const order=(await db.query<{id:string}>('insert into customer_orders(store_id,customer_id,delivery_date,shift,status) values($1,$2,$3,\'PM\',$4) returning id',[ids.store,identities.a,day,status])).rows[0].id;
  await db.query('insert into customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate) values($1,$2,$3,15000,0)',[order,ids.product,quantity]);
 }
 const report=await demand();assert.deepEqual(report.issues,[]);assert.equal(Number(report.products[0].quantity),15);assert.equal(Number(report.materials.find(row=>row.material_id===ids.sticks)?.quantity),15);assert.equal(Number(report.materials.find(row=>row.material_id===ids.sauce)?.quantity),750);
});

test('missing or future formula verification blocks publication precisely and remains incomplete rather than zero',async()=>{
 const material=(await db.query<{id:string}>("insert into materials(code,name,usage_unit_id,purchase_unit_id) values('FORM-UNVERIFIED','Synthetic unverified sticks',$1,$1) returning id",[ids.bag])).rows[0].id;
 await assert.rejects(()=>recipe('FORM-INVALID','product',[{material_id:material,quantity:'1',unit_id:ids.piece}]),/UNIT_NEEDS_VERIFICATION/);
 const missing=await recipe('FORM-MISSING','product',[{material_id:material,quantity:'1',unit_id:ids.bag}]);
 // Emulate the pre-existing draft from the incident. Current recipe saves
 // already reject an unverified formula unit; publication must guard it too.
 await db.query('update recipe_items set unit_id=$1 where recipe_version_id=$2',[ids.piece,missing.version_id]);
 await assert.rejects(()=>rpc('publish_recipe',[missing.version_id,'1',null,null,randomUUID()]),error=>{
  assert.match(String(error),/UNIT_NEEDS_VERIFICATION\|material=FORM-UNVERIFIED/);assert.match(String(error),/date=2090-01-01/);return true;
 });
 const incomplete=await rpc<{complete:boolean;total_vnd:string|null;issue:string;issue_detail:string}>('recipe_cost',[missing.version_id,'1',start]);assert.equal(incomplete.complete,false);assert.equal(incomplete.total_vnd,null);assert.equal(incomplete.issue,'UNIT_NEEDS_VERIFICATION');assert.match(incomplete.issue_detail,/material=FORM-UNVERIFIED/);
 await resolve(material,ids.bag,ids.piece,'100',day);
 await assert.rejects(()=>rpc('publish_recipe',[missing.version_id,'1',null,null,randomUUID()]),error=>{
  assert.match(String(error),/date=2090-01-01/);assert.match(String(error),/formula_from=2090-01-02/);return true;
 });
 assert.equal((await db.query<{status:string}>('select status from recipe_versions where id=$1',[missing.version_id])).rows[0].status,'draft');
 const original=await rpc<{lines:DetailLine[]}>('recipe_detail',[missing.version_id,start]);assert.equal(original.lines[0].formula_verified,false);
 const usableChild=await recipe('FORM-EFFECTIVE-CH','packaging',[{material_id:material,quantity:'1',unit_id:ids.piece}],day);
 const usable=await recipe('FORM-EFFECTIVE','product',[{child_version_id:usableChild.version_id,quantity:'1',unit_id:ids.portion}],day);
 const product=(await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values('FORM-EFFECTIVE','Synthetic missing stock','FORM-PORTION',true) returning id")).rows[0].id;
 await rpc('publish_recipe',[usable.version_id,'1',product,'1',randomUUID()]);
 assert.equal((await db.query<{status:string}>('select status from recipe_versions where id=$1',[usableChild.version_id])).rows[0].status,'published');
 const preview=await rpc<Preview>('production_plan_requirements',[ids.warehouse,'2090-01-03',null,'replace',[{product_id:product,quantity:'1'}]]);assert.equal(preview.complete,true);assert.equal(preview.materials[0].stock,null);assert.equal(preview.materials[0].shortage,null);
 // Synthetic legacy published fixture: the current guard must return an issue
 // for imported historical recipes whose formula conversion is unavailable.
 await db.query('update recipe_versions set status=\'published\' where id=$1',[missing.version_id]);
 const legacy=(await db.query<{id:string}>("insert into products(code,name,sale_unit) values('FORM-MISSING','Synthetic legacy recipe','FORM-PORTION') returning id")).rows[0].id;
 const needs=(await db.query<{r:{issue:string;issue_detail:string}[]}>('select private.planning_needs($1,$2) r',[start,[{product_id:legacy,quantity:'1'}]])).rows[0].r;assert.equal(needs.length,1);assert.equal(needs[0].issue,'UNIT_NEEDS_VERIFICATION');assert.match(needs[0].issue_detail,/material=FORM-UNVERIFIED/);
});

test('production snapshots and stock amounts stay unchanged after later formula verification',async()=>{
 await rpc('post_production',[ids.warehouse,day,[{product_id:ids.product,recipe_version_id:parent,main_quantity:'10',extra_quantity:'0',rejected_quantity:'0'}],randomUUID()]);
 const snapshots=(await db.query('select * from ingredient_requirement_snapshots order by id')).rows;
 const movements=(await db.query('select * from inventory_movement_lines order by id')).rows;
 assert.ok(snapshots.length>=2);await resolve(ids.sticks,ids.bag,ids.piece,'200','2090-01-03');
 await demand();await rpc('recipe_detail',[packaging,'2090-01-03']);
 assert.deepEqual((await db.query('select * from ingredient_requirement_snapshots order by id')).rows,snapshots);assert.deepEqual((await db.query('select * from inventory_movement_lines order by id')).rows,movements);
 const stock=(await db.query<{quantity:string}>('select private.inventory_quantity($1,$2,$3,$4)::text quantity',[ids.warehouse,day,ids.sticks,ids.bag])).rows[0].quantity;assert.equal(Number(stock),1.9);
});

test('formula price basis is costed exactly and contradictory verified ratios are rejected',async()=>{
 const material=(await db.query<{id:string;version:string}>("insert into materials(code,name,usage_unit_id,purchase_unit_id) values('FORM-PRICE','Synthetic price per piece',$1,$1) returning id,version",[ids.bag])).rows[0];
 const input={purchase_unit_id:ids.bag,usage_unit_id:ids.bag,basis_unit_id:ids.piece,amount:'120',verification:'verified',package_unit_id:ids.bag,package_content_unit_id:ids.piece,package_quantity:'90',package_verified:true,formula_unit_id:ids.piece,formula_quantity:'100',issue:''};
 await assert.rejects(()=>rpc('resolve_material',[material.id,material.version,start,input,randomUUID()]),/UNIT_RATIO_MISMATCH/);
 await rpc('resolve_material',[material.id,material.version,start,{...input,package_unit_id:null,package_content_unit_id:null,package_quantity:null,package_verified:false},randomUUID()]);
 const row=await recipe('FORM-PRICE-RECIPE','product',[{material_id:material.id,quantity:'1',unit_id:ids.piece}]);
 await rpc('publish_recipe',[row.version_id,'1',null,null,randomUUID()]);
 const cost=await rpc<{complete:boolean;total_vnd:string}>('recipe_cost',[row.version_id,'1',day]);assert.equal(cost.complete,true);assert.equal(cost.total_vnd,'120');
});

test('base and topping formula needs aggregate while one unresolved topping leaves other quantities readable',async()=>{
 const topping=await recipe('FORM-TOPPING','topping',[{material_id:ids.sticks,quantity:'1',unit_id:ids.piece}]);
 await rpc('publish_recipe',[topping.version_id,'1',null,null,randomUUID()]);
 const order=(await db.query<{id:string}>("insert into customer_orders(store_id,customer_id,delivery_date,shift,status) values($1,$2,$3,'PM','approved') returning id",[ids.store,identities.a,day])).rows[0].id;
 const item=(await db.query<{id:string}>('insert into customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate) values($1,$2,3,15000,0) returning id',[order,ids.product])).rows[0].id;
 const before=await demand();
 await db.query("insert into customer_order_item_toppings(order_item_id,topping_version_id,topping_code,topping_name,topping_output_unit,quantity) values($1,$2,'FORM-TOPPING','Synthetic topping','FORM-PORTION',3)",[item,topping.version_id]);
 const complete=await demand();
 assert.equal(Number(complete.materials.find(m=>m.material_id===ids.sticks)?.quantity)-Number(before.materials.find(m=>m.material_id===ids.sticks)?.quantity),3);
 const unresolved=await recipe('FORM-TOPPING-BAD','topping',[{material_id:ids.sticks,quantity:'1',unit_id:ids.piece}]);
 await db.query("insert into recipe_unresolved_items(recipe_version_id,label,quantity,unit_label,issue,sort_order) values($1,'Unmapped topping',1,'g','Missing source',2)",[unresolved.version_id]);
 await db.query("insert into customer_order_item_toppings(order_item_id,topping_version_id,topping_code,topping_name,topping_output_unit,quantity) values($1,$2,'FORM-TOPPING-BAD','Synthetic unresolved topping','FORM-PORTION',1)",[item,unresolved.version_id]);
 const partial=await demand();assert.ok(partial.issues.some(issue=>issue.topping_code==='FORM-TOPPING-BAD'&&issue.issue==='RECIPE_NEEDS_REVIEW'));
 assert.deepEqual(partial.materials,complete.materials);
});

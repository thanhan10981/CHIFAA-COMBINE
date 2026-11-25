import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';

// KH-01/KH-10/KH-11/KH-12: publishing today's edited formula must prepare
// dated drafts as one audited transaction and preserve pinned history.
const originalDay='2091-02-01',publicationDay='2091-02-09';
const ids={bag:randomUUID(),piece:randomUUID(),portion:randomUUID(),material:randomUUID(),warehouse:randomUUID(),store:randomUUID()};
type Row=Record<string,unknown>;
type Recipe={recipe_id:string;version_id:string};
type Published=Recipe&{status:string;effective_from:string;prepared_from_version_id:string};
type Demand={materials:{material_id:string;unit_code:string;quantity:string;stock_quantity:string|null;sources:{product_id:string;quantity:string}[]}[];issues:Row[]};
let db:PGlite;
const rpc=async<T=Row>(name:string,args:unknown[],user=identities.admin)=>(await asUser(db,user,()=>db.query<{r:T}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args))).rows[0].r;
const versionOf=async(id:string,table='recipe_versions')=>(await db.query<{version:string}>(`select version::text from ${table} where id=$1`,[id])).rows[0].version;
const save=async(code:string,items:Row[],kind='product',date=originalDay,previous?:Recipe)=>rpc<Recipe>('save_recipe_revision',[
 previous?.recipe_id??null,previous?await versionOf(previous.recipe_id,'recipes'):null,
 {code,name:'Synthetic '+code,kind,effective_from:date,output_quantity:'1',output_unit_id:ids.portion},items,'Synthetic forward publication evidence',randomUUID()
]);
const materialLine=(quantity='0.01',unit=ids.bag):Row=>({material_id:ids.material,unit_id:unit,quantity});
const childLine=(child:Recipe,quantity='1',extra:Row={}):Row=>({child_version_id:child.version_id,unit_id:ids.portion,quantity,...extra});
const publishAt=async(recipe:Recipe,date=publicationDay,key=randomUUID(),expected?:string,user=identities.admin)=>rpc<Published>('publish_recipe_at',[recipe.version_id,expected??await versionOf(recipe.version_id),date,key],user);
const publishedVersions=async(recipe:Recipe)=>db.query<{id:string;effective_from:string;status:string;revision:number}>("select id,effective_from::text,status,revision from recipe_versions where recipe_id=$1 and status='published' order by effective_from,revision",[recipe.recipe_id]);
const specification=async(material=ids.material,date=publicationDay)=>rpc('resolve_material',[material,await versionOf(material,'materials'),date,{
 purchase_unit_id:ids.bag,usage_unit_id:ids.bag,basis_unit_id:ids.bag,amount:'12000',verification:'verified',
 package_unit_id:null,package_content_unit_id:null,package_quantity:null,package_verified:false,
 formula_unit_id:ids.piece,formula_quantity:'100',evidence:'Synthetic verified 100 pieces per bag',issue:''
},randomUUID()]);
const snapshot=async()=>{
 const result:Record<string,unknown>={};
 for(const [table,order] of [['recipes','id'],['recipe_versions','id'],['recipe_items','id'],['recipe_unresolved_items','id'],['recipe_topping_options','id'],['product_recipe_links','id'],['private.catalog_sources','entity,entity_id,source_hash'],['idempotency_keys','actor_id,key'],['audit_logs','id'],['data_versions','module'],['inventory_movement_lines','id'],['ingredient_requirement_snapshots','id']] as const){
  result[table]=(await db.query(`select * from ${table} order by ${order}`)).rows;
 }
 return result;
};

before(async()=>{
 db=await database();
 await db.query("insert into material_units(id,code,name,dimension) values($1,'FWD-BAG','Synthetic bag','package'),($2,'FWD-PIECE','Synthetic piece','count'),($3,'FWD-PORTION','Synthetic portion','count')",[ids.bag,ids.piece,ids.portion]);
 await db.query("insert into materials(id,code,name,purchase_unit_id,usage_unit_id,minimum_quantity) values($1,'FWD-STICKS','Synthetic sticks',$2,$2,0.1)",[ids.material,ids.bag]);
 await db.query("insert into warehouses(id,code,name,kind) values($1,'FWD-W','Synthetic forward warehouse','ingredient')",[ids.warehouse]);
 await db.query("insert into stores(id,code,name) values($1,'FWD-S','Synthetic forward store')",[ids.store]);
 await db.query('insert into store_users(store_id,user_id) values($1,$2)',[ids.store,identities.a]);
 await specification();
 await rpc('post_inventory',[ids.warehouse,originalDay,'receipt',[{material_id:ids.material,unit_id:ids.bag,quantity:'2',unit_cost:'12000'}],'Synthetic opening stock',randomUUID()]);
});
after(async()=>{await db?.close();});

test('forward publication resolves the older draft incident and approved demand uses the preserved sale ratio and formula unit',async()=>{
 const child=await save('FWD-INCIDENT-PACK',[materialLine()],'packaging');
 // Emulate an imported draft that already uses pieces. Current saves reject
 // this date because the owner's verified formula ratio starts eight days later.
 await db.query('update recipe_items set quantity=1,unit_id=$1 where recipe_version_id=$2',[ids.piece,child.version_id]);
 const root=await save('FWD-INCIDENT-MEAL',[childLine(child)]);
 const product=(await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values('FWD-INCIDENT-MEAL','Synthetic forward meal','FWD-SALE-PACK',true) returning id")).rows[0].id;
 await db.query('insert into store_product_prices(store_id,product_id,price_vnd,effective_from) values($1,$2,15000,$3)',[ids.store,product,originalDay]);
 await db.query("update private.catalog_sources set source_data=source_data||$2::jsonb where entity='recipe:source' and entity_id=$1",[root.version_id,{productQuantity:'2',source_document:'Synthetic source metadata',unknown_source_field:{preserve:true}}]);
 const oldVersions=(await db.query('select * from recipe_versions where id in($1,$2) order by id',[child.version_id,root.version_id])).rows;
 const oldItems=(await db.query('select * from recipe_items where recipe_version_id in($1,$2) order by id',[child.version_id,root.version_id])).rows;
 const oldSource=(await db.query("select * from private.catalog_sources where entity='recipe:source' and entity_id=$1",[root.version_id])).rows;
 const expected=await versionOf(root.version_id);
 await assert.rejects(()=>rpc('publish_recipe',[root.version_id,expected,null,null,randomUUID()]),error=>{
  assert.match(String(error),/UNIT_NEEDS_VERIFICATION\|material=FWD-STICKS/);assert.match(String(error),/date=2091-02-01/);assert.match(String(error),/formula_from=2091-02-09/);return true;
 });
 const inventory=(await db.query('select * from inventory_movement_lines order by id')).rows;
 const result=await publishAt(root,publicationDay,randomUUID(),expected);
 assert.equal(result.status,'published');assert.equal(result.recipe_id,root.recipe_id);assert.equal(result.effective_from,publicationDay);assert.equal(result.prepared_from_version_id,root.version_id);assert.notEqual(result.version_id,root.version_id);
 assert.deepEqual((await db.query('select * from recipe_versions where id in($1,$2) order by id',[child.version_id,root.version_id])).rows,oldVersions);
 assert.deepEqual((await db.query('select * from recipe_items where recipe_version_id in($1,$2) order by id',[child.version_id,root.version_id])).rows,oldItems);
 assert.deepEqual((await db.query("select * from private.catalog_sources where entity='recipe:source' and entity_id=$1",[root.version_id])).rows,oldSource);
 const childCopies=(await publishedVersions(child)).rows;assert.equal(childCopies.length,1);assert.equal(childCopies[0].effective_from,publicationDay);
 assert.equal((await db.query<{child_version_id:string}>('select child_version_id from recipe_items where recipe_version_id=$1',[result.version_id])).rows[0].child_version_id,childCopies[0].id);
 const source=(await db.query<{source_data:Row}>("select source_data from private.catalog_sources where entity='recipe:source' and entity_id=$1 order by recorded_at desc limit 1",[result.version_id])).rows[0].source_data;
 assert.equal(source.productQuantity,'2');assert.equal(source.source_document,'Synthetic source metadata');assert.deepEqual(source.unknown_source_field,{preserve:true});
 const submitted=await rpc<{order_id:string}>('submit_order',[ids.store,publicationDay,'AM',[{product_id:product,quantity:'7'}],'Synthetic forward order',randomUUID()],identities.a);
 const reviewed=await rpc<{status:string}>('review_order',[submitted.order_id,'1',true,'',randomUUID()]);assert.equal(reviewed.status,'scheduled');
 const report=await rpc<Demand>('order_material_demand',[publicationDay]);assert.deepEqual(report.issues,[]);
 const need=report.materials.find(row=>row.material_id===ids.material)!;assert.ok(need);assert.equal(need.unit_code,'FWD-PIECE');assert.equal(Number(need.quantity),14);assert.equal(Number(need.stock_quantity),200);assert.equal(Number(need.sources[0].quantity),14);assert.equal(need.sources[0].product_id,product);
 assert.deepEqual((await db.query('select * from inventory_movement_lines order by id')).rows,inventory);
 assert.equal((await db.query('select * from ingredient_requirement_snapshots')).rows.length,0,'publication and approval do not post actual production');
});

test('shared draft descendants are prepared once across branches and toppings while published pins and cost exemptions remain exact',async()=>{
 const shared=await save('FWD-SHARED',[materialLine('0.02')],'packaging');
 const left=await save('FWD-LEFT',[childLine(shared,'2')],'packaging');
 const right=await save('FWD-RIGHT',[childLine(shared,'3')],'packaging');
 const pinned=await save('FWD-PINNED',[materialLine()],'packaging');
 await rpc('publish_recipe',[pinned.version_id,await versionOf(pinned.version_id),null,null,randomUUID()]);
 const newerPin=await save('FWD-PINNED',[materialLine('0.99')],'packaging',publicationDay,pinned);
 const topping=await save('FWD-TOPPING',[childLine(shared)],'topping');
 const root=await save('FWD-TREE',[childLine(left),childLine(right,'1',{cost_exempt:true}),childLine(pinned)]);
 // Import-era selection avoids the editor's eager topping publication, so the
 // atomic publisher must prepare this draft through the same descendant map.
 await db.query('insert into recipe_topping_options(parent_version_id,topping_recipe_id,topping_version_id,sort_order) values($1,$2,$3,0)',[root.version_id,topping.recipe_id,topping.version_id]);
 const original=(await db.query('select * from recipe_items where recipe_version_id in($1,$2,$3,$4,$5) order by id',[shared.version_id,left.version_id,right.version_id,topping.version_id,root.version_id])).rows;
 const pinRows=(await db.query('select * from recipe_versions where recipe_id=$1 order by revision',[pinned.recipe_id])).rows;
 const result=await publishAt(root);
 const sharedCopy=(await publishedVersions(shared)).rows;assert.equal(sharedCopy.length,1);assert.equal(sharedCopy[0].effective_from,publicationDay);
 for(const branch of [left,right,topping]){
  const copies=(await publishedVersions(branch)).rows;assert.equal(copies.length,1);assert.equal(copies[0].effective_from,publicationDay);
  assert.equal((await db.query<{child_version_id:string}>('select child_version_id from recipe_items where recipe_version_id=$1',[copies[0].id])).rows[0].child_version_id,sharedCopy[0].id);
 }
 const rootLines=(await db.query<{child_version_id:string;quantity:string;unit_id:string;cost_exempt:boolean;sort_order:number}>('select child_version_id,quantity::text,unit_id,cost_exempt,sort_order from recipe_items where recipe_version_id=$1 order by sort_order',[result.version_id])).rows;
 assert.deepEqual(rootLines.map(row=>[Number(row.quantity),row.unit_id,row.cost_exempt,row.sort_order]),[[1,ids.portion,false,1],[1,ids.portion,true,2],[1,ids.portion,false,3]]);
 assert.equal(rootLines[2].child_version_id,pinned.version_id);assert.notEqual(rootLines[2].child_version_id,newerPin.version_id);
 assert.deepEqual((await db.query('select * from recipe_versions where recipe_id=$1 order by revision',[pinned.recipe_id])).rows,pinRows);
 const newOption=(await db.query<{topping_version_id:string}>('select topping_version_id from recipe_topping_options where parent_version_id=$1',[result.version_id])).rows[0];assert.equal(newOption.topping_version_id,(await publishedVersions(topping)).rows[0].id);
 assert.equal((await db.query<{topping_version_id:string}>('select topping_version_id from recipe_topping_options where parent_version_id=$1',[root.version_id])).rows[0].topping_version_id,topping.version_id);
 assert.deepEqual((await db.query('select * from recipe_items where recipe_version_id in($1,$2,$3,$4,$5) order by id',[shared.version_id,left.version_id,right.version_id,topping.version_id,root.version_id])).rows,original);
 const cost=await rpc<{complete:boolean;total_vnd:string;lines:{quantity:string}[]}>('recipe_cost',[result.version_id,'1',publicationDay]);assert.equal(cost.complete,true);assert.equal(cost.total_vnd,'600');assert.equal(Number(cost.lines[0].quantity),0.11);
});

test('a same-day correction becomes the effective published revision and updates its audited product link without rewriting posted snapshots',async()=>{
 const date='2091-02-10';
 const first=await save('FWD-SAME-DAY',[materialLine()],'product',date);
 const product=(await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values('FWD-SAME-DAY','Synthetic same-day meal','FWD-PORTION',true) returning id")).rows[0].id;
 await rpc('publish_recipe',[first.version_id,await versionOf(first.version_id),product,'1',randomUUID()]);
 await rpc('post_production',[ids.warehouse,date,[{product_id:product,recipe_version_id:first.version_id,main_quantity:'1',extra_quantity:'0',rejected_quantity:'0'}],randomUUID()]);
 const oldVersion=(await db.query('select * from recipe_versions where id=$1',[first.version_id])).rows;
 const snapshots=(await db.query('select * from ingredient_requirement_snapshots order by id')).rows;
 const inventory=(await db.query('select * from inventory_movement_lines order by id')).rows;
 const revised=await save('FWD-SAME-DAY',[materialLine('0.02')],'product',date,first);
 const published=await publishAt(revised,date);
 const versions=(await publishedVersions(first)).rows;assert.equal(versions.length,2);assert.equal(versions[1].id,published.version_id);
 const link=(await db.query<{id:string;recipe_version_id:string;version:string}>('select id,recipe_version_id,version::text from product_recipe_links where product_id=$1 and effective_from=$2',[product,date])).rows;
 assert.equal(link.length,1);assert.equal(link[0].recipe_version_id,published.version_id);assert.equal(Number(link[0].version),2);
 assert.ok((await db.query("select * from audit_logs where table_name='product_recipe_links' and record_id=$1 and action='UPDATE'",[link[0].id])).rows.length>0);
 const needs=(await db.query<{r:{recipe_version_id:string;quantity:string}[]}>('select private.planning_needs($1,$2) r',[date,[{product_id:product,quantity:'3'}]])).rows[0].r;assert.equal(needs.length,1);assert.equal(needs[0].recipe_version_id,published.version_id);assert.equal(Number(needs[0].quantity),0.06);
 assert.deepEqual((await db.query('select * from recipe_versions where id=$1',[first.version_id])).rows,oldVersion);
 assert.deepEqual((await db.query('select * from ingredient_requirement_snapshots order by id')).rows,snapshots);
 assert.deepEqual((await db.query('select * from inventory_movement_lines order by id')).rows,inventory);
});

test('publication permissions, stale revisions, backward dates and cached retries enforce atomic server decisions',async()=>{
 const recipe=await save('FWD-GUARDS',[materialLine()]);
 const expected=await versionOf(recipe.version_id);
 const clean=await snapshot();
 await assert.rejects(()=>publishAt(recipe,publicationDay,randomUUID(),String(Number(expected)+1)),/VERSION_CONFLICT/);
 await assert.rejects(()=>publishAt(recipe,'2091-01-31'),/RECIPE_PUBLICATION_DATE_BEFORE_SOURCE/);
 await assert.rejects(()=>publishAt(recipe,publicationDay,randomUUID(),expected,identities.a),/FORBIDDEN/);
 assert.deepEqual(await snapshot(),clean);
 assert.equal((await db.query<{allowed:boolean}>("select has_function_privilege('anon','public.publish_recipe_at(uuid,bigint,date,uuid)','EXECUTE') allowed")).rows[0].allowed,false);
 for(const [module,action,allowed] of [['recipes','approve',true],['recipes','edit',false],['materials','view',true]] as const)await db.query('insert into user_permissions(user_id,module,action,allowed) values($1,$2,$3,$4) on conflict(user_id,module,action) do update set allowed=excluded.allowed',[identities.accountant,module,action,allowed]);
 await assert.rejects(()=>publishAt(recipe,publicationDay,randomUUID(),expected,identities.accountant),/FORBIDDEN/);
 await db.query("update user_permissions set allowed=true where user_id=$1 and module='recipes' and action='edit'",[identities.accountant]);
 await db.query("update user_permissions set allowed=false where user_id=$1 and module='materials' and action='view'",[identities.accountant]);
 await assert.rejects(()=>publishAt(recipe,publicationDay,randomUUID(),expected,identities.accountant),/FORBIDDEN/);
 const sameDate=await save('FWD-RETRY',[materialLine()],'packaging',publicationDay),key=randomUUID(),version=await versionOf(sameDate.version_id);
 const result=await publishAt(sameDate,publicationDay,key,version);assert.equal(result.version_id,sameDate.version_id);assert.notEqual(await versionOf(sameDate.version_id),version,'successful publication advances the optimistic version');
 const committed=await snapshot();
 assert.deepEqual(await publishAt(sameDate,publicationDay,key,version),result,'the completed request must replay before the now-stale version check');
 assert.deepEqual(await snapshot(),committed,'a network retry cannot duplicate copies, audit or side effects');
 await assert.rejects(()=>publishAt(sameDate,'2091-02-10',key,version),/IDEMPOTENCY_CONFLICT/);
 assert.deepEqual(await snapshot(),committed);
});

test('an unknown ratio rolls back every prepared child, publication, source, audit and request reservation',async()=>{
 const material=(await db.query<{id:string}>("insert into materials(code,name,purchase_unit_id,usage_unit_id) values('FWD-UNKNOWN','Synthetic unknown ratio',$1,$1) returning id",[ids.bag])).rows[0].id;
 const good=await save('FWD-ROLLBACK-GOOD',[materialLine()],'packaging');
 const bad=await save('FWD-ROLLBACK-BAD',[{material_id:material,unit_id:ids.bag,quantity:'1'}],'packaging');
 await db.query('update recipe_items set unit_id=$1 where recipe_version_id=$2',[ids.piece,bad.version_id]);
 const root=await save('FWD-ROLLBACK-ROOT',[childLine(good),childLine(bad)]);
 const before=await snapshot();
 await assert.rejects(()=>publishAt(root),error=>{assert.match(String(error),/UNIT_NEEDS_VERIFICATION\|material=FWD-UNKNOWN/);return true;});
 assert.deepEqual(await snapshot(),before);
 for(const row of [good,bad,root])assert.equal((await publishedVersions(row)).rows.length,0);
});

test('unresolved imported lines and recipe review flags remain blockers throughout forward preparation',async()=>{
 for(const mode of ['line','review'] as const){
  const good=await save('FWD-REVIEW-GOOD-'+mode,[materialLine()],'packaging');
  const bad=await save('FWD-REVIEW-BAD-'+mode,[materialLine()],'packaging');
  if(mode==='line')await db.query("insert into recipe_unresolved_items(recipe_version_id,label,quantity,unit_label,issue,sort_order) values($1,'Synthetic missing source',617,'FWD-PIECE','Source contradicts its label',2)",[bad.version_id]);
  else await db.query("update recipe_versions set review_issue='Synthetic unresolved source issue' where id=$1",[bad.version_id]);
  const root=await save('FWD-REVIEW-ROOT-'+mode,[childLine(good),childLine(bad)]);
  const before=await snapshot();await assert.rejects(()=>publishAt(root),/RECIPE_NEEDS_REVIEW/);assert.deepEqual(await snapshot(),before);
  assert.equal((await publishedVersions(good)).rows.length,0);assert.equal((await publishedVersions(bad)).rows.length,0);
 }
});

test('saving a current dish prepares its old selected draft topping and same-day publication prepares older BOM children',async()=>{
 const topping=await save('FWD-SAVE-TOPPING',[materialLine()],'topping');
 const child=await save('FWD-SAVE-CHILD',[materialLine()],'packaging');
 for(const row of [topping,child])await db.query('update recipe_items set quantity=1,unit_id=$1 where recipe_version_id=$2',[ids.piece,row.version_id]);
 const toppingBefore=(await db.query('select * from recipe_versions where id=$1',[topping.version_id])).rows;
 const root=await rpc<Recipe&{toppings_ready:boolean}>('save_recipe_revision',[null,null,{
  code:'FWD-SAVE-MEAL',name:'Synthetic current dish',kind:'product',effective_from:publicationDay,
  output_quantity:'1',output_unit_id:ids.portion,topping_version_ids:[topping.version_id]
 },[childLine(child)],'Synthetic edited dish',randomUUID()]);
 assert.equal(root.toppings_ready,true);
 const selected=(await db.query<{topping_version_id:string}>('select topping_version_id from recipe_topping_options where parent_version_id=$1',[root.version_id])).rows[0].topping_version_id;
 assert.notEqual(selected,topping.version_id);assert.equal((await publishedVersions(topping)).rows[0].id,selected);
 assert.deepEqual((await db.query('select * from recipe_versions where id=$1',[topping.version_id])).rows,toppingBefore);
 const sourceItems=(await db.query('select * from recipe_items where recipe_version_id=$1',[root.version_id])).rows;
 const result=await publishAt(root);
 assert.notEqual(result.version_id,root.version_id,'same-date root needs a new revision when its old draft child is prepared');
 assert.equal((await db.query<{status:string}>('select status from recipe_versions where id=$1',[root.version_id])).rows[0].status,'draft');
 assert.deepEqual((await db.query('select * from recipe_items where recipe_version_id=$1',[root.version_id])).rows,sourceItems);
 assert.equal((await db.query<{child_version_id:string}>('select child_version_id from recipe_items where recipe_version_id=$1',[result.version_id])).rows[0].child_version_id,(await publishedVersions(child)).rows[0].id);
 assert.equal((await db.query<{topping_version_id:string}>('select topping_version_id from recipe_topping_options where parent_version_id=$1',[result.version_id])).rows[0].topping_version_id,selected,'already-published topping stays pinned');
});

test('editing retains source sale ratios and publication advances established different-code links without stealing a reassigned product',async()=>{
 const first=await save('FWD-LINKED-FORMULA',[materialLine()]);
 await db.query("update private.catalog_sources set source_data=source_data||$2::jsonb where entity='recipe:source' and entity_id=$1",[first.version_id,{productQuantity:'2',source_document:'Synthetic imported ratio'}]);
 const products=(await db.query<{id:string;code:string}>("insert into products(code,name,sale_unit,published) values('FWD-SALE-A','Synthetic established A','FWD-SALE',true),('FWD-SALE-B','Synthetic established B','FWD-SALE',true),('FWD-SALE-SWITCHED','Synthetic reassigned product','FWD-SALE',true) returning id,code")).rows;
 const a=products.find(row=>row.code==='FWD-SALE-A')!.id,b=products.find(row=>row.code==='FWD-SALE-B')!.id,switched=products.find(row=>row.code==='FWD-SALE-SWITCHED')!.id;
 await rpc('publish_recipe',[first.version_id,await versionOf(first.version_id),a,'2',randomUUID()]);
 for(const [product,factor] of [[b,'3'],[switched,'4']] as const)await db.query('insert into product_recipe_links(product_id,recipe_version_id,output_quantity_per_product,effective_from) values($1,$2,$3,$4)',[product,first.version_id,factor,originalDay]);
 const other=await save('FWD-OTHER-FORMULA',[materialLine('0.03')]);
 await rpc('publish_recipe',[other.version_id,await versionOf(other.version_id),null,null,randomUUID()]);
 await db.query('insert into product_recipe_links(product_id,recipe_version_id,output_quantity_per_product,effective_from) values($1,$2,5,$3)',[switched,other.version_id,'2091-02-05']);
 const revised=await save('FWD-LINKED-FORMULA',[materialLine('0.02')],'product',publicationDay,first);
 const source=(await db.query<{source_data:Row}>("select source_data from private.catalog_sources where entity='recipe:source' and entity_id=$1",[revised.version_id])).rows[0].source_data;
 assert.equal(source.productQuantity,'2');assert.equal(source.source_document,'Synthetic imported ratio');
 for(const [module,action] of [['recipes','approve'],['recipes','edit'],['materials','view']] as const)await db.query('insert into user_permissions(user_id,module,action,allowed) values($1,$2,$3,true) on conflict(user_id,module,action) do update set allowed=true',[identities.accountant,module,action]);
 await db.query("insert into user_permissions(user_id,module,action,allowed) values($1,'products','view',false) on conflict(user_id,module,action) do update set allowed=false",[identities.accountant]);
 const before=await snapshot();await assert.rejects(()=>publishAt(revised,publicationDay,randomUUID(),undefined,identities.accountant),/PRODUCT_LINK_PERMISSION_REQUIRED/);assert.deepEqual(await snapshot(),before);
 const result=await publishAt(revised);
 for(const [product,factor] of [[a,2],[b,3]] as const){
  const active=(await db.query<{recipe_version_id:string;ratio:string}>('select recipe_version_id,output_quantity_per_product::text ratio from product_recipe_links where product_id=$1 and effective_from<=$2 order by effective_from desc limit 1',[product,publicationDay])).rows[0];
  assert.equal(active.recipe_version_id,result.version_id);assert.equal(Number(active.ratio),factor);
 }
 assert.equal((await db.query<{recipe_version_id:string}>('select recipe_version_id from product_recipe_links where product_id=$1 order by effective_from desc limit 1',[switched])).rows[0].recipe_version_id,other.version_id);
 const needs=(await db.query<{r:{product_id:string;recipe_version_id:string;quantity:string}[]}>('select private.planning_needs($1,$2) r',[publicationDay,[{product_id:a,quantity:'2'},{product_id:b,quantity:'2'},{product_id:switched,quantity:'2'}]])).rows[0].r;
 for(const [product,version,quantity] of [[a,result.version_id,0.08],[b,result.version_id,0.12],[switched,other.version_id,0.3]] as const){const row=needs.find(item=>item.product_id===product)!;assert.equal(row.recipe_version_id,version);assert.equal(Number(row.quantity),quantity);}
});

test('changing an explicitly linked recipe output unit cannot inherit its previous sale ratio or partially publish',async()=>{
 const first=await save('FWD-CHANGED-OUTPUT',[materialLine()]);
 await db.query("update private.catalog_sources set source_data=source_data||$2::jsonb where entity='recipe:source' and entity_id=$1",[first.version_id,{productQuantity:'2',source_document:'Synthetic old output ratio'}]);
 // Matching commercial code exercises both the older publisher's automatic
 // conversion lookup and the forward publisher's established-link handling.
 const product=(await db.query<{id:string}>("insert into products(code,name,sale_unit,published) values('FWD-CHANGED-OUTPUT','Synthetic changed output','FWD-SALE',true) returning id")).rows[0].id;
 await rpc('publish_recipe',[first.version_id,await versionOf(first.version_id),product,'2',randomUUID()]);
 const changed=await rpc<Recipe>('save_recipe_revision',[first.recipe_id,await versionOf(first.recipe_id,'recipes'),{
  code:'FWD-CHANGED-OUTPUT',name:'Synthetic changed output',kind:'product',effective_from:publicationDay,
  output_quantity:'1',output_unit_id:ids.piece
 },[materialLine('0.02')],'Synthetic changed output unit',randomUUID()]);
 const source=(await db.query<{source_data:Row}>("select source_data from private.catalog_sources where entity='recipe:source' and entity_id=$1",[changed.version_id])).rows[0].source_data;
 assert.equal(source.productQuantity,undefined,'a ratio in portions is not evidence for a ratio in pieces');
 const before=await snapshot();
 await assert.rejects(()=>publishAt(changed),/PRODUCT_RECIPE_RATIO_REQUIRED/);
 assert.deepEqual(await snapshot(),before,'invalid ratio carryover must roll back publication, new links, audit and request reservation');
 const active=(await db.query<{recipe_version_id:string;quantity:string}>('select recipe_version_id,output_quantity_per_product::text quantity from product_recipe_links where product_id=$1 order by effective_from desc limit 1',[product])).rows[0];
 assert.equal(active.recipe_version_id,first.version_id);assert.equal(Number(active.quantity),2);
 assert.equal((await db.query<{status:string}>('select status from recipe_versions where id=$1',[changed.version_id])).rows[0].status,'draft');
});

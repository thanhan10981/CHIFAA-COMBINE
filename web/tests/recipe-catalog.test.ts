import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
import {buildRecipeImport,parseRecipeSource} from '../lib/deploy/recipe-import';
let db:PGlite;const kg=randomUUID(),g=randomUUID(),portion=randomUUID(),material=randomUUID();
const call=async(name:string,args:unknown[],user=identities.admin)=>(await asUser(db,user,()=>db.query<{result:Record<string,unknown>}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args))).rows[0].result;
const metadata=(code:string,date='2026-11-17')=>({code,name:'Synthetic '+code,kind:'product',effective_from:date,output_quantity:'2',output_unit_id:portion});
const item={material_id:material,child_version_id:null,quantity:'200',unit_id:g};
const save=(code:string,items:unknown[]=[item],id:string|null=null,version:string|null=null,date='2026-11-17',key=randomUUID())=>call('save_recipe_revision',[id,version,metadata(code,date),items,'Synthetic source verified',key]);
before(async()=>{db=await database();await db.query("insert into material_units(id,code,name,dimension) values($1,'kg','Synthetic kg','mass'),($2,'g','Synthetic g','mass'),($3,'phần','Synthetic portion','count')",[kg,g,portion]);await db.query("insert into materials(id,code,name,purchase_unit_id,usage_unit_id) values($1,'R-CAT-M','Synthetic material',$2,$2)",[material,kg]);await db.query("insert into material_prices(material_id,basis_unit_id,amount,effective_from,verification) values($1,$2,10000,'2026-01-01','verified')",[material,kg]);});after(async()=>{await db?.close();});
test('recipe detail retains direct units and linked children while costing the aggregated material BOM',async()=>{
 const child=await save('R-CAT-CHILD'),parent=await save('R-CAT-PARENT',[{material_id:null,child_version_id:child.version_id,quantity:'1',unit_id:portion},item]);
 const detail=await call('recipe_detail',[parent.version_id,'2026-11-17']);const lines=detail.lines as Record<string,unknown>[];
 assert.equal(lines[0].type,'recipe');assert.equal(lines[0].quantity,'1.000000');assert.equal(lines[1].unit,'g');assert.equal(Number(lines[1].converted),.2);assert.equal((detail.cost as {total_vnd:string}).total_vnd,'3000');
 const catalog=await call('recipe_catalog',['product','2026-11-17','R-CAT-PARENT',0,25]);assert.equal(catalog.total,1);assert.equal((catalog.rows as Record<string,unknown>[])[0].code,'R-CAT-PARENT');
});
test('same-kind child recipes can be linked and recipe revisions do not require manual evidence text',async()=>{
 const child=await call('save_recipe_revision',[null,null,{...metadata('R-CAT-SAUCE'),kind:'sauce'},[item],'',randomUUID()]);
 const parent=await call('save_recipe_revision',[null,null,{...metadata('R-CAT-FILLING'),kind:'sauce'},[{material_id:null,child_version_id:child.version_id,quantity:'1',unit_id:portion},item],'',randomUUID()]);
 const detail=await call('recipe_detail',[parent.version_id,'2026-11-17']);assert.equal((detail.lines as Record<string,unknown>[])[0].type,'recipe');
 const source=(await db.query<{source_data:{evidence:string|null;audit_source:string}}>("select source_data from private.catalog_sources where entity_id=$1",[parent.version_id])).rows[0].source_data;
 assert.equal(source.evidence,null);assert.equal(source.audit_source,'recipe_editor');
});
test('explicit recipe-line cost exemption completes cost without removing the ingredient from BOM quantity',async()=>{
 const unpriced=randomUUID();await db.query("insert into materials(id,code,name,purchase_unit_id,usage_unit_id) values($1,'R-CAT-FREE','Synthetic free ingredient',$2,$2)",[unpriced,kg]);
 const row=await save('R-CAT-COST-EXEMPT',[{material_id:unpriced,child_version_id:null,quantity:'300',unit_id:g,cost_exempt:true}]);
 const cost=await call('recipe_cost',[row.version_id,'2','2026-11-17']);assert.equal(cost.complete,true);assert.equal(cost.total_vnd,'0');
 const bom=await asUser(db,identities.admin,()=>db.query<{quantity:string}>('select quantity::text from public.recipe_bom($1,2,$2)',[row.version_id,'2026-11-17']));assert.equal(bom.rows[0].quantity,'0.300000000000000000000000000000000000');
 const detail=await call('recipe_detail',[row.version_id,'2026-11-17']);assert.equal((detail.lines as Record<string,unknown>[])[0].cost_exempt,true);
});
test('mixed exempt and cost-bearing quantities of the same material keep the aggregate total exact',async()=>{
 const row=await save('R-CAT-COST-MIXED',[{...item,cost_exempt:true},{...item,cost_exempt:false}]);
 const cost=await call('recipe_cost',[row.version_id,'2','2026-11-17']);assert.equal(cost.complete,true);assert.equal(cost.total_vnd,'2000');
 const bom=await asUser(db,identities.admin,()=>db.query<{quantity:string;unit_cost:string}>('select quantity::text,unit_cost::text from public.recipe_bom($1,2,$2)',[row.version_id,'2026-11-17']));assert.equal(bom.rows[0].quantity,'0.400000000000000000000000000000000000');assert.equal(Number(bom.rows[0].unit_cost),5000);
});
test('saving a repaired child recipe refreshes editable parent links and makes parent cost current',async()=>{
 const child=await save('R-CAT-CHILD-REFRESH',[item]);
 await db.query("insert into recipe_unresolved_items(recipe_version_id,label,quantity,unit_label,issue,sort_order) values($1,'Unknown source',1,'g','Missing source code',2)",[child.version_id]);
 const parent=await save('R-CAT-PARENT-REFRESH',[{material_id:null,child_version_id:child.version_id,quantity:'1',unit_id:portion}]);
 assert.equal((await call('recipe_cost',[parent.version_id,'2','2026-11-17'])).complete,false);
 const repaired=await save('R-CAT-CHILD-REFRESH',[item],child.recipe_id as string,'1','2026-11-18');
 const linked=(await db.query<{child_version_id:string}>('select child_version_id from recipe_items where recipe_version_id=$1',[parent.version_id])).rows[0];
 assert.equal(linked.child_version_id,repaired.version_id);
 assert.equal((await call('recipe_cost',[parent.version_id,'2','2026-11-18'])).complete,true);
 assert.equal((await db.query('select * from recipe_unresolved_items where recipe_version_id=$1',[child.version_id])).rows.length,1);
});
test('unresolved imported quantities remain visible and block official BOM/publication without zero replacement',async()=>{
 const row=await save('R-CAT-REVIEW');await db.query("insert into recipe_unresolved_items(recipe_version_id,label,quantity,unit_label,issue,sort_order) values($1,'Unknown source',617,'phần','Source quantity contradicts its label',2)",[row.version_id]);
 const detail=await call('recipe_detail',[row.version_id,'2026-11-17']);assert.equal((detail.lines as unknown[]).length,2);assert.equal((detail.cost as {complete:boolean;total_vnd:null}).complete,false);assert.equal((detail.cost as {total_vnd:null}).total_vnd,null);
 await assert.rejects(()=>call('recipe_bom',[row.version_id,'1','2026-11-17']),/RECIPE_NEEDS_REVIEW/);await assert.rejects(()=>call('publish_recipe',[row.version_id,'1',null,null,randomUUID()]),/RECIPE_NEEDS_REVIEW/);
 const revised=await save('R-CAT-REVIEW',[item],row.recipe_id as string,'1','2026-11-18');assert.equal((await call('recipe_cost',[revised.version_id,'2','2026-11-18'])).complete,true);assert.equal((await db.query('select * from recipe_unresolved_items where recipe_version_id=$1',[row.version_id])).rows.length,1);
});
test('recipe full edits are atomic/idempotent, preserve old versions and reject stale or invalid quantities',async()=>{
 const key=randomUUID(),row=await save('R-CAT-REPLAY',[item],null,null,'2026-11-17',key);assert.deepEqual(await save('R-CAT-REPLAY',[item],null,null,'2026-11-17',key),row);
 await assert.rejects(()=>save('R-CAT-REPLAY',[{...item,quantity:'NaN'}]),/INVALID_QUANTITY/);
 await save('R-CAT-REPLAY',[{...item,quantity:'100'}],row.recipe_id as string,'1','2026-11-18');await assert.rejects(()=>save('R-CAT-REPLAY',[item],row.recipe_id as string,'1','2026-11-19'),/VERSION_CONFLICT/);
 assert.equal((await db.query<{q:string}>('select quantity::text q from recipe_items where recipe_version_id=$1',[row.version_id])).rows[0].q,'200.000000');
 const sameDay=await save('R-CAT-REPLAY',[item],row.recipe_id as string,'3','2026-11-18');assert.equal(sameDay.revision,3);
 const dayVersions=(await db.query<{id:string;version:string}>("select id,version::text from recipe_versions where recipe_id=$1 and effective_from='2026-11-18' order by revision",[row.recipe_id])).rows;
 await call('publish_recipe',[dayVersions[0].id,dayVersions[0].version,null,null,randomUUID()]);await assert.rejects(()=>call('publish_recipe',[dayVersions[1].id,dayVersions[1].version,null,null,randomUUID()]),/unique constraint/);
});
test('recipe-only users can read quantities but cannot see financial source or prices or bypass write permissions',async()=>{
 await db.query("insert into user_permissions values($1,'recipes','view',true)",[identities.accountant]);
 const row=await save('R-CAT-PRIVACY');const detail=await call('recipe_detail',[row.version_id,'2026-11-17'],identities.accountant);
 assert.equal(detail.source,null);assert.equal(detail.cost,null);assert.ok((detail.lines as Record<string,unknown>[]).every(l=>l.line_cost_vnd===null));
 await assert.rejects(()=>call('save_recipe_revision',[null,null,metadata('DENIED'),[item],'Source test',randomUUID()],identities.accountant),/FORBIDDEN/);
 await assert.rejects(()=>asUser(db,identities.accountant,()=>db.exec('select * from private.catalog_sources')),/permission denied/);
 await assert.rejects(()=>call('recipe_catalog',['product','2026-11-17','',-1,25]),/INVALID_QUERY/);
});
test('generated source import replays stable drafts and preserves unresolved rows without business postings',async()=>{
 const source={hash:'synthetic-recipe-source',raw:[['synthetic raw']],recipes:[{code:'R-CAT-IMPORT',name:'Synthetic import',kind:'product',output:'1',unit:'phần',issue:'Review source first',raw:[['source row']],items:[{code:'R-CAT-M',label:'Material',quantity:'10',unit:'g',raw:[]},{code:'',label:'Unknown water',quantity:'1',unit:'g',issue:'Missing source code',raw:[]}]}]};
 const sql=buildRecipeImport(source,'2026-11-17');await db.exec(sql);const first=(await db.query<{id:string}>("select id from recipes where code='R-CAT-IMPORT'")).rows;await db.exec(sql);assert.deepEqual((await db.query("select id from recipes where code='R-CAT-IMPORT'")).rows,first);
 assert.equal((await db.query<{status:string}>("select status from recipe_versions where recipe_id=$1",[first[0].id])).rows[0].status,'draft');for(const table of ['inventory_movements','product_recipe_links','sales_documents'])assert.equal((await db.query('select * from '+table)).rows.length,0);
});
test('publishing a product recipe also publishes its selected draft toppings and exposes them in the public order catalog',async()=>{
 const topping=await call('save_recipe_revision',[null,null,{...metadata('R-CAT-TOPPING'),kind:'topping'},[item],'Synthetic topping source',randomUUID()]);
 const productId=randomUUID();await db.query("insert into products(id,code,name,sale_unit,published) values($1,'R-CAT-ORDER','Synthetic order product','phần',true)",[productId]);
 const product=await call('save_recipe_revision',[null,null,{...metadata('R-CAT-ORDER'),topping_version_ids:[topping.version_id]},[item],'Synthetic product source',randomUUID()]);
 const option=(await db.query<{topping_version_id:string}>('select topping_version_id from recipe_topping_options where parent_version_id=$1',[product.version_id])).rows[0];assert.equal(option.topping_version_id,topping.version_id);
 await call('publish_recipe',[product.version_id,'1',productId,'2',randomUUID()]);
 const statuses=await db.query<{parent:string;topping:string}>("select p.status parent,t.status topping from recipe_versions p join recipe_topping_options o on o.parent_version_id=p.id join recipe_versions t on t.id=o.topping_version_id where p.id=$1",[product.version_id]);assert.deepEqual(statuses.rows,[{parent:'published',topping:'published'}]);
 const catalog=await call('public_order_topping_catalog',['2026-11-17']);const row=(catalog as unknown as {product_id:string;options:{version_id:string}[]}[]).find(x=>x.product_id===productId);assert.equal(row?.options[0]?.version_id,topping.version_id);
});
test('failed topping validation rolls back publication of both topping and product recipe',async()=>{
 const topping=await call('save_recipe_revision',[null,null,{...metadata('R-CAT-BAD-TOPPING'),kind:'topping'},[item],'Synthetic topping source',randomUUID()]);
 await db.query("insert into recipe_unresolved_items(recipe_version_id,label,quantity,unit_label,issue,sort_order) values($1,'Unresolved topping source',1,'g','Missing material mapping',2)",[topping.version_id]);
 const product=await call('save_recipe_revision',[null,null,{...metadata('R-CAT-BAD-PRODUCT'),topping_version_ids:[topping.version_id]},[item],'Synthetic product source',randomUUID()]);
 await assert.rejects(()=>call('publish_recipe',[product.version_id,'1',null,null,randomUUID()]),/RECIPE_NEEDS_REVIEW/);
 const statuses=await db.query<{parent:string;topping:string}>("select p.status parent,t.status topping from recipe_versions p join recipe_topping_options o on o.parent_version_id=p.id join recipe_versions t on t.id=o.topping_version_id where p.id=$1",[product.version_id]);assert.deepEqual(statuses.rows,[{parent:'draft',topping:'draft'}]);
});
test('sheet parser preserves blank source quantities instead of silently dropping ingredients',()=>{
 const row=(...cells:string[])=>cells.join('\t');
 const text=[row('THÔNG SỐ CHUNG'),row('Khối lượng cơm chín / 1 mẻ (g)','','','','2.000'),row('1','CƠM NẮM KIỂM THỬ','','','','1 phần','999'),row('CƠM NẮM KIỂM THỬ'),row('STT','Mã SP','Thành phần','ĐVT','Định lượng'),row('1','SYN-M','Synthetic ingredient','g',''),row('CÔNG THỨC CƠM (1 MẺ = 1 KG GẠO)'),row('STT','Mã SP','Tên','ĐVT','Định lượng'),row('1','SYN-M','','g','800'),row('CHI PHÍ BAO BÌ / 1 ĐƠN VỊ BÁN'),row('STT','Mã SP','Thành phần','ĐVT','Số lượng'),row('','','Cơm cuộn & Cơm cuộn chiên (1 hộp)'),row('1','SYN-PACK','','cái','1'),row('','','6 món cơm nắm (1 phần)'),row('1','SYN-PACK','','cái','1')].join('\n');
 const source=parseRecipeSource(text,[{code:'SYN-DISH',name:'CƠM NẮM KIỂM THỬ'}]);assert.equal(source.recipes.length,4);assert.equal(source.recipes.find(r=>r.code==='PK-CC')?.items.length,1);assert.equal(source.recipes[0].items[0].quantity,null);assert.equal(source.recipes[0].reference,'999');assert.equal(source.recipes.find(r=>r.kind==='rice')?.output,'2000');
});

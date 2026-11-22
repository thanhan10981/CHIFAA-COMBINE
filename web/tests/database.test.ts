import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
let db:PGlite;
before(async()=>{db=await database();});after(async()=>{await db?.close();});
test('all exposed tables enable RLS, and API roles have no direct business writes',async()=>{
 const missing=await db.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity");assert.equal(missing.rows.length,0);
 await assert.rejects(()=>asUser(db,identities.admin,()=>db.exec("insert into materials(code,name) values('BYPASS','Bypass')")),/permission denied/);
 await assert.rejects(()=>db.exec('set role anon;select * from public.materials'),/permission denied/);await db.exec('reset role');
 const unsafe=await db.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosecdef and not coalesce(p.proconfig,'{}') @> array['search_path=\"\"']");assert.equal(unsafe.rows.length,0);
 await assert.rejects(()=>asUser(db,identities.accountant,()=>db.query("select * from private.bom($1,1,current_date)",[randomUUID()])),/permission denied/);
});
test('catalog RPC commits audit/version, idempotently replays and rejects changed payload/version',async()=>{
 const key=randomUUID(),input={code:'TEST-GAD',name:'Gạo dẻo',minimum_quantity:null};
 const save=(id:string|null,version:number|null,value:unknown,k=key)=>asUser(db,identities.admin,()=>db.query<{result:{id:string;version:number;minimum_quantity:null}}>('select public.save_catalog($1,$2,$3,$4::jsonb,$5) result',['materials',id,version,JSON.stringify(value),k]));
 const first=(await save(null,null,input)).rows[0].result,again=(await save(null,null,input)).rows[0].result;assert.equal(first.id,again.id);assert.equal(first.minimum_quantity,null);
 assert.equal((await db.query('select * from audit_logs where record_id=$1',[first.id])).rows.length,1);
 await assert.rejects(()=>save(null,null,{...input,name:'Changed'}),/IDEMPOTENCY_CONFLICT/);
 const updated=(await save(first.id,1,{name:'Gạo dẻo mới'},randomUUID())).rows[0].result;assert.equal(updated.version,2);
 await assert.rejects(()=>save(first.id,1,{name:'Stale'},randomUUID()),/VERSION_CONFLICT/);
 assert.equal((await db.query('select * from audit_logs where record_id=$1',[first.id])).rows.length,2);
});
test('accountant cannot read payroll/materials without grants or call an Admin catalog RPC',async()=>{
 await asUser(db,identities.accountant,async()=>{assert.equal((await db.query('select * from materials')).rows.length,0);assert.equal((await db.query('select * from payroll_lines')).rows.length,0);});
 await assert.rejects(()=>asUser(db,identities.accountant,()=>db.query("select save_catalog('materials',null,null,'{\"code\":\"X\",\"name\":\"X\"}',$1)",[randomUUID()])),/FORBIDDEN/);
 await asUser(db,identities.accountant,async()=>{const access=await db.query<{access:{permissions:unknown[]}}>('select my_access() access');assert.equal(access.rows[0].access.permissions.length,0);});
});
test('constraints reject invalid money/quantities and an invalid transaction leaves no audit or replay key',async()=>{
 const key=randomUUID();await assert.rejects(()=>asUser(db,identities.admin,()=>db.query("select save_catalog('materials',null,null,'{\"code\":\"INVALID\",\"name\":\"Invalid\",\"minimum_quantity\":-1}',$1)",[key])),/check constraint/);
 assert.equal((await db.query('select * from idempotency_keys where key=$1',[key])).rows.length,0);assert.equal((await db.query("select * from materials where code='INVALID'")).rows.length,0);
});
test('disabled user loses access immediately even with the same auth UID',async()=>{
 await db.query('update profiles set enabled=false where id=$1',[identities.accountant]);await asUser(db,identities.accountant,async()=>{assert.equal((await db.query('select * from profiles')).rows.length,1);assert.equal((await db.query('select * from materials')).rows.length,0);});
 await db.query('update profiles set enabled=true where id=$1',[identities.accountant]);
});
test('empty dashboard reports unknown, never substitutes zero or cash for revenue',async()=>{
 const result=await asUser(db,identities.admin,()=>db.query<{snapshot:Record<string,unknown>}>("select dashboard_summary('2026-11-17') snapshot"));assert.equal(result.rows[0].snapshot.net_revenue_vnd,null);assert.equal(result.rows[0].snapshot.received_vnd,null);
});

test('Admin can grant scoped checkboxes; a user cannot self-promote or disable the last manager',async()=>{
 const payload=[{module:'materials',action:'view',allowed:true}];
 await asUser(db,identities.admin,()=>db.query("select admin_assign_user($1,true,array['accountant'],$2::jsonb,$3)",[identities.accountant,JSON.stringify(payload),randomUUID()]));
 await asUser(db,identities.accountant,async()=>{assert.equal((await db.query('select * from materials')).rows.length,1);assert.equal((await db.query('select * from payroll_lines')).rows.length,0);});
 await assert.rejects(()=>asUser(db,identities.accountant,()=>db.query("select admin_assign_user($1,true,array['admin'],'[]',$2)",[identities.accountant,randomUUID()])),/FORBIDDEN/);
 await assert.rejects(()=>asUser(db,identities.admin,()=>db.query("select admin_assign_user($1,false,array['admin'],'[]',$2)",[identities.admin,randomUUID()])),/LAST_ADMIN_REQUIRED/);
 await assert.rejects(()=>asUser(db,identities.admin,()=>db.query("select admin_assign_user($1,true,array['admin'],$2::jsonb,$3)",[identities.admin,JSON.stringify([{module:'admin',action:'manage',allowed:false}]),randomUUID()])),/LAST_ADMIN_REQUIRED/);
});
test('creating a price is not permission to verify its basis',async()=>{
 const material=(await db.query<{id:string}>('select id from materials limit 1')).rows[0].id,unit=randomUUID();await db.query("insert into material_units(id,code,name,dimension) values($1,'PRICE-UNIT','Unit','count')",[unit]);await db.query("insert into user_permissions values($1,'materials','create',true)",[identities.accountant]);
 const value={material_id:material,basis_unit_id:unit,amount:'16000',effective_from:'2026-11-17',verification:'needs_verification',source_reference:'Pending invoice check'};
 await asUser(db,identities.accountant,()=>db.query("select save_catalog('material_prices',null,null,$1::jsonb,$2)",[JSON.stringify(value),randomUUID()]));
 await assert.rejects(()=>asUser(db,identities.accountant,()=>db.query("select save_catalog('material_prices',null,null,$1::jsonb,$2)",[JSON.stringify({...value,effective_from:'2026-11-18',verification:'verified'}),randomUUID()])),/FORBIDDEN_VERIFICATION/);
 for(const verified of [true,'TRUE','yes',1])await assert.rejects(()=>asUser(db,identities.accountant,()=>db.query("select save_catalog('unit_conversions',null,null,$1::jsonb,$2)",[JSON.stringify({material_id:material,from_unit_id:unit,to_unit_id:randomUUID(),factor:30,verified,evidence:'Forged approval'}),randomUUID()])),/FORBIDDEN_VERIFICATION/);
});
test('product creation does not grant publication to customers',async()=>{
 await db.query("insert into user_permissions values($1,'products','create',true)",[identities.accountant]);
 await asUser(db,identities.accountant,()=>db.query("select save_catalog('products',null,null,'{\"code\":\"DRAFT-PRODUCT\",\"name\":\"Draft\",\"sale_unit\":\"phần\",\"published\":false}',$1)",[randomUUID()]));
 await assert.rejects(()=>asUser(db,identities.accountant,()=>db.query("select save_catalog('products',null,null,'{\"code\":\"UNAPPROVED\",\"name\":\"Unapproved\",\"sale_unit\":\"phần\",\"published\":true}',$1)",[randomUUID()])),/FORBIDDEN_PUBLICATION/);
});

test('KH-12 published product images, order summaries, and completed delivery connect to one sale and receivable',async()=>{
 const product=randomUUID(),store=randomUUID(),order=randomUUID(),warehouse=randomUUID(),recipe=randomUUID(),recipeVersion=randomUUID(),batch=randomUUID(),unit=randomUUID(),image=`${product}/${randomUUID()}.png`,key=randomUUID();
 await db.query("insert into products(id,code,name,sale_unit,published) values($1,$2,'Synthetic order product','phần',true)",[product,'ORD-'+product.slice(0,8)]);
 await db.query("insert into storage.objects(bucket_id,name) values('product-images',$1)",[image]);
 const savedImage=(await asUser(db,identities.admin,()=>db.query<{r:{image_path:string;version:string}}>('select public.save_product_image($1,1,$2,$3) r',[product,image,key]))).rows[0].r;
 assert.equal(savedImage.image_path,image);assert.equal(savedImage.version,'2');
 const publicCatalog=(await asUser(db,identities.admin,()=>db.query<{r:{rows:{image_path:string}[]}}>('select public.public_order_catalog(current_date,0,100) r'))).rows[0].r;
 assert.ok(publicCatalog.rows.some(row=>row.image_path===image));
 await db.query("insert into stores(id,code,name,contact) values($1,$2,'Synthetic store','0900000000')",[store,'ORD-'+store.slice(0,8)]);
 await db.query("insert into customer_orders(id,store_id,customer_id,delivery_date,shift,status) values($1,$2,$3,current_date,'AM','approved')",[order,store,identities.admin]);
 await db.query("insert into customer_order_items(order_id,product_id,quantity,price_vnd,discount_rate,product_name,product_code,sale_unit) values($1,$2,2,1000,0.15,'Synthetic order product','ORD','phần')",[order,product]);
 await db.query("insert into material_units(id,code,name,dimension) values($1,'ORD-UNIT','Order test unit','count')",[unit]);
 await db.query("insert into recipes(id,code,name,kind) values($1,'ORD-RECIPE','Order test recipe','product')",[recipe]);
 await db.query("insert into recipe_versions(id,recipe_id,revision,effective_from,output_quantity,output_unit_id,status) values($1,$2,1,current_date,1,$3,'published')",[recipeVersion,recipe,unit]);
 await db.query("insert into warehouses(id,code,name,kind) values($1,'ORD-WH','Order test finished stock','finished')",[warehouse]);
 await db.query("insert into production_batches(id,produced_on,delivery_date,warehouse_id,status) values($1,current_date,current_date,$2,'posted')",[batch,warehouse]);
 await db.query("insert into production_batch_lines(batch_id,product_id,recipe_version_id,main_quantity) values($1,$2,$3,5)",[batch,product,recipeVersion]);
 const fulfillKey=randomUUID();
 const fulfilled=(await asUser(db,identities.admin,()=>db.query<{r:{revenue_vnd:string;delivery_id:string;receivable_id:string}}>('select public.fulfill_order_delivery($1,1,$2) r',[order,fulfillKey]))).rows[0].r;
 assert.equal(fulfilled.revenue_vnd,'1700');
 const replay=(await asUser(db,identities.admin,()=>db.query<{r:typeof fulfilled}>('select public.fulfill_order_delivery($1,1,$2) r',[order,fulfillKey]))).rows[0].r;
 assert.equal(replay.delivery_id,fulfilled.delivery_id);
 assert.equal((await db.query<{n:number}>('select count(*)::int n from sales_documents where delivery_id=$1 and status=\'posted\'',[fulfilled.delivery_id])).rows[0].n,1);
 const summary=(await asUser(db,identities.admin,()=>db.query<{r:{orders:{discount_vnd:string;order_total_vnd:string;outstanding_vnd:string}[];products:{total_quantity:string;by_store:Record<string,string>}[]}}>('select public.order_customer_summary(current_date) r'))).rows[0].r;
 assert.equal(summary.orders[0].discount_vnd,'300');assert.equal(summary.orders[0].order_total_vnd,'1700');assert.equal(summary.orders[0].outstanding_vnd,'1700');
 assert.equal(summary.products[0].total_quantity,'2.000000');assert.equal(summary.products[0].by_store[store],'2.000000');
});

test('KH-02 custom department codes link employees, role rates, attendance and payroll',async()=>{
 const employee=randomUUID(),code='ROT-'+employee.slice(0,8),departmentCode='KHO-'+employee.slice(0,8).toUpperCase();
 await db.query("insert into departments(code,name) values('SX','Production') on conflict(code) do nothing");
 const department=(await asUser(db,identities.admin,()=>db.query<{r:Record<string,unknown>}>("select public.save_catalog('departments',null,null,$1::jsonb,$2) r",[JSON.stringify({code:departmentCode,name:'Kho nguyên liệu'}),randomUUID()]))).rows[0].r,departmentId=String(department.id);
 await db.query("insert into employees(id,code,name,department_id) values($1,$2,'Synthetic rotation',$3)",[employee,code,departmentId]);
 await db.query("insert into employee_pay_rates(employee_id,department_id,hourly_vnd,effective_from) values($1,$2,15000,'2020-01-01')",[employee,departmentId]);
 const input={note:'Synthetic rotation test',employee_id:employee,starts_at:'2026-11-18T00:00:00+07:00',ends_at:'2026-11-18T08:00:00+07:00',break_minutes:'0',department:'SX',daily:'0',support:'0',advance:'0',deduction:'0'};
 const submit=(value:Record<string,unknown>)=>asUser(db,identities.admin,()=>db.query<{r:Record<string,unknown>}>('select public.submit_entry($1,$2,$3::jsonb,null,$4) r',['attendance',String(value.starts_at).slice(0,10),JSON.stringify(value),randomUUID()]));
 await assert.rejects(()=>submit(input),/PAY_RATE_MISSING_FOR_DEPARTMENT/);
 const sx=(await db.query<{id:string}>("select id from departments where code='SX'")).rows[0].id;
 await asUser(db,identities.admin,()=>db.query('select public.save_commercial_terms($1,$2,$3,$4::jsonb,$5)',['pay',employee,1,JSON.stringify({date:'2020-01-01',evidence:'Synthetic rotation rate',amount:'28000',department_id:sx}),randomUUID()]));
 const history=(await asUser(db,identities.admin,()=>db.query<{r:Record<string,unknown>[]}>('select public.commercial_history($1,$2) r',['pay',employee]))).rows[0].r;
 assert.ok(history.some(rate=>rate.department_code==='SX'&&rate.hourly_vnd==='28000'));
 assert.ok(history.some(rate=>rate.department_code===departmentCode&&rate.department_name==='Kho nguyên liệu'&&rate.hourly_vnd==='15000'));
 const employeeCatalog=(await asUser(db,identities.admin,()=>db.query<{r:{rows:Record<string,unknown>[]}}>('select public.commercial_catalog($1,$2,$3,$4,$5,$6) r',['employees','2026-11-18','','',0,100]))).rows[0].r;
 assert.ok(employeeCatalog.rows.some(row=>row.id===employee&&row.department_code===departmentCode&&row.department_name==='Kho nguyên liệu'));
 const saved=(await submit(input)).rows[0].r,workspace=(await asUser(db,identities.admin,()=>db.query<{r:{rows:Record<string,unknown>[];shifts:Record<string,unknown>[]}}>('select public.entry_workspace($1,$2) r',['payroll','2026-11-18']))).rows[0].r;
 const row=workspace.rows.find(r=>r.employee_id===employee&&r.department==='SX'),detail=workspace.shifts.find(s=>s.employee_id===employee);
 assert.ok(row);assert.equal(row.role_changed,true);assert.equal(row.base_vnd,'224000');assert.equal((row.rate_details as Record<string,unknown>[])[0].hourly_vnd,'28000');assert.equal(Number((row.rate_details as Record<string,unknown>[])[0].hours),8);
 assert.ok(detail);assert.equal(detail.department,'SX');assert.equal(detail.department_name,'Production');assert.equal(detail.home_department,departmentCode);assert.equal(detail.home_department_name,'Kho nguyên liệu');assert.equal(detail.role_changed,true);assert.equal(detail.hourly_vnd,'28000');
 const snapshot=await db.query<{department_snapshot:string;home_department_snapshot:string;hourly_rate_vnd:string;home_hourly_rate_vnd:string}>("select s.department_snapshot,s.home_department_snapshot,p.hourly_rate_vnd::text,p.home_hourly_rate_vnd::text from attendance_shifts s join attendance_pay_snapshots p on p.shift_id=s.id where s.id=$1",[saved.shift_id]);
 assert.deepEqual(snapshot.rows[0],{department_snapshot:'SX',home_department_snapshot:departmentCode,hourly_rate_vnd:'28000',home_hourly_rate_vnd:'15000'});
 const customShift=(await submit({...input,starts_at:'2026-11-19T00:00:00+07:00',ends_at:'2026-11-19T08:00:00+07:00',department:departmentCode})).rows[0].r;
 const customSnapshot=await db.query<{department_snapshot:string;home_department_snapshot:string}>("select department_snapshot,home_department_snapshot from attendance_shifts where id=$1",[customShift.shift_id]);
 assert.deepEqual(customSnapshot.rows[0],{department_snapshot:departmentCode,home_department_snapshot:departmentCode});
});


test('KH-01/KH-10 material archive keeps history, protects stock and replays safely',async()=>{
 const unit=randomUUID(),materialId=randomUUID(),warehouse=randomUUID(),movement=randomUUID(),key=randomUUID();
 const code='ARCH-'+materialId.slice(0,8);
 await db.query("insert into material_units(id,code,name,dimension) values($1,$2,'Archive test unit','mass')",[unit,'U-'+unit.slice(0,8)]);
 const created=(await asUser(db,identities.admin,()=>db.query<{r:{id:string;version:number}}>("select save_catalog('materials',null,null,$1::jsonb,$2) r",[JSON.stringify({code,name:'Synthetic archive test',category:'ingredient',purchase_unit_id:unit,usage_unit_id:unit}),randomUUID()]))).rows[0].r;
 await assert.rejects(()=>asUser(db,identities.accountant,()=>db.query('select set_material_archived($1,1,true,$2)',[created.id,randomUUID()])),/FORBIDDEN/);
 const archive=()=>asUser(db,identities.admin,()=>db.query<{r:{id:string;archived:boolean;version:number}}>('select set_material_archived($1,1,true,$2) r',[created.id,key]));
 const first=(await archive()).rows[0].r,replayed=(await archive()).rows[0].r;
 assert.deepEqual(replayed,first);assert.equal(first.id,created.id);assert.equal(first.archived,true);assert.equal(first.version,2);
 assert.equal((await db.query<{n:number}>("select count(*)::int n from audit_logs where record_id=$1 and action='UPDATE'",[created.id])).rows[0].n,1);
 await db.query("insert into warehouses(id,code,name,kind) values($1,$2,'Archive test warehouse','ingredient')",[warehouse,'W-'+warehouse.slice(0,8)]);
 await db.query("insert into inventory_movements(id,warehouse_id,moved_on,kind) values($1,$2,current_date,'receipt')",[movement,warehouse]);
 await assert.rejects(()=>db.query('insert into inventory_movement_lines(movement_id,material_id,unit_id,quantity) values($1,$2,$3,1)',[movement,created.id,unit]),/MATERIAL_ARCHIVED/);
 const restored=(await asUser(db,identities.admin,()=>db.query<{r:{id:string;archived:boolean;version:number}}>('select set_material_archived($1,2,false,$2) r',[created.id,randomUUID()]))).rows[0].r;
 assert.equal(restored.archived,false);assert.equal(restored.version,3);
 assert.equal((await db.query<{n:number}>("select count(*)::int n from audit_logs where record_id=$1 and action='UPDATE'",[created.id])).rows[0].n,2);

 const stockedId=randomUUID(),stockMovement=randomUUID(),stockKey=randomUUID(),stockCode='STOCK-'+stockedId.slice(0,8);
 const stocked=(await asUser(db,identities.admin,()=>db.query<{r:{id:string}}>("select save_catalog('materials',null,null,$1::jsonb,$2) r",[JSON.stringify({code:stockCode,name:'Synthetic stocked material',category:'ingredient',purchase_unit_id:unit,usage_unit_id:unit}),randomUUID()]))).rows[0].r;
 await db.query("insert into inventory_movements(id,warehouse_id,moved_on,kind) values($1,$2,current_date,'receipt')",[stockMovement,warehouse]);
 await db.query("insert into inventory_movement_lines(movement_id,material_id,unit_id,quantity) values($1,$2,$3,2)",[stockMovement,stocked.id,unit]);
 await assert.rejects(()=>asUser(db,identities.admin,()=>db.query('select set_material_archived($1,1,true,$2)',[stocked.id,stockKey])),/MATERIAL_HAS_STOCK/);
 assert.equal((await db.query<{archived:boolean}>('select archived from materials where id=$1',[stocked.id])).rows[0].archived,false);
});

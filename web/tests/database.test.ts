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

test('KH-02 temporary department changes use that role rate and preserve both role and wage in payroll',async()=>{
 const employee=randomUUID(),code='ROT-'+employee.slice(0,8);
 await db.query("insert into departments(code,name) values('SX','Production'),('VP','Office') on conflict(code) do nothing");
 await db.query("insert into employees(id,code,name,department_id) select $1,$2,'Synthetic rotation',id from departments where code='SX'",[employee,code]);
 await db.query("insert into employee_pay_rates(employee_id,hourly_vnd,effective_from) values($1,15000,'2020-01-01')",[employee]);
 const input={note:'Synthetic rotation test',employee_id:employee,starts_at:'2026-11-18T00:00:00+07:00',ends_at:'2026-11-18T08:00:00+07:00',break_minutes:'0',department:'VP',daily:'0',support:'0',advance:'0',deduction:'0'};
 const submit=(value:Record<string,unknown>)=>asUser(db,identities.admin,()=>db.query<{r:Record<string,unknown>}>('select public.submit_entry($1,$2,$3::jsonb,null,$4) r',['attendance','2026-11-18',JSON.stringify(value),randomUUID()]));
 await assert.rejects(()=>submit(input),/PAY_RATE_MISSING_FOR_DEPARTMENT/);
 const vp=(await db.query<{id:string}>("select id from departments where code='VP'")).rows[0].id;
 await asUser(db,identities.admin,()=>db.query('select public.save_commercial_terms($1,$2,$3,$4::jsonb,$5)',['pay',employee,1,JSON.stringify({date:'2020-01-01',evidence:'Synthetic rotation rate',amount:'28000',department_id:vp}),randomUUID()]));
 const history=(await asUser(db,identities.admin,()=>db.query<{r:Record<string,unknown>[]}>('select public.commercial_history($1,$2) r',['pay',employee]))).rows[0].r;
 assert.ok(history.some(rate=>rate.department_code==='VP'&&rate.hourly_vnd==='28000'));
 const saved=(await submit(input)).rows[0].r,workspace=(await asUser(db,identities.admin,()=>db.query<{r:{rows:Record<string,unknown>[];shifts:Record<string,unknown>[]}}>('select public.entry_workspace($1,$2) r',['payroll','2026-11-18']))).rows[0].r;
 const row=workspace.rows.find(r=>r.employee_id===employee&&r.department==='VP'),detail=workspace.shifts.find(s=>s.employee_id===employee);
 assert.ok(row);assert.equal(row.role_changed,true);assert.equal(row.base_vnd,'224000');assert.equal((row.rate_details as Record<string,unknown>[])[0].hourly_vnd,'28000');assert.equal(Number((row.rate_details as Record<string,unknown>[])[0].hours),8);
 assert.ok(detail);assert.equal(detail.department,'VP');assert.equal(detail.home_department,'SX');assert.equal(detail.role_changed,true);assert.equal(detail.hourly_vnd,'28000');
 const snapshot=await db.query<{department_snapshot:string;home_department_snapshot:string;hourly_rate_vnd:string;home_hourly_rate_vnd:string}>("select s.department_snapshot,s.home_department_snapshot,p.hourly_rate_vnd::text,p.home_hourly_rate_vnd::text from attendance_shifts s join attendance_pay_snapshots p on p.shift_id=s.id where s.id=$1",[saved.shift_id]);
 assert.deepEqual(snapshot.rows[0],{department_snapshot:'VP',home_department_snapshot:'SX',hourly_rate_vnd:'28000',home_hourly_rate_vnd:'15000'});
});

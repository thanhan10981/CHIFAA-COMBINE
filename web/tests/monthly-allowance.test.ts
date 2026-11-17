import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import fs from 'node:fs/promises';import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
let db:PGlite;const employee=randomUUID();
const rpc=async(name:string,args:unknown[],user=identities.admin)=>(await asUser(db,user,()=>db.query<{result:Record<string,unknown>}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args))).rows[0].result;
const save=(month:string,amount:string,previous:string|null=null,key=randomUUID(),user=identities.admin)=>rpc('save_monthly_allowance',[employee,month,previous,amount,'Synthetic monthly allowance',key],user);
before(async()=>{db=await database();await db.query("insert into employees(id,code,name) values($1,'MONTH-E','Synthetic monthly employee')",[employee]);});after(async()=>{await db?.close();});
test('allowances belong to one employee/month, never carry forward and do not post payroll or cash',async()=>{
 await save('2026-11-01','150000');await save('2026-12-01','250000');
 const november=await rpc('monthly_allowances',[employee,'2026-11-01']),december=await rpc('monthly_allowances',[employee,'2026-12-01']),january=await rpc('monthly_allowances',[employee,'2027-01-01']);assert.equal((november.current as {amount_vnd:string}).amount_vnd,'150000');assert.equal((december.current as {amount_vnd:string}).amount_vnd,'250000');assert.equal(january.current,null);
 const data=await rpc('commercial_catalog',['employees','2026-11-17','','',0,25]);assert.equal((data.rows as Record<string,unknown>[])[0].monthly_allowance_vnd,'150000');assert.equal('daily_allowance_vnd' in (data.rows as Record<string,unknown>[])[0],false);
 for(const table of ['payroll_lines','cash_ledger','employee_pay_rates'])assert.equal((await db.query(`select * from ${table}`)).rows.length,0);
});
test('monthly corrections are append-only, preserve earlier amounts, reject stale versions and replay exactly',async()=>{
 const current=(await rpc('monthly_allowances',[employee,'2026-11-01'])).current as {id:string};const key=randomUUID(),result=await save('2026-11-01','175000',current.id,key);assert.deepEqual(await save('2026-11-01','175000',current.id,key),result);
 await assert.rejects(()=>save('2026-11-01','1',current.id),/VERSION_CONFLICT/);await assert.rejects(()=>save('2026-11-01','1',current.id,key),/IDEMPOTENCY_CONFLICT/);
 const history=(await rpc('monthly_allowances',[employee,'2026-11-01'])).history as {amount_vnd:string}[];assert.deepEqual(history.map(r=>r.amount_vnd),['175000','150000']);await assert.rejects(()=>db.exec('update employee_monthly_allowances set amount_vnd=1'),/TERMS_IMMUTABLE/);
});
test('monthly payroll privileges, closed periods and posted payroll are enforced without writing partial records',async()=>{
 await db.query("insert into user_permissions values($1,'employees','view',true)",[identities.accountant]);await assert.rejects(()=>rpc('monthly_allowances',[employee,'2026-11-01'],identities.accountant),/FORBIDDEN/);assert.equal((await asUser(db,identities.accountant,()=>db.query('select * from employee_monthly_allowances'))).rows.length,0);await assert.rejects(()=>save('2027-01-01','1000',null,randomUUID(),identities.accountant),/FORBIDDEN/);
 await db.query("insert into accounting_periods(starts_on,ends_on,status) values('2027-01-10','2027-01-20','closed')");await assert.rejects(()=>save('2027-01-01','1000'),/PERIOD_CLOSED/);
 await db.exec("insert into payroll_periods(starts_on,ends_on,status) values('2027-02-01','2027-02-28','posted')");await assert.rejects(()=>save('2027-02-01','1000'),/PAYROLL_MONTH_POSTED/);
 for(const [month,amount] of [['2027-03-15','100'],['2027-03-01','-1'],['2027-03-01','1.5'],['2027-03-01','NaN']])await assert.rejects(()=>save(month,amount),/INVALID_MONTH|INVALID_ALLOWANCE/);
});
test('upgrade preserves old allowance data but ignores it for new hourly pay and attendance snapshots',async()=>{
 const old=await database('202611170025_commercial_catalogs.sql');try{
 const emp=randomUUID(),dep=randomUUID();await old.query("insert into departments(id,code,name) values($1,'SX','Synthetic production')",[dep]);await old.query("insert into employees(id,code,name,department_id) values($1,'OLD-MONTH','Old employee',$2)",[emp,dep]);await old.query("insert into employee_pay_rates(employee_id,hourly_vnd,daily_allowance_vnd,allowance_confirmed,effective_from) values($1,25000,50000,true,'2026-01-01')",[emp]);
 const shift=async(day:string)=>asUser(old,identities.admin,()=>old.query("select post_attendance($1,$2,$3,0,$4)",[emp,day+'T01:00:00Z',day+'T05:00:00Z',randomUUID()]));await shift('2026-11-17');
 await old.exec(await fs.readFile('../supabase/migrations/202611170026_monthly_employee_allowances.sql','utf8'));await shift('2026-11-18');
 assert.deepEqual((await old.query<{amount:string}>('select default_daily_allowance_vnd::text amount from attendance_pay_snapshots order by created_at,id')).rows.map(r=>r.amount).sort(),['0','50000']);assert.equal((await old.query<{amount:string}>('select daily_allowance_vnd::text amount from employee_pay_rates')).rows[0].amount,'50000');assert.equal((await old.query('select * from employee_monthly_allowances')).rows.length,0);
 const input={date:'2026-12-01',amount:'26000',evidence:'New hourly rate'};await asUser(old,identities.admin,()=>old.query('select save_commercial_terms($1,$2,1,$3,$4)',['pay',emp,JSON.stringify(input),randomUUID()]));await assert.rejects(()=>asUser(old,identities.admin,()=>old.query('select save_commercial_terms($1,$2,2,$3,$4)',['pay',emp,JSON.stringify({...input,date:'2027-01-01',allowance:'100'}),randomUUID()])),/INVALID_FIELDS/);
 }finally{await old.close();}
});

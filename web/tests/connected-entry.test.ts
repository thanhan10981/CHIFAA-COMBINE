import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
import {extractDraftEntry,buildEntrySourceImport} from '../lib/deploy/draft-entry-source';
import {buildEntryUpdate} from '../lib/deploy/entry-update';
let db:PGlite;const employee=randomUUID(),store=randomUUID(),product=randomUUID(),account=randomUUID();
type R=Record<string,unknown>;const submit=(action:string,date:string,input:R,previous:string|null=null,key=randomUUID(),user=identities.admin)=>asUser(db,user,async()=>(await db.query<{r:R}>('select public.submit_entry($1,$2,$3,$4,$5) r',[action,date,{note:'Synthetic evidence only',...input},previous,key])).rows[0].r);
const workspace=(module:string,date='2026-11-18',user=identities.admin)=>asUser(db,user,async()=>(await db.query<{r:{rows:R[];options:Record<string,R[]>;payroll_version?:string;history:R[];sources:R[]}}>('select public.entry_workspace($1,$2) r',[module,date])).rows[0].r);
before(async()=>{db=await database();await db.exec("insert into departments(code,name) values('SX','Synthetic production');");await db.query("insert into employees(id,code,name,department_id) select $1,'EN-NV','Synthetic staff',id from departments where code='SX'",[employee]);await db.query("insert into employee_pay_rates(employee_id,hourly_vnd,effective_from) values($1,15000,'2020-01-01')",[employee]);await db.query("insert into stores(id,code,name) values($1,'EN-ST','Synthetic store')",[store]);await db.query("insert into products(id,code,name,sale_unit) values($1,'EN-P','Synthetic meal','portion')",[product]);await db.query("insert into product_prices(product_id,price_vnd,effective_from,evidence) values($1,15000,'2020-01-01','Synthetic price evidence')",[product]);await db.query("insert into store_discount_policies(store_id,effective_from,common_rate,enabled,note,evidence) values($1,'2020-01-01',0.15,true,'Synthetic','Synthetic evidence') returning id",[store]).then(async x=>{await db.query('insert into store_discount_policy_items(policy_id,product_id,eligible) values($1,$2,true)',[(x.rows[0] as {id:string}).id,product]);});await db.query("insert into bank_accounts(id,code,name,kind) values($1,'EN-C','Synthetic cash','cash')",[account]);await submit('cash','2026-11-01',{account_id:account,category:'opening',amount:'0'});});
after(async()=>{await db?.close();});
test('KH-05 sale100/80/10/10 prices on server creates debt; receipt reduces debt and adds cash once',async()=>{
 const sale=await submit('sale','2026-11-18',{store_id:store,lines:[{product_id:product,delivered:'100',sold:'80',returned:'10',store_borne:'10',price_vnd:'1'}]});assert.equal(sale.amount_vnd,'1147500');
 const debts=await workspace('receivables');const debt=debts.rows.find(r=>r.amount_vnd==='1147500')!;assert.ok(debt);const key=randomUUID();const input={store_id:store,account_id:account,amount:'500000',allocations:[{receivable_id:debt.id,amount_vnd:'500000'}]};await submit('receipt','2026-11-18',input,null,key);await submit('receipt','2026-11-18',input,null,key);
 assert.equal((await workspace('receivables')).rows.find(r=>r.id===debt.id)?.balance_vnd,'647500');assert.equal((await workspace('cash')).options.balances[0].balance_vnd,'500000');
 await submit('sale','2026-11-18',{store_id:store,lines:[{product_id:product,delivered:'100',sold:'80',returned:'10',store_borne:'10'}]},sale.journal_id as string);assert.equal((await workspace('cash')).options.balances[0].balance_vnd,'0');
 assert.equal((await workspace('sales')).rows.length,1);
});
test('KH-02/09 overnight8hours, correction replaces shift; daily/month allowances counted once, payroll posts without paying twice',async()=>{
 const a={employee_id:employee,starts_at:'2026-11-17T23:00:00+07:00',ends_at:'2026-11-18T07:00:00+07:00',break_minutes:'0',daily:'10000',support:'5000',advance:'0',deduction:'0'};
 const original=await submit('attendance','2026-11-17',a);assert.equal(original.hours,'8.0000000000000000');
 await submit('attendance','2026-11-17',{...a,ends_at:'2026-11-18T08:00:00+07:00'},original.journal_id as string);
 assert.equal((await workspace('attendance','2026-11-17')).rows.length,1);
 await db.query("insert into employee_monthly_allowances(employee_id,month,amount_vnd,note) values($1,'2026-11-01',30000,'Synthetic monthly evidence')",[employee]);
 const preview=await workspace('payroll');assert.equal(Number(preview.rows[0].hours),9);assert.equal(preview.rows[0].base_vnd,'135000');assert.equal(preview.rows[0].allowance_vnd,'45000');assert.equal(preview.rows[0].payable_vnd,'180000');
 const before=(await workspace('cash')).rows.length;await submit('payroll','2026-11-18',{expected:preview.payroll_version});assert.equal((await workspace('cash')).rows.length,before);
 const posted=(await workspace('payroll')).options.posted[0];await submit('wage_payment','2026-11-18',{payroll_line_id:posted.id,account_id:account});await assert.rejects(submit('wage_payment','2026-11-18',{payroll_line_id:posted.id,account_id:account}),/unique|duplicate/i);
 await assert.rejects(submit('attendance','2026-11-17',a),/PAYROLL_MONTH_POSTED/);
});
test('KH-05 loan and payable settlements link cash, prevent principal/debt overpayment and keep interest manual',async()=>{
 const loan=await submit('loan','2026-11-18',{name:'Synthetic loan',lender:'Synthetic lender',amount:'1000000',receive_cash:false});assert.equal((await workspace('loans')).rows[0].balance_vnd,'1000000');
 await submit('loan_payment','2026-11-18',{loan_id:loan.id,account_id:account,principal:'200000',interest:'1234'});assert.equal((await workspace('loans')).rows[0].balance_vnd,'800000');await assert.rejects(submit('loan_payment','2026-11-18',{loan_id:loan.id,account_id:account,principal:'900000',interest:'0'}),/OVERPAYMENT/);
 const payable=await submit('payable','2026-11-18',{code:'Synthetic-payable',partner:'Synthetic supplier',amount:'100000',due_on:'2026-11-20'});await submit('payable_payment','2026-11-18',{payable_id:payable.id,account_id:account,amount:'30000'});assert.equal((await workspace('receivables')).rows.find(r=>r.id===payable.id)?.balance_vnd,'70000');await assert.rejects(submit('payable_payment','2026-11-18',{payable_id:payable.id,account_id:account,amount:'80000'}),/OVERPAYMENT/);
});
test('KH-06/09 target revisions require prior ID; live permissions and closed periods protect linked writes',async()=>{
 const initial=await submit('target','2026-12-01',{metric:'foodCost',value:'32.2'});await assert.rejects(submit('target','2026-12-01',{metric:'foodCost',value:'30'}),/VERSION_CONFLICT/);await submit('target','2026-12-01',{metric:'foodCost',value:'30'},initial.journal_id as string);assert.equal((await workspace('targets','2026-12-01')).rows[0].denominator,'net_revenue');
 await assert.rejects(workspace('payroll','2026-11-18',identities.a),/FORBIDDEN/);await assert.rejects(submit('cash','2026-11-18',{account_id:account,category:'capital',amount:'100'},null,randomUUID(),identities.a),/FORBIDDEN/);
 await db.exec("insert into accounting_periods(starts_on,ends_on,status) values('2027-01-01','2027-01-31','closed')");await assert.rejects(submit('expense','2027-01-05',{account_id:account,category:'fixed',amount:'100'}),/PERIOD_CLOSED/);
});
test('source literals parsed without executing code; private import replay does not create operational money',async()=>{
 const html=`<script>globalThis.__EXECUTED=true; const materials=[{id:'SYN',stock:null,stockRaw:'#N/A'}];const stores=[];const dishes=[];const employees=[];const v9DefaultPlans={targets:{foodCost:32.2},months:[{month:'2026-11',revenue:null}]};const v9InitialLoans=[{id:'SYN-L',lender:'Synthetic lender',principal:100,date:'2026-11-01'}];const v9LegacyCash=[{date:'01/10/2026',amount:123,group:'?'}];const v9CashCats=[];const V14_NEW_TARGETS={returnRate:null};</script>`;
 const source=extractDraftEntry(html),archive=buildEntrySourceImport(source);assert.equal((globalThis as R).__EXECUTED,undefined);const count=(await db.query('select count(*) n from cash_ledger')).rows;await db.exec(archive.sql);await db.exec(archive.sql);assert.deepEqual((await db.query('select count(*) n from cash_ledger')).rows,count);assert.deepEqual((await workspace('cash')).sources,[]);assert.deepEqual((await workspace('payroll')).sources,[]);assert.equal((await db.query<{n:number}>('select count(*) n from private.entry_source_rows')).rows[0].n,archive.rows.length);
 await assert.rejects(asUser(db,identities.a,()=>db.query('select * from private.entry_source_rows')),/permission denied/);
 assert.throws(()=>extractDraftEntry(html.replace('const materials=[','const materials=execute([')),/Incomplete|Executable/);
});
test('032 guarded forward patch installs after031, preserves business data, rejects replay',async()=>{
 const old=await database('202611180031_plan_requirement_preview.sql');try{const migration=await fs.readFile('../supabase/migrations/202611180032_connected_entry.sql','utf8'),patch=buildEntryUpdate(migration);await old.exec(patch);await assert.rejects(old.exec(patch),/PATCH_032_ALREADY_PRESENT/);}finally{await old.close();}
});
test('KH-10 attendance-only source and history never reveal wages or allowances',async()=>{
 await db.query("insert into user_permissions(user_id,module,action,allowed) values($1,'attendance','view',true)",[identities.a]);
 await db.query("insert into private.entry_source_rows(source_hash,source_key,module,payload) values('synthetic-private','employee:1','attendance',$1)",[{id:'SYN-PRIVATE',name:'Synthetic hidden wage',hourly:999999,allowance:888888,phone:'private-phone'}]);
 const response=await workspace('attendance','2026-11-17',identities.a);const json=JSON.stringify(response);assert.ok(!json.includes('999999')&&!json.includes('888888')&&!json.includes('private-phone'));assert.ok(response.history.every(h=>!('daily' in(h.input as R))));
 await db.query("delete from user_permissions where user_id=$1 and module='attendance'",[identities.a]);
});

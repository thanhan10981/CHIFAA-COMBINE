import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
import {buildEntryCompactUpdate,buildPromoteEntryCash} from '../lib/deploy/entry-compact-update';
let db:PGlite;const account=randomUUID(),loan=randomUUID(),staff=[randomUUID(),randomUUID(),randomUUID()];
type R=Record<string,unknown>;type W={rows:R[];history:R[];options:Record<string,R[]>;payroll_version:string};
const rpc=async<T=R>(name:string,args:unknown[],user=identities.admin)=>(await asUser(db,user,()=>db.query<{r:T}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args))).rows[0].r;
const save=(a:string,i:R,old:string|null=null,key=randomUUID())=>rpc('submit_entry',[a,'2026-11-18',i,old,key]);
const view=(m:string)=>rpc<W>('entry_workspace',[m,'2026-11-18']);
const remove=(id:unknown,key=randomUUID())=>rpc('delete_entry',[id,key]);
const net=async()=>Number((await db.query<{n:string}>('select coalesce(sum(case direction when \'in\' then amount_vnd else -amount_vnd end),0)::text n from cash_ledger')).rows[0].n);
before(async()=>{db=await database();await db.query("insert into bank_accounts(id,code,name,kind) values($1,'CP-C','Synthetic cash','cash')",[account]);for(const [n,code] of ['SX','VP','BH'].entries()){await db.query('insert into departments(code,name) values($1,$1) on conflict(code) do nothing',[code]);await db.query('insert into employees(id,code,name,department_id) select $1,$2,$2,id from departments where code=$3',[staff[n],'SYN-'+code,code]);await db.query("insert into employee_pay_rates(employee_id,hourly_vnd,effective_from) values($1,15000,'2020-01-01')",[staff[n]]);}await db.query("insert into loans(id,name,lender,borrowed_on,principal_vnd) values($1,'Synthetic loan','Synthetic lender','2026-11-18',1000)",[loan]);});after(async()=>{await db?.close();});
test('KH-09 edit/delete an expense reverses cash atomically and retries retain history without mandatory evidence input',async()=>{
 const before=await net(),original=await save('expense',{account_id:account,category:'fixed',amount:'100'});assert.equal(await net(),before-100);
 const edited=await save('expense',{account_id:account,category:'fixed',amount:'80'},original.journal_id as string);assert.equal(await net(),before-80);assert.equal((await view('cash')).rows.filter(r=>r.amount_vnd==='80').length,1);
 const key=randomUUID();await remove(edited.journal_id,key);await remove(edited.journal_id,key);assert.equal(await net(),before);await assert.rejects(remove(original.journal_id),/VERSION_CONFLICT/);
});
test('KH-09 void loan/payable payments restores balances and permits a corrected payment without double cash',async()=>{
 const before=await net(),payment=await save('loan_payment',{loan_id:loan,account_id:account,principal:'200',interest:'7'});assert.equal((await view('loans')).rows[0].balance_vnd,'800');await remove(payment.journal_id);assert.equal((await view('loans')).rows[0].balance_vnd,'1000');assert.equal(await net(),before);
 const payable=await save('payable',{code:'SYN-PAYABLE',partner:'Synthetic supplier',amount:'100'}),p=await save('payable_payment',{payable_id:payable.id,account_id:account,amount:'30'});const corrected=await save('payable_payment',{payable_id:payable.id,account_id:account,amount:'50'},p.journal_id as string);assert.equal((await view('receivables')).rows.find(r=>r.id===payable.id)?.balance_vnd,'50');await remove(corrected.journal_id);await remove(payable.journal_id);assert.ok(!(await view('receivables')).rows.some(r=>r.id===payable.id));
});
test('KH-02 three departments calculate payroll from attendance; editing/deleting shifts recalculates and preserves posted snapshots',async()=>{
 const shifts=[];for(const id of staff)shifts.push(await save('attendance',{employee_id:id,starts_at:'2026-11-18T00:00:00+07:00',ends_at:'2026-11-18T08:00:00+07:00',break_minutes:'0',daily:'0',support:'0',advance:'0',deduction:'0'}));
 let payroll=await view('payroll');assert.equal(payroll.rows.length,3);assert.deepEqual(payroll.rows.map(r=>r.department).sort(),['BH','SX','VP']);assert.ok(payroll.rows.every(r=>r.base_vnd==='120000'));
 await save('payroll',{expected:payroll.payroll_version});const changed=await save('attendance',{employee_id:staff[0],starts_at:'2026-11-18T00:00:00+07:00',ends_at:'2026-11-18T09:00:00+07:00',break_minutes:'0',daily:'0',support:'0',advance:'0',deduction:'0'},shifts[0].journal_id as string);
 payroll=await view('payroll');assert.equal(payroll.rows.find(r=>r.employee_id===staff[0])?.base_vnd,'135000');await save('payroll',{expected:payroll.payroll_version});assert.equal((await db.query<{n:number}>("select count(*) n from payroll_periods where status='reversed'")).rows[0].n,1);
 await remove(changed.journal_id);assert.ok(!(await view('payroll')).rows.some(r=>r.employee_id===staff[0]));
});
test('historical cash source becomes effective ledger rows once; deleting never makes replay reimport it',async()=>{
 const before=await net();await db.query("insert into private.entry_source_rows(source_hash,source_key,module,business_date,payload) values('synthetic-cash','v9LegacyCash:0','cash','2026-11-18',$1),('synthetic-cash','v9LegacyCash:1','cash','2026-11-18',$2)",[{account:'Tiền mặt',type:'Thu',amount:100,category:'Thu khác',note:'Synthetic income'},{account:'Tiền mặt',type:'Chi',amount:30,category:'Chi khác',note:'Synthetic cost'}]);const sql=buildPromoteEntryCash();await db.exec(sql);await db.exec(sql);assert.equal(await net(),before+70);const workspace=await view('cash');assert.deepEqual((workspace as unknown as {sources:unknown[]}).sources,[]);const journal=workspace.history.find(j=>(j.input as R).source_key==='v9LegacyCash:0')!;await remove(journal.id);await db.exec(sql);assert.equal(await net(),before-30);
});
test('033 forward patch is guarded and API roles cannot delete by raw table access',async()=>{
 const old=await database('202611180032_connected_entry.sql');try{const patch=buildEntryCompactUpdate(await fs.readFile('../supabase/migrations/202611180033_entry_compact_actions.sql','utf8'));await old.exec(patch);await assert.rejects(old.exec(patch),/PATCH_033_ALREADY_PRESENT/);}finally{await old.close();}
 await assert.rejects(rpc('delete_entry',[randomUUID(),randomUUID()],identities.a),/FORBIDDEN|no rows/i);await assert.rejects(asUser(db,identities.a,()=>db.query('select * from entry_changes')),/permission denied/);
});

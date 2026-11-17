import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {database,asUser,identities} from './database-fixture';
let db:PGlite;
const ids={store:randomUUID(),destination:randomUUID(),product:randomUUID(),warehouse:randomUUID(),cash:randomUUID(),bank:randomUUID()};
type Item={id:string;version:number;document_version:number;lot_id:string;lot_version:number;status:string;balance:string};
type Report={sources:Item[];inventory:Item[];sales:Item[];valuation:null};
const rpc=async(name:string,args:unknown[],user=identities.admin)=>(await asUser(db,user,()=>db.query<{result:Record<string,unknown>}>(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args))).rows[0].result;
const action=(kind:string,id:string,version:number|null,input:Record<string,unknown>={},key=randomUUID(),user=identities.admin,date='2026-11-18')=>rpc('kiosk_action',[kind,id,version,date,{note:'Physical check confirmed',...input},key],user);
const report=async()=>(await rpc('kiosk_report',['2026-11-01','2026-11-30',0,0])) as unknown as Report;
async function source(){const document=randomUUID(),line=randomUUID();await db.query<Record<string,unknown>>("insert into sales_documents(id,store_id,sold_on,status) values($1,$2,'2026-11-17','posted')",[document,ids.store]);await db.query<Record<string,unknown>>('insert into sales_lines(id,document_id,product_id,delivered,sold,returned,store_borne,price_vnd,discount_rate,net_revenue_vnd) values($1,$2,$3,100,80,10,10,30,0.1,2430)',[line,document,ids.product]);return {document,line};}
async function approved(){const src=await source();const value=await action('approve',src.line,1,{document_version:1});return {src,lot:String(value.lot_id)};}
before(async()=>{db=await database();for(const [id,code] of [[ids.store,'SOURCE'],[ids.destination,'KIOSK']])await db.query<Record<string,unknown>>('insert into stores(id,code,name) values($1,$2,$2)',[id,code]);await db.query<Record<string,unknown>>("insert into products(id,code,name,sale_unit) values($1,'K-MEAL','Meal','portion')",[ids.product]);await db.query<Record<string,unknown>>("insert into warehouses(id,code,name,kind) values($1,'KIOSK','Kiosk warehouse','kiosk')",[ids.warehouse]);for(const [id,code,kind] of [[ids.cash,'CASH','cash'],[ids.bank,'BANK','bank']])await db.query<Record<string,unknown>>('insert into bank_accounts(id,code,name,kind) values($1,$2,$2,$3)',[id,code,kind]);});
after(async()=>{await db?.close();});

test('legacy 100/80/10/10: approval has no stock/revenue, receipt adds 10, sale consumes once and posts exact finance',async()=>{
 const {src,lot}=await approved();assert.equal((await report()).inventory.length,0);assert.equal((await db.query<Record<string,unknown>>('select id from kiosk_sales')).rows.length,0);
 const key=randomUUID();assert.deepEqual(await action('receive',lot,1,{warehouse_id:ids.warehouse},key),await action('receive',lot,1,{warehouse_id:ids.warehouse},key));
 await assert.rejects(()=>action('receive',lot,2,{warehouse_id:ids.warehouse}),/KIOSK_INVALID_STATUS/);
 assert.equal((await report()).inventory.find(row=>row.id===lot)?.balance,'10.000000');
 const saleInput={quantity:'4',price_vnd:'25',cash_vnd:'60',bank_vnd:'40',cash_account_id:ids.cash,bank_account_id:ids.bank,store_id:ids.destination};
 await assert.rejects(()=>action('sell',lot,2,{...saleInput,quantity:'11'}),/KIOSK_INSUFFICIENT_STOCK/);
 const saleKey=randomUUID(),sale=await action('sell',lot,2,saleInput,saleKey);assert.deepEqual(sale,await action('sell',lot,2,saleInput,saleKey));
 assert.equal(sale.revenue_vnd,'100');assert.equal(sale.unpaid_vnd,'0');assert.equal(sale.valuation,null);assert.equal((await report()).inventory.find(row=>row.id===lot)?.balance,'6.000000');
 assert.equal((await db.query<Record<string,unknown>>('select sum(net_revenue_vnd)::text amount from sales_lines l join sales_documents d on d.id=l.document_id where d.status=\'posted\'')).rows[0].amount,'2530');
 assert.equal((await db.query<Record<string,unknown>>('select sum(amount_vnd)::text amount from cash_ledger')).rows[0].amount,'100');
 assert.equal((await db.query<Record<string,unknown>>('select net_revenue_vnd from sales_lines where id=$1',[src.line])).rows[0].net_revenue_vnd,2430);
 await assert.rejects(()=>action('undo_receive',lot,3),/KIOSK_LINKED_SALE/);
 await action('undo_sale',String(sale.sale_id),1);
 assert.equal((await report()).inventory.find(row=>row.id===lot)?.balance,'10.000000');
 assert.equal((await db.query<Record<string,unknown>>("select sum(case when direction='in' then amount_vnd else -amount_vnd end)::text amount from cash_ledger")).rows[0].amount,'0');
 assert.equal((await db.query<Record<string,unknown>>('select amount_vnd+(select coalesce(sum(amount_vnd),0) from debt_adjustments where receivable_id=r.id) adjusted from receivables r')).rows[0].adjusted,'0');
 await action('undo_receive',lot,4);await action('undo_approval',lot,5);assert.ok(!(await report()).inventory.some(row=>row.id===lot));
});

test('kiosk rejects stale/null versions, other-source destination, invalid money and over-collection atomically',async()=>{
 const {lot}=await approved();await action('receive',lot,1,{warehouse_id:ids.warehouse});
 const input={quantity:'2',price_vnd:'25',cash_vnd:'0',bank_vnd:'0',store_id:ids.destination};
 await assert.rejects(()=>action('sell',lot,null,input),/INVALID_KIOSK_REQUEST/);
 await assert.rejects(()=>action('sell',lot,1,input),/VERSION_CONFLICT/);
 await assert.rejects(()=>action('sell',lot,2,{...input,store_id:ids.store}),/KIOSK_DESTINATION_REQUIRED/);
 await assert.rejects(()=>action('sell',lot,2,{...input,price_vnd:''}),/INVALID_KIOSK_SALE/);
 await assert.rejects(()=>action('sell',lot,2,{...input,cash_vnd:'51'}),/KIOSK_OVERPAYMENT/);
 const result=await action('sell',lot,2,input);assert.equal(result.unpaid_vnd,'50');
 const receiptKey=randomUUID(),debt=(await db.query<{id:string}>('select id from receivables where sales_document_id=(select sales_document_id from kiosk_sales where id=$1)',[result.sale_id])).rows[0].id;
 await rpc('post_payment',[ids.destination,ids.cash,'2026-11-18',10,[{receivable_id:debt,amount_vnd:10}],'Later debt payment',receiptKey]);
 await assert.rejects(()=>action('undo_sale',String(result.sale_id),1),/KIOSK_LINKED_PAYMENT/);
});

test('a failure while posting kiosk cash rolls back the sale, debt, stock use and idempotency entry',async()=>{
 const {lot}=await approved();await action('receive',lot,1,{warehouse_id:ids.warehouse});
 const before=(await db.query<{count:number}>('select count(*)::int count from kiosk_sales')).rows[0].count;
 await db.exec("create function private.test_reject_cash() returns trigger language plpgsql as $$begin raise exception 'FIXTURE_CASH_FAILURE';end $$; create trigger test_reject_cash before insert on cash_ledger for each row execute function private.test_reject_cash()");
 const key=randomUUID(),input={quantity:'1',price_vnd:'25',cash_vnd:'25',bank_vnd:'0',cash_account_id:ids.cash,store_id:ids.destination};
 await assert.rejects(()=>action('sell',lot,2,input,key),/FIXTURE_CASH_FAILURE/);
 assert.equal((await db.query<{count:number}>('select count(*)::int count from kiosk_sales')).rows[0].count,before);
 assert.equal((await db.query<{count:number}>('select count(*)::int count from idempotency_keys where key=$1',[key])).rows[0].count,0);
 assert.equal((await report()).inventory.find(row=>row.id===lot)?.balance,'10.000000');
 await db.exec('drop trigger test_reject_cash on cash_ledger;drop function private.test_reject_cash()');
 await action('sell',lot,2,input,key);assert.equal((await report()).inventory.find(row=>row.id===lot)?.balance,'9.000000');
});

test('kiosk read/write scope, closed periods and source changes remain enforced by PostgreSQL',async()=>{
 const {src,lot}=await approved();for(const permissionModule of ['kiosk','stores','products'])await db.query<Record<string,unknown>>("insert into user_permissions values($1,$2,'view',true)",[identities.accountant,permissionModule]);
 assert.ok((await rpc('kiosk_report',['2026-11-01','2026-11-30',0,0],identities.accountant)).sources);
 await assert.rejects(()=>action('receive',lot,1,{warehouse_id:ids.warehouse},randomUUID(),identities.accountant),/FORBIDDEN/);
 await rpc('set_accounting_period',['2026-11-01','2026-11-30',true,'Owner closed period',randomUUID()]);
 await assert.rejects(()=>action('receive',lot,1,{warehouse_id:ids.warehouse}),/PERIOD_CLOSED/);
 await rpc('set_accounting_period',['2026-11-01','2026-11-30',false,'Owner reopens period',randomUUID()]);
 await db.query<Record<string,unknown>>('update sales_lines set returned=9 where id=$1',[src.line]);
 await assert.rejects(()=>action('receive',lot,1,{warehouse_id:ids.warehouse}),/KIOSK_SOURCE_CHANGED/);
 await assert.rejects(()=>report(),/KIOSK_SOURCE_CHANGED/);
});

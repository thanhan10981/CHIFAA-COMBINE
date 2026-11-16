import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {gas} from './gas-mock.mjs';import {send} from './auth-helpers.mjs';
import {client} from './client-fixture.mjs';
function fixture(){const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;
  const put=(m,r)=>g.ctx.writeRow_(m,{version:1,updatedAt:'2026-11-01T00:00:00Z',deleted:false,reverses:'',...r});
  put('stores',{recordId:'shop',name:'Shop',address:'',contact:''});put('stores',{recordId:'kiosk',name:'Kiosk',address:'',contact:''});put('dishes',{recordId:'dish',name:'Meal',price:30,published:true});
  put('sales',{recordId:'sale',date:'2026-11-02',storeId:'shop',dishId:'dish',delivered:100,sold:80,returned:10,creditQty:10,price:30,discount:.1,recoveryPrice:2,cash:2430,bank:0,oldDebtPaid:0,otherCost:0,note:''});
  const rpc=(a,args={})=>send(g,a,{token,key:crypto.randomUUID(),...args});
  const approve=()=>{const sale=g.ctx.rawRows_('sales')[0];return rpc('kiosk',{kind:'approve',id:sale.recordId,sourceHash:sale._hash,date:'2026-11-02',note:'Return checked'});};
  const report=()=>rpc('kioskReport',{from:'2026-11-01',to:'2026-11-30',force:true}).data;
  return {g,rpc,approve,report,put};
}
test('100/80/10/10: approval has no stock or revenue; actual receipt adds10 once; kiosk sale consumes only actual stock',()=>{
  const {g,rpc,approve,report}=fixture();const source=g.ctx.salesMetrics(g.ctx.rawRows_('sales')[0]);assert.equal(source.netRevenue,2430);assert.equal(source.recoveryExpense,20);
  assert.equal(approve().ok,true);assert.equal(report().inventory.length,0);assert.equal(g.ctx.rawRows_('sales').length,1);
  const row=report().rows[0],args={kind:'receive',id:row.approvalId,date:'2026-11-03',note:'Physically received',key:crypto.randomUUID()};
  assert.equal(rpc('kiosk',args).ok,true);assert.equal(rpc('kiosk',args).ok,true);assert.equal(report().inventory[0].balance,10);
  assert.equal(rpc('kiosk',{...args,key:crypto.randomUUID()}).error.code,'CONFLICT');
  assert.equal(rpc('kiosk',{kind:'sell',id:row.approvalId,date:'2026-11-04',note:'Sale checked',quantity:11,storeId:'kiosk',price:25,cash:275,bank:0}).error.code,'BALANCE');
  const sell={kind:'sell',id:row.approvalId,date:'2026-11-04',note:'Sale checked',quantity:4,storeId:'kiosk',price:25,cash:100,bank:0,key:crypto.randomUUID()};
  assert.equal(rpc('kiosk',sell).ok,true);assert.equal(rpc('kiosk',sell).ok,true);assert.equal(report().inventory[0].balance,6);
  assert.equal(g.ctx.rawRows_('sales').length,2);assert.equal(g.ctx.effective(g.ctx.rawRows_('sales')).reduce((n,s)=>n+g.ctx.salesMetrics(s).netRevenue,0),2530);
  assert.equal(g.ctx.rawRows_('production').length,0);assert.equal(g.ctx.rawRows_('cash').length,0);
});
test('Kiosk rejects stale source, unauthorized writes, closed periods, repeat approval and reversing linked sales',()=>{
  const {g,rpc,approve,report}=fixture();assert.equal(rpc('kiosk',{kind:'approve',id:'sale',sourceHash:'stale',date:'2026-11-02',note:'Checked return'}).error.code,'CONFLICT');
  assert.equal(approve().ok,true);assert.equal(approve().error.code,'CONFLICT');const sale=g.ctx.rawRows_('sales')[0];
  assert.equal(rpc('mutate',{module:'sales',operation:'reverse',id:sale.recordId,expectedVersion:sale.version,expectedHash:sale._hash}).error.code,'LINKED');
  g.ctx.append_('_Users',['staff','staff@example.com','staff',JSON.stringify({sales:['read'],stores:['read'],dishes:['read']}),true,1]);const token=g.ctx.issueSession_('staff@example.com','staff').token;
  assert.equal(send(g,'kioskReport',{token,from:'2026-11-01',to:'2026-11-30',force:true}).ok,true);
  assert.equal(send(g,'kiosk',{token,kind:'receive',id:report().rows[0].approvalId,date:'2026-11-03',note:'Checked',key:crypto.randomUUID()}).error.code,'FORBIDDEN');
  assert.equal(rpc('workflow',{kind:'close',from:'2026-11-03',to:'2026-11-03',note:'Period reviewed'}).ok,true);
  assert.equal(rpc('kiosk',{kind:'receive',id:report().rows[0].approvalId,date:'2026-11-03',note:'Checked'}).error.code,'CLOSED');
  g.ctx.writeRow_('sales',{...sale,returned:9});assert.equal(rpc('kioskReport',{from:'2026-11-01',to:'2026-11-30',force:true}).error.code,'CONFLICT');
});
test('Kiosk receipt rollback preserves approved state, rejection never adds stock',()=>{
  const {g,rpc,approve,report}=fixture();approve();const id=report().rows[0].approvalId;
  g.failNext('_Workflows');assert.equal(rpc('kiosk',{kind:'receive',id,date:'2026-11-03',note:'Receive checked'}).ok,false);
  assert.equal(report().rows[0].status,'approved');assert.equal(report().inventory.length,0);
  assert.equal(rpc('kiosk',{kind:'reject',id,date:'2026-11-03',note:'Quantity disputed'}).ok,true);
  assert.equal(report().rows[0].status,'rejected');assert.equal(report().inventory.length,0);
});
test('Kiosk undo preserves history, reverses sale and restores stock before allowing source reversal',()=>{
  const {g,rpc,approve,report}=fixture();approve();const id=report().rows[0].approvalId;
  rpc('kiosk',{kind:'receive',id,date:'2026-11-03',note:'Received checked'});
  assert.equal(rpc('kiosk',{kind:'sell',id,date:'2026-11-04',note:'Sale checked',quantity:4,storeId:'kiosk',price:25,cash:100,bank:0}).ok,true);
  assert.equal(rpc('kiosk',{kind:'undo',id,date:'2026-11-05',note:'Correction requested'}).error.code,'LINKED');
  let history=report().history;const sold=history.find(r=>r.kind==='kiosk-sale');
  assert.equal(rpc('kiosk',{kind:'undo',id:sold.id,date:'2026-11-05',note:'Sale cancellation checked'}).ok,true);
  assert.equal(report().inventory[0].balance,10);assert.equal(g.ctx.rawRows_('sales').length,3);
  assert.equal(g.ctx.effective(g.ctx.rawRows_('sales')).length,1);
  history=report().history;const receipt=history.find(r=>r.kind==='return-received');
  assert.equal(rpc('kiosk',{kind:'undo',id:receipt.id,date:'2026-11-05',note:'Receipt correction checked'}).ok,true);
  assert.equal(report().inventory.length,0);
  assert.equal(rpc('kiosk',{kind:'undo',id,date:'2026-11-05',note:'Approval correction checked'}).ok,true);
  const row=g.ctx.rawRows_('sales')[0];assert.equal(rpc('mutate',{module:'sales',operation:'reverse',id:row.recordId,expectedHash:row._hash,expectedVersion:row.version}).ok,true);
});
test('Kiosk screen loads from server and prevents double submit while approval is in flight',async()=>{
  const c=await client();c.run(`state.demo=false;globalThis.calls=[];globalThis.release=null;call=async(a,args)=>{calls.push({a,args});if(a==='kiosk')return new Promise(resolve=>{release=resolve;});return {rows:[{id:'sale',hash:'hash',date:'2026-11-02',store:'Shop',dish:'Meal',quantity:10,status:'pending'}],inventory:[],history:[]};};location.hash='#kiosk';route();`);
  for(let i=0;i<6;i++)await Promise.resolve();assert.match(c.document.getElementById('view').textContent,/Chờ duyệt/);
  const button=[...c.document.querySelectorAll('button')].find(b=>b.textContent==='Duyệt');button.click();button.click();
  for(let i=0;i<4;i++)await Promise.resolve();assert.equal(c.run("calls.filter(c=>c.a==='kiosk').length"),1);
  assert.equal(c.run("calls.find(c=>c.a==='kiosk').args.sourceHash"),'hash');c.run('release({})');
  for(let i=0;i<6;i++)await Promise.resolve();assert.match(c.document.querySelector('.toast-success').textContent,/Đã ghi nhận/);
});

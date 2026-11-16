import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {gas} from './gas-mock.mjs';import {send} from './auth-helpers.mjs';
import {client} from './client-fixture.mjs';
function fixture(){const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;
  const put=(m,r)=>g.ctx.writeRow_(m,{version:1,updatedAt:'2026-11-01T00:00:00Z',deleted:false,reverses:'',...r});
  put('stores',{recordId:'s',name:'Shop',address:'',contact:''});put('dishes',{recordId:'d',name:'Meal',price:30,published:true});
  put('orders',{recordId:'o',date:'2026-11-02',shift:'AM',storeId:'s',dishId:'d',quantity:30,contact:'PRIVATE-CONTACT',customer:'PRIVATE-CUSTOMER',status:'approved'});
  put('production',{recordId:'p',date:'2026-11-02',dishId:'d',planned:100,produced:0,extra:0,rejected:0,note:''});
  const rpc=(a,args)=>send(g,a,{token,key:crypto.randomUUID(),...args}),args=()=>({operation:'link',orderId:'o',orderHash:g.ctx.rawRows_('orders')[0]._hash,productionId:'p',productionHash:g.ctx.rawRows_('production')[0]._hash,note:'Order mapped to existing plan'});
  return {g,rpc,put,args};
}
test('Approved order links existing plan once without increasing production demand, stock, cash or revenue',()=>{
  const {g,rpc,args}=fixture(),request={...args(),key:crypto.randomUUID()},before=JSON.stringify(g.tables.get('production').rows);
  assert.equal(rpc('linkOrderPlan',request).ok,true);assert.equal(rpc('linkOrderPlan',request).ok,true);
  assert.equal(rpc('linkOrderPlan',args()).error.code,'CONFLICT');const list=rpc('orderPlans',{from:'2026-11-01',to:'2026-11-30',orderId:'o'}).data;
  assert.equal(list.rows[0].linked,30);assert.equal(list.links[0].valid,true);assert.equal(list.rows[0].planned,100);
  for(const privateValue of ['PRIVATE-CONTACT','PRIVATE-CUSTOMER'])assert.equal(JSON.stringify(list).includes(privateValue),false);
  assert.equal(JSON.stringify(g.tables.get('production').rows),before);for(const m of ['cash','sales','stock'])assert.equal(g.ctx.rawRows_(m).length,0);
  const p=g.ctx.rawRows_('production')[0];assert.equal(rpc('mutate',{module:'production',operation:'reverse',id:p.recordId,expectedVersion:p.version,expectedHash:p._hash}).error.code,'LINKED');
  assert.equal(rpc('linkOrderPlan',{operation:'unlink',id:list.links[0].id,note:'Reschedule order checked'}).ok,true);
  assert.equal(rpc('orderPlans',{from:'2026-11-01',to:'2026-11-30',orderId:'o'}).data.links.length,0);
});
test('Order planning refuses over-allocation, pending orders, stale hashes and insufficient grants',()=>{
  const {g,rpc,put,args}=fixture();put('production',{...g.ctx.rawRows_('production')[0],planned:20});assert.equal(rpc('linkOrderPlan',args()).error.code,'BALANCE');
  put('orders',{...g.ctx.rawRows_('orders')[0],status:'pending'});assert.equal(rpc('linkOrderPlan',args()).error.code,'VALIDATION');
  put('orders',{...g.ctx.rawRows_('orders')[0],status:'approved'});assert.equal(rpc('linkOrderPlan',{...args(),orderHash:'stale'}).error.code,'CONFLICT');
  g.ctx.append_('_Users',['staff','staff@example.com','staff',JSON.stringify({orders:['read','approve'],production:['read'],dishes:['read']}),true,1]);const token=g.ctx.issueSession_('staff@example.com','staff').token;
  assert.equal(send(g,'orderPlans',{token,from:'2026-11-01',to:'2026-11-30'}).ok,true);
  assert.equal(send(g,'linkOrderPlan',{token,...args(),key:crypto.randomUUID()}).error.code,'FORBIDDEN');
});
test('Direct plan edits mark links stale; closed days block unlink until explicit reopen',()=>{
  const {g,rpc,put,args}=fixture();assert.equal(rpc('linkOrderPlan',args()).ok,true);
  const p=g.ctx.rawRows_('production')[0];put('production',{...p,planned:120});
  let list=rpc('orderPlans',{from:'2026-11-01',to:'2026-11-30',orderId:'o'}).data;assert.equal(list.issues,1);assert.equal(list.links[0].valid,false);
  assert.equal(rpc('workflow',{kind:'close',from:'2026-11-02',to:'2026-11-02',note:'Reviewed day'}).ok,true);
  assert.equal(rpc('linkOrderPlan',{operation:'unlink',id:list.links[0].id,note:'Plan edited directly'}).error.code,'CLOSED');
});
test('Order planning dialog loads scoped candidates and submits explicit source hashes',async()=>{
  const c=await client();c.run(`state.demo=false;globalThis.calls=[];call=async(a,args)=>{calls.push({a,args});return {rows:[{id:'p',hash:'ph',date:'2026-11-02',dish:'Meal',planned:100,linked:0}],links:[],issues:0};};openOrderPlan({recordId:'o',_hash:'oh',date:'2026-11-02',dishId:'d',quantity:30});`);
  for(let i=0;i<6;i++)await Promise.resolve();const dialog=c.document.querySelector('[data-private-dialog="order-plan"]');assert.ok(dialog);
  [...dialog.querySelectorAll('button')].find(b=>b.textContent==='Liên kết 30 phần').click();for(let i=0;i<6;i++)await Promise.resolve();
  assert.equal(c.run("calls.find(c=>c.a==='linkOrderPlan').args.orderHash"),'oh');assert.equal(c.run("calls.find(c=>c.a==='linkOrderPlan').args.productionHash"),'ph');
});

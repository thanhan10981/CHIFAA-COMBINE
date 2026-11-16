import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {gas} from './gas-mock.mjs';import {send} from './auth-helpers.mjs';import {client} from './client-fixture.mjs';
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
test('Write outcome inspection returns state only, scopes ownership, and can inspect a prepared journal',()=>{
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,key=crypto.randomUUID();
  g.ctx.append_('_Requests',[key,'admin@example.com','fingerprint','ROLLED_BACK','PRIVATE-PAYLOAD','PRIVATE-RESULT','2026-11-01']);
  let r=send(g,'requestStatus',{token,key});assert.equal(r.ok,true);assert.deepEqual(Object.keys(r.data),['state']);assert.equal(r.data.state,'ROLLED_BACK');
  assert.equal(JSON.stringify(r).includes('PRIVATE-'),false);
  g.ctx.append_('_Users',['staff','staff@example.com','staff','{}',true,1]);const staff=g.ctx.issueSession_('staff@example.com','staff').token;
  assert.equal(send(g,'requestStatus',{token:staff,key}).error.code,'FORBIDDEN');
  g.tables.get('_Requests').rows[1][3]='PREPARED';g.properties.set('WRITE_IN_PROGRESS',key);
  assert.equal(send(g,'requestStatus',{token,key}).data.state,'PREPARED');
  assert.equal(send(g,'requestStatus',{token,key:crypto.randomUUID()}).data.state,'NOT_FOUND');
});
test('Kiosk unknown-outcome key survives route change and retries the same operation',async()=>{
  const c=await client();c.run(`state.demo=false;globalThis.writes=[];call=async(a,args)=>{if(a==='kiosk'){writes.push(args);if(writes.length===1)throw Object.assign(new Error('Network'),{code:'TIMEOUT'});return {};}if(a==='requestStatus')return {state:'NOT_FOUND'};return {rows:[{id:'sale',hash:'hash',date:'2026-11-02',store:'Store',dish:'Meal',quantity:10,status:'pending'}],inventory:[],history:[]};};location.hash='#kiosk';route();`);await flush();
  [...c.document.querySelectorAll('button')].find(b=>b.textContent==='Duyệt').click();await flush();const key=c.run('state.kioskPending.key');
  c.run('route()');await flush();const retry=[...c.document.querySelectorAll('button')].find(b=>b.textContent==='Kiểm tra lại cùng lần ghi');assert.equal(retry.hidden,false);retry.click();await flush();
  assert.equal(c.run('writes.length'),2);assert.equal(c.run('writes[1].key'),key);assert.equal(c.run('state.kioskPending'),null);
});
test('Confirmed kiosk rollback unlocks review but never submits a replacement automatically',async()=>{
  const c=await client();c.run(`state.demo=false;globalThis.writes=0;call=async(a)=>{if(a==='kiosk'){writes++;throw Object.assign(new Error('Network'),{code:'NETWORK'});}if(a==='requestStatus')return {state:'ROLLED_BACK'};return {rows:[{id:'sale',hash:'hash',date:'2026-11-02',store:'Store',dish:'Meal',quantity:10,status:'pending'}],inventory:[],history:[]};};location.hash='#kiosk';route();`);await flush();
  [...c.document.querySelectorAll('button')].find(b=>b.textContent==='Duyệt').click();await flush();assert.equal(c.run('state.kioskPending'),null);assert.equal(c.run('writes'),1);
  assert.ok([...c.document.querySelectorAll('button')].some(b=>b.textContent==='Duyệt'));
});
test('Checked entry confirmed rollback restores preview state without a second financial write',async()=>{
  const c=await client();c.run(`state.demo=false;state.data.dishes=[{recordId:'d',name:'Meal'}];state.partialModules={};globalThis.writes=0;call=async(a,args)=>{if(a==='requestStatus')return {state:'ROLLED_BACK'};if(args.preview)return {digest:'digest',preview:{scope:'new-voucher',diff:[]}};writes++;throw Object.assign(new Error('Rolled back'),{code:'RECOVERY'});};openEntryCommand('production');`);await flush();
  const dialog=c.document.querySelector('[data-private-dialog="entry"]'),form=dialog.querySelector('form'),submit=dialog.querySelector('[type="submit"]');
  form.dispatchEvent(new c.context.window.Event('submit',{cancelable:true}));await flush();form.dispatchEvent(new c.context.window.Event('submit',{cancelable:true}));await flush();
  assert.equal(c.run('state.entryPending'),null);assert.equal(c.run('writes'),1);assert.equal(submit.textContent,'Xem trước');assert.equal(dialog.querySelector('input').disabled,false);
});
test('Legacy editor confirmed rollback preserves typed values and unfreezes fields',async()=>{
  const c=await client();c.run(`state.demo=false;state.uncertain={module:'materials',operation:'create',key:'old-request-key-123456',record:{name:'Typed rice',purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0}};openEditor('materials');call=async(a)=>{if(a==='requestStatus')return {state:'ROLLED_BACK'};throw Object.assign(new Error('Rolled back'),{code:'RECOVERY'});};document.getElementById('record-form').dispatchEvent(new window.Event('submit',{cancelable:true}));`);await flush();
  assert.equal(c.run('state.uncertain'),null);assert.notEqual(c.run('state.formKey'),'old-request-key-123456');assert.equal(c.document.querySelector('[name="name"]').value,'Typed rice');assert.equal(c.document.querySelector('[name="name"]').disabled,false);
});
test('Late outcome lookup cannot restore another account private pending record after logout',async()=>{
  const c=await client();c.run(`state.demo=false;state.token='old-token';openEditor('materials');formRecord=()=>({name:'PRIVATE-TYPED',purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0});globalThis.resolveStatus=null;call=async(a)=>{if(a==='requestStatus')return new Promise(resolve=>{resolveStatus=resolve;});throw Object.assign(new Error('Recovery'),{code:'RECOVERY'});};document.getElementById('record-form').dispatchEvent(new window.Event('submit',{cancelable:true}));`);await flush();assert.equal(typeof c.context.resolveStatus,'function');
  c.run(`localLogout();state.token='new-token';resolveStatus({state:'NOT_FOUND'});`);await flush();assert.equal(c.run('state.uncertain'),null);assert.equal(c.document.getElementById('form-fields').children.length,0);
});
test('A permission-scope change discards a late pending-record callback even when token is unchanged',async()=>{
  const c=await client();c.run(`state.demo=false;state.token='same-token';state.grantKey='old-grants';openEditor('materials');formRecord=()=>({name:'PRIVATE-TYPED',purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0});globalThis.resolveStatus=null;call=async(a)=>{if(a==='requestStatus')return new Promise(resolve=>{resolveStatus=resolve;});throw Object.assign(new Error('Recovery'),{code:'RECOVERY'});};document.getElementById('record-form').dispatchEvent(new window.Event('submit',{cancelable:true}));`);await flush();
  c.run(`state.grantKey='new-grants';state.uncertain=null;state.saving=false;document.getElementById('form-fields').replaceChildren();resolveStatus({state:'NOT_FOUND'});`);await flush();assert.equal(c.run('state.uncertain'),null);assert.equal(c.run('state.saving'),false);assert.equal(c.document.getElementById('form-fields').children.length,0);
});

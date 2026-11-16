import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {gas} from './gas-mock.mjs';import {send} from './auth-helpers.mjs';
import {client} from './client-fixture.mjs';
function fixture(){const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;
  const put=(m,r)=>g.ctx.writeRow_(m,{version:1,updatedAt:'2026-11-01T00:00:00Z',deleted:false,reverses:'',...r});
  put('materials',{recordId:'m',name:'Rice',purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:2,minimum:0});put('dishes',{recordId:'d',name:'Meal',price:30,published:true});
  put('recipes',{recordId:'r',name:'Meal recipe',kind:'mon',dishId:'d',yield:1,lines:[{type:'material',id:'m',quantity:1}]});put('stock',{recordId:'opening',date:'2026-01-01',materialId:'m',type:'nhap',quantity:1000,unitCost:2,note:''});
  const record={date:'2026-01-02',dishId:'d',planned:100,produced:100,extra:0,rejected:0,note:''},rpc=(a,args)=>send(g,a,{token,key:crypto.randomUUID(),...args});
  const prepare=(args)=>rpc('entry',{module:'production',command:'NEW',record,note:'Checked production',...args,preview:true});
  const commit=args=>{const p=prepare(args);assert.equal(p.ok,true,JSON.stringify(p));return rpc('entry',{module:'production',command:'NEW',record,note:'Checked production',...args,digest:p.data.digest});};
  return {g,rpc,record,prepare,commit};
}
test('NEW100 -> APPEND30 -> CORRECT base to90 leaves120; explicit one-voucher scope preserves extra30 and all history',()=>{
  const {g,record,prepare,commit}=fixture();const preview=prepare({});assert.equal(preview.data.preview.scope,'new-voucher');assert.equal(g.ctx.rawRows_('production').length,0);
  assert.equal(commit({}).ok,true);const base=g.ctx.effective(g.ctx.rawRows_('production'))[0],source={id:base.recordId,expectedVersion:base.version,expectedHash:base._hash};
  assert.equal(commit({command:'APPEND',...source,record:{...record,planned:30,produced:30}}).ok,true);
  const p=prepare({command:'CORRECT',...source,record:{...record,planned:90,produced:90}});assert.equal(p.data.preview.scope,'replace-one-voucher');assert.ok(p.data.preview.diff.some(d=>d.field==='produced'&&d.before===100&&d.after===90));
  assert.equal(commit({command:'CORRECT',...source,record:{...record,planned:90,produced:90}}).ok,true);
  assert.equal(g.ctx.effective(g.ctx.rawRows_('production')).reduce((n,p)=>n+p.produced,0),120);
  assert.equal(g.ctx.inventory(g.ctx.data_(),'2026-01-02')[0].balance,880);
  assert.equal(g.ctx.rawRows_('production').length,4);assert.ok(g.ctx.effective(g.ctx.workflowRows_()).some(w=>w.kind==='entry-correct'));
  const replacement=g.ctx.effective(g.ctx.rawRows_('production')).find(p=>p.produced===90);
  assert.equal(commit({command:'CORRECT',id:replacement.recordId,expectedVersion:replacement.version,expectedHash:replacement._hash,record:{...record,produced:60,planned:60}}).ok,true);
  assert.equal(g.ctx.effective(g.ctx.rawRows_('production')).reduce((n,p)=>n+p.produced,0),90);
});
test('Entry rejects duplicate NEW, stale preview, changed source, forbidden action and closed period',()=>{
  const {g,record,rpc,prepare,commit}=fixture();assert.equal(commit({command:'BACKFILL'}).ok,true);assert.equal(prepare({}).error.code,'CONFLICT');
  const row=g.ctx.rawRows_('production')[0],args={module:'production',command:'CORRECT',id:row.recordId,expectedVersion:row.version,expectedHash:row._hash,record:{...record,produced:90},note:'Correction checked'};
  const p=rpc('entry',{...args,preview:true});const material=g.ctx.rawRows_('materials')[0];g.ctx.writeRow_('materials',{...material,purchasePrice:3});
  assert.equal(rpc('entry',{...args,digest:p.data.digest}).error.code,'CONFLICT');assert.equal(g.ctx.effective(g.ctx.rawRows_('production')).length,1);
  assert.equal(rpc('workflow',{kind:'close',from:record.date,to:record.date,note:'Reviewed period'}).ok,true);assert.equal(rpc('entry',{...args,preview:true}).error.code,'CLOSED');
  g.ctx.append_('_Users',['staff','staff@example.com','staff',JSON.stringify({production:['read','create'],stock:['create']}),true,1]);const token=g.ctx.issueSession_('staff@example.com','staff').token;
  assert.equal(send(g,'entry',{token,...args,preview:true}).error.code,'FORBIDDEN');
});
test('Entry correction is one transaction; failure restores original production/stock and retries never duplicate',()=>{
  const {g,record,rpc,prepare,commit}=fixture();commit({});const row=g.ctx.rawRows_('production')[0],args={module:'production',command:'CORRECT',id:row.recordId,expectedVersion:row.version,expectedHash:row._hash,record:{...record,produced:90},note:'Correction checked',key:crypto.randomUUID()};
  const p=prepare(args);g.failNext('stock');assert.equal(rpc('entry',{...args,digest:p.data.digest}).ok,false);
  assert.equal(g.ctx.effective(g.ctx.rawRows_('production'))[0].produced,100);assert.equal(g.ctx.inventory(g.ctx.data_(),'2026-01-02')[0].balance,900);
  const next={...args,key:crypto.randomUUID()},fresh=prepare(next),request={...next,digest:fresh.data.digest};assert.equal(rpc('entry',request).ok,true);assert.equal(rpc('entry',request).ok,true);
  assert.equal(g.ctx.effective(g.ctx.rawRows_('production'))[0].produced,90);assert.equal(g.ctx.inventory(g.ctx.data_(),'2026-01-02')[0].balance,910);
});
test('Entry UI requires preview then confirmation; changed fields invalidate preview and logout removes private dialog',async()=>{
  const c=await client();c.run(`state.demo=false;globalThis.calls=[];state.data.dishes=[{recordId:'d',name:'Meal'}];state.partialModules={};call=async(a,args)=>{calls.push({a,args});return {digest:'digest',preview:{scope:'new-voucher',diff:[{field:'produced',before:null,after:100}]}};};openEntryCommand('production');`);
  for(let i=0;i<5;i++)await Promise.resolve();let dialog=c.document.querySelector('[data-private-dialog="entry"]');assert.ok(dialog);
  const form=dialog.querySelector('form'),submit=dialog.querySelector('[type="submit"]');form.dispatchEvent(new c.context.window.Event('submit',{bubbles:true,cancelable:true}));
  for(let i=0;i<5;i++)await Promise.resolve();assert.equal(c.run('calls[0].args.preview'),true);assert.match(submit.textContent,/Xác nhận ghi/);assert.match(dialog.textContent,/Chưa ghi dữ liệu/);
  dialog.querySelector('input').dispatchEvent(new c.context.window.Event('input',{bubbles:true}));assert.equal(submit.textContent,'Xem trước');
  c.run('localLogout()');assert.equal(c.document.querySelector('[data-private-dialog="entry"]'),null);
});
test('Checked stock form leaves optional unit cost blank instead of silently assuming a free receipt',async()=>{
  const c=await client();c.run(`state.demo=false;state.data.materials=[{recordId:'m',name:'Rice'}];state.partialModules={};openEntryCommand('stock');`);for(let i=0;i<6;i++)await Promise.resolve();
  const dialog=c.document.querySelector('[data-private-dialog="entry"]'),label=[...dialog.querySelectorAll('label')].find(l=>l.textContent.startsWith('Giá / đơn vị sử dụng'));assert.equal(label.querySelector('input').value,'');assert.equal(label.querySelector('input').required,false);
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from'node:fs';import vm from'node:vm';import crypto from'node:crypto';import {parseHTML}from'linkedom';
import {gas} from './gas-mock.mjs';
import {send} from './auth-helpers.mjs';
const strip=s=>s.replace(/^import .*?;\r?\n/gm,'').replace(/^export \{[^}]*\};?\r?\n?/gm,'');
import {client} from './client-fixture.mjs';
test('local shell does not preload user data or financial records',async()=>{const c=await client(false);assert.equal(c.document.getElementById('workspace').hidden,true);assert.equal(c.document.getElementById('login').hidden,false);assert.match(c.document.getElementById('login-status').textContent,/Chưa kết nối/);assert.equal(c.run('Object.keys(state.data).length'),0);});
test('explicit demo opens application with all 37 routes and no invented data',async()=>{const c=await client();assert.equal(c.document.getElementById('workspace').hidden,false);assert.equal(c.document.querySelectorAll('#navigation a').length,37);assert.match(c.document.getElementById('view').textContent,/Chưa có dữ liệu doanh thu/);assert.equal(c.run('state.data.sales.length'),0);});

test('manual refresh and validation errors notify; logout clears previous private notices',async()=>{
  const c=await client();await c.run('refresh(true)');assert.match(c.document.querySelector('.toast-success').textContent,/Đã làm mới/);
  c.run("errorText(new Error('Không thể lưu'))");assert.match(c.document.querySelector('.toast-error').textContent,/Không thể lưu/);assert.equal(c.document.getElementById('error').hidden,false);
  c.run("toast('Private record');localLogout()");assert.equal(c.document.getElementById('toast').hidden,true);assert.equal(c.document.querySelectorAll('.toast-card').length,0);
});

test('record pages request server pagination and print a human-readable voucher',async()=>{
  const c=await client();c.run(`state.demo=false;globalThis.pageCalls=[];call=async(action,args)=>{pageCalls.push({action,args});if(action==='list')return {rows:[{recordId:'m'+args.offset,version:1,name:'Material '+args.offset,purchaseUnit:'kg',unit:'g',conversion:1000,purchasePrice:10,minimum:0}],total:75,next:args.offset===0?50:null};return {};};location.hash='#catalog';route();`);
  for(let i=0;i<4;i++)await Promise.resolve();assert.match(c.document.getElementById('view').textContent,/1–1 \/ 75/);
  [...c.document.querySelectorAll('button')].find(b=>b.textContent==='Trang sau ›').click();for(let i=0;i<4;i++)await Promise.resolve();assert.equal(c.run('pageCalls.at(-1).args.offset'),50);
  c.context.window.print=()=>{};[...c.document.querySelectorAll('button')].find(b=>b.textContent==='In phiếu').click();assert.match(c.document.getElementById('business-print').textContent,/Material 50/);assert.match(c.document.getElementById('business-print').textContent,/Người duyệt/);c.context.window.dispatchEvent(new c.context.window.Event('afterprint'));assert.equal(c.document.getElementById('business-print'),null);
});
test('payroll preview requires a separate confirmation and invalidates when assumptions change',async()=>{
  const c=await client();c.run(`state.demo=false;globalThis.workflowCalls=[];call=async(action,args)=>{if(action==='workflow')workflowCalls.push({action,args});return {preview:{from:'2026-11-01',to:'2026-11-30',rows:[{employeeId:'e',department:'SX',hours:2,base:20,allowances:0,advance:0,deduction:0,bonus:0,pay:20}],total:20}};};state.data.employees=[{recordId:'e',name:'Employee'}];document.getElementById('view').replaceChildren();renderFinancialOperations('payroll');`);
  const find=text=>[...c.document.querySelectorAll('button')].find(b=>b.textContent===text);assert.equal(find('Xác nhận lập phiếu').disabled,true);find('Xem trước').click();for(let i=0;i<4;i++)await Promise.resolve();assert.equal(c.run('workflowCalls.length'),1);assert.equal(c.run('workflowCalls[0].args.preview'),true);assert.equal(find('Xác nhận lập phiếu').disabled,false);assert.match(c.document.getElementById('view').textContent,/20/);
  const field=c.document.querySelector('.operations-card input');field.value='2026-11-15';field.dispatchEvent(new c.context.window.Event('input',{bubbles:true}));assert.equal(find('Xác nhận lập phiếu').disabled,true);assert.equal(c.run('workflowCalls.length'),1);
});
test('interest screen accepts the manually entered amount with no automatic calculation selector',async()=>{
 const c=await client();c.run(`state.demo=false;state.data.loans=[{recordId:'loan',name:'Loan',date:'2026-01-01'}];globalThis.interestCalls=[];call=async(action,args)=>{if(action==='workflowReports')return {rows:[]};interestCalls.push(args);return {preview:{from:args.from,to:args.to,basis:'manual',interest:args.amount,rule:'Manual'}};};document.getElementById('view').replaceChildren();renderFinancialOperations('interest');`);
 const amount=c.document.querySelector('.operations-card input[type=number]');assert.ok(amount);assert.equal(c.document.querySelectorAll('.operations-card select').length,2);amount.value='4567';[...c.document.querySelectorAll('button')].find(b=>b.textContent==='Xem trước').click();for(let i=0;i<4;i++)await Promise.resolve();assert.equal(c.run('interestCalls[0].amount'),4567);assert.equal(c.run('interestCalls[0].basis'),'manual');assert.match(c.document.getElementById('view').textContent,/4.567/);
});

test('maintenance screen exposes initialization, period lock, Portal sync, backup/restore and import controls',async()=>{
  const c=await client();c.run(`state.demo=false;globalThis.opsCalls=[];call=async(action,args)=>{opsCalls.push({action,args});if(action==='workflowStatus')return {ready:false,periods:[],history:[]};return {};};document.getElementById('view').replaceChildren();`);await c.run('renderMaintenance()');const text=c.document.getElementById('view').textContent;
  for(const label of ['Khởi tạo / kiểm tra cấu trúc','Khóa kỳ đã đối soát','Đồng bộ Portal ngay','Tạo backup ngay','Tạo bản phục hồi để kiểm tra','Áp dụng lô đã kiểm tra'])assert.match(text,new RegExp(label));assert.equal(c.run('opsCalls.length'),1);assert.equal(c.document.querySelector('input[type=file]').accept,'.xlsx,.json,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json,text/csv');
});
test('large report sources load all snapshot pages before computing, never silently use first 200',async()=>{
  const c=await client();c.run(`state.demo=false;state.partialModules={materials:{total:201,next:200}};state.data.materials=[];call=async(action,args)=>({rows:args.offset===0?[{recordId:'one'}]:[{recordId:'last'}],next:args.offset===0?200:null});`);assert.equal(await c.run("ensureReadModules(['materials'])"),true);assert.equal(c.run('state.data.materials.length'),2);assert.equal(c.run('state.partialModules.materials'),undefined);
});

test('linked workflow checkbox grants write-only destination without exposing cash page or hidden residual grants',async()=>{
  const c=await client();c.run("globalThis.linkPicker=createPermissionPicker();document.getElementById('view').replaceChildren(linkPicker.root)");
  const read=c.document.querySelector('[data-page="entry-loans"][data-action="read"]');read.checked=true;read.dispatchEvent(new c.context.window.Event('change'));
  const linked=c.document.querySelector('[data-page="entry-loans"][data-action="linked"]');linked.checked=true;linked.dispatchEvent(new c.context.window.Event('change'));const value=JSON.parse(c.run('JSON.stringify(linkPicker.value())'));
  assert.deepEqual(value.cash,['create']);assert.equal(value.loans.includes('approve'),true);assert.equal(value.loans.includes('update'),false);assert.deepEqual(value._routes,['entry-loans']);
  c.run('linkPicker.load('+JSON.stringify(value)+')');const again=c.document.querySelector('[data-page="entry-loans"][data-action="linked"]');assert.equal(again.checked,true);again.checked=false;again.dispatchEvent(new c.context.window.Event('change'));assert.equal(c.run('linkPicker.value().cash'),undefined);assert.equal(c.run("linkPicker.value().loans.includes('approve')"),false);
});

test('uncertain financial writes freeze assumptions and retry the exact same key',async()=>{
  const c=await client();c.run(`state.demo=false;globalThis.writeArgs=[];load=async()=>{};route=()=>{};call=async(action,args)=>{if(action==='workflowReports')return {rows:[]};if(args.preview)return {preview:{rows:[],total:0}};writeArgs.push(args);if(writeArgs.length===1)throw Object.assign(new Error('Not confirmed'),{code:'NETWORK'});return {ids:['done']};};document.getElementById('view').replaceChildren();renderFinancialOperations('payroll');`);
  const find=text=>[...c.document.querySelectorAll('button')].find(b=>b.textContent===text);find('Xem trước').click();for(let i=0;i<4;i++)await Promise.resolve();find('Xác nhận lập phiếu').click();for(let i=0;i<4;i++)await Promise.resolve();assert.equal(c.document.querySelector('.operations-card input').disabled,true);assert.ok(c.run('state.pendingWorkflow.request.key'));
  find('Kiểm tra lại cùng lần chốt').click();for(let i=0;i<4;i++)await Promise.resolve();assert.equal(c.run('writeArgs[0].key===writeArgs[1].key'),true);assert.equal(c.run('state.pendingWorkflow'),null);
});
test('all report and record routes render without throwing in empty state',async()=>{const c=await client();const routes=c.run('ROUTES.map(r=>r[0])');for(const id of routes){c.location.hash='#'+id;c.run('route()');await Promise.resolve();assert.equal(c.document.getElementById('error').hidden,true,'Route '+id);}});

test('strategy restores draft panels and interactive calendar/scenario without writes or fake records',async()=>{
  const c=await client();c.location.hash='#strategy';c.run('route()');
  assert.equal(c.document.querySelectorAll('.strategy-panel').length,9);
  assert.equal(c.document.querySelectorAll('.strategy-kpi').length,4);
  const week=[...c.document.querySelectorAll('.strategy-filters button')].find(b=>b.textContent==='Tuần');week.click();
  assert.equal(c.run('strategyViewState.period'),'week');
  const values=[100,40,100,10,0],inputs=[...c.document.querySelectorAll('.strategy-inputs input')];inputs.forEach((input,i)=>{input.value=values[i];});inputs[0].oninput();
  assert.match(c.document.querySelector('.strategy-scenario-results').textContent,/15\.000/);
  assert.equal(c.run('state.data.sales.length'),0);
  c.run("state.data.stores=[{recordId:'shop',name:'<img src=x onerror=alert(1)>'}];state.data.sales=[{recordId:'s',date:dateToday(),storeId:'shop',dishId:'dish',sold:1,creditQty:0,delivered:2,returned:1,price:10,discount:0,recoveryPrice:0,otherCost:0,cash:10,bank:0,oldDebtPaid:0}];renderStrategy()");
  assert.equal(c.document.querySelector('#view img'),null);assert.match(c.document.getElementById('view').textContent,/<img src=x/);
  assert.throws(()=>c.run("delete state.data.attendance;renderStrategy()"),/Cần quyền đọc/);
});
test('recipe editor offers typed ingredient controls and no raw JSON',async()=>{const c=await client();c.run("openEditor('recipes');addRecipeLine(document.querySelector('[data-field=lines]'))");assert.equal(c.dialog.open,true);assert.equal(c.document.querySelectorAll('.recipe-line').length,1);assert.equal(c.document.querySelectorAll('textarea').length,0);});
test('logout clears memory, rendered tables and editor inputs',async()=>{const c=await client();c.run("state.data.sales=[{contact:'private'}];openEditor('materials');localLogout()");assert.equal(c.run('Object.keys(state.data).length'),0);assert.equal(c.document.getElementById('view').textContent,'');assert.equal(c.document.getElementById('form-fields').textContent,'');assert.equal(c.dialog.open,false);});
test('rendering untrusted cells uses text, not executable markup',async()=>{const c=await client();c.run("document.getElementById('view').replaceChildren(makeTable(['Name'],[['<img src=x onerror=alert(1)>']]))");assert.equal(c.document.getElementById('view').querySelector('img'),null);assert.match(c.document.getElementById('view').textContent,/<img src=x/);});

function bridge(g){
  return {script:{run:{withSuccessHandler(success){return {withFailureHandler(){return {rpc(action,args){success(g.ctx.rpc(action,args));}};}};}}}};
}

function browserSessions(){const saved=new Map();return {saved,store:async(scope,operation,value)=>{
  if(operation==='get')return saved.has(scope)?structuredClone(saved.get(scope)):null;
  if(operation==='put')saved.set(scope,structuredClone(value));else saved.delete(scope);return true;
}};}
function tick(c,selector,checked=true){const input=c.document.querySelector(selector);assert.ok(input,selector);assert.equal(input.disabled,false,selector+' is enabled');input.checked=checked;input.dispatchEvent(new c.context.window.Event('change'));return input;}
test('account permission checkboxes save typed grants and expose only chosen sidebar pages',async()=>{
  const g=gas(),c=await rememberedLogin(g,browserSessions());c.location.hash='#admin';c.run("state.route='admin';document.getElementById('view').replaceChildren()");await c.run('renderAdmin()');
  assert.equal(c.document.querySelectorAll('#account-form textarea').length,0);
  assert.equal(c.document.querySelectorAll('[data-permission-route]').length,37);
  const email=c.document.querySelector('[name=account-email]'),role=c.document.querySelector('[name=account-role]');email.value='acct@example.com';role.value='accountant';role.dispatchEvent(new c.context.window.Event('change'));
  tick(c,'[data-page="entry-sales"][data-action=read]');tick(c,'[data-page="entry-sales"][data-action=create]');
  await c.document.getElementById('account-form').onsubmit({preventDefault(){}});
  const user=g.ctx.users_().find(u=>u.email==='acct@example.com');assert.ok(user);
  assert.deepEqual(Array.from(user.permissions._routes),['entry-sales']);assert.deepEqual(Array.from(user.permissions.sales),['read','create']);assert.equal(user.permissions.employees,undefined);
  const token=g.ctx.issueSession_('acct@example.com','acct').token,b=send(g,'bootstrap',{token}).data;
  assert.deepEqual(Object.keys(b.data).sort(),['discounts','dishes','sales','stores']);
  assert.equal(send(g,'export',{token,module:'sales'}).error.code,'FORBIDDEN');assert.equal(send(g,'mutate',{token,module:'employees',operation:'create'}).error.code,'FORBIDDEN');
  c.context.scoped=b;c.run('state.user=scoped.user;state.permissions=scoped.permissions;state.data=scoped.data;nav()');
  assert.deepEqual(Array.from(c.document.querySelectorAll('#navigation a')).map(a=>a.getAttribute('href')),['#entry-sales']);
  c.location.hash='#catalog';c.run('route()');assert.equal(c.document.getElementById('error').hidden,false);
});
test('permission picker loads legacy accounts, supports group read-only selection and shared actions',async()=>{
  const c=await client();c.run("globalThis.picker=createPermissionPicker();document.getElementById('view').replaceChildren(picker.root);picker.load({sales:['read','create']})");
  assert.equal(c.document.querySelector('[data-page="entry-sales"][data-action=create]').checked,true);
  assert.equal(c.document.querySelector('[data-page=dashboard][data-action=read]').checked,false);
  tick(c,'[data-permission-group=catalogs]');const value=c.run('picker.value()');
  for(const module of ['materials','stores','dishes','employees','discounts'])assert.deepEqual(Array.from(value[module]),['read']);
  tick(c,'[data-page=recipes][data-action=read]');tick(c,'[data-page=batches][data-action=read]');tick(c,'[data-page=recipes][data-action=create]');
  assert.equal(c.document.querySelector('[data-page=batches][data-action=create]').checked,true);
  c.run("picker.setRole('admin')");assert.ok(Array.from(c.document.querySelectorAll('.permission-choice input')).every(i=>i.checked&&i.disabled));
  c.run("picker.setRole('accountant')");assert.equal(c.document.querySelector('[data-page=health][data-action=read]').checked,false);
  assert.equal(c.document.querySelector('[data-page=recipes][data-action=create]').checked,true);
});
test('existing account selector loads saved boxes and saving removes unchecked action',async()=>{
  const g=gas();g.ctx.append_('_Users',['acct','acct@example.com','accountant','{"_routes":["entry-sales"],"sales":["read","create"],"stores":["read"],"dishes":["read"],"discounts":["read"]}',true,1]);
  const c=await rememberedLogin(g,browserSessions());c.location.hash='#admin';c.run("state.route='admin';document.getElementById('view').replaceChildren()");await c.run('renderAdmin()');
  const choose=c.document.querySelector('[name=account-select]');choose.value='acct@example.com';choose.dispatchEvent(new c.context.window.Event('change'));
  assert.equal(c.document.querySelector('[name=account-email]').readOnly,true);assert.equal(c.document.querySelector('[data-page="entry-sales"][data-action=create]').checked,true);
  tick(c,'[data-page="entry-sales"][data-action=create]',false);await c.document.getElementById('account-form').onsubmit({preventDefault(){}});
  const user=g.ctx.users_().find(u=>u.email==='acct@example.com');assert.deepEqual(Array.from(user.permissions.sales),['read']);assert.equal(user.permissionVersion,2);
});
async function rememberedLogin(g,browser){
  const c=await client(false,bridge(g),browser.store);
  g.ctx.claims={email:'admin@example.com',email_verified:true,sub:'admin-sub',hd:'example.com'};
  g.ctx.oauthCallback_({state:c.run('state.loginAttempt.flow'),code:'code'});
  await c.run('pollLogin(state.loginAttempt)');return c;
}
test('page reload restores signed session without Google login or creating another Admin session',async()=>{
  const g=gas(),browser=browserSessions(),original=await rememberedLogin(g,browser),token=original.run('state.token');
  const stored=[...browser.saved.values()][0];assert.deepEqual(Object.keys(stored).sort(),['expires','key','token']);
  assert.equal(stored.key.extractable,false);await assert.rejects(crypto.subtle.exportKey('raw',stored.key));
  const reloaded=await client(false,bridge(g),browser.store);
  assert.equal(reloaded.document.getElementById('workspace').hidden,false);assert.equal(reloaded.run('state.token'),token);
  assert.equal(g.ctx.rowsPlain_('_Sessions').filter(r=>r[4]==='active').length,1);
  await reloaded.run("call('sync')");
  await reloaded.run("call('logout');clearRpcSession()");assert.equal(browser.saved.size,0);
  const afterLogout=await client(false,bridge(g),browser.store);assert.equal(afterLogout.document.getElementById('workspace').hidden,true);
});
test('restoration rejects disabled accounts and expired sessions',async()=>{
  const g=gas(),browser=browserSessions();await rememberedLogin(g,browser);
  g.tables.get('_Users').rows[1][4]=false;
  const disabled=await client(false,bridge(g),browser.store);assert.equal(disabled.document.getElementById('workspace').hidden,true);assert.equal(browser.saved.size,0);
  g.tables.get('_Users').rows[1][4]=true;
  const again=await rememberedLogin(g,browser),entry=[...browser.saved.values()][0];entry.expires=new Date(Date.now()-1).toISOString();
  browser.saved.set(again.run('rpcScope'),entry);
  const expired=await client(false,bridge(g),browser.store);assert.equal(expired.document.getElementById('workspace').hidden,true);assert.equal(browser.saved.size,0);
});
test('network failure during restoration preserves credentials for retry instead of forcing Google login',async()=>{
  const g=gas(),browser=browserSessions();await rememberedLogin(g,browser);const normal=bridge(g);
  const flaky={script:{run:{withSuccessHandler(success){return {withFailureHandler(failure){return {rpc(action,args){if(action==='bootstrap')failure({message:'offline'});else normal.script.run.withSuccessHandler(success).withFailureHandler(failure).rpc(action,args);}};}};}}}};
  const c=await client(false,flaky,browser.store);assert.equal(c.document.getElementById('workspace').hidden,true);assert.equal(browser.saved.size,1);
  assert.equal(c.document.getElementById('login').hidden,true);assert.equal(c.document.getElementById('boot').hidden,false);assert.equal(c.document.getElementById('boot-retry').hidden,false);
  c.context.google=normal;await c.run('prepareLogin({resume:true})');assert.equal(c.document.getElementById('workspace').hidden,false);
});
test('slow reads allow cold startup and explain retry without claiming an uncertain write',async()=>{
 const c=await client();let timer,timeout,success;c.context.setTimeout=(fn,ms)=>{timer=fn;timeout=ms;return 1;};c.context.google={script:{run:{withSuccessHandler(fn){success=fn;return {withFailureHandler(){return {rpc(){}};}};}}}};
 const read=c.run("rpcTransport('bootstrap')");assert.equal(timeout,90000);timer();await assert.rejects(read,e=>e.code==='TIMEOUT'&&!e.message.includes('Kết quả ghi')&&e.message.includes('Phiên đăng nhập'));
 success({ok:true,data:{late:true}});const write=c.run("rpcTransport('mutate')");timer();await assert.rejects(write,e=>e.code==='TIMEOUT'&&e.message.includes('Kết quả ghi chưa rõ'));
 const auth=c.run("rpcTransport('oauthStart')");assert.equal(timeout,60000);timer();await assert.rejects(auth,e=>!e.message.includes('Kết quả ghi'));
});

test('initial HTML shows branded boot screen before JavaScript, never flashes login form',()=>{
  const {document}=parseHTML(fs.readFileSync('src/client/index.html','utf8'));
  assert.equal(document.getElementById('boot').hidden,false);assert.equal(document.getElementById('login').hidden,true);assert.equal(document.getElementById('workspace').hidden,true);
  assert.equal(document.getElementById('boot').getAttribute('aria-busy'),'true');
});
test('pending restored bootstrap keeps login hidden until the workspace is ready',async()=>{
  const g=gas(),browser=browserSessions(),c=await rememberedLogin(g,browser);let resolve;
  c.context.waitForData=new Promise(r=>{resolve=r;});c.run('load=()=>waitForData');
  const loading=c.run('prepareLogin({resume:true})');await new Promise(r=>setTimeout(r,30));
  assert.equal(c.document.getElementById('boot').hidden,false);assert.equal(c.document.getElementById('login').hidden,true);assert.equal(c.document.getElementById('workspace').hidden,true);
  resolve();await loading;
  assert.equal(c.document.getElementById('boot').hidden,true);assert.equal(c.document.getElementById('login').hidden,true);assert.equal(c.document.getElementById('workspace').hidden,false);
});
test('revoked remembered session cannot restore, copied application ID alone cannot authenticate',async()=>{
  const g=gas(),browser=browserSessions(),c=await rememberedLogin(g,browser);
  const token=c.run('state.token');assert.equal(g.ctx.rpc('bootstrap',{token}).error.code,'AUTH');
  g.tables.get('_Sessions').rows[1][4]='revoked';
  const reloaded=await client(false,bridge(g),browser.store);assert.equal(reloaded.document.getElementById('workspace').hidden,true);assert.equal(browser.saved.size,0);
});
test('reload rechecks accountant permissions and never loads formerly permitted tables',async()=>{
  const g=gas(),browser=browserSessions();g.ctx.append_('_Users',['acct','accountant@example.com','accountant','{"sales":["read"]}',true,1]);
  const c=await client(false,bridge(g),browser.store);g.ctx.claims={email:'accountant@example.com',email_verified:true,sub:'acct-sub',hd:'example.com'};
  g.ctx.oauthCallback_({state:c.run('state.loginAttempt.flow'),code:'code'});await c.run('pollLogin(state.loginAttempt)');
  assert.deepEqual(Array.from(c.run('Object.keys(state.data)')),['sales']);g.tables.get('_Users').rows[2][3]='{}';
  const reloaded=await client(false,bridge(g),browser.store);assert.equal(reloaded.document.getElementById('workspace').hidden,false);
  assert.deepEqual(Array.from(reloaded.run('Object.keys(state.data)')),[]);
});

test('slow reads show spinner, overlapping requests retain it and failures clear it',async()=>{
  const c=await client();const pending=[];
  c.context.google={script:{run:{withSuccessHandler(success){return {withFailureHandler(failure){return {rpc(action){pending.push({action,success,failure});}};}};}}}};
  const first=c.run("rpcCall('health')"),second=c.run("rpcCall('export')");
  const status=c.document.getElementById('network-status');assert.equal(status.hidden,false);
  assert.ok(status.textContent.length>0);pending[0].success({ok:true,data:{}});await first;assert.equal(status.hidden,false);
  const rejected=assert.rejects(second,/offline/);pending[1].failure({message:'offline'});await rejected;assert.equal(status.hidden,true);
});

test('slow health route shows placeholder and stale response cannot repaint another page',async()=>{
  const c=await client();let resolve;
  c.context.delayed=new Promise(r=>{resolve=r;});c.run("call=()=>delayed");
  c.location.hash='#health';c.run('route()');assert.ok(c.document.querySelector('.loading-panel'));
  c.location.hash='#materials';c.run('route()');const before=c.document.getElementById('view').textContent;
  resolve({audit:[{user:'stale private log'}],pending:[]});await new Promise(r=>setImmediate(r));
  assert.equal(c.document.getElementById('view').textContent,before);assert.equal(c.document.querySelector('.loading-panel'),null);
});

test('sync cannot overlap itself and manual refresh bypasses cache while retaining visible data',async()=>{
  const c=await client();let resolve,count=0;
  c.context.pendingSync=new Promise(r=>{resolve=r;});c.context.capture=()=>{count++;};
  c.run("state.token='test';call=()=>{capture();return pendingSync;}");
  const a=c.run('checkSync()'),b=c.run('checkSync()');await b;assert.equal(count,1);
  resolve({stamp:c.run('state.stamp'),permissionVersion:c.run('state.permissionVersion')});await a;
  c.context.args=[];c.run("state.demo=false;call=async(action,arg)=>{args.push({action,arg});return {data:{},permissions:{},user:state.user,stamp:'new',permissionVersion:1};}");
  const refresh=c.run('refresh()');assert.equal(c.document.getElementById('refresh').disabled,true);
  assert.ok(c.document.getElementById('view').textContent.length>0);await refresh;
  assert.equal(c.context.args[0].arg.force,true);assert.equal(c.document.getElementById('refresh').disabled,false);
});
test('OAuth login link opens outside iframe, callback poll mounts signed session without GIS',async()=>{
  const g=gas(),c=await client(false,bridge(g)),link=c.document.querySelector('#google-button a');
  assert.equal(link.target,'_blank');assert.match(link.href,/accounts.google.com\/o\/oauth2/);assert.equal(link.rel,'noopener noreferrer');
  assert.equal(c.document.querySelector('script[src]'),null);
  g.ctx.claims={email:'admin@example.com',email_verified:true,sub:'admin-sub',hd:'example.com'};
  g.ctx.oauthCallback_({state:c.run('state.loginAttempt.flow'),code:'code'});
  await c.run('pollLogin(state.loginAttempt)');assert.equal(c.document.getElementById('workspace').hidden,false);
  assert.equal(c.run('rpcSession.key.extractable'),false);assert.equal(c.run('state.loginAttempt'),null);
  assert.equal(c.run('Object.hasOwn(state,"signingKey")'),false);assert.ok(g.ctx.rowsPlain_('_AuthRequests').length>0);
  await c.run("call('logout')");assert.equal(g.ctx.rowsPlain_('_Sessions')[0][4],'revoked');
});
test('two client tabs: Admin and accountant receive separate signed sessions and scoped data',async()=>{
  const g=gas();g.ctx.append_('_Users',['acct','accountant@example.com','accountant','{"sales":["read"]}',true,1]);
  const admin=await client(false,bridge(g));g.ctx.claims={email:'admin@example.com',email_verified:true,sub:'admin',hd:'example.com'};
  g.ctx.oauthCallback_({state:admin.run('state.loginAttempt.flow'),code:'admin-code'});await admin.run('pollLogin(state.loginAttempt)');
  const acct=await client(false,bridge(g));g.ctx.claims={email:'accountant@example.com',email_verified:true,sub:'accountant',hd:'example.com'};
  g.ctx.oauthCallback_({state:acct.run('state.loginAttempt.flow'),code:'acct-code'});await acct.run('pollLogin(state.loginAttempt)');
  assert.deepEqual(Array.from(acct.run('Object.keys(state.data)')),['sales']);
  assert.equal(acct.document.querySelector('#navigation a[href="#employees"]'),null);
  assert.equal(acct.document.querySelector('#navigation a[href="#admin"]'),null);
  assert.equal(g.ctx.rowsPlain_('_Sessions').filter(r=>r[4]==='active').length,2);
  await assert.rejects(acct.run("call('export',{module:'employees'})"),/FORBIDDEN/);
});

test('Google popup requests compact dimensions, detaches opener and closes before slow Sheets bootstrap',async()=>{
  const g=gas(),c=await client(false,bridge(g));let closed=0,opener='attached',destination,features;
  const popup={set opener(value){opener=value;},location:{replace(url){assert.equal(opener,null);destination=url;}},close(){closed++;}};
  c.context.window.open=(url,target,options)=>{assert.equal(url,'about:blank');assert.equal(target,'_blank');features=options;return popup;};
  const event=new c.context.window.Event('click',{cancelable:true});
  c.document.querySelector('#google-button a').dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);assert.match(destination,/accounts.google.com/);
  assert.match(features,/popup=yes/);assert.match(features,/width=520/);assert.match(features,/height=680/);assert.match(features,/resizable=yes/);
  assert.equal(closed,0);
  c.context.checkPopupClosed=()=>assert.equal(closed,1);
  c.run('const popupOriginalLoad=load;load=async()=>{checkPopupClosed();return popupOriginalLoad();};');
  g.ctx.claims={email:'admin@example.com',email_verified:true,sub:'admin',hd:'example.com'};
  g.ctx.oauthCallback_({state:c.run('state.loginAttempt.flow'),code:'code'});
  await c.run('pollLogin(state.loginAttempt)');assert.equal(closed,1);
  assert.equal(c.document.getElementById('workspace').hidden,false);
});

test('blocked popup retains noopener login link; repeated clicks do not open more windows',async()=>{
  const g=gas(),c=await client(false,bridge(g));let opened=0;
  c.context.window.open=()=>{opened++;return null;};
  const link=c.document.querySelector('#google-button a'),event=new c.context.window.Event('click',{cancelable:true});link.dispatchEvent(event);
  assert.equal(event.defaultPrevented,false);assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');
  const repeat=new c.context.window.Event('click',{cancelable:true});link.dispatchEvent(repeat);assert.equal(opened,1);assert.equal(repeat.defaultPrevented,true);
});

test('Excel export collects every authorized page and clears loading state after download',async()=>{
 const c=await client(),control=c.document.createElement('button');c.context.exportControl=control;
 c.run(`state.demo=false;state.token='session';state.stamp='snapshot';globalThis.exportCalls=[];globalThis.downloads=[];
 call=async(action,args)=>{exportCalls.push({action,args});return {rows:args.offset===0?Array.from({length:200},(_,i)=>({recordId:'m'+i})): [{recordId:'last'}],next:args.offset===0?200:null};};
 ensureExcelRuntime=async()=>{};createModuleWorkbook=(module,rows,options)=>({module,rows,options});downloadExcel=async(book,filename)=>{if(!exportControl.disabled)throw new Error('Missing loading state');downloads.push({book,filename});};`);
 await c.run("exportModule('materials',exportControl)");assert.equal(c.run('downloads[0].book.rows.length'),201);assert.equal(c.run('exportCalls[1].args.offset'),200);assert.equal(c.run('exportCalls.every(c=>c.action==="export"&&c.args.stamp==="snapshot")'),true);assert.equal(control.disabled,false);assert.equal(control.classList.contains('is-loading'),false);
 c.run("location.hash='#catalog';route();");assert.ok([...c.document.querySelectorAll('button')].some(b=>b.textContent==='Xuất Excel'));assert.ok(![...c.document.querySelectorAll('button')].some(b=>b.textContent==='Xuất CSV'));
});

test('Excel export aborts if the authenticated session changes during pagination',async()=>{
 const c=await client();c.run(`state.demo=false;state.token='old';state.stamp='snapshot';globalThis.downloaded=false;call=async()=>{state.token='new';return {rows:[],next:null};};downloadExcel=async()=>{downloaded=true;};`);
 await c.run("exportModule('materials')");assert.equal(c.run('downloaded'),false);assert.equal(c.run('state.exporting'),false);assert.match(c.document.getElementById('error').textContent,/Phiên hoặc dữ liệu đã thay đổi/);
});

test('hot module navigation reuses scoped RAM page data without another server request',async()=>{
 const c=await client();c.run(`state.demo=false;state.grantKey='admin';state.moduleVersions={materials:'v1'};globalThis.listCalls=0;call=async(action)=>{if(action==='list'){listCalls++;return {rows:[{recordId:'m',version:1,name:'Rice',purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0}],total:1,next:null};}return {};};location.hash='#catalog';route();`);
 for(let i=0;i<8;i++)await Promise.resolve();assert.equal(c.run('listCalls'),1);assert.match(c.document.getElementById('view').textContent,/Rice/);
 c.run('route()');assert.equal(c.run('listCalls'),1);assert.match(c.document.getElementById('view').textContent,/Rice/);
 c.run("state.moduleVersions.materials='v2';route();");for(let i=0;i<8;i++)await Promise.resolve();assert.equal(c.run('listCalls'),2);
});

test('Dashboard startup fetches an aggregate and leaves raw business history unloaded',async()=>{
 const c=await client();c.run(`state.demo=false;state.token='test';state.grantKey='admin';state.moduleVersions={sales:'v1'};state.partialModules=Object.fromEntries(Object.keys(SCHEMA).map(m=>[m,{next:0}]));globalThis.actions=[];
 call=async(action,args)=>{actions.push(action);return {report:report(state.data,state.from,state.to),target:null,weeks:[],series:[],settlements:{rows:[],offset:0,total:0,next:null}};};location.hash='#dashboard';route();`);
 for(let i=0;i<8;i++)await Promise.resolve();assert.equal(c.run('actions.join(",")'),'summary');assert.equal(c.run('state.data.sales.length'),0);assert.match(c.document.getElementById('view').textContent,/Doanh thu thuần/);
 c.run('route()');assert.equal(c.run('actions.length'),1);
});

test('Strategy revisits reuse the existing chart DOM and cached aggregate',async()=>{
 const c=await client();c.run(`state.demo=false;state.grantKey='admin';state.moduleVersions={sales:'v1'};globalThis.strategyCalls=0;
 call=async(action)=>{if(action==='list')return {rows:[],total:0,next:null};strategyCalls++;return {aggregate:strategyAggregate(state.data,state.from,state.to),prior:strategyAggregate(state.data,state.from,state.to),series:[{label:'Kỳ',revenue:100}],profitSeries:[]};};location.hash='#strategy';route();`);
 for(let i=0;i<12;i++)await Promise.resolve();const chart=c.document.querySelector('#view svg');assert.ok(chart);c.context.savedChart=chart;
 c.run("location.hash='#catalog';route();location.hash='#strategy';route();");assert.equal(c.run('strategyCalls'),1);assert.equal(c.document.querySelector('#view svg'),chart);
});

test('concurrent identical read calls deduplicate, mutations never share an RPC',async()=>{
 const c=await client();c.run(`globalThis.transportCalls=0;globalThis.readRelease=null;rpcTransport=()=>{transportCalls++;return new Promise(resolve=>{readRelease=resolve;});};globalThis.r1=rpcCall('list',{module:'materials'});globalThis.r2=rpcCall('list',{module:'materials'});`);
 assert.equal(c.run('transportCalls'),1);c.run('readRelease({rows:[]})');await c.run('Promise.all([r1,r2])');c.run("rpcTransport=async()=>{transportCalls++;return {};};");await c.run("Promise.all([rpcCall('mutate',{key:'a'}),rpcCall('mutate',{key:'a'})])");assert.equal(c.run('transportCalls'),3);
});
test('record save remains pending until ACK, preserves exact unknown request and resumes it after closing',async()=>{
 const c=await client();c.run(`state.demo=false;state.token='fixture';openEditor('materials');globalThis.submitted=null;globalThis.rejectSave=null;formRecord=()=>({name:'Original',purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0});call=async(action,args)=>{submitted=args;return new Promise((resolve,reject)=>{rejectSave=reject;});};document.getElementById('record-form').dispatchEvent(new window.Event('submit',{cancelable:true}));`);
 assert.equal(c.run('state.saving'),true);assert.equal(c.document.getElementById('submit-record').textContent,'Đang lưu…');assert.equal(c.document.querySelector('.toast-success'),null);
 const key=c.run('submitted.key');c.run("formRecord=()=>({name:'Changed while waiting'});rejectSave(Object.assign(new Error('timeout'),{code:'TIMEOUT'}));");for(let i=0;i<8;i++)await Promise.resolve();assert.equal(c.run('state.uncertain.record.name'),'Original');assert.equal(c.run('state.uncertain.key'),key);
 c.run("closeEditor();showDetails({recordId:'other'},'materials');openEditor('stores');");assert.equal(c.run('state.editor.module'),'materials');assert.equal(c.run('state.formKey'),key);assert.equal(c.document.querySelector('[name=name]').value,'Original');
});
test('ACK followed by refresh failure reports saved, never an uncertain or failed write',async()=>{
 const c=await client();c.run(`state.demo=false;state.token='fixture';openEditor('materials');formRecord=()=>({name:'Saved',purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0});call=async()=>({ids:['saved']});load=async()=>{throw Object.assign(new Error('network read failure'),{code:'NETWORK'});};document.getElementById('record-form').dispatchEvent(new window.Event('submit',{cancelable:true}));`);
 for(let i=0;i<12;i++)await Promise.resolve();assert.equal(c.run('state.uncertain'),null);assert.equal(c.dialog.open,false);assert.match(c.document.getElementById('error').textContent,/đã lưu thành công/);assert.match(c.document.querySelector('.toast-success').textContent,/xác nhận lưu phiếu/);
});

test('draft sidebar groups toggle accessibly, preserve expansion and open the active branch',async()=>{
  const c=await client();const header=c.document.querySelector('[aria-controls="nav-catalogs"]'),children=c.document.getElementById('nav-catalogs');
  assert.equal(header.getAttribute('aria-expanded'),'false');assert.equal(children.hidden,true);
  header.click();assert.equal(header.getAttribute('aria-expanded'),'true');assert.equal(children.hidden,false);
  c.run('nav()');assert.equal(c.document.getElementById('nav-catalogs').hidden,false);
  c.location.hash='#entry-sales';c.run('route()');assert.equal(c.document.getElementById('nav-entry').hidden,false);
  assert.equal(c.document.querySelector('a[href="#entry-sales"]').getAttribute('aria-current'),'page');
  assert.ok(c.document.querySelector('a[href="#entry-sales"] svg'));
  c.run('state.user.role="accountant";state.permissions={sales:["read"]};nav()');
  assert.equal(c.document.querySelector('[aria-controls="nav-catalogs"]'),null);
  assert.equal(c.document.querySelector('a[href="#admin"]'),null);assert.equal(c.document.querySelector('.nav-count'),null);
});

test('entry defaults copy permitted master snapshots and clear stale discount when store changes',async()=>{
  const c=await client();
  c.run('state.data.dishes=[{recordId:"dish",name:"Meal",price:35000}];state.data.stores=[{recordId:"shop",name:"Shop"},{recordId:"other",name:"Other"}];state.data.discounts=[{recordId:"discount",storeId:"shop",dishId:"dish",rate:0.15,recoveryPrice:2000}];openEditor("sales")');
  const field=key=>c.document.querySelector('#form-fields [name="'+key+'"]');
  field('storeId').value='shop';field('dishId').value='dish';field('dishId').dispatchEvent(new c.context.window.Event('change'));
  assert.equal(Number(field('price').value),35000);assert.equal(Number(field('discount').value),0.15);assert.equal(Number(field('recoveryPrice').value),2000);
  field('storeId').value='other';field('storeId').dispatchEvent(new c.context.window.Event('change'));assert.equal(field('discount').value,'');
  c.run('state.data.employees=[{recordId:"employee",name:"Staff",hourlyRate:30000,department:"SX",allowance:20000}];openEditor("attendance")');
  field('employeeId').value='employee';field('employeeId').dispatchEvent(new c.context.window.Event('change'));
  assert.equal(Number(field('hourlyRate').value),30000);assert.equal(field('department').value,'SX');assert.equal(Number(field('defaultAllowance').value),20000);
  c.run('state.route="batches";openEditor("recipes")');assert.equal(field('kind').value,'nhan-sot');
});

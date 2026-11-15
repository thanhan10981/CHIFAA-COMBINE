import test from 'node:test';import assert from 'node:assert/strict';import fs from'node:fs';import vm from'node:vm';import crypto from'node:crypto';import {parseHTML}from'linkedom';
const strip=s=>s.replace(/^import .*?;\r?\n/gm,'').replace(/^export \{[^}]*\};?\r?\n?/gm,'');
async function client(demo=true){
  const {window,document}=parseHTML(fs.readFileSync('src/client/index.html','utf8'));
  const dialog=document.getElementById('editor');dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
  const location={search:demo?'?demo=1':'',hash:'',pathname:'/',href:'http://localhost/'};
  const context=vm.createContext({window,document,Node:window.Node,location,URL,URLSearchParams,crypto,console,Date,Intl,Promise,Set,Map,Object,Array,Number,String,Math,Error,Blob,
    confirm:()=>true,setInterval:()=>0,setTimeout:()=>0,clearTimeout(){}});
  for(const p of ['src/shared/schema.js','src/shared/domain.js','src/client/rpc.js','src/client/app.js'])vm.runInContext(strip(fs.readFileSync(p,'utf8')),context,{filename:p});
  await Promise.resolve();return {context,document,dialog,location,run:code=>vm.runInContext(code,context)};
}
test('local shell does not preload user data or financial records',async()=>{const c=await client(false);assert.equal(c.document.getElementById('workspace').hidden,true);assert.equal(c.document.getElementById('login').hidden,false);assert.match(c.document.getElementById('login-status').textContent,/Chưa kết nối/);assert.equal(c.run('Object.keys(state.data).length'),0);});
test('explicit demo opens application with all 36 routes and no invented data',async()=>{const c=await client();assert.equal(c.document.getElementById('workspace').hidden,false);assert.equal(c.document.querySelectorAll('#navigation a').length,36);assert.match(c.document.getElementById('view').textContent,/Chưa có dữ liệu doanh thu/);assert.equal(c.run('state.data.sales.length'),0);});
test('all report and record routes render without throwing in empty state',async()=>{const c=await client();const routes=c.run('ROUTES.map(r=>r[0])');for(const id of routes){c.location.hash='#'+id;c.run('route()');await Promise.resolve();assert.equal(c.document.getElementById('error').hidden,true,'Route '+id);}});
test('recipe editor offers typed ingredient controls and no raw JSON',async()=>{const c=await client();c.run("openEditor('recipes');addRecipeLine(document.querySelector('[data-field=lines]'))");assert.equal(c.dialog.open,true);assert.equal(c.document.querySelectorAll('.recipe-line').length,1);assert.equal(c.document.querySelectorAll('textarea').length,0);});
test('logout clears memory, rendered tables and editor inputs',async()=>{const c=await client();c.run("state.data.sales=[{contact:'private'}];openEditor('materials');localLogout()");assert.equal(c.run('Object.keys(state.data).length'),0);assert.equal(c.document.getElementById('view').textContent,'');assert.equal(c.document.getElementById('form-fields').textContent,'');assert.equal(c.dialog.open,false);});
test('rendering untrusted cells uses text, not executable markup',async()=>{const c=await client();c.run("document.getElementById('view').replaceChildren(makeTable(['Name'],[['<img src=x onerror=alert(1)>']]))");assert.equal(c.document.getElementById('view').querySelector('img'),null);assert.match(c.document.getElementById('view').textContent,/<img src=x/);});

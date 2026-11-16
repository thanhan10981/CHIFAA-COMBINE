import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';import {parseHTML} from 'linkedom';
const strip=s=>s.replace(/^import .*?;\r?\n/gm,'').replace(/^export \{[^}]*\};?\r?\n?/gm,'');
export async function client(demo=true,google,store){
  const {window,document}=parseHTML(fs.readFileSync('src/client/index.html','utf8'));
  // Linkedom exposes select.value as getter-only; emulate the browser setter.
  Object.defineProperty(Object.getPrototypeOf(document.createElement('select')),'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value??this.options[0]?.value??'';},set(value){for(const option of this.options)option.removeAttribute('selected');const chosen=Array.from(this.options).find(option=>option.value===String(value));if(chosen)chosen.setAttribute('selected','');}});
  const dialog=document.getElementById('editor');dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
  const location={search:demo?'?demo=1':'',hash:'',pathname:'/',href:'http://localhost/'};
  const context=vm.createContext({window,document,Node:window.Node,location,URL,URLSearchParams,crypto,TextEncoder,Uint8Array,google,console,Date,Intl,Promise,Set,Map,Object,Array,Number,String,Math,Error,Blob,
    confirm:()=>true,setInterval:()=>0,setTimeout:()=>0,clearTimeout(){}});
  for(const p of ['src/shared/schema.js','src/shared/access.js','src/shared/domain.js','src/shared/auth-protocol.js','src/client/navigation.js','src/client/permissions.js','src/client/session-store.js','src/client/rpc.js','src/client/notifications.js','src/shared/strategy.js','src/client/strategy-view.js','src/client/import-csv.js','src/client/excel.js','src/client/operations-view.js','src/client/app.js'])vm.runInContext(strip(fs.readFileSync(p,'utf8')).replace(/^start\(\);$/m,''),context,{filename:p});
  if(store)context.sessionStore=store;
  await context.start();return {context,document,dialog,location,run:code=>vm.runInContext(code,context)};
}

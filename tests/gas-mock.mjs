import vm from 'node:vm';import fs from 'node:fs';import crypto from 'node:crypto';
export function gas(){
  const metrics={open:0,getValues:0,setValues:0,append:0,flush:0,cellsRead:0,cellsWritten:0,lastRow:0};
  const tables=new Map(),properties=new Map([['SPREADSHEET_ID','test'],['ADMIN_EMAIL','admin@example.com'],['APP_MODE','internal'],['GOOGLE_CLIENT_ID','test-client'],['GOOGLE_CLIENT_SECRET','mock-secret'],['WEB_APP_URL','https://script.google.com/macros/s/DEV_DEPLOYMENT/exec'],['AUTH_ENV','DEV'],['AUTH_DEV_SPREADSHEET_ID','test'],['PORTAL_SIGNING_SECRET','test-secret']]),cache=new Map();let failTable=null;
  class Range{
    constructor(s,r,c,n=1,w=1){Object.assign(this,{s,r,c,n,w});}
    getValues(){metrics.getValues++;metrics.cellsRead+=this.n*this.w;return Array.from({length:this.n},(_,i)=>Array.from({length:this.w},(_,j)=>this.s.rows[this.r-1+i]?.[this.c-1+j]??''));}
    setValues(values){metrics.setValues++;metrics.cellsWritten+=this.n*this.w;for(let i=0;i<this.n;i++){this.s.rows[this.r-1+i]||=[];for(let j=0;j<this.w;j++)this.s.rows[this.r-1+i][this.c-1+j]=values[i][j];}if(failTable===this.s.name){failTable=null;throw new Error('Injected write failure');}return this;}
    setValue(v){return this.setValues([[v]]);}
    clearContent(){return this.setValues(Array.from({length:this.n},()=>Array(this.w).fill('')));}
    setBackground(){return this;}setFontColor(){return this;}setFontWeight(){return this;}setNumberFormat(){return this;}setDataValidation(){return this;}
    protect(){const p={setDescription(){return p;},setWarningOnly(){return p;},addEditor(){},getEditors(){return[];},removeEditors(){},canDomainEdit(){return false;}};return p;}
  }
  class Sheet{
    constructor(name){this.name=name;this.rows=[];this.maxRows=1000;}
    getRange(...args){return new Range(this,...args);}getLastRow(){metrics.lastRow++;let n=this.rows.length;while(n&&this.rows[n-1].every(v=>v===''))n--;return n;}
    getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length));}getMaxRows(){return this.maxRows;}insertRowsAfter(at,n){this.maxRows+=n;return this;}getProtections(){return[];}setFrozenRows(){}
    appendRow(row){metrics.append++;metrics.cellsWritten+=row.length;this.rows.push([...row]);if(failTable===this.name){failTable=null;throw new Error('Injected write failure');}}
    deleteRow(i){this.rows.splice(i-1,1);}
    deleteRows(i,n){this.rows.splice(i-1,n);}
  }
  const books=new Map(),triggers=[],folders=new Map();
  const folder=id=>{if(!folders.has(id))folders.set(id,{shared:false});const state=folders.get(id);return {getId:()=>id,getSharingAccess:()=>state.shared?'ANYONE':'PRIVATE',getEditors:()=>state.editors||[],getViewers:()=>[]};};
  const makeBook=(id,title=id,map=new Map())=>{const book={sheets:map,title,getSheetByName:n=>map.get(n),insertSheet:n=>{const s=new Sheet(n);map.set(n,s);return s;},getId:()=>id,getUrl:()=> 'https://docs.google.com/spreadsheets/d/'+id};books.set(id,book);return book;};
  const db=makeBook('test','DEV',tables);
  const triggerBuilder=handler=>{const t={handler,getHandlerFunction:()=>handler};const b={forSpreadsheet(id){t.book=id;return b;},onEdit(){return b;},onChange(){return b;},timeBased(){return b;},everyMinutes(n){t.minutes=n;return b;},everyDays(n){t.days=n;return b;},atHour(n){t.hour=n;return b;},inTimezone(z){t.timezone=z;return b;},create(){triggers.push(t);return t;}};return b;};
  const file=id=>{if(!books.has(id))throw Error('File not found');return {getId:()=>id,getName:()=>books.get(id).title,makeCopy(name){const copy=makeBook(crypto.randomUUID(),name);for(const [key,s]of books.get(id).sheets){const next=copy.insertSheet(key);next.rows=structuredClone(s.rows);}return file(copy.getId());}};};
  const validation={requireValueInList(){return this;},requireNumberGreaterThanOrEqualTo(){return this;},setAllowInvalid(){return this;},build(){return{};}};
  const context=vm.createContext({console:{log(){},warn(){}},Date,JSON,Set,Map,Object,Array,Number,String,Math,RegExp,Error,encodeURIComponent,
    HtmlService:{createHtmlOutput:html=>({html,setTitle(){return this;},addMetaTag(){return this;}}),createHtmlOutputFromFile:file=>({file,getContent:()=> 'PUBLIC_EXCEL_TEST_SOURCE',setTitle(){return this;},addMetaTag(){return this;}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,getProperties:()=>Object.fromEntries(properties),setProperty:(k,v)=>properties.set(k,v),deleteProperty:k=>properties.delete(k)})},
    SpreadsheetApp:{openById:id=>{metrics.open++;if(!books.has(id))throw Error('Workbook not found');return books.get(id);},create:name=>makeBook(crypto.randomUUID(),name),flush(){metrics.flush++;},ProtectionType:{RANGE:'range'},newDataValidation:()=>validation},
    DriveApp:{Access:{PRIVATE:'PRIVATE'},getFileById:file,getFolderById:folder,createFolder:()=>folder(crypto.randomUUID())},ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:triggerBuilder,deleteTrigger:t=>{const i=triggers.indexOf(t);if(i>=0)triggers.splice(i,1);}},
    Session:{getEffectiveUser:()=>({getEmail:()=> 'owner@example.com'})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),getAll:keys=>Object.fromEntries(keys.filter(k=>cache.has(k)).map(k=>[k,cache.get(k)])),putAll:values=>{for(const [k,v]of Object.entries(values))cache.set(k,v);},put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
    UrlFetchApp:{fetch:(url,options)=>{context.fetches.push({url,options});const body=context.fetchResponse?context.fetchResponse(url,options):url.endsWith('/token')?{access_token:'google-access-mock',token_type:'Bearer',expires_in:3600}:context.claims;return {getResponseCode:()=>body.status||200,getContentText:()=>JSON.stringify(body)};}},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,v)=>[...crypto.createHash('sha256').update(v).digest()],
      formatDate:d=>d.toISOString().slice(0,10),computeHmacSha256Signature:(p,k)=>[...crypto.createHmac('sha256',k).update(p).digest()],
      base64EncodeWebSafe:v=>Buffer.from(typeof v==='string'?v:Uint8Array.from(v)).toString('base64url'),base64DecodeWebSafe:v=>[...Buffer.from(v,'base64url')],newBlob:v=>({getDataAsString:()=>Buffer.from(v).toString('utf8')})}
  });
  context.fetches=[];
  for(const file of ['src/shared/schema.js','src/shared/access.js','src/shared/domain.js','src/shared/strategy.js','src/shared/auth-protocol.js','src/server/storage.js','src/server/security.js','src/server/auth.js','src/server/oauth.js','src/server/workflows.js','src/server/material-units.js','src/server/kiosk.js','src/server/entry.js','src/server/order-planning.js','src/server/financial-workflows.js','src/server/maintenance.js','src/server/inspection.js','src/server/read-model.js','src/server/performance.js','src/server/api.js','src/server/scanner.js','src/server/operations.js'])vm.runInContext(fs.readFileSync(file,'utf8').replace(/^import .*?;\r?\n/gm,'').replace(/^export \{[^}]*\};?\r?\n?/gm,''),context,{filename:file});
  context.setup_();return {ctx:context,tables,properties,cache,books,makeBook,triggers,folders,metrics,failNext:name=>{failTable=name;},evaluate:code=>vm.runInContext(code,context)};
}

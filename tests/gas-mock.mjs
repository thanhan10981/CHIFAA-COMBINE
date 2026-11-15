import vm from 'node:vm';import fs from 'node:fs';import crypto from 'node:crypto';
export function gas(){
  const tables=new Map(),properties=new Map([['SPREADSHEET_ID','test'],['ADMIN_EMAIL','admin@example.com'],['APP_MODE','internal'],['GOOGLE_CLIENT_ID','test-client'],['PORTAL_SIGNING_SECRET','test-secret'],['AUTH_MODE','test-tokeninfo'],['ALLOW_TEST_AUTH','true']]),cache=new Map();let failTable=null;
  class Range{
    constructor(s,r,c,n=1,w=1){Object.assign(this,{s,r,c,n,w});}
    getValues(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.w},(_,j)=>this.s.rows[this.r-1+i]?.[this.c-1+j]??''));}
    setValues(values){for(let i=0;i<this.n;i++){this.s.rows[this.r-1+i]||=[];for(let j=0;j<this.w;j++)this.s.rows[this.r-1+i][this.c-1+j]=values[i][j];}if(failTable===this.s.name){failTable=null;throw new Error('Injected write failure');}return this;}
    setValue(v){return this.setValues([[v]]);}
    clearContent(){return this.setValues(Array.from({length:this.n},()=>Array(this.w).fill('')));}
    setBackground(){return this;}setFontColor(){return this;}setFontWeight(){return this;}setNumberFormat(){return this;}setDataValidation(){return this;}
    protect(){const p={setDescription(){return p;},setWarningOnly(){return p;},addEditor(){},getEditors(){return[];},removeEditors(){},canDomainEdit(){return false;}};return p;}
  }
  class Sheet{
    constructor(name){this.name=name;this.rows=[];}
    getRange(...args){return new Range(this,...args);}getLastRow(){let n=this.rows.length;while(n&&this.rows[n-1].every(v=>v===''))n--;return n;}
    getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length));}getMaxRows(){return 1000;}getProtections(){return[];}setFrozenRows(){}
    appendRow(row){this.rows.push([...row]);if(failTable===this.name){failTable=null;throw new Error('Injected write failure');}}
    deleteRow(i){this.rows.splice(i-1,1);}
  }
  const db={getSheetByName:n=>tables.get(n),insertSheet:n=>{const s=new Sheet(n);tables.set(n,s);return s;},getId:()=> 'test'};
  const validation={requireValueInList(){return this;},requireNumberGreaterThanOrEqualTo(){return this;},setAllowInvalid(){return this;},build(){return{};}};
  const context=vm.createContext({console:{log(){},warn(){}},Date,JSON,Set,Map,Object,Array,Number,String,Math,RegExp,Error,encodeURIComponent,
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,v)})},
    SpreadsheetApp:{openById:()=>db,flush(){},ProtectionType:{RANGE:'range'},newDataValidation:()=>validation},
    Session:{getEffectiveUser:()=>({getEmail:()=> 'owner@example.com'})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},
    UrlFetchApp:{fetch:()=>({getResponseCode:()=>200,getContentText:()=>JSON.stringify(context.claims)})},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,v)=>[...crypto.createHash('sha256').update(v).digest()],
      formatDate:d=>d.toISOString().slice(0,10),computeHmacSha256Signature:(p,k)=>[...crypto.createHmac('sha256',k).update(p).digest()],
      base64EncodeWebSafe:v=>Buffer.from(typeof v==='string'?v:Uint8Array.from(v)).toString('base64url'),base64DecodeWebSafe:v=>[...Buffer.from(v,'base64url')],newBlob:v=>({getDataAsString:()=>Buffer.from(v).toString('utf8')})}
  });
  for(const file of ['src/shared/schema.js','src/shared/domain.js','src/server/storage.js','src/server/auth.js','src/server/api.js','src/server/operations.js'])vm.runInContext(fs.readFileSync(file,'utf8').replace(/^import .*?;\r?\n/gm,'').replace(/^export \{[^}]*\};?\r?\n?/gm,''),context,{filename:file});
  context.setup_();return {ctx:context,tables,properties,cache,failNext:name=>{failTable=name;},evaluate:code=>vm.runInContext(code,context)};
}

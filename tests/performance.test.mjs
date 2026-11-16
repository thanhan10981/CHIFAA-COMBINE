import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {gas} from './gas-mock.mjs';import {send} from './auth-helpers.mjs';
const material={name:'Rice',purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0};
test('saving a catalog record reads only its own business table, not 17 modules',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,seen=new Set(),raw=g.ctx.rawRows_;g.ctx.rawRows_=(m,...rest)=>{seen.add(m);return raw(m,...rest);};
 assert.equal(send(g,'mutate',{token,module:'materials',operation:'create',key:crypto.randomUUID(),record:material}).ok,true);
 assert.deepEqual([...seen].filter(m=>!m.startsWith('_')),['materials']);
});
test('transaction groups contiguous rows and audit into batches without losing rollback/idempotency',()=>{
 const g=gas(),effects=Array.from({length:25},(_,i)=>({module:'materials',before:null,after:{recordId:'m'+i,version:1,...material}})),key=crypto.randomUUID(),before=g.metrics.setValues;
 const r=g.ctx.transact_('fixture',key,{action:'IMPORT'},effects);assert.equal(r.ids.length,25);assert.equal(g.metrics.setValues-before,3);assert.equal(g.ctx.rawRows_('materials').length,25);assert.equal(g.ctx.rowsPlain_('_Audit').filter(r=>r[3]==='IMPORT').length,25);
 assert.equal(g.ctx.transact_('fixture',key,{action:'IMPORT'},effects).ids.length,25);assert.equal(g.ctx.rawRows_('materials').length,25);
 const fail=gas();fail.failNext('materials');assert.throws(()=>fail.ctx.transact_('fixture',key,{action:'IMPORT'},effects));assert.equal(fail.ctx.rawRows_('materials').length,0);assert.equal(fail.properties.has('WRITE_IN_PROGRESS'),false);
});
test('reads refuse to publish a partially committed transaction',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;g.properties.set('WRITE_IN_PROGRESS','pending');
 for(const action of ['bootstrap','list','export'])assert.equal(send(g,action,{token,module:'materials'}).error.code,'BUSY');
 assert.equal(send(g,'health',{token}).ok,true);
});
test('module versions invalidate only touched business modules and raw reads release across requests',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,before=g.ctx.moduleVersions_();
 send(g,'mutate',{token,module:'materials',operation:'create',key:crypto.randomUUID(),record:material});const after=g.ctx.moduleVersions_();assert.notEqual(after.materials,before.materials);assert.equal(after.sales,before.sales);
 send(g,'list',{token,module:'materials'});g.tables.get('materials').rows[1][11]=999;assert.equal(send(g,'list',{token,module:'materials',force:true}).data.rows[0].purchasePrice,999);
});
test('request profiling logs module timings without row contents, identity or credentials',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,logs=[];g.ctx.console.log=v=>logs.push(v);send(g,'bootstrap',{token,force:true});const line=logs.find(v=>v.includes('rpc_profile'));assert.ok(line);assert.match(line,/read:materials/);assert.doesNotMatch(line,new RegExp(token+'|admin@example.com|signingKey'));
});

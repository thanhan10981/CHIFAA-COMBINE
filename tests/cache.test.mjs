import test from 'node:test';
import assert from 'node:assert/strict';
import {gas} from './gas-mock.mjs';
import {send,signed} from './auth-helpers.mjs';
function fixture(){
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin-sub').token;
  let reads=0;const raw=g.ctx.rawRows_;g.ctx.rawRows_=m=>{if(!m.startsWith('_'))reads++;return raw(m);};
  return {g,token,reads:()=>reads};
}
const cacheKey=g=>[...g.cache.keys()].find(k=>k.startsWith('bootstrap:v1:'));
test('RPC reuses one workbook handle per request and releases it on success or error',()=>{
 const {g,token}=fixture(),open=g.ctx.SpreadsheetApp.openById;let opens=0;g.ctx.SpreadsheetApp.openById=id=>{opens++;return open(id);};
 assert.equal(send(g,'bootstrap',{token,force:true}).ok,true);assert.equal(opens,1);assert.equal(g.ctx.requestBooks_,undefined);
 assert.equal(send(g,'bootstrap',{token,force:true}).ok,true);assert.equal(opens,2);
 assert.equal(send(g,'list',{token,module:'bad'}).ok,false);const after=opens;g.ctx.db_();assert.equal(opens,after+1);
});
test('bootstrap cache avoids all 17 business table reads, force and stamp changes read fresh',()=>{
  const {g,token,reads}=fixture();assert.equal(send(g,'bootstrap',{token}).ok,true);assert.equal(reads(),17);
  assert.equal(send(g,'bootstrap',{token}).ok,true);assert.equal(reads(),17);
  assert.equal(send(g,'bootstrap',{token,force:true}).ok,true);assert.equal(reads(),34);
  g.ctx.bump_();send(g,'bootstrap',{token});assert.equal(reads(),51);
});
test('cache hit still rejects replay, disabled user and revoked session',()=>{
  const {g,token,reads}=fixture(),request=signed(g,'bootstrap',{token});assert.equal(g.ctx.rpc('bootstrap',request).ok,true);
  assert.equal(g.ctx.rpc('bootstrap',request).error.code,'AUTH');assert.equal(reads(),17);
  g.tables.get('_Users').rows[1][4]=false;assert.equal(send(g,'bootstrap',{token}).error.code,'AUTH');
  g.tables.get('_Users').rows[1][4]=true;send(g,'logout',{token});assert.equal(send(g,'bootstrap',{token}).error.code,'AUTH');
});
test('cached Admin data cannot leak to accountant and permission changes invalidate cache immediately',()=>{
  const {g,token}=fixture();send(g,'bootstrap',{token});
  g.ctx.append_('_Users',['acct','accountant@example.com','accountant','{"sales":["read"]}',true,1]);
  const acct=g.ctx.issueSession_('accountant@example.com','acct-sub').token;
  assert.deepEqual(Object.keys(send(g,'bootstrap',{token:acct}).data.data),['sales']);
  // Deliberate direct Sheet change without permissionVersion bump.
  g.tables.get('_Users').rows[2][3]='{}';
  assert.deepEqual(Object.keys(send(g,'bootstrap',{token:acct}).data.data),[]);
});
test('expired, corrupt and evicted caches fall back to Sheets',()=>{
  const {g,token,reads}=fixture();send(g,'bootstrap',{token});const key=cacheKey(g);
  const old=JSON.parse(g.cache.get(key));old.until=0;g.cache.set(key,JSON.stringify(old));send(g,'bootstrap',{token});assert.equal(reads(),34);
  g.cache.set(key,'corrupt');send(g,'bootstrap',{token});assert.equal(reads(),51);
  g.cache.delete(key);send(g,'bootstrap',{token});assert.equal(reads(),68);
  assert.doesNotMatch(g.cache.get(key),new RegExp(token));assert.doesNotMatch(g.cache.get(key),/signingKey/);
});
test('large snapshots skip cache and concurrent writes cannot publish a mixed snapshot',()=>{
  const {g,token}=fixture(),raw=g.ctx.rawRows_;
  g.ctx.rawRows_=m=>m==='materials'?[{recordId:'large',notes:'x'.repeat(40000)}]:raw(m);
  assert.equal(send(g,'bootstrap',{token}).ok,true);assert.equal(cacheKey(g),undefined);
  g.ctx.rawRows_=m=>{if(m==='materials')g.ctx.bump_();return raw(m);};
  assert.equal(send(g,'bootstrap',{token}).ok,true);assert.equal(cacheKey(g),undefined);
});
test('batched nonce cleanup preserves live entries between expired runs',()=>{
  const {g,token}=fixture(),request=signed(g,'bootstrap',{token});g.ctx.rpc('bootstrap',request);
  g.ctx.append_('_AuthRequests',['expired','old-1',Date.now()-1000]);
  g.ctx.append_('_AuthRequests',['expired','old-2',Date.now()-1000]);
  g.ctx.append_('_AuthRequests',['other','live',Date.now()+120000]);
  g.ctx.append_('_AuthRequests',['expired','old-3',Date.now()-1000]);
  send(g,'sync',{token});
  assert.equal(g.ctx.rowsPlain_('_AuthRequests').length,3);
  assert.ok(g.ctx.rowsPlain_('_AuthRequests').some(r=>r[1]==='live'));
  assert.equal(g.ctx.rpc('bootstrap',request).error.code,'AUTH');
});

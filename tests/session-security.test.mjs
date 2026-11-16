import test from 'node:test';
import assert from 'node:assert/strict';
import {gas} from './gas-mock.mjs';
import {signed,send} from './auth-helpers.mjs';
function admin(g){return g.ctx.issueSession_('admin@example.com','admin-sub').token;}
function accountant(g){g.ctx.append_('_Users',['acct','accountant@example.com','accountant','{"sales":["read"]}',true,1]);return g.ctx.issueSession_('accountant@example.com','acct-sub').token;}
test('session ID alone, bad signature, stale and future requests cannot read',()=>{
  const g=gas(),token=admin(g);
  assert.equal(g.ctx.rpc('bootstrap',{token}).error.code,'AUTH');
  const bad=signed(g,'bootstrap',{token});bad.proof.signature='0'.repeat(64);assert.equal(g.ctx.rpc('bootstrap',bad).error.code,'AUTH');
  for(const at of [Date.now()-61000,Date.now()+61000])assert.equal(g.ctx.rpc('bootstrap',signed(g,'bootstrap',{token},{at})).error.code,'AUTH');
});
test('signed request replay is rejected even after unrelated cache eviction',()=>{
  const g=gas(),token=admin(g),request=signed(g,'bootstrap',{token});assert.equal(g.ctx.rpc('bootstrap',request).ok,true);
  for(const k of [...g.cache.keys()])if(k!==g.ctx.sessionKey_(token))g.cache.delete(k);
  assert.equal(g.ctx.rpc('bootstrap',request).error.code,'AUTH');assert.equal(g.ctx.rowsPlain_('_AuthRequests').length,1);
});
test('changing action or request payload invalidates signature',()=>{
  const g=gas(),token=admin(g),request=signed(g,'export',{token,module:'sales'});
  assert.equal(g.ctx.rpc('bootstrap',request).error.code,'AUTH');assert.equal(g.ctx.rpc('export',{...request,module:'employees'}).error.code,'AUTH');
});
test('loss of signing-key cache fails closed and legacy bearer sessions cannot access',()=>{
  const g=gas(),token=admin(g),request=signed(g,'sync',{token});g.cache.clear();assert.equal(g.ctx.rpc('sync',request).error.code,'AUTH');
});
test('logout and Admin revocation immediately block old signed requests',()=>{
  const g=gas(),token=admin(g),acct=accountant(g),row=g.ctx.rowsPlain_('_Sessions').find(r=>r[1]==='accountant@example.com');
  const pending=signed(g,'bootstrap',{token:acct});assert.equal(send(g,'admin',{token,operation:'revoke',id:row[0]}).ok,true);
  assert.equal(g.ctx.rpc('bootstrap',pending).error.code,'AUTH');assert.equal(send(g,'logout',{token}).ok,true);assert.equal(send(g,'sync',{token}).error.code,'AUTH');
});
test('accountant gets only permitted payloads, cannot export, read health or manage users',()=>{
  const g=gas(),token=accountant(g),b=send(g,'bootstrap',{token});assert.deepEqual(Object.keys(b.data.data),['sales']);
  for(const module of ['materials','employees','cash','loans','sales'])assert.equal(send(g,'export',{token,module}).error.code,'FORBIDDEN');
  assert.equal(send(g,'health',{token}).error.code,'FORBIDDEN');assert.equal(send(g,'admin',{token,operation:'list'}).error.code,'FORBIDDEN');
  for(const module of ['sales','employees','cash'])for(const operation of ['create','update','delete','approve','reverse'])assert.equal(send(g,'mutate',{token,module,operation,key:'unauthorized-key-123456'}).error.code,'FORBIDDEN');
});
test('permissions removed and account disabled take effect on next signed request',()=>{
  const g=gas(),token=accountant(g),row=g.tables.get('_Users').rows.find(r=>r[1]==='accountant@example.com');
  row[3]='{}';assert.equal(Object.keys(send(g,'bootstrap',{token}).data.data).length,0);
  row[4]=false;assert.equal(send(g,'bootstrap',{token}).error.code,'AUTH');
});
test('authorization never relies on Session active/effective email',()=>{
  const g=gas();g.ctx.Session={getActiveUser(){throw new Error('must not use');},getEffectiveUser(){throw new Error('must not use');}};
  const token=admin(g);assert.equal(send(g,'bootstrap',{token}).ok,true);
});
test('nonce ledger bounds load and expired entries can be cleaned',()=>{
  const g=gas(),token=admin(g);g.ctx.append_('_AuthRequests',['old','old-request',Date.now()-1000]);
  assert.equal(send(g,'sync',{token}).ok,true);assert.equal(g.ctx.rowsPlain_('_AuthRequests').length,1);
});
test('role promotion revokes prior sessions so it cannot create a second active Admin',()=>{
  const g=gas(),token=admin(g),acct=accountant(g);
  assert.equal(send(g,'admin',{token,operation:'saveUser',email:'accountant@example.com',role:'admin',enabled:true,permissions:{}}).ok,true);
  assert.equal(send(g,'bootstrap',{token:acct}).error.code,'AUTH');assert.throws(()=>g.ctx.issueSession_('accountant@example.com','acct-sub'),/SESSION/);
  g.ctx.recoverAdminSessions_();assert.equal(g.ctx.rowsPlain_('_Sessions').some(r=>r[4]==='active'),false);
});
test('absolute session expiry and domain-policy change invalidate signed requests',()=>{
  const g=gas(),token=admin(g);g.tables.get('_Sessions').rows[1][3]=new Date(Date.now()-1).toISOString();
  assert.equal(send(g,'sync',{token}).error.code,'AUTH');
  const other=gas(),fresh=admin(other);other.properties.set('WORKSPACE_DOMAIN','different.example');assert.equal(send(other,'sync',{token:fresh}).error.code,'AUTH');
});

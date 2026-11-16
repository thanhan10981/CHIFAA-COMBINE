import test from 'node:test';
import assert from 'node:assert/strict';
import {gas} from './gas-mock.mjs';
import {send} from './auth-helpers.mjs';

test('OAuth start budget persists through cache eviction and rejects malformed device hints',()=>{
  const g=gas(),args={browserProof:'a'.repeat(64)};
  assert.throws(()=>g.ctx.oauthStart_({...args,deviceLabel:'<forged>'}),/VALIDATION/);
  assert.equal(g.properties.has('OAUTH_START_RATE'),false);
  for(let i=0;i<30;i++)g.ctx.oauthStart_(args);
  g.cache.clear();assert.throws(()=>g.ctx.oauthStart_(args),/RATE_LIMIT/);
  assert.equal(g.ctx.fetches.length,0);
  g.properties.set('OAUTH_STARTS_PER_MINUTE','121');assert.throws(()=>g.ctx.oauthStart_(args),/CONFIG/);
});

test('OAuth callback consumes state under lock but never holds lock during Google network calls',()=>{
  const g=gas();let held=false,calls=0;
  g.ctx.LockService.getScriptLock=()=>({tryLock(){assert.equal(held,false);held=true;return true;},releaseLock(){held=false;}});
  const secret='a'.repeat(64),f=g.ctx.oauthStart_({browserProof:g.ctx.hash_(secret),deviceLabel:'Chrome · Windows'});
  g.ctx.fetchResponse=url=>{assert.equal(held,false);calls++;if(calls===1)assert.throws(()=>g.ctx.oauthCallback_({state:f.flow,code:'replay'}),/AUTH/);return url.endsWith('/token')?{access_token:'private-google-token',token_type:'Bearer',expires_in:3600}:{email:'admin@example.com',email_verified:true,sub:'admin',hd:'example.com'};};
  g.ctx.oauthCallback_({state:f.flow,code:'code'});assert.equal(calls,2);assert.equal(held,false);
  assert.equal(g.ctx.rowsPlain_('_Sessions').length,0);
  const session=g.ctx.oauthFinish_({flow:f.flow,browserSecret:secret});
  const list=send(g,'admin',{token:session.token,operation:'list'});
  assert.equal(list.ok,true);assert.equal(list.data.sessions[0].deviceLabel,'Chrome · Windows');
  for(const value of [session.token,session.signingKey,'private-google-token','mock-secret'])assert.equal(JSON.stringify(list).includes(value),false);
});

test('Security alerts require Admin, acknowledgements are idempotent and revocation clears credentials',()=>{
  const g=gas(),admin=g.ctx.issueSession_('admin@example.com','admin',{deviceLabel:'Admin browser'});
  g.ctx.append_('_Users',['staff','staff@example.com','staff','{}',true,1]);
  const staff=g.ctx.issueSession_('staff@example.com','staff'),list=send(g,'admin',{token:admin.token,operation:'list'}).data;
  const id=list.security.alerts[0].id;
  assert.equal(send(g,'admin',{token:staff.token,operation:'list'}).error.code,'FORBIDDEN');
  assert.equal(send(g,'admin',{token:staff.token,operation:'ackAlert',id}).error.code,'FORBIDDEN');
  for(let i=0;i<2;i++)assert.equal(send(g,'admin',{token:admin.token,operation:'ackAlert',id}).ok,true);
  assert.equal(g.ctx.rowsPlain_('_Audit').filter(r=>r[3]==='SECURITY_ACK'&&r[5]===id).length,1);
  assert.equal(send(g,'admin',{token:admin.token,operation:'list'}).data.security.alerts.find(a=>a.id===id).acknowledged,true);
  const target=list.sessions.find(s=>s.email==='staff@example.com');
  assert.equal(send(g,'admin',{token:admin.token,operation:'revoke',id:target.id}).ok,true);
  assert.equal(g.cache.has(g.ctx.sessionKey_(staff.token)),false);
  assert.equal(g.properties.has('session-device:'+target.id),false);
  assert.equal(send(g,'bootstrap',{token:staff.token}).error.code,'AUTH');
});

test('Device metadata is optional, bounded and never grants session authority',()=>{
  const g=gas(),future=new Date(Date.now()+3600000).toISOString();
  for(let i=0;i<85;i++)g.ctx.recordSessionDevice_('id'+i,'browser',future);
  assert.equal(JSON.parse(g.properties.get('SESSION_DEVICE_INDEX')).length,80);
  assert.equal(g.properties.has('session-device:id0'),false);
  assert.throws(()=>g.ctx.authenticate_('id84'.repeat(10)),/AUTH/);
  const session=g.ctx.issueSession_('admin@example.com','admin');
  const row=g.ctx.rowsPlain_('_Sessions').find(r=>r[2]===g.ctx.hash_(session.token));
  const meta=JSON.parse(g.properties.get('session-device:'+row[0]));meta.lastSeen=new Date(Date.now()-120000).toISOString();
  g.properties.set('session-device:'+row[0],JSON.stringify(meta));
  assert.equal(send(g,'bootstrap',{token:session.token}).ok,true);
  assert.ok(Date.parse(g.ctx.sessionDevice_(row[0]).lastSeen)>Date.parse(meta.lastSeen));
  g.properties.delete('session-device:'+row[0]);assert.equal(send(g,'bootstrap',{token:session.token}).ok,true);
});

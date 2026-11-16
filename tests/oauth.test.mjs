import test from 'node:test';
import assert from 'node:assert/strict';
import {gas} from './gas-mock.mjs';
import {signed,send} from './auth-helpers.mjs';
const secret='a'.repeat(64);
function begin(g){return g.ctx.oauthStart_({browserProof:g.ctx.hash_(secret)});}
function callback(g,flow,identity={email:'admin@example.com',email_verified:true,sub:'google-admin',hd:'example.com'}){
  g.ctx.claims=identity;return g.ctx.oauthCallback_({state:flow,code:'google-code'});
}
test('OAuth start uses registered exec callback, identity scope only and no secret in URL',()=>{
  const g=gas(),f=begin(g),url=new URL(f.url);
  assert.equal(url.searchParams.get('redirect_uri'),g.properties.get('WEB_APP_URL'));
  assert.equal(url.searchParams.get('scope'),'openid email');assert.equal(url.searchParams.get('response_type'),'code');
  assert.equal(url.searchParams.has('client_secret'),false);assert.equal(f.url.includes(secret),false);
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('code_challenge'),Buffer.from(g.ctx.Utilities.computeDigest('sha256',g.ctx.readFlow_(f.flow).verifier)).toString('base64url'));
  assert.equal(g.ctx.oauthFinish_({flow:f.flow,browserSecret:secret}).pending,true);
});
test('callback exchanges code only at Google, stores no Google tokens and finishes once',()=>{
  const g=gas(),f=begin(g);callback(g,f.flow);
  assert.equal(g.ctx.fetches.length,2);assert.equal(g.ctx.fetches[0].options.payload.client_secret,'mock-secret');
  assert.equal(g.ctx.fetches[0].options.payload.code_verifier.length,64);assert.equal(g.ctx.readFlow_(f.flow).verifier,undefined);
  assert.equal(g.ctx.fetches[1].options.headers.Authorization,'Bearer google-access-mock');
  assert.equal(JSON.stringify([...g.cache]).includes('google-access-mock'),false);
  const session=g.ctx.oauthFinish_({flow:f.flow,browserSecret:secret});assert.equal(session.user.email,'admin@example.com');
  assert.throws(()=>g.ctx.oauthFinish_({flow:f.flow,browserSecret:secret}),/AUTH/);
  assert.equal(g.ctx.rowsPlain_('_Sessions')[0][2],g.ctx.hash_(session.token));
});
test('callback replay, unknown state and browser-secret theft attempt fail closed',()=>{
  const g=gas(),f=begin(g);assert.throws(()=>g.ctx.oauthCallback_({state:'b'.repeat(64),code:'x'}),/AUTH/);
  callback(g,f.flow);assert.throws(()=>callback(g,f.flow),/AUTH/);assert.equal(g.ctx.fetches.length,2);
  assert.throws(()=>g.ctx.oauthFinish_({flow:f.flow,browserSecret:'b'.repeat(64)}),/AUTH/);
  assert.equal(g.ctx.rowsPlain_('_Sessions').length,0);assert.ok(g.ctx.oauthFinish_({flow:f.flow,browserSecret:secret}).token);
});
test('expired flow and changed redirect configuration cannot finish',()=>{
  const g=gas(),f=begin(g),v=g.ctx.readFlow_(f.flow);v.expires=Date.now()-1;g.ctx.writeFlow_(f.flow,v);
  assert.throws(()=>callback(g,f.flow),/AUTH/);
  const other=begin(g);g.properties.set('WEB_APP_URL','https://script.google.com/macros/s/OTHER/exec');assert.throws(()=>callback(g,other.flow),/AUTH/);
});
test('denial, unverified identity and users outside allowlist create no session',()=>{
  for(const identity of [{email:'unknown@gmail.com',email_verified:true,sub:'unknown'},{email:'admin@example.com',email_verified:false,sub:'admin',hd:'example.com'},{email:'admin@example.com',email_verified:true,sub:'admin'}]){
    const g=gas(),f=begin(g);assert.throws(()=>callback(g,f.flow,identity),/AUTH|FORBIDDEN/);
    assert.throws(()=>g.ctx.oauthFinish_({flow:f.flow,browserSecret:secret}),/AUTH|FORBIDDEN/);assert.equal(g.ctx.rowsPlain_('_Sessions').length,0);
  }
  const g=gas(),f=begin(g);assert.throws(()=>g.ctx.oauthCallback_({state:f.flow,error:'access_denied'}),/AUTH/);assert.equal(g.ctx.fetches.length,0);
});
test('Google token/userinfo failures are sanitized and callback cannot retry',()=>{
  const g=gas(),f=begin(g);g.ctx.fetchResponse=()=>({status:401,error:'secret-provider-error'});
  assert.throws(()=>callback(g,f.flow),error=>!error.message.includes('secret-provider-error'));
  assert.throws(()=>callback(g,f.flow),/AUTH/);assert.equal(g.ctx.fetches.length,1);
});

test('OAuth diagnostics distinguish token rejection, userinfo and allowlist without leaking provider text',()=>{
  for(const providerError of ['invalid_client','invalid_grant','redirect_uri_mismatch','unknown-private-error']){
    const g=gas(),f=begin(g);g.ctx.fetchResponse=()=>({status:400,error:providerError,error_description:'private-provider-description'});
    const html=g.ctx.doGet({parameter:{state:f.flow,code:'private-code'}}).html;
    const diagnostic='OAUTH_TOKEN_'+(providerError==='unknown-private-error'?'REJECTED':providerError.toUpperCase());
    assert.ok(html.includes(diagnostic));
    for(const privateValue of ['private-provider-description','private-code','unknown-private-error',f.flow,'mock-secret'])assert.equal(html.includes(privateValue),false);
    assert.throws(()=>g.ctx.oauthFinish_({flow:f.flow,browserSecret:secret}),new RegExp(diagnostic));
  }
  const g=gas(),f=begin(g);
  g.ctx.fetchResponse=url=>url.endsWith('/token')?{access_token:'private-token',token_type:'Bearer',expires_in:3600}:{status:403,error:'private-userinfo-error'};
  assert.ok(g.ctx.doGet({parameter:{state:f.flow,code:'x'}}).html.includes('OAUTH_USERINFO_REJECTED'));
  const other=gas(),flow=begin(other);other.ctx.claims={email:'unknown@gmail.com',email_verified:true,sub:'unknown'};
  assert.ok(other.ctx.doGet({parameter:{state:flow.flow,code:'x'}}).html.includes('OAUTH_USERS'));
  assert.equal(other.ctx.oauthDiagnostic_({message:'AUTH: OAUTH_<script>'}), 'OAUTH_STATE');
});
test('DEV workbook guard and internal mode enforce fail closed',()=>{
  const g=gas();g.properties.set('SPREADSHEET_ID','production');assert.throws(()=>begin(g),/CONFIG/);
  g.properties.set('SPREADSHEET_ID','test');g.properties.set('APP_MODE','portal');assert.throws(()=>begin(g),/FORBIDDEN/);
});
test('single active Admin spans accounts, logs denial; accountant may login concurrently',()=>{
  const g=gas();g.ctx.append_('_Users',['u2','second@example.com','admin','{}',true,1]);
  g.ctx.issueSession_('admin@example.com','one');assert.throws(()=>g.ctx.issueSession_('second@example.com','two'),/SESSION/);
  assert.ok(g.ctx.rowsPlain_('_Audit').some(r=>r[3]==='LOGIN_DENIED'));
  g.ctx.append_('_Users',['u3','accountant@example.com','accountant','{"sales":["read"]}',true,1]);assert.ok(g.ctx.issueSession_('accountant@example.com','three').token);
});
test('Google subject binding detects replaced identity and disabled user at finish',()=>{
  const g=gas(),one=g.ctx.issueSession_('admin@example.com','one');g.ctx.logout_({email:'admin@example.com'},one.token);
  assert.throws(()=>g.ctx.issueSession_('admin@example.com','different'),/AUTH/);
  const f=begin(g);callback(g,f.flow);g.tables.get('_Users').rows[1][4]=false;assert.throws(()=>g.ctx.oauthFinish_({flow:f.flow,browserSecret:secret}),/FORBIDDEN/);
});
test('legacy GIS login is disabled even when old debug properties are present',()=>{
  const g=gas();g.properties.set('AUTH_MODE','test-tokeninfo');g.properties.set('ALLOW_TEST_AUTH','true');
  assert.equal(g.ctx.rpc('login',{idToken:'forged'}).error.code,'AUTH');assert.equal(g.ctx.fetches.length,0);
});
test('callback HTML never reflects code, state, identity, provider error or credentials',()=>{
  const g=gas(),f=begin(g);g.ctx.claims={email:'admin@example.com',email_verified:true,sub:'admin',hd:'example.com'};
  const html=g.ctx.doGet({parameter:{state:f.flow,code:'sensitive-code'}}).html;
  assert.ok(html.includes('window.top.close()'));
  for(const secret of ['sensitive-code',f.flow,'admin@example.com','google-access-mock','mock-secret'])assert.equal(html.includes(secret),false);
  const error=g.ctx.doGet({parameter:{state:f.flow,error:'<script>alert(1)</script>'}}).html;
  assert.equal(error.includes('<script>'),false);assert.equal(g.ctx.doGet().file,'Index');
});
test('personal Gmail works without hd; Workspace-domain policy still rejects other identities',()=>{
  const g=gas();g.ctx.append_('_Users',['gmail','tester@gmail.com','staff','{}',true,1]);
  const f=begin(g);callback(g,f.flow,{email:'tester@gmail.com',email_verified:true,sub:'gmail-sub'});
  assert.equal(g.ctx.oauthFinish_({flow:f.flow,browserSecret:secret}).user.email,'tester@gmail.com');
  g.properties.set('WORKSPACE_DOMAIN','allowed.example');const denied=begin(g);
  assert.throws(()=>callback(g,denied.flow,{email:'tester@gmail.com',email_verified:true,sub:'gmail-sub'}),/AUTH/);
});

test('verified Admin migrates missing nonce ledger once and replaces incomplete sessions without changing business data',()=>{
  const g=gas();g.ctx.issueSession_('admin@example.com','admin');
  const before=JSON.stringify(g.ctx.data_());g.tables.delete('_AuthRequests');
  const session=g.ctx.issueSession_('admin@example.com','admin');
  assert.deepEqual(Array.from(g.tables.get('_AuthRequests').rows[0]),['sessionHash','requestId','expires']);
  assert.equal(JSON.stringify(g.ctx.data_()),before);
  assert.equal(g.ctx.rowsPlain_('_Sessions').filter(r=>r[4]==='active').length,1);
  assert.ok(session.token);assert.ok(g.ctx.rowsPlain_('_Audit').some(r=>r[3]==='AUTH_SCHEMA_MIGRATION'));
  g.tables.get('_AuthRequests').rows[0]=['foreign','data'];
  assert.throws(()=>g.ctx.issueSession_('admin@example.com','admin'),/SCHEMA/);
  const staff=gas();staff.ctx.append_('_Users',['staff','staff@gmail.com','staff','{}',true,1]);staff.tables.delete('_AuthRequests');
  assert.throws(()=>staff.ctx.issueSession_('staff@gmail.com','staff'),/FORBIDDEN/);
  assert.equal(staff.tables.has('_AuthRequests'),false);
});

test('fresh Google reauthentication replaces only own Admin session after tab closes',()=>{
  const g=gas(),first=begin(g);callback(g,first.flow);
  const old=g.ctx.oauthFinish_({flow:first.flow,browserSecret:secret});
  const priorRequest=signed(g,'bootstrap',{token:old.token});
  // Simulate losing all client memory without logging out, then opening a new tab.
  const reopened=begin(g);callback(g,reopened.flow);
  const current=g.ctx.oauthFinish_({flow:reopened.flow,browserSecret:secret});
  assert.notEqual(current.token,old.token);
  assert.equal(g.cache.has(g.ctx.sessionKey_(old.token)),false);
  assert.equal(g.ctx.rpc('bootstrap',priorRequest).error.code,'AUTH');
  assert.equal(send(g,'bootstrap',{token:current.token}).ok,true);
  assert.equal(g.ctx.rowsPlain_('_Sessions').filter(r=>r[4]==='active').length,1);
  assert.ok(g.ctx.rowsPlain_('_Audit').some(r=>r[3]==='SESSION_REPLACED'));
  assert.throws(()=>g.ctx.oauthFinish_({flow:reopened.flow,browserSecret:secret}),/AUTH/);
});

test('session replacement requires fresh verified flow, browser proof and unchanged Google subject',()=>{
  const g=gas(),old=g.ctx.issueSession_('admin@example.com','google-admin');
  const pending=begin(g);
  assert.equal(g.ctx.oauthFinish_({flow:pending.flow,browserSecret:secret,replaceOwnAdminSession:true}).pending,true);
  assert.equal(g.ctx.authenticate_(old.token).email,'admin@example.com');
  callback(g,pending.flow);
  assert.throws(()=>g.ctx.oauthFinish_({flow:pending.flow,browserSecret:'b'.repeat(64)}),/AUTH/);
  assert.equal(g.ctx.authenticate_(old.token).email,'admin@example.com');
  const mismatch=begin(g);callback(g,mismatch.flow,{email:'admin@example.com',email_verified:true,sub:'different-sub',hd:'example.com'});
  assert.throws(()=>g.ctx.oauthFinish_({flow:mismatch.flow,browserSecret:secret}),/AUTH/);
  assert.equal(g.ctx.authenticate_(old.token).email,'admin@example.com');
});

test('fresh verified Google login cannot replace a different active Admin account',()=>{
  const g=gas(),old=g.ctx.issueSession_('admin@example.com','google-admin');
  g.ctx.append_('_Users',['second','second@example.com','admin','{}',true,1]);
  const second=begin(g);callback(g,second.flow,{email:'second@example.com',email_verified:true,sub:'second-sub',hd:'example.com'});
  assert.throws(()=>g.ctx.oauthFinish_({flow:second.flow,browserSecret:secret}),/SESSION/);
  assert.equal(g.ctx.authenticate_(old.token).email,'admin@example.com');
  assert.equal(g.ctx.rowsPlain_('_Sessions').filter(r=>r[4]==='active').length,1);
});

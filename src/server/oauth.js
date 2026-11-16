// Confidential OAuth client. Google credentials never leave Apps Script.
const AUTH_FLOW_SECONDS = 300;
function authConfig_(){
  if(config_('APP_MODE')!=='internal')throw new Error('FORBIDDEN: Không phải cổng nội bộ');
  if(config_('AUTH_ENV')!=='DEV'||config_('AUTH_DEV_SPREADSHEET_ID')!==config_('SPREADSHEET_ID'))throw new Error('CONFIG: Xác thực chỉ được bật trên workbook DEV đã chỉ định');
  const redirect=config_('WEB_APP_URL');
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(redirect))throw new Error('CONFIG: WEB_APP_URL phải là URL triển khai /exec');
  const clientId=config_('GOOGLE_CLIENT_ID'),secret=config_('GOOGLE_CLIENT_SECRET');
  return {redirect,clientId,secret,fingerprint:hash_([redirect,clientId,secret,config_('SPREADSHEET_ID'),props_().getProperty('WORKSPACE_DOMAIN')||''])};
}
function randomSecret_(){return uid_().replace(/-/g,'')+uid_().replace(/-/g,'');}
function flowKey_(flow){
  if(typeof flow!=='string'||!/^[a-f0-9]{64}$/.test(flow))throw new Error('AUTH: Yêu cầu đăng nhập không hợp lệ');
  return 'oauth-flow:'+hash_(flow);
}
function readFlow_(flow){
  const raw=CacheService.getScriptCache().get(flowKey_(flow));
  if(!raw)throw new Error('AUTH: Lần đăng nhập đã hết hạn hoặc đã sử dụng');
  const value=JSON.parse(raw);
  if(value.expires<=Date.now()||value.fingerprint!==authConfig_().fingerprint)throw new Error('AUTH: Lần đăng nhập đã hết hạn hoặc cấu hình thay đổi');
  return value;
}
function writeFlow_(flow,value){
  CacheService.getScriptCache().put(flowKey_(flow),JSON.stringify(value),Math.max(1,Math.ceil((value.expires-Date.now())/1000)));
}
function oauthStart_(args){
  const c=authConfig_();
  if(typeof args.browserProof!=='string'||!/^[a-f0-9]{64}$/.test(args.browserProof))throw new Error('AUTH: Thiếu ràng buộc trình duyệt');
  const flow=randomSecret_(),verifier=randomSecret_();
  writeFlow_(flow,{browserProof:args.browserProof,verifier,expires:Date.now()+AUTH_FLOW_SECONDS*1000,phase:'pending',fingerprint:c.fingerprint});
  const challenge=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,verifier)).replace(/=+$/,'');
  const query={client_id:c.clientId,redirect_uri:c.redirect,response_type:'code',scope:'openid email',state:flow,access_type:'online',prompt:'select_account',code_challenge:challenge,code_challenge_method:'S256'};
  return {flow,sessionScope:hash_(['session-store-v1',c.redirect,config_('SPREADSHEET_ID')]),expiresIn:AUTH_FLOW_SECONDS,url:'https://accounts.google.com/o/oauth2/v2/auth?'+Object.entries(query).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&')};
}
function googleJson_(url,options,stage='GOOGLE'){
  let response;
  try{response=UrlFetchApp.fetch(url,{...options,muteHttpExceptions:true,followRedirects:false});}
  catch(_){throw new Error('AUTH: OAUTH_'+stage+'_FETCH');}
  if(response.getResponseCode()!==200){
    let code='REJECTED';
    try{const body=JSON.parse(response.getContentText());if(['invalid_client','invalid_grant','redirect_uri_mismatch','access_denied'].includes(body.error))code=body.error.toUpperCase();}catch(_){/* Never expose provider response text. */}
    throw new Error('AUTH: OAUTH_'+stage+'_'+code);
  }
  let body;try{body=JSON.parse(response.getContentText());}catch(_){throw new Error('AUTH: Phản hồi Google không hợp lệ');}
  return body;
}
function oauthCallback_(parameters){
  return locked_(()=>{
    const flow=parameters.state,value=readFlow_(flow);
    if(value.phase!=='pending')throw new Error('AUTH: Callback đã sử dụng');
    // Consume before network access: duplicate/failed callbacks must start again.
    value.phase='exchanging';writeFlow_(flow,value);
    let stage='CALLBACK';
    try{
      if(parameters.error||typeof parameters.code!=='string'||!parameters.code||parameters.code.length>4096)throw new Error('AUTH: Đăng nhập bị hủy hoặc thiếu mã');
      const c=authConfig_();
      stage='TOKEN';
      const tokens=googleJson_('https://oauth2.googleapis.com/token',{method:'post',payload:{code:parameters.code,client_id:c.clientId,client_secret:c.secret,redirect_uri:c.redirect,grant_type:'authorization_code',code_verifier:value.verifier}},stage);
      if(typeof tokens.access_token!=='string'||!tokens.access_token||tokens.token_type!=='Bearer'||!(Number(tokens.expires_in)>0))throw new Error('AUTH: Google không cấp quyền xác minh danh tính');
      // Authenticated back-channel UserInfo; no unverified JWT parsing/tokeninfo.
      stage='USERINFO';
      const identity=googleJson_('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token}},stage);
      stage='IDENTITY';
      const email=String(identity.email||'').toLowerCase();
      if(identity.email_verified!==true||typeof identity.sub!=='string'||!identity.sub||!email||(!identity.hd&&!email.endsWith('@gmail.com')))throw new Error('AUTH: Danh tính Google chưa được xác minh');
      stage='DOMAIN';const domain=props_().getProperty('WORKSPACE_DOMAIN');
      if(domain&&identity.hd!==domain)throw new Error('AUTH: Sai miền Workspace');
      stage='USERS';if(!users_().some(u=>u.email===email&&u.enabled))throw new Error('FORBIDDEN: Email chưa được cấp quyền');
      stage='CACHE';
      value.phase='verified';value.email=email;value.subject=identity.sub;delete value.verifier;writeFlow_(flow,value);
    }catch(error){
      value.phase='failed';value.failure=String(error.message).startsWith('FORBIDDEN:')?'FORBIDDEN':'AUTH';delete value.verifier;
      value.diagnostic=oauthDiagnostic_(error,'OAUTH_'+stage);writeFlow_(flow,value);
      try{audit_('ANONYMOUS','OAUTH_DENIED','sessions','',null,{reason:value.failure,diagnostic:value.diagnostic});}catch(_){/* Preserve safe diagnostic if audit storage is unavailable. */}
      throw new Error(value.failure+': '+value.diagnostic);
    }
    return true;
  });
}
function oauthFinish_(args){
  return locked_(()=>{
    const value=readFlow_(args.flow);
    if(typeof args.browserSecret!=='string'||!/^[a-f0-9]{64}$/.test(args.browserSecret)||!constantEqual_(hash_(args.browserSecret),value.browserProof))throw new Error('AUTH: Sai trình duyệt khởi tạo');
    if(value.phase==='pending'||value.phase==='exchanging')return {pending:true};
    CacheService.getScriptCache().remove(flowKey_(args.flow));
    if(value.phase!=='verified')throw new Error((value.failure||'AUTH')+': Đăng nhập không thành công. Mã '+oauthDiagnostic_(null,value.diagnostic||'OAUTH_CALLBACK'));
    return issueSession_(value.email,value.subject,{replaceOwnAdminSession:true});
  });
}
function oauthDiagnostic_(error,fallback='OAUTH_STATE'){
  const match=/^(?:AUTH|FORBIDDEN): (OAUTH_[A-Z_]+)$/.exec(String(error?.message||''));
  const code=match?match[1]:fallback;
  return /^OAUTH_(?:STATE|CALLBACK|TOKEN|USERINFO|IDENTITY|DOMAIN|USERS|CACHE)(?:_(?:FETCH|REJECTED|INVALID_CLIENT|INVALID_GRANT|REDIRECT_URI_MISMATCH|ACCESS_DENIED))?$/.test(code)?code:'OAUTH_STATE';
}
function oauthPage_(parameters){
  let verified=false,text='Đã xác minh tài khoản Google';
  try{oauthCallback_(parameters);verified=true;}catch(error){text='Đăng nhập chưa thành công. Mã '+oauthDiagnostic_(error)+'. Quay về tab CHIFAA để thử lại.';}
  // HtmlService runs inside an iframe: close its top-level login tab, never the iframe.
  const close=verified?'<p>Quay về tab CHIFAA đang mở để tiếp tục. Bạn có thể đóng tab xác minh này.</p><button id="close-tab" type="button">Đóng tab xác minh</button><p id="close-hint">Nếu trình duyệt không đóng tab, nhấn Ctrl + W hoặc dấu × trên tab.</p><script>function closeLoginTab(){try{window.top.close();}catch(e){}}document.getElementById("close-tab").addEventListener("click",closeLoginTab);setTimeout(closeLoginTab,700);</script>':'';
  // Fixed text and allowlisted diagnostic only; never reflect provider text or credentials.
  return HtmlService.createHtmlOutput('<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>CHIFAA · Đăng nhập</title><style>body{margin:0;background:#f5f6f8;color:#243449;font:15px/1.7 "Segoe UI",Arial,sans-serif;display:grid;place-items:center;min-height:90vh}.card{max-width:460px;margin:24px;padding:36px;background:white;border:1px solid #e6eaf0;border-radius:18px}small{color:#dc6a2b;font-weight:800;letter-spacing:2px}h1{font-size:24px;line-height:1.4}button{background:#dc6a2b;color:white;border:0;padding:13px 20px;border-radius:10px;font:600 14px "Segoe UI",sans-serif;cursor:pointer}#close-hint{font-size:12px;color:#7a8798}</style></head><body><main class="card"><small>CHIFAA COMBINE</small><h1>'+text+'</h1>'+close+'</main></body></html>').setTitle('CHIFAA · Đăng nhập');
}

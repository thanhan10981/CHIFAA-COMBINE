function users_(){return rowsPlain_('_Users').map((r,i)=>({recordId:r[0],email:r[1],role:r[2],permissions:JSON.parse(r[3]||'{}'),enabled:r[4]===true,permissionVersion:r[5],row:i+2}));}
function allowed_(user,module,action){return user.role==='admin'||user.permissions?.[module]?.includes(action);}
function require_(user,module,action){if(!Object.hasOwn(SCHEMA,module)||!allowed_(user,module,action))throw new Error('FORBIDDEN: Chưa được cấp quyền '+action+' / '+module);}
function requireAdmin_(user){if(user.role!=='admin')throw new Error('FORBIDDEN: Chỉ quản trị');}
function challenge_(){
  if(config_('APP_MODE')!=='internal')throw new Error('FORBIDDEN: Không phải cổng nội bộ');
  const nonce=uid_()+uid_();CacheService.getScriptCache().put('nonce:'+nonce,'1',300);
  return {nonce,clientId:config_('GOOGLE_CLIENT_ID')};
}
function login_(args){
  if(config_('APP_MODE')!=='internal')throw new Error('FORBIDDEN: Không phải cổng nội bộ');
  if(typeof args.idToken!=='string'||args.idToken.length>10000||typeof args.nonce!=='string')throw new Error('AUTH: Token không hợp lệ');
  // Production uses Google's maintained verification library in verifier/.
  // Debug tokeninfo is disabled unless deliberately selected in Script Properties.
  const mode=props_().getProperty('AUTH_MODE');let response;
  if(mode==='verifier'){
    const url=config_('VERIFIER_URL');if(!url.startsWith('https://'))throw new Error('CONFIG: Bộ xác thực cần HTTPS');
    response=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',headers:{'X-Chifaa-Key':config_('VERIFIER_SHARED_SECRET')},payload:JSON.stringify({idToken:args.idToken}),muteHttpExceptions:true});
  }else if(mode==='test-tokeninfo'&&props_().getProperty('ALLOW_TEST_AUTH')==='true'){
    response=UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(args.idToken),{muteHttpExceptions:true});
  }else throw new Error('CONFIG: Cần bộ xác thực production; xem docs/CAI_DAT_GOOGLE.md');
  if(response.getResponseCode()!==200)throw new Error('AUTH: Google từ chối token');
  const claims=JSON.parse(response.getContentText());
  if(claims.aud!==config_('GOOGLE_CLIENT_ID')||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||Number(claims.exp)*1000<=Date.now()||![true,'true'].includes(claims.email_verified)||claims.nonce!==args.nonce)throw new Error('AUTH: Sai thông tin xác thực');
  const domain=props_().getProperty('WORKSPACE_DOMAIN');if(domain&&claims.hd!==domain)throw new Error('AUTH: Sai miền Workspace');
  if(!claims.hd&&!String(claims.email||'').toLowerCase().endsWith('@gmail.com'))throw new Error('AUTH: Chỉ nhận Gmail hoặc Google Workspace đã xác minh');
  return locked_(()=>{
    const cache=CacheService.getScriptCache();if(!cache.get('nonce:'+args.nonce))throw new Error('AUTH: Phiên đăng nhập đã hết hạn');cache.remove('nonce:'+args.nonce);
    const email=String(claims.email).toLowerCase(),user=users_().find(u=>u.email===email&&u.enabled);
    if(!user)throw new Error('FORBIDDEN: Email chưa được quản trị cấp quyền');
    const active=rowsPlain_('_Sessions').filter(r=>r[1]===email&&r[4]==='active'&&Date.parse(r[3])>Date.now());
    if(user.role==='admin'&&active.length){
      append_('_Sessions',[uid_(),email,'',now_(),'denied',now_()]);audit_(email,'LOGIN_DENIED','sessions','',null,{reason:'admin-active-session'});
      throw new Error('SESSION: Admin đang có phiên hoạt động. Dùng phiên hiện tại để thu hồi, hoặc chủ sở hữu chạy recoverAdminSessions trong Apps Script.');
    }
    const token=uid_()+uid_(),expires=new Date(Date.now()+8*3600000).toISOString();
    append_('_Sessions',[uid_(),email,hash_(token),expires,'active',now_()]);
    audit_(email,'LOGIN','sessions','',null,{expires});return {token,user:{email,role:user.role},expires};
  });
}
function authenticate_(token){
  if(config_('APP_MODE')!=='internal')throw new Error('FORBIDDEN: Cổng khách không được gọi dữ liệu nội bộ');
  if(typeof token!=='string'||token.length<32||token.length>150)throw new Error('AUTH: Cần đăng nhập');
  const session=rowsPlain_('_Sessions').find(r=>r[2]===hash_(token)&&r[4]==='active'&&Date.parse(r[3])>Date.now());
  if(!session)throw new Error('AUTH: Phiên hết hạn hoặc bị thu hồi');
  const user=users_().find(u=>u.email===session[1]&&u.enabled);if(!user)throw new Error('AUTH: Tài khoản bị khóa');
  return user;
}
function logout_(user,token){const rows=rowsPlain_('_Sessions'),index=rows.findIndex(r=>r[2]===hash_(token));if(index>=0)table_('_Sessions').getRange(index+2,5).setValue('revoked');return {loggedOut:true};}
function admin_(user,args){
  requireAdmin_(user);
  if(args.operation==='list')return {users:users_().map(u=>({...u,row:undefined})),sessions:rowsPlain_('_Sessions').map(r=>({id:r[0],email:r[1],expires:r[3],status:r[4],createdAt:r[5]}))};
  if(args.operation==='revoke'){
    const row=rowsPlain_('_Sessions').findIndex(r=>r[0]===args.id);if(row<0)throw new Error('NOT_FOUND: Không tìm thấy phiên');
    table_('_Sessions').getRange(row+2,5).setValue('revoked');audit_(user.email,'REVOKE','sessions',args.id,null,null);return {revoked:true};
  }
  if(args.operation==='saveUser'){
    const email=String(args.email||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['admin','accountant','staff'].includes(args.role)||typeof args.enabled!=='boolean')throw new Error('VALIDATION: Tài khoản không hợp lệ');
    if(email===user.email && (args.role!=='admin'||!args.enabled))throw new Error('VALIDATION: Không tự hạ quyền hoặc khóa chính mình');
    const permissions=args.permissions||{};
    for(const [m,actions]of Object.entries(permissions))if(!Object.hasOwn(SCHEMA,m)||!Array.isArray(actions)||actions.some(a=>!ACTIONS.includes(a)))throw new Error('VALIDATION: Quyền không hợp lệ');
    const old=users_().find(u=>u.email===email),row=[old?.recordId||uid_(),email,args.role,JSON.stringify(permissions),args.enabled,(Number(old?.permissionVersion)||0)+1];
    if(old)table_('_Users').getRange(old.row,1,1,row.length).setValues([row]);else append_('_Users',row);
    audit_(user.email,'USER_UPDATE','users',email,old,{role:args.role,enabled:args.enabled,permissions});bump_();return {saved:true};
  }
  throw new Error('VALIDATION: Thao tác quản trị không hợp lệ');
}

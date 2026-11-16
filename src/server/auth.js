function users_(){return rowsPlain_('_Users').map((r,i)=>({recordId:r[0],email:r[1],role:r[2],permissions:JSON.parse(r[3]||'{}'),enabled:r[4]===true,permissionVersion:r[5],row:i+2}));}
function allowed_(user,module,action){return user.role==='admin'||user.permissions?.[module]?.includes(action);}
function require_(user,module,action){if(!Object.hasOwn(SCHEMA,module)||!allowed_(user,module,action))throw new Error('FORBIDDEN: Chưa được cấp quyền '+action+' / '+module);}
function requireAdmin_(user){if(user.role!=='admin')throw new Error('FORBIDDEN: Chỉ quản trị');}
function constantEqual_(a,b){
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
function sessionKey_(token){return 'session-key:'+hash_(token);}
function issueSession_(email,subject,{replaceOwnAdminSession=false,deviceLabel='Thiết bị web'}={}){
  deviceLabel=deviceLabel_(deviceLabel);
  const users=users_(),user=users.find(u=>u.email===email&&u.enabled);
  if(!user)throw new Error('FORBIDDEN: Email chưa được quản trị cấp quyền');
  ensureAuthRequests_(user);
  const binding='google-sub:'+hash_(email),previous=props_().getProperty(binding);
  if(previous&&previous!==hash_(subject))throw new Error('AUTH: Danh tính Google đã thay đổi. Liên hệ chủ sở hữu');
  const admins=new Set(users.filter(u=>u.role==='admin'&&u.enabled).map(u=>u.email));
  const sessions=rowsPlain_('_Sessions'),activeAdmins=sessions.filter(r=>admins.has(r[1])&&r[4]==='active'&&Date.parse(r[3])>Date.now());
  if(user.role==='admin'&&activeAdmins.some(r=>!replaceOwnAdminSession||r[1]!==email)){
    append_('_Sessions',[uid_(),email,'',now_(),'denied',now_()]);audit_(email,'LOGIN_DENIED','sessions','',null,{reason:'admin-active-session'});
    throw new Error('SESSION: Đang có phiên quản trị khác hoạt động. Cần đăng xuất phiên đó hoặc nhờ chủ sở hữu thu hồi phiên');
  }
  // Only oauthFinish_ enables replacement after a fresh, browser-bound Google flow.
  // Revoke before issuing so the one-Admin invariant also holds across failures.
  if(user.role==='admin'&&replaceOwnAdminSession){
    let revoked=0;
    sessions.forEach((r,i)=>{if(r[1]===email&&r[4]==='active'){
      table_('_Sessions').getRange(i+2,5).setValue('revoked');
      if(r[2])clearSessionCredentials_(r[2]);revoked++;
      clearSessionDevice_(r[0]);
    }});
    if(revoked)audit_(email,'SESSION_REPLACED','sessions','',null,{revoked,reason:'google-reauthenticated'});
  }
  const token=randomSecret_(),signingKey=randomSecret_(),expires=new Date(Date.now()+2*3600000).toISOString();
  props_().setProperty(binding,hash_(subject));
  storeSessionCredentials_(token,{signingKey,expires,fingerprint:authConfig_().fingerprint});
  const id=uid_();append_('_Sessions',[id,email,hash_(token),expires,'active',now_()]);recordSessionDevice_(id,deviceLabel_(deviceLabel),expires);
  audit_(email,'LOGIN','sessions',id,null,{expires,deviceLabel:deviceLabel_(deviceLabel),deviceSource:'client-declared'});return {token,signingKey,user:{email,role:user.role},expires};
}
function authenticate_(token){
  authConfig_();
  if(typeof token!=='string'||token.length<32||token.length>150)throw new Error('AUTH: Cần đăng nhập');
  const session=rowsPlain_('_Sessions').find(r=>r[2]===hash_(token)&&r[4]==='active'&&Date.parse(r[3])>Date.now());
  const credentials=sessionCredentials_(token);
  if(!session||!credentials)throw new Error('AUTH: Phiên hết hạn hoặc bị thu hồi');

  if(Date.parse(credentials.expires)<=Date.now()||credentials.fingerprint!==authConfig_().fingerprint)throw new Error('AUTH: Phiên hết hạn hoặc cấu hình thay đổi');
  const user=users_().find(u=>u.email===session[1]&&u.enabled);if(!user)throw new Error('AUTH: Tài khoản bị khóa');if(!credentials.durable)storeSessionCredentials_(token,credentials);Object.defineProperty(user,'_sessionId',{value:session[0],enumerable:false});return user;
}
function logout_(user,token){
  const rows=rowsPlain_('_Sessions'),index=rows.findIndex(r=>r[2]===hash_(token));
  if(index>=0)table_('_Sessions').getRange(index+2,5).setValue('revoked');
  if(index>=0)clearSessionDevice_(rows[index][0]);
  clearSessionCredentials_(hash_(token));audit_(user.email,'LOGOUT','sessions','',null,null);return {loggedOut:true};
}
function verifyRequest_(action,args){
  const user=authenticate_(args.token),proof=args.proof;
  if(!proof||typeof proof.requestId!=='string'||!/^[\w-]{16,100}$/.test(proof.requestId)||!Number.isSafeInteger(proof.at)||Math.abs(Date.now()-proof.at)>60000||typeof proof.signature!=='string')throw new Error('AUTH: Thiếu chữ ký hoặc yêu cầu đã hết hạn');
  const credentials=sessionCredentials_(args.token);
  if(!credentials)throw new Error('AUTH: Khóa phiên đã hết hạn');
  const expected=Utilities.computeHmacSha256Signature(requestMessage(action,args),credentials.signingKey).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
  if(!constantEqual_(expected,proof.signature))throw new Error('AUTH: Chữ ký yêu cầu không hợp lệ');
  // Durable nonce ledger: CacheService eviction must never re-enable replay.
  const sheet=table_('_AuthRequests'),rows=rowsPlain_('_AuthRequests'),sessionHash=hash_(args.token);
  if(rows.some(r=>r[0]===sessionHash&&r[1]===proof.requestId))throw new Error('AUTH: Yêu cầu đã được sử dụng');
  // Delete adjacent expired nonces in batches, preserving every live replay guard.
  const cutoff=Date.now();
  for(let i=rows.length-1;i>=0;){
    if(!(Number(rows[i][2])<cutoff)){i--;continue;}
    const end=i;while(i>=0&&Number(rows[i][2])<cutoff)i--;
    sheet.deleteRows(i+3,end-i);
  }
  if(sheet.getLastRow()>5000)throw new Error('BUSY: Quá nhiều yêu cầu xác thực. Hãy thử lại');
  append_('_AuthRequests',[sessionHash,proof.requestId,Date.now()+120000]);touchSessionDevice_(user._sessionId);return user;
}
function admin_(user,args){
  requireAdmin_(user);
  if(args.operation==='list')return {users:users_().map(u=>({...u,row:undefined})),sessions:rowsPlain_('_Sessions').map(r=>{const meta=sessionDevice_(r[0]);return {id:r[0],email:r[1],expires:r[3],status:r[4]==='active'&&Date.parse(r[3])<=Date.now()?'expired':r[4],createdAt:r[5],deviceLabel:meta.deviceLabel||'Chưa có tên thiết bị',lastSeen:meta.lastSeen||r[5],deviceSource:'client-declared'};}),security:securityOverview_()};
  if(args.operation==='ackAlert')return acknowledgeSecurity_(user,args.id);
  if(args.operation==='revoke'){
    const row=rowsPlain_('_Sessions').findIndex(r=>r[0]===args.id);if(row<0)throw new Error('NOT_FOUND: Không tìm thấy phiên');
    const session=rowsPlain_('_Sessions')[row];table_('_Sessions').getRange(row+2,5).setValue('revoked');if(session[2])clearSessionCredentials_(session[2]);clearSessionDevice_(args.id);audit_(user.email,'REVOKE','sessions',args.id,null,null);return {revoked:true};
  }
  if(args.operation==='saveUser'){
    const email=String(args.email||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['admin','accountant','staff'].includes(args.role)||typeof args.enabled!=='boolean')throw new Error('VALIDATION: Tài khoản không hợp lệ');
    if(email===user.email && (args.role!=='admin'||!args.enabled))throw new Error('VALIDATION: Không tự hạ quyền hoặc khóa chính mình');
    const permissions=args.permissions||{};
    if(typeof permissions!=='object'||Array.isArray(permissions))throw new Error('VALIDATION: Quyền không hợp lệ');
    for(const [m,actions]of Object.entries(permissions)){
      if(m==='_routes'){
        if(!Array.isArray(actions)||actions.length>ROUTES.length||new Set(actions).size!==actions.length||actions.some(id=>!ROUTES.some(r=>r[0]===id)||(['admin','health'].includes(id)&&args.role!=='admin')))throw new Error('VALIDATION: Mục sidebar không hợp lệ');
      }else if(!Object.hasOwn(SCHEMA,m)||!Array.isArray(actions)||actions.some(a=>!ACTIONS.includes(a)))throw new Error('VALIDATION: Quyền không hợp lệ');
    }
    const old=users_().find(u=>u.email===email),row=[old?.recordId||uid_(),email,args.role,JSON.stringify(permissions),args.enabled,(Number(old?.permissionVersion)||0)+1];
    if(old)table_('_Users').getRange(old.row,1,1,row.length).setValues([row]);else append_('_Users',row);
    if(old&&(old.role!==args.role||!args.enabled))rowsPlain_('_Sessions').forEach((r,i)=>{if(r[1]===email&&r[4]==='active'){table_('_Sessions').getRange(i+2,5).setValue('revoked');if(r[2])clearSessionCredentials_(r[2]);clearSessionDevice_(r[0]);}});
    audit_(user.email,'USER_UPDATE','users',email,old,{role:args.role,enabled:args.enabled,permissions});bump_();return {saved:true};
  }
  throw new Error('VALIDATION: Thao tác quản trị không hợp lệ');
}

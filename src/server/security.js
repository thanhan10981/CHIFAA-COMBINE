// Security controls use server time. Client device names are informational only.
function storeSessionCredentials_(token,credentials){
  credentials={...credentials,durable:true};
  const h=hash_(token),now=Date.now();let index;try{index=JSON.parse(props_().getProperty('SESSION_KEY_INDEX')||'[]');}catch(_){throw new Error('CONFIG: Cần chủ sở hữu kiểm tra chỉ mục khóa phiên');}
  if(!Array.isArray(index)||index.some(r=>!r||!/^[a-f0-9]{64}$/.test(r.h)||!Number.isFinite(r.until)))throw new Error('CONFIG: Chỉ mục khóa phiên không hợp lệ');
  index=index.filter(r=>{if(r.until>now&&props_().getProperty('session-key:'+r.h))return r.h!==h;props_().deleteProperty('session-key:'+r.h);try{CacheService.getScriptCache().remove('session-key:'+r.h);}catch(_){}return false;});
  if(index.length>=80)throw new Error('SESSION: Đã đạt giới hạn khóa phiên; cần thu hồi phiên cũ hoặc chờ hết hạn');
  props_().setProperty('session-key:'+h,JSON.stringify(credentials));index.push({h,until:Date.parse(credentials.expires)});props_().setProperty('SESSION_KEY_INDEX',JSON.stringify(index));
  try{CacheService.getScriptCache().put('session-key:'+h,JSON.stringify(credentials),Math.max(1,Math.ceil((Date.parse(credentials.expires)-now)/1000)));}catch(_){/* Durable, owner-only credentials survive optional cache failure. */}
}
function sessionCredentials_(token){
  const key=sessionKey_(token);let raw;try{raw=CacheService.getScriptCache().get(key);}catch(_){}
  const parse=value=>{try{const c=JSON.parse(value||'null');return c&&/^[a-f0-9]{64}$/.test(c.signingKey)&&Number.isFinite(Date.parse(c.expires))&&typeof c.fingerprint==='string'?c:null;}catch(_){return null;}};
  let credentials=parse(raw);if(!credentials){credentials=parse(props_().getProperty(key));if(credentials&&Date.parse(credentials.expires)>Date.now())try{CacheService.getScriptCache().put(key,JSON.stringify(credentials),Math.max(1,Math.ceil((Date.parse(credentials.expires)-Date.now())/1000)));}catch(_){}}
  return credentials;
}
function clearSessionCredentials_(hash){props_().deleteProperty('session-key:'+hash);try{CacheService.getScriptCache().remove('session-key:'+hash);}catch(_){}}
function oauthStartRate_(){
  const limit=Number(props_().getProperty('OAUTH_STARTS_PER_MINUTE')||30);if(!Number.isInteger(limit)||limit<10||limit>120)throw new Error('CONFIG: OAUTH_STARTS_PER_MINUTE phải từ10đến120');
  const lock=LockService.getScriptLock();if(!lock.tryLock(100))throw new Error('BUSY: Đang xử lý đăng nhập. Thử lại sau ít giây');
  try{const window=Math.floor(Date.now()/60000);let state;try{state=JSON.parse(props_().getProperty('OAUTH_START_RATE')||'null');}catch(_){}if(!state||state.window!==window)state={window,count:0};if(state.count>=limit)throw new Error('RATE_LIMIT: Có quá nhiều yêu cầu đăng nhập. Thử lại sau một phút');state.count++;props_().setProperty('OAUTH_START_RATE',JSON.stringify(state));}finally{lock.releaseLock();}
}
function deviceLabel_(value){
  if(value==null||value==='')return 'Thiết bị web';if(typeof value!=='string'||value.length>100||/[\u0000-\u001f\u007f<>]/.test(value))throw new Error('VALIDATION: Tên thiết bị không hợp lệ');return value.trim()||'Thiết bị web';
}
function recordSessionDevice_(id,deviceLabel,expires){
  try{let index;try{index=JSON.parse(props_().getProperty('SESSION_DEVICE_INDEX')||'[]');if(!Array.isArray(index))index=[];}catch(_){index=[];}
    index=index.filter(r=>{if(Date.parse(r.expires)>Date.now()&&r.id!==id)return true;props_().deleteProperty('session-device:'+r.id);return false;});while(index.length>=80)props_().deleteProperty('session-device:'+index.shift().id);
    props_().setProperty('session-device:'+id,JSON.stringify({deviceLabel,lastSeen:now_(),expires,source:'client-declared'}));index.push({id,expires});props_().setProperty('SESSION_DEVICE_INDEX',JSON.stringify(index));
  }catch(_){/* Device hints must never bypass or break authenticated session issuance. */}
}
function sessionDevice_(id){try{return JSON.parse(props_().getProperty('session-device:'+id)||'{}');}catch(_){return {};}}
function touchSessionDevice_(id){try{const meta=sessionDevice_(id);if(!meta.expires||Date.now()-Date.parse(meta.lastSeen)<60000)return;props_().setProperty('session-device:'+id,JSON.stringify({...meta,lastSeen:now_()}));}catch(_){/* Session authority stays in _Sessions + signed credentials. */}}
function clearSessionDevice_(id){props_().deleteProperty('session-device:'+id);}
const SECURITY_ACTIONS=['LOGIN','LOGIN_DENIED','SESSION_REPLACED','OAUTH_DENIED','REVOKE','USER_UPDATE','RPC_DENIED'];
function securityOverview_(){
  const sheet=table_('_Audit'),last=sheet.getLastRow(),rows=last>1?profileValues_('_Audit',sheet.getRange(Math.max(2,last-999),1,Math.min(1000,last-1),8)):[],ack=new Set(rows.filter(r=>r[3]==='SECURITY_ACK').map(r=>r[5]));
  return {alerts:rows.filter(r=>SECURITY_ACTIONS.includes(r[3])).slice(-100).reverse().map(r=>({id:r[0],at:r[1],email:r[2],action:r[3],acknowledged:ack.has(r[0])})),window:1000,hasEarlier:last>1001};
}
function acknowledgeSecurity_(user,id){
  if(typeof id!=='string'||id.length>100)throw new Error('VALIDATION: Mã cảnh báo không hợp lệ');const rows=rowsPlain_('_Audit');if(!rows.some(r=>r[0]===id&&SECURITY_ACTIONS.includes(r[3])))throw new Error('NOT_FOUND: Không tìm thấy cảnh báo');
  if(!rows.some(r=>r[3]==='SECURITY_ACK'&&r[5]===id))audit_(user.email,'SECURITY_ACK','security',id,null,{acknowledgedAt:now_()});return {acknowledged:true};
}

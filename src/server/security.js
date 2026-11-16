// Security controls use server time. Client device names are informational only.
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

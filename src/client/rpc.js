import { requestMessage } from '../shared/auth-protocol.js';
import {sessionStore,validStoredSession} from './session-store.js';
let rpcSession=null;
let rpcScope=null;
const clientTimings=[];
const clientNow=()=>globalThis.performance?.now?.()??Date.now();
function noteTiming(name,start,status='ok'){clientTimings.push({name,ms:Math.round((clientNow()-start)*100)/100,status});if(clientTimings.length>100)clientTimings.shift();globalThis.CHIFAA_PERFORMANCE=clientTimings;}
function setRpcScope(scope){rpcScope=scope;}
async function restoreRpcSession(){
  const saved=await sessionStore(rpcScope,'get');
  if(!validStoredSession(saved)){if(saved)await sessionStore(rpcScope,'delete');return null;}
  try{await crypto.subtle.sign('HMAC',saved.key,new TextEncoder().encode('CHIFAA session restore check'));}
  catch(_){await sessionStore(rpcScope,'delete');return null;}
  rpcSession=saved;return {token:saved.token,expires:saved.expires};
}
const rpcPending=new Map();
const rpcReads=new Map();
let rpcActiveReads=0,rpcActiveBackground=0;
const rpcReadQueue=[];
function drainReadQueue(){
  while(rpcActiveReads<2&&rpcReadQueue.length){let i=rpcReadQueue.findIndex(e=>!e.background);if(i<0){if(rpcActiveBackground)return;i=0;}const e=rpcReadQueue.splice(i,1)[0];rpcActiveReads++;if(e.background)rpcActiveBackground++;
    const finish=(fn,value)=>{rpcActiveReads--;if(e.background)rpcActiveBackground--;fn(value);drainReadQueue();};
    try{Promise.resolve(e.run()).then(v=>finish(e.resolve,v),err=>finish(e.reject,err));}catch(err){finish(e.reject,err);}
  }
}
function queuedRead(run,background){return new Promise((resolve,reject)=>{rpcReadQueue.push({run,background,resolve,reject});drainReadQueue();});}
function rpcLoading(){
  const node=globalThis.document?.getElementById('network-status');
  if(!node)return;
  if(globalThis.document.getElementById('boot')?.hidden===false){node.hidden=true;return;}
  const active=Array.from(rpcPending.values());node.hidden=!active.length;
  node.textContent=active.at(-1)||'';
  globalThis.document.getElementById('record-form')?.setAttribute('aria-busy',String(active.includes('Đang lưu dữ liệu…')));
}
async function rpcCall(action,args={},options={}){
  const read=['publicAsset','bootstrap','list','lookup','record','summary','strategySummary','periodSummary','settlements','sync','workflowReports','workflowStatus','financialSummary','health','portalCatalog','portalStatus','kioskReport','orderPlans','requestStatus'].includes(action),key=read?JSON.stringify([action,args,options.timeout]):null;
  if(key&&rpcReads.has(key))return rpcReads.get(key);
  const task=read?queuedRead(()=>rpcPerform(action,args,options),options.background===true):rpcPerform(action,args,options);if(key){rpcReads.set(key,task);task.finally(()=>{if(rpcReads.get(key)===task)rpcReads.delete(key);}).catch(()=>{});}return task;
}
async function rpcPerform(action,args,options){
  const started=clientNow();let ok=false;
  const labels={requestStatus:'Đang kiểm tra kết quả lần ghi…',entry:'Đang lưu phiếu đã kiểm tra…',kiosk:'Đang ghi nghiệp vụ ki-ốt…',linkOrderPlan:'Đang liên kết đơn đã duyệt…',kioskReport:'Đang tải tồn ki-ốt…',orderPlans:'Đang tải kế hoạch liên kết…',oauthStart:'Đang chuẩn bị đăng nhập…',bootstrap:'Đang tải dữ liệu…',list:'Đang tải trang dữ liệu…',summary:'Đang tải báo cáo tổng hợp…',settlements:'Đang tải đối soát…',workflow:'Đang đối chiếu nghiệp vụ…',workflowReports:'Đang tải bản đã chốt…',workflowStatus:'Đang tải trạng thái vận hành…',financialSummary:'Đang đối chiếu số dư…',maintenance:'Đang xử lý bảo trì…',mutate:'Đang lưu dữ liệu…',admin:'Đang tải quản trị…',health:'Đang tải nhật ký…',export:'Đang xuất dữ liệu…',logout:'Đang đăng xuất…',portalCatalog:'Đang tải thực đơn…',portalOrder:'Đang gửi đơn hàng…',portalStatus:'Đang tra cứu đơn…'};
  const id=Symbol();if(labels[action]){rpcPending.set(id,labels[action]);rpcLoading();}
  try{const value=await rpcTransport(action,args,options);ok=true;return value;}finally{noteTiming('rpc:'+action,started,ok?'ok':'error');rpcPending.delete(id);rpcLoading();}
}
async function setRpcSession(login){
  rpcSession={token:login.token,expires:login.expires,key:await crypto.subtle.importKey('raw',new TextEncoder().encode(login.signingKey),{name:'HMAC',hash:'SHA-256'},false,['sign'])};
  delete login.signingKey;
  return await sessionStore(rpcScope,'put',rpcSession)===true;
}
function clearRpcSession({forget=true}={}){rpcSession=null;rpcReads.clear();for(const e of rpcReadQueue.splice(0))e.reject(Object.assign(new Error('Phiên đăng nhập đã thay đổi.'),{code:'AUTH'}));return forget?sessionStore(rpcScope,'delete'):Promise.resolve(null);}
async function rpcTransport(action, args = {}, { timeout = action==='maintenance'?180000:['bootstrap','workflow','mutate','entry','kiosk','linkOrderPlan','oauthFinish'].includes(action)?90000:60000 } = {}) {
  args=JSON.parse(JSON.stringify(args));
  if(args.token&&rpcSession?.token===args.token){
    args.proof={version:2,requestId:crypto.randomUUID(),at:Date.now()};
    const messageBytes=new TextEncoder().encode(requestMessage(action,args));
    if(action==='maintenance')args.proof.messageHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',messageBytes)),b=>b.toString(16).padStart(2,'0')).join('');
    const signature=await crypto.subtle.sign('HMAC',rpcSession.key,messageBytes);
    args.proof.signature=Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,'0')).join('');
  }
  // Keep signed JSON opaque to the Apps Script object bridge. ASCII escaping
  // also preserves Vietnamese, line endings and UTF-16 code units in source notes.
  const wireArgs=args.proof?JSON.stringify(args).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')):args;
  const transportStarted=clientNow();return new Promise((resolve,reject)=>{
    let settled=false;
    const reading=['publicAsset','bootstrap','list','lookup','record','summary','strategySummary','periodSummary','settlements','sync','health','financialSummary','workflowReports','workflowStatus','export','portalCatalog','portalStatus','kioskReport','orderPlans','requestStatus'].includes(action),connecting=['oauthStart','oauthFinish'].includes(action);
    const timer=setTimeout(()=>{settled=true;const e=new Error(reading?'Máy chủ đang phản hồi chậm khi tải dữ liệu. Phiên đăng nhập vẫn được giữ; bấm thử kết nối lại.':connecting?'Máy chủ chưa phản hồi bước xác thực. Thử kết nối lại để tiếp tục.':'Chưa nhận được xác nhận từ máy chủ. Kết quả ghi chưa rõ; thử lại cùng phiếu để kiểm tra.');e.code='TIMEOUT';reject(e);},timeout);
    if(!globalThis.google?.script?.run){clearTimeout(timer);reject(new Error('Trang này cần chạy trong Google Apps Script để kết nối Sheets.'));return;}
    google.script.run.withSuccessHandler(result=>{
      if(settled)return;settled=true;clearTimeout(timer);
      if(Number.isFinite(result?.meta?.serverMs)){noteTiming('server:'+action,clientNow()-result.meta.serverMs);noteTiming('transport-queue:'+action,clientNow()-Math.max(0,clientNow()-transportStarted-result.meta.serverMs));}
      if(result?.ok)resolve(result.data);else{const e=new Error(result?.error?.message||'Không thể xử lý yêu cầu');e.code=result?.error?.code;reject(e);}
    }).withFailureHandler(error=>{if(settled)return;settled=true;clearTimeout(timer);const e=new Error(error?.message||(reading||connecting?'Mất kết nối với máy chủ. Thử kết nối lại.':'Mất kết nối. Kết quả ghi chưa rõ.'));e.code='NETWORK';reject(e);}).rpc(action,wireArgs);
  });
}
export { rpcCall, setRpcSession, clearRpcSession, setRpcScope, restoreRpcSession,clientNow,noteTiming };

import {ensureExcelRuntime,createModuleWorkbook,downloadExcel} from './excel.js';
import { SCHEMA, ROUTES, ACTIONS } from '../shared/schema.js';
import { unitConversion, cleanRecord, sourceIssues, effective, flattenRecipe, costRecipe, salesMetrics, payroll, inventory, demand, report, scenario, variance, validDate, finance, targets, compareWeeks } from '../shared/domain.js';
import { rpcCall, setRpcSession, clearRpcSession, setRpcScope, restoreRpcSession,clientNow,noteTiming } from './rpc.js';
import { NAV_SECTIONS, NAV_ICONS } from './navigation.js';
import {createPermissionPicker} from './permissions.js';
import {canAccessPage,routeReadModules} from '../shared/access.js';
import {renderFinancialOperations,renderMaintenance,printBusinessDocument,printRecord,confirmedRollback} from './operations-view.js';
import {renderKiosk} from './kiosk-view.js';
import {openEntryCommand} from './entry-view.js';
import {openOrderPlan} from './order-planning-view.js';
import {renderStrategy,strategySelection} from './strategy-view.js';
import {toast,notifyError,clearToasts} from './notifications.js';
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(className)n.className=className;return n;};
const button=(text,fn,style='button')=>{const b=el('button',text,style);b.type='button';b.addEventListener('click',fn);return b;};
const dateToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function browserDeviceLabel(){const ua=globalThis.navigator?.userAgent||'',browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Trình duyệt',os=/Android/.test(ua)?'Android':/iPhone|iPad/.test(ua)?'iOS':/Windows/.test(ua)?'Windows':/Macintosh/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'Web';return browser+' · '+os;}
const display=v=>v==null||v===''?'—':typeof v==='number'?v.toLocaleString('vi-VN',{maximumFractionDigits:6}):typeof v==='boolean'?(v?'Có':'Không'):Array.isArray(v)?v.length+' thành phần':String(v);
const state={token:null,data:{},permissions:{},user:null,stamp:'',permissionVersion:null,demo:!globalThis.google?.script?.run&&new URLSearchParams(location.search).get('demo')==='1',from:dateToday(),to:dateToday(),route:'dashboard',search:'',busy:false,editor:null,uncertain:null,formKey:null};
const can=(m,a)=>state.permissions[m]?.includes(a);
function errorText(error){$('error').textContent=error.message||String(error);$('error').hidden=false;notifyError(error);}
function showBoot(message,error=false){
  $('login').hidden=true;$('workspace').hidden=true;$('boot').hidden=false;
  $('boot-status').textContent=message;$('boot').setAttribute('aria-busy',String(!error));
  $('boot').classList.toggle('has-error',error);$('boot-retry').hidden=!error;
  $('network-status').hidden=true;
}
function showLogin(){$('boot').hidden=true;$('login').hidden=false;}
$('boot-retry').onclick=()=>prepareLogin({resume:true});
async function call(action,args={},options={}){
  if(!state.demo)return rpcCall(action,{...args,token:state.token},options);
  if(action==='export')return {rows:state.data[args.module]||[]};
  if(action==='health')return {stamp:'LOCAL',audit:[],pending:[],lastScan:null,lastBackup:null};
  if(action==='admin')throw new Error('Quản trị tài khoản chỉ hoạt động trên Apps Script.');
  if(action==='mutate'){
    const rows=state.data[args.module],old=rows.find(r=>r.recordId===args.id);let row;
    if(args.operation==='delete')row={...old,deleted:true};
    else if(['approve','reject'].includes(args.operation))row={...old,status:args.operation==='approve'?'approved':'rejected'};
    else if(args.operation==='reverse')row={...old,recordId:crypto.randomUUID(),reverses:old.recordId};
    else row={...cleanRecord(args.module,args.record,state.data),recordId:old?.recordId||crypto.randomUUID(),deleted:false,reverses:''};
    row.version=(old?.version||0)+1;row.updatedAt=new Date().toISOString();row.updatedBy='LOCAL PREVIEW';row.source='DEMO';row._hash=crypto.randomUUID();
    const index=rows.findIndex(r=>r.recordId===row.recordId);if(index<0)rows.push(row);else rows[index]=row;
    if(args.module==='recipes')for(const r of effective(rows))flattenRecipe(r.recordId,1,rows);
    return {ids:[row.recordId],stamp:'LOCAL'};
  }
  return {};
}
async function load(force=false){
  if(state.demo)return;
  const token=state.token,b=await call('bootstrap',{force,shell:true});
  if(token!==state.token)throw Object.assign(new Error('Phiên đăng nhập đã thay đổi.'),{code:'AUTH'});
  const grantKey=JSON.stringify([b.user,b.permissions,b.permissionVersion]),same=state.grantKey===grantKey;
  if(!same&&state.grantKey){state.saving=false;state.pendingWorkflow=null;document.querySelectorAll("[data-private-dialog]").forEach(n=>n.remove());state.entryPending=null;state.orderPlanPending=null;state.kioskPending=null;state.uncertain=null;state.actionRetries=new Map();state.editor=null;if($('editor').open)$('editor').close();$('form-fields').replaceChildren();}
  const previous=state.data,previousPartial=state.partialModules||{},previousVersions=state.moduleVersions||{};
  if(!same||force){state.refMaps={};state.lookups={};state.lookupVersions={};state.lookupPending=new Map();state.pageRefresh=new Map();state.pageCache=new Map();state.summaryCache=new Map();state.strategyCache=new Map();state.strategyDom=new Map();state.strategyRenderedKey=null;state.dataEpoch=(state.dataEpoch||0)+1;}
  state.data=b.data;state.permissions=b.permissions;state.user=b.user;state.stamp=b.stamp;state.permissionVersion=b.permissionVersion;state.accountingApproved=b.accountingApproved;
  state.partialModules=b.partialModules||{};state.serverIssues=b.issues||[];
  if(same&&!force)for(const m of Object.keys(b.data))if(b.moduleVersions?.[m]===previousVersions[m]&&previous[m]&&!previousPartial[m]){state.data[m]=previous[m];delete state.partialModules[m];}
  state.moduleVersions=b.moduleVersions||{};state.grantKey=grantKey;state.grants=b.grants;state.forceModules=force?new Set(Object.keys(b.data)):new Set();state.forceSummary=force;
  validateData();
}
function validateData(){
  const local=sourceIssues(state.data,state.partialModules);
  state.issues=[...new Set([...(state.serverIssues||[]),...local].map(i=>i.module+' / '+(i.id||('dòng '+i.row))+': '+i.message))];
}
function navIcon(key){
  const span=el('span',null,'nav-icon'),ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  for(const [name,value]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(name,value);
  const shapes=key==='chevron'?[['path',{d:'m7 10 5 5 5-5'}]]:NAV_ICONS[key]||NAV_ICONS.dashboard;
  for(const [tag,attrs]of shapes){const shape=document.createElementNS(ns,tag);for(const [name,value]of Object.entries(attrs))shape.setAttribute(name,value);svg.append(shape);}span.append(svg);return span;
}
function nav(){
  const node=$('navigation'),scroll=node.scrollTop;node.replaceChildren();state.navOpen ||= new Set();
  const permitted=ROUTES.filter(([id])=>canAccessPage(state.user,state.permissions,id));
  if(state.navRoute!==state.route){const active=NAV_SECTIONS.find(section=>section[3].includes(state.route));if(active)state.navOpen.add(active[0]);state.navRoute=state.route;}
  const item=([id,title,target])=>{
    const a=el('a',null,'navitem');a.href='#'+id;a.append(navIcon(id),el('span',title,'nav-label'));
    if(id===state.route){a.classList.add('active');a.setAttribute('aria-current','page');}
    if(id==='catalog'&&can(target,'read'))a.append(el('small',effective(state.data.materials||[]).length,'nav-count'));
    return a;
  };
  node.append(el('div','KHÔNG GIAN LÀM VIỆC','menu-title'));
  for(const route of permitted.filter(([id])=>['dashboard','opsdashboard','strategy'].includes(id)))node.append(item(route));
  node.append(el('div','PHÂN HỆ CHIFAA','menu-title'));
  for(const [key,title,icon,ids]of NAV_SECTIONS){
    const routes=ids.map(id=>permitted.find(route=>route[0]===id)).filter(Boolean);if(!routes.length)continue;
    const open=state.navOpen.has(key),header=el('button',null,'navgroup'+(open?' is-open':'')),left=el('span',null,'navgroup-left'),children=el('div',null,'nav-children');
    header.type='button';header.setAttribute('aria-expanded',String(open));header.setAttribute('aria-controls','nav-'+key);
    left.append(navIcon(icon),el('span',title,'navgroup-label'));const chevron=navIcon('chevron');chevron.className='nav-chevron';header.append(left,chevron);
    children.id='nav-'+key;children.hidden=!open;for(const route of routes)children.append(item(route));
    header.addEventListener('click',()=>{const expanded=header.getAttribute('aria-expanded')!=='true';header.setAttribute('aria-expanded',String(expanded));header.classList.toggle('is-open',expanded);children.hidden=!expanded;if(expanded)state.navOpen.add(key);else state.navOpen.delete(key);});
    node.append(header,children);
  }
  node.scrollTop=scroll;
}
function mount(){
  $('boot').hidden=true;
  $('login').hidden=true;$('workspace').hidden=false;$('identity').textContent=state.user.email;
  $('connection').textContent=state.demo?'Xem thử · lưu trong RAM':'Đã kết nối Sheets';
  $('mode-banner').hidden=false;$('mode-banner').textContent=state.demo?'BẢN XEM THỬ · Dữ liệu chỉ tồn tại trong phiên trình duyệt, chưa kết nối Google Sheets.':state.accountingApproved?'Dữ liệu Google Sheets · Kiểm tra khoảng thời gian và độ đầy đủ trước khi sử dụng báo cáo.':'BẢN THỬ KỸ THUẬT · Quy tắc doanh thu, quyền truy cập và triển khai Google chưa nghiệm thu. Chưa dùng làm sổ kế toán chính thức.';
  route();
}
let viewGeneration=0;
function pageLoading(){const n=el('div',null,'loading-panel');n.setAttribute('role','status');n.append(el('span',null,'spinner'),el('span','Đang tải dữ liệu…'),el('div',null,'skeleton'));$('view').append(n);return n;}
function route(){
  const routeStarted=clientNow();
  if(state.route==='strategy'&&state.strategyRenderedKey&&$('view').classList.contains('strategy-page')){state.strategyDom||=new Map();rememberView(state.strategyDom,state.strategyRenderedKey,{nodes:[...$('view').childNodes],until:state.strategyRenderedUntil},4);state.strategyRenderedKey=null;}
  viewGeneration++;
  state.route=location.hash.slice(1)||ROUTES.find(([id])=>canAccessPage(state.user,state.permissions,id))?.[0]||'dashboard';const r=ROUTES.find(r=>r[0]===state.route)||ROUTES[0];state.route=r[0];
  $('breadcrumb').textContent=r[1];$('workspace').classList.remove('menu-open');$('view').replaceChildren();$('error').hidden=true;nav();
  const view=$('view');view.className='page-enter';
  const head=el('div',null,'page-head'),left=el('div');left.append(el('div','CHIFAA / KHÔNG GIAN VẬN HÀNH','eyebrow'),el('h2',r[1]),el('p','Dữ liệu theo phiên bản · Đối chiếu nguồn trước khi chốt'));head.append(left);view.append(head);
  const m=r[2];
  try{
    if(!canAccessPage(state.user,state.permissions,r[0]))throw new Error('Bạn chưa được cấp quyền truy cập mục này.');
    if(state.route==='kiosk'){renderKiosk();return;}
    if(state.route==='strategy'&&!state.demo){renderStrategyRemote();return;}
    if(m==='report'&&state.route!=='strategy'&&!state.demo){head.append(button('In báo cáo',()=>printBusinessDocument(r[1],$('view'))));renderDashboard();return;}
    if(['inventory','payroll','cost','demand','variance'].includes(m)&&!state.demo){if(m==='payroll'&&!state.payrollVisited){state.payrollVisited=true;const day=dateToday();state.from=day.slice(0,7)+'-01';state.to=new Date(Date.UTC(Number(day.slice(0,4)),Number(day.slice(5,7)),0)).toISOString().slice(0,10);}head.append(button('In báo cáo',()=>printBusinessDocument(r[1],$('view'))));renderPeriodSummary(m);return;}
    const needed=SCHEMA[m]?[]:routeReadModules(state.route).filter(id=>Object.hasOwn(state.data,id));if(state.route==='health'&&state.user.role==='admin')needed.push('stores');
    if(['loans','debts'].includes(m))needed.push(m);if(m==='debts'&&Object.hasOwn(state.data,'sales'))needed.push('sales');
    if(needed.some(id=>state.partialModules?.[id])){const generation=viewGeneration;pageLoading();ensureReadModules(needed,generation).then(ok=>{if(ok&&generation===viewGeneration)route();}).catch(e=>{if(generation===viewGeneration)errorText(e);});return;}
    head.append(button('In báo cáo',()=>printBusinessDocument(r[1],$('view'))));
    if(SCHEMA[m]){if(!can(m,'read'))throw new Error('Bạn chưa được cấp quyền đọc phân hệ này.');renderRecords(m,head);}
    else if(state.route==='strategy')renderStrategy();
    else if(m==='entry')renderEntry();
    else if(m==='admin')renderAdmin();
    else if(m==='health')renderHealth();
    else renderReport(m);
  }catch(e){errorText(e);}finally{noteTiming('route:'+state.route+':shell',routeStarted);}
}
async function ensureReadModules(modules,generation=viewGeneration){
  const stamp=state.stamp,token=state.token;
  for(const module of [...new Set(modules)]){
    if(!state.partialModules?.[module])continue;const rows=[];let offset=0;
    do{const page=await call('list',{module,mode:'snapshot',window:true,limit:200,offset,stamp,force:state.forceModules?.has(module)===true});if(generation!==viewGeneration||stamp!==state.stamp||token!==state.token)return false;rows.push(...page.rows);offset=page.next;}while(offset!=null);
    state.data[module]=rows;delete state.partialModules[module];
    state.forceModules?.delete(module);
  }validateData();return true;
}
function referenceRows(module){return !state.partialModules?.[module]?state.data[module]||[]:state.lookupVersions?.[module]===state.moduleVersions?.[module]?state.lookups?.[module]||[]:[];}
function lookupReady(module){return !state.partialModules?.[module]||state.lookupVersions?.[module]===state.moduleVersions?.[module];}
async function ensureLookupModules(modules,generation=viewGeneration){
  state.lookups||={};state.lookupVersions||={};state.lookupPending||=new Map();
  for(const module of [...new Set(modules)].filter(m=>can(m,'read')&&['materials','stores','dishes','employees','discounts','recipes'].includes(m))){
    if(lookupReady(module))continue;const version=state.moduleVersions?.[module],token=state.token,scope=state.grantKey,key=JSON.stringify([scope,module,version]);
    let task=state.lookupPending.get(key);if(!task){task=(async()=>{let offset=0;const rows=[];do{const page=await call('lookup',{module,offset,limit:200,stamp:state.stamp,force:offset===0&&state.forceModules?.has(module)===true},{background:true});if(token!==state.token||scope!==state.grantKey||version!==state.moduleVersions?.[module])return false;rows.push(...page.rows);offset=page.next;}while(offset!=null);state.lookups[module]=rows;state.lookupVersions[module]=version;return true;})();state.lookupPending.set(key,task);task.finally(()=>{if(state.lookupPending.get(key)===task)state.lookupPending.delete(key);}).catch(()=>{});}
    if(!await task)return false;if(generation!==viewGeneration)return false;
  }return true;
}
function period(){
  const bar=el('div',null,'toolbar');
  for(const [key,title]of [['from','Từ ngày'],['to','Đến ngày']]){
    const label=el('label',title),input=document.createElement('input');input.type='date';input.value=state[key];input.addEventListener('change',()=>{if(validDate(input.value)){state[key]=input.value;route();}});label.append(input);bar.append(label);
  }
  const select=document.createElement('select');select.setAttribute('aria-label','Khoảng thời gian');for(const [v,t]of [['','Chọn nhanh'],['day','Hôm nay'],['week','Tuần này'],['month','Tháng này'],['quarter','Quý này']]){const o=el('option',t);o.value=v;select.append(o);}
  select.onchange=()=>{const today=dateToday(),d=new Date(today+'T00:00:00Z');state.to=today;if(select.value==='week')d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));if(select.value==='month')d.setUTCDate(1);if(select.value==='quarter'){d.setUTCDate(1);d.setUTCMonth(Math.floor(d.getUTCMonth()/3)*3);}state.from=d.toISOString().slice(0,10);route();};bar.append(select);return bar;
}
function renderRecords(module,head){
  const schema=SCHEMA[module],view=$('view');if(can(module,'create'))head.append(button('+ Thêm phiếu',()=>openEditor(module), 'button primary'));
  if(schema.immutable&&can(module,'create')&&!state.demo)head.append(button('Nhập có kiểm tra',()=>openEntryCommand(module)));
  const bar=period(),search=document.createElement('input');search.type='search';search.placeholder='Tìm tên, mã hoặc ghi chú…';search.setAttribute('aria-label','Tìm dữ liệu');search.value=state.search;bar.append(search);
  if(can(module,'export'))bar.append(button('Xuất Excel',event=>exportModule(module,event.currentTarget)));view.append(bar);
  if(schema.immutable)view.append(el('div','Sổ giao dịch: phiếu đã lưu được giữ nguyên. Khi cần sửa, dùng “Đảo phiếu” và lập phiếu thay thế.','notice'));
  if(module==='sales')view.append(el('div','Điểm bán chịu là phần hàng được ghi nhận doanh thu nhưng chưa thu tiền. Hàng trả về được theo dõi riêng. Công thức doanh thu hiện chờ chủ dự án duyệt.','notice'));
  if(module==='cash')view.append(el('div','Tiền thu từ phiếu doanh thu đã được tính vào sổ tiền. Không ghi lại khoản đó ở đây. Các khoản thu / trả nợ, vay / trả vay cần ID liên kết.','notice'));
  if(['loans','debts','assets'].includes(module)&&(module==='assets'||state.data.cash)){
    const summary=finance(state.data,state.to)[module==='assets'?'depreciation':module];
    view.append(makeTable(module==='assets'?['Tài sản','Khấu hao / tháng','Lũy kế','Giá trị sổ']:['Đối tác','Giá trị gốc','Đã trả / thu','Còn lại','Quá hạn'],summary.map(r=>module==='assets'?[r.name,r.monthly,r.accumulated,r.bookValue]:[r.name,r.amount??r.principal,r.paid,r.remaining,r.overdue?'Quá hạn':'—'])));
  }
  if(['loans','debts'].includes(module)&&!state.data.cash&&!state.demo){const generation=viewGeneration,summary=el('div');view.append(summary);call('financialSummary',{module,to:state.to}).then(r=>{if(generation===viewGeneration)summary.replaceChildren(makeTable(['Đối tác','Gốc','Đã thu/trả','Còn lại','Quá hạn'],r.rows.map(x=>[x.name,x.amount??x.principal,x.paid,x.remaining,x.overdue?'Quá hạn':'—'])));}).catch(e=>{if(generation===viewGeneration)errorText(e);});}
  if(module==='loans')renderFinancialOperations('interest');if(module==='debts')renderFinancialOperations('debt');
  const filterRows=()=>{
    let rows=(state.data[module]||[]).filter(r=>!r.deleted);
    const kind={recipes:'mon',batches:'nhan-sot',rice:'com',packaging:'bao-bi'}[state.route];if(module==='recipes'&&kind)rows=rows.filter(r=>r.kind===kind);
    if(schema.fields.date)rows=rows.filter(r=>r.date>=state.from&&r.date<=state.to);
    if(search.value.trim())rows=rows.filter(r=>Object.values(r).some(v=>String(v).toLowerCase().includes(search.value.toLowerCase())));
    return rows;
  };
  const container=el('div');view.append(container);let offset=0,drawId=0,searchTimer;const generation=viewGeneration;
  const draw=async()=>{
    const drawStarted=clientNow();
    const drawVersion=++drawId;let rows,total,next,checking=false;
    if(state.demo){const all=filterRows();total=all.length;rows=all.slice(offset,offset+50);next=offset+50<total?offset+50:null;}
    else{const args={module,offset,limit:50,compact:module==='recipes',from:schema.fields.date?state.from:'',to:schema.fields.date?state.to:'',search:search.value,kind:module==='recipes'?{recipes:'mon',batches:'nhan-sot',rice:'com',packaging:'bao-bi'}[state.route]:undefined,stamp:state.stamp},key=pageCacheKey(module,args);state.pageCache||=new Map();const cached=state.pageCache.get(key);let page=cached&&!state.forceModules?.has(module)?cached.value:null;
      if(page&&cached.until<=Date.now()){checking=true;state.pageRefresh||=new Map();const refreshes=state.pageRefresh;if(!refreshes.has(key)){const token=state.token,version=state.moduleVersions?.[module],task=call('list',{...args,force:false},{background:true}).then(value=>{if(token!==state.token||version!==state.moduleVersions?.[module]||key!==pageCacheKey(module,args))return;rememberView(state.pageCache,key,{value,until:Date.now()+20000},20);if(generation===viewGeneration&&offset===args.offset&&search.value===args.search)draw();}).catch(e=>{if(generation===viewGeneration){const status=container.querySelector('.cache-refresh');if(status)status.textContent='Cache: '+e.message;errorText(e);}}).finally(()=>refreshes.delete(key));refreshes.set(key,task);}}
      try{if(!page){container.setAttribute('aria-busy','true');if(!container.children.length)container.append(el('div','Đang tải trang dữ liệu…','loading-panel is-loading'));page=await call('list',{...args,force:state.forceModules?.has(module)===true});if(generation!==viewGeneration||drawVersion!==drawId)return;rememberView(state.pageCache,key,{value:page,until:Date.now()+20000},20);state.forceModules?.delete(module);}({rows,total,next}=page);}catch(e){if(generation===viewGeneration&&drawVersion===drawId){errorText(e);}return;}finally{container.removeAttribute('aria-busy');}}
    const keys=Object.keys(schema.fields);
    const labels=keys.map(k=>schema.fields[k].label);labels.unshift('Mã / phiên bản');labels.push('Thao tác');
    const grid=makeTable(labels,rows.map(row=>{
      const id=el('div',String(row.recordId||'THIẾU ID').slice(0,8)+' · v'+row.version);id.title=row.recordId+'\n'+row.updatedAt+'\n'+row.updatedBy;
      id.dataset.recordId=row.recordId;
      const values=keys.map(k=>schema.fields[k].type==='lines'&&row._detailDeferred?(row.lineCount==null?'Xem chi tiết':row.lineCount+' thành phần'):refValue(schema.fields[k],row[k]));
      const actions=el('div',null,'actions');
      if(module==='orders'&&row.status==='approved'&&can('orders','approve')&&can('production','read')&&can('production','approve')&&!state.demo)actions.append(button('Liên kết kế hoạch',()=>openOrderPlan(row)));
      if(!row.reverses&&schema.immutable&&can(module,'create')&&(module!=='counts'||can(module,'approve'))&&!state.demo)actions.append(button('Bổ sung / điều chỉnh',()=>openEntryCommand(module,row)));
      if(!row.reverses&&!schema.immutable&&!(module==='orders'&&row.source==='PORTAL')&&can(module,'update'))actions.append(button('Sửa',()=>openEditor(module,row)));
      if(!row.reverses&&schema.immutable&&can(module,'approve'))actions.append(button('Đảo phiếu',()=>changeRecord(module,row,'reverse'),'button danger'));
      if(module==='orders'&&row.status==='pending'&&can(module,'approve'))actions.append(button('Duyệt',()=>changeRecord(module,row,'approve'),'button primary'));
      if(module==='orders'&&row.status==='pending'&&can(module,'approve'))actions.append(button('Từ chối',()=>changeRecord(module,row,'reject'),'button danger'));
      if(!schema.immutable&&can(module,'delete'))actions.append(button('Xóa',()=>changeRecord(module,row,'delete'),'button danger'));
      actions.append(button('Chi tiết',()=>showDetails(row,module)));
      actions.append(button('In phiếu',()=>withRecordDetails(module,row,full=>printRecord(module,full))));
      if(['production','counts'].includes(module)&&!row.reverses&&can(module,'approve')&&can('stock','create'))actions.append(button('Liên kết kho',async()=>{if(state.demo){toast('Liên kết kho cần máy chủ Apps Script.','info');return;}if(!confirm('Chỉ dùng cho phiếu cũ chưa liên kết. Xác nhận đối chiếu tránh xuất kho hai lần?'))return;try{await call('workflow',{kind:module==='production'?'production':'count',id:row.recordId,key:crypto.randomUUID()});await load(true);route();toast('Đã liên kết kho.');}catch(e){errorText(e);}}));
      return [id,...values,actions];
    }));const pager=el('div',null,'toolbar pagination'),prev=button('‹ Trang trước',()=>{offset=Math.max(0,offset-50);draw();}),more=button('Trang sau ›',()=>{offset=next;draw();});prev.disabled=offset===0;more.disabled=next==null;pager.append(prev,el('span',total?(offset+1)+'–'+(offset+rows.length)+' / '+total:'0 bản ghi','muted'),more);container.replaceChildren(grid,pager);if(checking)container.append(el('p','D? li?u cache ? ?ang ki?m tra c?p nh?t?','report-note cache-refresh'));noteTiming('ui:module:'+module,drawStarted);
  };search.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{offset=0;draw();},250);});draw();
  if(!state.demo){const refs=routeReadModules(state.route).filter(m=>m!==module);if(refs.some(m=>can(m,'read')&&!lookupReady(m)))ensureLookupModules(refs,generation).then(ok=>{if(ok&&generation===viewGeneration)draw();}).catch(()=>{/* Table stays usable with reference IDs; editor retries explicitly. */});}
}
function refValue(field,value){if(field.ref){state.refMaps||={};const rows=referenceRows(field.ref);if(state.refMaps[field.ref]?.rows!==rows)state.refMaps[field.ref]={rows,names:new Map(rows.map(r=>[r.recordId,r.name]))};return state.refMaps[field.ref].names.get(value)||value;}return display(value);}
function reportStamp(model){return el('p',model?.updatedAt?'Dữ liệu tổng hợp lúc '+new Date(model.updatedAt).toLocaleString('vi-VN')+' · Tự kiểm tra cập nhật; bản xem không dùng thay xác nhận chốt phiếu.':'Đang kiểm tra dữ liệu tổng hợp…','report-note');}
async function renderPeriodSummary(kind){
  const view=$('view'),generation=viewGeneration,token=state.token,stamp=state.stamp;view.append(period());if(kind==='cost')view.append(el('div','Giá vốn theo giá nhập gần nhất trước ngày kết thúc. Nếu chưa có lịch sử giá, hiển thị thiếu giá.','notice'));const initial=el('p','Đang tải dữ liệu tổng hợp…','loading-panel is-loading');view.append(initial);
  if(kind==='payroll'){const filters=el('div',null,'toolbar'),label=el('label','Bộ phận'),select=el('select');for(const v of ['','SX','BH','VP']){const o=el('option',v||'Tất cả');o.value=v;select.append(o);}select.value=state.payrollDepartment||'';select.onchange=()=>{state.payrollDepartment=select.value;route();};label.append(select);filters.append(label);view.append(filters);try{await ensureLookupModules(['employees'],generation);}catch(e){if(generation===viewGeneration)errorText(e);initial.remove();return;}if(generation!==viewGeneration||token!==state.token)return;renderFinancialOperations('payroll');}initial.remove();
  const holder=el('div');view.append(holder);let offset=0,drawId=0;state.summaryCache||=new Map();
  const draw=async()=>{const drawVersion=++drawId,args={kind,from:state.from,to:state.to,department:kind==='payroll'?state.payrollDepartment||'':'',reorder:state.route==='reorder',offset},key=JSON.stringify([state.grantKey,versionScope(routeReadModules(state.route)),state.dataEpoch,args]),cached=state.summaryCache.get(key);
    const paint=p=>{
      const headers={cost:['Công thức','Loại','Giá vốn','Dữ liệu giá'],demand:['Vật tư','Theo kế hoạch','Đơn đã duyệt (riêng)','Đơn vị'],variance:['Ngày','Vật tư','Thực tế dùng','Định mức','Chênh lệch','Chênh lệch (%)','Trạng thái'],payroll:['Nhân viên','Bộ phận','Giờ','Lương giờ','Phụ cấp + hỗ trợ','Ứng','Trừ','Thực lĩnh'],inventory:['Vật tư','Đơn vị','Tồn sổ','Tối thiểu','Cần bổ sung','Trạng thái']};
      const rows=p.rows.map(r=>kind==='cost'?[r.name,r.kind,r.total,r.missing.length?'Thiếu giá: '+r.missing.join(', '):'Đủ lịch sử giá']:kind==='demand'?[r.name,r.planned,r.approved,r.unit]:kind==='variance'?[r.date,r.name,r.actual,r.theoretical,r.difference,r.percentage,r.status]:kind==='payroll'?[r.name,r.department,r.hours,r.base,r.allowances,r.advance,r.deduction,r.net]:[r.name,r.unit,r.balance,r.minimum,r.replenish,el('span',r.completeness,'pill '+r.status)]),pager=el('div',null,'toolbar pagination'),prev=button('‹ Trang trước',()=>{offset=Math.max(0,offset-100);draw();}),next=button('Trang sau ›',()=>{offset=p.next;draw();});prev.disabled=!offset;next.disabled=p.next==null;pager.append(prev,el('span',p.total?(offset+1)+'–'+(offset+p.rows.length)+' / '+p.total:'0 bản ghi','muted'),next);holder.replaceChildren(reportStamp(p.readModel),...(p.note?[el('p',p.note,'notice')]:[]),makeTable(headers[kind],rows),pager);
    };
    if(cached){paint(cached.value);if(cached.until>Date.now()&&!state.forceSummary)return;}const loading=el('p',cached?'Đang kiểm tra cập nhật…':'Đang tải dữ liệu tổng hợp…','loading-panel is-loading');holder.append(loading);
    try{const value=await call('periodSummary',{...args,force:state.forceSummary===true});if(token!==state.token||generation!==viewGeneration||stamp!==state.stamp||drawVersion!==drawId)return;rememberView(state.summaryCache,key,{value,until:Date.now()+20000});state.forceSummary=false;paint(value);}catch(e){if(generation===viewGeneration)errorText(e);}finally{loading.remove();}
  };draw();
}
function makeTable(headers,rows){
  const card=el('div',null,'card');if(!rows.length){const empty=el('div',null,'empty');empty.append(el('strong','Chưa có dữ liệu trong phạm vi này'),el('span','Thêm phiếu mới hoặc chọn lại khoảng thời gian để xem dữ liệu.'));card.append(empty);return card;}
  const wrap=el('div',null,'table-wrap'),table=el('table'),thead=el('thead'),hr=el('tr');headers.forEach(h=>hr.append(el('th',h)));thead.append(hr);table.append(thead);const body=el('tbody');
  for(const row of rows){const tr=el('tr');for(const value of row){const td=el('td');if(value instanceof Node)td.append(value);else{td.textContent=display(value);if(typeof value==='number')td.classList.add('numeric');}tr.append(td);}body.append(tr);}table.append(body);wrap.append(table);card.append(wrap);return card;
}
async function withRecordDetails(module,row,then){
  if(!row._detailDeferred||state.demo){then(row);return;}
  const token=state.token,generation=viewGeneration;toast('Đang tải chi tiết phiếu…','info');
  try{const result=await call('record',{module,id:row.recordId,force:true});if(token!==state.token||generation!==viewGeneration)return;then(result.row);}catch(e){errorText(e);}
}
function showDetails(row,module){
  if(row._detailDeferred&&!state.demo){withRecordDetails(module,row,full=>showDetails(full,module));return;}
  const fields=$('form-fields');fields.replaceChildren();$('form-title').textContent='Chi tiết · '+SCHEMA[module].title;
  const pre=el('pre',JSON.stringify(row,null,2),'json-view field full');fields.append(pre);$('submit-record').hidden=true;$('form-error').hidden=true;state.editor=null;$('editor').showModal();
}
function openEditor(module,row){
  if(row?._detailDeferred&&!state.demo){withRecordDetails(module,row,full=>openEditor(module,full));return;}
  if(state.saving){if(state.editor)$('editor').showModal();toast('Phiếu đang chờ máy chủ xác nhận.','info');return;}
  if(state.uncertain){const pending=state.uncertain;state.uncertain=null;openEditor(pending.module,pending.operation==='update'?{recordId:pending.id,version:pending.expectedVersion,_hash:pending.expectedHash,...pending.record}:undefined);state.uncertain=pending;state.formKey=pending.key;
    for(const [k,f]of Object.entries(SCHEMA[pending.module].fields)){if(f.type==='lines'){const holder=$('form-fields').querySelector('[data-field="'+k+'"]');for(const line of [...holder.querySelectorAll('.recipe-line')])line.remove();for(const line of pending.record[k]||[])addRecipeLine(holder,line);}else{const input=$('form-fields').querySelector('[name="'+k+'"]');if(f.type==='boolean')input.checked=pending.record[k]===true;else input.value=pending.record[k]??'';}}
    for(const input of $('form-fields').querySelectorAll('input,select,button'))input.disabled=true;$('submit-record').textContent='Kiểm tra lại cùng phiếu';toast('Kết quả phiếu trước chưa rõ. Kiểm tra lại cùng phiếu trước khi nhập phiếu mới.','warning');return;}
  const refs=routeReadModules(ROUTES.find(r=>r[2]===module)?.[0]).filter(m=>m!==module);if(module==='recipes')refs.push('recipes');
  if(!state.demo&&refs.some(m=>can(m,'read')&&!lookupReady(m))){const token=state.token,generation=viewGeneration;state.editor=null;$('form-fields').replaceChildren(el('div','Đang tải danh mục cần cho phiếu…','loading-panel is-loading'));$('submit-record').hidden=true;$('editor').showModal();ensureLookupModules(refs,generation).then(ok=>{if(ok&&token===state.token&&generation===viewGeneration&&$('editor').open)openEditor(module,row);}).catch(e=>{$('form-error').textContent=e.message;$('form-error').hidden=false;notifyError(e);});return;}
  state.editor={module,row};state.formKey=crypto.randomUUID();state.uncertain=null;$('form-fields').replaceChildren();$('form-error').hidden=true;$('submit-record').hidden=false;$('submit-record').textContent='Lưu phiếu';$('form-title').textContent=(row?'Sửa · ':'Thêm · ')+SCHEMA[module].title;
  for(const [key,f]of Object.entries(SCHEMA[module].fields)){
    const label=el('label',f.label+(f.required?' *':''),'field');let input;
    if(f.type==='lines'){
      label.classList.add('full');const holder=el('div');holder.dataset.field=key;
      for(const line of row?.[key]||[])addRecipeLine(holder,line);
      holder.append(button('+ Thêm thành phần',()=>addRecipeLine(holder)));label.append(holder);$('form-fields').append(label);continue;
    }
    if(['ref','select'].includes(f.type)){
      input=document.createElement('select');const empty=el('option','Chọn…');empty.value='';input.append(empty);
      const options=f.ref?effective(referenceRows(f.ref)).map(r=>[r.recordId,r.name]):f.options.map(v=>[v,v]);
      for(const [id,title]of options.filter(([id])=>!(module==='cash'&&key==='category'&&['lai-vay','luong-thuong'].includes(id)))){const o=el('option',title);o.value=id;input.append(o);}
    }else{input=document.createElement('input');input.type=f.type==='boolean'?'checkbox':['number','date','time'].includes(f.type)?f.type:'text';if(f.type==='number'){input.step='any';if(f.min!=null)input.min=f.min;if(f.max!=null)input.max=f.max;}}
    input.name=key;input.required=f.required&&f.type!=='boolean';if(f.type==='boolean')input.checked=row?.[key]===true;else input.value=row?.[key]??(f.type==='date'?dateToday():f.type==='number'&&f.required?0:'');
    if(key==='yield'&&!row)input.value=1;if(key==='conversion'&&!row)input.value=1;
    if(module==='recipes'&&key==='kind'&&!row)input.value=({recipes:'mon',batches:'nhan-sot',rice:'com',packaging:'bao-bi'})[state.route]||'mon';
    if(module==='orders'&&key==='status'){input.value=row?.status||'pending';input.disabled=true;}
    label.append(input);$('form-fields').append(label);
  }
  if(!row)wireSnapshotDefaults(module);
  if(module==='materials'){
    const input=key=>$('form-fields').querySelector('[name="'+key+'"]'),hint=el('p',null,'notice field full'),update=()=>{const u=unitConversion(input('purchaseUnit').value,input('unit').value);hint.textContent=u.expected!=null?'Quy đổi đơn vị chuẩn: 1 '+input('purchaseUnit').value+' = '+u.expected+' '+input('unit').value+'. Hiệu suất nấu/chế biến đặt ở công thức riêng.':u.known?'Khối lượng và thể tích cần quy cách được xác nhận; không đổi trực tiếp.':'Bao/can/túi/chai: nhập hệ số theo đúng quy cách thực tế. Hệ thống không tự dùng hệ số ví dụ.';};
    for(const key of ['purchaseUnit','unit','conversion'])input(key).addEventListener('input',update);$('form-fields').append(hint);update();
  }
  $('editor').showModal();
}
function wireSnapshotDefaults(module){
  const input=key=>$('form-fields').querySelector('[name="'+key+'"]');
  const put=(key,value)=>{if(value!==undefined&&value!==null&&value!=='')input(key).value=value;};
  if(module==='sales'){
    const update=()=>{
      const dish=effective(referenceRows('dishes')).find(r=>r.recordId===input('dishId').value);
      input('price').value=dish?.price??'';
      const discounts=effective(referenceRows('discounts')).filter(r=>r.storeId===input('storeId').value&&r.dishId===input('dishId').value);
      input('discount').value=discounts.length===1?discounts[0].rate:'';
      input('recoveryPrice').value=discounts.length===1?discounts[0].recoveryPrice:'';
    };
    input('dishId').addEventListener('change',update);input('storeId').addEventListener('change',update);
  }
  if(module==='attendance')input('employeeId').addEventListener('change',()=>{
    const employee=effective(referenceRows('employees')).find(r=>r.recordId===input('employeeId').value);
    if(employee){put('hourlyRate',employee.hourlyRate);put('department',employee.department);put('defaultAllowance',employee.allowance);}
  });
}
function addRecipeLine(holder,line={type:'material',id:'',quantity:1}){
  const wrap=el('div',null,'recipe-line'),type=document.createElement('select'),id=document.createElement('select'),quantity=document.createElement('input');
  for(const [value,title]of [['material','Vật tư'],['recipe','Công thức']]){const o=el('option',title);o.value=value;type.append(o);}type.value=line.type;
  type.setAttribute('aria-label','Loại thành phần');id.setAttribute('aria-label','Thành phần');quantity.setAttribute('aria-label','Định lượng');
  const options=()=>{id.replaceChildren();const empty=el('option','Chọn thành phần');empty.value='';id.append(empty);for(const r of effective(referenceRows(type.value==='recipe'?'recipes':'materials'))){const o=el('option',r.name);o.value=r.recordId;id.append(o);}};options();id.value=line.id;type.onchange=options;
  type.dataset.part='type';id.dataset.part='id';quantity.dataset.part='quantity';id.required=true;quantity.type='number';quantity.min='0.000001';quantity.step='any';quantity.required=true;quantity.value=line.quantity;
  wrap.append(type,id,quantity,button('×',()=>wrap.remove(),'icon-button'));holder.insertBefore(wrap,holder.lastElementChild?.tagName==='BUTTON'?holder.lastElementChild:null);
}
function formRecord(module){
  const result={};for(const [key,f]of Object.entries(SCHEMA[module].fields)){
    if(f.type==='lines'){result[key]=[...$('form-fields').querySelectorAll('.recipe-line')].map(line=>({type:line.querySelector('[data-part=type]').value,id:line.querySelector('[data-part=id]').value,quantity:Number(line.querySelector('[data-part=quantity]').value)}));continue;}
    const input=$('record-form').elements.namedItem(key);result[key]=f.type==='boolean'?input.checked:f.type==='number'?(input.value===''?'':Number(input.value)):input.value;
  }return result;
}
$('record-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!state.editor||state.saving)return;const {module,row}=state.editor,token=state.token,scope=state.grantKey,fields=[...$('form-fields').querySelectorAll('input,select,button')].map(input=>[input,input.disabled]);let submitted,confirmed=false;
  state.saving=true;$('submit-record').disabled=true;$('submit-record').textContent='Đang lưu…';$('submit-record').classList.add('is-loading');$('form-error').hidden=true;
  try{
    const record=state.uncertain?.record||formRecord(module);
    const request=state.uncertain||{module,operation:row?'update':'create',id:row?.recordId,expectedVersion:row?.version,expectedHash:row?._hash,record,key:state.formKey};
    submitted=JSON.parse(JSON.stringify(request));for(const [input]of fields)input.disabled=true;
    await call('mutate',submitted);confirmed=true;if(token!==state.token||scope!==state.grantKey)return;state.uncertain=null;$('editor').close();toast(state.demo?'Đã lưu trong RAM bản xem thử.':'Máy chủ đã xác nhận lưu phiếu.');await load();validateData();route();
  }catch(e){
    if(token!==state.token||scope!==state.grantKey)return;
    if(confirmed){errorText(new Error('Phiếu đã lưu thành công; chưa tải được dữ liệu mới. Bấm Đồng bộ để cập nhật.'));return;}
    $('form-error').textContent=e.message;$('form-error').hidden=false;
    const rolledBack=e.code==='RECOVERY'&&submitted&&await confirmedRollback(submitted.key);if(token!==state.token||scope!==state.grantKey)return;
    if(rolledBack){
      state.uncertain=null;state.formKey=crypto.randomUUID();for(const pair of fields)pair[1]=module==='orders'&&pair[0].name==='status';$('submit-record').textContent='Kiểm tra và lưu lại';$('form-error').textContent='Máy chủ xác nhận đã hoàn tác lần ghi. Nội dung nhập vẫn giữ; kiểm tra rồi bấm lưu nếu cần.';toast('Lần ghi trước đã được hoàn tác, chưa có phiếu mới.','warning');return;
    }
    notifyError(e);
    if(['TIMEOUT','NETWORK'].includes(e.code)){
      state.uncertain ||= submitted;
      $('submit-record').textContent='Kiểm tra lại cùng phiếu';for(const input of $('form-fields').querySelectorAll('input,select,button'))input.disabled=true;
    }else{state.formKey=crypto.randomUUID();$('submit-record').textContent='Lưu lại phiếu';}
  }finally{if(token===state.token&&scope===state.grantKey){state.saving=false;$('submit-record').disabled=false;$('submit-record').classList.remove('is-loading');if(!state.uncertain)for(const [input,disabled]of fields)input.disabled=disabled;}}
});
async function changeRecord(module,row,operation){
  const title=operation==='reverse'?'Đảo phiếu này? Phiếu gốc vẫn được lưu trong nhật ký.':operation==='delete'?'Xóa bản ghi này?':operation==='reject'?'Từ chối đơn này?':'Duyệt đơn này để đưa vào nhu cầu nguyên liệu?';
  if(!confirm(title))return;
  if(state.saving){toast('Một phiếu khác đang chờ xác nhận. Bạn vẫn có thể xem các phân hệ.','info');return;}
  state.actionRetries||=new Map();const key=module+':'+row.recordId+':'+operation,request=state.actionRetries.get(key)||{module,operation,id:row.recordId,expectedVersion:row.version,expectedHash:row._hash,key:crypto.randomUUID()},node=[...$('view').querySelectorAll('[data-record-id]')].find(n=>n.dataset.recordId===row.recordId),pending=el('span','Đang xử lý…','pill orange'),token=state.token;let confirmed=false;
  node?.append(pending);node?.closest('tr')?.classList.add('pending-row');state.saving=true;
  try{await call('mutate',request);confirmed=true;state.actionRetries.delete(key);if(token!==state.token)return;toast('Đã nhận xác nhận.');await load();route();}catch(e){if(token!==state.token)return;if(!confirmed&&['TIMEOUT','NETWORK'].includes(e.code))state.actionRetries.set(key,request);if(confirmed)errorText(new Error('Phiếu đã cập nhật thành công; bấm Đồng bộ để tải dữ liệu mới.'));else errorText(e);}finally{if(token===state.token)state.saving=false;pending.remove();node?.closest('tr')?.classList.remove('pending-row');}
}
function closeEditor(){if(state.uncertain&&!confirm('Kết quả ghi chưa rõ. Bạn có thể dùng Đồng bộ để kiểm tra phiếu trước khi nhập lại. Đóng cửa sổ?'))return;$('editor').close();}
$('close-editor').onclick=closeEditor;$('cancel-editor').onclick=closeEditor;
function requireData(modules){const missing=modules.filter(m=>!Object.hasOwn(state.data,m));if(missing.length)throw new Error('Cần quyền đọc: '+missing.map(m=>SCHEMA[m].title).join(', '));if(state.issues?.length)throw new Error('Dữ liệu nguồn cần sửa trước khi tính báo cáo:\n'+state.issues.slice(0,8).join('\n'));}
function rememberView(cache,key,value,limit=12){cache.delete(key);cache.set(key,value);while(cache.size>limit)cache.delete(cache.keys().next().value);}
function versionScope(modules){return Object.fromEntries(modules.filter(m=>can(m,'read')).map(m=>[m,state.moduleVersions?.[m]]));}
function strategyVersions(){return versionScope(['sales','production','attendance','cash','recipes','materials','stock','stores','dishes']);}
function strategyViewCacheKey(selection=strategySelection()){return JSON.stringify([state.grantKey,strategyVersions(),state.dataEpoch,selection]);}
async function renderStrategyRemote(){
  const renderStarted=clientNow();
  const selection=strategySelection(),generation=viewGeneration,token=state.token,stamp=state.stamp,request=(state.strategyRequest||0)+1;state.strategyRequest=request;state.strategyCache||=new Map();
  const view=$('view'),domKey=strategyViewCacheKey(selection),dom=state.strategyDom?.get(domKey),key=JSON.stringify([state.grantKey,strategyVersions(),state.dataEpoch,selection.period,selection.anchor]),entry=state.strategyCache.get(key);
  const paint=value=>{renderStrategy(value);view.append(reportStamp(value.readModel));state.strategyRenderedKey=domKey;state.strategyRenderedUntil=Date.now()+20000;noteTiming('ui:strategy-ready',renderStarted);};
  if(dom?.until>Date.now()&&!state.forceSummary){view.replaceChildren(...dom.nodes);view.classList.add('strategy-page');state.strategyRenderedKey=domKey;state.strategyRenderedUntil=dom.until;noteTiming('ui:strategy-dom',renderStarted);return;}
  if(entry){paint(entry.value);if(entry.until>Date.now()&&!state.forceSummary){state.strategyRenderedUntil=entry.until;return;}}
  const loading=pageLoading();
  try{const value=await call('strategySummary',{period:selection.period,anchor:selection.anchor,force:state.forceSummary===true});if(generation!==viewGeneration||token!==state.token||stamp!==state.stamp||request!==state.strategyRequest)return;rememberView(state.strategyCache,key,{value,until:Date.now()+20000});state.forceSummary=false;paint(value);}
  catch(e){if(generation===viewGeneration&&request===state.strategyRequest)errorText(e);}finally{loading.remove();}
}
function pageCacheKey(module,args){return JSON.stringify([state.grantKey,state.moduleVersions?.[module]||state.stamp,state.dataEpoch,module,args.offset,args.limit,args.from||'',args.to||'',args.search||'',args.kind||'']);}
function prefetchCatalog(generation){
  if(state.demo||!state.token||state.prefetchBusy||document.hidden)return;
  const module=state.route==='catalog'?'stores':'materials',route=module==='stores'?'stores':'catalog';if(!can(module,'read')||!canAccessPage(state.user,state.permissions,route))return;
  const run=async()=>{if(generation!==viewGeneration||state.busy||state.prefetchBusy||document.hidden)return;const token=state.token,scope=state.grantKey,args={module,offset:0,limit:50,from:'',to:'',search:'',stamp:state.stamp},key=pageCacheKey(module,args);state.pageCache||=new Map();if(state.pageCache.get(key)?.until>Date.now())return;state.prefetchBusy=true;
    try{const value=await call('list',args,{background:true});if(token===state.token&&scope===state.grantKey&&key===pageCacheKey(module,args))rememberView(state.pageCache,key,{value,until:Date.now()+20000},20);}catch(_){/* Speculative reads never interrupt the active view. */}finally{state.prefetchBusy=false;}};
  if(window.requestIdleCallback)window.requestIdleCallback(run,{timeout:2000});else setTimeout(run,500);
}
async function renderDashboard(){
  const renderStarted=clientNow();
  const view=$('view'),generation=viewGeneration,token=state.token,stamp=state.stamp,from=state.from,to=state.to,compare=state.route==='opsdashboard';
  state.summaryCache||=new Map();const key=JSON.stringify([state.grantKey,versionScope(['sales','production','attendance','cash','recipes','materials','stock','stores','dishes','plans']),from,to,compare,state.dataEpoch]),entry=state.summaryCache.get(key);
  const paint=summary=>{while(view.children.length>1)view.lastElementChild.remove();renderReport('report',summary);view.append(reportStamp(summary.readModel));noteTiming('ui:dashboard-ready',renderStarted);};
  if(entry){paint(entry.value);if(entry.until>Date.now()&&!state.forceSummary){prefetchCatalog(generation);return;}}
  const loading=entry?el('p','Đang cập nhật dữ liệu…','muted is-loading'):pageLoading();if(entry)view.append(loading);
  try{const value=await call('summary',{from,to,compare,force:state.forceSummary===true});if(generation!==viewGeneration||token!==state.token||stamp!==state.stamp)return;
    rememberView(state.summaryCache,key,{value,until:Date.now()+20000});state.forceSummary=false;paint(value);prefetchCatalog(generation);
  }catch(e){if(generation===viewGeneration)errorText(e);}finally{loading.remove();}
}
function renderSettlements(initial,view){
  const root=el('div'),generation=viewGeneration,from=state.from,to=state.to,stamp=state.stamp;view.append(root);
  const paint=page=>{const table=makeTable(['Ngày','Điểm bán','Món','Giao','Bán','Trả','Điểm bán chịu','Doanh thu thuần','Thực thu','Thiếu / thừa'],page.rows.map(s=>[s.date,s.storeName,s.dishName,s.delivered,s.sold,s.returned,s.creditQty,s.netRevenue,s.received,s.collectionDifference]));
    const pager=el('div',null,'toolbar pagination'),loadPage=async(offset,control)=>{control.disabled=true;control.classList.add('is-loading');try{const value=await call('settlements',{from,to,offset});if(generation===viewGeneration&&stamp===state.stamp)paint(value);}catch(e){if(generation===viewGeneration)errorText(e);}finally{control.disabled=false;control.classList.remove('is-loading');}};
    const prev=button('‹ Trang trước',e=>loadPage(Math.max(0,page.offset-100),e.currentTarget)),next=button('Trang sau ›',e=>loadPage(page.next,e.currentTarget));prev.disabled=page.offset===0;next.disabled=page.next==null;pager.append(prev,el('span',page.total?(page.offset+1)+'–'+(page.offset+page.rows.length)+' / '+page.total:'0 bản ghi','muted'),next);root.replaceChildren(table,pager);
  };paint(initial);
}
function renderReport(kind,summary){
  const view=$('view');view.append(period());
  if(kind==='inventory'){
    requireData(['materials','stock']);const rows=inventory(state.data,state.to).filter(r=>state.route!=='reorder'||r.replenish>0||r.status==='gray');
    view.append(makeTable(['Vật tư','Đơn vị','Tồn sổ','Tối thiểu','Cần bổ sung','Trạng thái'],rows.map(r=>[r.name,r.unit,r.balance,r.minimum,r.replenish,el('span',r.completeness,'pill '+r.status)])));return;
  }
  if(kind==='cost'){
    requireData(['materials','recipes','stock']);view.append(el('div','Giá vốn theo giá nhập gần nhất trước ngày kết thúc. Nếu chưa có lịch sử giá, hiển thị thiếu giá.','notice'));
    const rows=effective(state.data.recipes).map(r=>{const c=costRecipe(r.recordId,1,state.data,state.to);return [r.name,r.kind,c.total,c.missing.length?'Thiếu giá: '+c.missing.join(', '):'Đủ lịch sử giá'];});view.append(makeTable(['Công thức','Loại','Giá vốn / phần','Nguồn giá'],rows));return;
  }
  if(kind==='demand'){
    requireData(['materials','recipes','production','orders']);const d=demand(state.data,state.from,state.to);view.append(el('div',d.note+(d.missing.length?' Thiếu công thức: '+d.missing.join(', '):''),'notice'));
    view.append(makeTable(['Vật tư','Kế hoạch SX','Đơn đã duyệt (tách riêng)','Đơn vị'],effective(state.data.materials).filter(m=>d.planned[m.recordId]||d.approvedOrders[m.recordId]).map(m=>[m.name,d.planned[m.recordId]||0,d.approvedOrders[m.recordId]||0,m.unit])));return;
  }
  if(kind==='variance'){
    requireData(['counts','stock','production','recipes']);view.append(makeTable(['Ngày','Vật tư','Thực tế dùng','Lý thuyết','Chênh lệch','Chênh lệch (%)','Trạng thái'],variance(state.data,state.from,state.to).map(r=>[r.date,refValue({ref:'materials'},r.materialId),r.actual,r.theoretical,r.difference,r.percentage,r.status])));return;
  }
  if(kind==='payroll'){
    renderFinancialOperations('payroll');
    requireData(['attendance','employees']);const rows=payroll(state.data.attendance.filter(r=>r.date>=state.from&&r.date<=state.to));view.append(makeTable(['Nhân viên','Bộ phận','Giờ','Lương giờ','Phụ cấp + hỗ trợ','Ứng','Trừ','Thực lĩnh'],rows.map(r=>[refValue({ref:'employees'},r.employeeId),r.department,r.hours,r.base,r.allowances,r.advance,r.deduction,r.net])));return;
  }
  if(!summary)requireData(['sales','production','attendance','cash','recipes','materials','stock']);
  const r=summary?.report||report(state.data,state.from,state.to),stats=el('div',null,'stats');
  for(const [label,value,unit]of [['Doanh thu thuần · tạm tính',r.revenue,'đ'],['Tiền thực thu tại điểm bán',r.received,'đ'],['Sản lượng đạt',r.produced,'phần'],['Năng suất sản xuất',r.productivity,'tổng sản xuất / giờ SX']]){
    const s=el('div',null,'stat');s.append(el('label',label),el('strong',display(value)),el('small',value==null?'Chưa đủ dữ liệu':unit));stats.append(s);
  }view.append(stats);
  const grid=el('div',null,'grid-two'),chartCard=el('div',null,'card'),ch=el('div',null,'card-header');ch.append(el('h3','Doanh thu trong kỳ'),el('small',state.from+' → '+state.to));chartCard.append(ch);chartCard.append(revenueChart(summary?.series));
  const detail=el('div',null,'card pad');detail.append(el('h3','Độ đầy đủ & dòng tiền'));const list=el('div',null,'metric-list');
  for(const [label,value]of [['Ngày có doanh thu',r.coverage],['Tổng sản xuất (gồm sản xuất thêm)',display(r.totalProduced)],['Lỗi / hủy sản xuất',display(r.rejected)],['Giờ sản xuất',display(r.sxHours)],['Năng suất đạt / giờ SX',display(r.goodProductivity)],['Giá nguyên liệu đã dùng',display(r.cogs)],['Tiền mặt theo sổ',display(r.cash.cash)],['Chuyển khoản theo sổ',display(r.cash.bank)],['Kết quả tạm tính trước khấu hao',display(r.profit)]]){const line=el('div',null,'metric-line');line.append(el('span',label),el('strong',value));list.append(line);}detail.append(list);grid.append(chartCard,detail);view.append(grid);
  view.append(el('p','Nguồn: '+r.source+' · Kỳ '+r.from+' — '+r.to+' · '+r.completeness+'. Doanh thu thuần = hàng bán + hàng điểm bán chịu sau chiết khấu, trước chi phí. Hỗ trợ thu hồi là chi phí riêng; tiền thực thu và thu nợ cũ tách khỏi doanh thu. Lợi nhuận tạm tính chưa gồm khấu hao; lãi vay theo phiếu chi đã ghi.','report-note'));
  view.append(makeTable(['Chỉ tiêu','Tỷ lệ trên doanh thu thuần','Giới hạn'],[['Food cost',r.foodCostPct==null?'Chưa đủ dữ liệu':display(r.foodCostPct)+'%',display(r.policy.foodCostMax*100)+'%'],['Nhân sự sản xuất',r.sxLaborPct==null?'Chưa đủ dữ liệu':display(r.sxLaborPct)+'%',display(r.policy.productionLaborMax*100)+'%'],['Chi phí thu hồi',r.recoveryExpense==null?'Chưa đủ dữ liệu':display(r.recoveryExpense)+' đ','Hạch toán riêng, không giảm doanh thu']]));
  if(summary?.target||!summary&&state.data.plans){const target=summary?.target||targets(state.data,state.from,state.to);view.append(makeTable(['Doanh thu mục tiêu','Đạt (%)','Sản lượng mục tiêu','Đạt (%)','Ngân sách thưởng còn trong trần'],[[target.revenueTarget,target.revenuePercent,target.productionTarget,target.productionPercent,target.bonusAvailable]]),el('p',target.bonusRule,'report-note'));}
  if(state.route==='opsdashboard')view.append(el('h3','So sánh cùng thứ hai tuần'),makeTable(['Ngày tuần này','Ngày tuần trước','Doanh thu kỳ này','Doanh thu kỳ trước','Chênh lệch'],(summary?.weeks||compareWeeks(state.data,state.to)).map(w=>[w.date,w.previousDate,w.revenue,w.previousRevenue,w.difference])));
  if(state.route==='strategy')renderScenario();
  view.append(el('h3','Đối soát theo điểm bán'));if(summary){renderSettlements(summary.settlements,view);return;}view.append(makeTable(['Ngày','Điểm bán','Món','Giao','Bán','Trả','Điểm bán chịu','Doanh thu thuần','Thực thu','Thiếu / thừa'],effective(state.data.sales).filter(s=>s.date>=state.from&&s.date<=state.to).map(s=>{const m=salesMetrics(s);return [s.date,refValue({ref:'stores'},s.storeId),refValue({ref:'dishes'},s.dishId),s.delivered,s.sold,s.returned,s.creditQty,m.netRevenue,m.received,m.collectionDifference];})));
}
function revenueChart(series){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 680 215');svg.classList.add('chart');svg.setAttribute('role','img');svg.setAttribute('aria-label','Biểu đồ doanh thu theo ngày');
  const days={};for(const r of effective(state.data.sales||[]).filter(r=>r.date>=state.from&&r.date<=state.to))days[r.date]=(days[r.date]||0)+salesMetrics(r).netRevenue;
  const points=series||Object.entries(days).sort().slice(-31),max=Math.max(1,...points.map(p=>Math.abs(p[1])));
  if(!points.length){const t=document.createElementNS(ns,'text');t.setAttribute('x','240');t.setAttribute('y','100');t.textContent='Chưa có dữ liệu doanh thu';svg.append(t);return svg;}
  const width=600/points.length;points.forEach(([date,value],i)=>{const rect=document.createElementNS(ns,'rect'),height=Math.max(2,Math.abs(value)/max*135);rect.setAttribute('x',40+i*width);rect.setAttribute('y',value>=0?165-height:165);rect.setAttribute('width',Math.max(3,width-7));rect.setAttribute('height',value>=0?height:Math.min(22,height));rect.setAttribute('rx','4');rect.setAttribute('fill',value>=0?'#e97825':'#b33e36');const title=document.createElementNS(ns,'title');title.textContent=date+': '+display(value)+' đ';rect.append(title);svg.append(rect);if(points.length<12||i%4===0){const text=document.createElementNS(ns,'text');text.setAttribute('x',40+i*width);text.setAttribute('y','202');text.textContent=date.slice(5);svg.append(text);}});return svg;
}
function renderScenario(){
  const card=el('div',null,'card pad');card.append(el('h3','Kịch bản hòa vốn'));const bar=el('div',null,'toolbar'),inputs=[];
  for(const text of ['Giá bán / phần','Biến phí / phần','Định phí / kỳ','Sản lượng dự kiến']){const label=el('label',text),input=document.createElement('input');input.type='number';input.min=0;input.value=0;label.append(input);bar.append(label);inputs.push(input);}const output=el('p',null,'muted');const calc=()=>{try{const result=scenario(...inputs.map(i=>Number(i.value)));output.textContent='Lãi góp / phần: '+display(result.margin)+' · Hòa vốn: '+display(result.breakEven)+' phần · Kết quả dự kiến: '+display(result.profit)+' đ';}catch(e){output.textContent=e.message;}};inputs.forEach(i=>i.oninput=calc);card.append(bar,output);$('view').append(card);calc();
}
function renderEntry(){const grid=el('div',null,'quick-links');for(const [id,title]of ROUTES.filter(r=>r[0].startsWith('entry-')&&canAccessPage(state.user,state.permissions,r[0]))){const a=el('a',title);a.href='#'+id;grid.append(a);}$('view').append(grid);}
async function renderAdmin(){
  if(state.user.role!=='admin')throw new Error('Chỉ quản trị được truy cập.');const view=$('view');
  if(state.demo){view.append(el('div','Quản trị tài khoản và phiên đăng nhập chỉ hoạt động trên Apps Script.','notice'));return;}
  const generation=viewGeneration,loading=pageLoading();
  try{
    const data=await call('admin',{operation:'list'});if(generation!==viewGeneration)return;
    const form=el('form',null,'card pad');form.append(el('h3','Cấp / cập nhật tài khoản'));
    form.id='account-form';
    const grid=el('div',null,'form-grid'),email=el('input'),role=el('select'),enabled=el('input'),choose=el('select'),picker=createPermissionPicker();email.type='email';email.required=true;email.name='account-email';role.name='account-role';enabled.type='checkbox';enabled.checked=true;choose.name='account-select';
    for(const [value,title]of [['staff','Nhân viên'],['accountant','Kế toán'],['admin','Admin · Toàn quyền']]){const o=el('option',title);o.value=value;role.append(o);}
    const fresh=el('option','+ Tạo tài khoản mới');fresh.value='';choose.append(fresh);
    for(const user of data.users){const o=el('option',user.email);o.value=user.email;choose.append(o);}
    const selectUser=user=>{email.value=user?.email||'';email.readOnly=!!user;choose.value=user?.email||'';role.value=user?.role||'staff';enabled.checked=user?user.enabled:true;picker.load(user?.permissions||{});picker.setRole(role.value);};
    choose.addEventListener('change',()=>selectUser(data.users.find(u=>u.email===choose.value)));
    email.addEventListener('change',()=>{const user=data.users.find(u=>u.email.toLowerCase()===email.value.trim().toLowerCase());if(user)selectUser(user);});
    role.addEventListener('change',()=>picker.setRole(role.value));
    for(const [title,input]of [['Chọn tài khoản để chỉnh quyền',choose],['Email Google',email],['Vai trò',role],['Kích hoạt tài khoản',enabled]]){const label=el('label',title,'field');label.append(input);grid.append(label);}
    form.append(grid,el('h3','Chọn mục trên sidebar'),picker.root);const controls=el('div',null,'account-form-actions'),save=el('button','Lưu tài khoản','button primary');save.type='submit';controls.append(save,button('Tạo tài khoản mới',()=>selectUser(null)));form.append(controls);
    form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await call('admin',{operation:'saveUser',email:email.value,role:role.value,enabled:enabled.checked,permissions:picker.value()});await load();route();toast('Đã cập nhật quyền.');}catch(err){errorText(err);}finally{save.disabled=false;}};
    const summary=user=>user.role==='admin'?'Toàn quyền':Array.isArray(user.permissions._routes)?user.permissions._routes.map(id=>ROUTES.find(r=>r[0]===id)?.[1]||'').join(' · ')||'Chưa cấp mục nào':Object.entries(user.permissions).filter(([m,a])=>SCHEMA[m]&&a.includes('read')).map(([m])=>SCHEMA[m].title).join(' · ')||'Chưa cấp quyền';
    view.append(form,el('h3','Tài khoản được cấp quyền'),makeTable(['Email','Vai trò','Kích hoạt','Mục được cấp','Thao tác'],data.users.map(u=>[u.email,u.role,u.enabled,el('span',summary(u),'permission-summary'),button('Chỉnh quyền',()=>{selectUser(u);form.scrollIntoView?.({behavior:'smooth',block:'start'});})])),el('h3','Phiên & cảnh báo đăng nhập'),makeTable(['Email','Trạng thái','Hết hạn','Thao tác'],data.sessions.map(s=>[s.email,s.status,s.expires,s.status==='active'?button('Thu hồi',async()=>{try{await call('admin',{operation:'revoke',id:s.id});toast('Đã thu hồi phiên.');route();}catch(e){errorText(e);}},'button danger'):'—'])));
    const security=data.security||{alerts:[]},names={LOGIN:'Đăng nhập Google mới',LOGIN_DENIED:'Đăng nhập bị chặn',SESSION_REPLACED:'Phiên cũ được thay bằng đăng nhập Google mới',OAUTH_DENIED:'Xác minh Google bị từ chối',REVOKE:'Đã thu hồi phiên',USER_UPDATE:'Đã thay đổi tài khoản hoặc quyền',RPC_DENIED:'Yêu cầu bị từ chối quyền'};
    view.append(el('h3','Cảnh báo bảo mật'),el('p','Tên thiết bị do trình duyệt cung cấp, không phải bằng chứng nhận dạng. Thời gian hoạt động được máy chủ ghi nhận.','report-note'),makeTable(['Thời điểm','Tài khoản','Sự kiện','Xác nhận'],security.alerts.map(a=>[a.at,a.email,names[a.action]||a.action,a.acknowledged?'Đã xem':button('Đã kiểm tra',async()=>{try{await call('admin',{operation:'ackAlert',id:a.id});toast('Đã ghi nhận kiểm tra cảnh báo.');route();}catch(e){errorText(e);}})])));
    if(security.hasEarlier)view.append(el('p','Đang xem tối đa 100 sự kiện bảo mật trong 1.000 dòng nhật ký gần nhất. Nhật ký đầy đủ vẫn được giữ trên Sheets.','report-note'));
  }catch(e){if(generation===viewGeneration)errorText(e);}finally{loading.remove();}
}
async function renderHealth(){const generation=viewGeneration,loading=pageLoading();try{const data=await call('health');if(generation!==viewGeneration)return;renderMaintenance();const view=$('view');view.append(el('p','Đồng bộ gần nhất: '+display(data.lastScan)+' · Sao lưu gần nhất: '+display(data.lastBackup),'muted'));if(data.pending.length)view.append(el('div','Có giao dịch PREPARED. Các thao tác ghi bị chặn đến khi chủ sở hữu kiểm tra và chạy recoverPrepared_.','error'));view.append(makeTable(['Thời điểm','Người dùng','Thao tác','Phân hệ','Mã'],data.audit.map(r=>[r.at,r.user,r.action,r.module,r.recordId])));}catch(e){if(generation===viewGeneration)errorText(e);}finally{loading.remove();}}
async function exportModule(module,control){
  if(state.exporting)return;state.exporting=true;if(control){control.disabled=true;control.classList.add('is-loading');}
  const stamp=state.stamp,token=state.token;
  try{toast('Đang chuẩn bị file Excel…','info');const rows=[];let offset=0;do{const page=await call('export',{module,window:true,offset,limit:200,stamp});if(token!==state.token||stamp!==state.stamp)throw new Error('Phiên hoặc dữ liệu đã thay đổi. Xuất lại file Excel.');rows.push(...page.rows);offset=page.next??null;}while(offset!=null);
    await ensureExcelRuntime();const book=createModuleWorkbook(module,rows,{source:state.demo?'Xem thử · không phải dữ liệu thật':'Google Sheets',stamp});
    await downloadExcel(book,'CHIFAA-'+module+'-'+dateToday());toast('Đã chuẩn bị file Excel. Kiểm tra mục tải xuống.');
  }catch(e){errorText(e);}finally{state.exporting=false;if(control){control.disabled=false;control.classList.remove('is-loading');}}
}
async function refresh(force=true){if(state.busy||$('editor').open){if(force)toast('Hãy hoàn tất phiếu đang mở hoặc đợi thao tác hiện tại.','info');return;}state.busy=true;$('refresh').disabled=true;$('refresh').classList.add('is-loading');try{await load(force);nav();route();$('connection').textContent=state.demo?'Xem thử · lưu trong RAM':'Đã đồng bộ '+new Date().toLocaleTimeString('vi-VN');if(force)toast(state.demo?'Đã làm mới bản xem thử trên máy.':'Đã tải dữ liệu mới nhất từ Sheets.');}catch(e){if(e.code==='AUTH'){localLogout();toast('Phiên đã hết hiệu lực. Vui lòng đăng nhập lại.','warning');}else errorText(e);}finally{state.busy=false;$('refresh').disabled=false;$('refresh').classList.remove('is-loading');}}
function localLogout(){document.querySelectorAll("[data-private-dialog]").forEach(n=>n.remove());state.entryPending=null;state.orderPlanPending=null;state.kioskPending=null;state.lookups={};state.lookupVersions={};state.lookupPending=new Map();state.refMaps={};state.pendingWorkflow=null;state.saving=false;state.uncertain=null;state.actionRetries=new Map();state.pageCache=new Map();state.summaryCache=new Map();state.viewCache=new Map();state.strategyCache=new Map();state.strategyDom=new Map();state.strategyRenderedKey=null;state.grantKey=null;state.moduleVersions={};clearToasts();clearRpcSession();state.disconnected=false;state.token=null;state.data={};state.permissions={};state.user=null;state.issues=[];state.loginAttempt=null;if($('editor').open)$('editor').close();$('form-fields').replaceChildren();$('view').replaceChildren();$('navigation').replaceChildren();$('workspace').hidden=true;$('login').hidden=false;$('login-status').textContent='Đã đăng xuất.';if(!state.demo)prepareLogin();}
$('logout').onclick=async()=>{try{if(!state.demo)await call('logout');localLogout();toast('Đã đăng xuất.','info');}catch(e){errorText(e);}};
$('refresh').onclick=()=>refresh(true);$('menu-toggle').onclick=()=>$('workspace').classList.toggle('menu-open');$('backdrop').onclick=()=>$('workspace').classList.remove('menu-open');window.addEventListener('hashchange',()=>{if(state.user)route();});
let syncInFlight=false;
async function checkSync(){
  if(!state.token||document.hidden||state.busy||syncInFlight||rpcPending.size)return;
  syncInFlight=true;
  try{const result=await call('sync');if(state.disconnected){state.disconnected=false;toast('Đã kết nối lại máy chủ.','info');}if(result.permissionVersion!==state.permissionVersion||result.grants&&result.grants!==state.grants){if($('editor').open)$('editor').close();$('form-fields').replaceChildren();await refresh(false);}else if(result.stamp!==state.stamp)await refresh(false);}
  catch(e){if(e.code==='AUTH'){localLogout();toast('Phiên đã hết hiệu lực. Vui lòng đăng nhập lại.','warning');}else{$('connection').textContent='Mất kết nối · chưa đồng bộ';if(!state.disconnected){state.disconnected=true;toast('Mất kết nối máy chủ. Dữ liệu đang hiển thị có thể chưa mới nhất.','warning');}}}
  finally{syncInFlight=false;}
}
setInterval(checkSync,15000);
async function start(){
  if(state.demo){state.user={email:'Bản xem thử trên máy',role:'admin'};for(const m of Object.keys(SCHEMA)){state.data[m]=[];state.permissions[m]=ACTIONS;}mount();return;}
  if(!globalThis.google?.script?.run){showLogin();$('login-status').textContent='Bản cài đặt cục bộ. Chưa kết nối Google Apps Script.';$('preview-links').hidden=false;return;}
  await prepareLogin({resume:true});
}
async function prepareLogin({resume=false}={}){
  if(resume)showBoot('Đang kết nối không gian làm việc…');else showLogin();
  state.loginAttempt=null;$('google-button').replaceChildren();$('login-status').classList.add('is-loading');$('login-status').textContent='Đang chuẩn bị đăng nhập…';
  try{
    const browserSecret=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(browserSecret));
    const browserProof=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const flow=await rpcCall('oauthStart',{browserProof,deviceLabel:browserDeviceLabel()});
    setRpcScope(flow.sessionScope);
    if(resume){
      const saved=await restoreRpcSession();
      if(saved){
        state.token=saved.token;showBoot('Đang khôi phục phiên làm việc…');
        try{await load();mount();return;}
        catch(e){
          state.token=null;
          if(!['AUTH','FORBIDDEN'].includes(e.code))throw e;
          await clearRpcSession();
        }
      }
    }
    showLogin();
    const attempt={...flow,browserSecret,expires:Date.now()+flow.expiresIn*1000,polling:false};state.loginAttempt=attempt;
    const link=el('a','Đăng nhập bằng Google','button primary');link.href=flow.url;link.target='_blank';link.rel='noopener noreferrer';
    const mark=el('span',null,'google-mark'),ns='http://www.w3.org/2000/svg',googleIcon=document.createElementNS(ns,'svg');googleIcon.setAttribute('viewBox','0 0 48 48');googleIcon.setAttribute('aria-hidden','true');
    for(const [fill,d]of [['#4285F4','M43.6 20.5H24v8h11.2c-.5 2.6-2 4.8-4.2 6.3V40h6.8c4-3.7 6.3-9.1 6.3-15.5 0-1.4-.1-2.7-.5-4Z'],['#34A853','M24 44c5.6 0 10.3-1.8 13.8-5l-6.8-5.2c-1.8 1.2-4.1 1.9-7 1.9-5.4 0-10-3.6-11.7-8.5H5.4v5.4C8.9 39.4 15.9 44 24 44Z'],['#FBBC05','M12.3 27.2a12 12 0 0 1 0-6.4v-5.4H5.4a20 20 0 0 0 0 17.2l6.9-5.4Z'],['#EA4335','M24 12.3c3 0 5.7 1 7.8 3l5.9-5.9A19.8 19.8 0 0 0 24 4C15.9 4 8.9 8.6 5.4 15.4l6.9 5.4c1.7-4.9 6.3-8.5 11.7-8.5Z']]){const path=document.createElementNS(ns,'path');path.setAttribute('fill',fill);path.setAttribute('d',d);googleIcon.append(path);}mark.append(googleIcon);link.prepend(mark);link.setAttribute('aria-label','Đăng nhập bằng Google');
    link.addEventListener('click',event=>{
      if(Date.now()>=attempt.expires){event.preventDefault();prepareLogin();return;}
      if(attempt.polling){event.preventDefault();return;}
      // Keep a close-only handle; detach the opener before navigating to Google.
      // If popups are blocked, preserve the normal noopener link as a fallback.
      if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){
        let popup;
        try{
          const screen=window.screen||{},width=Math.min(520,screen.availWidth||520),height=Math.min(680,screen.availHeight||680);
          const left=Math.round((screen.availLeft||0)+Math.max(0,((screen.availWidth||width)-width)/2));
          const top=Math.round((screen.availTop||0)+Math.max(0,((screen.availHeight||height)-height)/2));
          popup=window.open('about:blank','_blank',`popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
          if(popup){popup.opener=null;popup.location.replace(flow.url);attempt.popup=popup;event.preventDefault();}
        }
        catch(_){try{popup?.close();}catch(_){/* Browser owns the window. */}}
      }
      if(!attempt.polling){attempt.polling=true;pollLogin(attempt);}
    });
    $('google-button').replaceChildren(link);$('login-status').textContent='Bấm đăng nhập để mở cửa sổ Google. CHIFAA sẽ tiếp tục sau khi bạn xác nhận.';
  }catch(e){
    if(resume)showBoot('Chưa thể kết nối. '+e.message,true);
    else{$('login-status').textContent=e.message;$('google-button').replaceChildren(button('Thử lại',()=>prepareLogin({resume})));}
  }
  finally{$('login-status').classList.remove('is-loading');}
}
async function pollLogin(attempt){
  $('login-status').classList.add('is-loading');
  try{
    while(state.loginAttempt===attempt&&Date.now()<attempt.expires){
      $('login-status').textContent='Đang chờ xác nhận trong cửa sổ Google…';
      const login=await rpcCall('oauthFinish',{flow:attempt.flow,browserSecret:attempt.browserSecret});
      if(state.loginAttempt!==attempt)return;
      if(!login.pending){
        // Close as soon as identity/session is confirmed. Sheets bootstrap and
        // browser session persistence can be slow and must not hold this window.
        try{attempt.popup?.close();}catch(_){/* Google navigation may sever the handle. */}
        const remembered=await setRpcSession(login);state.token=login.token;state.loginAttempt=null;$('google-button').replaceChildren();
        showBoot('Đã xác minh Google. Đang tải dữ liệu…');await load();mount();
        toast('Đăng nhập thành công.');
        if(!remembered)toast('Trình duyệt không cho lưu phiên. Tải lại trang sẽ cần đăng nhập lại.','warning');
        return;
      }
      await new Promise(resolve=>setTimeout(resolve,2500));
    }
    if(state.loginAttempt===attempt)throw new Error('Lần đăng nhập đã hết hạn. Hãy thử lại.');
  }catch(e){
    if(state.loginAttempt!==attempt&&state.token){try{await call('logout');}catch(_){/* absolute expiry still applies */}}
    await clearRpcSession({forget:['AUTH','FORBIDDEN'].includes(e.code)});
    state.token=null;state.loginAttempt=null;state.data={};state.permissions={};state.user=null;
    $('workspace').hidden=true;showLogin();$('view').replaceChildren();$('navigation').replaceChildren();$('login-status').textContent=e.message;
    $('google-button').replaceChildren(button('Đăng nhập lại',()=>prepareLogin({resume:true})));
    notifyError(e);
  }
}
start();

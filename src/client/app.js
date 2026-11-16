import { SCHEMA, ROUTES, ACTIONS } from '../shared/schema.js';
import { cleanRecord, sourceIssues, effective, flattenRecipe, costRecipe, salesMetrics, payroll, inventory, demand, report, scenario, variance, validDate, finance, targets, compareWeeks } from '../shared/domain.js';
import { rpcCall, setRpcSession, clearRpcSession, setRpcScope, restoreRpcSession } from './rpc.js';
import { NAV_SECTIONS, NAV_ICONS } from './navigation.js';
import {createPermissionPicker} from './permissions.js';
import {canAccessPage,routeReadModules} from '../shared/access.js';
import {renderFinancialOperations,renderMaintenance,printBusinessDocument,printRecord} from './operations-view.js';
import {renderStrategy} from './strategy-view.js';
import {toast,notifyError,clearToasts} from './notifications.js';
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(className)n.className=className;return n;};
const button=(text,fn,style='button')=>{const b=el('button',text,style);b.type='button';b.addEventListener('click',fn);return b;};
const dateToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const display=v=>v==null||v===''?'—':typeof v==='number'?v.toLocaleString('vi-VN',{maximumFractionDigits:2}):typeof v==='boolean'?(v?'Có':'Không'):Array.isArray(v)?v.length+' thành phần':String(v);
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
async function call(action,args={}){
  if(!state.demo)return rpcCall(action,{...args,token:state.token});
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
  const token=state.token,b=await call('bootstrap',{force});
  if(token!==state.token)throw Object.assign(new Error('Phiên đăng nhập đã thay đổi.'),{code:'AUTH'});
  state.data=b.data;state.permissions=b.permissions;state.user=b.user;state.stamp=b.stamp;state.permissionVersion=b.permissionVersion;state.accountingApproved=b.accountingApproved;
  state.partialModules=b.partialModules||{};state.serverIssues=b.issues||[];
  validateData();
}
function validateData(){
  const local=sourceIssues(state.data,state.partialModules);
  state.issues=[...new Set([...(state.serverIssues||[]),...local].map(i=>i.module+' / '+(i.id||('d?ng '+i.row))+': '+i.message))];
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
  viewGeneration++;
  state.route=location.hash.slice(1)||ROUTES.find(([id])=>canAccessPage(state.user,state.permissions,id))?.[0]||'dashboard';const r=ROUTES.find(r=>r[0]===state.route)||ROUTES[0];state.route=r[0];
  $('breadcrumb').textContent=r[1];$('workspace').classList.remove('menu-open');$('view').replaceChildren();$('error').hidden=true;nav();
  const view=$('view');view.className='page-enter';
  const head=el('div',null,'page-head'),left=el('div');left.append(el('div','CHIFAA / KHÔNG GIAN VẬN HÀNH','eyebrow'),el('h2',r[1]),el('p','Dữ liệu theo phiên bản · Đối chiếu nguồn trước khi chốt'));head.append(left);view.append(head);
  const m=r[2];
  try{
    if(!canAccessPage(state.user,state.permissions,r[0]))throw new Error('Bạn chưa được cấp quyền truy cập mục này.');
    const needed=routeReadModules(state.route).filter(id=>Object.hasOwn(state.data,id)&&(!SCHEMA[m]||id!==m));if(state.route==='health'&&state.user.role==='admin')needed.push('stores');
    if(['loans','debts'].includes(m))needed.push(m);if(m==='debts'&&Object.hasOwn(state.data,'sales'))needed.push('sales');
    if(needed.some(id=>state.partialModules?.[id])){const generation=viewGeneration;pageLoading();ensureReadModules(needed,generation).then(ok=>{if(ok&&generation===viewGeneration)route();}).catch(e=>{if(generation===viewGeneration)errorText(e);});return;}
    head.append(button('In báo cáo',()=>printBusinessDocument(r[1],$('view'))));
    if(SCHEMA[m]){if(!can(m,'read'))throw new Error('Bạn chưa được cấp quyền đọc phân hệ này.');renderRecords(m,head);}
    else if(state.route==='strategy')renderStrategy();
    else if(m==='entry')renderEntry();
    else if(m==='admin')renderAdmin();
    else if(m==='health')renderHealth();
    else renderReport(m);
  }catch(e){errorText(e);}
}
async function ensureReadModules(modules,generation=viewGeneration){
  const stamp=state.stamp,token=state.token;
  for(const module of [...new Set(modules)]){
    if(!state.partialModules?.[module])continue;const rows=[];let offset=0;
    do{const page=await call('list',{module,mode:'snapshot',limit:200,offset,stamp});if(generation!==viewGeneration||stamp!==state.stamp||token!==state.token)return false;rows.push(...page.rows);offset=page.next;}while(offset!=null);
    state.data[module]=rows;delete state.partialModules[module];
  }validateData();return true;
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
  const bar=period(),search=document.createElement('input');search.type='search';search.placeholder='Tìm tên, mã hoặc ghi chú…';search.setAttribute('aria-label','Tìm dữ liệu');search.value=state.search;bar.append(search);
  if(can(module,'export'))bar.append(button('Xuất CSV',()=>exportModule(module)));view.append(bar);
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
    const drawVersion=++drawId;let rows,total,next;
    if(state.demo){const all=filterRows();total=all.length;rows=all.slice(offset,offset+50);next=offset+50<total?offset+50:null;}
    else{container.replaceChildren(el('div','Đang tải trang dữ liệu…','loading-panel is-loading'));try{const page=await call('list',{module,offset,limit:50,from:schema.fields.date?state.from:'',to:schema.fields.date?state.to:'',search:search.value,kind:module==='recipes'?{recipes:'mon',batches:'nhan-sot',rice:'com',packaging:'bao-bi'}[state.route]:undefined,stamp:state.stamp});if(generation!==viewGeneration||drawVersion!==drawId)return;({rows,total,next}=page);}catch(e){if(generation===viewGeneration&&drawVersion===drawId){container.replaceChildren();errorText(e);}return;}}
    const keys=Object.keys(schema.fields);
    const labels=keys.map(k=>schema.fields[k].label);labels.unshift('Mã / phiên bản');labels.push('Thao tác');
    const grid=makeTable(labels,rows.map(row=>{
      const id=el('div',String(row.recordId||'THIẾU ID').slice(0,8)+' · v'+row.version);id.title=row.recordId+'\n'+row.updatedAt+'\n'+row.updatedBy;
      const values=keys.map(k=>refValue(schema.fields[k],row[k]));
      const actions=el('div',null,'actions');
      if(!row.reverses&&!schema.immutable&&!(module==='orders'&&row.source==='PORTAL')&&can(module,'update'))actions.append(button('Sửa',()=>openEditor(module,row)));
      if(!row.reverses&&schema.immutable&&can(module,'approve'))actions.append(button('Đảo phiếu',()=>changeRecord(module,row,'reverse'),'button danger'));
      if(module==='orders'&&row.status==='pending'&&can(module,'approve'))actions.append(button('Duyệt',()=>changeRecord(module,row,'approve'),'button primary'));
      if(module==='orders'&&row.status==='pending'&&can(module,'approve'))actions.append(button('Từ chối',()=>changeRecord(module,row,'reject'),'button danger'));
      if(!schema.immutable&&can(module,'delete'))actions.append(button('Xóa',()=>changeRecord(module,row,'delete'),'button danger'));
      actions.append(button('Chi tiết',()=>showDetails(row,module)));
      actions.append(button('In phiếu',()=>printRecord(module,row)));
      if(['production','counts'].includes(module)&&!row.reverses&&can(module,'approve')&&can('stock','create'))actions.append(button('Liên kết kho',async()=>{if(state.demo){toast('Liên kết kho cần máy chủ Apps Script.','info');return;}if(!confirm('Chỉ dùng cho phiếu cũ chưa liên kết. Xác nhận đối chiếu tránh xuất kho hai lần?'))return;try{await call('workflow',{kind:module==='production'?'production':'count',id:row.recordId,key:crypto.randomUUID()});await load(true);route();toast('Đã liên kết kho.');}catch(e){errorText(e);}}));
      return [id,...values,actions];
    }));const pager=el('div',null,'toolbar pagination'),prev=button('‹ Trang trước',()=>{offset=Math.max(0,offset-50);draw();}),more=button('Trang sau ›',()=>{offset=next;draw();});prev.disabled=offset===0;more.disabled=next==null;pager.append(prev,el('span',total?(offset+1)+'–'+(offset+rows.length)+' / '+total:'0 bản ghi','muted'),more);container.replaceChildren(grid,pager);
  };search.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{offset=0;draw();},250);});draw();
}
function refValue(field,value){if(field.ref)return (state.data[field.ref]||[]).find(r=>r.recordId===value)?.name||value;return display(value);}
function makeTable(headers,rows){
  const card=el('div',null,'card');if(!rows.length){const empty=el('div',null,'empty');empty.append(el('strong','Chưa có dữ liệu trong phạm vi này'),el('span','Thêm phiếu mới hoặc chọn lại khoảng thời gian để xem dữ liệu.'));card.append(empty);return card;}
  const wrap=el('div',null,'table-wrap'),table=el('table'),thead=el('thead'),hr=el('tr');headers.forEach(h=>hr.append(el('th',h)));thead.append(hr);table.append(thead);const body=el('tbody');
  for(const row of rows){const tr=el('tr');for(const value of row){const td=el('td');if(value instanceof Node)td.append(value);else{td.textContent=display(value);if(typeof value==='number')td.classList.add('numeric');}tr.append(td);}body.append(tr);}table.append(body);wrap.append(table);card.append(wrap);return card;
}
function showDetails(row,module){
  const fields=$('form-fields');fields.replaceChildren();$('form-title').textContent='Chi tiết · '+SCHEMA[module].title;
  const pre=el('pre',JSON.stringify(row,null,2),'json-view field full');fields.append(pre);$('submit-record').hidden=true;$('form-error').hidden=true;state.editor=null;$('editor').showModal();
}
function openEditor(module,row){
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
      const options=f.ref?effective(state.data[f.ref]||[]).map(r=>[r.recordId,r.name]):f.options.map(v=>[v,v]);
      for(const [id,title]of options.filter(([id])=>!(module==='cash'&&key==='category'&&['lai-vay','luong-thuong'].includes(id)))){const o=el('option',title);o.value=id;input.append(o);}
    }else{input=document.createElement('input');input.type=f.type==='boolean'?'checkbox':['number','date','time'].includes(f.type)?f.type:'text';if(f.type==='number'){input.step='any';if(f.min!=null)input.min=f.min;if(f.max!=null)input.max=f.max;}}
    input.name=key;input.required=f.required&&f.type!=='boolean';if(f.type==='boolean')input.checked=row?.[key]===true;else input.value=row?.[key]??(f.type==='date'?dateToday():f.type==='number'&&f.required?0:'');
    if(key==='yield'&&!row)input.value=1;if(key==='conversion'&&!row)input.value=1;
    if(module==='recipes'&&key==='kind'&&!row)input.value=({recipes:'mon',batches:'nhan-sot',rice:'com',packaging:'bao-bi'})[state.route]||'mon';
    if(module==='orders'&&key==='status'){input.value=row?.status||'pending';input.disabled=true;}
    label.append(input);$('form-fields').append(label);
  }
  if(!row)wireSnapshotDefaults(module);
  $('editor').showModal();
}
function wireSnapshotDefaults(module){
  const input=key=>$('form-fields').querySelector('[name="'+key+'"]');
  const put=(key,value)=>{if(value!==undefined&&value!==null&&value!=='')input(key).value=value;};
  if(module==='sales'){
    const update=()=>{
      const dish=effective(state.data.dishes||[]).find(r=>r.recordId===input('dishId').value);
      input('price').value=dish?.price??'';
      const discounts=effective(state.data.discounts||[]).filter(r=>r.storeId===input('storeId').value&&r.dishId===input('dishId').value);
      input('discount').value=discounts.length===1?discounts[0].rate:'';
      input('recoveryPrice').value=discounts.length===1?discounts[0].recoveryPrice:'';
    };
    input('dishId').addEventListener('change',update);input('storeId').addEventListener('change',update);
  }
  if(module==='attendance')input('employeeId').addEventListener('change',()=>{
    const employee=effective(state.data.employees||[]).find(r=>r.recordId===input('employeeId').value);
    if(employee){put('hourlyRate',employee.hourlyRate);put('department',employee.department);put('defaultAllowance',employee.allowance);}
  });
}
function addRecipeLine(holder,line={type:'material',id:'',quantity:1}){
  const wrap=el('div',null,'recipe-line'),type=document.createElement('select'),id=document.createElement('select'),quantity=document.createElement('input');
  for(const [value,title]of [['material','Vật tư'],['recipe','Công thức']]){const o=el('option',title);o.value=value;type.append(o);}type.value=line.type;
  type.setAttribute('aria-label','Loại thành phần');id.setAttribute('aria-label','Thành phần');quantity.setAttribute('aria-label','Định lượng');
  const options=()=>{id.replaceChildren();const empty=el('option','Chọn thành phần');empty.value='';id.append(empty);for(const r of effective(state.data[type.value==='recipe'?'recipes':'materials']||[])){const o=el('option',r.name);o.value=r.recordId;id.append(o);}};options();id.value=line.id;type.onchange=options;
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
  event.preventDefault();if(!state.editor)return;const {module,row}=state.editor;
  $('submit-record').disabled=true;$('form-error').hidden=true;
  try{
    const record=state.uncertain?.record||formRecord(module);
    const request=state.uncertain||{module,operation:row?'update':'create',id:row?.recordId,expectedVersion:row?.version,expectedHash:row?._hash,record,key:state.formKey};
    await call('mutate',request);state.uncertain=null;await load();validateData();$('editor').close();route();toast(state.demo?'Đã lưu trong RAM bản xem thử.':'Máy chủ đã xác nhận lưu phiếu.');
  }catch(e){
    $('form-error').textContent=e.message;$('form-error').hidden=false;
    notifyError(e);
    if(['TIMEOUT','NETWORK'].includes(e.code)){
      state.uncertain ||= {module,operation:row?'update':'create',id:row?.recordId,expectedVersion:row?.version,expectedHash:row?._hash,record:formRecord(module),key:state.formKey};
      $('submit-record').textContent='Kiểm tra lại cùng phiếu';for(const input of $('form-fields').querySelectorAll('input,select,button'))input.disabled=true;
    }
  }finally{$('submit-record').disabled=false;}
});
async function changeRecord(module,row,operation){
  const title=operation==='reverse'?'Đảo phiếu này? Phiếu gốc vẫn được lưu trong nhật ký.':operation==='delete'?'Xóa bản ghi này?':operation==='reject'?'Từ chối đơn này?':'Duyệt đơn này để đưa vào nhu cầu nguyên liệu?';
  if(!confirm(title))return;
  const request={module,operation,id:row.recordId,expectedVersion:row.version,expectedHash:row._hash,key:crypto.randomUUID()};
  try{await call('mutate',request);await load();route();toast('Đã nhận xác nhận.');}catch(e){errorText(e);}
}
function closeEditor(){if(state.uncertain&&!confirm('Kết quả ghi chưa rõ. Bạn có thể dùng Đồng bộ để kiểm tra phiếu trước khi nhập lại. Đóng cửa sổ?'))return;$('editor').close();}
$('close-editor').onclick=closeEditor;$('cancel-editor').onclick=closeEditor;
function requireData(modules){const missing=modules.filter(m=>!Object.hasOwn(state.data,m));if(missing.length)throw new Error('Cần quyền đọc: '+missing.map(m=>SCHEMA[m].title).join(', '));if(state.issues?.length)throw new Error('Dữ liệu nguồn cần sửa trước khi tính báo cáo:\n'+state.issues.slice(0,8).join('\n'));}
function renderReport(kind){
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
    requireData(['counts','stock','production','recipes']);view.append(makeTable(['Ngày','Vật tư','Thực tế dùng','Lý thuyết','Chênh lệch','Trạng thái'],variance(state.data,state.from,state.to).map(r=>[r.date,refValue({ref:'materials'},r.materialId),r.actual,r.theoretical,r.difference,r.status])));return;
  }
  if(kind==='payroll'){
    renderFinancialOperations('payroll');
    requireData(['attendance','employees']);const rows=payroll(state.data.attendance.filter(r=>r.date>=state.from&&r.date<=state.to));view.append(makeTable(['Nhân viên','Bộ phận','Giờ','Lương giờ','Phụ cấp + hỗ trợ','Ứng','Trừ','Thực lĩnh'],rows.map(r=>[refValue({ref:'employees'},r.employeeId),r.department,r.hours,r.base,r.allowances,r.advance,r.deduction,r.net])));return;
  }
  requireData(['sales','production','attendance','cash','recipes','materials','stock']);
  const r=report(state.data,state.from,state.to),stats=el('div',null,'stats');
  for(const [label,value,unit]of [['Doanh thu thuần · tạm tính',r.revenue,'đ'],['Tiền thực thu tại điểm bán',r.received,'đ'],['Sản lượng đạt',r.produced,'phần'],['Năng suất sản xuất',r.productivity,'phần / giờ SX']]){
    const s=el('div',null,'stat');s.append(el('label',label),el('strong',display(value)),el('small',value==null?'Chưa đủ dữ liệu':unit));stats.append(s);
  }view.append(stats);
  const grid=el('div',null,'grid-two'),chartCard=el('div',null,'card'),ch=el('div',null,'card-header');ch.append(el('h3','Doanh thu trong kỳ'),el('small',state.from+' → '+state.to));chartCard.append(ch);chartCard.append(revenueChart());
  const detail=el('div',null,'card pad');detail.append(el('h3','Độ đầy đủ & dòng tiền'));const list=el('div',null,'metric-list');
  for(const [label,value]of [['Ngày có doanh thu',r.coverage],['Giờ sản xuất',display(r.sxHours)],['Giá nguyên liệu đã dùng',display(r.cogs)],['Tiền mặt theo sổ',display(r.cash.cash)],['Chuyển khoản theo sổ',display(r.cash.bank)],['Kết quả tạm tính trước khấu hao',display(r.profit)]]){const line=el('div',null,'metric-line');line.append(el('span',label),el('strong',value));list.append(line);}detail.append(list);grid.append(chartCard,detail);view.append(grid);
  view.append(el('p','Nguồn: '+r.source+' · Kỳ '+r.from+' — '+r.to+' · '+r.completeness+'. Doanh thu thuần = hàng bán + hàng điểm bán chịu sau chiết khấu, trước chi phí. Hỗ trợ thu hồi là chi phí riêng; tiền thực thu và thu nợ cũ tách khỏi doanh thu. Lợi nhuận tạm tính chưa gồm khấu hao; lãi vay theo phiếu chi đã ghi.','report-note'));
  view.append(makeTable(['Chỉ tiêu','Tỷ lệ trên doanh thu thuần','Giới hạn'],[['Food cost',r.foodCostPct==null?'Chưa đủ dữ liệu':display(r.foodCostPct)+'%',display(r.policy.foodCostMax*100)+'%'],['Nhân sự sản xuất',r.sxLaborPct==null?'Chưa đủ dữ liệu':display(r.sxLaborPct)+'%',display(r.policy.productionLaborMax*100)+'%'],['Chi phí thu hồi',r.recoveryExpense==null?'Chưa đủ dữ liệu':display(r.recoveryExpense)+' đ','Hạch toán riêng, không giảm doanh thu']]));
  if(state.data.plans){const target=targets(state.data,state.from,state.to);view.append(makeTable(['Doanh thu mục tiêu','Đạt (%)','Sản lượng mục tiêu','Đạt (%)','Ngân sách thưởng còn trong trần'],[[target.revenueTarget,target.revenuePercent,target.productionTarget,target.productionPercent,target.bonusAvailable]]),el('p',target.bonusRule,'report-note'));}
  if(state.route==='opsdashboard')view.append(el('h3','So sánh cùng thứ hai tuần'),makeTable(['Ngày tuần này','Ngày tuần trước','Doanh thu kỳ này','Doanh thu kỳ trước','Chênh lệch'],compareWeeks(state.data,state.to).map(w=>[w.date,w.previousDate,w.revenue,w.previousRevenue,w.difference])));
  if(state.route==='strategy')renderScenario();
  view.append(el('h3','Đối soát theo điểm bán'));view.append(makeTable(['Ngày','Điểm bán','Món','Giao','Bán','Trả','Điểm bán chịu','Doanh thu thuần','Thực thu','Thiếu / thừa'],effective(state.data.sales).filter(s=>s.date>=state.from&&s.date<=state.to).map(s=>{const m=salesMetrics(s);return [s.date,refValue({ref:'stores'},s.storeId),refValue({ref:'dishes'},s.dishId),s.delivered,s.sold,s.returned,s.creditQty,m.netRevenue,m.received,m.collectionDifference];})));
}
function revenueChart(){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 680 215');svg.classList.add('chart');svg.setAttribute('role','img');svg.setAttribute('aria-label','Biểu đồ doanh thu theo ngày');
  const days={};for(const r of effective(state.data.sales||[]).filter(r=>r.date>=state.from&&r.date<=state.to))days[r.date]=(days[r.date]||0)+salesMetrics(r).netRevenue;
  const points=Object.entries(days).sort().slice(-31),max=Math.max(1,...points.map(p=>Math.abs(p[1])));
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
  }catch(e){if(generation===viewGeneration)errorText(e);}finally{loading.remove();}
}
async function renderHealth(){const generation=viewGeneration,loading=pageLoading();try{const data=await call('health');if(generation!==viewGeneration)return;renderMaintenance();const view=$('view');view.append(el('p','Đồng bộ gần nhất: '+display(data.lastScan)+' · Sao lưu gần nhất: '+display(data.lastBackup),'muted'));if(data.pending.length)view.append(el('div','Có giao dịch PREPARED. Các thao tác ghi bị chặn đến khi chủ sở hữu kiểm tra và chạy recoverPrepared_.','error'));view.append(makeTable(['Thời điểm','Người dùng','Thao tác','Phân hệ','Mã'],data.audit.map(r=>[r.at,r.user,r.action,r.module,r.recordId])));}catch(e){if(generation===viewGeneration)errorText(e);}finally{loading.remove();}}
async function exportModule(module){
  try{const rows=[];let offset=0;do{const page=await call('export',{module,offset,limit:200,stamp:state.stamp});rows.push(...page.rows);offset=page.next??null;}while(offset!=null);const keys=[...Object.keys(SCHEMA[module].fields),'recordId','version','updatedAt','updatedBy'];
    const cell=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"';const csv='\uFEFF'+[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(Array.isArray(r[k])?JSON.stringify(r[k]):r[k])).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=el('a');a.href=url;a.download='CHIFAA-'+module+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã chuẩn bị tệp CSV. Kiểm tra mục tải xuống.');
  }catch(e){errorText(e);}
}
async function refresh(force=true){if(state.busy||$('editor').open){if(force)toast('Hãy hoàn tất phiếu đang mở hoặc đợi thao tác hiện tại.','info');return;}state.busy=true;$('refresh').disabled=true;$('refresh').classList.add('is-loading');try{await load(force);nav();route();$('connection').textContent=state.demo?'Xem thử · lưu trong RAM':'Đã đồng bộ '+new Date().toLocaleTimeString('vi-VN');if(force)toast(state.demo?'Đã làm mới bản xem thử trên máy.':'Đã tải dữ liệu mới nhất từ Sheets.');}catch(e){if(e.code==='AUTH'){localLogout();toast('Phiên đã hết hiệu lực. Vui lòng đăng nhập lại.','warning');}else errorText(e);}finally{state.busy=false;$('refresh').disabled=false;$('refresh').classList.remove('is-loading');}}
function localLogout(){state.pendingWorkflow=null;clearToasts();clearRpcSession();state.disconnected=false;state.token=null;state.data={};state.permissions={};state.user=null;state.issues=[];state.loginAttempt=null;if($('editor').open)$('editor').close();$('form-fields').replaceChildren();$('view').replaceChildren();$('navigation').replaceChildren();$('workspace').hidden=true;$('login').hidden=false;$('login-status').textContent='Đã đăng xuất.';if(!state.demo)prepareLogin();}
$('logout').onclick=async()=>{try{if(!state.demo)await call('logout');localLogout();toast('Đã đăng xuất.','info');}catch(e){errorText(e);}};
$('refresh').onclick=()=>refresh(true);$('menu-toggle').onclick=()=>$('workspace').classList.toggle('menu-open');$('backdrop').onclick=()=>$('workspace').classList.remove('menu-open');window.addEventListener('hashchange',()=>{if(state.user)route();});
let syncInFlight=false;
async function checkSync(){
  if(!state.token||document.hidden||state.busy||syncInFlight||rpcPending.size)return;
  syncInFlight=true;
  try{const result=await call('sync');if(state.disconnected){state.disconnected=false;toast('Đã kết nối lại máy chủ.','info');}if(result.permissionVersion!==state.permissionVersion){if($('editor').open)$('editor').close();$('form-fields').replaceChildren();await refresh(false);}else if(result.stamp!==state.stamp)await refresh(false);}
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
    const flow=await rpcCall('oauthStart',{browserProof});
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

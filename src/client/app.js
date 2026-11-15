import { SCHEMA, ROUTES, ACTIONS } from '../shared/schema.js';
import { cleanRecord, effective, flattenRecipe, costRecipe, salesMetrics, payroll, inventory, demand, report, scenario, variance, validDate, finance, targets, compareWeeks } from '../shared/domain.js';
import { rpcCall } from './rpc.js';
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(className)n.className=className;return n;};
const button=(text,fn,style='button')=>{const b=el('button',text,style);b.type='button';b.addEventListener('click',fn);return b;};
const dateToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const display=v=>v==null||v===''?'—':typeof v==='number'?v.toLocaleString('vi-VN',{maximumFractionDigits:2}):typeof v==='boolean'?(v?'Có':'Không'):Array.isArray(v)?v.length+' thành phần':String(v);
const state={token:null,data:{},permissions:{},user:null,stamp:'',permissionVersion:null,demo:!globalThis.google?.script?.run&&new URLSearchParams(location.search).get('demo')==='1',from:dateToday(),to:dateToday(),route:'dashboard',search:'',busy:false,editor:null,uncertain:null,formKey:null};
const can=(m,a)=>state.permissions[m]?.includes(a);
function toast(text){$('toast').textContent=text;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,5000);}
function errorText(error){$('error').textContent=error.message||String(error);$('error').hidden=false;}
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
async function load(){
  if(state.demo)return;
  const b=await call('bootstrap');state.data=b.data;state.permissions=b.permissions;state.user=b.user;state.stamp=b.stamp;state.permissionVersion=b.permissionVersion;state.accountingApproved=b.accountingApproved;
  validateData();
}
function validateData(){
  state.issues=[];
  for(const [m,rows]of Object.entries(state.data))for(const r of effective(rows)){
    try{
      if(typeof r.recordId!=='string'||!r.recordId||!Number.isInteger(r.version)||r.version<1)throw new Error('Thiếu ID / phiên bản hợp lệ. Tạo mới qua ứng dụng.');
      if(rows.filter(other=>other.recordId===r.recordId).length>1)throw new Error('ID bị trùng trong Sheet');
      // Missing permission to a referenced table is not evidence of a bad record.
      const requiredRefs=Object.values(SCHEMA[m].fields).filter(f=>f.ref).map(f=>f.ref);
      if(requiredRefs.some(ref=>!Object.hasOwn(state.data,ref)))continue;
      if(m==='recipes'&&!state.data.materials)continue;
      const input={};for(const k of Object.keys(SCHEMA[m].fields))input[k]=r[k];cleanRecord(m,input,state.data);
      if(m==='recipes')flattenRecipe(r.recordId,1,state.data.recipes);
    }catch(e){state.issues.push(m+' / '+r.recordId+': '+e.message);}
  }
}
function nav(){
  const node=$('navigation');node.replaceChildren();let previous='';
  for(const [id,title,target]of ROUTES){
    if(SCHEMA[target]&&!can(target,'read'))continue;
    if(['admin','health'].includes(target)&&state.user.role!=='admin')continue;
    const group=SCHEMA[target]?.group||(['inventory','variance'].includes(target)?'Kho':['cost','demand'].includes(target)?'Sản xuất':target==='payroll'?'Tài chính':['admin','health'].includes(target)?'Hệ thống':'Điều hành');
    if(group!==previous){node.append(el('div',group,'group'));previous=group;}
    const a=el('a',title);a.href='#'+id;if(id===state.route)a.className='active';node.append(a);
  }
}
function mount(){
  $('login').hidden=true;$('workspace').hidden=false;$('identity').textContent=state.user.email;
  $('connection').textContent=state.demo?'Xem thử · lưu trong RAM':'Đã kết nối Sheets';
  $('mode-banner').hidden=false;$('mode-banner').textContent=state.demo?'BẢN XEM THỬ · Dữ liệu chỉ tồn tại trong phiên trình duyệt, chưa kết nối Google Sheets.':state.accountingApproved?'Dữ liệu Google Sheets · Kiểm tra khoảng thời gian và độ đầy đủ trước khi sử dụng báo cáo.':'BẢN THỬ KỸ THUẬT · Quy tắc doanh thu, quyền truy cập và triển khai Google chưa nghiệm thu. Chưa dùng làm sổ kế toán chính thức.';
  route();
}
function route(){
  state.route=location.hash.slice(1)||'dashboard';const r=ROUTES.find(r=>r[0]===state.route)||ROUTES[0];state.route=r[0];
  $('breadcrumb').textContent=r[1];$('workspace').classList.remove('menu-open');$('view').replaceChildren();$('error').hidden=true;nav();
  const view=$('view');view.className='page-enter';
  const head=el('div',null,'page-head'),left=el('div');left.append(el('div','CHIFAA / KHÔNG GIAN VẬN HÀNH','eyebrow'),el('h2',r[1]),el('p','Dữ liệu theo phiên bản · Đối chiếu nguồn trước khi chốt'));head.append(left);view.append(head);
  const m=r[2];
  try{
    if(SCHEMA[m]){if(!can(m,'read'))throw new Error('Bạn chưa được cấp quyền đọc phân hệ này.');renderRecords(m,head);}
    else if(m==='entry')renderEntry();
    else if(m==='admin')renderAdmin();
    else if(m==='health')renderHealth();
    else renderReport(m);
  }catch(e){errorText(e);}
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
  if(['loans','debts','assets'].includes(module)&&state.data.cash){
    const summary=finance(state.data,state.to)[module==='assets'?'depreciation':module];
    view.append(makeTable(module==='assets'?['Tài sản','Khấu hao / tháng','Lũy kế','Giá trị sổ']:['Đối tác','Giá trị gốc','Đã trả / thu','Còn lại','Quá hạn'],summary.map(r=>module==='assets'?[r.name,r.monthly,r.accumulated,r.bookValue]:[r.name,r.amount??r.principal,r.paid,r.remaining,r.overdue?'Quá hạn':'—'])));
  }
  const filterRows=()=>{
    let rows=(state.data[module]||[]).filter(r=>!r.deleted);
    const kind={recipes:'mon',batches:'nhan-sot',rice:'com',packaging:'bao-bi'}[state.route];if(module==='recipes'&&kind)rows=rows.filter(r=>r.kind===kind);
    if(schema.fields.date)rows=rows.filter(r=>r.date>=state.from&&r.date<=state.to);
    if(search.value.trim())rows=rows.filter(r=>Object.values(r).some(v=>String(v).toLowerCase().includes(search.value.toLowerCase())));
    return rows;
  };
  const container=el('div');view.append(container);
  const draw=()=>{
    const rows=filterRows(),keys=Object.keys(schema.fields);
    const labels=keys.map(k=>schema.fields[k].label);labels.unshift('Mã / phiên bản');labels.push('Thao tác');
    const grid=makeTable(labels,rows.map(row=>{
      const id=el('div',String(row.recordId||'THIẾU ID').slice(0,8)+' · v'+row.version);id.title=row.recordId+'\n'+row.updatedAt+'\n'+row.updatedBy;
      const values=keys.map(k=>refValue(schema.fields[k],row[k]));
      const actions=el('div',null,'actions');
      if(!row.reverses&&!schema.immutable&&can(module,'update'))actions.append(button('Sửa',()=>openEditor(module,row)));
      if(!row.reverses&&schema.immutable&&can(module,'approve'))actions.append(button('Đảo phiếu',()=>changeRecord(module,row,'reverse'),'button danger'));
      if(module==='orders'&&row.status==='pending'&&can(module,'approve'))actions.append(button('Duyệt',()=>changeRecord(module,row,'approve'),'button primary'));
      if(module==='orders'&&row.status==='pending'&&can(module,'approve'))actions.append(button('Từ chối',()=>changeRecord(module,row,'reject'),'button danger'));
      if(!schema.immutable&&can(module,'delete'))actions.append(button('Xóa',()=>changeRecord(module,row,'delete'),'button danger'));
      actions.append(button('Chi tiết',()=>showDetails(row,module)));
      return [id,...values,actions];
    }));container.replaceChildren(grid);
  };search.addEventListener('input',draw);draw();
}
function refValue(field,value){if(field.ref)return (state.data[field.ref]||[]).find(r=>r.recordId===value)?.name||value;return display(value);}
function makeTable(headers,rows){
  const card=el('div',null,'card');if(!rows.length){const empty=el('div',null,'empty');empty.append(el('strong','Chưa có dữ liệu trong phạm vi này'),el('span','Thêm phiếu hoặc chọn khoảng thời gian khác. Không tự điền số liệu minh họa.'));card.append(empty);return card;}
  const wrap=el('div',null,'table-wrap'),table=el('table'),thead=el('thead'),hr=el('tr');headers.forEach(h=>hr.append(el('th',h)));thead.append(hr);table.append(thead);const body=el('tbody');
  for(const row of rows){const tr=el('tr');for(const value of row){const td=el('td');if(value instanceof Node)td.append(value);else td.textContent=display(value);tr.append(td);}body.append(tr);}table.append(body);wrap.append(table);card.append(wrap);return card;
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
      for(const [id,title]of options){const o=el('option',title);o.value=id;input.append(o);}
    }else{input=document.createElement('input');input.type=f.type==='boolean'?'checkbox':['number','date','time'].includes(f.type)?f.type:'text';if(f.type==='number'){input.step='any';if(f.min!=null)input.min=f.min;if(f.max!=null)input.max=f.max;}}
    input.name=key;input.required=f.required&&f.type!=='boolean';if(f.type==='boolean')input.checked=row?.[key]===true;else input.value=row?.[key]??(f.type==='date'?dateToday():f.type==='number'&&f.required?0:'');
    if(key==='yield'&&!row)input.value=1;if(key==='conversion'&&!row)input.value=1;
    if(module==='orders'&&key==='status'){input.value=row?.status||'pending';input.disabled=true;}
    label.append(input);$('form-fields').append(label);
  }
  $('editor').showModal();
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
    requireData(['attendance','employees']);const rows=payroll(state.data.attendance.filter(r=>r.date>=state.from&&r.date<=state.to));view.append(makeTable(['Nhân viên','Bộ phận','Giờ','Lương giờ','Phụ cấp + hỗ trợ','Ứng','Trừ','Thực lĩnh'],rows.map(r=>[refValue({ref:'employees'},r.employeeId),r.department,r.hours,r.base,r.allowances,r.advance,r.deduction,r.net])));return;
  }
  requireData(['sales','production','attendance','cash','recipes','materials','stock']);
  const r=report(state.data,state.from,state.to),stats=el('div',null,'stats');
  for(const [label,value,unit]of [['Doanh thu thuần · tạm tính',r.revenue,'đ'],['Tiền thực thu tại điểm bán',r.received,'đ'],['Sản lượng đạt',r.produced,'phần'],['Năng suất sản xuất',r.productivity,'phần / giờ SX']]){
    const s=el('div',null,'stat');s.append(el('label',label),el('strong',display(value)),el('small',value==null?'Chưa đủ dữ liệu':unit));stats.append(s);
  }view.append(stats);
  const grid=el('div',null,'grid-two'),chartCard=el('div',null,'card'),ch=el('div',null,'card-header');ch.append(el('h3','Doanh thu trong kỳ'),el('small',state.from+' → '+state.to));chartCard.append(ch);chartCard.append(revenueChart());
  const detail=el('div',null,'card pad');detail.append(el('h3','Độ đầy đủ & dòng tiền'));const list=el('div',null,'metric-list');
  for(const [label,value]of [['Ngày có doanh thu',r.coverage],['Giờ sản xuất',display(r.sxHours)],['Giá nguyên liệu đã dùng',display(r.cogs)],['Tiền mặt theo sổ',display(r.cash.cash)],['Chuyển khoản theo sổ',display(r.cash.bank)],['Kết quả tạm tính trước khấu hao / lãi vay',display(r.profit)]]){const line=el('div',null,'metric-line');line.append(el('span',label),el('strong',value));list.append(line);}detail.append(list);grid.append(chartCard,detail);view.append(grid);
  view.append(el('p','Nguồn: '+r.source+' · Kỳ '+r.from+' — '+r.to+' · '+r.completeness+'. Quy tắc: doanh thu hàng bán + hàng điểm bán chịu, trừ chiết khấu, hỗ trợ thu hồi và chi phí khác. Thu công nợ cũ không tính doanh thu. Lợi nhuận tạm tính chưa gồm khấu hao, lãi vay.','report-note'));
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
function renderEntry(){const grid=el('div',null,'quick-links');for(const [id,title,target]of ROUTES.filter(r=>r[0].startsWith('entry-')&&can(r[2],'read'))){const a=el('a',title);a.href='#'+id;grid.append(a);}$('view').append(grid);}
async function renderAdmin(){
  if(state.user.role!=='admin')throw new Error('Chỉ quản trị được truy cập.');const view=$('view');
  if(state.demo){view.append(el('div','Quản trị tài khoản và phiên đăng nhập chỉ hoạt động trên Apps Script.','notice'));return;}
  try{
    const data=await call('admin',{operation:'list'});if(state.route!=='admin')return;
    const form=el('form',null,'card pad');form.append(el('h3','Cấp / cập nhật tài khoản'));
    const grid=el('div',null,'form-grid'),email=el('input'),role=el('select'),enabled=el('input'),permissions=el('textarea');email.type='email';email.required=true;enabled.type='checkbox';enabled.checked=true;permissions.rows=6;permissions.value='{}';
    for(const v of ['staff','accountant','admin']){const o=el('option',v);o.value=v;role.append(o);}
    for(const [title,input]of [['Email Google',email],['Vai trò',role],['Kích hoạt',enabled],['Quyền JSON, ví dụ {"materials":["read","create"]}',permissions]]){const label=el('label',title,'field');label.append(input);grid.append(label);}form.append(grid);const save=el('button','Lưu tài khoản','button primary');save.type='submit';form.append(save);
    form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await call('admin',{operation:'saveUser',email:email.value,role:role.value,enabled:enabled.checked,permissions:JSON.parse(permissions.value)});await load();route();toast('Đã cập nhật quyền.');}catch(err){errorText(err);}finally{save.disabled=false;}};
    view.append(form,el('h3','Tài khoản được cấp quyền'),makeTable(['Email','Vai trò','Kích hoạt','Quyền'],data.users.map(u=>[u.email,u.role,u.enabled,JSON.stringify(u.permissions)])),el('h3','Phiên & cảnh báo đăng nhập'),makeTable(['Email','Trạng thái','Hết hạn','Thao tác'],data.sessions.map(s=>[s.email,s.status,s.expires,s.status==='active'?button('Thu hồi',async()=>{try{await call('admin',{operation:'revoke',id:s.id});route();}catch(e){errorText(e);}},'button danger'):'—'])));
  }catch(e){errorText(e);}
}
async function renderHealth(){try{const data=await call('health');if(state.route!=='health')return;const view=$('view');view.append(el('p','Đồng bộ gần nhất: '+display(data.lastScan)+' · Sao lưu gần nhất: '+display(data.lastBackup),'muted'));if(data.pending.length)view.append(el('div','Có giao dịch PREPARED. Các thao tác ghi bị chặn đến khi chủ sở hữu kiểm tra và chạy recoverPrepared_.','error'));view.append(makeTable(['Thời điểm','Người dùng','Thao tác','Phân hệ','Mã'],data.audit.map(r=>[r.at,r.user,r.action,r.module,r.recordId])));}catch(e){errorText(e);}}
async function exportModule(module){
  try{const {rows}=await call('export',{module}),keys=[...Object.keys(SCHEMA[module].fields),'recordId','version','updatedAt','updatedBy'];
    const cell=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"';const csv='\uFEFF'+[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(Array.isArray(r[k])?JSON.stringify(r[k]):r[k])).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=el('a');a.href=url;a.download='CHIFAA-'+module+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){errorText(e);}
}
async function refresh(){if(state.busy||$('editor').open)return;state.busy=true;try{await load();nav();route();$('connection').textContent=state.demo?'Xem thử · lưu trong RAM':'Đã đồng bộ '+new Date().toLocaleTimeString('vi-VN');}catch(e){if(e.code==='AUTH')localLogout();else errorText(e);}finally{state.busy=false;}}
function localLogout(){state.token=null;state.data={};state.permissions={};state.user=null;state.issues=[];if($('editor').open)$('editor').close();$('form-fields').replaceChildren();$('view').replaceChildren();$('navigation').replaceChildren();$('workspace').hidden=true;$('login').hidden=false;$('login-status').textContent='Đã đăng xuất. Tải lại trang để đăng nhập lại.';}
$('logout').onclick=async()=>{try{if(!state.demo)await call('logout');localLogout();}catch(e){errorText(e);}};
$('refresh').onclick=refresh;$('menu-toggle').onclick=()=>$('workspace').classList.toggle('menu-open');$('backdrop').onclick=()=>$('workspace').classList.remove('menu-open');window.addEventListener('hashchange',()=>{if(state.user)route();});
setInterval(async()=>{
  if(!state.token||document.hidden||state.busy)return;
  try{const result=await call('sync');if(result.permissionVersion!==state.permissionVersion){if($('editor').open)$('editor').close();$('form-fields').replaceChildren();await refresh();}else if(result.stamp!==state.stamp)await refresh();}
  catch(e){if(e.code==='AUTH')localLogout();else $('connection').textContent='Mất kết nối · chưa đồng bộ';}
},15000);
async function start(){
  if(state.demo){state.user={email:'Bản xem thử trên máy',role:'admin'};for(const m of Object.keys(SCHEMA)){state.data[m]=[];state.permissions[m]=ACTIONS;}mount();return;}
  if(!globalThis.google?.script?.run){$('login-status').textContent='Bản cài đặt cục bộ. Chưa kết nối Google Apps Script.';$('preview-links').hidden=false;return;}
  try{
    const challenge=await rpcCall('challenge');$('login-status').textContent='Chọn tài khoản Google để tiếp tục.';
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onerror=()=>$('login-status').textContent='Không tải được Google Sign-In. Kiểm tra mạng hoặc cấu hình OAuth.';
    script.onload=()=>{google.accounts.id.initialize({client_id:challenge.clientId,nonce:challenge.nonce,callback:async credential=>{
      try{$('login-status').textContent='Đang xác thực quyền truy cập…';const login=await rpcCall('login',{idToken:credential.credential,nonce:challenge.nonce});state.token=login.token;await load();mount();}
      catch(e){$('login-status').textContent=e.message;}
    }});google.accounts.id.renderButton($('google-button'),{theme:'outline',size:'large',text:'signin_with',width:320});};document.head.append(script);
  }catch(e){$('login-status').textContent=e.message;}
}
start();

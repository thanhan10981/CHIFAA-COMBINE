function workflowRows_(){return db_().getSheetByName('_Workflows')?rawRows_('_Workflows'):[];}
function workflowDetails_(row){const value=JSON.parse(row.details);return value?.chunks?readChunkData_(value):value;}
function periodRows_(){return db_().getSheetByName('_Periods')?effective(rawRows_('_Periods')):[];}
function operationalReady_(){return Object.keys(SYSTEM_FIELDS).every(name=>!!db_().getSheetByName(name));}
function requireOperational_(){if(!operationalReady_())throw new Error('CONFIG: Admin mở Nhật ký & đồng bộ → Khởi tạo nghiệp vụ liên kết trước khi ghi phiếu');}
function operationText_(text,required=false){if(typeof text!=='string'||text.length>1000||required&&text.trim().length<5||/^[=+\-@\t\r]/.test(text.trimStart()))throw new Error('VALIDATION: Ghi chú/lý do không hợp lệ');return text;}
function appRow_(user,record){return {...record,recordId:uid_(),version:1,updatedAt:now_(),updatedBy:user.email,source:'APP',deleted:false,reverses:record.reverses||''};}
function newEffect_(module,after){return {module,before:null,after};}
function workflowFind_(kind,id){return effective(workflowRows_()).find(r=>r.kind===kind&&r.referenceId===id);}
function periodGuard_(dates){for(const date of dates.filter(Boolean))if(periodRows_().some(r=>r.status==='closed'&&date>=r.from&&date<=r.to))throw new Error('CLOSED: Ngày '+date+' đã khóa. Admin phải mở lại kỳ, ghi lý do trước khi sửa.');}
function periodRangeGuard_(from,to){if(periodRows_().some(r=>r.status==='closed'&&r.from<=to&&r.to>=from))throw new Error('CLOSED: Khoảng ngày giao với kỳ đã khóa');}
function workflowMarker_(user,kind,referenceId,date,details){return newEffect_('_Workflows',appRow_(user,{date,kind,referenceId,details:JSON.stringify(details)}));}
function stockLinkEffects_(user,kind,row,data){
  requireOperational_();if(workflowFind_(kind,row.recordId))throw new Error('CONFLICT: Phiếu đã liên kết; không tạo lại');
  require_(user,'stock','create');periodGuard_([row.date]);const effects=[],snapshot={total:0,raw:{},recipes:[]};
  if(kind==='production'){
    const qty=row.produced+row.extra,recipes=effective(data.recipes).filter(r=>r.dishId===row.dishId);
    if(qty>0&&!recipes.length)throw new Error('VALIDATION: Chưa có công thức cho món sản xuất');
    for(const recipe of recipes){const c=costRecipe(recipe.recordId,qty,data,row.date);if(c.total==null)throw new Error('VALIDATION: Thiếu giá nhập theo ngày cho '+c.missing.join(', '));snapshot.total+=c.total;snapshot.recipes.push({id:recipe.recordId,version:recipe.version,hash:recipe._hash});for(const [id,q]of Object.entries(c.raw))snapshot.raw[id]=(snapshot.raw[id]||0)+q;}
    const balances=inventory(data,row.date);
    for(const [materialId,quantity]of Object.entries(snapshot.raw)){
      if(effective(data.stock).some(s=>s.materialId===materialId&&(!finite(s.quantity)||s.quantity<0||!validDate(s.date))))throw new Error('STOCK: Phiếu kho nguồn không hợp lệ, cần đối chiếu trước');
      if(effective(data.counts).some(c=>c.materialId===materialId&&c.date>=row.date))throw new Error('CLOSED: Đã kiểm kê vật tư từ ngày sản xuất này trở đi; hoàn tác kiểm kê trước khi ghi hồi tố');
      if((balances.find(r=>r.materialId===materialId)?.balance||0)+1e-8<quantity)throw new Error('STOCK: Không đủ tồn '+materialId+'. Nhập tồn đầu/phiếu nhập trước khi chốt sản xuất.');
      const price=effective(data.stock).filter(r=>r.materialId===materialId&&r.type==='nhap'&&r.date<=row.date&&finite(r.unitCost)).sort((a,b)=>b.date.localeCompare(a.date)||String(b.updatedAt).localeCompare(String(a.updatedAt)))[0]?.unitCost;
      const record={date:row.date,materialId,type:'xuat',quantity,unitCost:price??'',note:'Tự động từ sản xuất '+row.recordId};cleanRecord('stock',record,data);effects.push(newEffect_('stock',appRow_(user,record)));
    }
  }else if(kind==='count'){
    if(effective(data.counts).some(r=>r.materialId===row.materialId&&r.date>row.date))throw new Error('CONFLICT: Đã có kiểm kê sau ngày này; không thêm điều chỉnh hồi tố');
    if(effective(data.counts).some(r=>r.recordId!==row.recordId&&r.materialId===row.materialId&&r.date===row.date))throw new Error('CONFLICT: Một lần kiểm kê cuối ngày/vật tư; đảo phiếu cũ trước khi thay thế');
    const balance=inventory(data,row.date).find(r=>r.materialId===row.materialId)?.balance||0,difference=quantityValue(row.closing-balance,balance);snapshot.before=balance;snapshot.closing=row.closing;snapshot.difference=difference;
    if(difference!==0)effects.push(newEffect_('stock',appRow_(user,{date:row.date,materialId:row.materialId,type:difference>0?'dieu-chinh-tang':'dieu-chinh-giam',quantity:Math.abs(difference),unitCost:'',note:'Điều chỉnh theo kiểm kê '+row.recordId})));
  }else throw new Error('VALIDATION: Loại liên kết không hợp lệ');
  effects.push(workflowMarker_(user,kind,row.recordId,row.date,{snapshot,effects:effects.map(e=>({module:e.module,id:e.after.recordId}))}));return effects;
}
function reverseLinkedEffects_(user,module,row,data){
  kioskReverseGuard_(module,row);
  orderPlanReverseGuard_(module,row);
  const linked=effective(workflowRows_()).filter(w=>{if(w.kind.startsWith('entry-'))return false;try{return workflowDetails_(w).effects?.some(e=>e.module===module&&e.id===row.recordId);}catch(_){return false;}});
  if(linked.length)throw new Error('LINKED: Phiếu tự động; đảo/chấm hủy tại nghiệp vụ nguồn để hoàn tác đồng bộ');
  const kind={production:'production',counts:'count',sales:'debt'}[module],marker=kind&&workflowFind_(kind,row.recordId);if(!marker)return [];
  const details=workflowDetails_(marker),effects=[];
  if(kind==='count'&&effective(data.counts).some(c=>c.materialId===row.materialId&&c.date>row.date))throw new Error('CONFLICT: Đã có kiểm kê sau ngày này; hoàn tác từ kỳ mới nhất trước');
  if(kind==='production'&&Object.keys(details.snapshot?.raw||{}).some(id=>effective(data.counts).some(c=>c.materialId===id&&c.date>=row.date)))throw new Error('CLOSED: Hoàn tác kiểm kê liên quan trước khi đảo sản xuất hồi tố');
  for(const e of details.effects||[]){const original=data[e.module]?.find(r=>r.recordId===e.id);if(!original||!effective(data[e.module]).some(r=>r.recordId===e.id))throw new Error('CONFLICT: Phiếu liên kết không còn hiệu lực');require_(user,e.module,'approve');periodGuard_([original.date]);effects.push(newEffect_(e.module,appRow_(user,{...original,recordId:undefined,reverses:original.recordId})));}
  effects.push(newEffect_('_Workflows',appRow_(user,{date:marker.date,kind:marker.kind,referenceId:marker.referenceId,details:marker.details,reverses:marker.recordId})));return effects;
}
function attachProductionCosts_(rows,user){
  if(!rows.length)return rows;
  if(!allowed_(user,'stock','read')||!allowed_(user,'recipes','read'))return rows;
  const markers=new Map(effective(workflowRows_()).filter(w=>w.kind==='production').map(w=>[w.referenceId,w]));return rows.map(row=>{const w=markers.get(row.recordId);return w?{...row,costSnapshot:workflowDetails_(w).snapshot}:row;});
}
function attachKioskCostPending_(rows){
  const ids=new Set(effective(workflowRows_()).filter(w=>w.kind==='kiosk-sale').map(w=>workflowDetails_(w).saleId));
  return ids.size?rows.map(row=>ids.has(row.recordId)?{...row,costAllocationPending:true}:row):rows;
}
function attendanceOverlap_(row,rows){
  const span=r=>{const minute=t=>Number(t.slice(0,2))*60+Number(t.slice(3)),start=Date.parse(r.date)/60000+minute(r.start);let end=Date.parse(r.date)/60000+minute(r.end);if(end<=start)end+=1440;return {start,end};},a=span(row);
  return effective(rows).some(r=>r.recordId!==row.recordId&&r.employeeId===row.employeeId&&a.start<span(r).end&&span(r).start<a.end);
}
function workflow_(user,args){
  // Recheck current grants even when returning a previously applied request.
  if(['production','count'].includes(args.kind)){const module=args.kind==='production'?'production':'counts';require_(user,module,'read');require_(user,module,'approve');require_(user,'stock','create');}
  else if(args.kind==='payroll'){require_(user,'attendance','read');require_(user,'attendance','approve');require_(user,'employees','read');require_(user,'cash','create');if(args.bonuses?.length)require_(user,'plans','read');}
  else if(args.kind==='interest'){require_(user,'loans','read');require_(user,'loans','approve');require_(user,'cash','create');}
  else if(args.kind==='debt'){require_(user,'debts','read');require_(user,'cash','create');if(args.saleId)require_(user,'sales','read');}
  else if(['close','reopen','undo'].includes(args.kind))requireAdmin_(user);
  else throw new Error('VALIDATION: Nghiệp vụ không tồn tại');
  const request={...args,action:'WORKFLOW'};delete request.token;delete request.proof;delete request.key;
  const previous=replay_(user.email,args.key,request);if(previous)return previous;requireOperational_();
  const sources={production:['production','recipes','materials','stock','counts','dishes'],count:['counts','stock','materials'],payroll:['attendance','employees','cash',...(allowed_(user,'plans','read')?['plans','sales','production','recipes','materials','stock','stores','dishes']:[])],interest:['loans','cash'],debt:['debts','cash',...(args.saleId?['sales','stores','dishes']:[])],close:Object.keys(SCHEMA),reopen:[]}[args.kind];
  const data=data_(sources||Object.keys(SCHEMA));let effects=[];
  if(sources)requireValidSources_(Object.fromEntries(sources.map(m=>[m,data[m]])));
  if(['production','count'].includes(args.kind)){
    const module=args.kind==='production'?'production':'counts';require_(user,module,'approve');require_(user,module,'read');const row=effective(data[module]).find(r=>r.recordId===args.id);if(!row)throw new Error('NOT_FOUND: Không tìm thấy phiếu nguồn');effects=stockLinkEffects_(user,args.kind,row,data);
  }else if(['close','reopen'].includes(args.kind)){
    operationText_(args.note,true);
    requireAdmin_(user);if(!validDate(args.from)||!validDate(args.to)||args.from>args.to||typeof args.note!=='string'||args.note.trim().length<5||args.note.length>1000)throw new Error('VALIDATION: Cần khoảng ngày và lý do tối thiểu 5 ký tự');
    if(args.kind==='close'){
      if(periodRows_().some(r=>r.status==='closed'&&r.from<=args.to&&r.to>=args.from))throw new Error('CONFLICT: Khoảng ngày giao với kỳ đã khóa');
      if(rowsPlain_('_Requests').some(r=>r[3]==='PREPARED'))throw new Error('RECOVERY: Còn giao dịch chưa phục hồi');
      effects=[newEffect_('_Periods',appRow_(user,{from:args.from,to:args.to,status:'closed',note:args.note}))];
    }else{
      const row=periodRows_().find(r=>r.recordId===args.id&&r.status==='closed'&&r.from===args.from&&r.to===args.to);if(!row)throw new Error('NOT_FOUND: Kỳ không còn khóa');effects=[{module:'_Periods',before:row,after:{...row,status:'open',note:args.note,version:row.version+1,updatedAt:now_(),updatedBy:user.email}}];
    }
  }else return financialWorkflow_(user,args,data,request);
  return transact_(user.email,args.key,request,effects);
}

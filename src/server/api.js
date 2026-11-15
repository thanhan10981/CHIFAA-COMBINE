function doGet(){const name=config_('APP_MODE')==='portal'?'Portal':'Index';return HtmlService.createHtmlOutputFromFile(name).setTitle('CHIFAA COMBINE').addMetaTag('viewport','width=device-width, initial-scale=1');}
function rpc(action,args){
  const started=Date.now();args=args||{};
  try{
    let result;
    if(action==='challenge')result=challenge_();
    else if(action==='login')result=login_(args);
    else if(action==='portalCatalog')result=portalCatalog_(args);
    else if(action==='portalOrder')result=locked_(()=>portalOrder_(args));
    else{
      const user=authenticate_(args.token);
      if(action==='bootstrap')result=bootstrap_(user);
      else if(action==='sync')result={stamp:stamp_(),permissionVersion:user.permissionVersion};
      else if(action==='logout')result=locked_(()=>logout_(user,args.token));
      else if(action==='mutate')result=locked_(()=>mutate_(authenticate_(args.token),args));
      else if(action==='admin')result=locked_(()=>admin_(authenticate_(args.token),args));
      else if(action==='health'){requireAdmin_(user);result={stamp:stamp_(),audit:rowsPlain_('_Audit').slice(-100).map(r=>({id:r[0],at:r[1],user:r[2],action:r[3],module:r[4],recordId:r[5]})),pending:rowsPlain_('_Requests').filter(r=>r[3]==='PREPARED').map(r=>({key:r[0],state:r[3],createdAt:r[6]})),lastScan:props_().getProperty('LAST_SCAN'),lastBackup:props_().getProperty('LAST_BACKUP')};}
      else if(action==='export'){require_(user,args.module,'export');require_(user,args.module,'read');result={rows:rawRows_(args.module).map(publicRow_)};}
      else throw new Error('NOT_FOUND: Endpoint không tồn tại');
    }
    console.log(JSON.stringify({event:'rpc',action,ms:Date.now()-started,ok:true}));return {ok:true,data:result};
  }catch(error){
    const message=String(error.message||error),code=message.includes(':')?message.split(':')[0]:'ERROR';
    console.warn(JSON.stringify({event:'rpc',action,ms:Date.now()-started,ok:false,code}));
    return {ok:false,error:{code,message:code==='ERROR'?'Không thể xử lý. Kiểm tra nhật ký Apps Script.':message}};
  }
}
function bootstrap_(user){
  const data={},permissions={};
  for(const module of Object.keys(SCHEMA)){
    permissions[module]=ACTIONS.filter(a=>allowed_(user,module,a));
    if(allowed_(user,module,'read'))data[module]=rawRows_(module).map(publicRow_);
  }
  return {data,permissions,user:{email:user.email,role:user.role},permissionVersion:user.permissionVersion,stamp:stamp_(),accountingApproved:props_().getProperty('ACCOUNTING_APPROVED')==='true'};
}
function mutate_(user,args){
  const module=args.module,action=args.operation;
  require_(user,module,['reverse','reject'].includes(action)?'approve':action);
  if(!['create','update','delete','approve','reject','reverse'].includes(action))throw new Error('VALIDATION: Thao tác không hợp lệ');
  const request={action,module,operation:action,id:args.id||'',record:args.record||null,expectedVersion:args.expectedVersion??null,expectedHash:args.expectedHash||''};
  const previous=replay_(user.email,args.key,request);if(previous)return previous;
  const data=data_(),before=data[module].find(r=>r.recordId===args.id);
  if(action!=='create'){
    if(!before||before.deleted)throw new Error('NOT_FOUND: Phiếu không còn tồn tại');
    if(before.version!==args.expectedVersion||before._hash!==args.expectedHash)throw new Error('CONFLICT: Dữ liệu đã thay đổi. Tải lại và đối chiếu trước khi lưu.');
  }
  if(SCHEMA[module].immutable&&['update','delete'].includes(action))throw new Error('IMMUTABLE: Dùng bút toán đảo rồi lập phiếu mới');
  if(['approve','reject'].includes(action)&&module!=='orders')throw new Error('VALIDATION: Chỉ đơn đặt hàng có bước duyệt');
  if(action==='reverse'&&!SCHEMA[module].immutable)throw new Error('VALIDATION: Bảng này không có bút toán đảo');
  let after;
  if(action==='reverse'){
    if(before.reverses||data[module].some(r=>r.reverses===before.recordId&&!r.deleted))throw new Error('CONFLICT: Phiếu đã đảo');
    after={...before,recordId:uid_(),version:1,reverses:before.recordId};
  }else if(action==='delete'){
    if(module==='orders'&&before.status!=='pending')throw new Error('IMMUTABLE: Không xóa đơn đã xử lý');
    // Reject deleting referenced masters, including references inside recipes.
    for(const [m,s]of Object.entries(SCHEMA))for(const r of effective(data[m]))for(const [k,f]of Object.entries(s.fields)){
      if(f.ref===module&&r[k]===before.recordId)throw new Error('CONFLICT: Dữ liệu đang được tham chiếu');
      if(k==='lines'&&Array.isArray(r.lines)&&r.lines.some(l=>l.id===before.recordId))throw new Error('CONFLICT: Đang nằm trong công thức');
    }
    after={...before,deleted:true,version:before.version+1};
  }else if(['approve','reject'].includes(action)){
    if(before.status!=='pending')throw new Error('CONFLICT: Đơn đã được xử lý');after={...before,status:action==='approve'?'approved':'rejected',version:before.version+1};
  }else{
    if(module==='orders'&&action==='update'&&before.status!=='pending')throw new Error('IMMUTABLE: Đơn đã duyệt không được sửa');
    const record=cleanRecord(module,args.record,data);
    if(module==='orders'&&record.status!=='pending')throw new Error('FORBIDDEN: Tạo đơn ở trạng thái chờ, sau đó dùng Duyệt');
    after={...record,recordId:action==='create'?uid_():before.recordId,version:before?before.version+1:1,deleted:false,reverses:''};
    if(module==='recipes'){
      const recipes=[...data.recipes.filter(r=>r.recordId!==after.recordId),after];
      for(const r of effective(recipes))flattenRecipe(r.recordId,1,recipes);
    }
    if(module==='discounts'&&effective(data.discounts).some(r=>r.recordId!==after.recordId&&r.storeId===after.storeId&&r.dishId===after.dishId))throw new Error('CONFLICT: Trùng điểm bán và món');
    if(module==='attendance'&&effective(data.attendance).some(r=>r.recordId!==after.recordId&&r.date===after.date&&r.employeeId===after.employeeId&&r.start===after.start))throw new Error('CONFLICT: Trùng ca chấm công');
    if(module==='attendance'&&(after.defaultAllowance>0||after.dailyAllowance>0||after.support>0)&&effective(data.attendance).some(r=>r.recordId!==after.recordId&&r.date===after.date&&r.employeeId===after.employeeId&&(r.defaultAllowance>0||r.dailyAllowance>0||r.support>0)))throw new Error('CONFLICT: Phụ cấp / hỗ trợ ngày chỉ ghi một lần cho mỗi nhân viên trong ngày; ca bổ sung nhập các khoản này bằng 0');
    if(module==='cash'){
      const debt=['thu-no','tra-no'].includes(after.category),loan=['vay','tra-vay'].includes(after.category);
      if(debt||loan){
        const related=effective(data[debt?'debts':'loans']).find(r=>r.recordId===after.linkedId);
        if(!related)throw new Error('VALIDATION: Cần ID công nợ / khoản vay hợp lệ');
        const expected=['thu-no','vay'].includes(after.category)?'thu':'chi';
        if(after.direction!==expected)throw new Error('VALIDATION: Thu / chi không khớp nhóm liên kết');
        if(debt&&related.type!==(after.category==='thu-no'?'phai-thu':'phai-tra'))throw new Error('VALIDATION: Sai loại công nợ');
      }else if(after.linkedId)throw new Error('VALIDATION: Chỉ liên kết công nợ / khoản vay cho nhóm phù hợp');
    }
  }
  after.updatedAt=now_();after.updatedBy=user.email;after.source='APP';delete after._hash;delete after._row;
  return transact_(user.email,args.key,request,[{module,before:before||null,after}]);
}

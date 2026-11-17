function doGet(event){
  const p=event?.parameter||{};
  if(config_('APP_MODE')==='internal'&&(Object.hasOwn(p,'state')||Object.hasOwn(p,'code')||Object.hasOwn(p,'error')))return oauthPage_(p);
  const name=config_('APP_MODE')==='portal'?'Portal':'Index';return HtmlService.createHtmlOutputFromFile(name).setTitle('CHIFAA COMBINE').addMetaTag('viewport','width=device-width, initial-scale=1');
}
function rpc(action,args){
  requestBooks_=new Map();requestRows_=new Map();requestTables_=new Map();requestProfile_={};requestConfig_=new Map();requestPropertyHandle_=null;
  const started=Date.now();args=args||{};let actor=null;
  try{
    let result;
    if(action==='publicAsset')result=publicAsset_(args);
    else if(action==='oauthStart')result=oauthStart_(args);
    else if(action==='oauthFinish')result=oauthFinish_(args);
    else if(action==='challenge'||action==='login')throw new Error('AUTH: Luồng đăng nhập cũ đã tắt. Tải lại ứng dụng');
    else if(action==='portalCatalog')result=portalCatalog_(args);
    else if(action==='portalOrder')result=locked_(()=>portalOrder_(args));
    else if(action==='portalStatus')result=portalStatus_(args);
    else{
      const user=timed_('auth',()=>locked_(()=>verifyRequest_(action,args)));
      actor=user.email;
      const readStamp=stamp_();
      if(['bootstrap','list','lookup','record','export','summary','strategySummary','periodSummary','settlements','financialSummary','workflowReports','kioskReport','orderPlans'].includes(action))assertReadable_();
      if(action==='requestStatus')result=locked_(()=>{const current=authenticate_(args.token),status=requestStatus_(current,args.key);audit_(current.email,'READ','rpc','requestStatus',null,{state:status.state});return status;});
      else if(action==='bootstrap')result=bootstrap_(user,args.force===true,args);
      else if(action==='list')result=listPage_(user,args);
      else if(action==='lookup')result=lookupData_(user,args);
      else if(action==='record')result=recordData_(user,args);
      else if(action==='summary')result=summary_(user,args);
      else if(action==='periodSummary')result=periodSummary_(user,args);
      else if(action==='strategySummary')result=strategySummary_(user,args);
      else if(action==='settlements')result=settlements_(user,args);
      else if(action==='sync')result={stamp:stamp_(),moduleVersions:permittedVersions_(user),permissionVersion:user.permissionVersion,grants:hash_({role:user.role,permissions:user.permissions})};
      else if(action==='logout')result=locked_(()=>logout_(user,args.token));
      else if(action==='mutate')result=timed_('mutate',()=>locked_(()=>mutate_(authenticate_(args.token),args)));
      else if(action==='orderPlans')result=orderPlans_(user,args);
      else if(action==='linkOrderPlan')result=locked_(()=>linkOrderPlan_(authenticate_(args.token),args));
      else if(action==='entry')result=locked_(()=>entry_(authenticate_(args.token),args));
      else if(action==='kioskReport')result=kioskReport_(user,args);
      else if(action==='kiosk')result=locked_(()=>kioskWorkflow_(authenticate_(args.token),args));
      else if(action==='workflow')result=locked_(()=>workflow_(authenticate_(args.token),args));
      else if(action==='workflowReports')result=workflowReports_(user,args);
      else if(action==='workflowStatus'){requireAdmin_(user);result={ready:operationalReady_(),periods:periodRows_().map(publicRow_),history:effective(workflowRows_()).filter(w=>['payroll','interest','debt'].includes(w.kind)).slice(-100).map(w=>({recordId:w.recordId,date:w.date,kind:w.kind,referenceId:w.referenceId})),portalConfigured:!!props_().getProperty('PORTAL_SPREADSHEET_ID'),backupConfigured:!!props_().getProperty('BACKUP_FOLDER_ID'),backupFolderId:props_().getProperty('BACKUP_FOLDER_ID')||'',portalSpreadsheetId:props_().getProperty('PORTAL_SPREADSHEET_ID')||'',portalUrl:props_().getProperty('PORTAL_WEB_APP_URL')||''};}
      else if(action==='financialSummary'){if(!['assets','debts','loans'].includes(args.module)||!validDate(args.to))throw new Error('VALIDATION: Bảng/ngày không hợp lệ');require_(user,args.module,'read');const data={[args.module]:rawRows_(args.module),cash:args.module==='assets'?[]:rawRows_('cash')};requireValidSources_(data);if(args.module==='debts')data.debts=attachDebtAllocations_(data.debts);result={rows:finance(data,args.to)[args.module==='assets'?'depreciation':args.module]};}
      else if(action==='maintenance')result=maintenance_(user,args);
      else if(action==='admin')result=locked_(()=>admin_(authenticate_(args.token),args));
      else if(action==='health'){requireAdmin_(user);result={stamp:stamp_(),audit:rowsPlain_('_Audit').slice(-100).map(r=>({id:r[0],at:r[1],user:r[2],action:r[3],module:r[4],recordId:r[5]})),pending:rowsPlain_('_Requests').filter(r=>r[3]==='PREPARED').map(r=>({key:r[0],state:r[3],createdAt:r[6]})),lastScan:props_().getProperty('LAST_SCAN'),lastBackup:props_().getProperty('LAST_BACKUP')};}
      else if(action==='export'){require_(user,args.module,'export');result=listPage_(user,{...args,mode:'snapshot'});}
      else throw new Error('NOT_FOUND: Endpoint không tồn tại');
      if(['bootstrap','list','lookup','record','export','summary','strategySummary','periodSummary','settlements','financialSummary','workflowReports','kioskReport','orderPlans'].includes(action))assertReadable_();
      if(['bootstrap','list','lookup','record','export','summary','strategySummary','periodSummary','settlements','financialSummary','workflowReports','kioskReport','orderPlans'].includes(action)&&readStamp!==stamp_())throw new Error('CONFLICT: Dữ liệu đổi trong lúc đọc. Đồng bộ rồi thử lại.');
      if(['bootstrap','list','lookup','record','export','summary','strategySummary','periodSummary','settlements','health','financialSummary','workflowReports','workflowStatus','kioskReport','orderPlans'].includes(action))audit_(user.email,'READ','rpc',action,null,{module:args.module||args.kind||''});
    }
    const response={ok:true,data:result};
    if(props_().getProperty('PERF_DIAGNOSTICS')==='true'){const at=Date.now(),json=JSON.stringify(result);response.meta={serverMs:Date.now()-started,serializeMs:Date.now()-at,payloadChars:json.length};console.log(JSON.stringify({event:'rpc_payload',action,...response.meta}));}
    console.log(JSON.stringify({event:'rpc',action,ms:Date.now()-started,ok:true}));return response;
  }catch(error){
    const message=String(error.message||error),code=message.includes(':')?message.split(':')[0]:'ERROR';
    if(actor&&['AUTH','FORBIDDEN'].includes(code)){try{audit_(actor,'RPC_DENIED','rpc',action,null,{code});}catch(_){/* Preserve fail-closed response if audit storage is unavailable. */}}
    console.warn(JSON.stringify({event:'rpc',action,ms:Date.now()-started,ok:false,code}));
    return {ok:false,error:{code,message:code==='ERROR'?'Không thể xử lý. Kiểm tra nhật ký Apps Script.':message}};
  }finally{console.log(JSON.stringify({event:'rpc_profile',action,steps:requestProfile_}));requestBooks_=null;requestRows_=null;requestTables_=null;requestProfile_=null;requestConfig_=null;requestPropertyHandle_=null;}
}
function bootstrap_(user,force=false,{shell=false}={}){
  // Called only after fresh session, signature, replay and _Users checks.
  const stamp=stamp_(),approved=props_().getProperty('ACCOUNTING_APPROVED')==='true';
  const key='bootstrap:v1:'+hash_({book:config_('SPREADSHEET_ID'),stamp,approved,shell,email:user.email,role:user.role,permissions:user.permissions,version:user.permissionVersion});
  let cache;
  try{
    cache=CacheService.getScriptCache();
    const saved=force?null:cache.get(key);
    if(saved){const entry=JSON.parse(saved);if(entry.until>Date.now()&&entry.value?.user?.email===user.email)return entry.value;}
  }catch(_){/* Cache is optional; eviction or corruption must fall back to Sheets. */}
  const data={},permissions={},partialModules={},sourceData={};
  if(Array.isArray(user.permissions?._routes))permissions._routes=[...user.permissions._routes];
  for(const module of Object.keys(SCHEMA)){
    permissions[module]=ACTIONS.filter(a=>allowed_(user,module,a));
    if(shell&&allowed_(user,module,'read')){data[module]=[];partialModules[module]={total:null,next:0};continue;}
    if(allowed_(user,module,'read')){const rows=rawRows_(module);sourceData[module]=rows;if(rows.length>200)partialModules[module]={total:rows.length,next:200};const page=rows.slice(0,200).map(publicRow_);data[module]=module==='production'?attachProductionCosts_(page,user):module==='debts'?attachDebtAllocations_(page):module==='loans'?attachLoanPeriods_(page):page;}
  }
  const result={data,issues:sourceIssues(sourceData),partialModules,permissions,user:{email:user.email,role:user.role},permissionVersion:user.permissionVersion,grants:hash_({role:user.role,permissions:user.permissions}),moduleVersions:permittedVersions_(user),stamp,accountingApproved:approved};
  // Never publish a snapshot assembled across a concurrent write.
  if(stamp===stamp_())try{
    const value=JSON.stringify({until:Date.now()+30000,value:result});
    // Worst-case UTF-8 uses at most 3 bytes per UTF-16 code unit.
    if(value.length*3<90000)cache?.put(key,value,30);
  }catch(_){/* Oversized/unavailable caches do not block the application. */}
  return result;
}
function listPage_(user,args){
  if(!Object.hasOwn(SCHEMA,args.module))throw new Error('VALIDATION: Bảng không hợp lệ');require_(user,args.module,'read');
  const offset=args.offset??0,limit=args.limit??50,stamp=stamp_();if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>200)throw new Error('VALIDATION: Trang dữ liệu không hợp lệ');
  if(args.stamp&&args.stamp!==stamp)throw new Error('CONFLICT: Dữ liệu đổi trong lúc phân trang. Đồng bộ rồi thử lại.');
  for(const key of ['from','to'])if(args[key]&&!validDate(args[key]))throw new Error('VALIDATION: Ngày lọc không hợp lệ');
  if(args.search&&(typeof args.search!=='string'||args.search.length>200))throw new Error('VALIDATION: Tìm kiếm tối đa 200 ký tự');
  for(const k of ['kind','department','dishId','materialId','search'])if(args[k]!=null&&(typeof args[k]!=='string'||args[k].length>2000))throw new Error('VALIDATION: Bộ lọc không hợp lệ');
  const selection={module:args.module,offset,limit,from:args.from||'',to:args.to||'',kind:args.kind||'',department:args.department||'',dishId:args.dishId||'',materialId:args.materialId||'',compact:args.compact===true,search:args.search||'',mode:args.mode||'',window:args.window===true};
  const result=scopedCache_(user,'list',moduleVersions_()[args.module],selection,args.force===true,()=>listPageData_(user,args,offset,limit,stamp));return {...result,stamp};
}
function listPageData_(user,args,offset,limit,stamp){
  if(args.mode==='snapshot'&&args.window===true){const window=rawRowsRange_(args.module,offset,limit);let rows=window.rows.map(publicRow_);if(args.module==='production')rows=attachProductionCosts_(rows,user);if(args.module==='debts')rows=attachDebtAllocations_(rows);if(args.module==='loans')rows=attachLoanPeriods_(rows);return {...window,rows,offset,stamp};}
  const indexed=args.mode!=='snapshot'?indexedPage_(args.module,args,offset,limit):null;if(indexed){let rows=indexed.rows.map(publicRow_);if(args.module==='production')rows=attachProductionCosts_(rows,user);if(args.module==='debts')rows=attachDebtAllocations_(rows);if(args.module==='loans')rows=attachLoanPeriods_(rows);if(args.module==='recipes'&&args.compact===true)rows=rows.map(r=>{const {lines,...rest}=r;return {...rest,_detailDeferred:true,lineCount:Array.isArray(lines)?lines.length:null};});return {...indexed,rows,stamp};}
  let rows=rawRows_(args.module);if(args.mode!=='snapshot')rows=rows.filter(r=>!r.deleted&&(!args.from||!r.date||r.date>=args.from)&&(!args.to||!r.date||r.date<=args.to)&&(!args.kind||r.kind===args.kind)&&(!args.search||Object.values(r).some(v=>String(v).toLowerCase().includes(args.search.toLowerCase()))));
  let page=rows.slice(offset,offset+limit).map(publicRow_);if(args.module==='production')page=attachProductionCosts_(page,user);if(args.module==='debts')page=attachDebtAllocations_(page);if(args.module==='loans')page=attachLoanPeriods_(page);
  if(stamp!==stamp_())throw new Error('CONFLICT: Dữ liệu vừa đổi. Đồng bộ rồi thử lại.');return {rows:page,total:rows.length,offset,next:offset+limit<rows.length?offset+limit:null,stamp};
}
function mutationAccess_(user,module,action){
  require_(user,module,['reverse','reject'].includes(action)?'approve':action);
  if(user.role!=='admin'&&Array.isArray(user.permissions?._routes)&&!ROUTES.some(r=>r[2]===module&&user.permissions._routes.includes(r[0])))throw new Error('FORBIDDEN: Quyền phiếu liên kết chỉ dùng qua nghiệp vụ nguồn, không được ghi trực tiếp sổ này');
}
function mutationEffects_(user,args,providedData){
  const module=args.module,action=args.operation;mutationAccess_(user,module,action);
  if(!['create','update','delete','approve','reject','reverse'].includes(action))throw new Error('VALIDATION: Thao tác không hợp lệ');
  const request={action,module,operation:action,id:args.id||'',record:args.record||null,expectedVersion:args.expectedVersion??null,expectedHash:args.expectedHash||''};
  const data=providedData||data_(mutationModules_(module,action)),before=data[module].find(r=>r.recordId===args.id);
  if(action==='create'){
    const sources={production:['production','recipes','materials','stock','counts','dishes'],counts:['counts','stock','materials'],attendance:['attendance','employees'],sales:['sales','stores','dishes'],cash:['cash','debts','loans']}[module];
    if(sources)requireValidSources_(Object.fromEntries(sources.map(m=>[m,data[m]])));
  }
  periodGuard_([args.record?.date,before?.date]);
  if(module==='stock'&&[before,args.record].filter(Boolean).some(s=>effective(data.counts).some(c=>c.materialId===s.materialId&&c.date>=s.date)))throw new Error('CLOSED: Hoàn tác kiểm kê liên quan trước khi đổi phiếu kho hồi tố');
  if(module==='cash'&&action==='reverse'&&before?.category==='tra-vay'&&effective(workflowRows_()).some(w=>w.kind==='interest'&&w.referenceId===before.linkedId&&workflowDetails_(w).to>before.date))throw new Error('CLOSED: Hoàn tác kỳ lãi liên quan trước khi đảo phiếu trả gốc');
  if(module==='attendance'&&effective(workflowRows_()).some(w=>w.kind==='payroll'&&[args.record?.date,before?.date].filter(Boolean).some(d=>{const p=workflowDetails_(w);return d>=p.from&&d<=p.to;})))throw new Error('CLOSED: Kỳ chấm công đã chốt lương; hoàn tác bảng lương trước khi thay đổi');
  if(['loans','debts'].includes(module)&&before&&['update','delete'].includes(action)&&(effective(data.cash).some(c=>c.linkedId===before.recordId)||(before.allocations||[]).length||module==='loans'&&effective(workflowRows_()).some(w=>w.kind==='interest'&&w.referenceId===before.recordId)))throw new Error('LINKED: Đã có thanh toán liên kết; không sửa/xóa giá trị gốc, hãy hoàn tác thanh toán trước');
  if(action!=='create'){
    if(!before||before.deleted)throw new Error('NOT_FOUND: Phiếu không còn tồn tại');
    if(before.version!==args.expectedVersion||before._hash!==args.expectedHash)throw new Error('CONFLICT: Dữ liệu đã thay đổi. Tải lại và đối chiếu trước khi lưu.');
  }
  if(SCHEMA[module].immutable&&['update','delete'].includes(action))throw new Error('IMMUTABLE: Dùng bút toán đảo rồi lập phiếu mới');
  if(module==='orders'&&before?.source==='PORTAL'&&['update','delete'].includes(action))throw new Error('IMMUTABLE: Đơn Portal giữ nguyên nội dung; từ chối rồi yêu cầu khách lập đơn thay thế');
  if(['approve','reject'].includes(action)&&module!=='orders')throw new Error('VALIDATION: Chỉ đơn đặt hàng có bước duyệt');
  if(action==='reverse'&&!SCHEMA[module].immutable)throw new Error('VALIDATION: Bảng này không có bút toán đảo');
  let after;
  if(action==='reverse'){
    if(before.reverses||data[module].some(r=>r.reverses===before.recordId&&!r.deleted))throw new Error('CONFLICT: Phiếu đã đảo');
    after={...before,recordId:uid_(),version:1,reverses:before.recordId};
  }else if(action==='delete'){
    if(module==='orders'&&before.status!=='pending')throw new Error('IMMUTABLE: Không xóa đơn đã xử lý');
    // Reject deleting referenced masters, including references inside recipes.
    for(const [m,s]of Object.entries(SCHEMA))for(const r of effective(data[m]||[]))for(const [k,f]of Object.entries(s.fields)){
      if(f.ref===module&&r[k]===before.recordId)throw new Error('CONFLICT: Dữ liệu đang được tham chiếu');
      if(k==='lines'&&Array.isArray(r.lines)&&r.lines.some(l=>l.id===before.recordId))throw new Error('CONFLICT: Đang nằm trong công thức');
    }
    after={...before,deleted:true,version:before.version+1};
  }else if(['approve','reject'].includes(action)){
    if(before.status!=='pending')throw new Error('CONFLICT: Đơn đã được xử lý');after={...before,status:action==='approve'?'approved':'rejected',version:before.version+1};
  }else{
    if(module==='orders'&&action==='update'&&before.status!=='pending')throw new Error('IMMUTABLE: Đơn đã duyệt không được sửa');
    const record=cleanRecord(module,args.record,data);
    if(module==='materials'&&before&&canonicalUnit(before.unit)!==canonicalUnit(record.unit)&&materialUnitUsed_(before.recordId))throw Error('LINKED: Đơn vị sử dụng đã có dữ liệu liên kết; cần migration đối soát thay vì đổi nhãn lịch sử');
    if(module==='orders'&&record.status!=='pending')throw new Error('FORBIDDEN: Tạo đơn ở trạng thái chờ, sau đó dùng Duyệt');
    after={...record,recordId:action==='create'?uid_():before.recordId,version:before?before.version+1:1,deleted:false,reverses:''};
    if(module==='recipes'){
      const recipes=[...data.recipes.filter(r=>r.recordId!==after.recordId),after];
      for(const r of effective(recipes))flattenRecipe(r.recordId,1,recipes);
    }
    if(module==='discounts'&&effective(data.discounts).some(r=>r.recordId!==after.recordId&&r.storeId===after.storeId&&r.dishId===after.dishId))throw new Error('CONFLICT: Trùng điểm bán và món');
    if(module==='attendance'&&attendanceOverlap_(after,data.attendance))throw new Error('CONFLICT: Ca chấm công giao nhau, kể cả ca qua đêm');
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
      validatePayment_(after,data);
    }
  }
  after.updatedAt=now_();after.updatedBy=user.email;after.source=module==='orders'&&before?.source==='PORTAL'?'PORTAL':'APP';delete after._hash;delete after._row;
  const effects=[{module,before:action==='reverse'?null:before||null,after}];
  if(action==='reverse')effects.push(...reverseLinkedEffects_(user,module,before,data));
  if(action==='create'&&['production','counts'].includes(module))effects.push(...stockLinkEffects_(user,module==='production'?'production':'count',after,data));
  if(module==='sales'&&action==='create'&&after.oldDebtPaid>0)throw new Error('VALIDATION: Thu nợ cũ dùng chức năng Phân bổ thu nợ theo khoản, không nhập gộp trên phiếu doanh thu mới');
  return effects;
}
function mutate_(user,args){
  const module=args.module,action=args.operation;mutationAccess_(user,module,action);
  const request={action,module,operation:action,id:args.id||'',record:args.record||null,expectedVersion:args.expectedVersion??null,expectedHash:args.expectedHash||''};
  const previous=replay_(user.email,args.key,request);if(previous)return previous;
  return transact_(user.email,args.key,request,mutationEffects_(user,args));
}

function createNewDev_(){
  const p=props_();
  if(!p.getProperty('SPREADSHEET_ID')){
    const workbook=SpreadsheetApp.create('CHIFAA COMBINE — DEV');
    p.setProperty('SPREADSHEET_ID',workbook.getId());
  }
  if(!p.getProperty('ADMIN_EMAIL'))p.setProperty('ADMIN_EMAIL',Session.getEffectiveUser().getEmail().toLowerCase());
  if(!p.getProperty('APP_MODE'))p.setProperty('APP_MODE','internal');
  setup_();return {spreadsheetUrl:db_().getUrl(),mode:'DEV — private, no sharing performed'};
}
function setup_(){
  const db=db_(),definitions=schemaDefinitions_();
  // Preflight first. Never overwrite unknown data or rename existing columns silently.
  for(const [name,headers]of Object.entries(definitions)){
    const s=db.getSheetByName(name);
    if(s&&s.getLastRow()&&JSON.stringify(s.getRange(1,1,1,Math.max(s.getLastColumn(),headers.length)).getValues()[0])!==JSON.stringify(headers))throw new Error('SCHEMA: Cột không khớp '+name+'; cần migration có backup');
  }
  for(const [name,headers]of Object.entries(definitions)){
    const s=db.getSheetByName(name)||db.insertSheet(name);
    if(!s.getLastRow())s.getRange(1,1,1,headers.length).setValues([headers]);
    s.setFrozenRows(1);s.getRange(1,1,1,headers.length).setBackground('#17283d').setFontColor('#ffffff').setFontWeight('bold');
    const protect=(range,description)=>{
      const current=s.getProtections(SpreadsheetApp.ProtectionType.RANGE).find(p=>p.getDescription()===description);
      const p=current||range.protect().setDescription(description);p.setWarningOnly(false);
      const owner=Session.getEffectiveUser();p.addEditor(owner);p.removeEditors(p.getEditors().filter(u=>u.getEmail()!==owner.getEmail()));if(p.canDomainEdit())p.setDomainEdit(false);
    };
    if(name.startsWith('_')||SCHEMA[name]?.immutable||name==='orders')protect(s.getRange(1,1,s.getMaxRows(),headers.length),'CHIFAA immutable '+name);
    else{
      protect(s.getRange(1,1,1,headers.length),'CHIFAA header '+name);
      protect(s.getRange(2,1,s.getMaxRows()-1,META.length),'CHIFAA metadata '+name);
      const fields=SCHEMA[name].fields;
      Object.entries(fields).forEach(([key,f],i)=>{
        const range=s.getRange(2,META.length+i+1,s.getMaxRows()-1,1);
        if(['date','time','text','ref','select','lines'].includes(f.type))range.setNumberFormat('@');
        if(f.type==='select')range.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(f.options,true).setAllowInvalid(false).build());
        if(f.type==='number'&&f.min!=null)range.setDataValidation(SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(f.min).setAllowInvalid(false).build());
      });
    }
  }
  const email=config_('ADMIN_EMAIL').toLowerCase();
  if(!users_().some(u=>u.email===email))append_('_Users',[uid_(),email,'admin','{}',true,1]);
  if(!props_().getProperty('APP_MODE'))props_().setProperty('APP_MODE','internal');
  bump_();return {sheets:Object.keys(definitions),version:1};
}
// Called only after verified identity/allowlist, under the session issuance lock.
function ensureAuthRequests_(user){
  authConfig_();
  const db=db_(),headers=['sessionHash','requestId','expires'];
  let sheet=db.getSheetByName('_AuthRequests');
  if(sheet){
    if(JSON.stringify(sheet.getRange(1,1,1,Math.max(sheet.getLastColumn(),headers.length)).getValues()[0])!==JSON.stringify(headers))throw new Error('SCHEMA: Sai cột bảng _AuthRequests; cần chủ sở hữu kiểm tra');
    return;
  }
  requireAdmin_(user);
  sheet=db.insertSheet('_AuthRequests');sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,headers.length).setBackground('#17283d').setFontColor('#ffffff').setFontWeight('bold');
  const protection=sheet.getRange(1,1,sheet.getMaxRows(),headers.length).protect().setDescription('CHIFAA immutable _AuthRequests');
  protection.setWarningOnly(false);const owner=Session.getEffectiveUser();protection.addEditor(owner);
  protection.removeEditors(protection.getEditors().filter(u=>u.getEmail()!==owner.getEmail()));if(protection.canDomainEdit())protection.setDomainEdit(false);
  // Sessions issued before the nonce ledger existed cannot have bootstrapped safely.
  rowsPlain_('_Sessions').forEach((r,i)=>{if(r[4]==='active')table_('_Sessions').getRange(i+2,5).setValue('revoked');});
  audit_(user.email,'AUTH_SCHEMA_MIGRATION','sessions','',null,{created:'_AuthRequests',priorSessionsRevoked:true});
}
function installTriggers_(){
  const id=config_('SPREADSHEET_ID'),triggers=ScriptApp.getProjectTriggers();
  if(!triggers.some(t=>t.getHandlerFunction()==='sheetEdited_'))ScriptApp.newTrigger('sheetEdited_').forSpreadsheet(id).onEdit().create();
  if(!triggers.some(t=>t.getHandlerFunction()==='sheetChanged_'))ScriptApp.newTrigger('sheetChanged_').forSpreadsheet(id).onChange().create();
  if(!triggers.some(t=>t.getHandlerFunction()==='scanSlice_'))ScriptApp.newTrigger('scanSlice_').timeBased().everyMinutes(1).create();
  for(const t of triggers)if(t.getHandlerFunction()==='scanSheets_')ScriptApp.deleteTrigger(t);
  if(props_().getProperty('BACKUP_FOLDER_ID')&&!triggers.some(t=>t.getHandlerFunction()==='backup_'))ScriptApp.newTrigger('backup_').timeBased().everyDays(1).atHour(2).inTimezone('Asia/Ho_Chi_Minh').create();
  if(props_().getProperty('PORTAL_SPREADSHEET_ID')&&props_().getProperty('PORTAL_WEB_APP_URL')&&!triggers.some(t=>t.getHandlerFunction()==='portalSync_'))ScriptApp.newTrigger('portalSync_').timeBased().everyMinutes(5).create();
}
function sheetEdited_(event){
  if(event?.source?.getId()!==config_('SPREADSHEET_ID'))return;const module=event.range?.getSheet()?.getName();
  if(Object.hasOwn(SCHEMA,module)){const range=event.range?.getRow?{start:event.range.getRow(),count:event.range.getNumRows(),column:event.range.getColumn()}:null;try{return scanModules_([module],{direct:true,range});}catch(e){if(String(e.message).startsWith('SCHEMA:'))locked_(()=>bump_([module]));throw e;}}
  if(module?.startsWith('_'))return locked_(()=>bump_());
}
function scanSheets_(){return scanModules_(Object.keys(SCHEMA));}
function backup_(){
  const claim=locked_(()=>{assertReadable_();let lease;try{lease=JSON.parse(props_().getProperty('BACKUP_LEASE')||'null');}catch(_){}if(lease?.until>Date.now())throw new Error('BUSY: Đang tạo bản sao lưu khác');const value={id:uid_(),stamp:stamp_(),until:Date.now()+300000};props_().setProperty('BACKUP_LEASE',JSON.stringify(value));return value;});
  try{
    const folder=privateBackupFolder_(config_('BACKUP_FOLDER_ID')),before=backupManifest_(db_());
    const file=DriveApp.getFileById(config_('SPREADSHEET_ID')).makeCopy('CHIFAA-backup-'+now_().replace(/[:.]/g,'-'),folder);
    const manifest=backupManifest_(SpreadsheetApp.openById(file.getId())),after=backupManifest_(db_());
    // Read audits, replay nonces and session hints may advance during a backup.
    // The actual copy's full known-table manifest is retained for later verification.
    const core=value=>Object.fromEntries(Object.entries(value).filter(([name])=>!['_Audit','_AuthRequests','_Sessions','_Sync'].includes(name)));
    const same=JSON.stringify(core(before))===JSON.stringify(core(manifest))&&JSON.stringify(core(before))===JSON.stringify(core(after));
    return locked_(()=>{const current=JSON.parse(props_().getProperty('BACKUP_LEASE')||'null');if(current?.id!==claim.id)throw new Error('CONFLICT: Lần sao lưu đã hết quyền xác nhận');const verified=same&&claim.stamp===stamp_()&&!props_().getProperty('WRITE_IN_PROGRESS');if(verified)props_().setProperty('LAST_BACKUP',now_());audit_('SYSTEM','BACKUP','backup',file.getId(),null,{manifest,verified,coreConsistent:verified});return {fileId:file.getId(),verified,scope:'Nghiệp vụ/nhật ký giao dịch khớp trước-sau; dấu của các bảng đã biết lấy từ bản sao. Không gồm Script Properties/bảng ngoài schema.'};});
  }finally{locked_(()=>{let current;try{current=JSON.parse(props_().getProperty('BACKUP_LEASE')||'null');}catch(_){}if(current?.id===claim.id)props_().deleteProperty('BACKUP_LEASE');});}
}
function privateBackupFolder_(id){const folder=DriveApp.getFolderById(id),owner=Session.getEffectiveUser().getEmail();if(folder.getSharingAccess()!==DriveApp.Access.PRIVATE||[...folder.getEditors(),...folder.getViewers()].some(u=>u.getEmail()!==owner))throw new Error('FORBIDDEN: Backup chứa toàn bộ dữ liệu; chọn thư mục riêng tư chỉ chủ sở hữu truy cập');return folder;}
function recoverPrepared_(){
  return locked_(()=>{
    const journal=table_('_Requests'),rows=rowsPlain_('_Requests');
    rows.forEach((r,index)=>{
      if(r[3]!=='PREPARED')return;
      const effects=journalEffects_(r[4]);
      for(const e of [...effects].reverse()){
        if(e.before)writeRow_(e.module,e.before);
        else{const row=rawRows_(e.module).find(x=>x.recordId===e.after.recordId);if(row)table_(e.module).deleteRow(row._row);}
      }
      audit_('OWNER','RECOVERY_ROLLBACK','requests',r[0],null,null);journal.getRange(index+2,4).setValue('ROLLED_BACK');
    });bump_();props_().deleteProperty('WRITE_IN_PROGRESS');
  });
}
function restoreToNewWorkbook_(){
  const backup=DriveApp.getFileById(config_('RESTORE_BACKUP_ID'));
  const copy=backup.makeCopy('CHIFAA-RESTORE-REVIEW-'+now_().replace(/[:.]/g,'-'));
  audit_('OWNER','RESTORE_COPY','backup',copy.getId(),null,{backupId:backup.getId()});
  return {reviewSpreadsheetId:copy.getId(),note:'Bản mới chưa được kích hoạt. Kiểm tra số dòng / số dư trước khi đổi SPREADSHEET_ID.'};
}
function previewImport_(bundle,actor='OWNER'){
  if(!bundle||!Array.isArray(bundle.records)||bundle.records.length>500)throw new Error('VALIDATION: Bundle cần records, tối đa 500 bản ghi / lô');
  const data=data_(),stateHash=hash_({stamp:stamp_(),rows:Object.fromEntries(Object.entries(data).map(([m,rows])=>[m,rows.map(r=>r._hash)]))}),effects=[],errors=[],seen=new Set();
  for(const [index,item]of bundle.records.entries()){
    try{
      if(!item||!Object.hasOwn(SCHEMA,item.module)||typeof item.recordId!=='string'||!/^[\w-]{1,100}$/.test(item.recordId))throw new Error('Mã / phân hệ không hợp lệ');
      const unique=item.module+':'+item.recordId;if(seen.has(unique))throw new Error('Trùng mã trong lô');seen.add(unique);
      if(data[item.module].some(r=>r.recordId===item.recordId))throw new Error('Mã đã tồn tại; importer chỉ thêm, không ghi đè');
      const record=cleanRecord(item.module,item.record,data);
      if(record.date)periodGuard_([record.date]);
      if(item.module==='attendance'&&attendanceOverlap_(record,data.attendance))throw new Error('Ca chấm công giao nhau');
      if(item.module==='attendance'&&effective(workflowRows_()).some(w=>w.kind==='payroll'&&workflowDetails_(w).from<=record.date&&workflowDetails_(w).to>=record.date))throw new Error('Kỳ đã chốt lương; hoàn tác bảng lương trước khi nhập thêm');
      if(item.module==='cash')validatePayment_(record,data);
      if(['production','counts'].includes(item.module)&&bundle.linkStock!==true)throw new Error('Cần chọn Tự liên kết kho và đối chiếu phiếu xuất để tránh ghi trùng');
      const after={...record,recordId:item.recordId,version:1,updatedAt:'IMPORT_PREVIEW',updatedBy:actor,source:'MIGRATION',deleted:false,reverses:''};
      data[item.module].push(after);effects.push({module:item.module,before:null,after});
      if(item.module==='materials'&&item.unitSpec){const spec=unitSpecValidate_(item.unitSpec);validateMaterialSpecForRecord_(record,spec);after.unitSpec=spec;effects.push(workflowMarker_({email:actor},'material-units',after.recordId,now_().slice(0,10),{spec,sourceMaterialHash:'MIGRATION'}));}
      if(['production','counts'].includes(item.module)){const linked=stockLinkEffects_({email:actor,role:'admin'},item.module==='production'?'production':'count',after,data);for(const e of linked){effects.push(e);if(data[e.module])data[e.module].push(e.after);}}
    }catch(e){errors.push({index,message:e.message});}
  }
  try{for(const r of effective(data.recipes))flattenRecipe(r.recordId,1,data.recipes);}catch(e){errors.push({module:'recipes',message:e.message});}
  if(effects.length>1000||JSON.stringify(effects).length>1500000)errors.push({message:'Lô phát sinh quá lớn; chia nhỏ trước khi nhập'});
  return {digest:hash_({bundle,stateHash}),count:effects.length,errors,effects,note:'Thứ tự nhập: danh mục → công thức con → công thức cha → phiếu theo ngày tăng dần. Xem cả phiếu tự động để tránh nhập lại kho. Không thay đổi Sheets trong bước preview.'};
}
function applyImport_(bundle,expectedDigest,key,actor='OWNER'){
  return locked_(()=>{
    const request={action:'IMPORT',digest:hash_(bundle),preview:expectedDigest};const prior=replay_(actor,key,request);if(prior)return prior;
    const preview=previewImport_(bundle,actor);if(preview.digest!==expectedDigest||preview.errors.length)throw new Error('VALIDATION: Preview thay đổi hoặc còn lỗi; xem trước lại');
    for(const e of preview.effects)e.after.updatedAt=now_();
    return transact_(actor,key,request,preview.effects);
  });
}
function recoverAdminSessions_(){
  return locked_(()=>{const emails=new Set(users_().filter(u=>u.role==='admin').map(u=>u.email));emails.add(config_('ADMIN_EMAIL').toLowerCase());rowsPlain_('_Sessions').forEach((r,i)=>{if(emails.has(r[1])&&r[4]==='active'){table_('_Sessions').getRange(i+2,5).setValue('revoked');if(r[2])clearSessionCredentials_(r[2]);clearSessionDevice_(r[0]);}});audit_('OWNER','ADMIN_SESSION_RECOVERY','sessions','admins',null,null);});
}
function invite_(storeId,customer,days){
  if(typeof customer!=='string'||customer.length>200)throw new Error('VALIDATION: Tên khách tối đa 200 ký tự');
  if(!Number.isInteger(days)||days<1||days>30)throw new Error('Thời hạn 1–30 ngày');
  if(!rawRows_('stores').some(r=>r.recordId===storeId&&!r.deleted))throw new Error('Điểm bán không tồn tại');
  const payload=Utilities.base64EncodeWebSafe(JSON.stringify({storeId,customer,expires:Date.now()+days*86400000,nonce:uid_()}));
  const signature=Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload,config_('PORTAL_SIGNING_SECRET')));
  return payload+'.'+signature;
}
function invitation_(token){
  if(typeof token!=='string'||token.length>5000)throw new Error('AUTH: Thiếu thư mời');
  const [payload,signature,...rest]=token.split('.'),expected=Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload||'',config_('PORTAL_SIGNING_SECRET')));
  if(rest.length||signature!==expected)throw new Error('AUTH: Thư mời không hợp lệ');
  let value;try{value=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payload)).getDataAsString());}catch(_){throw new Error('AUTH: Thư mời không hợp lệ');}
  if(value.expires<=Date.now()||typeof value.storeId!=='string')throw new Error('AUTH: Thư mời hết hạn');return value;
}
function portalCatalog_(args){
  if(config_('APP_MODE')!=='portal')throw new Error('FORBIDDEN: Cổng khách triển khai riêng');
  const invite=invitation_(args.invite);
  return {dishes:effective(rawRows_('dishes')).filter(r=>r.published).map(r=>({recordId:r.recordId,name:r.name,price:r.price})),store:effective(rawRows_('stores')).find(r=>r.recordId===invite.storeId)?.name||invite.storeId,customer:invite.customer};
}
function portalOrder_(args){
  if(config_('APP_MODE')!=='portal')throw new Error('FORBIDDEN: Cổng khách triển khai riêng');
  const invite=invitation_(args.invite),data={dishes:rawRows_('dishes'),stores:rawRows_('stores')};
  const request={action:'portalOrder',record:args.record,storeId:invite.storeId};
  const actor='INVITE:'+hash_(args.invite).slice(0,20),previous=replay_(actor,args.key,request);if(previous)return previous;
  const recent=rowsPlain_('_Requests').filter(r=>r[1]===actor&&Date.now()-Date.parse(r[6])<3600000);
  if(recent.length>=30)throw new Error('LIMIT: Tối đa 30 đơn / giờ / thư mời');
  const record=cleanRecord('orders',{...args.record,storeId:invite.storeId,status:'pending'},data);
  if(!data.dishes.some(d=>d.recordId===record.dishId&&d.published&&!d.deleted))throw new Error('FORBIDDEN: Món chưa công bố');
  if(record.date<Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyy-MM-dd'))throw new Error('VALIDATION: Không đặt hàng cho ngày đã qua');
  const after={...record,recordId:uid_(),version:1,updatedAt:now_(),updatedBy:actor,source:'PORTAL',deleted:false,reverses:''};
  return transact_(actor,args.key,request,[{module:'orders',before:null,after}]);
}
function publishCatalog_(){
  // Run only in internal editor. The portal project uses a DIFFERENT spreadsheet.
  const target=SpreadsheetApp.openById(config_('PORTAL_SPREADSHEET_ID'));
  if(target.getId()===config_('SPREADSHEET_ID'))throw new Error('CONFIG: Cổng khách phải dùng bảng riêng');
  for(const module of ['dishes','stores']){
    const s=target.getSheetByName(module);if(!s)throw new Error('Cần setup_ dự án portal trước');
    if(JSON.stringify(s.getRange(1,1,1,headers_(module).length).getValues()[0])!==JSON.stringify(headers_(module)))throw new Error('SCHEMA: Sai cột catalog Portal');
    const rows=effective(rawRows_(module)).filter(r=>module!=='dishes'||r.published);
    if(s.getMaxRows()<rows.length+1)s.insertRowsAfter(s.getMaxRows(),rows.length+1-s.getMaxRows());
    if(s.getLastRow()>1)s.getRange(2,1,s.getLastRow()-1,headers_(module).length).clearContent();
    if(rows.length)s.getRange(2,1,rows.length,headers_(module).length).setValues(rows.map(r=>cells_(module,r)));
  }
}
function importPortalOrders_(){
  return locked_(()=>{
    const portal=SpreadsheetApp.openById(config_('PORTAL_SPREADSHEET_ID'));if(portal.getId()===db_().getId())throw new Error('CONFIG: Portal phải dùng workbook riêng');
    const source=effective(rawRows_('orders',portal)),existing=rawRows_('orders'),data=data_(),errors=[];let imported=0,updated=0;
    for(const row of source)try{
      if(!/^[\w-]{1,100}$/.test(row.recordId)||row.source!=='PORTAL'||!String(row.updatedBy).startsWith('INVITE:'))throw new Error('VALIDATION: Metadata đơn Portal không hợp lệ');
      const local=existing.find(r=>r.recordId===row.recordId);
      if(local){
        if(local.source!=='PORTAL'||Object.keys(SCHEMA.orders.fields).filter(k=>k!=='status').some(k=>local[k]!==row[k]))throw new Error('CONFLICT: Nội dung đơn đã thay đổi, cần đối chiếu');
        if(['approved','rejected'].includes(local.status)&&row.status!==local.status){writeRow_('orders',{...row,status:local.status,version:row.version+1,updatedAt:now_()},portal);updated++;}
        continue;
      }
      if(imported>=50)continue;const input={};for(const k of Object.keys(SCHEMA.orders.fields))input[k]=row[k];cleanRecord('orders',input,data);periodGuard_([row.date]);if(row.status!=='pending')throw new Error('VALIDATION: Chỉ nhập đơn đang chờ');
      const request={action:'IMPORT_PORTAL',id:row.recordId,record:input},key='portal-import-'+hash_(row.recordId).slice(0,48);transact_('SYSTEM',key,request,[newEffect_('orders',{...row,version:1})]);existing.push(row);imported++;
    }catch(e){errors.push({id:row.recordId,message:e.message});}
    return {imported,updated,errors};
  });
}
function portalSync_(){
  if(config_('APP_MODE')!=='internal')throw new Error('FORBIDDEN: Chạy đồng bộ tại dự án nội bộ');
  publishCatalog_();const result=importPortalOrders_();props_().setProperty('LAST_PORTAL_SYNC',now_());audit_('SYSTEM','PORTAL_SYNC','orders','',null,result);return result;
}
function portalStatus_(args){
  if(config_('APP_MODE')!=='portal')throw new Error('FORBIDDEN: Cổng khách triển khai riêng');const invite=invitation_(args.invite);
  const row=effective(rawRows_('orders')).find(r=>r.recordId===args.id&&r.storeId===invite.storeId&&r.updatedBy==='INVITE:'+hash_(args.invite).slice(0,20));
  if(!row)throw new Error('NOT_FOUND: Không tìm thấy đơn trong phạm vi thư mời');return {id:row.recordId,date:row.date,quantity:row.quantity,status:row.status,updatedAt:row.updatedAt};
}

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
  const db=db_(),definitions={};
  for(const module of Object.keys(SCHEMA))definitions[module]=headers_(module);
  Object.assign(definitions,{
    _Users:['recordId','email','role','permissions','enabled','permissionVersion'],
    _Sessions:['recordId','email','tokenHash','expires','status','createdAt'],
    _Audit:['recordId','at','user','action','module','subjectId','before','after'],
    _Requests:['key','actor','fingerprint','state','effects','result','createdAt'],
    _Sync:['module','recordId','hash','seenAt']
  });
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
function installTriggers_(){
  const id=config_('SPREADSHEET_ID'),triggers=ScriptApp.getProjectTriggers();
  if(!triggers.some(t=>t.getHandlerFunction()==='sheetEdited_'))ScriptApp.newTrigger('sheetEdited_').forSpreadsheet(id).onEdit().create();
  if(!triggers.some(t=>t.getHandlerFunction()==='scanSheets_'))ScriptApp.newTrigger('scanSheets_').timeBased().everyMinutes(5).create();
  if(props_().getProperty('BACKUP_FOLDER_ID')&&!triggers.some(t=>t.getHandlerFunction()==='backup_'))ScriptApp.newTrigger('backup_').timeBased().everyDays(1).atHour(2).inTimezone('Asia/Ho_Chi_Minh').create();
}
function sheetEdited_(event){if(event?.source?.getId()!==config_('SPREADSHEET_ID'))return;scanSheets_();}
function scanSheets_(){
  return locked_(()=>{
    const data=data_(),seen=rowsPlain_('_Sync'),next=[],changes=[];
    for(const [module,rows]of Object.entries(data)){
      for(const row of rows){
        const old=seen.find(r=>r[0]===module&&r[1]===row.recordId);
        if(!row.recordId){changes.push({module,id:'unknown',issue:'Dòng thiếu ID; thêm mới qua ứng dụng'});continue;}
        if(!old||old[2]!==row._hash){
          let issue='';
          try{const input={};for(const k of Object.keys(SCHEMA[module].fields))input[k]=row[k];cleanRecord(module,input,data);if(module==='recipes')flattenRecipe(row.recordId,1,data.recipes);}catch(e){issue=String(e.message);}
          if(old){
            if(row.source==='SHEETS'||row.updatedAt<=String(old[3])){
              row.version=(Number(row.version)||0)+1;row.updatedAt=now_();row.updatedBy='SHEET_EDITOR';row.source='SHEETS';
              table_(module).getRange(row._row,1,1,META.length).setValues([META.map(k=>row[k]??'')]);
              audit_('SHEET_EDITOR','DIRECT_EDIT',module,row.recordId,null,{issue:issue||null});
            }
          }
          changes.push({module,id:row.recordId,issue});
        }
      }
    }
    for(const old of seen){
      if(!data[old[0]]?.some(r=>r.recordId===old[1])){
        changes.push({module:old[0],id:old[1],issue:'Dòng đã bị xóa trực tiếp khỏi Sheet'});
        audit_('SHEET_EDITOR','DIRECT_ROW_DELETE',old[0],old[1],null,null);
      }
    }
    // Store current hashes after metadata changes. _Sync holds no business payload.
    for(const module of Object.keys(SCHEMA))for(const row of rawRows_(module))next.push([module,row.recordId,row._hash,now_()]);
    const sheet=table_('_Sync');if(sheet.getLastRow()>1)sheet.getRange(2,1,sheet.getLastRow()-1,4).clearContent();
    if(next.length)sheet.getRange(2,1,next.length,4).setValues(next);
    if(changes.length)bump_();props_().setProperty('LAST_SCAN',now_());
    console.log(JSON.stringify({event:'sync',changes:changes.length,invalid:changes.filter(c=>c.issue).length}));return changes;
  });
}
function backup_(){
  return locked_(()=>{
    const folder=DriveApp.getFolderById(config_('BACKUP_FOLDER_ID'));
    const file=DriveApp.getFileById(config_('SPREADSHEET_ID')).makeCopy('CHIFAA-backup-'+now_().replace(/[:.]/g,'-'),folder);
    props_().setProperty('LAST_BACKUP',now_());audit_('SYSTEM','BACKUP','backup',file.getId(),null,null);return {fileId:file.getId()};
  });
}
function recoverPrepared_(){
  return locked_(()=>{
    const journal=table_('_Requests'),rows=rowsPlain_('_Requests');
    rows.forEach((r,index)=>{
      if(r[3]!=='PREPARED')return;
      const effects=JSON.parse(r[4]);
      for(const e of [...effects].reverse()){
        if(e.before)writeRow_(e.module,e.before);
        else{const row=rawRows_(e.module).find(x=>x.recordId===e.after.recordId);if(row)table_(e.module).deleteRow(row._row);}
      }
      audit_('OWNER','RECOVERY_ROLLBACK','requests',r[0],null,null);journal.getRange(index+2,4).setValue('ROLLED_BACK');
    });bump_();
  });
}
function restoreToNewWorkbook_(){
  const backup=DriveApp.getFileById(config_('RESTORE_BACKUP_ID'));
  const copy=backup.makeCopy('CHIFAA-RESTORE-REVIEW-'+now_().replace(/[:.]/g,'-'));
  audit_('OWNER','RESTORE_COPY','backup',copy.getId(),null,{backupId:backup.getId()});
  return {reviewSpreadsheetId:copy.getId(),note:'Bản mới chưa được kích hoạt. Kiểm tra số dòng / số dư trước khi đổi SPREADSHEET_ID.'};
}
function previewImport_(bundle){
  if(!bundle||!Array.isArray(bundle.records)||bundle.records.length>500)throw new Error('VALIDATION: Bundle cần records, tối đa 500 bản ghi / lô');
  const data=data_(),effects=[],errors=[],seen=new Set();
  for(const [index,item]of bundle.records.entries()){
    try{
      if(!item||!Object.hasOwn(SCHEMA,item.module)||typeof item.recordId!=='string'||!/^[\w-]{1,100}$/.test(item.recordId))throw new Error('Mã / phân hệ không hợp lệ');
      const unique=item.module+':'+item.recordId;if(seen.has(unique))throw new Error('Trùng mã trong lô');seen.add(unique);
      if(data[item.module].some(r=>r.recordId===item.recordId))throw new Error('Mã đã tồn tại; importer chỉ thêm, không ghi đè');
      const record=cleanRecord(item.module,item.record,data);
      const after={...record,recordId:item.recordId,version:1,updatedAt:'IMPORT_PREVIEW',updatedBy:'OWNER',source:'MIGRATION',deleted:false,reverses:''};
      data[item.module].push(after);effects.push({module:item.module,before:null,after});
    }catch(e){errors.push({index,message:e.message});}
  }
  try{for(const r of effective(data.recipes))flattenRecipe(r.recordId,1,data.recipes);}catch(e){errors.push({module:'recipes',message:e.message});}
  return {digest:hash_(bundle),count:effects.length,errors,effects,note:'Thứ tự nhập: danh mục → công thức con → công thức cha → phiếu. Không thay đổi Sheets trong bước preview.'};
}
function applyImport_(bundle,expectedDigest,key){
  return locked_(()=>{
    const request={action:'IMPORT',digest:hash_(bundle)},actor='OWNER';const prior=replay_(actor,key,request);if(prior)return prior;
    const preview=previewImport_(bundle);if(preview.digest!==expectedDigest||preview.errors.length)throw new Error('VALIDATION: Preview thay đổi hoặc còn lỗi');
    for(const e of preview.effects)e.after.updatedAt=now_();
    return transact_(actor,key,request,preview.effects);
  });
}
function recoverAdminSessions_(){
  return locked_(()=>{const email=config_('ADMIN_EMAIL').toLowerCase();rowsPlain_('_Sessions').forEach((r,i)=>{if(r[1]===email&&r[4]==='active')table_('_Sessions').getRange(i+2,5).setValue('revoked');});audit_('OWNER','ADMIN_SESSION_RECOVERY','sessions',email,null,null);});
}
function invite_(storeId,customer,days){
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
    const rows=effective(rawRows_(module)).filter(r=>module!=='dishes'||r.published);
    if(s.getLastRow()>1)s.getRange(2,1,s.getLastRow()-1,headers_(module).length).clearContent();
    if(rows.length)s.getRange(2,1,rows.length,headers_(module).length).setValues(rows.map(r=>cells_(module,r)));
  }
}
function importPortalOrders_(){
  return locked_(()=>{
    const source=SpreadsheetApp.openById(config_('PORTAL_SPREADSHEET_ID')).getSheetByName('orders');
    if(!source||source.getLastRow()<2)return {imported:0};
    const headers=headers_('orders'),existing=new Set(rawRows_('orders').map(r=>r.recordId));let count=0;
    for(const cells of source.getRange(2,1,source.getLastRow()-1,headers.length).getValues()){
      const row={};headers.forEach((h,i)=>row[h]=cells[i]);if(existing.has(row.recordId))continue;
      const input={};for(const k of Object.keys(SCHEMA.orders.fields))input[k]=row[k];
      cleanRecord('orders',input,data_());if(input.status!=='pending')throw new Error('Chỉ nhập đơn đang chờ');
      writeRow_('orders',row);audit_('SYSTEM','IMPORT_PORTAL','orders',row.recordId,null,row);existing.add(row.recordId);count++;
    }if(count)bump_();return {imported:count};
  });
}

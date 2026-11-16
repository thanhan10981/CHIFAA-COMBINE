function maintenance_(user,args){
  requireAdmin_(user);authConfig_();
  if(args.operation==='initialize')return locked_(()=>{const result=setup_();audit_(user.email,'WORKFLOW_SETUP','system','',null,result);return result;});
  if(args.operation==='backup')return backup_();
  if(args.operation==='createBackupFolder'){
    if(props_().getProperty('BACKUP_FOLDER_ID'))return {folderId:privateBackupFolder_(config_('BACKUP_FOLDER_ID')).getId()};
    const folder=DriveApp.createFolder('CHIFAA-DEV-BACKUPS-'+now_().slice(0,10));props_().setProperty('BACKUP_FOLDER_ID',folder.getId());audit_(user.email,'CREATE_BACKUP_FOLDER','system',folder.getId(),null,null);return {folderId:folder.getId()};
  }
  if(args.operation==='createPortalWorkbook'){
    if(props_().getProperty('PORTAL_SPREADSHEET_ID'))throw new Error('CONFLICT: Đã có workbook Portal; kiểm tra cấu hình trước khi tạo thêm');
    const book=SpreadsheetApp.create('CHIFAA COMBINE — PORTAL DEV');
    for(const [name,headers]of Object.entries({dishes:headers_('dishes'),stores:headers_('stores'),orders:headers_('orders'),_Requests:['key','actor','fingerprint','state','effects','result','createdAt'],_Audit:['recordId','at','user','action','module','subjectId','before','after']})){
      const sheet=book.getSheetByName(name)||book.insertSheet(name);sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1);const p=sheet.getRange(1,1,sheet.getMaxRows(),headers.length).protect().setDescription('CHIFAA Portal '+name);p.setWarningOnly(false);const owner=Session.getEffectiveUser();p.addEditor(owner);p.removeEditors(p.getEditors().filter(u=>u.getEmail()!==owner.getEmail()));if(p.canDomainEdit())p.setDomainEdit(false);
    }
    props_().setProperty('PORTAL_SPREADSHEET_ID',book.getId());if(!props_().getProperty('PORTAL_SIGNING_SECRET'))props_().setProperty('PORTAL_SIGNING_SECRET',uid_()+uid_());publishCatalog_();audit_(user.email,'CREATE_PORTAL_WORKBOOK','system',book.getId(),null,null);return {spreadsheetId:book.getId(),url:book.getUrl(),note:'Workbook riêng đã tạo. Cần triển khai dự án Apps Script Portal riêng, APP_MODE=portal, SPREADSHEET_ID là ID này và cùng khóa ký lấy trực tiếp trong Script Properties. Không gửi khóa qua chat.'};
  }
  if(args.operation==='installTriggers'){installTriggers_();return {installed:true};}
  if(args.operation==='previewImport')return previewImport_(args.bundle,user.email);
  if(args.operation==='applyImport')return applyImport_(args.bundle,args.digest,args.key,user.email);
  if(args.operation==='recover')return recoverPrepared_();
  if(args.operation==='restore'){
    if(typeof args.backupId!=='string'||!/^[\w-]{10,200}$/.test(args.backupId))throw new Error('VALIDATION: Cần ID bản sao lưu');
    if(!rowsPlain_('_Audit').some(r=>r[3]==='BACKUP'&&r[5]===args.backupId))throw new Error('FORBIDDEN: Chỉ phục hồi bản backup trong nhật ký của hệ thống');
    const backup=DriveApp.getFileById(args.backupId),copy=backup.makeCopy('CHIFAA-RESTORE-REVIEW-'+now_().replace(/[:.]/g,'-'));audit_(user.email,'RESTORE_COPY','backup',copy.getId(),null,{backupId:args.backupId});return {reviewSpreadsheetId:copy.getId(),note:'Chỉ tạo bản kiểm tra, chưa đổi nguồn dữ liệu ứng dụng.'};
  }
  if(args.operation==='configure'){
    const updates={};
    if(args.PORTAL_WEB_APP_URL){if(typeof args.PORTAL_WEB_APP_URL!=='string'||!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(args.PORTAL_WEB_APP_URL))throw new Error('VALIDATION: URL Portal phải là Web App Apps Script /exec riêng');updates.PORTAL_WEB_APP_URL=args.PORTAL_WEB_APP_URL;}
    for(const name of ['BACKUP_FOLDER_ID','PORTAL_SPREADSHEET_ID'])if(args[name]){if(typeof args[name]!=='string'||!/^[\w-]{10,200}$/.test(args[name])||args[name]===config_('SPREADSHEET_ID'))throw new Error('VALIDATION: ID thư mục/bảng Portal không hợp lệ');if(name==='BACKUP_FOLDER_ID')privateBackupFolder_(args[name]);else{const book=SpreadsheetApp.openById(args[name]);for(const module of ['dishes','stores','orders']){const s=book.getSheetByName(module);if(!s||JSON.stringify(s.getRange(1,1,1,headers_(module).length).getValues()[0])!==JSON.stringify(headers_(module)))throw new Error('SCHEMA: Cần setup workbook Portal riêng trước');}}updates[name]=args[name];}
    for(const [name,value]of Object.entries(updates))props_().setProperty(name,value);
    audit_(user.email,'CONFIGURE_OPERATIONS','system','',null,{backup:!!args.BACKUP_FOLDER_ID,portal:!!args.PORTAL_SPREADSHEET_ID});return {saved:true};
  }
  if(args.operation==='portalSync')return portalSync_();
  if(args.operation==='invite'){requireOperational_();return {invite:invite_(args.storeId,args.customer||'',Number(args.days))};}
  throw new Error('VALIDATION: Thao tác bảo trì không hợp lệ');
}

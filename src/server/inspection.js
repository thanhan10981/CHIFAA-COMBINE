function schemaDefinitions_(){
  const definitions={};for(const m of [...Object.keys(SCHEMA),...Object.keys(SYSTEM_FIELDS)])definitions[m]=headers_(m);
  return {...definitions,_Users:['recordId','email','role','permissions','enabled','permissionVersion'],_Sessions:['recordId','email','tokenHash','expires','status','createdAt'],_Audit:['recordId','at','user','action','module','subjectId','before','after'],_Requests:['key','actor','fingerprint','state','effects','result','createdAt'],_Sync:['module','recordId','hash','seenAt'],_AuthRequests:['sessionHash','requestId','expires']};
}
function inspectSchema_(){
  assertReadable_();const book=db_(),rows=Object.entries(schemaDefinitions_()).map(([name,expected])=>{
    const sheet=book.getSheetByName(name),actual=sheet&&sheet.getLastRow()?profileValues_('schema:'+name,sheet.getRange(1,1,1,Math.max(expected.length,sheet.getLastColumn())))[0]:[];
    return {name,status:!sheet?'missing':!actual.length?'empty':JSON.stringify(actual)===JSON.stringify(expected)?'matches':'mismatch',expected,actual};
  });return {rows,ready:rows.every(r=>r.status==='matches'),readOnly:true,note:'Chỉ kiểm tra. Thiếu bảng dùng khởi tạo DEV; sai cột phải backup và lập migration riêng, không ghi đè header.'};
}
function backupManifest_(book){
  const names=Object.keys(schemaDefinitions_()),manifest={};let cells=0;
  for(const name of names){const sheet=book.getSheetByName(name);if(!sheet){manifest[name]={missing:true};continue;}const rows=sheet.getLastRow(),columns=sheet.getLastColumn();cells+=rows*columns;
    if(cells>2500000)throw new Error('LIMIT: Bản kiểm tra vượt 2,5 triệu ô; cần kiểm tra theo lô riêng');
    const values=rows&&columns?profileValues_('verify:'+name,sheet.getRange(1,1,rows,columns)):[];
    manifest[name]={rows,columns,hash:hash_(values.map(row=>row.map(v=>v instanceof Date?v.toISOString():v)))};
  }return manifest;
}
function verifyBackup_(id){
  if(typeof id!=='string'||!/^[\w-]{10,200}$/.test(id))throw new Error('VALIDATION: Mã backup không hợp lệ');
  const audit=rowsPlain_('_Audit').find(r=>r[3]==='BACKUP'&&r[5]===id);if(!audit)throw new Error('FORBIDDEN: Chỉ kiểm tra backup trong nhật ký hệ thống');
  let expected,metadata;try{metadata=JSON.parse(audit[7]||'null');expected=metadata?.manifest;}catch(_){}
  if(!expected)return {verified:false,reason:'Bản cũ chưa có dấu kiểm tra; không thể xác nhận chỉ từ ID.',tables:[]};
  const actual=backupManifest_(SpreadsheetApp.openById(id)),tables=Object.keys(expected).map(name=>({name,rows:actual[name]?.rows??0,matches:JSON.stringify(actual[name])===JSON.stringify(expected[name])}));
  return {verified:metadata.verified===true&&tables.every(t=>t.matches),tables,...(metadata.verified!==true?{reason:'Nguồn thay đổi hoặc lần tạo chưa xác nhận nhất quán. Không dùng bản này để phục hồi.'}:{}),scope:'Các bảng nghiệp vụ và nhật ký đã biết; không gồm cache, Script Properties hoặc bảng ngoài schema.'};
}
function inspectSources_(args){
  assertReadable_();const stamp=stamp_(),modules=args.module?[args.module]:Object.keys(SCHEMA);if(modules.some(m=>!Object.hasOwn(SCHEMA,m)))throw new Error('VALIDATION: Phân hệ không hợp lệ');
  const offset=args.offset??0;if(!Number.isInteger(offset)||offset<0)throw new Error('VALIDATION: Trang không hợp lệ');
  const dependencies=[...new Set(modules.flatMap(m=>mutationModules_(m,'create')))];
  const issues=sourceIssues(data_(dependencies)).filter(i=>modules.includes(i.module));
  assertReadable_();if(stamp!==stamp_())throw new Error('CONFLICT: Dữ liệu đổi trong lúc kiểm tra; thử lại');
  return {rows:issues.slice(offset,offset+100),total:issues.length,next:offset+100<issues.length?offset+100:null,modules,checkedAt:now_(),stamp,readOnly:true};
}

const ENTRY_MODULES=['production','sales','stock','counts','attendance','cash'];
function entryGroup_(module,r){
  const fields={production:['date','dishId'],sales:['date','storeId','dishId'],stock:['date','materialId','type'],counts:['date','materialId'],attendance:['date','employeeId'],cash:['date','direction','account','category','linkedId']}[module];
  return JSON.stringify(fields.map(k=>r[k]));
}
function entry_(user,args){
  const {module,command}=args;if(!ENTRY_MODULES.includes(module)||!['NEW','BACKFILL','APPEND','CORRECT'].includes(command))throw new Error('VALIDATION: Loại nhập không hợp lệ');
  mutationAccess_(user,module,'create');require_(user,module,'read');if(command==='CORRECT')mutationAccess_(user,module,'reverse');
  const note=operationText_(args.note||'',command!=='NEW'),request={action:'ENTRY',module,command,id:args.id||'',expectedVersion:args.expectedVersion??null,expectedHash:args.expectedHash||'',record:args.record,note,digest:args.digest||''};
  if(!args.preview){const previous=replay_(user.email,args.key,request);if(previous)return previous;}
  requireOperational_();const modules=mutationModules_(module,command==='CORRECT'?'reverse':'create'),original=data_(modules),data=Object.fromEntries(Object.entries(original).map(([m,rows])=>[m,[...rows]]));requireValidSources_(data);
  const record=cleanRecord(module,args.record,data),source=effective(data[module]).find(r=>r.recordId===args.id);
  const today=Utilities.formatDate(new Date(),'Asia/Ho_Chi_Minh','yyyy-MM-dd');
  if(command==='BACKFILL'&&record.date>=today)throw new Error('VALIDATION: Nhập bù dùng ngày trước hôm nay');
  if(['APPEND','CORRECT'].includes(command)){
    if(!source)throw new Error('NOT_FOUND: Phiếu gốc không còn hiệu lực');
    if(source.version!==args.expectedVersion||source._hash!==args.expectedHash)throw new Error('CONFLICT: Phiếu gốc đã thay đổi');
    if(command==='APPEND'&&entryGroup_(module,source)!==entryGroup_(module,record))throw new Error('VALIDATION: Phiếu bổ sung phải cùng ngày và đối tượng với phiếu gốc');
  }else if(['production','sales','counts'].includes(module)&&effective(data[module]).some(r=>entryGroup_(module,r)===entryGroup_(module,record)))throw new Error('CONFLICT: Ngày/đối tượng đã có phiếu. Chọn Bổ sung hoặc Điều chỉnh thay vì nhập mới');
  const digest=hash_({module,command,id:args.id||'',record,note,sources:Object.fromEntries(Object.entries(original).map(([m,rows])=>[m,rows.map(r=>[r.recordId,r.version,r._hash])])),workflows:workflowRows_().map(r=>[r.recordId,r._hash])});
  let effects=[];
  if(command==='CORRECT'){
    effects=mutationEffects_(user,{module,operation:'reverse',id:source.recordId,expectedVersion:source.version,expectedHash:source._hash},data);
    for(const e of effects)if(data[e.module])data[e.module].push(e.after);
  }
  effects.push(...mutationEffects_(user,{module,operation:'create',record},data));
  const sourceRecord=source?Object.fromEntries(Object.keys(SCHEMA[module].fields).map(k=>[k,source[k]])):{};
  const diff=Object.keys(SCHEMA[module].fields).filter(k=>JSON.stringify(sourceRecord[k])!==JSON.stringify(record[k])).map(field=>({field,before:sourceRecord[field]??null,after:record[field]}));
  const preview={command,scope:command==='CORRECT'?'replace-one-voucher':command==='APPEND'?'additional-voucher':'new-voucher',sourceId:source?.recordId||'',before:sourceRecord,after:record,diff,effects:effects.map(e=>({module:e.module,operation:e.after.reverses?'reverse':'create'}))};
  if(args.preview)return {preview,digest};
  if(args.digest!==digest)throw new Error('CONFLICT: Dữ liệu đã đổi sau bản xem trước. Xem trước lại trước khi ghi');
  effects.push(workflowMarker_(user,'entry-'+command.toLowerCase(),effects.find(e=>e.module===module&&!e.after.reverses).after.recordId,record.date,{sourceId:source?.recordId||'',scope:preview.scope,note,diff,effects:effects.map(e=>({module:e.module,id:e.after.recordId}))}));
  return transact_(user.email,args.key,request,effects);
}

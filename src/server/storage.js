/* Apps Script V8. All helper names end in _ and cannot be called through google.script.run. */
function props_() { return PropertiesService.getScriptProperties(); }
function config_(name) { const v=props_().getProperty(name); if(!v) throw new Error('CONFIG: Thiếu Script Property '+name); return v; }
function db_() { return SpreadsheetApp.openById(config_('SPREADSHEET_ID')); }
function hash_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,typeof value==='string'?value:JSON.stringify(value)).map(b=>('0'+(b&255).toString(16)).slice(-2)).join(''); }
function now_() { return new Date().toISOString(); }
function uid_() { return Utilities.getUuid(); }
function locked_(fn) { const l=LockService.getScriptLock(); if(!l.tryLock(15000)) throw new Error('BUSY: Hệ thống đang ghi, thử lại sau'); try{return fn();}finally{l.releaseLock();} }
function headers_(module) { return [...META,...Object.keys(SCHEMA[module].fields)]; }
function table_(name) { const s=db_().getSheetByName(name); if(!s) throw new Error('CONFIG: Chưa setup bảng '+name); return s; }
function append_(name,row) { table_(name).appendRow(row); }
function stamp_() { return props_().getProperty('SYNC_VERSION') || '0'; }
function bump_() { props_().setProperty('SYNC_VERSION',uid_()); }
function rawRows_(module) {
  const s=table_(module),headers=headers_(module);
  if(JSON.stringify(s.getRange(1,1,1,headers.length).getValues()[0])!==JSON.stringify(headers)) throw new Error('SCHEMA: Sai cột bảng '+module);
  if(s.getLastRow()<2) return [];
  if(s.getLastRow()>5001) throw new Error('LIMIT: Bảng vượt 5000 dòng, cần phân trang trước khi mở rộng');
  return s.getRange(2,1,s.getLastRow()-1,headers.length).getValues().map((cells,i)=>{
    if(cells.every(c=>c===''))return null;
    const row={}; headers.forEach((h,j)=>{row[h]=cells[j] instanceof Date?Utilities.formatDate(cells[j],'Asia/Ho_Chi_Minh',SCHEMA[module].fields[h]?.type==='time'?'HH:mm':'yyyy-MM-dd'):cells[j];});
    row.deleted=row.deleted===true;row.version=Number(row.version);
    for(const [k,f]of Object.entries(SCHEMA[module].fields)){
      if(f.type==='lines' && typeof row[k]==='string'){try{row[k]=JSON.parse(row[k]);}catch(_){row[k]=null;}}
      if(f.type==='boolean')row[k]=row[k]===true;
    }
    row._hash=hash_(cells.map(v=>v instanceof Date?v.toISOString():v)); row._row=i+2;
    return row;
  }).filter(Boolean);
}
function data_() { const data={};for(const m of Object.keys(SCHEMA))data[m]=rawRows_(m);return data; }
function publicRow_(row) { const copy={...row};delete copy._row;return copy; }
function cells_(module,row) { return headers_(module).map(k=>{const v=row[k]??'';return Array.isArray(v)?JSON.stringify(v):v;}); }
function writeRow_(module,row) {
  const s=table_(module),found=rawRows_(module).find(r=>r.recordId===row.recordId),cells=cells_(module,row);
  if(found)s.getRange(found._row,1,1,cells.length).setValues([cells]);else s.appendRow(cells);
}
function audit_(user,action,module,id,before,after) {
  append_('_Audit',[uid_(),now_(),user,action,module,id,JSON.stringify(before||null),JSON.stringify(after||null)]);
}
function rowsPlain_(name) { const s=table_(name);return s.getLastRow()>1?s.getRange(2,1,s.getLastRow()-1,s.getLastColumn()).getValues():[]; }
function transact_(actor,key,request,effects) {
  if(typeof key!=='string'||!/^[\w-]{16,100}$/.test(key))throw new Error('VALIDATION: Cần idempotencyKey');
  const fingerprint=hash_(request),existing=rowsPlain_('_Requests').find(r=>r[0]===key);
  if(existing){
    if(existing[1]!==actor || existing[2]!==fingerprint)throw new Error('CONFLICT: Khóa đã dùng cho yêu cầu khác');
    if(existing[3]==='APPLIED')return JSON.parse(existing[5]);
    throw new Error('RECOVERY: Yêu cầu trước chưa hoàn tất; cần quản trị kiểm tra');
  }
  if(rowsPlain_('_Requests').some(r=>r[3]==='PREPARED'))throw new Error('RECOVERY: Có giao dịch chờ khôi phục');
  const serialized=JSON.stringify(effects);
  if(serialized.length>45000)throw new Error('LIMIT: Lô quá lớn cho journal Sheet; chia nhỏ lô nhập');
  const journal=table_('_Requests');
  journal.appendRow([key,actor,fingerprint,'PREPARED',serialized,'',now_()]);
  const index=journal.getLastRow();
  SpreadsheetApp.flush();
  try{
    for(const e of effects){writeRow_(e.module,e.after);audit_(actor,request.action,e.module,e.after.recordId,e.before,e.after);}
    SpreadsheetApp.flush();bump_();
    const result={ids:effects.map(e=>e.after.recordId),stamp:stamp_()};
    journal.getRange(index,6).setValue(JSON.stringify(result));journal.getRange(index,4).setValue('APPLIED');
    return result;
  }catch(error){
    try{
      for(const e of [...effects].reverse()){
        if(e.before)writeRow_(e.module,e.before);
        else{const r=rawRows_(e.module).find(r=>r.recordId===e.after.recordId);if(r)table_(e.module).deleteRow(r._row);}
      }
      audit_(actor,'ROLLBACK',request.module||'',key,null,{message:String(error)});
      journal.getRange(index,4).setValue('ROLLED_BACK');bump_();
    }catch(_){/* PREPARED remains: block all writes until explicit recovery. */}
    throw error;
  }
}
function replay_(actor,key,request){
  const row=rowsPlain_('_Requests').find(r=>r[0]===key);
  if(!row)return null;
  if(row[1]!==actor||row[2]!==hash_(request))throw new Error('CONFLICT: Khóa đã dùng cho yêu cầu khác');
  if(row[3]!=='APPLIED')throw new Error('RECOVERY: Cần kiểm tra yêu cầu trước');
  return JSON.parse(row[5]);
}

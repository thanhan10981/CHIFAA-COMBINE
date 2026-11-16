/* Apps Script V8. All helper names end in _ and cannot be called through google.script.run. */
function props_() { return PropertiesService.getScriptProperties(); }
function config_(name) { const v=props_().getProperty(name); if(!v) throw new Error('CONFIG: Thiếu Script Property '+name); return v; }
let requestBooks_=null;
function db_() { const id=config_('SPREADSHEET_ID');if(!requestBooks_)return SpreadsheetApp.openById(id);if(!requestBooks_.has(id))requestBooks_.set(id,SpreadsheetApp.openById(id));return requestBooks_.get(id); }
function hash_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,typeof value==='string'?value:JSON.stringify(value)).map(b=>('0'+(b&255).toString(16)).slice(-2)).join(''); }
function now_() { return new Date().toISOString(); }
function uid_() { return Utilities.getUuid(); }
function locked_(fn) { const l=LockService.getScriptLock(); if(!l.tryLock(15000)) throw new Error('BUSY: Hệ thống đang ghi, thử lại sau'); try{return fn();}finally{l.releaseLock();} }
const SYSTEM_FIELDS={_Workflows:{date:{type:'date'},kind:{type:'text'},referenceId:{type:'text'},details:{type:'text'}},_Periods:{from:{type:'date'},to:{type:'date'},status:{type:'text'},note:{type:'text'}},_JournalChunks:{requestKey:{type:'text'},part:{type:'number'},details:{type:'text'}}};
function fields_(module){const fields=SCHEMA[module]?.fields||SYSTEM_FIELDS[module];if(!fields)throw new Error('VALIDATION: Bảng không hợp lệ');return fields;}
function headers_(module) { return [...META,...Object.keys(fields_(module))]; }
function table_(name) { const s=db_().getSheetByName(name); if(!s) throw new Error('CONFIG: Chưa setup bảng '+name); return s; }
function append_(name,row) { table_(name).appendRow(row); }
function stamp_() { return props_().getProperty('SYNC_VERSION') || '0'; }
function bump_() { props_().setProperty('SYNC_VERSION',uid_()); }
function rawRows_(module,book=db_()) {
  const s=book.getSheetByName(module),headers=headers_(module);if(!s)throw new Error('CONFIG: Chưa setup bảng '+module);
  if(JSON.stringify(s.getRange(1,1,1,headers.length).getValues()[0])!==JSON.stringify(headers)) throw new Error('SCHEMA: Sai cột bảng '+module);
  if(s.getLastRow()<2) return [];
  const cellsAll=[];for(let offset=2;offset<=s.getLastRow();offset+=1000)cellsAll.push(...s.getRange(offset,1,Math.min(1000,s.getLastRow()-offset+1),headers.length).getValues());
  return cellsAll.map((cells,i)=>{
    if(cells.every(c=>c===''))return null;
    const row={}; headers.forEach((h,j)=>{row[h]=cells[j] instanceof Date?Utilities.formatDate(cells[j],'Asia/Ho_Chi_Minh',fields_(module)[h]?.type==='time'?'HH:mm':'yyyy-MM-dd'):cells[j];});
    if(![true,false,''].includes(row.deleted))row._sourceError='Cờ xóa không hợp lệ';
    row.deleted=row.deleted===true;row.version=Number(row.version);
    for(const [k,f]of Object.entries(fields_(module))){
      if(f.type==='lines' && typeof row[k]==='string'){try{row[k]=JSON.parse(row[k]);}catch(_){row[k]=null;}}
      if(f.type==='boolean'){if(![true,false,''].includes(row[k]))row._sourceError='Giá trị đúng/sai không hợp lệ';row[k]=row[k]===true;}
    }
    row._hash=hash_(cells.map(v=>v instanceof Date?v.toISOString():v)); row._row=i+2;
    return row;
  }).filter(Boolean);
}
function data_() { const data={};for(const m of Object.keys(SCHEMA))data[m]=rawRows_(m);data.debts=attachDebtAllocations_(data.debts);data.production=attachProductionCosts_(data.production,{role:'admin',permissions:{}});return data; }
function requireValidSources_(data){if(sourceIssues(data).length)throw new Error('DATA_INVALID: Dữ liệu nguồn không hợp lệ. Quản trị viên cần kiểm tra và sửa trên phân hệ nguồn trước khi tính hoặc chốt.');}
function publicRow_(row) { const copy={...row};delete copy._row;return copy; }
function cells_(module,row) { return headers_(module).map(k=>{const v=row[k]??'';return Array.isArray(v)?JSON.stringify(v):v;}); }
function writeRow_(module,row,book=db_()) {
  const s=book.getSheetByName(module),found=rawRows_(module,book).find(r=>r.recordId===row.recordId),cells=cells_(module,row);
  if(found)s.getRange(found._row,1,1,cells.length).setValues([cells]);else s.appendRow(cells);
}
function audit_(user,action,module,id,before,after) {
  const bounded=value=>{const text=JSON.stringify(value||null);return text.length<=40000?text:JSON.stringify({largePayload:true,hash:hash_(text),recordId:value?.recordId||'',journal:'_Requests / _JournalChunks'});};
  append_('_Audit',[uid_(),now_(),user,action,module,id,bounded(before),bounded(after)]);
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
  effects=effects.flatMap(e=>{
    if(e.module!=='_Workflows'||typeof e.after.details!=='string'||e.after.details.length<=40000)return [e];
    const payload=e.after.details,chunkKey='workflow:'+e.after.recordId,count=Math.ceil(payload.length/16000),chunks=[];
    for(let i=0;i<count;i++)chunks.push({module:'_JournalChunks',before:null,after:{recordId:chunkKey+':'+i,version:1,updatedAt:now_(),updatedBy:actor,source:'SYSTEM',deleted:false,reverses:'',requestKey:chunkKey,part:i,details:JSON.stringify(payload.slice(i*16000,(i+1)*16000))}});
    return [...chunks,{...e,after:{...e.after,details:JSON.stringify({chunks:chunkKey,count,hash:hash_(payload)})}}];
  });
  let serialized=JSON.stringify(effects);
  if(serialized.length>1500000)throw new Error('LIMIT: Lô vượt 1,5 triệu ký tự; chia nhỏ lô trước khi nhập');
  if(effects.some(e=>cells_(e.module,e.after).some(v=>typeof v==='string'&&v.length>45000)))throw new Error('LIMIT: Một ô dữ liệu vượt 45.000 ký tự; chia nhỏ chứng từ');
  if(serialized.length>45000){
    requireOperational_();const payload=serialized,count=Math.ceil(payload.length/16000);
    for(let i=0;i<count;i++)writeRow_('_JournalChunks',{recordId:key+':'+i,version:1,updatedAt:now_(),updatedBy:actor,source:'SYSTEM',deleted:false,reverses:'',requestKey:key,part:i,details:JSON.stringify(payload.slice(i*16000,(i+1)*16000))});
    serialized=JSON.stringify({chunks:key,count,hash:hash_(payload)});
  }
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
function journalEffects_(serialized){
  const value=JSON.parse(serialized);if(Array.isArray(value))return value;
  const result=readChunkData_(value);if(!Array.isArray(result))throw new Error('RECOVERY: Journal cần danh sách hiệu ứng');return result;
}
function readChunkData_(value){
  if(!value||typeof value.chunks!=='string'||!Number.isInteger(value.count))throw new Error('RECOVERY: Journal không hợp lệ');
  const chunks=rawRows_('_JournalChunks').filter(r=>r.requestKey===value.chunks).sort((a,b)=>a.part-b.part);if(chunks.length!==value.count||chunks.some((r,i)=>r.part!==i))throw new Error('RECOVERY: Thiếu phần dữ liệu journal');
  const payload=chunks.map(r=>JSON.parse(r.details)).join('');if(hash_(payload)!==value.hash)throw new Error('RECOVERY: Hash journal không khớp');return JSON.parse(payload);
}

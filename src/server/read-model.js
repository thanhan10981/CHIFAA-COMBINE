// Derived, disposable read models. Never used by mutations or financial posting.
const READ_MODEL_VERSION='2026-11-17.2';
function verifyReadHeader_(module,sheet,headers){const key='read-header:'+module;if(requestTables_?.has(key))return;if(JSON.stringify(profileValues_(module,sheet.getRange(1,1,1,headers.length))[0])!==JSON.stringify(headers))throw new Error('SCHEMA: Sai cột bảng '+module);requestTables_?.set(key,true);}
function cachePartsGet_(key){
  try{const cache=CacheService.getScriptCache(),m=JSON.parse(cache.get(key)||'null');if(!m||m.until<=Date.now()||!Number.isInteger(m.count)||m.count<1||m.count>64)return null;
    const keys=Array.from({length:m.count},(_,i)=>key+':'+m.generation+':'+i),parts=cache.getAll(keys);if(keys.some(k=>typeof parts[k]!=='string'))return null;const text=keys.map(k=>JSON.parse(parts[k])).join('');return hash_(text)===m.hash?JSON.parse(text):null;
  }catch(_){return null;}
}
function cachePartsPut_(key,value,seconds){
  try{const text=JSON.stringify(value),count=Math.ceil(text.length/16000);if(!count||count>64)return;const cache=CacheService.getScriptCache(),generation=uid_(),parts={};for(let i=0;i<count;i++)parts[key+':'+generation+':'+i]=JSON.stringify(text.slice(i*16000,(i+1)*16000));cache.putAll(parts,seconds);cache.put(key,JSON.stringify({count,generation,hash:hash_(text),until:Date.now()+seconds*1000}),seconds);}catch(_){/* Cache eviction/limits cannot block a read. */}
}
function moduleIndex_(module,force=false){
  const key='parts:index:'+hash_({book:config_('SPREADSHEET_ID'),module,version:moduleVersions_()[module],model:READ_MODEL_VERSION});
  const stamp=stamp_(),s=table_(module),headers=headers_(module),last=s.getLastRow();
  verifyReadHeader_(module,s,headers);
  const indexKeys=['at','id','deleted','reverses','date','kind','department','dishId','materialId','search'];
  if(!force){const saved=cachePartsGet_(key);if(saved&&saved.physical===Math.max(0,last-1)){saved.rows=saved.rows.map(r=>Object.fromEntries(indexKeys.map((k,i)=>[k,r[i]])));return saved;}}
  // Exclude large recipe lines from list/lookup IO. Details are read on demand.
  const width=module==='recipes'?headers.indexOf('lines'):headers.length,rows=[],raw=new Map();
  for(let offset=2;offset<=last;offset+=1000){const cells=profileValues_(module,s.getRange(offset,1,Math.min(1000,last-offset+1),width));for(let i=0;i<cells.length;i++){
    const c=cells[i];if(c.every(v=>v===''))continue;const value=k=>{const v=c[headers.indexOf(k)];return v instanceof Date?Utilities.formatDate(v,'Asia/Ho_Chi_Minh','yyyy-MM-dd'):v;};
    raw.set(offset+i,c);rows.push({at:offset+i,id:String(value('recordId')||''),deleted:value('deleted')===true,reverses:value('reverses')||'',date:value('date')||'',kind:value('kind')||'',department:value('department')||'',dishId:value('dishId')||'',materialId:value('materialId')||'',search:c.slice(META.length).map((v,j)=>v instanceof Date?Utilities.formatDate(v,'Asia/Ho_Chi_Minh',fields_(module)[headers[j+META.length]]?.type==='time'?'HH:mm':'yyyy-MM-dd'):String(v)).join('\u0001').toLowerCase()});
  }}
  const index={rows,physical:Math.max(0,last-1),updatedAt:now_(),version:moduleVersions_()[module]};assertReadable_();if(stamp!==stamp_())throw new Error('CONFLICT: Dữ liệu đổi trong lúc tạo chỉ mục');if(module!=='recipes')requestRows_?.set('index-cells:'+module,raw);cachePartsPut_(key,{...index,rows:rows.map(r=>indexKeys.map(k=>r[k]))},60);return index;
}
function selectedRows_(module,positions){
  if(!positions.length)return [];const s=table_(module),headers=headers_(module),width=headers.length,result=[];
  verifyReadHeader_(module,s,headers);
  const raw=requestRows_?.get('index-cells:'+module);if(raw&&positions.every(p=>raw.has(p)))return positions.flatMap(p=>decodeRows_(module,[raw.get(p)],p));
  const sorted=[...new Set(positions)].sort((a,b)=>a-b);for(let i=0;i<sorted.length;){let end=i+1;while(end<sorted.length&&sorted[end]===sorted[end-1]+1&&end-i<200)end++;result.push(...decodeRows_(module,profileValues_(module,s.getRange(sorted[i],1,end-i,width)),sorted[i]));i=end;}
  const order=new Map(positions.map((p,i)=>[p,i]));return result.sort((a,b)=>order.get(a._row)-order.get(b._row));
}
function indexedPage_(module,args,offset,limit){
  // Search in recipe lines must retain legacy semantics, so use the full path.
  if(module==='recipes'&&args.search)return null;
  const index=moduleIndex_(module,args.force===true),search=String(args.search||'').trim().toLowerCase(),matches=index.rows.filter(r=>!r.deleted&&(!args.from||!r.date||r.date>=args.from)&&(!args.to||!r.date||r.date<=args.to)&&(!args.kind||r.kind===args.kind)&&(!args.department||r.department===args.department)&&(!args.dishId||r.dishId===args.dishId)&&(!args.materialId||r.materialId===args.materialId)&&(!search||r.id.toLowerCase().includes(search)||r.search.includes(search)));
  const chosen=matches.slice(offset,offset+limit),rows=selectedRows_(module,chosen.map(r=>r.at));
  // Direct edits can race the trigger. Never return a different/deleted row at a cached position.
  if(rows.length!==chosen.length||rows.some((r,i)=>r.recordId!==chosen[i].id||r.deleted||args.kind&&r.kind!==args.kind||args.department&&r.department!==args.department||r.date&&((args.from&&r.date<args.from)||(args.to&&r.date>args.to)))){
    if(args._indexRetry)throw new Error('CONFLICT: Dòng Sheets đang thay đổi. Đồng bộ rồi thử lại');return indexedPage_(module,{...args,force:true,_indexRetry:true},offset,limit);
  }
  return {rows,total:matches.length,offset,next:offset+limit<matches.length?offset+limit:null,readModel:{updatedAt:index.updatedAt,version:index.version}};
}
const LOOKUP_FIELDS={materials:['recordId','name','unit'],stores:['recordId','name'],dishes:['recordId','name','price'],employees:['recordId','name','hourlyRate','department','allowance'],discounts:['recordId','storeId','dishId','rate','recoveryPrice'],recipes:['recordId','name','kind','dishId','yield']};
function lookupData_(user,args){
  const m=args.module;if(!LOOKUP_FIELDS[m])throw new Error('VALIDATION: Danh mục tra cứu không hợp lệ');require_(user,m,'read');const offset=args.offset??0,limit=args.limit??200;if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>200)throw new Error('VALIDATION: Trang tra cứu không hợp lệ');if(args.stamp&&args.stamp!==stamp_())throw new Error('CONFLICT: Dữ liệu tra cứu đổi');
  const index=moduleIndex_(m,args.force===true),reversed=new Set(index.rows.filter(r=>!r.deleted&&r.reverses).map(r=>r.reverses)),active=index.rows.filter(r=>!r.deleted&&!r.reverses&&!reversed.has(r.id)),page=active.slice(offset,offset+limit),headers=headers_(m),s=table_(m),keys=LOOKUP_FIELDS[m],width=m==='recipes'?headers.indexOf('lines'):headers.length;
  // Group adjacent rows; never transmit recipe details/employee history in a lookup.
  let rows;if(m==='recipes'){rows=[];for(let i=0;i<page.length;){let end=i+1;while(end<page.length&&page[end].at===page[end-1].at+1)end++;const values=profileValues_(m,s.getRange(page[i].at,1,end-i,width));values.forEach(c=>{if(c[headers.indexOf('deleted')]===true)throw new Error('CONFLICT: Danh mục vừa bị xóa');rows.push(Object.fromEntries(keys.map(k=>[k,c[headers.indexOf(k)]])));});i=end;}}
  else{const selected=selectedRows_(m,page.map(r=>r.at));if(selected.some(r=>r.deleted))throw new Error('CONFLICT: Danh mục vừa bị xóa');rows=selected.map(r=>Object.fromEntries(keys.map(k=>[k,r[k]])));}
  if(rows.some((r,i)=>r.recordId!==page[i].id))throw new Error('CONFLICT: Danh mục tra cứu vừa đổi');const total=active.length;return {rows,total,next:offset+limit<total?offset+limit:null,stamp:stamp_(),version:index.version,updatedAt:index.updatedAt};
}
function recordData_(user,args){
  if(!SCHEMA[args.module]||typeof args.id!=='string')throw new Error('VALIDATION: Phiếu không hợp lệ');require_(user,args.module,'read');const index=moduleIndex_(args.module,args.force===true),found=index.rows.find(r=>r.id===args.id);if(!found)throw new Error('NOT_FOUND: Không tìm thấy phiếu');const row=selectedRows_(args.module,[found.at])[0];if(!row||row.recordId!==args.id)throw new Error('CONFLICT: Phiếu vừa chuyển dòng trên Sheets');return {row:publicRow_(row),stamp:stamp_()};
}
const SNAPSHOT_HEADERS=['key','generation','part','count','hash','updatedAt','versions','payload'];
const SNAPSHOT_SLOTS=128;
function snapshotSheet_(create=false){
  let s=db_().getSheetByName('_ReportSnapshots');if(!s&&create&&props_().getProperty('AUTH_ENV')==='DEV'&&config_('SPREADSHEET_ID')===config_('AUTH_DEV_SPREADSHEET_ID')){
    s=db_().insertSheet('_ReportSnapshots');if(s.getMaxRows()<SNAPSHOT_SLOTS*16+1)s.insertRowsAfter(s.getMaxRows(),SNAPSHOT_SLOTS*16+1-s.getMaxRows());s.getRange(1,1,1,8).setValues([SNAPSHOT_HEADERS]);s.setFrozenRows(1);const p=s.getRange(1,1,s.getMaxRows(),8).protect().setDescription('CHIFAA disposable report snapshots');p.setWarningOnly(false);const owner=Session.getEffectiveUser();p.addEditor(owner);p.removeEditors(p.getEditors().filter(u=>u.getEmail()!==owner.getEmail()));if(p.canDomainEdit())p.setDomainEdit(false);
  }
  if(s&&JSON.stringify(profileValues_('_ReportSnapshots',s.getRange(1,1,1,8))[0])!==JSON.stringify(SNAPSHOT_HEADERS))return null;return s;
}
function snapshotGet_(key){
  try{const s=snapshotSheet_();if(!s)return null;const slot=parseInt(key.slice(-8),16)%SNAPSHOT_SLOTS,start=2+slot*16;if(start+15>s.getMaxRows())return null;const cells=profileValues_('_ReportSnapshots',s.getRange(start,1,16,8)),first=cells[0],age=Date.now()-Date.parse(first[5]);if(first[0]!==key||!Number.isFinite(age)||age<0||age>300000||!Number.isInteger(first[3])||first[3]<1||first[3]>16)return null;
    const parts=cells.slice(0,first[3]);if(parts.some((r,i)=>r[0]!==key||r[1]!==first[1]||r[2]!==i||r[4]!==first[4]))return null;const text=parts.map(r=>JSON.parse(r[7])).join('');return hash_(text)===first[4]?JSON.parse(text):null;
  }catch(_){return null;}
}
function snapshotPut_(user,key,value,versions,stamp){
  try{const text=JSON.stringify(value),count=Math.ceil(text.length/16000);if(count>16)return;
    const lock=LockService.getScriptLock();if(!lock.tryLock(50))return;try{assertReadable_();if(stamp!==stamp_())return;const s=snapshotSheet_(user.role==='admin');if(!s)return;const generation=uid_(),hash=hash_(text),at=now_(),start=2+(parseInt(key.slice(-8),16)%SNAPSHOT_SLOTS)*16;if(start+15>s.getMaxRows())return;const rows=Array.from({length:16},(_,i)=>i<count?[key,generation,i,count,hash,at,JSON.stringify(versions),JSON.stringify(text.slice(i*16000,(i+1)*16000))]:Array(8).fill(''));s.getRange(start,1,16,8).setValues(rows);}finally{lock.releaseLock();}
  }catch(_){/* This protected sheet is only a disposable cache; never affect source data or saving. */}
}

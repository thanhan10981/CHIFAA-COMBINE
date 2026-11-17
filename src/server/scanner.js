function withReadContext_(fn){
  const prior=decorateMaterialUnits_;decorateMaterialUnits_=false;try{return withRawScanContext_(fn);}finally{decorateMaterialUnits_=prior;}
}
function withRawScanContext_(fn){
  if(requestBooks_)return fn();requestBooks_=new Map();requestRows_=new Map();requestTables_=new Map();requestProfile_={};
  try{return fn();}finally{console.log(JSON.stringify({event:'scan_profile',steps:requestProfile_}));requestBooks_=null;requestRows_=null;requestTables_=null;requestProfile_=null;}
}
function setRuns_(sheet,entries,width){
  const rows=[...entries].sort((a,b)=>a.at-b.at);for(let i=0;i<rows.length;){let end=i+1;while(end<rows.length&&rows[end].at===rows[end-1].at+1)end++;sheet.getRange(rows[i].at,1,end-i,width).setValues(rows.slice(i,end).map(r=>r.cells));i=end;}
}
function scanModules_(modules,{direct=false,range=null}={}){
  return withReadContext_(()=>locked_(()=>{
    assertReadable_();
    const selected=new Set(modules.filter(m=>Object.hasOwn(SCHEMA,m))),partial=selected.size===1&&range&&range.column>META.length&&range.start>=2&&range.count<=200;
    const data=Object.fromEntries([...selected].map(m=>[m,partial?rawRowsRange_(m,range.start-2,range.count).rows:rawRows_(m)])),seen=rowsPlain_('_Sync'),old=new Map(),next=new Map(),changes=[],syncWrites=[],auditRows=[],at=now_();
    seen.forEach((r,i)=>{if(r[0])old.set(r[0]+'|'+r[1],{cells:r,at:i+2});});
    const issues=sourceIssues(data,partial?Object.fromEntries([...selected].map(m=>[m,true])):{}),issueMap=new Map(issues.map(i=>[i.module+'|'+i.row,i.message]));
    for(const [module,rows]of Object.entries(data)){
      const counts=new Map();for(const row of rows)counts.set(row.recordId,(counts.get(row.recordId)||0)+1);
      const metadata=[];
      for(const row of rows){
        const id=typeof row.recordId==='string'&&row.recordId&&counts.get(row.recordId)===1?row.recordId:'!row:'+row._row,key=module+'|'+id,prior=old.get(key),issue=issueMap.get(module+'|'+row._row)||'';
        if(!prior||prior.cells[2]!==row._hash){
          const edited=direct&&(!range||row._row>=range.start&&row._row<range.start+range.count);
          if((edited||prior&&(row.source==='SHEETS'||row.updatedAt<=String(prior.cells[3])))&&row.recordId){
            // Preserve raw business cells and malformed metadata as evidence.
            if(Number.isInteger(row.version)&&row.version>0&&row._cells){const cells=row._cells.slice(),meta=cells.slice(0,META.length);meta[1]=row.version+1;meta[2]=at;meta[3]='SHEET_EDITOR_UNVERIFIED';meta[4]='SHEETS';for(let i=0;i<META.length;i++)cells[i]=meta[i];metadata.push({at:row._row,cells:meta});row._hash=hash_(cells.map(v=>v instanceof Date?v.toISOString():v));}
            auditRows.push(auditCells_('SHEET_EDITOR_UNVERIFIED','DIRECT_EDIT',module,row.recordId,null,{issue:issue||null}));
          }
          changes.push({module,id:row.recordId||'unknown',issue});
        }
        next.set(key,[module,id,row._hash,at]);
      }
      if(metadata.length){setRuns_(table_(module),metadata,META.length);invalidateRows_(module);}
    }
    let appendAt=table_('_Sync').getLastRow()+1;
    for(const [key,cells]of next){const prior=old.get(key);if(!prior)syncWrites.push({at:appendAt++,cells});else if(prior.cells[2]!==cells[2])syncWrites.push({at:prior.at,cells});}
    for(const [key,prior]of old)if(!partial&&selected.has(prior.cells[0])&&!next.has(key)){syncWrites.push({at:prior.at,cells:['','','','']});changes.push({module:prior.cells[0],id:prior.cells[1],issue:'Dòng đã bị xóa trực tiếp khỏi Sheet'});auditRows.push(auditCells_('SHEET_EDITOR_UNVERIFIED','DIRECT_ROW_DELETE',prior.cells[0],prior.cells[1],null,null));}
    if(syncWrites.length)setRuns_(table_('_Sync'),syncWrites,4);
    if(auditRows.length){const audit=table_('_Audit');audit.getRange(audit.getLastRow()+1,1,auditRows.length,8).setValues(auditRows);}
    if(changes.length)bump_([...selected]);
    for(const i of issues)if(!changes.some(c=>c.module===i.module&&c.id===i.id&&c.issue))changes.push({module:i.module,id:i.id,issue:i.message});
    let quality={};try{quality=JSON.parse(props_().getProperty('SOURCE_QUALITY_BY_MODULE')||'{}');}catch(_){}
    for(const m of selected)quality[m]={checkedAt:at,invalidRows:partial?Math.max(quality[m]?.invalidRows||0,issues.filter(i=>i.module===m).length):issues.filter(i=>i.module===m).length,partial:!!partial};
    props_().setProperty('SOURCE_QUALITY_BY_MODULE',JSON.stringify(quality));props_().setProperty('SOURCE_QUALITY',JSON.stringify({checkedAt:at,invalidRows:Object.values(quality).reduce((n,q)=>n+q.invalidRows,0),partial:!!partial||selected.size<Object.keys(SCHEMA).length}));props_().setProperty('LAST_SCAN',at);
    return changes;
  }));
}
function scanSlice_(){const modules=Object.keys(SCHEMA),start=Number(props_().getProperty('SCAN_CURSOR')||0)%modules.length,selected=modules.slice(start,start+4),result=scanModules_(selected);props_().setProperty('SCAN_CURSOR',String(start+4>=modules.length?0:start+4));return result;}
function sheetChanged_(event){
  if(event?.source?.getId()!==config_('SPREADSHEET_ID')||!['INSERT_ROW','REMOVE_ROW','INSERT_COLUMN','REMOVE_COLUMN','INSERT_GRID','REMOVE_GRID','OTHER'].includes(event.changeType))return;
  locked_(()=>{bump_();props_().setProperty('SCAN_CURSOR','0');audit_('SHEET_EDITOR_UNVERIFIED','STRUCTURE_CHANGE','sheets','',null,{type:event.changeType});});
}

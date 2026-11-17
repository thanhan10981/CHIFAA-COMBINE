function publicAsset_(args){if(args.id!=='exceljs-4.4.0')throw new Error('NOT_FOUND: Tài nguyên không tồn tại');return {source:HtmlService.createTemplateFromFile('ExcelRuntime').getRawContent()};}
function scopedCache_(user,kind,versions,args,force,build,seconds=20){
  const key='read:v3:'+hash_({book:config_('SPREADSHEET_ID'),model:READ_MODEL_VERSION,kind,versions,args,email:user.email,role:user.role,permissions:user.permissions,permissionVersion:user.permissionVersion}),snapshot=['summary','strategy','payroll','inventory','cost','demand','variance'].includes(kind);
  if(!force){const cached=cachePartsGet_(key);if(cached)return cached;const saved=snapshot?snapshotGet_(key):null;if(saved){cachePartsPut_(key,saved,seconds);return {...saved,readModel:{...saved.readModel,source:'snapshot'}};}}
  const stamp=stamp_(),value=build();assertReadable_();if(stamp!==stamp_())throw new Error('CONFLICT: Dữ liệu đổi trong lúc đọc. Thử đồng bộ lại.');
  if(snapshot){value.readModel={updatedAt:now_(),versions,source:'sheets'};snapshotPut_(user,key,value,versions,stamp);}cachePartsPut_(key,value,seconds);return value;
}
function permittedVersions_(user){const all=moduleVersions_();return Object.fromEntries(Object.keys(SCHEMA).filter(m=>allowed_(user,m,'read')).map(m=>[m,all[m]]));}
function settlementPage_(data,from,to,offset=0){
  const rows=effective(data.sales).filter(s=>s.date>=from&&s.date<=to),page=rows.slice(offset,offset+100),names=m=>new Map((data[m]||[]).map(r=>[r.recordId,r.name]));const stores=names('stores'),dishes=names('dishes');
  return {rows:page.map(s=>{const m=salesMetrics(s);return {recordId:s.recordId,date:s.date,storeName:stores.get(s.storeId)||s.storeId,dishName:dishes.get(s.dishId)||s.dishId,delivered:s.delivered,sold:s.sold,returned:s.returned,creditQty:s.creditQty,netRevenue:m.netRevenue,received:m.received,collectionDifference:m.collectionDifference};}),total:rows.length,offset,next:offset+100<rows.length?offset+100:null};
}
function summary_(user,args){
  if(!validDate(args.from)||!validDate(args.to)||args.from>args.to)throw new Error('VALIDATION: Kỳ báo cáo không hợp lệ');
  const required=['sales','production','attendance','cash','recipes','materials','stock'];for(const m of required)require_(user,m,'read');
  const modules=[...required,...['stores','dishes','plans'].filter(m=>allowed_(user,m,'read'))],versions=moduleVersions_();
  return scopedCache_(user,'summary',Object.fromEntries(modules.map(m=>[m,versions[m]])),{from:args.from,to:args.to,compare:args.compare===true},args.force===true,()=>{
    const data=data_(modules);requireValidSources_(data);
    const days={};for(const s of effective(data.sales).filter(s=>s.date>=args.from&&s.date<=args.to))days[s.date]=(days[s.date]||0)+salesMetrics(s).netRevenue;
    const raw=timed_('report',()=>report(data,args.from,args.to)),{payroll,...aggregate}=raw,departments=new Map();
    for(const row of payroll){if(!departments.has(row.department))departments.set(row.department,{department:row.department,hours:0,base:0,allowances:0,advance:0,deduction:0,net:0});const group=departments.get(row.department);for(const key of ['hours','base','allowances','advance','deduction','net'])group[key]+=row[key];}
    return {report:{...aggregate,payrollSummary:[...departments.values()].map(g=>({...g,...Object.fromEntries(['hours','base','allowances','advance','deduction','net'].map(k=>[k,round(g[k])]))}))},target:data.plans?targets(data,args.from,args.to):null,weeks:args.compare===true?compareWeeks(data,args.to):[],series:Object.entries(days).sort().slice(-31),settlements:settlementPage_(data,args.from,args.to)};
  });
}
function settlements_(user,args){
  require_(user,'sales','read');if(!validDate(args.from)||!validDate(args.to)||args.from>args.to||!Number.isInteger(args.offset)||args.offset<0)throw new Error('VALIDATION: Trang đối soát không hợp lệ');
  const modules=['sales',...['stores','dishes'].filter(m=>allowed_(user,m,'read'))],versions=moduleVersions_();
  return scopedCache_(user,'settlements',Object.fromEntries(modules.map(m=>[m,versions[m]])),{from:args.from,to:args.to,offset:args.offset},args.force===true,()=>{const data=data_(modules);requireValidSources_(data);return settlementPage_(data,args.from,args.to,args.offset);});
}
function strategySummary_(user,args){
  const range=strategyRange(args.period,args.anchor),to=range.end>args.anchor?args.anchor:range.end,modules=['sales','production','attendance','cash','recipes','materials','stock','stores','dishes'];for(const m of modules)require_(user,m,'read');
  const versions=moduleVersions_();return scopedCache_(user,'strategy',Object.fromEntries(modules.map(m=>[m,versions[m]])),{period:args.period,anchor:args.anchor},args.force===true,()=>{
    const data=data_(modules);requireValidSources_(data);const priorEnd=strategyShift('day',range.start,-1),priorStart=strategyShift('day',range.start,-(Math.round((Date.parse(to)-Date.parse(range.start))/86400000)+1));
    return timed_('strategy',()=>({aggregate:strategyAggregate(data,range.start,to),prior:strategyAggregate(data,priorStart,priorEnd),series:strategySeries(data,args.period,args.anchor),profitSeries:strategySeries(data,'month',args.anchor,12)}));
  });
}
function periodSummary_(user,args){
  const modules={payroll:['attendance','employees'],inventory:['materials','stock'],cost:['materials','recipes','stock','dishes'],demand:['materials','recipes','production','orders','stores','dishes'],variance:['materials','counts','stock','production','recipes','dishes']}[args.kind];if(!modules||!validDate(args.from)||!validDate(args.to)||args.from>args.to||typeof(args.department||'')!=='string')throw new Error('VALIDATION: Báo cáo/kỳ không hợp lệ');for(const m of modules)require_(user,m,'read');const offset=args.offset??0;if(!Number.isInteger(offset)||offset<0)throw new Error('VALIDATION: Trang báo cáo không hợp lệ');
  const versions=moduleVersions_(),value=scopedCache_(user,args.kind,Object.fromEntries(modules.map(m=>[m,versions[m]])),{from:args.from,to:args.to,department:args.department||''},args.force===true,()=>{
    const data=data_(modules);requireValidSources_(data);
    if(args.kind==='inventory')return {rows:inventory(data,args.to)};
    if(args.kind==='cost')return {rows:effective(data.recipes).map(r=>{const c=costRecipe(r.recordId,1,data,args.to);return {name:r.name,kind:r.kind,total:c.total,missing:c.missing};})};
    if(args.kind==='demand'){const d=demand(data,args.from,args.to);return {rows:effective(data.materials).filter(m=>d.planned[m.recordId]||d.approvedOrders[m.recordId]).map(m=>({name:m.name,unit:m.unit,planned:d.planned[m.recordId]||0,approved:d.approvedOrders[m.recordId]||0})),note:d.note+(d.missing.length?' Thiếu công thức: '+d.missing.join(', '):'')};}
    if(args.kind==='variance'){const names=new Map(data.materials.map(r=>[r.recordId,r.name]));return {rows:variance(data,args.from,args.to).map(r=>({...r,name:names.get(r.materialId)||r.materialId}))};}
    const names=new Map(data.employees.map(r=>[r.recordId,r.name])),rows=payroll(effective(data.attendance).filter(r=>r.date>=args.from&&r.date<=args.to&&(!args.department||r.department===args.department))).map(r=>({...r,name:names.get(r.employeeId)||r.employeeId}));return {rows};
  });
  const rows=args.kind==='inventory'&&args.reorder===true?value.rows.filter(r=>r.replenish>0||r.status==='gray'):value.rows;return {...value,rows:rows.slice(offset,offset+100),total:rows.length,next:offset+100<rows.length?offset+100:null};
}

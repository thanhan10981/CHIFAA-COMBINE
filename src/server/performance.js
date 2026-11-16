function publicAsset_(args){if(args.id!=='exceljs-4.4.0')throw new Error('NOT_FOUND: Tài nguyên không tồn tại');return {source:HtmlService.createHtmlOutputFromFile('ExcelRuntime').getContent()};}
function scopedCache_(user,kind,versions,args,force,build,seconds=20){
  const key='read:v2:'+hash_({book:config_('SPREADSHEET_ID'),kind,versions,args,email:user.email,role:user.role,permissions:user.permissions,permissionVersion:user.permissionVersion}),cache=CacheService.getScriptCache();
  if(!force)try{const entry=JSON.parse(cache.get(key)||'null');if(entry?.until>Date.now())return entry.value;}catch(_){/* Optional cache. */}
  const stamp=stamp_(),value=build();assertReadable_();if(stamp!==stamp_())throw new Error('CONFLICT: Dữ liệu đổi trong lúc đọc. Thử đồng bộ lại.');
  try{const text=JSON.stringify({until:Date.now()+seconds*1000,value});if(text.length*3<90000)cache.put(key,text,seconds);}catch(_){/* Oversized/evicted cache falls back to Sheets. */}return value;
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
    return {report:timed_('report',()=>report(data,args.from,args.to)),target:data.plans?targets(data,args.from,args.to):null,weeks:args.compare===true?compareWeeks(data,args.to):[],series:Object.entries(days).sort().slice(-31),settlements:settlementPage_(data,args.from,args.to)};
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

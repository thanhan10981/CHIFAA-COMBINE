// Unit provenance lives in the existing append-only workflow ledger; no header migration.
let decorateMaterialUnits_=true;
function unitSpecValidate_(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('VALIDATION: Cần cấu hình đơn vị');
  const out={version:1};
  for(const name of ['purchaseUnit','packageType','usageUnit','standardUnit','packageUnit','priceBasis']){const value=input[name]??'';if(typeof value!=='string'||value.length>100||/^[=+@]/.test(value))throw Error('VALIDATION: Đơn vị không hợp lệ');out[name]=value.trim();}
  if(!out.purchaseUnit||!out.usageUnit||canonicalUnit(out.usageUnit)!==canonicalUnit(out.standardUnit))throw Error('VALIDATION: Đơn vị chuẩn phải là đơn vị sử dụng của sổ kho/công thức');
  for(const name of ['packageQuantity','originalPrice']){const v=input[name];out[name]=v==null||v===''?null:v;if(out[name]!=null&&(!finite(out[name])||out[name]<0||name==='packageQuantity'&&out[name]===0))throw Error('VALIDATION: Số quy đổi / giá gốc không hợp lệ');}
  if(!['verified','pending'].includes(input.priceStatus))throw Error('VALIDATION: Trạng thái giá không hợp lệ');out.priceStatus=input.priceStatus;
  out.source=input.source||{};if(typeof out.source!=='object'||Array.isArray(out.source)||JSON.stringify(out.source).length>24000)throw Error('VALIDATION: Nguồn đối chiếu không hợp lệ');
  out.note=operationText_(input.note||'',input.priceStatus==='verified');
  if(out.priceStatus==='verified'&&(out.originalPrice==null||unitFactor(out,out.priceBasis,out.standardUnit)==null))throw Error('VALIDATION: Chưa đủ căn cứ quy đổi cơ sở giá về đơn vị chuẩn');
  if(out.packageQuantity!=null&&unitFactor(null,out.packageUnit,out.standardUnit)==null)throw Error('VALIDATION: Không tự đổi khối lượng/thể tích hoặc quả/gram');
  return out;
}
function attachMaterialUnits_(rows){
  const specs=new Map();for(const marker of effective(workflowRows_()).filter(w=>w.kind==='material-units')){
    try{specs.set(marker.referenceId,workflowDetails_(marker).spec);}catch(_){specs.set(marker.referenceId,{priceStatus:'pending'});}
  }
  return rows.map(row=>specs.has(row.recordId)?{...row,unitSpec:specs.get(row.recordId),unitState:materialUnitState({...row,unitSpec:specs.get(row.recordId)})}:row);
}
function validateMaterialSpecForRecord_(record,spec){
  const factor=unitFactor(spec,spec.purchaseUnit,spec.usageUnit);
  const priceMatches=(record.purchasePrice===''?null:record.purchasePrice)===spec.originalPrice||record.purchasePrice===''&&spec.priceStatus==='pending';
  if(canonicalUnit(record.unit)!==canonicalUnit(spec.usageUnit)||canonicalUnit(record.purchaseUnit)!==canonicalUnit(spec.purchaseUnit)||!priceMatches||factor!=null&&(!finite(record.conversion)||Math.abs(record.conversion-factor)>1e-9*Math.max(1,factor)))throw Error('VALIDATION: Cấu hình đơn vị không khớp bản ghi vật tư');
}
function inspectMaterialUnits_(args){
  assertReadable_();const offset=args.offset??0;if(!Number.isInteger(offset)||offset<0)throw Error('VALIDATION: Trang không hợp lệ');
  let rows=effective(rawRows_('materials')).map(row=>({...publicRow_(row),unitState:materialUnitState(row)}));
  if(args.pending===true)rows=rows.filter(r=>r.unitState.status!=='verified');
  return {rows:rows.slice(offset,offset+100),total:rows.length,next:offset+100<rows.length?offset+100:null,offset};
}
function materialUnitUsed_(id){
  return effective(rawRows_('stock')).some(r=>r.materialId===id)||effective(rawRows_('counts')).some(r=>r.materialId===id)||effective(rawRows_('recipes')).some(r=>r.lines.some(l=>l.type==='material'&&l.id===id));
}
function saveMaterialUnits_(user,args){
  requireAdmin_(user);requireOperational_();const request={action:'MATERIAL_UNITS',id:args.id,expectedVersion:args.expectedVersion,expectedHash:args.expectedHash,spec:args.spec,minimum:args.minimum};
  const previous=replay_(user.email,args.key,request);if(previous)return previous;
  const before=rawRows_('materials').find(r=>r.recordId===args.id&&!r.deleted);if(!before)throw Error('NOT_FOUND: Vật tư không còn tồn tại');
  if(before.version!==args.expectedVersion||before._hash!==args.expectedHash)throw Error('CONFLICT: Vật tư đã đổi; tải lại trước khi xác nhận');
  const spec=unitSpecValidate_(args.spec),changedUnit=canonicalUnit(before.unit)!==canonicalUnit(spec.usageUnit);
  if(changedUnit&&materialUnitUsed_(before.recordId))throw Error('LINKED: Đơn vị sử dụng đã có công thức/phiếu kho/kiểm kê. Cần migration có đối soát, không đổi nhãn lịch sử');
  const conversion=unitFactor(spec,spec.purchaseUnit,spec.usageUnit);
  let minimum=args.minimum;
  if(minimum===undefined){minimum=before.minimum;if(changedUnit&&finite(minimum)){const factor=unitFactor(spec,before.unit,spec.usageUnit);if(factor==null)throw Error('VALIDATION: Cần xác minh đơn vị mức tồn tối thiểu');minimum*=factor;}}
  const record=cleanRecord('materials',{name:before.name,purchaseUnit:spec.purchaseUnit,unit:spec.usageUnit,conversion:conversion??'',purchasePrice:spec.originalPrice??'',minimum:minimum==null?'':minimum});
  const after={...before,...record,version:before.version+1,updatedAt:now_(),updatedBy:user.email};delete after.unitSpec;delete after.unitState;
  const marker=workflowMarker_(user,'material-units',before.recordId,now_().slice(0,10),{spec,sourceMaterialHash:before._hash});
  // Existing records stay append-only in the provenance ledger; current row update is journaled.
  return transact_(user.email,args.key,request,[{module:'materials',before,after},marker]);
}

// Physical return ledger uses the existing transactional workflow journal.
// A return approval does not imply receipt, sale, spoilage or a cost valuation.
function kioskAccess_(user,write=false){for(const m of ['sales','stores','dishes'])require_(user,m,'read');if(write)require_(user,'sales','approve');}
function kioskState_(data,to){
  const markers=effective(workflowRows_()).filter(w=>['return-approved','return-received','return-rejected','kiosk-sale'].includes(w.kind));
  const sales=new Map(effective(data.sales).map(s=>[s.recordId,s])),returns=markers.filter(w=>w.kind==='return-approved').map(w=>{
    const d=workflowDetails_(w),source=sales.get(w.referenceId);
    if(!source||source._hash!==d.sourceHash)throw new Error('CONFLICT: Phiếu doanh thu của hàng thu hồi đã đổi; cần đối soát trước khi tiếp tục');
    if(!validDate(w.date)||!finite(d.quantity)||d.quantity<=0||d.quantity!==source.returned||d.dishId!==source.dishId||d.storeId!==source.storeId||markers.filter(r=>r.kind==='return-approved'&&r.referenceId===w.referenceId).length!==1)throw new Error('CONFLICT: Nhật ký lô thu hồi không hợp lệ; cần đối soát');
    const receipt=markers.find(r=>r.kind==='return-received'&&r.referenceId===w.recordId),rejected=markers.find(r=>r.kind==='return-rejected'&&r.referenceId===w.recordId);
    const sold=markers.filter(r=>r.kind==='kiosk-sale'&&r.referenceId===w.recordId).map(r=>({row:r,details:workflowDetails_(r)}));
    if(receipt&&(workflowDetails_(receipt).quantity!==d.quantity||receipt.date<w.date)||receipt&&rejected||markers.filter(r=>r.kind==='return-received'&&r.referenceId===w.recordId).length>1)throw new Error('CONFLICT: Nhật ký nhận hàng không hợp lệ');
    for(const item of sold){const sale=sales.get(item.details.saleId);if(!sale||sale._hash!==item.details.saleHash||!finite(item.details.quantity)||item.details.quantity<=0||!receipt||item.row.date<receipt.date)throw new Error('CONFLICT: Phiếu bán tại ki-ốt đã đổi hoặc không còn hiệu lực; cần đối soát');}
    if(sold.reduce((n,s)=>n+s.details.quantity,0)>d.quantity)throw new Error('CONFLICT: Nhật ký ki-ốt vượt số lượng thực nhận');
    const used=sold.filter(s=>s.row.date<=to).reduce((n,s)=>n+s.details.quantity,0);
    return {id:w.recordId,saleId:source.recordId,sourceDate:source.date,date:w.date,dishId:d.dishId,storeId:d.storeId,quantity:d.quantity,status:receipt?'received':rejected?'rejected':'approved',receivedAt:receipt?.date||'',sold:used,balance:receipt&&receipt.date<=to?round(d.quantity-used):0,sourceHash:d.sourceHash};
  });
  return {markers,returns};
}
function kioskReport_(user,args){
  kioskAccess_(user);assertReadable_();
  if(!validDate(args.from)||!validDate(args.to)||args.from>args.to)throw new Error('VALIDATION: Chọn khoảng ngày hợp lệ');
  const offset=args.offset??0;if(!Number.isInteger(offset)||offset<0)throw new Error('VALIDATION: Trang không hợp lệ');
  const data=data_(['sales','stores','dishes']);requireValidSources_(data);const state=kioskState_(data,args.to),names=(module,id)=>data[module].find(r=>r.recordId===id)?.name||id;
  const rows=effective(data.sales).filter(s=>s.returned>0&&s.date>=args.from&&s.date<=args.to).map(s=>{
    const r=state.returns.find(r=>r.saleId===s.recordId);return {id:s.recordId,hash:s._hash,date:s.date,store:names('stores',s.storeId),dish:names('dishes',s.dishId),quantity:s.returned,approvalId:r?.id||'',status:r?.status||'pending',receivedAt:r?.receivedAt||'',balance:r?.balance||0};
  });
  const inventory=state.returns.filter(r=>r.status==='received'&&r.receivedAt<=args.to&&r.balance>0).map(r=>({...r,store:names('stores',r.storeId),dish:names('dishes',r.dishId)}));
  const inventoryOffset=args.inventoryOffset??0;if(!Number.isInteger(inventoryOffset)||inventoryOffset<0)throw new Error('VALIDATION: Trang tồn không hợp lệ');
  return {rows:rows.slice(offset,offset+100),total:rows.length,next:offset+100<rows.length?offset+100:null,inventory:inventory.slice(inventoryOffset,inventoryOffset+100),inventoryTotal:inventory.length,inventoryNext:inventoryOffset+100<inventory.length?inventoryOffset+100:null,history:state.markers.slice(-100).reverse().map(w=>({id:w.recordId,date:w.date,kind:w.kind,referenceId:w.referenceId})),valuation:'pending',stamp:stamp_()};
}
function kioskWorkflow_(user,args){
  kioskAccess_(user,true);requireOperational_();
  if(args.kind==='undo')requireAdmin_(user);
  const request={...args,action:'KIOSK'};delete request.token;delete request.proof;delete request.key;
  const replay=replay_(user.email,args.key,request);if(replay)return replay;
  if(!validDate(args.date))throw new Error('VALIDATION: Chọn ngày nghiệp vụ');periodGuard_([args.date]);
  const note=operationText_(args.note,true),data=data_(['sales','stores','dishes']);requireValidSources_(data);
  const state=kioskState_(data,args.date);let effects=[];
  if(args.kind==='undo'){
    const marker=state.markers.find(w=>w.recordId===args.id);if(!marker)throw new Error('NOT_FOUND: Không tìm thấy lần xử lý');
    periodGuard_([marker.date]);if(state.markers.some(w=>w.referenceId===marker.recordId))throw new Error('LINKED: Hoàn tác bán/nhận hàng liên quan trước khi hoàn tác lô nguồn');
    const details=workflowDetails_(marker);
    if(marker.kind==='kiosk-sale'){
      const sale=effective(data.sales).find(s=>s.recordId===details.saleId);if(!sale)throw new Error('CONFLICT: Phiếu bán không còn hiệu lực');periodGuard_([sale.date]);
      effects.push(newEffect_('sales',appRow_(user,{...sale,reverses:sale.recordId})));
    }
    effects.push(newEffect_('_Workflows',appRow_(user,{date:marker.date,kind:marker.kind,referenceId:marker.referenceId,details:marker.details,reverses:marker.recordId})),workflowMarker_(user,'kiosk-undo',marker.recordId,args.date,{note}));
  }else if(args.kind==='approve'){
    const sale=effective(data.sales).find(s=>s.recordId===args.id);
    if(!sale||!(sale.returned>0))throw new Error('NOT_FOUND: Không có hàng thu hồi trên phiếu này');
    if(args.sourceHash!==sale._hash)throw new Error('CONFLICT: Phiếu đã đổi, tải lại trước khi duyệt');
    if(args.date<sale.date)throw new Error('VALIDATION: Ngày duyệt không được trước phiếu nguồn');
    if(state.returns.some(r=>r.saleId===sale.recordId))throw new Error('CONFLICT: Hàng thu hồi đã được xử lý');
    effects=[workflowMarker_(user,'return-approved',sale.recordId,args.date,{sourceHash:sale._hash,quantity:sale.returned,dishId:sale.dishId,storeId:sale.storeId,note})];
  }else{
    const row=state.returns.find(r=>r.id===args.id);if(!row)throw new Error('NOT_FOUND: Không tìm thấy lô thu hồi');
    if(args.date<row.date)throw new Error('VALIDATION: Ngày xử lý không được trước ngày duyệt');
    if(['receive','reject'].includes(args.kind)){
      if(row.status!=='approved')throw new Error('CONFLICT: Lô thu hồi đã nhận hoặc đã từ chối');
      effects=[workflowMarker_(user,args.kind==='receive'?'return-received':'return-rejected',row.id,args.date,{quantity:row.quantity,note})];
    }else if(args.kind==='sell'){
      require_(user,'sales','create');
      // Reject backdated consumption if a later sale is already posted for this lot.
      if(state.markers.some(w=>w.kind==='kiosk-sale'&&w.referenceId===row.id&&w.date>args.date))throw new Error('CONFLICT: Đã có lần bán sau ngày này, không bán hồi tố');
      if(row.status!=='received'||!row.receivedAt||args.date<row.receivedAt||!finite(args.quantity)||args.quantity<=0||args.quantity>row.balance)throw new Error('BALANCE: Số bán vượt hàng thực nhận còn lại tại ki-ốt');
      if(args.storeId===row.storeId)throw new Error('VALIDATION: Chọn điểm ki-ốt nhận hàng khác điểm bán nguồn');
      const record=cleanRecord('sales',{date:args.date,storeId:args.storeId,dishId:row.dishId,delivered:args.quantity,sold:args.quantity,returned:0,creditQty:0,price:args.price,discount:0,recoveryPrice:0,cash:args.cash,bank:args.bank,oldDebtPaid:0,otherCost:0,note},data),sale=appRow_(user,record);
      effects=[newEffect_('sales',sale),workflowMarker_(user,'kiosk-sale',row.id,args.date,{saleId:sale.recordId,saleHash:hash_(cells_('sales',sale)),quantity:args.quantity,note,effects:[{module:'sales',id:sale.recordId}]})];
    }else throw new Error('VALIDATION: Thao tác ki-ốt không hợp lệ');
  }
  return transact_(user.email,args.key,request,effects);
}
function kioskReverseGuard_(module,row){
  if(module!=='sales')return;
  const markers=effective(workflowRows_());
  if(markers.some(w=>w.kind==='return-approved'&&w.referenceId===row.recordId))throw new Error('LINKED: Phiếu có lô thu hồi đã duyệt; cần đối soát lô trước khi đảo');
}

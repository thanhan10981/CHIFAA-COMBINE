function orderPlanAccess_(user,write=false){for(const m of ['orders','production','dishes'])require_(user,m,'read');if(write){require_(user,'orders','approve');require_(user,'production','approve');}}
function orderPlanLinks_(data){
  const links=effective(workflowRows_()).filter(w=>w.kind==='order-plan-link').map(w=>{const d=workflowDetails_(w),order=effective(data.orders).find(r=>r.recordId===w.referenceId),production=effective(data.production).find(r=>r.recordId===d.productionId);
    return {id:w.recordId,date:w.date,orderId:w.referenceId,productionId:d.productionId,quantity:d.quantity,valid:!!order&&order.status==='approved'&&order._hash===d.orderHash&&finite(d.quantity)&&d.quantity===order.quantity&&!!production&&production._hash===d.productionHash&&production.dishId===order.dishId};
  });
  for(const link of links)if(links.filter(l=>l.orderId===link.orderId).length!==1||links.filter(l=>l.productionId===link.productionId).reduce((n,l)=>n+l.quantity,0)>(data.production.find(p=>p.recordId===link.productionId)?.planned??0))link.valid=false;
  return links;
}
function orderPlans_(user,args){
  orderPlanAccess_(user);assertReadable_();if(!validDate(args.from)||!validDate(args.to)||args.from>args.to)throw new Error('VALIDATION: Chọn kỳ kế hoạch');
  const data=data_(['orders','production','dishes']);requireValidSources_(data);const links=orderPlanLinks_(data),names=new Map(data.dishes.map(r=>[r.recordId,r.name]));
  const offset=args.offset??0;if(!Number.isInteger(offset)||offset<0)throw new Error('VALIDATION: Trang không hợp lệ');
  const rows=effective(data.production).filter(p=>p.date>=args.from&&p.date<=args.to&&(!args.dishId||p.dishId===args.dishId)).map(p=>({id:p.recordId,hash:p._hash,date:p.date,dishId:p.dishId,dish:names.get(p.dishId)||p.dishId,planned:p.planned,linked:links.filter(l=>l.productionId===p.recordId&&l.valid).reduce((n,l)=>n+l.quantity,0)}));
  return {rows:rows.slice(offset,offset+100),next:offset+100<rows.length?offset+100:null,total:rows.length,links:links.filter(l=>args.orderId?l.orderId===args.orderId:l.date>=args.from&&l.date<=args.to).slice(-100),issues:links.filter(l=>!l.valid).length,note:'Chỉ liên kết đơn đã duyệt vào sản lượng kế hoạch hiện có; không tăng kế hoạch, không xuất kho hoặc cộng nhu cầu lần hai.'};
}
function linkOrderPlan_(user,args){
  orderPlanAccess_(user,true);requireOperational_();operationText_(args.note,true);
  const request={...args,action:'ORDER_PLAN'};delete request.token;delete request.proof;delete request.key;
  const previous=replay_(user.email,args.key,request);if(previous)return previous;
  const data=data_(['orders','production','dishes']);requireValidSources_(data);const links=orderPlanLinks_(data);let effects=[];
  if(args.operation==='unlink'){
    const link=links.find(l=>l.id===args.id);if(!link)throw new Error('NOT_FOUND: Liên kết không còn hiệu lực');
    const marker=effective(workflowRows_()).find(w=>w.recordId===args.id),order=effective(data.orders).find(r=>r.recordId===link.orderId);periodGuard_([marker.date,order?.date]);
    effects=[newEffect_('_Workflows',appRow_(user,{date:marker.date,kind:marker.kind,referenceId:marker.referenceId,details:marker.details,reverses:marker.recordId})),workflowMarker_(user,'order-plan-unlink',marker.recordId,marker.date,{note:args.note})];
  }else if(args.operation==='link'){
    const order=effective(data.orders).find(r=>r.recordId===args.orderId),production=effective(data.production).find(r=>r.recordId===args.productionId);
    if(!order||order.status!=='approved'||!production)throw new Error('VALIDATION: Chọn đơn đã duyệt và phiếu kế hoạch còn hiệu lực');
    periodGuard_([order.date,production.date]);
    if(order._hash!==args.orderHash||production._hash!==args.productionHash)throw new Error('CONFLICT: Đơn hoặc kế hoạch đã đổi');
    if(links.some(l=>!l.valid&&l.productionId===production.recordId))throw new Error('CONFLICT: Kế hoạch có liên kết cần đối soát trước');
    if(links.some(l=>l.orderId===order.recordId))throw new Error('CONFLICT: Đơn đã có liên kết; gỡ liên kết cũ trước khi đổi kế hoạch');
    const used=links.filter(l=>l.productionId===production.recordId).reduce((n,l)=>n+l.quantity,0);
    if(order.dishId!==production.dishId||used+order.quantity>production.planned)throw new Error('BALANCE: Sai món hoặc số đơn vượt phần kế hoạch chưa liên kết');
    effects=[workflowMarker_(user,'order-plan-link',order.recordId,production.date,{productionId:production.recordId,quantity:order.quantity,orderHash:order._hash,productionHash:production._hash,note:args.note})];
  }else throw new Error('VALIDATION: Thao tác liên kết không hợp lệ');
  return transact_(user.email,args.key,request,effects);
}
function orderPlanReverseGuard_(module,row){if(module==='production'&&effective(workflowRows_()).some(w=>w.kind==='order-plan-link'&&workflowDetails_(w).productionId===row.recordId))throw new Error('LINKED: Kế hoạch đang liên kết đơn; gỡ liên kết có lý do trước khi đảo');}

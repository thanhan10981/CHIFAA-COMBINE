async function openOrderPlan(row){
  const generation=viewGeneration,token=state.token,scope=state.grantKey,dialog=el('dialog'),grid=el('div',null,'form-grid'),result=el('div',null,'pad');dialog.dataset.privateDialog='order-plan';
  const from=operationField(grid,'Kế hoạch từ ngày','date',row.date),to=operationField(grid,'Đến ngày','date',row.date),note=operationField(grid,'Lý do liên kết / gỡ liên kết');let busy=false;
  dialog.append(el('header','Liên kết đơn đã duyệt với kế hoạch'),el('p','Liên kết phân bổ số đơn vào kế hoạch đã nhập; không tăng sản lượng, không ghi doanh thu hoặc xuất kho. Một đơn liên kết một phiếu kế hoạch; cần tách đơn phải đối soát riêng.','notice'),grid,result);document.body.append(dialog);
  const write=async args=>{
    if(busy||!args)return;if(state.orderPlanPending&&args!==state.orderPlanPending){toast('Kiểm tra lại lần liên kết chưa rõ kết quả trước.','warning');return;}busy=true;state.orderPlanPending=args;
    try{await call('linkOrderPlan',args);if(token!==state.token||scope!==state.grantKey)return;state.orderPlanPending=null;toast('Đã ghi nhận liên kết kế hoạch.');await refresh();}
    catch(e){if(token!==state.token||scope!==state.grantKey)return;if(!['TIMEOUT','NETWORK','BUSY','RECOVERY'].includes(e.code))state.orderPlanPending=null;notifyError(e);if(state.orderPlanPending)result.prepend(button('Kiểm tra lại cùng liên kết',()=>write(state.orderPlanPending)));}
    finally{busy=false;}
  };
  const refresh=async(offset=0,force=false)=>{
    result.replaceChildren(el('div',null,'skeleton'));
    try{const data=await call('orderPlans',{from:from.value,to:to.value,dishId:row.dishId,orderId:row.recordId,offset,force});if(generation!==viewGeneration||token!==state.token)return;
      result.replaceChildren(makeTable(['Ngày','Món','Kế hoạch','Đã liên kết đơn','Thao tác'],data.rows.map(p=>[p.date,p.dish,p.planned,p.linked,button('Liên kết '+row.quantity+' phần',()=>write({operation:'link',orderId:row.recordId,orderHash:row._hash,productionId:p.id,productionHash:p.hash,note:note.value,key:crypto.randomUUID()}))])));
      if(data.next!=null)result.append(button('Kế hoạch trang sau',()=>refresh(data.next)));if(offset)result.append(button('Kế hoạch trang trước',()=>refresh(Math.max(0,offset-100))));
      result.append(makeTable(['Mã liên kết','Số lượng','Trạng thái nguồn','Gỡ'],data.links.map(l=>[l.id.slice(0,8),l.quantity,l.valid?'Khớp':'Cần đối soát',button('Gỡ liên kết',()=>write({operation:'unlink',id:l.id,note:note.value,key:crypto.randomUUID()}))])));
      if(data.issues)result.append(el('p','Có '+data.issues+' liên kết có nguồn thay đổi; cần đối soát trước khi dùng.','notice'));
      if(data.checkedAt)result.append(el('p','Dữ liệu kiểm tra lúc '+data.checkedAt+'. Bấm Tải kế hoạch để kiểm tra mới.','report-note'));
      if(state.orderPlanPending)result.prepend(button('Kiểm tra lại cùng liên kết',()=>write(state.orderPlanPending)));
    }catch(e){if(generation===viewGeneration){result.replaceChildren(el('p','Chưa tải được kế hoạch.','notice'));errorText(e);}}
  };
  grid.append(button('Tải kế hoạch',()=>refresh(0,true)),button('Đóng',()=>{if(!busy)dialog.remove();}));if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');await refresh();
}
export {openOrderPlan};

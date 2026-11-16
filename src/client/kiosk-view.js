function renderKiosk(){
  if(state.demo){$('view').append(el('p','Ki-ốt cần dữ liệu thực và xác thực máy chủ.','notice'));return;}
  const generation=viewGeneration,host=el('section',null,'card pad'),fields=el('div',null,'toolbar'),content=el('div');
  const from=operationField(fields,'Từ ngày','date',state.from),to=operationField(fields,'Đến ngày','date',state.to);
  const date=operationField(fields,'Ngày xử lý','date',state.to),note=operationField(fields,'Lý do / xác nhận kiểm tra');
  host.append(el('p','Duyệt hàng thu hồi trước, xác nhận thực nhận sau. Chỉ ghi doanh thu ki-ốt khi đã bán. Giá vốn, lô và hạn dùng chưa được nghiệm thu; tồn ở đây chỉ là số lượng.','notice'),fields,content);$('view').append(host);
  let pending=null;
  const write=async(kind,row,extra={})=>{
    if(pending){toast('Có lần ghi chưa rõ kết quả. Kiểm tra lại cùng yêu cầu trước.','warning');return;}
    if(!confirm('Xác nhận '+kind+' lô hàng này?'))return;
    const args={kind,id:kind==='approve'?row.id:row.approvalId||row.id,sourceHash:row.hash,date:date.value,note:note.value,...extra,key:crypto.randomUUID()};
    pending=args;let inFlight=false;
    const submit=async()=>{if(inFlight)return;inFlight=true;try{await call('kiosk',args);pending=null;toast('Đã ghi nhận nghiệp vụ ki-ốt.');await refresh();}catch(e){if(['TIMEOUT','NETWORK','BUSY','RECOVERY'].includes(e.code)){pending=args;const retry=button('Kiểm tra lại cùng lần ghi',submit);content.prepend(el('p','Chưa rõ kết quả; dùng lại đúng yêu cầu để tránh ghi hai lần.','notice'),retry);}else pending=null;errorText(e);}finally{inFlight=false;}};
    await submit();
  };
  const refresh=async(offset=0,inventoryOffset=0)=>{
    const loading=el('div',null,'skeleton');content.replaceChildren(loading);
    try{const data=await call('kioskReport',{from:from.value,to:to.value,offset,inventoryOffset});if(generation!==viewGeneration)return;loading.remove();
      const status={pending:'Chờ duyệt',approved:'Chờ thực nhận',received:'Đã nhận',rejected:'Từ chối nhận'};
      content.append(el('h3','Hàng thu hồi từ điểm bán'),makeTable(['Ngày nguồn','Điểm bán','Món','Thu hồi','Trạng thái','Thao tác'],data.rows.map(r=>{
        const actions=el('div',null,'actions');if(can('sales','approve')&&!pending){if(r.status==='pending')actions.append(button('Duyệt',()=>write('approve',r)));if(r.status==='approved')actions.append(button('Đã thực nhận',()=>write('receive',r)),button('Từ chối',()=>write('reject',r)));}
        return [r.date,r.store,r.dish,r.quantity,status[r.status],actions];
      })));
      const pages=el('div',null,'toolbar');if(offset)pages.append(button('Trang trước',()=>refresh(Math.max(0,offset-100),inventoryOffset)));if(data.next!=null)pages.append(button('Trang sau',()=>refresh(data.next,inventoryOffset)));content.append(pages);
      content.append(el('h3','Tồn thực nhận tại ki-ốt đến '+to.value),makeTable(['Lô','Ngày nhận','Món','Đã bán','Còn lại','Ghi bán'],data.inventory.map(r=>{
        const actions=el('div');if(can('sales','approve')&&can('sales','create')&&!pending)actions.append(button('Lập phiếu bán',async()=>{
          const dialog=document.createElement('dialog'),grid=el('div',null,'form-grid');dialog.dataset.privateDialog='kiosk';dialog.append(el('header','Bán từ lô thực nhận · '+r.dish),grid);document.body.append(dialog);
          try{if(!await ensureLookupModules(['stores'],generation)){dialog.remove();return;}}catch(e){dialog.remove();errorText(e);return;}
          const store=operationSelect(grid,'Điểm ki-ốt bán',effective(referenceRows('stores')).filter(s=>s.recordId!==r.storeId).map(s=>[s.recordId,s.name]));
          const quantity=operationField(grid,'Số lượng (còn '+r.balance+')','number',''),price=operationField(grid,'Giá bán / phần','number',''),cash=operationField(grid,'Thực thu tiền mặt','number',0),bank=operationField(grid,'Thực thu chuyển khoản','number',0);
          dialog.append(button('Hủy',()=>dialog.remove()),button('Xác nhận bán',async()=>{await write('sell',r,{storeId:store.value,quantity:Number(quantity.value),price:price.value.trim()===''?null:Number(price.value),cash:Number(cash.value),bank:Number(bank.value)});dialog.remove();},'button primary'));dialog.showModal();
        }));return [r.id.slice(0,8),r.receivedAt,r.dish,r.sold,r.balance,actions];
      })));
      const stockPages=el('div',null,'toolbar');if(inventoryOffset)stockPages.append(button('Tồn trang trước',()=>refresh(offset,Math.max(0,inventoryOffset-100))));if(data.inventoryNext!=null)stockPages.append(button('Tồn trang sau',()=>refresh(offset,data.inventoryNext)));content.append(stockPages);
      if(state.user.role==='admin')content.append(el('h3','Nhật ký lô thu hồi gần nhất'),makeTable(['Ngày','Loại','Mã','Thao tác'],data.history.map(r=>[r.date,r.kind,r.id.slice(0,8),button('Hoàn tác',()=>write('undo',r))])));
    }catch(e){if(generation===viewGeneration){loading.remove();content.append(el('p','Chưa tải được dữ liệu ki-ốt. Bấm Tải lại để thử lại.','notice'));errorText(e);}}
  };
  fields.append(button('Tải lại',()=>{if(!pending)refresh();}));refresh();
}

export {renderKiosk};

import {confirmedRollback} from './operations-view.js';
async function openEntryCommand(module,row){
  if(state.demo){toast('Nhập có kiểm tra cần máy chủ Apps Script.','info');return;}
  if(state.entryPending){module=state.entryPending.module;row=state.entryPending.source;}
  const generation=viewGeneration,token=state.token,scope=state.grantKey,refs=routeReadModules(ROUTES.find(r=>r[2]===module)?.[0]).filter(m=>m!==module);
  try{if(!await ensureLookupModules(refs,generation))return;}catch(e){errorText(e);return;}
  const dialog=el('dialog'),form=el('form'),grid=el('div',null,'form-grid'),result=el('div',null,'pad'),footer=el('footer'),submit=el('button','Xem trước','button primary');submit.type='submit';
  dialog.dataset.privateDialog='entry';
  dialog.append(el('header','Nhập có kiểm tra · '+SCHEMA[module].title),form);form.append(grid,result,footer);document.body.append(dialog);
  const mode=operationSelect(grid,'Cách nhập',row?[['APPEND','Bổ sung: chỉ nhập phần tăng thêm'],...(can(module,'approve')?[['CORRECT','Điều chỉnh: thay đúng một phiếu gốc']]:[])]:[['NEW','Nhập mới'],['BACKFILL','Nhập bù ngày trước']]);
  if(module==='counts'&&row){mode.querySelector('[value="APPEND"]')?.remove();mode.value='CORRECT';}
  const note=operationField(grid,'Lý do nhập / điều chỉnh (ít nhất 5 ký tự)'),inputs={};
  grid.append(el('p','Bổ sung tạo phiếu riêng. Điều chỉnh đảo đúng phiếu gốc đã chọn rồi thay bằng phiếu mới; các phiếu bổ sung khác giữ nguyên. Ví dụ gốc100 + bổ sung30, sửa riêng gốc thành90 thì tổng120.','notice field full'));
  for(const [key,f]of Object.entries(SCHEMA[module].fields)){
    const value=row?.[key]??(f.type==='date'?state.to:f.type==='number'&&f.required?0:'');
    if(['ref','select'].includes(f.type))inputs[key]=operationSelect(grid,f.label,f.ref?[['','Chọn…'],...effective(referenceRows(f.ref)).map(r=>[r.recordId,r.name])]:f.options.map(v=>[v,v]));
    else inputs[key]=operationField(grid,f.label,f.type==='number'?'number':f.type==='date'?'date':f.type==='time'?'time':'text',value);
    inputs[key].value=value;inputs[key].required=f.required;if(f.type==='number'){inputs[key].step='any';if(f.min!=null)inputs[key].min=f.min;if(f.max!=null)inputs[key].max=f.max;}
  }
  const snapshotFields=['price','discount','recoveryPrice','hourlyRate','unitCost'];
  const fill=()=>{if(!row)return;for(const [key,f]of Object.entries(SCHEMA[module].fields))inputs[key].value=mode.value==='APPEND'&&f.type==='number'&&!snapshotFields.includes(key)?0:row[key]??'';if(module==='attendance'&&mode.value==='APPEND'){inputs.start.value='';inputs.end.value='';}};
  fill();let prepared=state.entryPending?.request||null,busy=false;
  const invalidate=()=>{if(!state.entryPending){prepared=null;submit.textContent='Xem trước';result.replaceChildren();}};
  grid.addEventListener('input',invalidate);grid.addEventListener('change',invalidate);mode.addEventListener('change',fill);
  const close=button('Đóng',()=>{if(!busy)dialog.remove();});footer.append(close,submit);
  const freeze=value=>{for(const n of grid.querySelectorAll('input,select'))n.disabled=value;submit.disabled=busy;close.disabled=busy;};
  if(prepared){for(const [key,input]of Object.entries(inputs))input.value=prepared.record[key]??'';mode.value=prepared.command;note.value=prepared.note;freeze(true);submit.textContent='Kiểm tra lại cùng lần ghi';result.append(el('p','Lần ghi trước chưa rõ kết quả. Nút kiểm tra dùng lại đúng yêu cầu, không lập phiếu thứ hai.','notice'));}
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;busy=true;freeze(true);let confirmed=false;
    try{
      if(!prepared){const record=Object.fromEntries(Object.entries(SCHEMA[module].fields).map(([key,f])=>[key,f.type==='number'?(inputs[key].value===''?'':Number(inputs[key].value)):inputs[key].value]));
        const args={module,command:mode.value,id:row?.recordId,expectedVersion:row?.version,expectedHash:row?._hash,record,note:note.value};
        const response=await call('entry',{...args,preview:true});if(token!==state.token||scope!==state.grantKey)return;prepared={...args,digest:response.digest,key:crypto.randomUUID()};
        result.replaceChildren(el('p','Phạm vi: '+({ 'replace-one-voucher':'thay đúng một phiếu gốc','additional-voucher':'thêm phiếu bổ sung riêng','new-voucher':'tạo phiếu mới'})[response.preview.scope],'notice'),makeTable(['Trường','Trước','Sau'],response.preview.diff.map(d=>[SCHEMA[module].fields[d.field]?.label||d.field,d.before,d.after])),el('p','Chưa ghi dữ liệu. Kiểm tra bảng rồi bấm Xác nhận ghi.','muted'));submit.textContent='Xác nhận ghi';return;
      }
      const request=prepared;state.entryPending={module,source:row,request};await call('entry',request);confirmed=true;if(token!==state.token||scope!==state.grantKey)return;if(state.entryPending?.request.key===request.key)state.entryPending=null;dialog.remove();toast('Máy chủ đã xác nhận ghi phiếu và nhật ký.');await load();route();
    }catch(e){if(token!==state.token||scope!==state.grantKey)return;if(confirmed){toast('Phiếu đã ghi; bấm Đồng bộ để tải lại.','warning');return;}
      const rolledBack=prepared&&state.entryPending&&['TIMEOUT','NETWORK','BUSY','RECOVERY'].includes(e.code)&&await confirmedRollback(prepared.key);if(token!==state.token||scope!==state.grantKey)return;
      if(rolledBack){
        if(state.entryPending?.request.key===prepared.key)state.entryPending=null;prepared=null;submit.textContent='Xem trước';result.replaceChildren(el('p','Máy chủ xác nhận đã hoàn tác lần ghi. Kiểm tra lại rồi Xem trước để lập yêu cầu mới; chưa có phiếu mới được ghi.','notice'));return;
      }
      if(state.entryPending&&['TIMEOUT','NETWORK','BUSY','RECOVERY'].includes(e.code)){submit.textContent='Kiểm tra lại cùng lần ghi';result.prepend(el('p','Chưa rõ kết quả. Giữ nguyên yêu cầu và kiểm tra lại.','notice'));}
      else{state.entryPending=null;prepared=null;submit.textContent='Xem trước';}notifyError(e);
    }finally{busy=false;freeze(!!state.entryPending);}
  });
  if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
}
export {openEntryCommand};

import { rpcCall } from './rpc.js';
import {toast,notifyError} from './notifications.js';
const invite=new URLSearchParams(location.hash.slice(1)).get('invite')||'';
if(invite)history.replaceState(null,'',location.pathname+location.search);
const form=document.getElementById('order-form'),status=document.getElementById('order-status'),send=document.getElementById('send-order');
let key=crypto.randomUUID(),uncertain=null;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const lookup=document.createElement('section'),lookupTitle=document.createElement('h3'),lookupId=document.createElement('input'),lookupButton=document.createElement('button'),lookupStatus=document.createElement('p');lookup.className='card pad portal-lookup';lookup.style.marginTop='20px';lookupTitle.textContent='Tra cứu trạng thái đơn';lookupId.placeholder='Nhập mã đơn đã nhận';lookupId.setAttribute('aria-label','Mã đơn');lookupButton.type='button';lookupButton.className='button';lookupButton.textContent='Kiểm tra đơn';lookupButton.disabled=true;lookupStatus.setAttribute('role','status');lookup.append(lookupTitle,lookupId,lookupButton,lookupStatus);form.closest('main').append(lookup);
lookupButton.onclick=async()=>{lookupButton.disabled=true;try{const r=await rpcCall('portalStatus',{invite,id:lookupId.value.trim()});lookupStatus.textContent=r.id+' · '+({pending:'Chờ duyệt',approved:'Đã duyệt',rejected:'Từ chối'}[r.status]||r.status)+' · '+r.quantity+' phần · '+r.date;toast('Đã tải trạng thái đơn.','info');}catch(e){lookupStatus.textContent=e.message;notifyError(e);}finally{lookupButton.disabled=false;}};
form.elements.namedItem('date').value=today;form.elements.namedItem('date').min=today;
async function startPortal(){
  if(!invite){status.textContent='Cần mở đường dẫn thư mời hợp lệ do Chifaa cung cấp.';return;}
  try{const catalog=await rpcCall('portalCatalog',{invite});document.getElementById('destination').textContent='Điểm giao: '+catalog.store;form.elements.namedItem('customer').value=catalog.customer||'';
    for(const d of catalog.dishes){const option=document.createElement('option');option.value=d.recordId;option.textContent=d.name+' · '+d.price.toLocaleString('vi-VN')+' đ';document.getElementById('dishes').append(option);}send.disabled=false;lookupButton.disabled=false;
  }catch(e){status.textContent=e.message;notifyError(e);}
}
form.onsubmit=async event=>{event.preventDefault();send.disabled=true;status.textContent='Đang gửi…';
  try{const record=uncertain||Object.fromEntries(new FormData(form));record.quantity=Number(record.quantity);const result=await rpcCall('portalOrder',{invite,key,record});status.textContent='Đã nhận đơn '+result.ids[0]+'. Trạng thái: chờ duyệt.';lookupId.value=result.ids[0];toast(status.textContent);uncertain=null;key=crypto.randomUUID();form.reset();form.elements.namedItem('date').value=today;send.textContent='Gửi đơn đặt hàng';for(const i of form.querySelectorAll('input,select'))i.disabled=false;}
  catch(e){status.textContent=e.message;notifyError(e);if(['TIMEOUT','NETWORK'].includes(e.code)){uncertain ||= Object.fromEntries(new FormData(form));uncertain.quantity=Number(uncertain.quantity);for(const i of form.querySelectorAll('input,select'))i.disabled=true;send.textContent='Kiểm tra lại cùng đơn';}}
  finally{send.disabled=false;}
};
startPortal();

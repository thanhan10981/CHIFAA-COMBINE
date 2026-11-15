import { rpcCall } from './rpc.js';
const invite=new URLSearchParams(location.hash.slice(1)).get('invite')||'';
if(invite)history.replaceState(null,'',location.pathname+location.search);
const form=document.getElementById('order-form'),status=document.getElementById('order-status'),send=document.getElementById('send-order');
let key=crypto.randomUUID(),uncertain=null;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
form.elements.namedItem('date').value=today;form.elements.namedItem('date').min=today;
async function startPortal(){
  if(!invite){status.textContent='Cần mở đường dẫn thư mời hợp lệ do Chifaa cung cấp.';return;}
  try{const catalog=await rpcCall('portalCatalog',{invite});document.getElementById('destination').textContent='Điểm giao: '+catalog.store;form.elements.namedItem('customer').value=catalog.customer||'';
    for(const d of catalog.dishes){const option=document.createElement('option');option.value=d.recordId;option.textContent=d.name+' · '+d.price.toLocaleString('vi-VN')+' đ';document.getElementById('dishes').append(option);}send.disabled=false;
  }catch(e){status.textContent=e.message;}
}
form.onsubmit=async event=>{event.preventDefault();send.disabled=true;status.textContent='Đang gửi…';
  try{const record=uncertain||Object.fromEntries(new FormData(form));record.quantity=Number(record.quantity);const result=await rpcCall('portalOrder',{invite,key,record});status.textContent='Đã nhận đơn '+result.ids[0]+'. Trạng thái: chờ duyệt.';uncertain=null;key=crypto.randomUUID();form.reset();form.elements.namedItem('date').value=today;for(const i of form.querySelectorAll('input,select'))i.disabled=false;}
  catch(e){status.textContent=e.message;if(['TIMEOUT','NETWORK'].includes(e.code)){uncertain ||= Object.fromEntries(new FormData(form));uncertain.quantity=Number(uncertain.quantity);for(const i of form.querySelectorAll('input,select'))i.disabled=true;send.textContent='Kiểm tra lại cùng đơn';}}
  finally{send.disabled=false;}
};
startPortal();

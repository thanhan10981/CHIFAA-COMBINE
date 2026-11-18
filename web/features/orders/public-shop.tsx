'use client';
import {useState,useSyncExternalStore} from 'react';
import {useMutation,useQuery} from '@tanstack/react-query';
import Decimal from 'decimal.js';
import {browserSupabase} from '@/lib/supabase/browser';
import {LoadingState} from '@/components/feedback';
import {Icon,ShoppingBag} from '@/components/icons';
import {formatVnd} from '@/lib/format';
import {localDate} from '@/features/catalog/material-types';
import {publicOrderShift} from './public-order-shift';

type Product={product_id:string;code:string;name:string;sale_unit:string;price_vnd:string|null};
type Line={product:Product;quantity:string};
type Submission={p_date:string;p_shift:string;p_contact:{name:string;phone:string;address:string};p_items:{product_id:string;quantity:string;price_vnd:string}[];p_note:string;p_link_token:string|null;p_key:string};
const messages:Record<string,string>={PRODUCT_NOT_AVAILABLE:'Món vừa ngừng nhận đặt. Vui lòng chọn lại thực đơn.',PRICE_CHANGED:'Giá món vừa thay đổi. Vui lòng xem giá mới và chọn lại món.',ORDER_CUTOFF:'Đã qua giờ nhận đơn cho ngày này. Vui lòng chọn ngày giao khác.',DAILY_CAPACITY:'Số lượng đã vượt khả năng nhận đơn trong ngày. Vui lòng chọn ngày khác.',RATE_LIMIT:'Bạn gửi đơn quá nhanh. Vui lòng đợi một phút rồi thử lại.',INVALID_CONTACT:'Vui lòng kiểm tra tên, số điện thoại và địa chỉ giao.',INVALID_ORDER:'Vui lòng kiểm tra ngày giao.',INVALID_LINK:'Link điểm bán không hợp lệ hoặc đã bị thu hồi. Hãy liên hệ CHIFAA để nhận link mới.'};
const subscribeLinkToken=(onChange:()=>void)=>{window.addEventListener('hashchange',onChange);return()=>window.removeEventListener('hashchange',onChange);};
const getLinkToken=()=>window.location.hash.slice(1)||null;
const getServerLinkToken=()=>null;
const subscribeOrderShift=(onChange:()=>void)=>{const timer=window.setInterval(onChange,30_000);return()=>window.clearInterval(timer);};
const getOrderShift=()=>publicOrderShift();
const getServerOrderShift=()=>'AM' as const;
export function PublicShop(){
 const [date,setDate]=useState(localDate),[offset,setOffset]=useState(0),[basket,setBasket]=useState<Record<string,Line>>({}),[name,setName]=useState(''),[phone,setPhone]=useState(''),[address,setAddress]=useState(''),[note,setNote]=useState(''),[pending,setPending]=useState<Submission|null>(null),[confirmation,setConfirmation]=useState(''),linkToken=useSyncExternalStore(subscribeLinkToken,getLinkToken,getServerLinkToken),shift=useSyncExternalStore(subscribeOrderShift,getOrderShift,getServerOrderShift);
 const catalog=useQuery({queryKey:['public-portal','catalog',date,offset],staleTime:0,refetchInterval:30_000,queryFn:async({signal})=>{const {data,error}=await browserSupabase().rpc('public_order_catalog',{p_date:date,p_offset:offset,p_limit:100}).abortSignal(signal);if(error)throw new Error(error.code==='PGRST202'?'Cổng đặt hàng đang được cập nhật. Vui lòng thử lại sau.':'Chưa tải được thực đơn. Vui lòng thử lại.');return data as {rows:Product[];total:string};}});
 const lines=Object.values(basket).filter(line=>Number(line.quantity)>0);
 const total=lines.reduce((sum,line)=>sum.plus(new Decimal(line.product.price_vnd??'0').times(line.quantity)),new Decimal(0));
 const submit=useMutation({retry:false,mutationFn:async(shiftAtSubmit:string)=>{
  let request=pending;
  if(!request){
   if(!lines.length)throw new Error('Chọn ít nhất một món trước khi gửi đơn.');
   if(name.trim().length<2||!/^\+?\d{8,15}$/.test(phone.replace(/[\s().-]/g,''))||address.trim().length<5)throw new Error('Nhập tên, số điện thoại và địa chỉ giao hợp lệ.');
   request={p_date:date,p_shift:shiftAtSubmit,p_contact:{name:name.trim(),phone:phone.trim(),address:address.trim()},p_items:lines.map(line=>{if(!/^[1-9]\d{0,5}$/.test(line.quantity)||line.product.price_vnd===null)throw new Error('Số lượng phải là số nguyên từ1 đến999999 và món phải có giá.');return {product_id:line.product.product_id,quantity:line.quantity,price_vnd:line.product.price_vnd};}),p_note:note.trim(),p_link_token:linkToken,p_key:crypto.randomUUID()};
   setPending(request);
  }
  const {p_link_token,...publicRequest}=request;
  const {data,error}=p_link_token?await browserSupabase().rpc('submit_store_link_order',request):await browserSupabase().rpc('submit_public_order',publicRequest);
  if(error){
   if(error.code==='P0001'||error.code.startsWith('22')||error.code.startsWith('23')){
    setPending(null);const code=Object.keys(messages).find(code=>error.message.includes(code));
    if(code==='PRICE_CHANGED'||code==='PRODUCT_NOT_AVAILABLE'){setBasket({});void catalog.refetch();}
    throw new Error(code?messages[code]:'Đơn chưa được chấp nhận. Vui lòng kiểm tra thông tin và thử lại.');
   }
   throw new Error('Chưa rõ kết quả gửi. Bấm “Kiểm tra lại lần gửi” để kiểm tra cùng đơn, tránh tạo trùng.');
  }
  return data as {order_id:string;status:string};
 },onSuccess:result=>{setPending(null);setBasket({});setConfirmation(result.order_id);}});
 const locked=submit.isPending||!!pending;
 function quantity(product:Product,value:string){if(locked||product.price_vnd===null)return;if(value!==''&&!/^\d{1,6}$/.test(value))return;setConfirmation('');setBasket(current=>({...current,[product.product_id]:{product,quantity:value}}));}
 return <section className="public-shop">
  <div className="public-hero"><div><p className="eyebrow">CHIFAA / ĐẶT HÀNG</p><h1>Món ngon, sẵn sàng mỗi sáng.</h1><p>Chọn món, nhập số lượng và gửi đơn. CHIFAA sẽ liên hệ xác nhận.</p><span className="public-open"><Icon name="check" size={14}/>{linkToken?'Link đặt hàng của điểm bán':'Đặt hàng trực tiếp, không cần tài khoản'}</span></div><span className="public-hero-icon"><ShoppingBag size={36}/></span></div>
  {confirmation&&<div className="public-confirmation" role="status"><Icon name="check" size={22}/><div><strong>Đã nhận đơn #{confirmation.slice(0,8)}</strong><p>Đơn đang chờ CHIFAA xác nhận qua thông tin liên hệ bạn cung cấp.</p></div></div>}
  <div className="public-shop-layout"><section className="public-menu panel"><header><div><h2>Thực đơn CHIFAA</h2><p>Các món đã được công bố trong danh mục món bán.</p></div><label>Ngày giao<input aria-label="Ngày giao" type="date" required min={localDate()} value={date} disabled={locked} onChange={e=>{if(!e.target.value)return;setDate(e.target.value);setBasket({});setOffset(0);setConfirmation('');}}/></label></header>
   {catalog.isPending?<LoadingState label="Đang tải thực đơn…"/>:catalog.isError?<div role="alert"><p>{catalog.error.message}</p><button className="button" onClick={()=>void catalog.refetch()}>Thử lại</button></div>:<><div className="public-products">{catalog.data.rows.map(product=><article className={'public-product'+(Number(basket[product.product_id]?.quantity)>0?' selected':'')} key={product.product_id}><span className="public-food-icon"><Icon name="box" size={24}/></span><div className="public-product-copy"><small>{product.code} · {product.sale_unit}</small><h3>{product.name}</h3><strong>{product.price_vnd===null?'Chưa có giá':formatVnd(product.price_vnd)+' đ'}<small> / {product.sale_unit}</small></strong></div><div className="public-quantity"><button type="button" aria-label={'Giảm '+product.name} disabled={locked||!Number(basket[product.product_id]?.quantity)||product.price_vnd===null} onClick={()=>quantity(product,String(Math.max(0,Number(basket[product.product_id]?.quantity??0)-1)))}>−</button><input aria-label={'Số lượng '+product.name} inputMode="numeric" type="number" min="0" max="999999" step="1" placeholder="0" disabled={locked||product.price_vnd===null} value={basket[product.product_id]?.quantity??''} onChange={e=>quantity(product,e.target.value)}/><button type="button" aria-label={'Tăng '+product.name} disabled={locked||Number(basket[product.product_id]?.quantity??0)>=999999||product.price_vnd===null} onClick={()=>quantity(product,String(Number(basket[product.product_id]?.quantity??0)+1))}>+</button></div></article>)}</div>{catalog.data.rows.length===0&&<p className="empty">Chưa có món được công bố. Vui lòng quay lại sau.</p>}<footer className="public-pagination"><span>{catalog.data.total} món · Trang {offset/100+1}</span>{Number(catalog.data.total)>100&&<><button className="button" disabled={locked||offset===0} onClick={()=>setOffset(offset-100)}>Trước</button><button className="button" disabled={locked||offset+100>=Number(catalog.data.total)} onClick={()=>setOffset(offset+100)}>Sau</button></>}</footer></>}
  </section><aside className="public-checkout panel"><h2><ShoppingBag size={20}/>Đơn của bạn <span>{lines.length} món</span></h2>{lines.length?<ul className="public-cart">{lines.map(line=><li key={line.product.product_id}><div><strong>{line.product.name}</strong><small>{line.quantity} {line.product.sale_unit} × {formatVnd(line.product.price_vnd)} đ</small></div><span>{formatVnd(new Decimal(line.product.price_vnd!).times(line.quantity).toString())} đ</span></li>)}</ul>:<p className="public-cart-empty">Chọn số lượng ở thực đơn để thêm món.</p>}<div className="public-total"><span>Tổng tiền món</span><strong>{formatVnd(total.toString())} đ</strong></div><p className="public-delivery-note">Chi phí giao hàng (nếu có) được CHIFAA xác nhận khi liên hệ.</p>
   <form onSubmit={e=>{e.preventDefault();const shiftAtSubmit=pending?.p_shift??publicOrderShift();submit.mutate(shiftAtSubmit);}}><input type="hidden" name="shift" value={shift}/><fieldset disabled={locked}><label>Tên người nhận *<input required autoComplete="name" minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label><label>Số điện thoại *<input type="tel" required autoComplete="tel" maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)}/></label><label>Địa chỉ / điểm giao *<textarea required autoComplete="street-address" minLength={5} maxLength={500} rows={2} value={address} onChange={e=>setAddress(e.target.value)}/></label><label>Ghi chú<textarea maxLength={2000} rows={2} value={note} onChange={e=>setNote(e.target.value)}/></label></fieldset>{submit.isError&&<p className="public-order-error" role="alert">{submit.error.message}</p>}<button className="button primary public-submit" disabled={submit.isPending||(!pending&&(!lines.length||catalog.isPending||catalog.isError))}>{submit.isPending?'Đang gửi…':pending?'Kiểm tra lại lần gửi':'Gửi đơn đặt hàng'}<Icon name="arrow" size={16}/></button><small className="public-pending-note">{linkToken?'Đơn sẽ được chuyển về điểm bán liên kết. CHIFAA vẫn cần xác nhận đơn.':'Đơn sẽ được CHIFAA kiểm tra và xác nhận.'}</small></form>
  </aside></div>
 </section>;
}

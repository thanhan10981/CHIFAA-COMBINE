'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import Image from 'next/image';
import {useMutation,useQuery} from '@tanstack/react-query';
import Decimal from 'decimal.js';
import {browserSupabase} from '@/lib/supabase/browser';
import {LoadingState} from '@/components/feedback';
import {Icon,ShoppingBag} from '@/components/icons';
import {formatNumber,formatVnd} from '@/lib/format';
import {localDate} from '@/features/catalog/material-types';
import {publicOrderShift} from './public-order-shift';

type Product={product_id:string;code:string;name:string;sale_unit:string;price_vnd:string|null;image_path:string|null;discount_rate?:string|null};
type Topping={version_id:string;code:string;name:string;unit:string};
type ToppingCatalogRow={product_id:string;options:Topping[];required?:boolean;unavailable?:boolean;unavailable_count?:number};
type StoreContact={name:string;phone:string;address:string};
type ToppingSelection=Topping&{quantity:string};
type Line={product:Product;quantity:string;toppings?:ToppingSelection[]};
type Submission={p_date:string;p_shift:string;p_contact:{name:string;phone:string;address:string};p_items:{product_id:string;quantity:string;price_vnd:string;toppings:{version_id:string;quantity:string}[]}[];p_note:string;p_link_token:string|null;p_payment_method:'cash'|'bank';p_key:string};
const messages:Record<string,string>={PRODUCT_NOT_AVAILABLE:'Món vừa ngừng nhận đặt. Vui lòng chọn lại thực đơn.',PRICE_CHANGED:'Giá món vừa thay đổi. Vui lòng xem giá mới và chọn lại món.',ORDER_CUTOFF:'Đã qua giờ nhận đơn cho ngày này. Vui lòng chọn ngày giao khác.',DAILY_CAPACITY:'Số lượng đã vượt khả năng nhận đơn trong ngày. Vui lòng chọn ngày khác.',RATE_LIMIT:'Bạn gửi đơn quá nhanh. Vui lòng đợi một phút rồi thử lại.',INVALID_CONTACT:'Vui lòng kiểm tra tên, số điện thoại và địa chỉ giao.',INVALID_ORDER:'Vui lòng kiểm tra ngày giao.',INVALID_LINK:'Link điểm bán không hợp lệ hoặc đã bị thu hồi. Hãy liên hệ CHIFAA để nhận link mới.',INVALID_TOPPING_ALLOCATION:'Số phần topping chưa hợp lệ. Hãy chọn số nguyên dương cho từng loại.',TOPPING_ALLOCATION_EXCEEDS_ORDER_QUANTITY:'Tổng số topping không được nhiều hơn tổng số món.',TOPPING_NOT_AVAILABLE:'Topping vừa thay đổi hoặc không còn áp dụng cho món này. Hãy tải lại thực đơn.'};
const subscribeLinkToken=(onChange:()=>void)=>{window.addEventListener('hashchange',onChange);return()=>window.removeEventListener('hashchange',onChange);};
const getLinkToken=()=>window.location.hash.slice(1)||null;
const getServerLinkToken=()=>null;
const subscribeOrderShift=(onChange:()=>void)=>{const timer=window.setInterval(onChange,30_000);return()=>window.clearInterval(timer);};
const getOrderShift=()=>publicOrderShift();
const getServerOrderShift=()=>'AM' as const;
messages.TOPPING_REQUIRED='Vui lòng chọn đủ topping cho từng phần món trước khi gửi đơn.';
function toppingIssue(line:Line,configured:ToppingCatalogRow|undefined){
 const selected=line.toppings??[],options=configured?.options??[],quantity=Number(line.quantity),assigned=selected.reduce((sum,t)=>sum+Number(t.quantity),0);
 if(selected.some(t=>!options.some(option=>option.version_id===t.version_id)))return 'Topping của món vừa thay đổi. Vui lòng chọn lại topping.';
 if(configured?.unavailable||Number(configured?.unavailable_count??0)>0||((configured?.required||options.length>0)&&!options.length))return 'Topping của món đang được cập nhật. Vui lòng chọn món khác hoặc thử tải lại.';
 if(selected.some(t=>!/^[1-9]\d{0,5}$/.test(t.quantity))||assigned>quantity)return 'Số phần topping chưa hợp lệ. Vui lòng chỉnh lại phân bổ.';
 if((configured?.required||options.length>0)&&assigned!==quantity)return `Cần chọn topping cho đủ ${quantity} món (còn ${quantity-assigned} món chưa chọn).`;
 return null;
}
export function PublicShop(){
 const [date,setDate]=useState(localDate),[offset,setOffset]=useState(0),[basket,setBasket]=useState<Record<string,Line>>({}),[name,setName]=useState(''),[phone,setPhone]=useState(''),[address,setAddress]=useState(''),[note,setNote]=useState(''),[paymentMethod,setPaymentMethod]=useState<'cash'|'bank'>('cash'),[pending,setPending]=useState<Submission|null>(null),[confirmation,setConfirmation]=useState(''),linkToken=useSyncExternalStore(subscribeLinkToken,getLinkToken,getServerLinkToken),shift=useSyncExternalStore(subscribeOrderShift,getOrderShift,getServerOrderShift);
 const prefilledLink=useRef<string|null>(null);
 const catalog=useQuery({queryKey:['public-portal','catalog',date,offset,linkToken],staleTime:0,refetchInterval:30_000,queryFn:async({signal})=>{const {data,error}=linkToken?await browserSupabase().rpc('public_order_catalog_linked',{p_date:date,p_offset:offset,p_limit:100,p_link_token:linkToken}).abortSignal(signal):await browserSupabase().rpc('public_order_catalog',{p_date:date,p_offset:offset,p_limit:100}).abortSignal(signal);if(error)throw new Error(error.code==='PGRST202'?'Cổng đặt hàng đang được cập nhật. Vui lòng thử lại sau.':'Chưa tải được thực đơn. Vui lòng thử lại.');return data as {rows:Product[];total:string;store_contact?:StoreContact};}});
 useEffect(()=>{
  if(!linkToken){prefilledLink.current=null;return;}
  const contact=catalog.data?.store_contact;
  if(!contact||prefilledLink.current===linkToken)return;
  setName(contact.name??'');setPhone(contact.phone??'');setAddress(contact.address??'');prefilledLink.current=linkToken;
 },[catalog.data?.store_contact,linkToken]);
 const toppingCatalog=useQuery({queryKey:['public-portal','toppings',date],staleTime:0,refetchInterval:30_000,retry:false,queryFn:async({signal})=>{const {data,error}=await browserSupabase().rpc('public_order_topping_catalog_v2',{p_date:date}).abortSignal(signal);if(error)throw new Error(error.code==='PGRST202'?'Cổng đặt hàng đang được cập nhật lựa chọn topping. Vui lòng thử lại sau.':'Chưa tải được lựa chọn topping. Vui lòng thử lại trước khi gửi đơn.');const result=data as {schema_version?:number;rows?:ToppingCatalogRow[]}|null;if(result?.schema_version!==1||!Array.isArray(result.rows))throw new Error('Cổng đặt hàng đang được cập nhật lựa chọn topping. Vui lòng thử lại sau.');return result.rows;}});
 const toppingsByProduct=new Map((toppingCatalog.data??[]).map(row=>[row.product_id,row]));
 const lines=Object.values(basket).filter(line=>Number(line.quantity)>0);
 const allocationIssues=lines.flatMap(line=>{const issue=toppingIssue(line,toppingsByProduct.get(line.product.product_id));return issue?[{line,message:issue}]:[];});
 const allocationsValid=allocationIssues.length===0;
 const lineTotal=(line:Line)=>{const gross=new Decimal(line.product.price_vnd??'0').times(line.quantity).toDecimalPlaces(0),rate=new Decimal(line.product.discount_rate??'0');return gross.minus(gross.times(new Decimal(1).minus(rate)).toDecimalPlaces(0));};
 const discount=lines.reduce((sum,line)=>sum.plus(lineTotal(line)),new Decimal(0));
 const total=lines.reduce((sum,line)=>sum.plus(new Decimal(line.product.price_vnd??'0').times(line.quantity).toDecimalPlaces(0)).minus(lineTotal(line)),new Decimal(0));
 const submit=useMutation({retry:false,mutationFn:async(shiftAtSubmit:string)=>{
  let request=pending;
  if(!request){
   if(!lines.length)throw new Error('Chọn ít nhất một món trước khi gửi đơn.');
   if(toppingCatalog.isPending||toppingCatalog.isError)throw new Error('Vui lòng tải đầy đủ lựa chọn topping trước khi gửi đơn.');
   if(allocationIssues.length)throw new Error(`${allocationIssues[0].line.product.name}: ${allocationIssues[0].message}`);
   if(name.trim().length<2||!/^\+?\d{8,15}$/.test(phone.replace(/[\s().-]/g,''))||address.trim().length<5)throw new Error('Nhập tên, số điện thoại và địa chỉ giao hợp lệ.');
   request={p_date:date,p_shift:shiftAtSubmit,p_contact:{name:name.trim(),phone:phone.trim(),address:address.trim()},p_items:lines.map(line=>{if(!/^[1-9]\d{0,5}$/.test(line.quantity)||line.product.price_vnd===null)throw new Error('Số lượng phải là số nguyên từ 1 đến 999999 và món phải có giá.');const assigned=(line.toppings??[]).reduce((sum,t)=>sum+Number(t.quantity),0);if(assigned>Number(line.quantity))throw new Error(`Số phần topping của ${line.product.name} đang nhiều hơn số món.`);return {product_id:line.product.product_id,quantity:line.quantity,price_vnd:line.product.price_vnd,toppings:(line.toppings??[]).map(t=>({version_id:t.version_id,quantity:t.quantity}))};}),p_note:note.trim(),p_link_token:linkToken,p_payment_method:paymentMethod,p_key:crypto.randomUUID()};
   setPending(request);
  }
  const {data,error}=await browserSupabase().rpc('submit_public_order_with_toppings',request);
  if(error){
   if(error.code==='P0001'||error.code.startsWith('22')||error.code.startsWith('23')){
    setPending(null);const code=Object.keys(messages).find(code=>error.message.includes(code));
    if(code==='PRICE_CHANGED'||code==='PRODUCT_NOT_AVAILABLE'){setBasket({});void catalog.refetch();}
    if(code==='TOPPING_REQUIRED'||code==='TOPPING_NOT_AVAILABLE')void toppingCatalog.refetch();
    throw new Error(code?messages[code]:'Đơn chưa được chấp nhận. Vui lòng kiểm tra thông tin và thử lại.');
   }
   throw new Error('Chưa rõ kết quả gửi. Bấm “Kiểm tra lại lần gửi” để kiểm tra cùng đơn, tránh tạo trùng.');
  }
  return data as {order_id:string;status:string};
 },onSuccess:result=>{setPending(null);setBasket({});setConfirmation(result.order_id);}});
 const locked=submit.isPending||!!pending;
 function quantity(product:Product,value:string){if(locked||product.price_vnd===null)return;if(value!==''&&!/^\d{1,6}$/.test(value))return;setConfirmation('');setBasket(current=>{const existing=current[product.product_id];let remaining=Math.max(0,Number(value||0));const toppings=(existing?.toppings??[]).flatMap(t=>{const count=Math.min(Number(t.quantity),remaining);remaining-=count;return count>0?[{...t,quantity:String(count)}]:[];});return {...current,[product.product_id]:{...existing,product,quantity:value,toppings}};});}
 function setToppingCount(product:Product,topping:Topping,value:number){if(locked)return;setBasket(current=>{const existing=current[product.product_id];if(!existing)return current;const toppings=existing.toppings??[],others=toppings.filter(t=>t.version_id!==topping.version_id),available=Math.max(0,Number(existing.quantity||0)-others.reduce((sum,t)=>sum+Number(t.quantity),0)),count=Math.max(0,Math.min(Math.floor(value),available)),next=count?[...others,{...topping,quantity:String(count)}]:others;return {...current,[product.product_id]:{...existing,toppings:next}};});}
 function resetToppings(product:Product){if(locked)return;setBasket(current=>{const existing=current[product.product_id];return existing?{...current,[product.product_id]:{...existing,toppings:[]}}:current;});}
 return <section className="public-shop">
  <div className="public-hero"><div><p className="eyebrow">CHIFAA / ĐẶT HÀNG</p><h1>Món ngon, sẵn sàng mỗi sáng.</h1><p>Chọn món, nhập số lượng và gửi đơn. CHIFAA sẽ liên hệ xác nhận.</p><span className="public-open"><Icon name="check" size={14}/>{linkToken?'Link đặt hàng của điểm bán':'Đặt hàng trực tiếp, không cần tài khoản'}</span></div><span className="public-hero-icon"><ShoppingBag size={36}/></span></div>
  {confirmation&&<div className="public-confirmation" role="status"><Icon name="check" size={22}/><div><strong>Đã nhận đơn #{confirmation.slice(0,8)}</strong><p>Đơn đang chờ CHIFAA xác nhận qua thông tin liên hệ bạn cung cấp.</p></div></div>}
  <div className="public-shop-layout"><section className="public-menu panel"><header><div><h2>Thực đơn CHIFAA</h2><p>Các món đã được công bố trong danh mục món bán.</p></div><label>Ngày giao<input aria-label="Ngày giao" type="date" required min={localDate()} value={date} disabled={locked} onChange={e=>{if(!e.target.value)return;setDate(e.target.value);setBasket({});setOffset(0);setConfirmation('');}}/></label></header>
  {toppingCatalog.isPending&&<p role="status">Đang tải lựa chọn topping…</p>}
  {toppingCatalog.isError&&<div className="public-order-error" role="alert"><p>{toppingCatalog.error.message}</p><button type="button" className="button" disabled={toppingCatalog.isFetching||locked} onClick={()=>void toppingCatalog.refetch()}>Tải lại topping</button></div>}
  {catalog.isPending?<LoadingState label="Đang tải thực đơn…"/>:catalog.isError?<div role="alert"><p>{catalog.error.message}</p><button className="button" onClick={()=>void catalog.refetch()}>Thử lại</button></div>:<>
   <div className="public-products">{catalog.data.rows.map(product=>{
    const imageUrl=product.image_path?browserSupabase().storage.from('product-images').getPublicUrl(product.image_path).data.publicUrl:null;
    const line=basket[product.product_id],configured=toppingsByProduct.get(product.product_id),options=configured?.options??[],assigned=(line?.toppings??[]).reduce((sum,t)=>sum+Number(t.quantity),0),orderQuantity=Number(line?.quantity??0);
    const unavailable=!!configured?.unavailable||Number(configured?.unavailable_count??0)>0||!!(configured?.required&&!options.length),issue=orderQuantity>0&&line?toppingIssue(line,configured):null,stale=(line?.toppings??[]).some(t=>!options.some(option=>option.version_id===t.version_id));
    return <article className={'public-product'+(orderQuantity>0?' selected':'')} key={product.product_id}>
     <div className="public-food-image">{imageUrl?<Image src={imageUrl} alt={product.name} width={320} height={200} unoptimized/>:<span className="public-food-icon"><Icon name="box" size={24}/></span>}</div>
     <div className="public-product-copy"><small>{product.code} · {product.sale_unit}</small><h3>{product.name}</h3><strong>{product.price_vnd===null?'Chưa có giá':formatVnd(product.price_vnd)+' đ'}<small> / {product.sale_unit}</small></strong>{linkToken&&Number(product.discount_rate??0)>0&&<small>Chiết khấu {formatNumber(String(Number(product.discount_rate)*100))}%</small>}</div>
     <div className="public-quantity"><button type="button" aria-label={'Giảm '+product.name} disabled={locked||!orderQuantity||product.price_vnd===null} onClick={()=>quantity(product,String(Math.max(0,orderQuantity-1)))}>−</button><input aria-label={'Số lượng '+product.name} inputMode="numeric" type="number" min="0" max="999999" step="1" placeholder="0" disabled={locked||product.price_vnd===null} value={basket[product.product_id]?.quantity??''} onChange={e=>quantity(product,e.target.value)}/><button type="button" aria-label={'Tăng '+product.name} disabled={locked||orderQuantity>=999999||product.price_vnd===null} onClick={()=>quantity(product,String(orderQuantity+1))}>+</button></div>
     {(configured?.required||options.length>0||unavailable||stale)&&<fieldset className="public-topping-options" aria-label={'Topping cho '+product.name+' (bắt buộc)'}><legend>Topping <span>1 phần/món</span></legend>
      {unavailable?<p className="public-order-error">Topping của món đang được cập nhật. Vui lòng chọn món khác hoặc thử tải lại.</p>:options.map(t=>{
       const selectedTopping=line?.toppings?.find(chosen=>chosen.version_id===t.version_id),count=Number(selectedTopping?.quantity??0),otherCount=(line?.toppings??[]).filter(chosen=>chosen.version_id!==t.version_id).reduce((sum,chosen)=>sum+Number(chosen.quantity),0),max=Math.max(0,orderQuantity-otherCount);
       return <div className={'public-topping-row'+(count>0?' selected':'')} key={t.version_id}><label><input type="checkbox" aria-label={t.name+' · '+t.unit} checked={count>0} disabled={locked||stale||(count===0&&max===0)} onChange={e=>setToppingCount(product,t,e.target.checked?max:0)}/><span>{t.name}</span></label>{count>0&&<div className="public-topping-quantity"><button type="button" aria-label={'Giảm '+t.name+' cho '+product.name} disabled={locked||stale||count===0} onClick={()=>setToppingCount(product,t,count-1)}>−</button><output>{count}</output><button type="button" aria-label={'Tăng '+t.name+' cho '+product.name} disabled={locked||stale||count>=max} onClick={()=>setToppingCount(product,t,count+1)}>+</button></div>}</div>;
      })}
      {!unavailable&&<small className={'public-topping-allocation'+(orderQuantity>0&&assigned<orderQuantity?' incomplete':'')} role="status">{orderQuantity===0?'Chọn số lượng trước':`Đã chọn ${assigned}/${orderQuantity}`}{orderQuantity>0&&assigned<orderQuantity?` · còn ${orderQuantity-assigned}`:''}</small>}
      {issue&&!unavailable&&(stale||assigned>=orderQuantity)&&<p className="public-order-error" role="alert">{issue}</p>}
      {stale&&<button type="button" className="button" disabled={locked} onClick={()=>resetToppings(product)}>Chọn lại topping</button>}
     </fieldset>}
    </article>;
   })}</div>{catalog.data.rows.length===0&&<p className="empty">Chưa có món được công bố. Vui lòng quay lại sau.</p>}<footer className="public-pagination"><span>{catalog.data.total} món · Trang {offset/100+1}</span>{Number(catalog.data.total)>100&&<><button className="button" disabled={locked||offset===0} onClick={()=>setOffset(offset-100)}>Trước</button><button className="button" disabled={locked||offset+100>=Number(catalog.data.total)} onClick={()=>setOffset(offset+100)}>Sau</button></>}</footer></>}
  </section><aside className="public-checkout panel"><h2><ShoppingBag size={20}/>Đơn của bạn <span>{lines.length} món</span></h2>{lines.length?<ul className="public-cart">{lines.map(line=><li key={line.product.product_id}><div><strong>{line.product.name}</strong><small>{line.quantity} {line.product.sale_unit} × {formatVnd(line.product.price_vnd)} đ{Number(line.product.discount_rate??0)>0?` · CK ${formatNumber(String(Number(line.product.discount_rate)*100))}%`:''}</small>{line.toppings?.length?<small className="public-cart-toppings">Topping: {line.toppings.map(t=>`${t.quantity} ${t.name}`).join(", ")}</small>:null}</div><span>{formatVnd(new Decimal(line.product.price_vnd!).times(line.quantity).toDecimalPlaces(0).minus(lineTotal(line)).toString())} đ</span></li>)}</ul>:<p className="public-cart-empty">Chọn số lượng ở thực đơn để thêm món.</p>}{discount.gt(0)&&<div className="public-total"><span>Chiết khấu</span><strong>− {formatVnd(discount.toString())} đ</strong></div>}<div className="public-total"><span>Tổng thanh toán</span><strong>{formatVnd(total.toString())} đ</strong></div><p className="public-delivery-note">Chi phí giao hàng (nếu có) được CHIFAA xác nhận khi liên hệ.</p>
   <form onSubmit={e=>{e.preventDefault();const shiftAtSubmit=pending?.p_shift??publicOrderShift();submit.mutate(shiftAtSubmit);}}><input type="hidden" name="shift" value={shift}/><fieldset disabled={locked}><label>Tên người nhận *<input required autoComplete="name" minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label><label>Số điện thoại *<input type="tel" required autoComplete="tel" maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)}/></label><label>Địa chỉ / điểm giao *<textarea required autoComplete="street-address" minLength={5} maxLength={500} rows={2} value={address} onChange={e=>setAddress(e.target.value)}/></label><div role="radiogroup" aria-label="Phương thức thanh toán"><span>Phương thức thanh toán</span><label><input type="radio" name="payment_method" value="cash" checked={paymentMethod==='cash'} onChange={()=>setPaymentMethod('cash')}/> Tiền mặt</label><label><input type="radio" name="payment_method" value="bank" checked={paymentMethod==='bank'} onChange={()=>setPaymentMethod('bank')}/> Chuyển khoản</label></div><label>Ghi chú<textarea maxLength={2000} rows={2} value={note} onChange={e=>setNote(e.target.value)}/></label></fieldset>{submit.isError&&<p className="public-order-error" role="alert">{submit.error.message}</p>}{!pending&&allocationIssues.map(({line,message})=><p className="public-order-error" role="alert" key={line.product.product_id}>{line.product.name}: {message}</p>)}<button className="button primary public-submit" disabled={submit.isPending||(!pending&&(!lines.length||!allocationsValid||catalog.isPending||catalog.isError||toppingCatalog.isPending||toppingCatalog.isError))}>{submit.isPending?'Đang gửi…':pending?'Kiểm tra lại lần gửi':'Gửi đơn đặt hàng'}<Icon name="arrow" size={16}/></button><small className="public-pending-note">{linkToken?'Đơn sẽ được chuyển về điểm bán liên kết. CHIFAA vẫn cần xác nhận đơn.':'Đơn sẽ được CHIFAA kiểm tra và xác nhận.'}</small></form>
  </aside></div>
 </section>;
}

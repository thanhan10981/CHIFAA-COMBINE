'use client';
import {ToastNotice,LoadingState,ActionDialog} from '@/components/feedback';
import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {browserSupabase} from '@/lib/supabase/browser';
import {formatVnd} from '@/lib/format';
type Order={id:string;version:number|string;store_id:string|null;customer_id:string|null;delivery_date:string;shift:string;status:string;note:string|null;guest_name:string|null;guest_phone:string|null;guest_address:string|null};
type ReviewRequest={order:Order;approve:boolean;reason:string;store:string;key:string};
const statusLabel:Record<string,string>={submitted:'Chờ duyệt',approved:'Đã duyệt',rejected:'Đã từ chối',scheduled:'Đã lên kế hoạch',fulfilled:'Đã hoàn tất',cancelled:'Đã hủy',draft:'Nháp'};
export function ReviewOrders({userId,canApprove}:{userId:string;canApprove:boolean}){
 const queryClient=useQueryClient(),[page,setPage]=useState(0),[message,setMessage]=useState(''),[reject,setReject]=useState<Order|null>(null),[reason,setReason]=useState(''),[selected,setSelected]=useState<Order|null>(null),[store,setStore]=useState(''),[pending,setPending]=useState<ReviewRequest|null>(null);
 const query=useQuery({queryKey:[userId,'orders',page],refetchInterval:20_000,queryFn:async()=>{const {data,error}=await browserSupabase().from('customer_orders').select('id,version,store_id,customer_id,delivery_date,shift,status,note,guest_name,guest_phone,guest_address').order('created_at',{ascending:false}).range(page*25,page*25+24);if(error)throw new Error('Không thể tải đơn hàng.');return data as Order[];}});
 const stores=useQuery({queryKey:[userId,'order-store-options'],enabled:!!selected?.guest_name&&canApprove,queryFn:async()=>{const {data,error}=await browserSupabase().from('stores').select('id,code,name').eq('active',true).order('code').limit(1000);if(error)throw new Error('Cần quyền xem điểm bán để gán đơn công khai.');return data as {id:string;code:string;name:string}[];}});
 const mutation=useMutation({retry:false,mutationFn:async({order,approve}:{order:Order;approve:boolean})=>{
  const request=pending??{order,approve,reason:approve?'':reason,store,key:crypto.randomUUID()};
  if(!request.approve&&request.reason.trim().length<3)throw new Error('Cần lý do từ chối ít nhất3 ký tự.');
  if(request.approve&&request.order.guest_name&&!request.store)throw new Error('Chọn điểm bán để tiếp nhận đơn trước khi duyệt.');
  setPending(request);
  const args={p_order:request.order.id,p_expected_version:request.order.version,p_approve:request.approve,p_reason:request.reason,p_key:request.key};
  const {error}=request.order.guest_name?await browserSupabase().rpc('review_public_order',{...args,p_store:request.store||null}):await browserSupabase().rpc('review_order',args);
  if(error){if(error.code==='P0001'||error.code.startsWith('22')||error.code.startsWith('23'))setPending(null);throw new Error('Chưa xác nhận duyệt đơn. Nếu mất mạng, dùng “Kiểm tra lại lần gửi”; nếu dữ liệu thay đổi, tải lại trạng thái.');}
 },onSuccess:()=>{setPending(null);setSelected(null);setReject(null);setReason('');setMessage('Đã cập nhật trạng thái đơn.');void queryClient.invalidateQueries({queryKey:[userId,'orders']});},onError:e=>setMessage(e.message)});
 const locked=mutation.isPending||!!pending;
 return <section><div className="page-heading"><div><p className="eyebrow">CHIFAA / ĐƠN HÀNG</p><h1>Duyệt đơn đặt hàng</h1><p>Đơn từ cổng công khai và điểm bán. Duyệt đơn chưa ghi nhận doanh thu hoặc thu tiền.</p></div></div>
  <div className="panel table-wrap">{query.isPending?<LoadingState label="Đang tải…"/>:query.isError?<ToastNotice message={query.error.message} tone="error"/>:<table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày giao</th><th>Ca</th><th>Trạng thái</th><th>Ghi chú</th><th>Thao tác</th></tr></thead><tbody>{query.data.map(o=><tr key={o.id}><td>{o.id.slice(0,8)}</td><td>{o.guest_name?<><strong>{o.guest_name}</strong><br/><span>{o.guest_phone}</span><br/><small>Cổng công khai</small></>:'Điểm bán liên kết'}</td><td>{o.delivery_date}</td><td>{o.shift}</td><td>{statusLabel[o.status]??o.status}</td><td>{o.note}</td><td><div className="toolbar"><button className="button" disabled={locked} onClick={()=>{setSelected(o);setStore(o.store_id??'');}}>Xem đơn</button>{canApprove&&o.status==='submitted'&&<><button className="button primary" disabled={locked} onClick={()=>{if(o.guest_name){setSelected(o);setStore(o.store_id??'');}else mutation.mutate({order:o,approve:true});}}>Duyệt</button><button className="button" disabled={locked} onClick={()=>{setReject(o);setReason('');}}>Từ chối</button></>}</div></td></tr>)}</tbody></table>}
   <div className="toolbar"><button className="button" disabled={!page||locked} onClick={()=>setPage(page-1)}>Trang trước</button><button className="button" disabled={locked||!query.data||query.data.length<25} onClick={()=>setPage(page+1)}>Trang sau</button></div>
  </div>{!mutation.isPending&&message&&<ToastNotice message={message} tone={mutation.isError?'error':'success'} eventKey={mutation.submittedAt}/>}
  {pending&&!mutation.isPending&&<button className="button" onClick={()=>mutation.mutate({order:pending.order,approve:pending.approve})}>Kiểm tra lại lần gửi</button>}
  {selected&&<ActionDialog title={'Đơn #'+selected.id.slice(0,8)} busy={locked} onClose={()=>setSelected(null)}>
   <p>{selected.delivery_date} · {selected.shift} · {statusLabel[selected.status]??selected.status}</p>
   {selected.guest_name&&<div><strong>{selected.guest_name} · {selected.guest_phone}</strong><p>Địa chỉ giao: {selected.guest_address}</p><small>Thông tin khách tự cung cấp; cần liên hệ xác nhận.</small></div>}
   <OrderLines userId={userId} orderId={selected.id}/>{selected.note&&<p>Ghi chú: {selected.note}</p>}
   {canApprove&&selected.guest_name&&selected.status==='submitted'&&<><label>Điểm bán tiếp nhận đơn<select aria-label="Điểm bán tiếp nhận đơn" value={store} disabled={locked} onChange={e=>setStore(e.target.value)}><option value="">Chọn điểm bán</option>{stores.data?.map(s=><option value={s.id} key={s.id}>{s.code} · {s.name}</option>)}</select></label>{stores.isFetching&&<LoadingState compact/>}{stores.isError&&<p role="alert">{stores.error.message}</p>}<p className="muted">Gán về điểm bán có sẵn để theo dõi giao hàng và đối soát. Giá món giữ đúng đơn khách đã gửi.</p><button className="button primary" disabled={locked||!store} onClick={()=>mutation.mutate({order:selected,approve:true})}>Xác nhận duyệt đơn</button></>}
  </ActionDialog>}
  {reject&&<ActionDialog title="Từ chối đơn hàng" busy={locked} onClose={()=>setReject(null)}><form onSubmit={e=>{e.preventDefault();mutation.mutate({order:reject,approve:false});}}><label>Lý do từ chối<textarea required minLength={3} value={reason} maxLength={2000} disabled={locked} onChange={e=>setReason(e.target.value)}/></label><div className="toolbar"><button type="button" className="button" disabled={locked} onClick={()=>setReject(null)}>Hủy</button><button className="button primary" disabled={locked}>Xác nhận từ chối</button></div></form></ActionDialog>}
 </section>;
}
function OrderLines({userId,orderId}:{userId:string;orderId:string}){
 const query=useQuery({queryKey:[userId,'order-lines',orderId],queryFn:async()=>{const {data,error}=await browserSupabase().from('customer_order_items').select('id,product_id,quantity,price_vnd,discount_rate,product_name,product_code,sale_unit').eq('order_id',orderId).order('id');if(error)throw new Error('Chưa tải được món trong đơn.');return data as {id:string;product_id:string;quantity:string;price_vnd:string;discount_rate:string;product_name:string|null;product_code:string|null;sale_unit:string|null}[];}});
 return query.isPending?<LoadingState label="Đang tải món…"/>:query.isError?<p role="alert">{query.error.message}</p>:<div className="table-wrap"><table><thead><tr><th>Món</th><th>Số lượng</th><th>Đơn giá</th></tr></thead><tbody>{query.data.map(item=><tr key={item.id}><td>{item.product_name??'Món '+item.product_id.slice(0,8)}<br/><small>{item.product_code}</small></td><td>{item.quantity} {item.sale_unit}</td><td>{formatVnd(item.price_vnd)} đ</td></tr>)}</tbody></table></div>;
}

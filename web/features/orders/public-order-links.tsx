'use client';
import {useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {ArrowUpRight,Copy,Plus,RefreshCw,X} from 'lucide-react';
import {ActionDialog,LoadingState} from '@/components/feedback';
import {browserSupabase} from '@/lib/supabase/browser';

type Store={id:string;code:string;name:string};
type LinkRow={link_id:string;store_id:string;store_code:string;store_name:string;created_at:string;revoked_at:string|null};
type CreatedLink={link_id:string;token:string;store_id:string;store_code:string;store_name:string};
type PendingRequest={store:string;key:string};

export function PublicOrderLinks({userId,canCreate}:{userId:string;canCreate:boolean}){
 const queryClient=useQueryClient();
 const [open,setOpen]=useState(false),[store,setStore]=useState(''),[issued,setIssued]=useState<CreatedLink|null>(null),[pending,setPending]=useState<PendingRequest|null>(null),[copied,setCopied]=useState(false),[message,setMessage]=useState('');
 const stores=useQuery({queryKey:[userId,'public-order-link-stores'],enabled:open&&canCreate,queryFn:async()=>{const {data,error}=await browserSupabase().from('stores').select('id,code,name').eq('active',true).order('code').limit(1000);if(error)throw new Error('Cần quyền xem điểm bán để tạo link.');return data as Store[];}});
 const links=useQuery({queryKey:[userId,'public-order-links'],enabled:open&&canCreate,queryFn:async()=>{const {data,error}=await browserSupabase().rpc('public_order_links');if(error)throw new Error('Không tải được link điểm bán.');return data as LinkRow[];}});
 const create=useMutation({retry:false,mutationFn:async(request:PendingRequest)=>{const {data,error}=await browserSupabase().rpc('create_public_order_link',{p_store:request.store,p_key:request.key});if(error)throw new Error(error.message.includes('FORBIDDEN')?'Tài khoản chưa có quyền tạo link đơn hàng.':'Chưa tạo được link. Hãy thử lại; nếu mạng vừa gián đoạn, gửi lại để kiểm tra cùng yêu cầu.');return data as CreatedLink;},onSuccess:result=>{setPending(null);setIssued(result);setStore(result.store_id);setCopied(false);setMessage('');void queryClient.invalidateQueries({queryKey:[userId,'public-order-links']});},onError:error=>setMessage(error.message)});
 const revoke=useMutation({retry:false,mutationFn:async(linkId:string)=>{const {error}=await browserSupabase().rpc('revoke_public_order_link',{p_link:linkId,p_key:crypto.randomUUID()});if(error)throw new Error(error.message.includes('FORBIDDEN')?'Tài khoản không thể thu hồi link này.':'Không thu hồi được link. Hãy tải lại danh sách và thử lại.');},onSuccess:()=>{setMessage('Đã thu hồi link.');void queryClient.invalidateQueries({queryKey:[userId,'public-order-links']});},onError:error=>setMessage(error.message)});
 const activeLinks=useMemo(()=>links.data?.filter(row=>!row.revoked_at)??[],[links.data]);
 async function copyLink(){if(!issued)return;const url=window.location.origin+'/portal#'+issued.token;try{await navigator.clipboard.writeText(url);setCopied(true);setMessage('Đã sao chép link.');}catch{setCopied(false);setMessage('Không sao chép tự động được. Bạn có thể chọn và sao chép đường dẫn bên dưới.');}}
 function close(){if(create.isPending||revoke.isPending)return;setOpen(false);setMessage('');}
 return <>
  <button type="button" className="reference-portal" aria-label="Cổng đặt hàng" aria-haspopup="dialog" onClick={()=>{setOpen(true);setMessage('');}}><span className="portal-label">Cổng đặt hàng</span> <ArrowUpRight size={14}/></button>
  {open&&typeof document!=='undefined'&&createPortal(<ActionDialog title="Tạo link cho điểm bán" onClose={close} busy={create.isPending||revoke.isPending} className="public-order-link-dialog">
   <p>Chọn điểm bán để tạo link đặt hàng. Đơn gửi qua link sẽ vào danh sách <strong>Đơn đặt hàng</strong> và gắn sẵn với điểm bán này.</p>
   {!canCreate?<div className="notice">Tài khoản cần quyền tạo đơn hàng và xem điểm bán để tạo link.</div>:<>
    {stores.isPending?<LoadingState label="Đang tải điểm bán…" compact/>:stores.isError?<div role="alert" className="error">{stores.error.message}<button type="button" className="button" onClick={()=>void stores.refetch()}>Thử lại</button></div>:<><label htmlFor="public-order-link-store">Điểm bán</label><select id="public-order-link-store" aria-label="Điểm bán" value={pending?.store??store} disabled={!!pending||create.isPending} onChange={event=>{setStore(event.target.value);setIssued(null);setMessage('');}}><option value="">Chọn điểm bán</option>{stores.data?.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></>}
    <div className="toolbar"><button type="button" className="button primary" disabled={(!store&&!pending)||stores.isPending||stores.isError||create.isPending||revoke.isPending} onClick={()=>{const request=pending??{store,key:crypto.randomUUID()};setPending(request);create.mutate(request);}}>{create.isPending?<RefreshCw size={16} className="spin"/>:pending?<RefreshCw size={16}/>:<Plus size={16}/>} {pending?'Thử lại tạo link':'Tạo link'}</button></div>
    {issued&&<section className="panel order-link-created"><strong>Link cho {issued.store_code} · {issued.store_name}</strong><label>Đường dẫn đặt hàng<input readOnly value={window.location.origin+'/portal#'+issued.token} onFocus={event=>event.currentTarget.select()}/></label><div className="toolbar"><button type="button" className="button" onClick={()=>void copyLink()}><Copy size={16}/>{copied?'Đã sao chép':'Sao chép link'}</button><a className="button" href={'/portal#'+issued.token} target="_blank" rel="noreferrer">Mở cổng đặt hàng <ArrowUpRight size={14}/></a></div><small>Giữ link này riêng cho điểm bán. Link chỉ hiển thị đầy đủ ngay sau khi tạo.</small></section>}
    {links.isPending?<LoadingState label="Đang tải link đã tạo…" compact/>:links.isError?<div role="alert" className="error">{links.error.message}<button type="button" className="button" onClick={()=>void links.refetch()}>Thử lại</button></div>:activeLinks.length>0&&<section className="order-link-list"><h3>Link đang hoạt động</h3>{activeLinks.map(row=><article key={row.link_id}><div><strong>{row.store_code} · {row.store_name}</strong><small>Tạo lúc {new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(row.created_at))}</small></div><button type="button" className="button" disabled={revoke.isPending} onClick={()=>revoke.mutate(row.link_id)}><X size={15}/>Thu hồi</button></article>)}</section>}
   </>}
   {message&&<p className={create.isError||revoke.isError?'error':'muted'} role={create.isError||revoke.isError?'alert':'status'}>{message}</p>}
  </ActionDialog>,document.body)}
 </>;
}

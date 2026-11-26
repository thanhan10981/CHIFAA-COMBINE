'use client';
import {useState} from 'react';
import {createPortal} from 'react-dom';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {ArrowUpRight,Copy,Plus,RefreshCw} from 'lucide-react';
import {ActionDialog,LoadingState} from '@/components/feedback';
import {browserSupabase} from '@/lib/supabase/browser';

type Store={id:string;code:string;name:string};
type SavedLink={link_id:string;token:string;store_id:string;store_code:string;store_name:string};
type PendingRequest={store:string;key:string};

export function PublicOrderLinks({userId,canCreate}:{userId:string;canCreate:boolean}){
 const queryClient=useQueryClient();
 const [open,setOpen]=useState(false),[store,setStore]=useState(''),[pending,setPending]=useState<PendingRequest|null>(null),[copied,setCopied]=useState(false),[message,setMessage]=useState('');
 const stores=useQuery({queryKey:[userId,'public-order-link-stores'],enabled:open&&canCreate,queryFn:async({signal})=>{const {data,error}=await browserSupabase().from('stores').select('id,code,name').eq('active',true).order('code').limit(1000).abortSignal(signal);if(error)throw new Error('Cần quyền xem điểm bán để lấy link.');return data as Store[];}});
 const links=useQuery({queryKey:[userId,'public-order-links-v2'],enabled:open&&canCreate,staleTime:0,queryFn:async({signal})=>{const {data,error}=await browserSupabase().rpc('public_order_links_v2').abortSignal(signal);if(error)throw new Error(error.code==='PGRST202'?'Cần cập nhật database để lưu và lấy lại link cố định.':'Không tải được link điểm bán. Hãy thử lại.');return data as SavedLink[];}});
 const create=useMutation({retry:false,mutationFn:async(request:PendingRequest)=>{const {data,error}=await browserSupabase().rpc('create_public_order_link',{p_store:request.store,p_key:request.key});if(error)throw new Error(error.message.includes('FORBIDDEN')?'Tài khoản chưa có quyền lấy link điểm bán này.':error.message.includes('LINK_REVOKED')?'Link đã bị thu hồi. Đóng hộp thoại rồi mở lại để tải trạng thái mới.':'Chưa lấy được link. Thử lại để kiểm tra cùng yêu cầu.');return data as SavedLink;},onSuccess:result=>{setPending(null);setCopied(false);setMessage('');queryClient.setQueryData<SavedLink[]>([userId,'public-order-links-v2'],rows=>[...(rows??[]).filter(row=>row.store_id!==result.store_id),result]);void queryClient.invalidateQueries({queryKey:[userId,'public-order-links-v2']});},onError:error=>setMessage(error.message)});
 const selectedStore=pending?.store??store,selectedLink=links.data?.find(row=>row.store_id===selectedStore);
 const revoke=useMutation({retry:false,mutationFn:async(linkId:string)=>{const {error}=await browserSupabase().rpc('revoke_public_order_link',{p_link:linkId,p_key:crypto.randomUUID()});if(error)throw new Error('Chưa thu hồi được link. Tải lại và thử lại.');},onSuccess:()=>{setCopied(false);setMessage('Đã thu hồi link.');void queryClient.invalidateQueries({queryKey:[userId,'public-order-links-v2']});},onError:error=>setMessage(error.message)});
 const ready=!!selectedLink&&!links.isFetching&&!links.isError;
 const url=ready&&typeof window!=='undefined'?window.location.origin+'/portal#'+selectedLink.token:'';
 async function copyLink(){if(!url)return;try{await navigator.clipboard.writeText(url);setCopied(true);setMessage('Đã sao chép link.');}catch{setMessage('Hãy chọn và sao chép đường dẫn bên dưới.');}}
 function close(){if(create.isPending||revoke.isPending)return;setOpen(false);setMessage('');setPending(null);setCopied(false);}
 return <>
  <button type="button" className="reference-portal" aria-label="Cổng đặt hàng" aria-haspopup="dialog" onClick={()=>{setOpen(true);setMessage('');}}><span className="portal-label">Cổng đặt hàng</span> <ArrowUpRight size={14}/></button>
  {open&&typeof document!=='undefined'&&createPortal(<ActionDialog title="Link đặt hàng điểm bán" onClose={close} busy={create.isPending||revoke.isPending} className="public-order-link-dialog">
   <p className="order-link-intro">Mỗi điểm bán dùng một link cố định. Mở lại tại đây để sao chép.</p>
   {!canCreate?<div className="notice">Cần quyền tạo đơn hàng và xem điểm bán để lấy link.</div>:<>
    {stores.isPending?<LoadingState label="Đang tải điểm bán…" compact/>:stores.isError?<div role="alert" className="error">{stores.error.message}<button type="button" className="button" onClick={()=>void stores.refetch()}>Thử lại</button></div>:<label className="order-link-store">Điểm bán<select aria-label="Điểm bán" value={selectedStore} disabled={!!pending||create.isPending} onChange={event=>{setStore(event.target.value);setCopied(false);setMessage('');}}><option value="">Chọn điểm bán</option>{stores.data?.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>}
    {links.isFetching?<LoadingState label="Đang tải link đã lưu…" compact/>:links.isError?<div role="alert" className="error">{links.error.message}<button type="button" className="button" onClick={()=>void links.refetch()}>Thử lại</button></div>:selectedStore&&<>
     {ready?<section className="order-link-created"><label>Đường dẫn đặt hàng<input readOnly value={url} onFocus={event=>event.currentTarget.select()}/></label><div className="order-link-actions"><button type="button" className="button primary" disabled={revoke.isPending} onClick={()=>void copyLink()}><Copy size={16}/>{copied?'Đã sao chép':'Sao chép link'}</button><a className="button" href={url} target="_blank" rel="noreferrer">Mở link <ArrowUpRight size={14}/></a></div><small>Đơn gửi qua link được gắn sẵn với điểm bán này.</small><details><summary>Quản lý link</summary><button type="button" className="button" disabled={revoke.isPending} onClick={()=>revoke.mutate(selectedLink.link_id)}>Thu hồi link</button></details></section>:<div className="order-link-empty"><p>Chưa có link cố định được lưu cho điểm bán này.</p><button type="button" className="button primary" disabled={stores.isPending||stores.isError||create.isPending||revoke.isPending} onClick={()=>{const request=pending??{store:selectedStore,key:crypto.randomUUID()};setPending(request);create.mutate(request);}}>{create.isPending||pending?<RefreshCw size={16}/>:<Plus size={16}/>} {create.isPending?'Đang lấy link…':pending?'Thử lại lấy link':'Lấy link cố định'}</button></div>}
    </>}
   </>}
   {message&&<p className={create.isError||revoke.isError?'error':'muted'} role={create.isError||revoke.isError?'alert':'status'}>{message}</p>}
  </ActionDialog>,document.body)}
 </>;
}

'use client';
import {ingredientWarehouseId,IngredientWarehouseStatus} from '@/features/operations/ingredient-warehouse';
import {ToastNotice,LoadingState} from '@/components/feedback';

import {useState,useEffect} from 'react';
import {useSearchParams} from 'next/navigation';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {browserSupabase} from '@/lib/supabase/browser';
import {formatQuantity} from '@/lib/format';

type CountRow = {id:string; code:string; name:string; unit_id:string; unit_code:string; quantity:string|null};
type Snapshot = {inventory_version:string; rows:CountRow[]};
type Request = {p_warehouse:string; p_date:string; p_lines:{material_id:string; counted_quantity:string}[]; p_inventory_version:string; p_key:string};

export function StockCount({userId, canPost,businessDate,onDirty}:{userId:string; canPost:boolean;businessDate?:string;onDirty?:(dirty:boolean)=>void}) {
 const cache = useQueryClient(),params=useSearchParams();
 const [ownDate,setDate] = useState(()=>/^\d{4}-\d\d-\d\d$/.test(params.get('date')??'')?params.get('date')!:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date()));
 const date=businessDate??ownDate;
 const [search,setSearch] = useState('');
 const [offset,setOffset] = useState(0);
 const [counts,setCounts] = useState<Record<string,string>>({});
 const [pending,setPending] = useState<Request|null>(null);
 const [message,setMessage] = useState('');
 const warehouses = useQuery({queryKey:[userId,'inventory','warehouses'],queryFn:async()=>{
  const {data,error}=await browserSupabase().from('warehouses').select('id,name').eq('active',true).eq('kind','ingredient').order('name');
  if(error) throw new Error('Chưa tải được danh sách kho.');
  return data as {id:string; name:string}[];
 }});
 const warehouse=ingredientWarehouseId(warehouses.data);
 const snapshot = useQuery({queryKey:[userId,'counts','snapshot',warehouse,date,search,offset],enabled:!!warehouse&&!!date,
  staleTime:Infinity,refetchOnWindowFocus:false,queryFn:async()=>{
   const {data,error}=await browserSupabase().rpc('stock_count_snapshot',{p_warehouse:warehouse,p_date:date,p_search:search,p_offset:offset});
   if(error) throw new Error('Chưa tải được bảng kiểm kê. Kiểm tra quyền xem Kho và Kiểm kê.');
   return data as Snapshot;
  }});
 const save = useMutation({retry:false,mutationFn:async()=>{
  let request=pending;
  if(!request) {
   const rows=(snapshot.data?.rows??[]).slice(0,50);
   const lines=rows.filter(row=>counts[row.id]!==undefined&&counts[row.id]!=='').map(row=>({material_id:row.id,counted_quantity:counts[row.id].trim().replace(',','.')}));
   if(!lines.length||!lines.every(line=>/^\d+(?:\.\d{1,6})?$/.test(line.counted_quantity))||!snapshot.data) throw new Error('Nhập số đếm thực tế cho ít nhất một vật tư. Số 0 được chấp nhận; ô trống được bỏ qua.');
   request={p_warehouse:warehouse,p_date:date,p_lines:lines,p_inventory_version:snapshot.data.inventory_version,p_key:crypto.randomUUID()};
   setPending(request);
  }
  const {error}=await browserSupabase().rpc('post_stock_count',request);
  if(error) {
   if(error.code==='P0001'||error.code.startsWith('23')||error.code.startsWith('22')) {
    setPending(null);
    if(error.message.includes('INVENTORY_VERSION_CONFLICT')) throw new Error('Tồn kho đã thay đổi. Ghi lại số đếm của bạn rồi bấm “Tải lại tồn” để đối chiếu trước khi gửi lại.');
    throw new Error('Phiếu chưa được lưu. Kiểm tra quyền duyệt, kỳ khóa, đơn vị và số lượng.');
   }
   throw new Error('Chưa nhận được xác nhận. Giữ nguyên phiếu và bấm kiểm tra lại; hệ thống dùng cùng mã yêu cầu để tránh ghi trùng.');
  }
 },onSuccess:()=>{
  setPending(null);setCounts({});setMessage('Đã ghi kiểm kê và điều chỉnh kho trong cùng giao dịch.');
  void cache.invalidateQueries({queryKey:[userId,'inventory']});
  void cache.invalidateQueries({queryKey:[userId,'counts']});void cache.invalidateQueries({queryKey:[userId,'usage-evidence']});void cache.invalidateQueries({queryKey:[userId,'production-materials']});
  void cache.invalidateQueries({queryKey:[userId,'dashboard']});
 },onError:error=>setMessage(error.message)});
 const locked=save.isPending||!!pending;
 const hasDraft=Object.values(counts).some(value=>value!=='');
 useEffect(()=>{onDirty?.(hasDraft||locked);},[hasDraft,locked,onDirty]);
 const reset=()=>{setCounts({});setMessage('');};
 const Heading=businessDate?'h2':'h1';
 return <section className={businessDate?'pm-shared-count':undefined}>
  <div className="page-heading"><div><p className="eyebrow">CHIFAA / KHO</p><Heading>Phiếu kiểm kê nguyên liệu</Heading><p>Nhập số đếm theo đơn vị chuẩn. Chỉ các dòng đã nhập được ghi nhận; ô trống không được coi là 0.</p></div></div>
  <div className="panel">{warehouses.isFetching&&<LoadingState compact label="Đang tải danh sách kho…"/>}
   <fieldset disabled={locked||hasDraft}><div className="form-grid">
    {!businessDate&&<label>Ngày kiểm kê<input type="date" value={date} onChange={e=>{setDate(e.target.value);reset();}}/></label>}
    <p>Kho: <b>Nguyên liệu</b></p><IngredientWarehouseStatus rows={warehouses.data}/>
   </div><div className="toolbar">
    <input aria-label="Tìm vật tư theo tiền tố mã hoặc tên" placeholder="Tìm mã hoặc tên vật tư…" value={search} maxLength={100} onChange={e=>{setSearch(e.target.value);setOffset(0);reset();}}/>
    <button className="button" disabled={!warehouse||snapshot.isFetching} onClick={()=>{reset();void snapshot.refetch();}}>Tải lại tồn</button>
   </div></fieldset>
   {snapshot.isFetching&&<LoadingState compact label="Đang tải tồn kho…"/>}
   {(warehouses.isError||snapshot.isError)&&<ToastNotice message={warehouses.error?.message||snapshot.error?.message} tone="error"/>}
   {warehouse&&snapshot.data&&<>
    <div className="table-wrap"><table><thead><tr><th>Mã</th><th>Vật tư</th><th>Đơn vị chuẩn</th><th>Tồn theo sổ</th><th>Số đếm thực tế</th></tr></thead><tbody>
     {snapshot.data.rows.slice(0,50).map(row=><tr key={row.id}><td>{row.code}</td><td>{row.name}</td><td>{row.unit_code}</td><td>{row.quantity===null?'Chưa có chuyển động':formatQuantity(row.quantity)}</td><td><input aria-label={`Số đếm ${row.name}`} inputMode="decimal" disabled={!canPost||locked||snapshot.isFetching} value={counts[row.id]??''} placeholder="Bỏ qua" onChange={e=>setCounts({...counts,[row.id]:e.target.value})}/></td></tr>)}
    </tbody></table>{!snapshot.data.rows.length&&<p className="empty">Không có vật tư phù hợp đã thiết lập đơn vị chuẩn.</p>}</div>
    <div className="toolbar">
     <button className="button" disabled={locked||hasDraft||offset===0} onClick={()=>{setOffset(offset-50);reset();}}>Trước</button>
     <button className="button" disabled={locked||hasDraft||snapshot.isFetching||snapshot.data.rows.length<=50} onClick={()=>{setOffset(offset+50);reset();}}>Sau</button>
     <button className="button" disabled={locked||!hasDraft} onClick={reset}>Bỏ số đếm chưa lưu</button>
     <span className="muted">Dòng {offset+1}–{offset+Math.min(snapshot.data.rows.length,50)} · Mỗi lần lưu các số đếm trên trang này</span>
    </div>
    <button className="button primary" disabled={!canPost||save.isPending||snapshot.isFetching} onClick={()=>save.mutate()}>{save.isPending?'Đang lưu…':pending?'Kiểm tra lại lần lưu':'Ghi kiểm kê & điều chỉnh'}</button>
   </>}
   {!canPost&&<ToastNotice message="Cần quyền duyệt Kiểm kê và tạo phiếu Kho để ghi kiểm kê." tone="info"/>}
   {!save.isPending&&message&&<ToastNotice message={message} tone={save.isError?'error':'success'} eventKey={save.submittedAt}/>}
  </div>
 </section>;
}

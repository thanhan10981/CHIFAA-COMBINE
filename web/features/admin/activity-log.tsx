'use client';
import {ToastNotice,LoadingState} from '@/components/feedback';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {RefreshCw} from '@/components/icons';
import {browserSupabase} from '@/lib/supabase/browser';
type Entry={id:number;at:string;action:string;table_name:string;record_id:string|null};
const dateTime=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'medium'});
const tableLabels:Record<string,string>={
 recipe_items:'Thành phần công thức',recipe_topping_options:'Lựa chọn topping',recipe_versions:'Phiên bản công thức',recipes:'Công thức',audit_logs:'Nhật ký hệ thống',
 products:'Món bán',product_prices:'Giá món bán',customer_orders:'Đơn đặt hàng',customer_order_items:'Món trong đơn',
 customer_order_item_toppings:'Topping trong đơn',materials:'Vật tư',inventory_movements:'Phiếu kho',inventory_movement_lines:'Chi tiết phiếu kho',
 profiles:'Tài khoản',user_roles:'Quyền người dùng',stores:'Điểm bán',
};
const actionLabels:Record<string,string>={INSERT:'Đã thêm',UPDATE:'Đã cập nhật',DELETE:'Đã xóa',GRANT_UPDATE:'Đã đổi quyền',PERIOD_CLOSED:'Đã khóa kỳ',PERIOD_REOPENED:'Đã mở lại kỳ',AUDIT_RETENTION_PURGE:'Đã dọn nhật ký quá hạn'};
export function ActivityLog({userId,canCleanup}:{userId:string;canCleanup:boolean}){
 const [page,setPage]=useState(0),[search,setSearch]=useState(''),[filter,setFilter]=useState(''),[cleaning,setCleaning]=useState(false),[cleanupMessage,setCleanupMessage]=useState('');
 const query=useQuery({queryKey:[userId,'activity-log',page,filter],queryFn:async({signal})=>{
  let request=browserSupabase().from('audit_logs').select('id,at,action,table_name,record_id',{count:'exact'}).order('at',{ascending:false}).order('id',{ascending:false}).range(page*25,page*25+24).abortSignal(signal);
  if(filter)request=request.ilike('table_name',filter.replace(/[^a-z_]/g,'')+'%');
  const {data,count,error}=await request;if(error)throw new Error('Chưa tải được nhật ký. Kiểm tra quyền nhật ký và quyền xem phân hệ.');return {rows:data as Entry[],total:count??0};
 }});
 const cleanExpired=async()=>{if(cleaning||!window.confirm('Xóa vĩnh viễn nhật ký cũ hơn 30 ngày? Nhật ký trong 30 ngày gần nhất sẽ được giữ lại.'))return;setCleaning(true);setCleanupMessage('');try{const {data,error}=await browserSupabase().rpc('clean_expired_audit_logs');if(error)throw error;const result=data as {deleted_count?:number};setCleanupMessage(`Đã xóa ${result.deleted_count??0} bản ghi nhật ký quá 30 ngày.`);setPage(0);setSearch('');setFilter('');await query.refetch();}catch{setCleanupMessage('Chưa dọn được nhật ký. Kiểm tra quyền Quản trị hệ thống và migration 077.');}finally{setCleaning(false);}};
 return <section><div className="page-heading"><div><p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p><h1>Nhật ký &amp; đồng bộ</h1><p>Nhật ký được lưu trong 30 ngày gần nhất; bản ghi cũ hơn sẽ tự động được dọn mỗi ngày.</p></div><div className="toolbar">{canCleanup&&<button className="button" disabled={cleaning} onClick={()=>void cleanExpired()}>{cleaning?'Đang dọn…':'Dọn nhật ký quá 30 ngày'}</button>}<button className="button" disabled={query.isFetching} onClick={()=>{void query.refetch();}}><RefreshCw size={15}/>Tải lại nhật ký</button></div></div><div className="card table-panel"><div className="card-head"><div><h3>Nhật ký hoạt động</h3><p>{query.data?.total??'—'} sự kiện trong phạm vi quyền truy cập. Nhật ký cũ hơn 30 ngày sẽ bị xóa vĩnh viễn.</p></div><form className="filters" onSubmit={event=>{event.preventDefault();setPage(0);setFilter(search);}}><input aria-label="Tên bảng trong nhật ký" placeholder="Lọc theo loại dữ liệu…" value={search} onChange={event=>setSearch(event.target.value)}/><button className="button">Tìm kiếm</button></form></div>{cleanupMessage&&<p className="empty" role="status">{cleanupMessage}</p>}{query.isPending?<LoadingState label="Đang tải nhật ký…"/>:query.isError?<ToastNotice message={query.error.message} tone="error"/>:<div className="table-wrap"><table><thead><tr><th>Thời gian</th><th>Hoạt động</th><th>Nội dung</th><th>Mã tham chiếu</th></tr></thead><tbody>{query.data.rows.map(row=><tr key={row.id}><td>{dateTime.format(new Date(row.at))}</td><td><span className="badge badge-gray">{actionLabels[row.action]??row.action}</span></td><td>{tableLabels[row.table_name]??row.table_name}</td><td>{row.record_id??'—'}</td></tr>)}</tbody></table>{!query.data.rows.length&&<p className="empty">Chưa có hoạt động phù hợp với bộ lọc.</p>}</div>}<div className="toolbar"><button className="button" disabled={!page||query.isFetching} onClick={()=>setPage(page-1)}>Trang trước</button><span>Trang {page+1}</span><button className="button" disabled={!query.data||(page+1)*25>=query.data.total||query.isFetching} onClick={()=>setPage(page+1)}>Trang sau</button></div></div></section>;
}

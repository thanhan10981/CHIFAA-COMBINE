'use client';
import {ToastNotice,LoadingState} from '@/components/feedback';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {RefreshCw} from '@/components/icons';
import {browserSupabase} from '@/lib/supabase/browser';
type Entry={id:number;at:string;action:string;table_name:string;record_id:string|null};
const dateTime=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'medium'});
export function ActivityLog({userId}:{userId:string}){
 const [page,setPage]=useState(0),[search,setSearch]=useState(''),[filter,setFilter]=useState('');
 const query=useQuery({queryKey:[userId,'activity-log',page,filter],queryFn:async({signal})=>{
  let request=browserSupabase().from('audit_logs').select('id,at,action,table_name,record_id',{count:'exact'}).order('at',{ascending:false}).order('id',{ascending:false}).range(page*25,page*25+24).abortSignal(signal);
  if(filter)request=request.ilike('table_name',filter.replace(/[^a-z_]/g,'')+'%');
  const {data,count,error}=await request;if(error)throw new Error('Chưa tải được nhật ký. Kiểm tra quyền nhật ký và quyền xem phân hệ.');return {rows:data as Entry[],total:count??0};
 }});
 return <section><div className="page-heading"><div><p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p><h1>Nhật ký &amp; đồng bộ</h1><p>Các lần ghi đã được database xác nhận. Chỉ hiện lịch sử của những phân hệ bạn có quyền xem.</p></div><button className="button" disabled={query.isFetching} onClick={()=>void query.refetch()}><RefreshCw size={15}/>Tải lại nhật ký</button></div><div className="card table-panel"><div className="card-head"><div><h3>Nhật ký hoạt động</h3><p>{query.data?.total??'—'} sự kiện trong phạm vi quyền truy cập.</p></div><form className="filters" onSubmit={event=>{event.preventDefault();setPage(0);setFilter(search);}}><input aria-label="Tên bảng trong nhật ký" placeholder="Lọc tên bảng…" value={search} onChange={event=>setSearch(event.target.value)}/><button className="button">Tìm kiếm</button></form></div>{query.isPending?<LoadingState label="Đang tải nhật ký…"/>:query.isError?<ToastNotice message={query.error.message} tone="error"/>:<div className="table-wrap"><table><thead><tr><th>Thời gian</th><th>Thao tác</th><th>Bảng dữ liệu</th><th>Mã bản ghi</th></tr></thead><tbody>{query.data.rows.map(row=><tr key={row.id}><td>{dateTime.format(new Date(row.at))}</td><td><span className="badge badge-gray">{row.action}</span></td><td>{row.table_name}</td><td>{row.record_id??'—'}</td></tr>)}</tbody></table>{!query.data.rows.length&&<p className="empty">Chưa có sự kiện phù hợp trong phạm vi quyền truy cập.</p>}</div>}<div className="toolbar"><button className="button" disabled={!page||query.isFetching} onClick={()=>setPage(page-1)}>Trang trước</button><span>Trang {page+1}</span><button className="button" disabled={!query.data||(page+1)*25>=query.data.total||query.isFetching} onClick={()=>setPage(page+1)}>Trang sau</button></div></div></section>;
}

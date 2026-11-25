'use client';
import {useState} from 'react';
import Link from 'next/link';
import Decimal from 'decimal.js';
import {useQuery} from '@tanstack/react-query';
import {LoadingState} from '@/components/feedback';
import {browserSupabase} from '@/lib/supabase/browser';
import {formatQuantity} from '@/lib/format';
import {orderDemandIssueText,type OrderMaterialDemandData} from '@/features/orders/order-summary';

type OrderDemand=Omit<OrderMaterialDemandData,'materials'>&{
 products:{product_id:string;quantity:string}[];
 materials:(OrderMaterialDemandData['materials'][number]&{
  material_id:string;
  sources?:{product_id?:string;product_code?:string;product_name?:string;quantity:string}[];
 })[];
};
const hasShortage=(quantity:string|null)=>quantity!==null&&new Decimal(quantity).gt(0);
const statusLabel={unknown:'Chưa rõ tồn',insufficient:'Không đủ',low:'Dưới mức tối thiểu sau dự kiến',ok:'Đủ'};

export function OrderRequirements({userId,date}:{userId:string;date:string}){
 const [search,setSearch]=useState('');
 const query=useQuery({
  queryKey:[userId,'order-material-demand',date],enabled:!!date,staleTime:0,refetchInterval:30_000,retry:1,
  queryFn:async({signal})=>{
   const {data,error}=await browserSupabase().rpc('order_material_demand',{p_date:date}).abortSignal(signal);
   if(error)throw new Error('Không thể tải nhu cầu theo đơn hàng. Tài khoản cần quyền xem đơn hàng, nhu cầu nguyên liệu và tồn kho.');
   return data as OrderDemand;
  }
 });
 const data=query.data,filter=search.trim().toLocaleLowerCase('vi-VN');
 const materials=data?.materials.filter(material=>(material.code+' '+material.name).toLocaleLowerCase('vi-VN').includes(filter))??[];
 return <section className="pm-order-needs" aria-label="Nhu cầu theo đơn hàng">
  <h2>Nguyên liệu theo đơn đã duyệt</h2>
  <p className="pm-note">Tính theo ngày giao của đơn đã duyệt, đã lên kế hoạch và đã giao hoàn tất. Đơn chờ duyệt cần được duyệt trước. Đây là tổng nhu cầu lý thuyết theo đơn, được xem riêng với kế hoạch sản xuất. Việc xem nhu cầu không ghi sản xuất hoặc xuất kho.</p>
  {!date&&<p className="empty">Chọn ngày giao để xem nhu cầu nguyên liệu.</p>}
  {query.isFetching&&<LoadingState compact label="Đang tải nguyên liệu theo đơn hàng…"/>}
  {query.isError&&<div className="pm-note" role="alert"><p>{query.error.message}{data?' Số liệu đang hiển thị là lần tải thành công trước.':''}</p><button className="button" disabled={query.isFetching} onClick={()=>void query.refetch()}>Tải lại nhu cầu theo đơn</button></div>}
  {data&&<>
   <div className="pm-summary">
    <span><b>{data.products.length}</b> mã món trong đơn đã duyệt</span>
    <span><b>{data.materials.length}</b> mã / đơn vị nguyên liệu tính được</span>
    <span><b>{data.materials.filter(material=>hasShortage(material.shortage_quantity)).length}</b> mã nguyên liệu thiếu so với tồn</span>
    <span><b>{data.issues.length}</b> mục cần kiểm tra</span>
   </div>
   {!!data.issues.length&&<div className="pm-note"><b>Chưa tính đủ nhu cầu — cần kiểm tra các mục sau:</b>{data.issues.map((issue,index)=><p key={index}>{orderDemandIssueText(issue,[])}</p>)}</div>}
   <div className="toolbar"><input aria-label="Tìm nguyên liệu theo đơn" placeholder="Tìm tên hoặc mã nguyên liệu…" value={search} onChange={event=>setSearch(event.target.value)}/><Link className="button" href={'/app/orders?date='+date}>Xem đơn hàng</Link></div>
   <p className="muted">Tồn theo sổ cộng từ toàn bộ kho, quy đổi cùng đơn vị với nhu cầu. Chưa có dữ liệu tồn sẽ hiển thị “Chưa rõ”; mức tồn tối thiểu chưa cài sẽ để “Chưa cài”.</p>
   <div className="table-wrap"><table className="pm-needs-table" aria-label="Nguyên liệu theo đơn đã duyệt"><thead><tr><th>Mã / nguyên liệu</th><th>Lượng theo đơn</th><th>Tồn toàn bộ kho</th><th>Thiếu so với tồn</th><th>Tồn tối thiểu</th><th>Tình trạng</th></tr></thead><tbody>{materials.map(material=><tr key={material.material_id+material.unit_code}>
    <td><b>{material.name}</b><small>{material.code} · {material.unit_code}</small>{!!material.sources?.length&&<details><summary>Nguồn món trong đơn</summary>{material.sources.map((source,index)=><p key={index}>{source.product_name??source.product_code??'Món trong đơn'}{source.product_name&&source.product_code?' ('+source.product_code+')':''}: {formatQuantity(source.quantity)} {material.unit_code}</p>)}</details>}</td>
    <td><b>{formatQuantity(material.quantity)}</b> {material.unit_code}</td>
    <td>{material.stock_quantity===null?'Chưa rõ':formatQuantity(material.stock_quantity)+' '+material.unit_code}</td>
    <td className={hasShortage(material.shortage_quantity)?'pm-warning':undefined}>{material.shortage_quantity===null?'Chưa rõ':formatQuantity(material.shortage_quantity)+' '+material.unit_code}</td>
    <td>{material.minimum_quantity===null?'Chưa cài':formatQuantity(material.minimum_quantity)+' '+material.unit_code}</td>
    <td>{statusLabel[material.status]}</td>
   </tr>)}</tbody></table>
   {!materials.length&&<p className="empty">{data.materials.length?'Không tìm thấy nguyên liệu khớp từ khóa.':data.products.length?'Chưa có nguyên liệu tính được từ các đơn này. Kiểm tra công thức và quy đổi được cảnh báo ở trên.':'Chưa có đơn đã duyệt cho ngày giao này. Mở Đơn hàng để kiểm tra ngày giao và duyệt đơn đang chờ.'}</p>}
   </div>
  </>}
 </section>;
}

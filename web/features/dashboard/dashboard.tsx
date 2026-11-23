'use client';
import {ToastNotice} from '@/components/feedback';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {useState} from 'react';
import Decimal from 'decimal.js';
import {Icon} from '@/components/icons';
import {browserSupabase} from '@/lib/supabase/browser';
import {formatNumber,formatVndCurrency} from '@/lib/format';

type Snapshot={
 date:string;net_revenue_vnd:string|null;revenue_yesterday_vnd:string|null;received_vnd:string|null;
 produced:string|null;production_hours:string|null;cash_balance_vnd:string|null;food_cost_vnd:string|null;
 production_labor_estimate_vnd:string|null;office_expense_vnd:string|null;fixed_expense_vnd:string|null;
 marketing_expense_vnd:string|null;recovery_expense_vnd:string|null;other_expense_vnd:string|null;depreciation_vnd:string|null;revenue_target_daily_vnd:string|null;
 cost_total_vnd:string|null;revenue_after_costs_vnd:string|null;costs_complete:boolean;
 targets:Record<string,string>;inventory_low_count:number|null;inventory_unknown_count:number|null;updated_at:string;completeness:string;
};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
const money=(value:string|null|undefined)=>value==null?null:`${formatVndCurrency(value)} đ`;
const percent=(amount:string|null|undefined,base:string|null|undefined)=>{
 if(amount==null||base==null||Number(base)<=0)return null;
 return Number(amount)/Number(base)*100;
};
const showPercent=(value:number|null)=>value==null?'—':`${formatNumber(value,1)}%`;
const targetPercent=(targets:Record<string,string>|undefined,key:string)=>targets?.[key]==null?null:Number(targets[key]);
export function Dashboard({userId}:{userId:string}) {
 const [date,setDate]=useState(today);
 const query=useQuery({queryKey:[userId,'dashboard',date],enabled:!!date,queryFn:async({signal})=>{
  const {data,error}=await browserSupabase().rpc('dashboard_summary',{p_date:date}).abortSignal(signal);
  if(error)throw new Error('Không thể tải tổng quan. Kiểm tra quyền truy cập hoặc trạng thái database.');
  return data as Snapshot;
 }});
 const shift=(days:number)=>{const value=new Date(`${date}T00:00:00Z`);if(!Number.isNaN(value.getTime())){value.setUTCDate(value.getUTCDate()+days);setDate(value.toISOString().slice(0,10));}};
 const data=query.data;
 const foodRatio=percent(data?.food_cost_vnd,data?.net_revenue_vnd);
 const laborRatio=percent(data?.production_labor_estimate_vnd,data?.net_revenue_vnd);
 const revenueTarget=data?.revenue_target_daily_vnd;
 const revenueDelta=data?.net_revenue_vnd!=null&&data.revenue_yesterday_vnd!=null?new Decimal(data.net_revenue_vnd).minus(data.revenue_yesterday_vnd).toString():null;
 const revenueProgress=percent(data?.net_revenue_vnd,revenueTarget);
 const afterCostRevenue=data?.revenue_after_costs_vnd??null;
 const metrics=[
  {label:'Doanh thu sau tất cả chi phí',value:money(afterCostRevenue),note:`Doanh thu bán hàng sau giảm trừ ${money(data?.net_revenue_vnd)??'chưa đủ dữ liệu'} trừ chi phí đã ghi nhận ${money(data?.cost_total_vnd)??'chưa đủ dữ liệu'}.`,href:'/app/reports'},
  {label:'Số dư tiền mặt + ngân hàng',value:money(data?.cash_balance_vnd),note:'Sổ quỹ đến hết ngày xem; cần số dư đầu kỳ đã xác nhận',href:'/app/cash'},
  {label:'Food cost / doanh thu',value:showPercent(foodRatio),note:`Mục tiêu tối đa: ${targetPercent(data?.targets,'foodCost')==null?'Chưa cài':showPercent(targetPercent(data?.targets,'foodCost'))}`,href:'/app/recipes'},
  {label:'Nhân sự SX / doanh thu',value:showPercent(laborRatio),note:`Ước tính từ ca SX và mức lương đã lưu · trần ${targetPercent(data?.targets,'productionLabor')==null?'chưa cài':showPercent(targetPercent(data?.targets,'productionLabor'))}`,href:'/app/attendance'},
  {label:'Dư địa thưởng nhân sự SX',value:null,note:'Chưa đủ kế hoạch sản lượng và phê duyệt để tính; không tự tạo khoản thưởng.',href:'/app/production'},
  {label:'Doanh thu bán hàng sau giảm trừ',value:money(data?.net_revenue_vnd),note:`Mục tiêu doanh thu bán hàng: ${money(revenueTarget)??'Chưa cài'} · Hôm trước: ${money(data?.revenue_yesterday_vnd)??'chưa có dữ liệu'}${revenueDelta==null?'':` · ${new Decimal(revenueDelta).gte(0)?'+':''}${formatVndCurrency(revenueDelta)} đ`}`,href:'/app/sales'},
 ];
 const ratios=[
  {label:'Food cost',value:foodRatio,target:targetPercent(data?.targets,'foodCost'),note:'Chi phí nguyên liệu theo phiếu xuất sản xuất đã ghi nhận.'},
  {label:'Nhân sự sản xuất',value:laborRatio,target:targetPercent(data?.targets,'productionLabor'),note:'Ước tính theo ca SX đã chốt và mức lương tại thời điểm chấm công.'},
  {label:'Quản lý & văn phòng',value:percent(data?.office_expense_vnd,data?.net_revenue_vnd),target:targetPercent(data?.targets,'managementLabor'),note:'Chi phí văn phòng đã ghi nhận trong ngày.'},
  {label:'Chi phí cố định',value:percent(data?.fixed_expense_vnd,data?.net_revenue_vnd),target:targetPercent(data?.targets,'fixedRate'),note:'Chi phí cố định đã ghi nhận trong ngày.'},
  {label:'Khấu hao',value:percent(data?.depreciation_vnd,data?.net_revenue_vnd),target:targetPercent(data?.targets,'depreciationRate'),note:'Bút toán khấu hao đã ghi nhận trong kỳ.'},
  {label:'Marketing',value:percent(data?.marketing_expense_vnd,data?.net_revenue_vnd),target:targetPercent(data?.targets,'marketingRate'),note:'Chi phí Marketing đã ghi nhận trong ngày.'},
 ];
 const indicators=[
  {label:'Doanh thu bán hàng sau giảm trừ',actual:money(data?.net_revenue_vnd),target:money(revenueTarget),state:data?.net_revenue_vnd==null?'Chưa đủ dữ liệu':revenueProgress==null?'Chưa có mục tiêu':revenueProgress>=100?'Đạt kế hoạch':'Đang theo dõi'},
  {label:'Food cost / doanh thu',actual:showPercent(foodRatio),target:targetPercent(data?.targets,'foodCost')==null?'Chưa đặt':`≤ ${showPercent(targetPercent(data?.targets,'foodCost'))}`,state:foodRatio==null?'Chưa đủ dữ liệu':targetPercent(data?.targets,'foodCost')==null?'Chưa đặt ngưỡng':foodRatio<=Number(data?.targets?.foodCost)?'Trong ngưỡng':'Vượt ngưỡng'},
  {label:'Nhân sự SX / doanh thu',actual:showPercent(laborRatio),target:targetPercent(data?.targets,'productionLabor')==null?'Chưa đặt':`≤ ${showPercent(targetPercent(data?.targets,'productionLabor'))}`,state:laborRatio==null?'Chưa đủ dữ liệu':targetPercent(data?.targets,'productionLabor')==null?'Chưa đặt ngưỡng':laborRatio<=Number(data?.targets?.productionLabor)?'Trong ngưỡng':'Vượt ngưỡng'},
  {label:'Số dư tiền mặt + ngân hàng',actual:money(data?.cash_balance_vnd),target:money(data?.targets?.minCash),state:data?.cash_balance_vnd==null?'Chưa đủ dữ liệu':data.targets?.minCash==null?'Chưa đặt ngưỡng':Number(data.cash_balance_vnd)>=Number(data.targets.minCash)?'Đạt ngưỡng':'Dưới ngưỡng'},
  {label:'Vật tư dưới tồn tối thiểu',actual:data?.inventory_low_count==null?'Chưa đủ dữ liệu':String(data.inventory_low_count),target:'0 mặt hàng',state:data?.inventory_low_count==null?'Chưa đủ dữ liệu':data.inventory_low_count===0?'Đã đối chiếu':'Cần bổ sung'},
 ];
 const alerts=[
  ...(data?.net_revenue_vnd==null?[{title:'Chưa có doanh thu đã chốt trong ngày xem',detail:'Ghi nhận hoặc kiểm tra phiếu doanh thu của ngày này.',href:'/app/sales'}]:[]),
  ...(data?.cash_balance_vnd==null?[{title:'Chưa xác nhận đủ số dư tiền',detail:'Kiểm tra số dư đầu kỳ và các tài khoản quỹ/ngân hàng.',href:'/app/cash'}]:[]),
  ...(data?.inventory_unknown_count!=null&&data.inventory_unknown_count>0?[{title:`${data.inventory_unknown_count} dòng tồn kho chưa có số kiểm kê`,detail:'Chưa xác định được số hiện tại; hệ thống không tự coi là 0.',href:'/app/inventory'}]:[]),
  ...(data?.inventory_low_count!=null&&data.inventory_low_count>0?[{title:`${data.inventory_low_count} mặt hàng dưới mức tồn tối thiểu`,detail:'Mở kho để xem mặt hàng và kho liên quan.',href:'/app/inventory'}]:[]),
  ...(foodRatio==null?[{title:'Chưa đủ dữ liệu để tính Food cost',detail:'Cần phiếu sản xuất có giá vốn vật tư đã xác nhận và doanh thu cùng ngày.',href:'/app/recipes'}]:[]),
 ];
 return <section className="v16-shell">
  <div className="v16-hero"><div><div className="v16-eyebrow">CHIFAA COMBINE / BÁO CÁO ĐIỀU HÀNH</div><h2>Tổng quan điều hành</h2><p>Dữ liệu thực tế từ chứng từ đã ghi nhận · Thiếu nguồn sẽ hiện chưa đủ dữ liệu</p></div><Link className="v16-btn" href="/app/entry"><Icon name="plus" size={15}/> Nhập liệu</Link></div>
  <div className="v16-filter"><label>Ngày xem <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><div className="v16-filtergroup"><button className="v16-btn" onClick={()=>shift(-1)}>‹ Ngày trước</button><button className="v16-btn" onClick={()=>setDate(today())}>Hôm nay</button><button className="v16-btn" onClick={()=>shift(1)}>Ngày sau ›</button><button className="v16-btn" disabled={query.isFetching||!date} onClick={()=>void query.refetch()}>{query.isFetching?'Đang tải…':'Làm mới dữ liệu'}</button></div><span>Ngày xem: <b>{date.split('-').reverse().join('/')}</b></span></div>
  {query.isError?<ToastNotice message={query.error.message} tone="error"/>:<div className="v16-banner"><b>DỮ LIỆU TRỰC TIẾP TỪ CÁC PHÂN HỆ</b><br/>{query.isFetching?'Đang đối chiếu chứng từ…':data?.completeness??'Chưa xác nhận dữ liệu'} · Cập nhật {data?.updated_at?new Date(data.updated_at).toLocaleTimeString('vi-VN'):'—'}</div>}
  <div className="v16-section"><div><h3>Các chỉ số điều hành trọng yếu</h3><p>Chỉ tính từ dữ liệu đã ghi nhận; số dư và tỷ lệ không có đủ nguồn sẽ để trống.</p></div><Link className="v16-btn" href="/app/targets"><Icon name="settings" size={15}/> Cài ngưỡng</Link></div>
  <div className="v16-kpis">{metrics.map(metric=><article className={'v16-kpi'+(metric.value==null?' unknown':'')} key={metric.label}><small>{metric.label}</small><strong>{query.isPending?<span className="skeleton-value"/>:metric.value??'Chưa đủ dữ liệu'}</strong><p>{metric.note}</p><Link href={metric.href}>Xem chi tiết →</Link></article>)}</div>
  <div className="v16-section"><div><h3>Cơ cấu chi phí &amp; ngưỡng kiểm soát</h3><p>Tỷ lệ dùng doanh thu thuần đã chốt cùng ngày; ngưỡng lấy từ Kế hoạch &amp; mục tiêu.</p></div></div>
  <div className="v16-ratio-grid">{ratios.map(item=>{const exceeded=item.value!=null&&item.target!=null&&item.value>item.target;return <article className={'v16-ratio'+(item.value==null?' unknown':exceeded?' bad':' good')} key={item.label}><div className="v16-ratio-top"><h4>{item.label}</h4><span className={'v16-flag'+(item.value==null?' unknown':exceeded?' bad':' good')}>{item.value==null?'Thiếu dữ liệu':item.target==null?'Chưa đặt ngưỡng':exceeded?'Vượt ngưỡng':'Đang trong ngưỡng'}</span></div><div className="v16-ratio-value"><strong>{showPercent(item.value)}</strong><small>{item.target==null?'Chưa đặt trần':`Trần ${showPercent(item.target)}`}</small></div><div className="v16-progress"><span style={{width:`${item.value==null?'0':Math.min(item.value,100)}%`}}/></div><p>{item.note}</p></article>;})}</div>
  <div className="v16-section"><div><h3>Sản xuất &amp; dòng tiền trong ngày</h3><p>Thu nợ cũ không được cộng vào doanh thu bán hàng trong ngày xem.</p></div></div>
  <div className="stats">{[
   ['Tiền thực nhận',money(data?.received_vnd)],['Sản lượng sản xuất',data?.produced==null?null:`${formatNumber(data.produced)} phần`],
   ['Giờ công sản xuất',data?.production_hours==null?null:`${formatNumber(data.production_hours)} giờ`],
   ['Chi phí nguyên liệu theo phiếu SX',money(data?.food_cost_vnd)],['Lương SX ước tính theo ca',money(data?.production_labor_estimate_vnd)],
  ].map(([label,value])=><article className="stat" key={label}><div><small>{label}</small><strong>{query.isPending?<span className="skeleton-value"/>:value??'—'}</strong><span>{value==null?'Chưa đủ dữ liệu':'Nguồn chứng từ đã ghi nhận'}</span></div></article>)}</div>
  <div className="v16-lower"><section className="v16-panel"><div className="v16-panel-title"><div><h3>Bảng theo dõi chỉ tiêu</h3><small>Theo dữ liệu đã lưu trong ngày xem</small></div></div><div className="v16-indicators">{indicators.map(item=><div className="v16-indicator" key={item.label}><div><b>{item.label}</b><small>Mục tiêu: {item.target??'—'}</small></div><div><b>{item.actual??'—'}</b><span className="v16-flag">{item.state}</span></div></div>)}</div></section>
   <section className="v16-panel"><div className="v16-panel-title"><div><h3>Ưu tiên xử lý &amp; cảnh báo vận hành</h3><small>{alerts.length} mục cần xem</small></div></div>{alerts.length===0?<div className="v16-note">Chưa có cảnh báo từ dữ liệu ngày đang xem.</div>:<div className="v16-alerts">{alerts.map((alert,index)=><div className="v16-alert" key={`${alert.title}-${index}`}><div><b>{alert.title}</b><p>{alert.detail}</p></div><Link className="v16-btn" href={alert.href}>Xem</Link></div>)}</div>}</section></div>
  <div className="v16-note">Doanh thu, tiền thực nhận, số dư và chi phí là các chỉ tiêu riêng. Food cost và tỷ lệ lương chỉ hiện khi có đủ nguồn; không dùng dữ liệu Excel cũ hoặc thay số còn thiếu bằng 0.</div>
 </section>;
}

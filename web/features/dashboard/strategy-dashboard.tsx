'use client';

import Link from 'next/link';
import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import Decimal from 'decimal.js';
import {browserSupabase} from '@/lib/supabase/browser';
import {formatVndCurrency} from '@/lib/format';
import {ToastNotice} from '@/components/feedback';

type Day={date:string;net_revenue_vnd:string|null;revenue_yesterday_vnd:string|null;received_vnd:string|null;produced:string|null;production_hours:string|null;cash_balance_vnd:string|null;food_cost_vnd:string|null;production_labor_estimate_vnd:string|null;office_expense_vnd:string|null;fixed_expense_vnd:string|null;marketing_expense_vnd:string|null;recovery_expense_vnd:string|null;other_expense_vnd:string|null;depreciation_vnd:string|null;revenue_target_daily_vnd:string|null;targets:Record<string,string>;inventory_low_count:number|null;inventory_unknown_count:number|null;completeness:string};
type Range={start:string;end:string;days:Day[];production_unit_consistent:boolean;production_unit:string|null;updated_at:string};
type Mode='day'|'week'|'month'|'quarter'|'year';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
const dayShift=(date:string,amount:number)=>{const d=new Date(`${date}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10);};
const money=(value:string|null|undefined)=>value==null?'Chưa đủ dữ liệu':`${formatVndCurrency(value)} đ`;
const add=(values:(string|null|undefined)[])=>{const present=values.filter((value):value is string=>value!=null);return present.length?present.reduce((total,value)=>new Decimal(total).plus(value).toString(),'0'):null;};
function period(date:string,mode:Mode){const d=new Date(`${date}T00:00:00Z`);let start=date,end=date;if(mode==='week'){const offset=(d.getUTCDay()+6)%7;start=dayShift(date,-offset);end=dayShift(start,6);}if(mode==='month'){start=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)).toISOString().slice(0,10);end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10);}if(mode==='quarter'){const month=Math.floor(d.getUTCMonth()/3)*3;start=new Date(Date.UTC(d.getUTCFullYear(),month,1)).toISOString().slice(0,10);end=new Date(Date.UTC(d.getUTCFullYear(),month+3,0)).toISOString().slice(0,10);}if(mode==='year'){start=`${d.getUTCFullYear()}-01-01`;end=`${d.getUTCFullYear()}-12-31`;}return {start,end};}
async function load(start:string,end:string,signal:AbortSignal){const {data,error}=await browserSupabase().rpc('dashboard_period_summary',{p_start:start,p_end:end}).abortSignal(signal);if(error)throw new Error('Không tải được dữ liệu chiến lược. Kiểm tra quyền Dashboard và migration báo cáo theo kỳ.');return data as Range;}
const pct=(numerator:string|null,denominator:string|null)=>numerator!=null&&denominator!=null&&new Decimal(denominator).gt(0)?new Decimal(numerator).div(denominator).mul(100).toNumber():null;
const dateLabel=(date:string)=>date.split('-').reverse().join('/');

export function StrategyDashboard({userId}:{userId:string}){
 const [date,setDate]=useState(today),[mode,setMode]=useState<Mode>('month');
 const selected=useMemo(()=>period(date,mode),[date,mode]);
 const daysCount=Math.round((Date.parse(`${selected.end}T00:00:00Z`)-Date.parse(`${selected.start}T00:00:00Z`))/86400000)+1;
 const prior={start:dayShift(selected.start,-daysCount),end:dayShift(selected.end,-daysCount)};
 const query=useQuery({queryKey:[userId,'strategy-live',selected.start,selected.end],queryFn:async({signal})=>Promise.all([load(selected.start,selected.end,signal),load(prior.start,prior.end,signal)]),enabled:!!date,staleTime:30_000});
 const current=query.data?.[0],previous=query.data?.[1],days=current?.days??[],oldDays=previous?.days??[];
 const revenue=add(days.map(day=>day.net_revenue_vnd)),received=add(days.map(day=>day.received_vnd)),target=add(days.map(day=>day.revenue_target_daily_vnd));
 const food=add(days.map(day=>day.food_cost_vnd)),labor=add(days.map(day=>day.production_labor_estimate_vnd));
 const revenueDays=days.filter(day=>day.net_revenue_vnd!=null).length;
 const avgRevenue=revenue!=null&&revenueDays?new Decimal(revenue).div(revenueDays).toString():null;
 const previousRevenue=add(oldDays.map(day=>day.net_revenue_vnd));
 const delta=revenue!=null&&previousRevenue!=null?new Decimal(revenue).minus(previousRevenue).toString():null;
 const foodRate=pct(food,revenue),laborRate=pct(labor,revenue);
 const max=days.reduce((largest,day)=>day.net_revenue_vnd?Decimal.max(largest,day.net_revenue_vnd).toNumber():largest,0);
 const modeName:Record<Mode,string>={day:'Ngày',week:'Tuần',month:'Tháng',quarter:'Quý',year:'Năm'};
 const startText=selected.start===selected.end?dateLabel(selected.start):`${dateLabel(selected.start)} – ${dateLabel(selected.end)}`;
 const stat=[
  {label:'Doanh thu thuần',value:money(revenue),note:`${revenueDays}/${days.length} ngày có phiếu bán đã chốt`,tone:'orange'},
  {label:'Tiền thực thu',value:money(received),note:'Phiếu thu đã ghi nhận trong kỳ',tone:'blue'},
  {label:'Doanh thu bình quân/ngày có phiếu',value:money(avgRevenue),note:'Không chia cho ngày chưa có chứng từ',tone:'green'},
  {label:'So với kỳ liền trước',value:delta==null?'Chưa đủ dữ liệu':`${new Decimal(delta).gte(0)?'+':''}${money(delta)}`,note:previousRevenue==null?'Kỳ trước chưa có phiếu doanh thu':`Kỳ trước: ${money(previousRevenue)}`,tone:'purple'},
 ];
 return <section className="strategy-live">
  <header className="strategy-live-hero"><div><span>CHIFAA COMBINE / PHÂN TÍCH ĐIỀU HÀNH</span><h1>Chiến lược kinh doanh</h1><p>Phân tích theo chứng từ đã chốt, dữ liệu thực từ PostgreSQL.</p></div><Link href="/app/targets">Kế hoạch &amp; mục tiêu ↗</Link></header>
  <section className="strategy-live-filters" aria-label="Bộ lọc báo cáo"><div><small>Kỳ báo cáo</small><div className="strategy-live-modes">{(Object.keys(modeName) as Mode[]).map(item=><button key={item} type="button" className={mode===item?'active':''} onClick={()=>setMode(item)}>{modeName[item]}</button>)}</div></div><label>Ngày tham chiếu<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><button className="strategy-live-today" type="button" onClick={()=>setDate(today())}>Hôm nay</button><span>Đang xem: <b>{startText}</b></span></section>
  {query.isError?<ToastNotice message={query.error.message} tone="error"/>:<div className="strategy-live-source"><b>DỮ LIỆU CHỨNG TỪ ĐÃ CHỐT</b><span>{query.isPending?'Đang tải dữ liệu…':`${revenueDays}/${days.length} ngày có doanh thu · Cập nhật ${current?.updated_at?new Date(current.updated_at).toLocaleTimeString('vi-VN'):'—'}`}</span></div>}
  <div className="strategy-live-period"><span>Kỳ đang xem</span><b>{startText}</b><span>{query.isFetching?'Đang cập nhật…':current?.production_unit_consistent===false?'Chưa xác định được đơn vị sản lượng chung':'Đối chiếu theo dữ liệu từng phân hệ đã ghi nhận'}</span></div>
  <div className="strategy-live-stats">{stat.map(item=><article className={`strategy-live-stat ${item.tone}`} key={item.label}><small>{item.label}</small><strong>{query.isPending?'Đang tải…':item.value}</strong><span>{item.note}</span></article>)}</div>
  <div className="strategy-live-grid"><section className="strategy-live-panel"><header><div><h2>Doanh thu thuần theo ngày</h2><p>Chỉ ngày có chứng từ mới được tính; ngày trống giữ trạng thái chưa có dữ liệu.</p></div><Link href="/app/sales">Mở Doanh thu →</Link></header><div className="strategy-live-chart" role="img" aria-label={`Doanh thu theo ngày trong kỳ ${startText}`}>
   {days.map(day=><div className="strategy-live-bar" key={day.date}><div className="strategy-live-bar-area"><span className={day.net_revenue_vnd==null?'empty':''} style={{height:day.net_revenue_vnd&&max?`${Math.max(3,new Decimal(day.net_revenue_vnd).div(max).mul(100).toNumber())}%`:undefined}} title={`${dateLabel(day.date)}: ${money(day.net_revenue_vnd)}`}/></div><small>{mode==='year'?day.date.slice(5,7):day.date.slice(8,10)}</small></div>)}
   </div><div className="strategy-live-chart-foot"><span>Doanh thu thuần kỳ này <b>{money(revenue)}</b></span><span>Kế hoạch kỳ <b>{money(target)}</b></span></div></section>
  <section className="strategy-live-panel"><header><div><h2>Chi phí có nguồn trong kỳ</h2><p>Hiển thị khoản đã ghi nhận; không suy ra lãi ròng khi thiếu nhóm chi phí.</p></div></header><div className="strategy-live-costs"><div><span>Nguyên liệu theo phiếu xuất SX</span><b>{money(food)}</b><em>{foodRate==null?'Chưa đủ dữ liệu doanh thu hoặc giá vốn':`${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(foodRate)}% doanh thu thuần`}</em></div><div><span>Lương sản xuất ước tính</span><b>{money(labor)}</b><em>{laborRate==null?'Chưa đủ dữ liệu doanh thu hoặc chấm công':`${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(laborRate)}% doanh thu thuần`}</em></div><div className="strategy-live-unknown"><span>Lãi trước thuế</span><b>Chưa đủ dữ liệu</b><em>Chưa có đủ giá vốn bán hàng và mọi nhóm chi phí để tính chính xác.</em></div><div className="strategy-live-unknown"><span>Tỷ lệ hủy tại điểm bán</span><b>Chưa đủ dữ liệu</b><em>Nguồn báo cáo hiện tại chưa có số lượng hủy đã xác nhận.</em></div></div></section></div>
  <section className="strategy-live-panel strategy-live-table"><header><div><h2>Đối chiếu theo ngày</h2><p>Kỳ {modeName[mode].toLocaleLowerCase('vi-VN')} · {startText}</p></div></header><div className="strategy-live-scroll"><table><thead><tr><th>Ngày</th><th>Doanh thu thuần</th><th>Tiền thực thu</th><th>Sản lượng</th><th>Giờ SX</th><th>Trạng thái</th></tr></thead><tbody>{days.map(day=><tr key={day.date}><td>{dateLabel(day.date)}</td><td>{money(day.net_revenue_vnd)}</td><td>{money(day.received_vnd)}</td><td>{current?.production_unit_consistent===false?'Chưa xác định đơn vị':day.produced==null?'Chưa đủ dữ liệu':`${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(Number(day.produced))}${current?.production_unit?` ${current.production_unit}`:''}`}</td><td>{day.production_hours==null?'Chưa đủ dữ liệu':`${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(Number(day.production_hours))} giờ`}</td><td>{day.net_revenue_vnd==null?'Chưa có phiếu doanh thu':'Đã ghi nhận'}</td></tr>)}</tbody></table></div></section>
  <footer className="strategy-live-note">Nguồn: phiếu bán hàng, phiếu thu, phiếu sản xuất, xuất kho, chấm công, chi phí và mục tiêu đã lưu. Doanh thu thuần và tiền thực thu là hai chỉ tiêu riêng. Các khoản thiếu nguồn được để “Chưa đủ dữ liệu”, không mặc định bằng 0.</footer>
 </section>;
}

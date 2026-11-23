'use client';

import Link from 'next/link';
import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import Decimal from 'decimal.js';
import {browserSupabase} from '@/lib/supabase/browser';
import {formatNumber,formatVndCurrency} from '@/lib/format';
import {ToastNotice} from '@/components/feedback';

type Day={date:string;net_revenue_vnd:string|null;revenue_yesterday_vnd:string|null;revenue_after_costs_vnd:string|null;cost_total_vnd:string|null;staff_cost_estimate_vnd:string|null;interest_paid_vnd:string|null;costs_complete:boolean;received_vnd:string|null;produced:string|null;production_hours:string|null;cash_balance_vnd:string|null;food_cost_vnd:string|null;production_labor_estimate_vnd:string|null;office_expense_vnd:string|null;fixed_expense_vnd:string|null;marketing_expense_vnd:string|null;recovery_expense_vnd:string|null;other_expense_vnd:string|null;depreciation_vnd:string|null;revenue_target_daily_vnd:string|null;targets:Record<string,string>;inventory_low_count:number|null;inventory_unknown_count:number|null;completeness:string};
type Range={start:string;end:string;days:Day[];production_unit_consistent:boolean;production_unit:string|null;updated_at:string;sales_revenue_vnd:string|null;costs_complete:boolean;cost_total_vnd:string|null;revenue_after_costs_vnd:string|null;costs:Record<string,string|null>};
type Breakdown={available:boolean;updated_at?:string;stores:{store_id:string;name:string|null;revenue_vnd:string|null;complete:boolean;document_count:number}[];products:{product_id:string;code:string|null;name:string|null;revenue_vnd:string|null;complete:boolean;sold_quantity:string;returned_quantity:string;line_count:number}[]};
type Mode='day'|'week'|'month'|'quarter'|'year';
type Point={label:string;value:string|null};

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
const dayShift=(date:string,amount:number)=>{const d=new Date(`${date}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10);};
const money=(value:string|null|undefined)=>value==null?'Chưa đủ dữ liệu':`${formatVndCurrency(value)} đ`;
const number=(value:string|null|undefined,digits=2)=>value==null?'Chưa đủ dữ liệu':formatNumber(value,digits);
const add=(values:(string|null|undefined)[])=>{const present=values.filter((value):value is string=>value!=null);return present.length?present.reduce((total,value)=>new Decimal(total).plus(value).toString(),'0'):null;};
const pct=(numerator:string|null,denominator:string|null)=>numerator!=null&&denominator!=null&&new Decimal(denominator).gt(0)?new Decimal(numerator).div(denominator).mul(100).toNumber():null;
const dateLabel=(date:string)=>date.split('-').reverse().join('/');
const monthLabel=(date:string)=>date.slice(5,7)+'/'+date.slice(2,4);
function period(date:string,mode:Mode){const d=new Date(`${date}T00:00:00Z`);let start=date,end=date;if(mode==='week'){const offset=(d.getUTCDay()+6)%7;start=dayShift(date,-offset);end=dayShift(start,6);}if(mode==='month'){start=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)).toISOString().slice(0,10);end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10);}if(mode==='quarter'){const month=Math.floor(d.getUTCMonth()/3)*3;start=new Date(Date.UTC(d.getUTCFullYear(),month,1)).toISOString().slice(0,10);end=new Date(Date.UTC(d.getUTCFullYear(),month+3,0)).toISOString().slice(0,10);}if(mode==='year'){start=`${d.getUTCFullYear()}-01-01`;end=`${d.getUTCFullYear()}-12-31`;}return {start,end};}
function monthWindow(date:string,offset:number){const d=new Date(`${date}T00:00:00Z`);const start=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+offset,1)).toISOString().slice(0,10);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+offset+1,0)).toISOString().slice(0,10);return {start,end:offset===0&&date<last?date:last};}
async function load(start:string,end:string,signal:AbortSignal):Promise<Range>{const {data,error}=await browserSupabase().rpc('dashboard_period_summary',{p_start:start,p_end:end}).abortSignal(signal);if(error)throw new Error('Không tải được dữ liệu chiến lược. Kiểm tra quyền Dashboard và migration báo cáo theo kỳ.');return data as Range;}
async function loadBreakdown(start:string,end:string,signal:AbortSignal):Promise<Breakdown>{const {data,error}=await browserSupabase().rpc('strategy_sales_breakdown',{p_start:start,p_end:end}).abortSignal(signal);if(error)throw new Error('Không tải được chi tiết điểm bán/món. Kiểm tra migration phân tích chiến lược và quyền Doanh thu.');return data as Breakdown;}

function Panel({title,subtitle,children,wide=false}:{title:string;subtitle:string;children:React.ReactNode;wide?:boolean}){return <section className={`strategy-chart-panel${wide?' wide':''}`}><header><div><h2>{title}</h2><p>{subtitle}</p></div><span className="strategy-info" title={subtitle} aria-label={subtitle}>ⓘ</span></header>{children}</section>;}
function EmptyChart({children}:{children:string}){return <div className="strategy-chart-empty"><b>Chưa đủ dữ liệu</b><span>{children}</span></div>;}
function LineChart({points}:{points:Point[]}){
 const valid=points.map((p,i)=>({i,value:p.value==null?null:Number(p.value)})).filter((p):p is {i:number;value:number}=>p.value!=null&&Number.isFinite(p.value));
 if(!valid.length)return <EmptyChart>Chưa có phiếu doanh thu thuần đã chốt trong các tháng được chọn.</EmptyChart>;
 const max=Math.max(...valid.map(p=>p.value),1),min=0,w=700,h=210,left=58,right=12,top=12,bottom=30,innerW=w-left-right,innerH=h-top-bottom;
 const coords=valid.map(p=>({x:left+(points.length<=1?innerW/2:p.i*innerW/(points.length-1)),y:top+innerH-(p.value-min)/(max-min||1)*innerH}));
 const path=coords.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
 return <div className="strategy-svg-scroll"><svg className="strategy-line-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Doanh thu thuần theo tháng">
  {[0,1,2,3].map(tick=>{const y=top+innerH*tick/3;return <g key={tick}><line x1={left} x2={w-right} y1={y} y2={y} className="strategy-gridline"/><text x={left-8} y={y+4} textAnchor="end" className="strategy-axis-label">{formatVndCurrency(String(max*(1-tick/3)))}</text></g>;})}
  <path d={path} className="strategy-line-path"/>{coords.map((p,i)=><g key={`${points[valid[i].i].label}-${i}`}><circle cx={p.x} cy={p.y} r="4" className="strategy-line-dot"><title>{points[valid[i].i].label}: {money(points[valid[i].i].value)}</title></circle></g>)}
  {points.map((p,i)=><text key={p.label} x={left+(points.length<=1?innerW/2:i*innerW/(points.length-1))} y={h-8} textAnchor="middle" className="strategy-axis-label">{p.label}</text>)}
 </svg></div>;
}
function RankedBars({items,format}:{items:{key:string;label:string;value:string|null;note?:string}[];format:(value:string|null)=>string}){
 const usable=items.filter(item=>item.value!=null);if(!usable.length)return <EmptyChart>Chưa có chứng từ đủ dữ liệu cho xếp hạng này.</EmptyChart>;
 const max=Math.max(...usable.map(item=>Number(item.value)),1);
 return <><div className="strategy-rank-list">{usable.slice(0,8).map((item,index)=><div className="strategy-rank-row" key={item.key}><span className="strategy-rank-name" title={item.label}>{item.label}</span><div className="strategy-rank-track"><span className={index?'secondary':''} style={{width:`${Number(item.value)===0?0:Math.max(3,Number(item.value)/max*100)}%`}}/></div><b>{format(item.value)}</b></div>)}</div>{items.some(item=>item.value==null)&&<div className="strategy-chart-callout">Một số dòng chưa đủ dữ liệu doanh thu nên không đưa vào xếp hạng.</div>}</>;
}

export function StrategyDashboard({userId}:{userId:string}){
 const [date,setDate]=useState(today),[mode,setMode]=useState<Mode>('month');
 const [scenario,setScenario]=useState({price:'',servings:'',days:'30',cancel:'0'});
 const selected=useMemo(()=>period(date,mode),[date,mode]);
 const dayCount=Math.round((Date.parse(`${selected.end}T00:00:00Z`)-Date.parse(`${selected.start}T00:00:00Z`))/86400000)+1;
 const prior={start:dayShift(selected.start,-dayCount),end:dayShift(selected.end,-dayCount)};
 const query=useQuery({queryKey:[userId,'strategy-live-v2',selected.start,selected.end],queryFn:async({signal})=>{
  const monthly=Array.from({length:12},(_,i)=>monthWindow(date,i-11));
  const [current,previous,breakdown,...history]=await Promise.all([load(selected.start,selected.end,signal),load(prior.start,prior.end,signal),loadBreakdown(selected.start,selected.end,signal),...monthly.map(range=>load(range.start,range.end,signal))]);
  return {current,previous,breakdown,history};
 },enabled:!!date,staleTime:30_000});
 const current=query.data?.current,previous=query.data?.previous,breakdown=query.data?.breakdown,days=current?.days??[];
 const revenue=current?.sales_revenue_vnd??null,afterCosts=current?.revenue_after_costs_vnd??null,received=add(days.map(day=>day.received_vnd)),target=add(days.map(day=>day.revenue_target_daily_vnd));
 const food=current?.costs?.food_vnd??null,labor=current?.costs?.production_labor_vnd??null;
 const revenueDays=days.filter(day=>day.net_revenue_vnd!=null).length;
 const previousRevenue=previous?.revenue_after_costs_vnd??null;
 const delta=revenue!=null&&previousRevenue!=null?new Decimal(revenue).minus(previousRevenue).toString():null;
 const foodRate=pct(food,revenue),laborRate=pct(labor,revenue);
 const monthPoints=(query.data?.history??[]).map((range,i)=>({label:monthLabel(monthWindow(date,i-11).start),value:range.revenue_after_costs_vnd}));
 const storeItems=(breakdown?.stores??[]).map(item=>({key:item.store_id,label:item.name??'Điểm bán (ẩn tên theo quyền)',value:item.complete?item.revenue_vnd:null,note:`${item.document_count} phiếu`}));
 const productItems=(breakdown?.products??[]).map(item=>({key:item.product_id,label:item.name??item.code??'Món (ẩn tên theo quyền)',value:item.complete?item.revenue_vnd:null,note:`Đã bán ${number(item.sold_quantity)}; trả riêng ${number(item.returned_quantity)}`}));
 const costs=current?.costs??{};
 const costRows=[{label:'Nguyên liệu theo phiếu xuất SX',value:costs.food_vnd,color:'#ed762c'},{label:'Lương các bộ phận (ước tính)',value:costs.staff_vnd,color:'#22937d'},{label:'Lãi vay đã trả',value:costs.interest_paid_vnd,color:'#aa7552'},
  {label:'Quản lý & văn phòng',value:costs.office_vnd,color:'#5683c2'},{label:'Chi phí cố định',value:costs.fixed_vnd,color:'#a58bd4'},
  {label:'Marketing',value:costs.marketing_vnd,color:'#e6ad4e'},{label:'Hỗ trợ thu hồi',value:costs.recovery_vnd,color:'#c98948'},{label:'Khấu hao',value:costs.depreciation_vnd,color:'#db6865'},
  {label:'Chi phí khác',value:costs.other_vnd,color:'#86a9bb'}].filter(row=>row.value!=null&&new Decimal(row.value).gt(0));
 const knownCostTotal=current?.costs_complete?current.cost_total_vnd:null;
 const conic=costRows.length&&knownCostTotal?(()=>{let cursor=0;return `conic-gradient(${costRows.map(row=>{const start=cursor;cursor+=Number(row.value)/Number(knownCostTotal)*100;return `${row.color} ${start}% ${cursor}%`;}).join(',')})`;})():undefined;
 const historyExpenses=(query.data?.history??[]).map(range=>range.costs_complete?range.cost_total_vnd:null);
 const costHistoryMax=Math.max(0,...historyExpenses.map(v=>Number(v??0)));
 const historyRevenue=(query.data?.history??[]).map(range=>range.revenue_after_costs_vnd);
 const modeName:Record<Mode,string>={day:'Ngày',week:'Tuần',month:'Tháng',quarter:'Quý',year:'Năm'};
 const rangeText=selected.start===selected.end?dateLabel(selected.start):`${dateLabel(selected.start)} – ${dateLabel(selected.end)}`;
 const scenarioRevenue=(()=>{if(!scenario.price||!scenario.servings||!scenario.days)return null;try{const cancellation=Decimal.max(0,Decimal.min(100,new Decimal(scenario.cancel||'0')));return new Decimal(scenario.price).mul(scenario.servings).mul(scenario.days).mul(new Decimal(100).minus(cancellation)).div(100).toFixed(0,Decimal.ROUND_HALF_UP);}catch{return null;}})();
 const monthTotal=monthPoints.reduce((n,p)=>n+(p.value==null?0:1),0);
 const stat=[
  {label:'Doanh thu bán hàng sau giảm trừ',value:money(revenue),note:`${revenueDays}/${days.length} ngày có phiếu bán · thực thu ${money(received)}`,tone:'orange'},
  {label:'Doanh thu sau tất cả chi phí',value:money(afterCosts),note:current?.costs_complete?`Đã trừ chi phí đã ghi nhận ${money(current.cost_total_vnd)}`:'Chưa đủ nguồn chi phí đã ghi nhận',tone:'green'},
  {label:'Số phần bán/ngày',value:'Chưa đủ dữ liệu',note:'Sản phẩm dùng đơn vị khác nhau; chưa thể cộng thành phần/ngày',tone:'blue'},
  {label:'Tỷ lệ hủy tại điểm bán',value:'Chưa đủ dữ liệu',note:'Chưa có phiếu hủy và mẫu số đã xác nhận',tone:'purple'},
 ];
 return <section className="strategy-live">
  <header className="strategy-live-hero"><div><span>CHIFAA COMBINE / PHÂN TÍCH ĐIỀU HÀNH</span><h1>Chiến lược kinh doanh</h1><p>Biểu đồ theo chứng từ đã chốt; dữ liệu thực từ PostgreSQL.</p></div><Link href="/app/targets">Kế hoạch &amp; mục tiêu ↗</Link></header>
  <section className="strategy-live-filters" aria-label="Bộ lọc báo cáo"><div><small>Kỳ báo cáo</small><div className="strategy-live-modes">{(Object.keys(modeName) as Mode[]).map(item=><button key={item} type="button" className={mode===item?'active':''} onClick={()=>setMode(item)}>{modeName[item]}</button>)}</div></div><label>Ngày tham chiếu<input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><button className="strategy-live-today" type="button" onClick={()=>setDate(today())}>Hôm nay</button><span>Đang xem: <b>{rangeText}</b></span></section>
  {query.isError?<ToastNotice message={query.error.message} tone="error"/>:<div className="strategy-live-source"><b>DỮ LIỆU CHỨNG TỪ ĐÃ CHỐT</b><span>{query.isPending?'Đang tải dữ liệu…':`${revenueDays}/${days.length} ngày có doanh thu · Cập nhật ${current?.updated_at?new Date(current.updated_at).toLocaleTimeString('vi-VN'):'—'}`}</span></div>}
  <div className="strategy-live-period"><span>{modeName[mode]} {date.slice(0,7)}</span><span>Doanh thu sau chi phí so với kỳ trước: {delta==null?'Chưa đủ dữ liệu':`${new Decimal(delta).gte(0)?'+':''}${money(delta)}`}</span><span>Kế hoạch doanh thu/ngày: <b>{money(target==null?null:new Decimal(target).div(Math.max(1,days.length)).toString())}</b></span></div>
  <div className="strategy-live-stats">{stat.map(item=><article className={`strategy-live-stat ${item.tone}`} key={item.label}><small>{item.label}</small><strong>{query.isPending?'Đang tải…':item.value}</strong><span>{item.note}</span></article>)}</div>
  <aside className="strategy-priority"><b>✦ &nbsp;Ưu tiên điều hành kỳ này</b><ul><li>{delta==null?'Chưa đủ dữ liệu để so sánh doanh thu với kỳ trước.':`Doanh thu ${new Decimal(delta).lt(0)?'giảm':'tăng'} ${money(new Decimal(delta).abs().toString())} so với kỳ liền trước.`}</li><li>{foodRate==null?'Chưa đủ dữ liệu tính tỷ lệ nguyên liệu trên doanh thu.':`Nguyên liệu theo phiếu xuất SX: ${number(String(foodRate),2)}% doanh thu thuần (tham khảo).`}{laborRate==null?'':` Lương SX ước tính ${number(String(laborRate),2)}%.`}</li><li>Không kết luận lãi, hòa vốn hoặc tỷ lệ hủy khi thiếu dữ liệu nguồn/mẫu số.</li></ul></aside>
  <div className="strategy-chart-grid">
   <Panel title="Doanh thu sau tất cả chi phí có đang tăng?" subtitle="12 tháng · Doanh thu bán hàng sau giảm trừ trừ tổng chi phí đã ghi nhận; thiếu nhóm chi phí thì để trống"><LineChart points={monthPoints}/><div className="strategy-chart-foot"><span>Doanh thu bán hàng sau giảm trừ</span><b>{money(revenue)}</b><span>Doanh thu sau tất cả chi phí: {money(afterCosts)} · {monthTotal}/12 tháng đủ dữ liệu</span></div></Panel>
   <Panel title="Bán đủ để có lãi chưa?" subtitle="So sánh sản lượng với điểm hòa vốn"><div className="strategy-break-even"><div><small>Sản lượng bán bình quân/ngày</small><b>Chưa đủ dữ liệu</b></div><div><small>Điểm hòa vốn tính/ngày</small><b>Chưa đủ dữ liệu</b></div></div><div className="strategy-empty-bars"><span/><span/></div><div className="strategy-chart-callout">Cần giá vốn đầy đủ, chi phí theo kỳ và đơn vị bán tương thích để tính hòa vốn.</div></Panel>
   <Panel title="Điểm nào góp doanh thu nhiều?" subtitle="Doanh thu thuần theo điểm bán · Không phải lợi nhuận"><RankedBars items={storeItems} format={money}/></Panel>
   <Panel title="Điểm nào hủy nhiều?" subtitle="Tỷ lệ hủy điểm bán theo chứng từ đã xác nhận"><EmptyChart>Chưa có nguồn phiếu hủy riêng và mẫu số được xác nhận. Hàng trả được theo dõi tách biệt, không tính là hủy.</EmptyChart></Panel>
   <Panel title="Món nào đem lại doanh thu cao?" subtitle="Doanh thu thuần theo món · Chưa phải lãi góp"><RankedBars items={productItems} format={money}/></Panel>
   <Panel title="Cơ cấu tất cả chi phí đã ghi nhận" subtitle="Nguyên liệu, lương ba bộ phận ước tính, chi phí, hỗ trợ thu hồi, lãi vay đã trả và khấu hao"><div className="strategy-donut-wrap">{conic?<div className="strategy-donut" style={{background:conic}}><div><b>{money(knownCostTotal)}</b><span>tổng chi phí</span></div></div>:<div className="strategy-donut-empty">Chưa đủ dữ liệu chi phí</div>}<div className="strategy-donut-legend">{costRows.map(row=><div key={row.label}><span><i style={{background:row.color}}/>{row.label}</span><b>{knownCostTotal&&row.value?`${number(String(Number(row.value)/Number(knownCostTotal)*100),1)}%`:'—'}</b></div>)}</div></div><div className="strategy-chart-callout">Doanh thu sau tất cả chi phí: {money(afterCosts)}. Nếu thiếu nguồn chi phí, tổng không hiển thị.</div></Panel>
   <Panel title="Đối chiếu doanh thu và tổng chi phí 12 tháng" subtitle="Doanh thu sau tất cả chi phí và tổng chi phí đã ghi nhận" wide><div className="strategy-month-bars">{(query.data?.history??[]).map((range,i)=>{const rev=historyRevenue[i],cost=historyExpenses[i],scale=Math.max(costHistoryMax,...historyRevenue.map(v=>Number(v??0)),1),revHeight=rev==null||Number(rev)===0?0:Math.max(3,Number(rev)/scale*100),costHeight=cost==null||Number(cost)===0?0:Math.max(3,Number(cost)/scale*100);return <div className="strategy-month-col" key={range.start} title={`${monthLabel(range.start)} · sau chi phí ${money(rev)} · tổng chi phí ${money(cost)}`}><div className="strategy-month-col-bars"><span className={rev==null?'missing':''} style={{height:rev==null?'8px':`${revHeight}%`}}/><span className={`cost${cost==null?' missing':''}`} style={{height:cost==null?'8px':`${costHeight}%`}}/></div><small>{monthLabel(range.start)}</small></div>;})}</div><div className="strategy-chart-foot"><span><i className="legend-revenue"/> Doanh thu sau tất cả chi phí</span><span><i className="legend-cost"/> Tổng chi phí đã ghi nhận</span><span>Gạch xám = thiếu dữ liệu.</span></div></Panel>
   <Panel title="Thử nhanh: Nếu mình đổi…" subtitle="Mô phỏng doanh thu theo giả định bạn nhập"><div className="strategy-scenario"><div className="strategy-scenario-head">Công thức: giá × phần/ngày × ngày × (1 − tỷ lệ hủy giả định). Không đổi dữ liệu đã lưu.<button type="button" onClick={()=>setScenario({price:'',servings:'',days:'30',cancel:'0'})}>↺ Mặc định</button></div><div className="strategy-scenario-inputs"><label>Giá bán/phần (đ)<input inputMode="numeric" value={scenario.price} onChange={e=>setScenario({...scenario,price:e.target.value.replace(/[^0-9]/g,'')})} placeholder="Nhập giá"/></label><label>Bán/ngày (phần)<input inputMode="decimal" value={scenario.servings} onChange={e=>setScenario({...scenario,servings:e.target.value.replace(/[^0-9.]/g,'')})} placeholder="Nhập sản lượng"/></label><label>Tỷ lệ hủy giả định (%)<input inputMode="decimal" value={scenario.cancel} onChange={e=>setScenario({...scenario,cancel:e.target.value.replace(/[^0-9.]/g,'')})}/></label><label>Số ngày<input inputMode="numeric" value={scenario.days} onChange={e=>setScenario({...scenario,days:e.target.value.replace(/[^0-9]/g,'')})}/></label></div><div className="strategy-scenario-result"><small>Doanh thu giả định sau hủy</small><b>{scenarioRevenue==null?'Nhập đủ giả định':money(scenarioRevenue)}</b><span>Chưa trừ chiết khấu, hàng trả, giá vốn và chi phí; không phải lợi nhuận.</span></div></div></Panel>
  </div>
  <section className="strategy-live-panel strategy-live-table"><header><div><h2>Đối chiếu theo ngày</h2><p>Kỳ {modeName[mode].toLocaleLowerCase('vi-VN')} · {rangeText}</p></div></header><div className="strategy-live-scroll"><table><thead><tr><th>Ngày</th><th>Doanh thu bán sau giảm trừ</th><th>Tổng chi phí</th><th>Doanh thu sau chi phí</th><th>Tiền thực thu</th><th>Sản lượng SX</th><th>Giờ SX</th></tr></thead><tbody>{days.map(day=><tr key={day.date}><td>{dateLabel(day.date)}</td><td>{money(day.net_revenue_vnd)}</td><td>{money(day.cost_total_vnd)}</td><td>{money(day.revenue_after_costs_vnd)}</td><td>{money(day.received_vnd)}</td><td>{current?.production_unit_consistent===false?'Chưa xác định đơn vị':day.produced==null?'Chưa đủ dữ liệu':`${number(day.produced)}${current?.production_unit?` ${current.production_unit}`:''}`}</td><td>{day.production_hours==null?'Chưa đủ dữ liệu':`${number(day.production_hours)} giờ`}</td></tr>)}</tbody></table></div></section>
  <footer className="strategy-live-note">Nguồn: phiếu bán hàng, phiếu thu, phiếu xuất kho, chấm công, chi phí và mục tiêu đã lưu. Doanh thu thuần và tiền thực thu là hai chỉ tiêu riêng. Hàng trả không bị gộp thành hàng hủy; các khoản thiếu nguồn được để “Chưa đủ dữ liệu”.</footer>
 </section>;
}

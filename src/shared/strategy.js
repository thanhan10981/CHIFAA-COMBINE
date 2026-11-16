import {effective,validDate,salesMetrics,costRecipe,report} from './domain.js';

const strategyIso=d=>d.toISOString().slice(0,10);
function strategyRange(period,anchor){
  if(!validDate(anchor)||!['day','week','month','quarter','year'].includes(period))throw new Error('Kỳ báo cáo không hợp lệ');
  const d=new Date(anchor+'T00:00:00Z'),y=d.getUTCFullYear(),m=d.getUTCMonth();let start=new Date(d),end=new Date(d);
  if(period==='week'){start.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);end=new Date(start);end.setUTCDate(start.getUTCDate()+6);}
  if(period==='month'){start=new Date(Date.UTC(y,m,1));end=new Date(Date.UTC(y,m+1,0));}
  if(period==='quarter'){start=new Date(Date.UTC(y,Math.floor(m/3)*3,1));end=new Date(Date.UTC(y,Math.floor(m/3)*3+3,0));}
  if(period==='year'){start=new Date(Date.UTC(y,0,1));end=new Date(Date.UTC(y+1,0,0));}
  return {start:strategyIso(start),end:strategyIso(end)};
}
function strategyShift(period,anchor,amount){
  const d=new Date(anchor+'T00:00:00Z');if(!validDate(anchor))throw new Error('Ngày không hợp lệ');
  if(period==='day'||period==='week')d.setUTCDate(d.getUTCDate()+amount*(period==='week'?7:1));
  else{const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+amount*({month:1,quarter:3,year:12}[period]));d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));}
  return strategyIso(d);
}
function strategyAggregate(data,from,to){
  const take=m=>effective(data[m]||[]).filter(r=>r.date>=from&&r.date<=to),sales=take('sales'),days=new Set(sales.map(r=>r.date)),prod=take('production'),attendance=take('attendance');
  const raw=report(data,from,to),sum=(rows,key)=>rows.reduce((n,r)=>n+(r[key]||0),0),stores=new Map(),dishes=new Map();
  const name=(m,id)=>effective(data[m]||[]).find(r=>r.recordId===id)?.name||id;
  for(const row of sales){
    const qty=row.sold+row.creditQty,recipes=effective(data.recipes||[]).filter(r=>r.dishId===row.dishId),parts=recipes.map(r=>costRecipe(r.recordId,qty,data,row.date));
    const dailyProduction=prod.filter(p=>p.date===row.date&&p.dishId===row.dishId),snapshotQty=dailyProduction.reduce((n,p)=>n+p.produced+p.extra,0),snapshotCost=dailyProduction.length&&dailyProduction.every(p=>p.costSnapshot&&Number.isFinite(p.costSnapshot.total))&&snapshotQty>0?dailyProduction.reduce((n,p)=>n+p.costSnapshot.total,0)/snapshotQty*qty:null;
    const cost=row.costAllocationPending?null:qty===0?0:snapshotCost??(recipes.length&&parts.every(p=>p.total!=null)?sum(parts,'total'):null);
    for(const [map,id,module]of [[stores,row.storeId,'stores'],[dishes,row.dishId,'dishes']]){
      if(!map.has(id))map.set(id,{id,name:name(module,id),sold:0,returned:0,delivered:0,revenue:0,cost:0,expenses:0});
      const a=map.get(id),m=salesMetrics(row);a.sold+=qty;a.returned+=row.returned;a.delivered+=row.delivered;a.revenue=a.revenue==null||m.netRevenue==null?null:a.revenue+m.netRevenue;a.expenses=a.expenses==null||!m.complete?null:a.expenses+m.recoveryExpense+m.otherExpense;a.cost=a.cost==null||cost==null?null:a.cost+cost;
    }
  }
  const rows=map=>[...map.values()].map(r=>({...r,gross:r.cost==null||r.revenue==null||r.expenses==null?null:r.revenue-r.cost-r.expenses,returnRate:r.delivered>0?r.returned/r.delivered*100:null}));
  const issues=[];
  if(!sales.length)issues.push('Chưa có phiếu doanh thu trong kỳ.');
  else if(raw.revenue==null)issues.push('Phiếu doanh thu thiếu hoặc có dữ liệu không hợp lệ.');
  if(raw.cogs==null)issues.push('Chưa đủ nguồn sản xuất/công thức/giá vốn; hàng ki-ốt cần căn cứ phân bổ giá vốn riêng.');
  if([...days].some(date=>!attendance.some(r=>r.date===date)))issues.push('Chưa có chấm công cho tất cả ngày có doanh thu.');
  if(sales.some(s=>!prod.some(p=>p.date===s.date&&p.dishId===s.dishId)))issues.push('Thiếu phiếu sản xuất cùng ngày/món với doanh thu.');
  if(!Object.hasOwn(data,'cash'))issues.push('Chưa được cấp nguồn sổ thu chi.');
  const wages=sum(raw.payroll,'base')+sum(raw.payroll,'allowances'),cash=take('cash').filter(r=>r.direction==='chi');
  const fixed=cash.filter(r=>['co-dinh','quan-ly'].includes(r.category)).reduce((n,r)=>n+r.amount,0),other=cash.filter(r=>['marketing','khac'].includes(r.category)).reduce((n,r)=>n+r.amount,0)+(raw.otherSalesExpense??0),recovery=raw.recoveryExpense;
  const interest=cash.filter(r=>r.category==='lai-vay').reduce((n,r)=>n+r.amount,0);
  const sold=sum(sales,'sold')+sum(sales,'creditQty'),delivered=sum(sales,'delivered'),returned=sum(sales,'returned');
  const profit=issues.length?null:raw.profit,variable=profit!=null&&sold>0?(raw.cogs+wages+other+recovery)/sold:null;
  return {from,to,days:days.size,revenue:raw.revenue,received:raw.received,foodCostPct:raw.foodCostPct,sxLaborPct:raw.sxLaborPct,policy:raw.policy,totalProduced:raw.totalProduced,goodProduced:raw.produced,productivity:raw.productivity,goodProductivity:raw.goodProductivity,productivityBasis:raw.productivityBasis,sold,returned,delivered,average:days.size?sold/days.size:null,returnRate:delivered?returned/delivered*100:null,profit,food:raw.cogs,wages,fixed,other,recovery,interest,variable,issues,stores:rows(stores),dishes:rows(dishes)};
}
function strategySeries(data,period,anchor,count){
  if(count==null)count=({day:14,week:12,month:12,quarter:8,year:5}[period]);const out=[];
  for(let i=count-1;i>=0;i--){const a=strategyShift(period,anchor,-i),range=strategyRange(period,a),end=range.end>anchor?anchor:range.end;out.push({...range,...strategyAggregate(data,range.start,end),label:period==='year'?range.start.slice(0,4):period==='month'?range.start.slice(0,7):range.start.slice(5)});}
  return out;
}
function strategyScenario(price,variable,fixed,quantity,waste){
  if(![price,variable,fixed,quantity,waste].every(Number.isFinite)||Math.min(price,variable,fixed,quantity,waste)<0||waste>=100)throw new Error('Nhập số không âm; tỷ lệ hủy phải nhỏ hơn 100%.');
  const margin=price-variable/(1-waste/100);return {margin,breakEven:margin>0?Math.ceil(fixed/margin):null,profit:(quantity*margin-fixed)*30};
}
export {strategyRange,strategyShift,strategyAggregate,strategySeries,strategyScenario};

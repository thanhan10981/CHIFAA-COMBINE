import { SCHEMA } from './schema.js';
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const fail = message => { throw new Error(message); };
const finite = n => typeof n === 'number' && Number.isFinite(n);
// Confirmed by owner 2026-11-16: D01/D02/D03. Cash receipts are never the ratio base.
const ACCOUNTING_POLICY=Object.freeze({version:'net-sales-2026-11-16',foodCostMax:0.322,productionLaborMax:0.15});
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function cleanRecord(module, input, data = {}) {
  const schema = SCHEMA[module];
  if (!schema || !input || typeof input !== 'object' || Array.isArray(input)) fail('Dữ liệu không hợp lệ');
  const out = {};
  for (const key of Object.keys(input)) if (!Object.hasOwn(schema.fields, key)) fail('Trường không được phép: ' + key);
  for (const [key, f] of Object.entries(schema.fields)) {
    const v = input[key];
    if (v === '' || v == null) { if (f.required) fail('Thiếu ' + f.label); out[key] = ''; continue; }
    if (f.type === 'number') {
      if (!finite(v) || (f.min != null && v < f.min) || (f.max != null && v > f.max)) fail('Giá trị sai: ' + f.label);
    } else if (f.type === 'boolean') { if (typeof v !== 'boolean') fail('Giá trị đúng/sai không hợp lệ'); }
    else if (f.type === 'lines') {
      if (!Array.isArray(v) || !v.length || v.length > 100) fail('Cần 1–100 thành phần');
      for (const l of v) {
        if (!l || Object.keys(l).sort().join(',') !== 'id,quantity,type' || !['material','recipe'].includes(l.type) || !finite(l.quantity) || l.quantity <= 0) fail('Thành phần không hợp lệ');
        if (!effective(data[l.type === 'recipe' ? 'recipes' : 'materials'] || []).some(r => r.recordId === l.id)) fail('Thành phần không tồn tại');
      }
    } else {
      if (typeof v !== 'string' || v.length > 2000 || /^[=+@\t\r]/.test(v)) fail('Văn bản không hợp lệ: ' + f.label);
      if (f.type === 'date' && !validDate(v)) fail('Ngày không hợp lệ');
      if (f.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) fail('Giờ phải có dạng HH:mm');
      if (f.type === 'select' && !f.options.includes(v)) fail('Lựa chọn không hợp lệ');
      if (f.ref && !effective(data[f.ref] || []).some(r => r.recordId === v)) fail('Mã tham chiếu không tồn tại: ' + f.label);
    }
    out[key] = v;
  }
  if (module === 'sales' && (out.sold + out.returned + out.creditQty > out.delivered)) fail('Bán + trả + điểm bán chịu vượt số giao');
  if (module === 'production' && out.rejected > out.produced + out.extra) fail('Lỗi / hủy vượt sản xuất');
  if (module === 'attendance') shiftHours(out.start, out.end, out.breakMinutes);
  if (module === 'assets' && out.salvage > out.cost) fail('Giá trị còn lại vượt nguyên giá');
  if (module === 'loans' && out.annualRate > 1) fail('Lãi suất phải trong 0–1');
  return out;
}
function effective(rows) {
  const reversed = new Set(rows.filter(r => !r.deleted && r.reverses).map(r => r.reverses));
  return rows.filter(r => !r.deleted && !r.reverses && !reversed.has(r.recordId));
}
// Validate source rows without changing them. Missing/partial reference tables are
// unknown, not proof of a broken reference (e.g. a sales-only accountant).
function sourceIssues(data, partial = {}) {
  const issues=[];
  const activeRefs=new Map(Object.entries(data).filter(([m])=>SCHEMA[m]).map(([m,rows])=>[m,new Set(effective(rows).map(r=>r.recordId))]));
  for(const [module,rows] of Object.entries(data)){
    if(!SCHEMA[module])continue;
    const counts=new Map();for(const row of rows)counts.set(row.recordId,(counts.get(row.recordId)||0)+1);
    for(const row of rows){
      if(row.deleted===true)continue;
      try{
        if(row._sourceError)fail(row._sourceError);
        if(typeof row.recordId!=='string'||!row.recordId||!Number.isInteger(row.version)||row.version<1)fail('Thiếu ID / phiên bản hợp lệ');
        if(counts.get(row.recordId)>1)fail('ID bị trùng trong Sheet');
        const refs={},input={};
        for(const [key,field]of Object.entries(SCHEMA[module].fields)){
          input[key]=row[key];
          if(field.ref){if(row[key]&&activeRefs.has(field.ref)&&!partial[field.ref]&&!activeRefs.get(field.ref).has(row[key]))fail('Mã tham chiếu không tồn tại: '+field.label);if(!refs[field.ref])refs[field.ref]=[];refs[field.ref].push({recordId:row[key]});}
        }
        if(module==='recipes')for(const ref of ['materials','recipes'])refs[ref]=(Array.isArray(row.lines)?row.lines:[]).filter(l=>l?.type===(ref==='recipes'?'recipe':'material')).map(l=>{if(activeRefs.has(ref)&&!partial[ref]&&!activeRefs.get(ref).has(l.id))fail('Thành phần không tồn tại');return {recordId:l.id};});
        cleanRecord(module,input,refs);
        if(module==='recipes'&&!partial.recipes)flattenRecipe(row.recordId,1,rows);
      }catch(error){issues.push({module,id:row.recordId||'',row:row._row||null,message:String(error.message)});}
    }
  }
  return issues;
}
function shiftHours(start, end, breakMinutes = 0) {
  const minute = s => {
    if (typeof s !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) fail('Giờ không hợp lệ');
    const [h,m] = s.split(':').map(Number); return h * 60 + m;
  };
  const a = minute(start), b = minute(end);
  if (a === b) fail('Ca bắt đầu và kết thúc trùng nhau');
  const span = b > a ? b - a : b + 1440 - a;
  if (!finite(breakMinutes) || breakMinutes < 0 || breakMinutes >= span) fail('Thời gian nghỉ không hợp lệ');
  return (span - breakMinutes) / 60;
}
function flattenRecipe(id, quantity, recipes, path = []) {
  if (!finite(quantity) || quantity < 0) fail('Sản lượng không hợp lệ');
  if (path.includes(id)) fail('Công thức có vòng lặp: ' + [...path, id].join(' → '));
  const recipe = effective(recipes).find(r => r.recordId === id);
  if (!recipe || !finite(recipe.yield) || recipe.yield <= 0) fail('Thiếu công thức hoặc sản lượng mẻ');
  const raw = {};
  for (const l of recipe.lines) {
    const amount = quantity * l.quantity / recipe.yield;
    const part = l.type === 'recipe' ? flattenRecipe(l.id, amount, recipes, [...path,id]) : { [l.id]: amount };
    for (const [key, value] of Object.entries(part)) raw[key] = (raw[key] || 0) + value;
  }
  return raw;
}
function costRecipe(id, quantity, data, asOf) {
  const raw = flattenRecipe(id, quantity, data.recipes || []), missing = [];
  let total = 0;
  for (const [id, amount] of Object.entries(raw)) {
    const material = effective(data.materials || []).find(r => r.recordId === id);
    const cutoff=asOf==='current'?new Date().toISOString().slice(0,10):asOf;
    const historical = effective(data.stock || []).filter(r => r.materialId === id && r.type === 'nhap' && r.date <= cutoff && finite(r.unitCost))
      .sort((a,b) => b.date.localeCompare(a.date) || String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
    // A current catalog price must not be presented as a historical price.
    const price = historical ? historical.unitCost : (asOf === 'current' && material && finite(material.purchasePrice) ? material.purchasePrice / material.conversion : null);
    if (!finite(price)) missing.push(id); else total += amount * price;
  }
  return { total: missing.length ? null : round(total), missing, raw, asOf, basis: 'last-receipt-price' };
}
function salesMetrics(row) {
  const complete=['sold','price','discount','returned','recoveryPrice','creditQty','otherCost','cash','bank','oldDebtPaid','delivered'].every(k=>finite(row[k])&&row[k]>=0)&&row.discount<=1&&row.sold+row.returned+row.creditQty<=row.delivered;
  if(!complete)return {saleRevenue:null,creditRevenue:null,recoverySupport:null,recoveryExpense:null,otherExpense:null,netRevenue:null,received:null,expectedCurrentCollection:null,collectionDifference:null,unsold:null,complete:false,accountingRule:ACCOUNTING_POLICY.version};
  const saleRevenue = row.sold * row.price * (1 - row.discount);
  const recoverySupport = row.returned * row.recoveryPrice;
  const creditRevenue = row.creditQty * row.price * (1 - row.discount);
  const netRevenue = saleRevenue + creditRevenue;
  const received = row.cash + row.bank;
  return { saleRevenue: round(saleRevenue), creditRevenue: round(creditRevenue), recoverySupport: round(recoverySupport), recoveryExpense:round(recoverySupport),otherExpense:round(row.otherCost),netRevenue: round(netRevenue), received: round(received), expectedCurrentCollection: round(netRevenue),
    collectionDifference: round(received - row.oldDebtPaid - netRevenue), unsold: row.delivered - row.sold - row.returned - row.creditQty,complete:true,
    accountingRule: ACCOUNTING_POLICY.version+'; sold + store-borne after discount; recovery/other expenses separate; old debt and cash excluded from net sales' };
}
function payroll(rows) {
  const grouped = {};
  for (const r of effective(rows)) {
    const hours = shiftHours(r.start, r.end, r.breakMinutes);
    const k = r.employeeId + ':' + r.department;
    const g = grouped[k] || (grouped[k] = { employeeId: r.employeeId, department: r.department, hours: 0, base: 0, allowances: 0, advance: 0, deduction: 0, net: 0 });
    g.hours += hours; g.base += hours * r.hourlyRate;
    g.allowances += r.defaultAllowance + r.dailyAllowance + r.support; g.advance += r.advance; g.deduction += r.deduction;
    g.net = round(g.base + g.allowances - g.advance - g.deduction);
  }
  return Object.values(grouped).map(g => ({ ...g, hours: round(g.hours), base: round(g.base) }));
}
function inventory(data, to) {
  const movements = effective(data.stock || []).filter(r => r.date <= to);
  return effective(data.materials || []).map(m => {
    const rows = movements.filter(r => r.materialId === m.recordId);
    const balance = rows.reduce((s,r) => s + (['nhap','dieu-chinh-tang'].includes(r.type) ? 1 : -1) * r.quantity, 0);
    return { materialId: m.recordId, name: m.name, unit: m.unit, balance: round(balance), minimum: m.minimum,
      replenish: round(Math.max(0,m.minimum - balance)), status: rows.length ? (balance < m.minimum ? 'orange' : 'green') : 'gray',
      completeness: rows.length ? 'Cần có phiếu tồn đầu nếu đã hoạt động trước hệ thống' : 'Chưa có phiếu kho' };
  });
}
function demand(data, from, to) {
  const need = {}, missing = [];
  const plans = effective(data.production || []).filter(r => r.date >= from && r.date <= to).map(r => ({dishId:r.dishId,quantity:r.planned}));
  const orders = effective(data.orders || []).filter(r => r.status === 'approved' && r.date >= from && r.date <= to).map(r => ({dishId:r.dishId,quantity:r.quantity}));
  // Orders are shown separately; never silently added to manually entered production plans.
  const expand = list => {
    const out = {};
    for (const p of list) {
      const recipes = effective(data.recipes || []).filter(r => r.dishId === p.dishId);
      if (!recipes.length) { missing.push(p.dishId); continue; }
      for (const r of recipes) for (const [id,q] of Object.entries(flattenRecipe(r.recordId,p.quantity,data.recipes))) out[id]=(out[id]||0)+q;
    }
    return out;
  };
  Object.assign(need,expand(plans));
  return { planned: need, approvedOrders: expand(orders), missing: [...new Set(missing)], note: 'Nhu cầu đơn đã duyệt tách riêng kế hoạch để tránh cộng trùng.' };
}
function report(data, from, to) {
  if (!validDate(from) || !validDate(to) || from > to) fail('Khoảng ngày không hợp lệ');
  const select = module => effective(data[module] || []).filter(r => r.date >= from && r.date <= to);
  const sales = select('sales'), prod = select('production'), attend = select('attendance');
  const money = sales.map(salesMetrics), wages = payroll(attend);
  const produced = prod.reduce((n,r)=>n+r.produced+r.extra-r.rejected,0);
  const totalProduced=prod.reduce((n,r)=>n+r.produced+r.extra,0),rejected=prod.reduce((n,r)=>n+r.rejected,0);
  const productionHoursComplete=prod.every(p=>attend.some(a=>a.date===p.date&&a.department==='SX'));
  const sxHours = wages.filter(r=>r.department==='SX').reduce((n,r)=>n+r.hours,0);
  const cash = { cash: 0, bank: 0 };
  // Sales receipts have one source. Cash book does not accept duplicate sales receipts.
  for (const r of effective(data.sales || []).filter(r=>r.date<=to)) { cash.cash+=r.cash;cash.bank+=r.bank; }
  for (const r of effective(data.cash || []).filter(r=>r.date<=to)) cash[r.account]+=(r.direction==='thu'?1:-1)*r.amount;
  const completeSales=sales.length>0&&money.every(m=>m.complete);
  const revenue = completeSales ? round(money.reduce((n,r)=>n+r.netRevenue,0)) : null;
  const received = completeSales ? round(money.reduce((n,r)=>n+r.received,0)) : null;
  const recoveryExpense=completeSales?round(money.reduce((n,r)=>n+r.recoveryExpense,0)):null,otherSalesExpense=completeSales?round(money.reduce((n,r)=>n+r.otherExpense,0)):null;
  const costs = prod.map(p=>{
    if(p.costSnapshot&&finite(p.costSnapshot.total))return p.costSnapshot.total;
    const recipes = effective(data.recipes || []).filter(r=>r.dishId===p.dishId);
    if (!recipes.length) return null;
    const parts=recipes.map(r=>costRecipe(r.recordId,p.produced+p.extra,data,p.date));
    return parts.some(c=>c.total==null)?null:parts.reduce((n,c)=>n+c.total,0);
  });
  const cogs = costs.length && costs.every(c=>c!=null) ? round(costs.reduce((a,b)=>a+b,0)) : null;
  const operating = select('cash').filter(r=>r.direction==='chi' && ['co-dinh','quan-ly','marketing','khac','lai-vay'].includes(r.category)).reduce((n,r)=>n+r.amount,0)+(recoveryExpense??0)+(otherSalesExpense??0);
  const wagesPresent=sales.every(s=>attend.some(a=>a.date===s.date));
  const profit = revenue==null || cogs==null || !wagesPresent ? null : round(revenue-cogs-wages.reduce((n,r)=>n+r.base+r.allowances,0)-operating);
  const days = Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
  const covered = new Set(sales.map(r=>r.date)).size;
  const sxWagesPresent=sales.length>0&&sales.every(s=>attend.some(a=>a.date===s.date&&a.department==='SX'));
  const sxLabor=sxWagesPresent?round(wages.filter(r=>r.department==='SX').reduce((n,r)=>n+r.base+r.allowances,0)):null;
  const foodCostPct=revenue>0&&cogs!=null?round(cogs/revenue*100):null,sxLaborPct=revenue>0&&sxLabor!=null&&wagesPresent?round(sxLabor/revenue*100):null;
  return { from,to,revenue,received,recoveryExpense,otherSalesExpense,operating,sxLabor,foodCostPct,sxLaborPct,policy:ACCOUNTING_POLICY,produced:prod.length?produced:null,cogs,profit,profitBasis:'Provisional; recovery support is a separate expense once; excludes depreciation; interest uses posted interest cash vouchers. Confirm remaining accounting rules before live.',
    totalProduced:prod.length?totalProduced:null,rejected:prod.length?rejected:null,
    sxHours:attend.some(a=>a.department==='SX')?sxHours:null, productivity:prod.length&&productionHoursComplete&&sxHours>0?round(totalProduced/sxHours):null,
    goodProductivity:prod.length&&productionHoursComplete&&sxHours>0?round(produced/sxHours):null,productivityBasis:'total-produced-per-SX-hour',
    payroll:wages, cash: {cash:round(cash.cash),bank:round(cash.bank)}, coverage:covered+'/'+days,
    completeness: completeSales && covered===days && costs.length && costs.every(c=>c!=null) && wagesPresent ? 'complete-inputs' : 'incomplete',
    source:'Google Sheets / dữ liệu người dùng được cấp quyền', accountingRule:money[0]?.accountingRule || 'Chưa có dữ liệu doanh thu' };
}
function scenario(price, variableCost, fixedCost, quantity) {
  if (![price,variableCost,fixedCost,quantity].every(finite) || Math.min(price,variableCost,fixedCost,quantity)<0) fail('Kịch bản không hợp lệ');
  const margin=price-variableCost;
  return { margin:round(margin), breakEven:margin>0?Math.ceil(fixedCost/margin):null, profit:round(quantity*margin-fixedCost) };
}
function variance(data, from, to) {
  return effective(data.counts || []).filter(c=>c.date>=from && c.date<=to).map(c=>{
    const receipts=effective(data.stock||[]).filter(s=>s.materialId===c.materialId && s.date===c.date && ['nhap','dieu-chinh-tang'].includes(s.type)).reduce((n,r)=>n+r.quantity,0);
    let theoretical=0, complete=true;
    for(const p of effective(data.production||[]).filter(p=>p.date===c.date)){
      const recipes=effective(data.recipes||[]).filter(r=>r.dishId===p.dishId);
      if(!recipes.length) complete=false;
      for(const r of recipes) theoretical+=flattenRecipe(r.recordId,p.produced+p.extra,data.recipes)[c.materialId]||0;
    }
    const actual=c.opening+receipts-c.otherOut-c.closing;
    return {date:c.date,materialId:c.materialId,actual:round(actual),theoretical:complete?round(theoretical):null,difference:complete?round(actual-theoretical):null,percentage:complete&&theoretical>0?round((actual-theoretical)/theoretical*100):null,status:!complete?'gray':actual<0?'red':Math.abs(actual-theoretical)>0.01?'orange':'green'};
  });
}
function finance(data, to) {
  const cash=effective(data.cash||[]).filter(r=>r.date<=to);
  const debts=effective(data.debts||[]).filter(r=>r.date<=to).map(r=>{
    const paid=cash.filter(c=>c.linkedId===r.recordId&&c.category===(r.type==='phai-thu'?'thu-no':'tra-no')).reduce((n,c)=>n+c.amount,0)+(r.allocations||[]).filter(a=>a.date<=to).reduce((n,a)=>n+a.amount,0);
    return {id:r.recordId,name:r.name,type:r.type,amount:r.amount,paid:round(paid),remaining:round(r.amount-paid),overdue:r.dueDate<to&&r.amount>paid};
  });
  const loans=effective(data.loans||[]).filter(r=>r.date<=to).map(r=>{
    const paid=cash.filter(c=>c.linkedId===r.recordId&&c.category==='tra-vay').reduce((n,c)=>n+c.amount,0);
    return {id:r.recordId,name:r.name,principal:r.principal,paid:round(paid),remaining:round(r.principal-paid),overdue:r.dueDate<to&&r.principal>paid};
  });
  const depreciation=effective(data.assets||[]).filter(r=>r.date<=to).map(r=>{
    const start=new Date(r.date),end=new Date(to),elapsed=(end.getUTCFullYear()-start.getUTCFullYear())*12+end.getUTCMonth()-start.getUTCMonth()+1;
    const monthly=(r.cost-r.salvage)/r.months,accumulated=monthly*Math.min(r.months,Math.max(0,elapsed));
    return {id:r.recordId,name:r.name,monthly:round(monthly),accumulated:round(accumulated),bookValue:round(r.cost-accumulated),rule:'Straight-line, full acquisition month; provisional'};
  });return {debts,loans,depreciation};
}
function targets(data,from,to){
  const actual=report(data,from,to),plans=effective(data.plans||[]).filter(r=>r.date>=from&&r.date<=to);
  const sum=k=>plans.length?plans.reduce((n,r)=>n+r[k],0):null;
  const revenueTarget=sum('revenue'),productionTarget=sum('production'),bonusCap=sum('bonusCap');
  const laborCap=actual.revenue>0?round(ACCOUNTING_POLICY.productionLaborMax*actual.revenue):null;
  const ready=actual.completeness==='complete-inputs'&&actual.sxLabor!=null&&productionTarget>0&&actual.produced>=productionTarget&&laborCap!=null&&finite(bonusCap);
  const available=ready?Math.max(0,laborCap-actual.sxLabor):null;
  const ratio=(value,target)=>value==null||target==null||target===0?null:round(value/target*100);
  return {revenueTarget,productionTarget,fixedCostTarget:sum('fixedCost'),revenuePercent:ratio(actual.revenue,revenueTarget),productionPercent:ratio(actual.produced,productionTarget),foodCostPct:actual.foodCostPct,sxLaborPct:actual.sxLaborPct,laborCap,foodCostMaxPct:ACCOUNTING_POLICY.foodCostMax*100,sxLaborMaxPct:ACCOUNTING_POLICY.productionLaborMax*100,policy:ACCOUNTING_POLICY,bonusAvailable:available==null?null:round(Math.min(bonusCap,available)),bonusRule:'Dư địa tham khảo = min(trần thưởng, 15% doanh thu thuần − lương và phụ cấp SX); không trừ food cost. Chỉ hiển thị khi đủ dữ liệu và sản lượng đạt kế hoạch; chưa tự chi thưởng.'};
}
function compareWeeks(data,anchor){
  if(!validDate(anchor))fail('Ngày không hợp lệ');
  const day=new Date(anchor+'T00:00:00Z');day.setUTCDate(day.getUTCDate()-((day.getUTCDay()+6)%7));
  const iso=d=>d.toISOString().slice(0,10),rows=[];
  for(let i=0;i<7;i++){
    const current=new Date(day);current.setUTCDate(day.getUTCDate()+i);const previous=new Date(current);previous.setUTCDate(current.getUTCDate()-7);
    const a=report(data,iso(current),iso(current)),b=report(data,iso(previous),iso(previous));
    rows.push({date:iso(current),previousDate:iso(previous),revenue:a.revenue,previousRevenue:b.revenue,difference:a.revenue==null||b.revenue==null?null:round(a.revenue-b.revenue)});
  }return rows;
}
export { ACCOUNTING_POLICY, round, cleanRecord, sourceIssues, effective, validDate, shiftHours, flattenRecipe, costRecipe, salesMetrics, payroll, inventory, demand, report, scenario, variance, finance, targets, compareWeeks };

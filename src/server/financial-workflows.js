function attachDebtAllocations_(rows){
  const markers=effective(workflowRows_()).filter(w=>w.kind==='debt');
  return rows.map(row=>({...row,allocations:markers.flatMap(w=>{const d=workflowDetails_(w);return d.saleId?(d.allocations||[]).filter(a=>a.id===row.recordId).map(a=>({date:w.date,amount:a.amount})):[];})}));
}
function attachLoanPeriods_(rows){const markers=effective(workflowRows_()).filter(w=>w.kind==='interest');return rows.map(row=>({...row,interestPeriods:markers.filter(w=>w.referenceId===row.recordId).map(w=>{const p=workflowDetails_(w);return {from:p.from,to:p.to,basis:p.basis,interest:p.interest};})}));}
function validatePayment_(row,data){
  const category=row.category;
  if(['thu-no','tra-no'].includes(category)){
    const d=effective(data.debts).find(d=>d.recordId===row.linkedId);if(!d)return;
    cleanRecord('debts',Object.fromEntries(Object.keys(SCHEMA.debts.fields).map(k=>[k,d[k]])),data);
    if(effective(data.cash).some(c=>c.linkedId===d.recordId&&(!finite(c.amount)||c.amount<0||!validDate(c.date))))throw new Error('VALIDATION: Phiếu thanh toán nguồn không hợp lệ');
    const paid=effective(data.cash).filter(c=>c.category===category&&c.linkedId===d.recordId).reduce((n,c)=>n+c.amount,0)+(d.allocations||[]).reduce((n,c)=>n+c.amount,0);
    if(row.amount>d.amount-paid+.001)throw new Error('BALANCE: Thu/trả vượt dư công nợ');
    if(row.date<d.date)throw new Error('VALIDATION: Ngày thanh toán trước ngày công nợ');
  }
  if(['tra-vay','vay'].includes(category)){
    const loan=effective(data.loans).find(l=>l.recordId===row.linkedId);if(!loan)return;
    cleanRecord('loans',Object.fromEntries(Object.keys(SCHEMA.loans.fields).map(k=>[k,loan[k]])),data);
    if(effective(data.cash).some(c=>c.linkedId===loan.recordId&&(!finite(c.amount)||c.amount<0||!validDate(c.date))))throw new Error('VALIDATION: Phiếu trả gốc nguồn không hợp lệ');
    const paid=effective(data.cash).filter(c=>c.category===category&&c.linkedId===loan.recordId).reduce((n,c)=>n+c.amount,0);
    if(row.amount>loan.principal-paid+.001)throw new Error('BALANCE: Số tiền vượt gốc còn lại');
    if(row.date<loan.date)throw new Error('VALIDATION: Ngày thanh toán trước ngày vay');
    if(category==='tra-vay'&&effective(workflowRows_()).some(w=>w.kind==='interest'&&w.referenceId===loan.recordId&&workflowDetails_(w).to>row.date))throw new Error('CLOSED: Đã chi lãi sau ngày trả gốc này. Hoàn tác kỳ lãi trước khi nhập hồi tố.');
  }
  if(['lai-vay','luong-thuong'].includes(category))throw new Error('LINKED: Lập phiếu tại màn hình tính lãi/chốt lương để giữ liên kết');
}
function financialWorkflow_(user,args,data,request){
  let effects=[],preview;
  if(args.kind==='payroll'){
    require_(user,'attendance','read');require_(user,'employees','read');require_(user,'cash','create');require_(user,'attendance','approve');
    if(!validDate(args.from)||!validDate(args.to)||args.from>args.to||!['cash','bank'].includes(args.account))throw new Error('VALIDATION: Kỳ lương/tài khoản không hợp lệ');
    periodRangeGuard_(args.from,args.to);
    if(effective(workflowRows_()).some(w=>w.kind==='payroll'&&workflowDetails_(w).from<=args.to&&workflowDetails_(w).to>=args.from))throw new Error('CONFLICT: Kỳ giao với bảng lương đã lập phiếu chi; hoàn tác bảng lương cũ trước');
    const selected=effective(data.attendance).filter(a=>a.date>=args.from&&a.date<=args.to);
    if(!selected.length)throw new Error('VALIDATION: Kỳ này chưa có chấm công');
    for(const row of selected){cleanRecord('attendance',Object.fromEntries(Object.keys(SCHEMA.attendance.fields).map(k=>[k,row[k]])),data);if(attendanceOverlap_(row,selected))throw new Error('CONFLICT: Có ca giao nhau; đối chiếu chấm công trước khi chốt');}
    const rows=payroll(selected),bonuses=Array.isArray(args.bonuses)?args.bonuses:[];if(bonuses.length)require_(user,'plans','read');const budget=allowed_(user,'plans','read')?(targets(data,args.from,args.to).bonusAvailable||0):0,assigned=new Set();
    if(bonuses.some(b=>!rows.some(r=>r.employeeId===b.id)||!finite(b.amount)||b.amount<0)||new Set(bonuses.map(b=>b.id)).size!==bonuses.length||bonuses.reduce((n,b)=>n+b.amount,0)>budget)throw new Error('VALIDATION: Thưởng vượt ngân sách hoặc mã nhân viên không hợp lệ');
    for(const row of rows){row.bonus=assigned.has(row.employeeId)?0:bonuses.find(b=>b.id===row.employeeId)?.amount||0;assigned.add(row.employeeId);row.pay=round(row.net+row.bonus);if(row.pay<0)throw new Error('BALANCE: Thực lĩnh âm; cần đối chiếu ứng/khấu trừ');if(row.pay>0)effects.push(newEffect_('cash',appRow_(user,{date:args.to,direction:'chi',account:args.account,amount:row.pay,category:'luong-thuong',linkedId:row.employeeId,note:'Lương '+args.from+' → '+args.to+' / '+row.department})));}
    preview={from:args.from,to:args.to,account:args.account,rows,total:round(rows.reduce((n,r)=>n+r.pay,0)),bonusBudget:budget};
    for(const row of rows)row.employeeName=effective(data.employees).find(e=>e.recordId===row.employeeId)?.name||row.employeeId;
    effects.push(workflowMarker_(user,'payroll',args.from+':'+args.to,args.to,{...preview,attendanceHash:hash_(selected),effects:effects.map(e=>({module:e.module,id:e.after.recordId}))}));
  }else if(args.kind==='interest'){
    require_(user,'loans','read');require_(user,'cash','create');require_(user,'loans','approve');
    const loan=effective(data.loans).find(l=>l.recordId===args.id);if(!loan)throw new Error('NOT_FOUND: Khoản vay không còn tồn tại');
    cleanRecord('loans',Object.fromEntries(Object.keys(SCHEMA.loans.fields).map(k=>[k,loan[k]])),data);
    if(effective(data.cash).some(c=>c.linkedId===loan.recordId&&c.category==='tra-vay'&&(!finite(c.amount)||c.amount<0||!validDate(c.date))))throw new Error('VALIDATION: Phiếu trả gốc nguồn không hợp lệ');
    if(!['cash','bank'].includes(args.account))throw new Error('VALIDATION: Tài khoản không hợp lệ');periodGuard_([args.to]);
    if(effective(workflowRows_()).some(w=>w.kind==='interest'&&w.referenceId===loan.recordId&&workflowDetails_(w).from<args.to&&workflowDetails_(w).to>args.from))throw new Error('CONFLICT: Kỳ lãi giao với khoản đã lập phiếu');
    if(args.basis!=='manual'||!finite(args.amount)||round(args.amount)<=0||!validDate(args.from)||!validDate(args.to)||args.from<loan.date||args.to<=args.from)throw new Error('VALIDATION: Chọn kỳ hợp lệ và nhập số tiền lãi lớn hơn 0; hệ thống không tự tính lãi');
    preview={from:args.from,to:args.to,basis:'manual',interest:round(args.amount),account:args.account,rule:'Số tiền lãi do người dùng nhập và xác nhận theo thỏa thuận. Không tự tính theo lãi suất.'};
    if(preview.interest>0)effects.push(newEffect_('cash',appRow_(user,{date:args.to,direction:'chi',account:args.account,amount:preview.interest,category:'lai-vay',linkedId:loan.recordId,note:'Lãi '+args.from+' → '+args.to+' / '+args.basis})));
    effects.push(workflowMarker_(user,'interest',loan.recordId,args.to,{...preview,effects:effects.map(e=>({module:e.module,id:e.after.recordId}))}));
  }else if(args.kind==='debt'){
    if(args.note!=null)operationText_(args.note);
    require_(user,'debts','read');require_(user,'cash','create');
    if(!validDate(args.date)||!['cash','bank'].includes(args.account)||!Array.isArray(args.allocations)||!args.allocations.length||args.allocations.length>30||new Set(args.allocations.map(a=>a.id)).size!==args.allocations.length)throw new Error('VALIDATION: Cần ngày/tài khoản và 1–30 khoản nợ khác nhau');periodGuard_([args.date]);
    let sale;
    if(args.saleId){require_(user,'sales','read');sale=effective(data.sales).find(s=>s.recordId===args.saleId);if(!sale||!(sale.oldDebtPaid>0)||sale.cash+sale.bank<sale.oldDebtPaid)throw new Error('VALIDATION: Phiếu cũ không có khoản thu nợ hợp lệ');if(workflowFind_('debt',sale.recordId))throw new Error('CONFLICT: Phiếu thu nợ cũ đã phân bổ');if(args.date!==sale.date)throw new Error('VALIDATION: Phân bổ phiếu cũ phải cùng ngày thu');}
    for(const allocation of args.allocations){
      const debt=effective(data.debts).find(d=>d.recordId===allocation.id);if(!debt||!finite(allocation.amount)||allocation.amount<=0||sale&&debt.type!=='phai-thu')throw new Error('VALIDATION: Công nợ/số tiền không hợp lệ');
      const record={date:args.date,direction:debt.type==='phai-thu'?'thu':'chi',account:args.account,amount:allocation.amount,category:debt.type==='phai-thu'?'thu-no':'tra-no',linkedId:debt.recordId,note:args.note||'Phân bổ thanh toán theo khoản'};validatePayment_(record,data);
      if(!sale)effects.push(newEffect_('cash',appRow_(user,record)));
    }
    const total=round(args.allocations.reduce((n,a)=>n+a.amount,0));if(sale&&Math.abs(total-sale.oldDebtPaid)>.001)throw new Error('VALIDATION: Tổng phân bổ phải bằng khoản thu nợ cũ');
    preview={allocations:args.allocations,total,account:args.account,saleId:sale?.recordId||'',cashEffect:sale?'Không ghi quỹ lần hai; tiền đã nằm trên phiếu doanh thu cũ':'Tạo phiếu quỹ theo từng khoản'};
    effects.push(workflowMarker_(user,'debt',sale?.recordId||args.key,args.date,{...preview,effects:effects.map(e=>({module:e.module,id:e.after.recordId}))}));
  }else if(args.kind==='undo'){
    operationText_(args.note,true);
    requireAdmin_(user);const marker=effective(workflowRows_()).find(w=>w.recordId===args.id);if(!marker||!['payroll','interest','debt'].includes(marker.kind))throw new Error('VALIDATION: Hoàn tác tại phiếu nguồn hoặc chọn một lần chốt tài chính');
    if(typeof args.note!=='string'||args.note.trim().length<5)throw new Error('VALIDATION: Cần lý do hoàn tác');periodGuard_([marker.date]);
    for(const e of workflowDetails_(marker).effects||[]){const row=effective(data[e.module]).find(r=>r.recordId===e.id);if(!row)throw new Error('CONFLICT: Phiếu đi kèm đã bị thay đổi');periodGuard_([row.date]);effects.push(newEffect_(e.module,appRow_(user,{...row,reverses:row.recordId})));}
    effects.push(newEffect_('_Workflows',appRow_(user,{date:marker.date,kind:marker.kind,referenceId:marker.referenceId,details:JSON.stringify({note:args.note}),reverses:marker.recordId})));
  }else throw new Error('VALIDATION: Nghiệp vụ không tồn tại');
  if(args.preview===true)return {preview,effectCount:effects.length};
  return transact_(user.email,args.key,request,effects);
}
function workflowReports_(user,args){
  const required={payroll:['attendance','employees'],interest:['loans'],debt:['debts']}[args.kind];if(!required)throw new Error('VALIDATION: Báo cáo chốt không hợp lệ');for(const module of required)require_(user,module,'read');
  const rows=effective(workflowRows_()).filter(w=>w.kind===args.kind);
  if(!args.id)return {rows:rows.slice(-100).map(w=>({id:w.recordId,date:w.date,referenceId:w.referenceId}))};
  const marker=rows.find(w=>w.recordId===args.id);if(!marker)throw new Error('NOT_FOUND: Lần chốt không còn hiệu lực');const d=workflowDetails_(marker);
  const preview=args.kind==='payroll'?{from:d.from,to:d.to,account:d.account,rows:d.rows,total:d.total}:args.kind==='interest'?{from:d.from,to:d.to,account:d.account,segments:d.segments,interest:d.interest,basis:d.basis,annualRate:d.annualRate,rule:d.rule}:{date:marker.date,account:d.account,allocations:d.allocations,total:d.total,cashEffect:d.cashEffect};
  return {posted:true,id:marker.recordId,date:marker.date,preview};
}

import path from 'node:path';
export async function checkCommercial(page,base,out,report){
 await page.routeWebSocket('**',socket=>socket.close());
 const names={stores:'Danh mục điểm bán',products:'Danh mục món bán',employees:'Danh mục nhân viên',discounts:'Bảng chiết khấu'};
 async function fits(label){const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow)throw new Error(label+' page overflows');}
 async function close(){await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});}
 async function dialog(label){const box=await page.getByRole('dialog').boundingBox(),viewport=page.viewportSize();if(!box||box.x<0||box.y<0||box.x+box.width>viewport.width+1||box.y+box.height>viewport.height+1)throw new Error(label+' dialog outside screen');await fits(label);const last=page.getByRole('dialog').locator('button').last();await last.scrollIntoViewIfNeeded();if(await page.evaluate(()=>document.body.style.overflow)!=='hidden')throw new Error('Modal background scroll unlocked');}
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:width<500?844:900});
  for(const kind of Object.keys(names)){
   await page.goto(base+'/app/'+kind);await page.getByRole('heading',{name:names[kind],exact:true}).first().waitFor();await page.locator('tbody tr').first().waitFor();await page.evaluate(()=>document.fonts.ready);await fits(kind+' '+width);report.pages.push({kind,width,overflow:false});
   await page.screenshot({path:path.join(out,kind+'-'+width+'.png')});
   if(width>=1280){const header=await page.locator('.commercial-workspace .card-head').boundingBox();if(header.height>110)throw new Error('Commercial filters unnecessarily wrap');}
   if(kind==='employees'){
    if(await page.getByText('Phụ cấp mặc định',{exact:false}).count())throw new Error('Default allowance still shown');
    if(!await page.getByText('KHO-01 · Kho nguyên liệu',{exact:true}).count())throw new Error('Employee catalogue does not show the linked department code and name');
    await page.getByRole('button',{name:'Phụ cấp tháng',exact:true}).first().click();await page.getByRole('button',{name:'Lưu phụ cấp tháng',exact:true}).waitFor();await dialog('Monthly allowance '+width);
    if(await page.getByLabel('Tổng phụ cấp tháng (đ) *',{exact:true}).inputValue()!=='300.000')throw new Error('Monthly amount format missing');
    const today=new Date();const next=new Date(Date.UTC(today.getFullYear(),today.getMonth()+1,1)).toISOString().slice(0,7);await page.getByLabel('Tháng áp dụng',{exact:true}).fill(next);
    await page.getByText('Chưa ghi nhận phụ cấp cho tháng này.',{exact:true}).waitFor();if(await page.getByLabel('Tổng phụ cấp tháng (đ) *',{exact:true}).inputValue()!=='')throw new Error('Allowance carried to another month');
    await page.screenshot({path:path.join(out,'monthly-allowance-'+width+'.png')});await close();
   }
   if(kind!=='discounts'){
    await page.getByRole('button',{name:'Sửa',exact:true}).first().click();await dialog(kind+' editor');
    if(kind==='employees'&&await page.getByLabel('Bộ phận',{exact:true}).inputValue()!=='')throw new Error('Unknown department was invented');
    if(kind==='employees'&&!await page.getByLabel('Bộ phận',{exact:true}).locator('option').filter({hasText:'KHO-01 · Kho nguyên liệu'}).count())throw new Error('Custom department option is missing from employee form');
    await close();
   }
   const captions=kind==='stores'?['Giá riêng','Chiết khấu']:kind==='products'?['Giá bán']:kind==='employees'?['Lương giờ']:['Chi tiết / lịch sử'];
   if(kind==='products'){
    await page.getByRole('button',{name:'Liên kết công thức',exact:true}).first().click();await page.getByRole('dialog').locator('select').first().waitFor();await dialog('product recipe link '+width);await close();
   }
   for(const caption of captions){
    await page.getByRole('button',{name:caption,exact:true}).first().click();
    if(caption==='Giá bán'){
     await page.getByRole('button',{name:'Lưu phiên bản mới',exact:true}).waitFor();await dialog(kind+' '+caption);
     if(await page.getByLabel('Nguồn / lý do *',{exact:true}).count())throw new Error('Price form still asks for a source/reason');
     if(await page.getByLabel('Giá bán (đ) *',{exact:true}).inputValue()!=='15.000')throw new Error('VND input not formatted');
     await close();continue;
    }
    await page.getByText('Nguồn kiểm thử tổng hợp',{exact:true}).waitFor();await dialog(kind+' history');
    if(kind==='employees'&&!await page.getByText('KHO-01 · Kho nguyên liệu · 25.000 đ/giờ',{exact:true}).count())throw new Error('Pay history does not show the linked department code and name');
    await page.getByRole('button',{name:'Thêm phiên bản',exact:true}).click();await page.getByRole('button',{name:'Lưu phiên bản mới',exact:true}).waitFor();await dialog(kind+' '+caption);
    if(kind==='employees'){const payDepartments=await page.locator('select[aria-label="Bộ phận áp dụng mức lương"] option').allTextContents();if(!payDepartments.some(label=>label.includes('KHO-01 · Kho nguyên liệu')))throw new Error('Custom department option is missing from pay form: '+JSON.stringify(payDepartments));}
    if(caption==='Chiết khấu'||kind==='discounts'){
     const excluded=page.getByRole('checkbox',{name:'SYN-W · Món nguyên cây kiểm thử',exact:true});if(await excluded.isChecked())throw new Error('Excluded product was ticked');
     await page.getByRole('button',{name:'Chọn tất cả',exact:true}).click();if(!await excluded.isChecked())throw new Error('Select all failed');
     await page.getByRole('button',{name:'Bỏ chọn tất cả',exact:true}).click();if(await excluded.isChecked())throw new Error('Clear all failed');
     await page.screenshot({path:path.join(out,'discount-editor-'+width+'.png')});
    }
    await close();
   }
  }
 }
 await page.goto(base+'/app/employees?role=staff');await page.locator('tbody tr').first().waitFor();
 if(await page.getByRole('button',{name:'Lương giờ',exact:true}).count()||await page.getByRole('button',{name:'Sửa',exact:true}).count()||await page.getByText('25.000 đ',{exact:true}).count())throw new Error('Unauthorized payroll/action rendered');
 const requests=[];
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/save_commercial_terms',async route=>{requests.push(route.request().postDataJSON());await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'NETWORK',message:'Synthetic uncertain response'})});});
 await page.goto(base+'/app/products');await page.getByRole('button',{name:'Giá bán',exact:true}).click();await page.getByLabel('Giá bán (đ) *',{exact:true}).fill('15.000');if(await page.getByLabel('Nguồn / lý do *',{exact:true}).count())throw new Error('Price form still asks for a source/reason');await page.getByRole('button',{name:'Lưu phiên bản mới',exact:true}).click();await page.getByRole('button',{name:'Kiểm tra lại lần lưu',exact:true}).waitFor();await page.getByRole('button',{name:'Kiểm tra lại lần lưu',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.chifaa-toast').length>0);
 if(requests.length!==2||requests[0].p_key!==requests[1].p_key||requests[0].p_input.amount!=='15000'||requests[0].p_input.evidence!=='Cập nhật trong danh mục món bán')throw new Error('Price retry lost its idempotency key, audit context, or exact VND amount');
 await page.goto(base+'/app/departments');await page.getByRole('button',{name:'Thêm mới',exact:true}).click();const departmentDialog=page.getByRole('dialog'),departmentCode=departmentDialog.getByLabel('Mã bộ phận',{exact:true});await departmentDialog.waitFor();if(await departmentCode.evaluate(element=>element.tagName!=='INPUT'||element.type!=='text'))throw new Error('Department code is still a fixed-choice control');await departmentCode.fill('kho-02');if(await departmentCode.inputValue()!=='KHO-02')throw new Error('Department code is not normalized for the shared catalog');await departmentDialog.getByRole('button',{name:'Đóng',exact:true}).click();
 report.checks.push('4 commercial catalogues ×5 widths, typed department-code entry and uppercase normalization, dynamic department code/name in employee rows, employee and salary selectors and pay history, direct price editor without history/reason, product recipe-link shortcut, metadata/pay/store-price/discount dialogs, Vietnamese money, unknown department retained, discount checkboxes, hidden salary/actions and same-key uncertain retry; synthetic offline fixture');
}

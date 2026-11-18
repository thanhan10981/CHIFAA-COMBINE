import path from 'node:path';
export async function checkMaterialTable(page,base,out,report){
 await page.routeWebSocket('**',socket=>socket.close());
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});await page.goto(base+'/app/materials');
  await page.locator('.material-row-actions').first().waitFor();
  for(const actions of await page.locator('.material-row-actions').all()){
   if(await actions.getByRole('button').count()!==1||await actions.innerText()!=='Sửa')throw new Error('Row must have just Edit');
  }
  if(await page.locator('.material-table').getByText(/Cần xác minh|Cần đối chiếu/).count())throw new Error('Review warnings remain');
  const firstWarnings=await page.locator('.material-table tbody tr').first().locator('td').nth(9).innerText();
  if(firstWarnings.includes('Thiếu đơn giá')||!firstWarnings.includes('Thiếu tồn hiện tại'))throw new Error('Warnings must reflect empty columns');
  await page.locator('.material-row-actions').nth(1).getByRole('button',{name:'Sửa',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  if(await dialog.getByLabel(/chứng từ|nguồn|Ngày hiệu lực|Đơn vị kho/i).count())throw new Error('Non-column fields remain');
  if((await dialog.getByLabel('Tồn hiện tại',{exact:true}).getAttribute('readonly'))===null)throw new Error('Stock must be read-only');
  if(await dialog.getByLabel('Đơn giá (đ)',{exact:true}).isDisabled())throw new Error('Resolved price still locked for Admin');
  await dialog.getByLabel('Đơn giá (đ)',{exact:true}).fill('260.000');
  if(await dialog.getByLabel('Đơn giá (đ)',{exact:true}).inputValue()!=='260.000')throw new Error('VND input changed');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Page overflows '+width);
  if(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1)){
   await page.screenshot({path:path.join(out,'overflow-'+width+'.png')});
   throw new Error('Dialog overflows '+width+': '+JSON.stringify(await dialog.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,items:[...el.querySelectorAll('*')].map(item=>({tag:item.tagName,cls:item.className,width:item.getBoundingClientRect().width,right:item.getBoundingClientRect().right})).filter(item=>item.right>el.getBoundingClientRect().right)}))));
  }
  await dialog.getByRole('button',{name:'Lưu vật tư',exact:true}).scrollIntoViewIfNeeded();
  if([390,1440].includes(width))await page.screenshot({path:path.join(out,'edit-'+width+'.png')});
  await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
  if(width===1440)await page.screenshot({path:path.join(out,'table-1440.png')});
  report.checks.push('material table/editor '+width+': single Edit, column fields, blank warnings, editable resolved price, stock read-only, no overflow');
 }
 await page.setViewportSize({width:1440,height:900});await page.goto(base+'/app/materials');
 await page.getByRole('button',{name:'Cài đặt quy đổi',exact:true}).click();
 await page.getByRole('dialog').getByRole('combobox').selectOption('material-1');
 await page.getByRole('button',{name:'Xem giá, đơn vị & quy cách',exact:true}).click();
 await page.getByRole('button',{name:'Lưu phiên bản xác minh',exact:true}).waitFor();
 if(await page.locator('.material-review-history').count()||await page.getByRole('dialog').getByText(/Dữ liệu gốc.*lịch sử/).count())throw new Error('Material history still visible');
 await page.screenshot({path:path.join(out,'settings-no-history.png')});
 await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
 report.checks.push('material settings show current values without a history section');
 const requests=[];
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/save_material_table',async route=>{
  requests.push(route.request().postDataJSON());
  await route.fulfill({status:requests.length===1?503:200,contentType:'application/json',body:requests.length===1?'{}':'{"id":"material-1","version":"2"}'});
 });
 await page.locator('.material-row-actions').nth(1).getByRole('button',{name:'Sửa',exact:true}).click();
 await page.getByLabel('Đơn giá (đ)',{exact:true}).fill('180.000');
 await page.getByRole('button',{name:'Lưu vật tư',exact:true}).click();
 await page.getByRole('button',{name:'Kiểm tra lại lần gửi',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 if(requests.length!==2||JSON.stringify(requests[0])!==JSON.stringify(requests[1]))throw new Error('Retry lost original idempotency request');
 if(requests[0].p_input.price_amount!=='180000'||Object.keys(requests[0].p_input).some(key=>/stock|reference|verified|evidence|date/.test(key)))throw new Error('Edit includes non-column mutation');
 report.checks.push('offline mocked RPC: decimal money, atomic column payload, identical idempotency request after uncertain503; no cloud writes');
}

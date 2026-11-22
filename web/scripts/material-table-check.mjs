import path from 'node:path';
import ExcelJS from 'exceljs';
export async function checkMaterialTable(page,base,out,report){
 await page.routeWebSocket('**',socket=>socket.close());
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});await page.goto(base+'/app/materials');
   await page.locator('.material-row-actions').first().waitFor();
   if(await page.getByLabel('Sắp xếp vật tư',{exact:true}).count()!==1)throw new Error('Catalog sort control missing at '+width+'px');
  for(const [index,actions] of (await page.locator('.material-row-actions').all()).entries()){
   const expected=index===5?3:2;
   if(await actions.getByRole('button').count()!==expected||!(await actions.innerText()).includes('Sửa')||!(await actions.innerText()).includes('Xóa')||(index===5&&!(await actions.innerText()).includes('Xác minh giá')))throw new Error('Material rows must expose delete while preserving direct verification action');
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
  await page.locator('.material-row-actions').first().getByRole('button',{name:'Xóa',exact:true}).click();
  const archiveDialog=page.getByRole('dialog');await archiveDialog.waitFor();
  if(!(await archiveDialog.innerText()).includes('Lịch sử công thức, giá và chứng từ kho vẫn được lưu'))throw new Error('Archive confirmation must explain that history is retained');
  await archiveDialog.getByRole('button',{name:'Hủy',exact:true}).click();await archiveDialog.waitFor({state:'hidden'});
  if(width===1920){
   const archiveRequests=[];let restoreCompleted=false;
   await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/set_material_archived',async route=>{const request=route.request().postDataJSON();archiveRequests.push(request);if(request.p_archived){await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'MATERIAL_HAS_STOCK',details:null,hint:null})});}else{restoreCompleted=true;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:request.p_id,archived:false,version:3})});}});
   await page.locator('.material-row-actions').first().getByRole('button',{name:'Xóa',exact:true}).click();
   const archiveErrorDialog=page.getByRole('dialog');await archiveErrorDialog.getByRole('button',{name:'Xóa vật tư',exact:true}).click();await archiveErrorDialog.getByRole('alert').waitFor();
   if(!((await archiveErrorDialog.getByRole('alert').innerText()).includes('Tồn vật tư chưa bằng 0'))||await archiveErrorDialog.getByRole('button',{name:'Hủy',exact:true}).isDisabled()||await archiveErrorDialog.getByRole('button',{name:'Đóng hộp thoại',exact:true}).isDisabled())throw new Error('Blocked archive must explain the stock reason while leaving the dialog closable');
   await archiveErrorDialog.getByRole('button',{name:'Hủy',exact:true}).click();await archiveErrorDialog.waitFor({state:'hidden'});
   if(archiveRequests.length!==1||archiveRequests[0].p_archived!==true||!archiveRequests[0].p_key)throw new Error('Archive must send an idempotent, versioned state change');
   report.checks.push('material archive confirmation preserves history, can cancel, and remains closable after positive-stock rejection');
   await page.route('https://visual-fixture.supabase.co/rest/v1/materials?*',async route=>{const url=route.request().url();if(url.includes('archived=eq.true'))await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(restoreCompleted?[]:[{id:'archived-fixture',code:'ARCHIVE-1',name:'Vật tư đã ẩn',version:2,updated_at:'2026-11-22T00:00:00Z'}])});else await route.continue();});
   await page.getByRole('button',{name:'Vật tư đã xóa',exact:true}).click();const archivedDialog=page.getByRole('dialog');await archivedDialog.getByRole('button',{name:'Khôi phục',exact:true}).click();await archivedDialog.getByText('Chưa có vật tư đã xóa.',{exact:true}).waitFor();
   if(archiveRequests.length!==2||archiveRequests[1].p_archived!==false||!archiveRequests[1].p_key)throw new Error('Restore must use a versioned idempotent state change and remove the row from the archive list');
   await archivedDialog.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();report.checks.push('archived material can be restored and returns to the live catalog');
  }
  if(width===1440)await page.screenshot({path:path.join(out,'table-1440.png')});
  report.checks.push('material table/editor '+width+': direct verification action on pending price, column fields, blank warnings, editable resolved price, stock read-only, no overflow');
 }
  await page.setViewportSize({width:1440,height:900});await page.goto(base+'/app/materials');
  const sortRequests=[];
  await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/material_catalog_sorted',async route=>{
   sortRequests.push(route.request().postDataJSON());
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({metrics:{total:0,kg:0,categories:0,unpriced:0},rows:[],total:'0'})});
  });
  for(const [value,label] of [['name_asc','Tên A–Z'],['name_desc','Tên Z–A'],['newest','Mới nhất'],['oldest','Cũ nhất']]){
   await page.getByLabel('Sắp xếp vật tư',{exact:true}).selectOption(value);
   await page.getByText('Không có vật tư phù hợp.',{exact:true}).waitFor();
   if(await page.getByLabel('Sắp xếp vật tư',{exact:true}).inputValue()!==value||(await page.getByLabel('Sắp xếp vật tư',{exact:true}).locator('option:checked').textContent())!==label)throw new Error('Catalog sort label mismatch for '+value);
  }
  if(sortRequests.map(request=>request.p_sort).join(',')!=='name_asc,name_desc,newest,oldest'||sortRequests.some(request=>request.p_offset!==0))throw new Error('Catalog sort selection must query the server and reset pagination: '+JSON.stringify(sortRequests));
  report.checks.push('catalog sort control fits at 320/390/768/1024/1440/1920px and sends A–Z, Z–A, newest and oldest to the server with page reset');
  await page.setViewportSize({width:1440,height:900});await page.goto(base+'/app/materials');
 await page.getByRole('button',{name:'Cài đặt quy đổi',exact:true}).click();
 const conversionDialog=page.getByRole('dialog');await conversionDialog.waitFor();if(!await conversionDialog.locator('.material-settings-start').isVisible()||!(await conversionDialog.innerText()).includes('Bắt đầu bằng cách chọn vật tư'))throw new Error('Material conversion setup should show a clear first step');await page.screenshot({path:path.join(out,'material-conversion-start.png')});
 await page.getByRole('dialog').getByRole('combobox').selectOption('material-2');
 await page.getByRole('button',{name:'Xem giá, đơn vị & quy cách',exact:true}).click();
 await page.getByRole('button',{name:'Lưu xác minh',exact:true}).waitFor();
 const editableUsage=page.getByLabel('Đơn vị dùng / kho',{exact:true});if(await editableUsage.isDisabled()||!(await page.getByRole('dialog').innerText()).includes('Có thể đổi đơn vị chuẩn')||await page.getByLabel('Quy đổi ra đơn vị dùng/kho').count()!==1)throw new Error('Historical material should allow a stock unit change and package conversion in grams');await editableUsage.selectOption('g');
 await page.getByLabel('Quy đổi ra đơn vị dùng/kho').selectOption('g');await page.getByLabel('Số đơn vị dùng trong một đơn vị mua').fill('100');if(!(await page.locator('.material-conversion-preview').innerText()).includes('1 túi = 100 g'))throw new Error('Historical material should preview package size in grams');
 if(await page.locator('.material-review-history').count()||await page.getByRole('dialog').getByText(/Dữ liệu gốc.*lịch sử/).count())throw new Error('Material history still visible');
 await page.screenshot({path:path.join(out,'settings-editable-stock-unit.png')});
 await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
 report.checks.push('material settings allow changing a historical stock unit and editing a package ratio in grams');
 const requests=[];
 await page.locator('.material-row-actions').nth(5).getByRole('button',{name:'Xác minh giá chuẩn',exact:true}).click();
 const reviewDialog=page.getByRole('dialog');await reviewDialog.waitFor();
 if(!(await reviewDialog.innerText()).includes('CHỜ XÁC MINH')||!await reviewDialog.getByRole('button',{name:'Lưu xác minh',exact:true}).isVisible())throw new Error('Direct verification action did not open the price verification form');
 if(!(await reviewDialog.innerText()).includes('không cần nhập quy đổi')||await reviewDialog.locator('.material-conversion-row').count()!==0)throw new Error('Same purchase and usage units should skip conversion inputs');
 await reviewDialog.getByLabel('Đơn vị mua',{exact:true}).selectOption('chai');await reviewDialog.getByLabel('Đơn vị dùng / kho',{exact:true}).selectOption('g');await reviewDialog.getByLabel('Quy đổi từ đơn vị mua').selectOption('chai');await reviewDialog.getByLabel('Quy đổi ra đơn vị dùng/kho').selectOption('g');await reviewDialog.getByLabel('Số đơn vị dùng trong một đơn vị mua').fill('100');if(!(await reviewDialog.locator('.material-conversion-preview').innerText()).includes('1 chai = 100 g'))throw new Error('Material conversion preview should show the selected source, quantity and target');
 await reviewDialog.locator('.material-price-entry input').fill('12.000');await reviewDialog.getByLabel('Đơn vị áp dụng giá').selectOption('');const reviewRequests=[];await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/resolve_material',async route=>{reviewRequests.push(route.request().postDataJSON());await route.fulfill({status:400,contentType:'application/json',body:reviewRequests.length===1?'{"code":"P0001","message":"PRICE_BASIS_REQUIRED"}':'{"code":"P0001","message":"FIXTURE_CAPTURE_ONLY"}'});});await reviewDialog.getByRole('button',{name:'Lưu xác minh',exact:true}).click();await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();const reviewInput=reviewRequests.at(-1)?.p_input;if(reviewRequests.length!==2||reviewRequests[0]?.p_key!==reviewRequests[1]?.p_key||reviewInput?.basis_unit_id!=='chai'||reviewInput?.verification!=='verified'||reviewInput?.amount!=='12000'||reviewInput?.package_quantity!=='100')throw new Error('A PRICE_BASIS_REQUIRED response should retry once with purchase unit basis and the same idempotency key');
 report.checks.push('pending price uses purchase unit as the price-basis default and saves a 1-to-100 conversion');
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/save_material_table',async route=>{
  requests.push(route.request().postDataJSON());
  await route.fulfill({status:requests.length===1?503:requests.length===2?200:400,contentType:'application/json',body:requests.length===1?'{}':requests.length===2?'{"id":"material-1","version":"2"}':'{"code":"55000","message":"FUNCTION VERSION REQUIRED"}'});
 });
 await page.locator('.material-row-actions').nth(1).getByRole('button',{name:'Sửa',exact:true}).click();
 const editDialog=page.getByRole('dialog');if(!((await editDialog.innerText()).includes('Đơn vị mua/nhập *')&&(await editDialog.innerText()).includes('Giá này tính theo đơn vị')&&(await editDialog.innerText()).includes('12.000 đ/túi')))throw new Error('Material edit should distinguish purchase unit from price basis');
 await page.getByLabel('Đơn giá (đ)',{exact:true}).fill('180.000');
 await page.getByRole('button',{name:'Lưu vật tư',exact:true}).click();
 await page.getByRole('button',{name:'Kiểm tra lại lần gửi',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 if(requests.length!==2||JSON.stringify(requests[0])!==JSON.stringify(requests[1]))throw new Error('Retry lost original idempotency request');
 const inputKeys=Object.keys(requests[0].p_input);
 if(requests[0].p_input.price_amount!=='180000'||inputKeys.some(key=>/^(?:stock|reference_quantity|effective_from|moved_on)/.test(key))||!['package_content_unit_id','package_quantity','package_verified','package_evidence'].every(key=>inputKeys.includes(key)))throw new Error('Edit should send catalog fields and structured packaging, without stock mutations');
 report.checks.push('offline mocked RPC: decimal money, atomic column payload, identical idempotency request after uncertain503; no cloud writes');

 await page.getByRole('button',{name:'Thêm vật tư',exact:true}).click();
 const failedDialog=page.getByRole('dialog');await failedDialog.waitFor();
 await failedDialog.getByLabel('Mã sản phẩm *',{exact:true}).fill('REPAIR-AFTER-ERROR');
 await failedDialog.getByLabel('Tên vật tư *',{exact:true}).fill('Repair fixture');
 await failedDialog.getByLabel('Đơn vị mua/nhập *').selectOption('kg');
 await failedDialog.getByLabel('Đơn vị dùng/kho *').selectOption('kg');
 await failedDialog.getByRole('button',{name:'Lưu vật tư',exact:true}).click();
 await failedDialog.getByRole('alert').waitFor();
 if(await failedDialog.getByLabel('Mã sản phẩm *',{exact:true}).isDisabled()||await failedDialog.getByRole('button',{name:'Đóng hộp thoại',exact:true}).isDisabled())throw new Error('A rejected material save must leave the form editable and closable');
 await failedDialog.getByLabel('Mã sản phẩm *',{exact:true}).fill('EDITABLE-AFTER-ERROR');
 await failedDialog.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
 await failedDialog.waitFor({state:'hidden'});
 if(requests.length!==3||requests[2].p_input.code!=='REPAIR-AFTER-ERROR')throw new Error('The rejected payload should be released so the form can be edited without retrying stale input');
 report.checks.push('55000 rejected save leaves catalog form editable and close button available');

 const catalogBook=new ExcelJS.Workbook(),catalogSheet=catalogBook.addWorksheet('Danh mục vật tư');
 catalogSheet.addRow(['Mã nội bộ','Phiên bản','Mã SP','Tên vật tư','Nhóm vật tư','Đơn vị mua','Đơn vị tính giá','Đơn giá (đ)','Tồn tối thiểu','Quy cách']);
 catalogSheet.addRow(['','','DESIGN-NEW','Vật tư thiết kế','Nguyên liệu','kg','','','','']);
 const catalogFile={name:'danh-muc-vat-tu.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await catalogBook.xlsx.writeBuffer())};
 const importRequests=[];
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/import_material_catalog_excel',async route=>{
  importRequests.push(route.request().postDataJSON());
  await route.fulfill({status:importRequests.length===1?503:200,contentType:'application/json',body:importRequests.length===1?'{}':'{"materials_created":1,"materials_updated":0,"materials_unchanged":0}'});
 });
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:900});await page.goto(base+'/app/materials');
  await page.getByRole('button',{name:'Nhập Excel',exact:true}).waitFor();await page.locator('.material-file-input').setInputFiles(catalogFile);
  const importDialog=page.getByRole('dialog');await importDialog.waitFor();
  if(!(await importDialog.innerText()).includes('Rà soát nhập danh mục')||!(await importDialog.innerText()).includes('Tồn tối thiểu'))throw new Error('Material import should show a row review before confirmation');
  if(await importDialog.evaluate(el=>el.scrollWidth>el.clientWidth+1)||await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Material import review overflows at '+width);
  if(width===320||width===1440)await page.screenshot({path:path.join(out,`material-import-${width}.png`),animations:'disabled'});
  if(width===1440){
   await importDialog.getByRole('button',{name:'Xác nhận nhập 1 dòng',exact:true}).click();
   await importDialog.getByRole('button',{name:'Kiểm tra lại lần gửi',exact:true}).waitFor();
   await importDialog.getByRole('button',{name:'Kiểm tra lại lần gửi',exact:true}).click();
   await importDialog.waitFor({state:'hidden'});
  }else await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
 }
 if(importRequests.length!==2||JSON.stringify(importRequests[0])!==JSON.stringify(importRequests[1])||importRequests[0].p_rows?.[0]?.material_id!==null)throw new Error('Material Excel import should retry idempotently and send a new catalog row');
 report.checks.push('Excel catalog import preview at 320/390/1440px; new rows, no overflow and same idempotency payload after uncertain response');
}

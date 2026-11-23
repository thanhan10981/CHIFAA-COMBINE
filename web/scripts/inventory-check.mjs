import path from 'node:path';
import ExcelJS from 'exceljs';
export async function checkInventory(page,base,out,report){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const slug of ['inventory','stockmovements','stockhistory','reorder','entry-stock']){
   await page.goto(base+'/app/'+slug);await page.getByText(slug==='stockhistory'?'Chứng từ nhập kiểm thử':'Vật tư kiểm thử nhập kho',{exact:slug!=='stockhistory'}).waitFor();
   if(await page.locator('select[aria-label="Kho nguy\u00ean li\u1ec7u"]').count())throw new Error('Warehouse selector remains');
   if(await page.locator('a[href="/app/warehouses"]').count())throw new Error('Warehouse catalogue link remains');
   if(slug==='inventory'){
    if(await page.locator('.inventory-workspace nav').count())throw new Error('Duplicate warehouse navigation');
    const actions=page.getByRole('row').filter({hasText:'INV-M'}).locator('.inventory-action');
    if(await actions.count()!==3)throw new Error('Three compact inventory actions missing');
    const sizes=await actions.evaluateAll(buttons=>buttons.map(button=>({w:button.getBoundingClientRect().width,h:button.getBoundingClientRect().height,y:button.getBoundingClientRect().y,text:button.textContent,accessible:button.getAttribute('aria-label'),tooltip:button.getAttribute('title'),icons:button.querySelectorAll('svg').length})));
    if(sizes.some(s=>s.w<34||s.h<34||s.text.trim()||!s.accessible||!s.tooltip||s.icons!==1)||Math.max(...sizes.map(s=>s.y))-Math.min(...sizes.map(s=>s.y))>1)throw new Error('Compact icon actions are inaccessible or wrap');
    if(width===1440){const filter=await page.locator('.inventory-filters').evaluate(node=>[...node.children].map(child=>child.getBoundingClientRect().y));if(Math.max(...filter)-Math.min(...filter)>2)throw new Error('Desktop filters do not fit one row');}
   }
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Inventory overflow '+slug+' '+width);
   await page.screenshot({path:path.join(out,slug+'-'+width+'.png')});report.pages.push({slug,width,overflow:false});
  }
 }
 await page.goto(base+'/app/inventory?empty-warehouse');await page.getByRole('status').filter({hasText:'Kho nguy\u00ean li\u1ec7u ch\u01b0a \u0111\u01b0\u1ee3c kh\u1edfi t\u1ea1o'}).waitFor();
 await page.goto(base+'/app/inventory');await page.getByText('Vật tư kiểm thử nhập kho',{exact:true}).waitFor();
 for(const width of [320,1440]){
  await page.setViewportSize({width,height:900});
  for(const [name,file] of [['Nhập','receipt'],['Xuất','issue'],['Kiểm kê','count']]){
   await page.getByRole('row').filter({hasText:'INV-Z'}).getByRole('button',{name,exact:true}).click();
   const dialog=page.getByRole('dialog');const bounds=await dialog.boundingBox();
   await page.screenshot({path:path.join(out,file+'-dialog-'+width+'.png')});
   if(!bounds||bounds.width>522||bounds.x<0||bounds.x+bounds.width>width+1||bounds.height>650)throw new Error('Inventory dialog is too large or clipped: '+JSON.stringify({width,file,bounds}));
   await page.getByRole('button',{name:'Hủy',exact:true}).click();
  }
 }
 await page.setViewportSize({width:1440,height:900});
 const row=page.getByRole('row').filter({hasText:'INV-M'});await row.getByRole('link',{name:'Xem lần nhập và giá',exact:true}).click();await page.getByText('Lịch sử giá và phiếu của vật tư',{exact:true}).waitFor();await page.screenshot({path:path.join(out,'filtered-history.png')});const priceCell=page.getByRole('row').filter({hasText:'INV-M'}).locator('td').nth(4);if(!(await priceCell.innerText()).includes('3.000 đ / kg'))throw new Error('Filtered receipt unit price is missing');
 await page.setViewportSize({width:320,height:900});await page.getByRole('button',{name:'Sửa giá / số lượng',exact:true}).click();let correctionDialog=page.getByRole('dialog'),correctionBounds=await correctionDialog.boundingBox();await page.screenshot({path:path.join(out,'receipt-correction-dialog-320.png')});if(!correctionBounds||correctionBounds.x<0||correctionBounds.x+correctionBounds.width>321)throw new Error('Receipt correction dialog is clipped at 320px');await page.getByRole('button',{name:'Hủy',exact:true}).click();
 await page.setViewportSize({width:1440,height:900});const correctionSent=[];await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/correct_inventory_receipt',async route=>{correctionSent.push(route.request().postDataJSON());await route.fulfill({status:200,contentType:'application/json',body:'{"original_movement_id":"inv-doc","reversal_movement_id":"synthetic-reversal","replacement_movement_id":"synthetic-replacement","replacement_line_id":"synthetic-line"}'});});
 await page.getByRole('button',{name:'Sửa giá / số lượng',exact:true}).click();await page.getByLabel('Số lượng nhập cần sửa',{exact:true}).fill('11');await page.getByLabel('Đơn giá nhập cần sửa',{exact:true}).fill('3500');await page.getByLabel('Lý do sửa phiếu nhập',{exact:true}).fill('Invoice price corrected');await page.getByRole('button',{name:'Lưu điều chỉnh',exact:true}).click();await page.getByText('Đã ghi phiếu điều chỉnh có liên kết. Lịch sử giữ phiếu gốc và cập nhật số tồn theo phiếu thay thế.',{exact:true}).waitFor();if(correctionSent.length!==1||correctionSent[0].p_movement!=='inv-doc'||correctionSent[0].p_line!=='inv-line'||correctionSent[0].p_quantity!=='11'||correctionSent[0].p_unit_cost!=='3500'||correctionSent[0].p_reason!=='Invoice price corrected'||!correctionSent[0].p_key)throw new Error('Receipt correction did not preserve selected receipt values/reason/key');
 await page.goto(base+'/app/inventory');await page.getByRole('row').filter({hasText:'INV-M'}).getByRole('button',{name:'Nhập',exact:true}).click();
 await page.getByLabel('Số lượng phiếu kho',{exact:true}).fill('2,5');await page.getByLabel('Đơn giá nhập',{exact:true}).fill('3000');
 const sent=[];await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/post_inventory',async route=>{sent.push(route.request().postDataJSON());if(sent.length===1)await route.abort();else await route.fulfill({status:200,contentType:'application/json',body:'{"movement_id":"synthetic-receipt"}'});});
 await page.getByRole('button',{name:'Lưu phiếu kho',exact:true}).click();await page.getByRole('button',{name:'Kiểm tra lại lần lưu',exact:true}).waitFor();
 if(!await page.getByLabel('Số lượng phiếu kho',{exact:true}).isDisabled())throw new Error('Uncertain receipt input unlocked');
 await page.getByRole('button',{name:'Kiểm tra lại lần lưu',exact:true}).click();await page.getByText('Đã ghi phiếu. Tồn kho và lịch sử đã được cập nhật.',{exact:true}).waitFor();
 if(sent.length!==2||JSON.stringify(sent[0])!==JSON.stringify(sent[1])||sent[0].p_lines[0].quantity!=='2.5'||sent[0].p_lines[0].unit_cost!=='3000')throw new Error('Receipt retry payload/quantity changed');
 await page.goto(base+'/app/inventory');await page.getByRole('row').filter({hasText:'INV-Z'}).getByRole('button',{name:'Xuất',exact:true}).click();await page.getByLabel('Số lượng phiếu kho',{exact:true}).fill('1');
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/post_inventory',route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'INSUFFICIENT_STOCK',details:JSON.stringify({material_code:'INV-Z',material_name:'Vật tư tồn không đã xác nhận',unit_code:'kg',transaction_date:today,requested_quantity:'1',available_quantity:'0',shortage_quantity:'1',negative_balance_date:today,projected_balance:'-1'})})}));
 await page.getByRole('button',{name:'Lưu phiếu kho',exact:true}).click();await page.getByText(/Không thể xuất INV-Z · Vật tư tồn không đã xác nhận.*cần 1 kg, tồn trước phiếu 0 kg, thiếu 1 kg/).waitFor();
 if(await page.getByText('INSUFFICIENT_STOCK',{exact:true}).count())throw new Error('Inventory shortage exposed the raw database code instead of quantities');await page.getByRole('button',{name:'Hủy',exact:true}).click();
 await page.goto(base+'/app/inventory');await page.getByRole('row').filter({hasText:'INV-M'}).getByRole('button',{name:'Kiểm kê',exact:true}).click();await page.getByLabel('Số lượng phiếu kho',{exact:true}).fill('0');let count;
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/post_stock_count',async route=>{count=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:'{"count_id":"synthetic-zero"}'});});
 await page.getByRole('button',{name:'Lưu phiếu kho',exact:true}).click();await page.getByText('Đã ghi phiếu. Tồn kho và lịch sử đã được cập nhật.',{exact:true}).waitFor();
 if(count?.p_lines[0].counted_quantity!=='0'||count.p_inventory_version!=='123')throw new Error('Zero count/token not retained');
 await page.goto(base+'/app/inventory');
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('Tồn kho');
 sheet.addRow(['Mã / vật tư','Tên vật tư','Nhóm','ĐVT chuẩn','Tồn hiện tại','Tối thiểu','Giá trung bình (đ / ĐVT chuẩn)','Số lượng nhập thêm','Giá nhập thêm (đ / ĐVT chuẩn)']);
 sheet.addRows([
  ['INV-M','Vật tư kiểm thử nhập kho','Nguyên liệu','kg','','3','3000','1.2','0'],
  ['INV-U','Vật tư nhập chưa rõ giá','Phụ liệu','kg','','','','3.32',''],
  ['INV-C','Vật tư chỉ cập nhật danh mục','Nguyên liệu','kg','','','','',''],
 ]);
 const importFile={name:'nhap-ton-kiem-thu.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await workbook.xlsx.writeBuffer())},importSent=[];
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/import_inventory_excel',async route=>{importSent.push(route.request().postDataJSON());await route.fulfill({status:200,contentType:'application/json',body:'{"movement_id":"synthetic-excel-receipt","materials_created":1,"materials_updated":2,"receipt_lines":2}'});});
 await page.locator('input[aria-label="Chọn file Excel tồn kho"]').setInputFiles(importFile);
 const importDialog=page.getByRole('dialog');await page.getByText('Tồn cũ không bị ghi đè.',{exact:false}).waitFor();
 if(!(await importDialog.getByText('4,52 kg',{exact:true}).count())||!(await importDialog.getByText('1 dòng nhập chưa có giá.',{exact:false}).count()))throw new Error('Import preview totals or missing-price warning are missing');
 const zeroPriceRow=importDialog.locator('tbody tr').filter({hasText:'INV-M'});if(!(await zeroPriceRow.innerText()).includes('0 đ'))throw new Error('An explicit zero receipt price is not distinguished from an unknown price');
 for(const width of [320,1440]){
  await page.setViewportSize({width,height:900});
  const bounds=await importDialog.boundingBox();
  if(!bounds||bounds.x<0||bounds.x+bounds.width>width+1||bounds.y<0||bounds.y+bounds.height>901)throw new Error('Excel import preview is clipped at '+width+': '+JSON.stringify(bounds));
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Excel import preview causes page overflow at '+width);
  await page.screenshot({path:path.join(out,'import-preview-'+width+'.png')});
 }
 await importDialog.getByRole('button',{name:'Xác nhận nhập kho',exact:true}).click();
 await page.getByText('Đã nhập Excel: 1 mã mới, 2 mã đã có, 2 vật tư được cộng tồn.',{exact:true}).waitFor();
 if(importSent.length!==1||importSent[0].p_lines.length!==3||importSent[0].p_lines[0].added_quantity!=='1.2'||importSent[0].p_lines[1].added_quantity!=='3.32'||importSent[0].p_lines[0].unit_cost!=='0'||importSent[0].p_lines[1].unit_cost!==null||importSent[0].p_lines[2].added_quantity!==null)throw new Error('Excel confirmation changed fractional additive quantities, explicit-zero/unknown price or catalog-only lines');
 report.checks.push('Excel import preview accepts and totals decimal additions 1.2 and 3.32; confirmation preserves both quantities, null/zero price distinction and catalog-only line; responsive modal fits at 320/1440 with no page overflow');
 report.checks.push('Inventory catalogue, movements, material-filtered receipt price history, reorder, entry at 5 widths; sole warehouse; empty warehouse guidance; decimal receipt retry preserves payload/key; insufficient stock error displays material, date, requested/available/shortage quantities without raw DB code; receipt correction retains selected line/reason; confirmed zero count with inventory token; no overflow or duplicate tabs');
 await page.goto(base+'/app/warehouses');await page.getByText('V\u1eadt t\u01b0 ki\u1ec3m th\u1eed nh\u1eadp kho',{exact:true}).waitFor();
 report.checks.push('Warehouse catalogue redirects to inventory; ingredient warehouse is resolved automatically without selector');
}

export async function checkOrders(page,base,out,report){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
 const orderId='90000000-0000-4000-8000-000000000001',deliveryId='90000000-0000-4000-8000-000000000002',deliveryItemId='90000000-0000-4000-8000-000000000003',orderItemId='90000000-0000-4000-8000-000000000004',productId='90000000-0000-4000-8000-000000000005',warehouseId='90000000-0000-4000-8000-000000000008';
 let delivered=false,settlementRequest=null,returnRequest=null,summaryOpened=false,invoiceLines=null,includeDirectWholeOrders=true;
 const pendingOrderId='a0000000-0000-4000-8000-000000000001';
 const summaryStores=Array.from({length:12},(_,index)=>({
  id:index===0?'90000000-0000-4000-8000-000000000006':`a0000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
  code:`STORE-${index+1}`,
  name:index===0?'Điểm bán kiểm thử':`Điểm thử ${index+1}`,
  phone:null
 }));
 const expectedSummaryProducts=[
  ['CN-XXPM','Cơm nắm xúc xích chà bông phô mai'],
  ['CN-XXMY','Cơm nắm xúc xích chà bông mayo'],
  ['CN-TERI','Cơm nắm gà sốt Teriyaki'],
  ['CN-GPM','Cơm nắm gà sốt phô mai'],
  ['CN-BV','Cơm nắm bò viên sốt bơ tỏi'],
  ['CN-CNM','Cơm nắm cá ngừ mayo'],
  ['CC','Cơm cuộn thường'],
  ['CCC','Cơm cuộn chiên'],
  ['CN-MY','Mì trộn Chifaa'],
  ['CC-NC','Cơm cuộn TT (nguyên cây)'],
  ['CCC-NC','Cơm cuộn chiên (nguyên cây)']
 ].map(([code,name],index)=>({
  product_id:`b0000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
  code,name,unit:index>=9?'cây':'phần',total_quantity:String(index+2),
  by_store:Object.fromEntries(summaryStores.map((store,storeIndex)=>[store.id,storeIndex===0?String(index+1):storeIndex===index+1?'1':'0']))
 }));
 // The aggregate deliberately arrives in reverse order to exercise the report's SKU ordering.
 const summaryProducts=[...expectedSummaryProducts].reverse(),summaryQuantity=expectedSummaryProducts.reduce((sum,product)=>sum+Number(product.total_quantity),0);
 const mainProducts=[...expectedSummaryProducts.slice(0,8),expectedSummaryProducts[10],expectedSummaryProducts[9],expectedSummaryProducts[8]];
 const quantityText=value=>new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(value);
 const wholeRows=[{portion:mainProducts[6],whole:expectedSummaryProducts[9],factor:12/14},{portion:mainProducts[7],whole:expectedSummaryProducts[10],factor:16/10}];
 const expectedMatrixRows=[...mainProducts.map((product,index)=>[String(index+1),product.name,...summaryStores.map(store=>product.by_store[store.id]==='0'?'':product.by_store[store.id]),product.total_quantity]),...wholeRows.map(({portion,whole,factor})=>['#',whole.name,...summaryStores.map(store=>{const quantity=Number(whole.by_store[store.id])+Number(portion.by_store[store.id])*factor;return quantity===0?'':quantityText(quantity);}),quantityText(Number(whole.total_quantity)+Number(portion.total_quantity)*factor)])];
 const expectedMatrixTotals=['TỔNG SỐ LƯỢNG',...summaryStores.map(store=>String(mainProducts.reduce((sum,product)=>sum+Number(product.by_store[store.id]),0))),String(mainProducts.reduce((sum,product)=>sum+Number(product.total_quantity),0))];
 async function assertSummaryMatrix(mode){
  const matrix=await page.locator('.order-summary-matrix-table').evaluate(table=>({
   rows:[...table.querySelectorAll('tbody tr:not(.order-summary-total-row)')].map(row=>[...row.querySelectorAll('td')].map(cell=>cell.textContent.trim())),
   totals:[...table.querySelectorAll('.order-summary-total-row th')].map(cell=>cell.textContent.trim())
  }));
  if(JSON.stringify(matrix.rows)!==JSON.stringify(expectedMatrixRows)||JSON.stringify(matrix.totals)!==JSON.stringify(expectedMatrixTotals))throw new Error(`Order summary ${mode} must preserve all per-store quantities and totals in the requested SKU order: ${JSON.stringify(matrix)}`);
  return matrix;
 }
 const order=()=>({id:orderId,version:delivered?2:1,store_id:'90000000-0000-4000-8000-000000000006',customer_id:'90000000-0000-4000-8000-000000000007',delivery_date:today,shift:'AM',status:delivered?'fulfilled':'approved',note:null,guest_name:null,guest_phone:null,guest_address:null,store_code:'STORE-1',store_name:'Điểm bán kiểm thử'});
 const summaryOrder=(id,status)=>({id,code:id.slice(0,8),store_id:'90000000-0000-4000-8000-000000000006',store_code:'STORE-1',store_name:'Điểm bán kiểm thử',store_phone:'0900000000',customer_name:null,customer_phone:'0900000000',delivery_date:today,shift:'AM',status,note:null,total_quantity:'10',discount_rate:'0.1',discount_vnd:'25000',order_total_vnd:'225000',old_deduction_vnd:'0',cancelled_loss_vnd:'0',cash_received_vnd:'0',bank_received_vnd:'0',payment_method:'Chưa ghi nhận',outstanding_vnd:null,items:[{product_id:productId,code:'MON-1',name:'Món kiểm thử',quantity:'10',unit:'phần',price_vnd:'25000',discount_rate:'0.1',line_total_vnd:'225000'}]});
 const detail=()=>({order_id:orderId,order_status:delivered?'fulfilled':'approved',return_credit_available_vnd:'0',delivery:delivered?{id:deliveryId,delivery_date:today,status:'posted',version:'1'}:null,items:invoiceLines??[{order_item_id:orderItemId,product_id:productId,product_code:'MON-1',product_name:'Món kiểm thử',sale_unit:'phần',ordered_quantity:'10',price_vnd:'25000',discount_rate:'0.1',available_quantity:'25',delivery_item_id:delivered?deliveryItemId:null,delivered_quantity:delivered?'10':'0',returned_quantity:'0'}],return_supports:[]});
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/order_review_queue',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([order(),{...order(),id:pendingOrderId,status:'submitted'}])}));
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/order_delivery_detail',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(detail())}));
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/fulfill_order_delivery_settle',async route=>{settlementRequest=route.request().postDataJSON();if(settlementRequest.p_order!==orderId||settlementRequest.p_method!=='receivable'||settlementRequest.p_paid_vnd!==0||!settlementRequest.p_key)throw new Error('Delivery settlement did not send the selected order and receivable method');delivered=true;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({order_id:orderId,delivery_id:deliveryId,sales_document_id:'90000000-0000-4000-8000-000000000009',receivable_id:'90000000-0000-4000-8000-000000000010',revenue_vnd:'225000',old_deduction_vnd:'0',paid_vnd:'0',outstanding_vnd:'225000',payment_method:'receivable',status:'fulfilled'})});});
 await page.route('https://visual-fixture.supabase.co/rest/v1/warehouses**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:warehouseId,code:'KIOSK',name:'Kho ki-ốt',kind:'kiosk',active:true}])}));
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/record_order_return_event',async route=>{returnRequest=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({support_id:'90000000-0000-4000-8000-000000000011',delivery_id:deliveryId,total_support_vnd:'30002',disposition:'returned',inventory_received:true,credit_next_order:true})});});
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/order_customer_summary',async route=>{summaryOpened=true;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({date:today,planned_quantity_total:String(summaryQuantity),stores:summaryStores,orders:[summaryOrder(orderId,delivered?'fulfilled':'approved'),summaryOrder(pendingOrderId,'submitted')],products:includeDirectWholeOrders?summaryProducts:summaryProducts.filter(product=>!['CC-NC','CCC-NC'].includes(product.code))})});});
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/order_material_demand',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({date:today,products:[],issues:[],materials:[{code:'GAO',name:'Gạo kiểm thử',unit_code:'kg',quantity:'1.25',stock_quantity:'3',minimum_quantity:'1',shortage_quantity:'0',status:'ok'}]})}));
 await page.goto(base+'/app/orders');await page.evaluate(()=>document.fonts.ready);
 await page.getByRole('button',{name:'Chi tiết đơn 90000000',exact:true}).waitFor();
 const orderTable=await page.locator('.order-review-table').innerText(),expectedHeaders=['Mã','Điểm bán · số điện thoại','Ngày giao','Tổng SL','Mức chiết khấu','Chi tiết món','Trừ tiền đơn cũ','Hủy / lỗ','Tổng thanh toán','CK hoặc tiền mặt','Ghi chú'];if(expectedHeaders.some(header=>!orderTable.includes(header))||!orderTable.includes('225.000 đ'))throw new Error('Outer order table does not show the requested columns and order totals');
 await page.getByRole('button',{name:'Duyệt đơn a0000000',exact:true}).waitFor();await page.getByRole('button',{name:'Từ chối đơn a0000000',exact:true}).waitFor();
 await page.screenshot({path:out+'/order-list-desktop.png',animations:'disabled'});
 await page.setViewportSize({width:390,height:844});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Outer order table overflows mobile viewport');
 await page.screenshot({path:out+'/order-list-mobile.png',animations:'disabled'});
 await page.setViewportSize({width:1280,height:900});
 await page.getByRole('button',{name:'Chi tiết đơn 90000000',exact:true}).click();
 await page.getByRole('button',{name:'Xác nhận đã giao đủ',exact:true}).waitFor();
 if(!(await page.getByRole('dialog').innerText()).includes('Tồn thành phẩm'))throw new Error('Order detail does not show available finished goods');
 const heading=await page.locator('.page-heading').innerText();if(!heading.includes('không trừ lần hai'))throw new Error('Order page does not explain ingredient stock timing: '+heading);
 await page.getByRole('button',{name:'Xác nhận đã giao đủ',exact:true}).click();
 await page.getByRole('button',{name:'Giao hàng và ghi nhận',exact:true}).waitFor();
 await page.getByRole('button',{name:'Giao hàng và ghi nhận',exact:true}).click();
 await page.getByRole('button',{name:'Nhận hàng trả về kiosk',exact:true}).waitFor();
 if(!delivered||settlementRequest?.p_method!=='receivable')throw new Error('Delivery did not create the selected receivable settlement');
 await page.getByRole('button',{name:'Nhận hàng trả về kiosk',exact:true}).click();
 await page.getByLabel('Kho kiosk nhận hàng').selectOption(warehouseId);
 await page.getByLabel('Lý do / ghi chú').fill('Nhận hàng trả lại, kiểm tra ngoại quan đạt');
 await page.getByLabel('Số lượng trả Món kiểm thử').fill('2');
 await page.getByLabel('Cách tính giá thu hồi Món kiểm thử').selectOption('discount');
 await page.getByLabel('Chiết khấu thu hồi phần trăm Món kiểm thử').fill('33.33');
 await page.screenshot({path:out+'/order-return-support-desktop.png',animations:'disabled'});
 await page.setViewportSize({width:390,height:844});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Order return form overflows mobile viewport');
 await page.screenshot({path:out+'/order-return-support-mobile.png',animations:'disabled'});
 await page.getByRole('button',{name:'Xác nhận nhận hàng và cấn đơn sau',exact:true}).click();
 await page.getByText(/Đã nhận 30\.002 đ giá trị hàng trả/).waitFor();
 if(returnRequest?.p_delivery!==deliveryId||returnRequest?.p_disposition!=='returned'||returnRequest?.p_warehouse!==warehouseId||returnRequest?.p_lines?.[0]?.quantity!=='2'||returnRequest?.p_lines?.[0]?.pricing_mode!=='discount'||returnRequest?.p_lines?.[0]?.discount_rate!=='0.3333')throw new Error('Return form did not submit actual receipt, quantity, and exact discount rate');
 await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
 await page.setViewportSize({width:1280,height:900});
 await page.getByRole('button',{name:'Xem bảng tổng hợp khách đặt hàng',exact:true}).click();
 await page.getByRole('heading',{name:'Bảng tổng hợp khách đặt hàng',exact:true}).waitFor();
 await page.getByRole('button',{name:'Xuất Excel',exact:true}).waitFor();await page.getByRole('button',{name:'In bảng',exact:true}).waitFor();
 await page.locator('.order-summary-stats').waitFor();
 const summaryCounts=await page.locator('.order-summary-stats span').allTextContents();if(JSON.stringify(summaryCounts)!==JSON.stringify(['2 đơn','11 món','12 điểm bán']))throw new Error('Order summary overview counts are missing: '+JSON.stringify(summaryCounts));
 await page.locator('.order-summary-matrix-table').waitFor();await page.getByText('Gạo kiểm thử',{exact:true}).waitFor();
 const screenMatrix=await assertSummaryMatrix('screen'),materialText=await page.locator('.order-summary-material-table').innerText();if(!materialText.includes('Gạo kiểm thử')||!materialText.includes('1,25'))throw new Error('Order summary ingredient demand is missing from the popup');
 const summaryDesktop=await page.locator('.order-summary-dialog').evaluate(dialog=>{const r=dialog.getBoundingClientRect(),wrap=dialog.querySelector('.order-summary-matrix-table')?.parentElement,logo=dialog.querySelector('.order-summary-print-header');return {left:r.left,right:r.right,width:r.width,viewport:innerWidth,tableScrolls:!!wrap&&wrap.scrollWidth>wrap.clientWidth,totalVisible:!!wrap&&dialog.querySelector('.order-summary-matrix-table thead tr:first-child th:last-child').getBoundingClientRect().right<=wrap.getBoundingClientRect().right+1,logoDisplay:logo?getComputedStyle(logo).display:'missing'};});
 if(summaryDesktop.left<0||summaryDesktop.right>summaryDesktop.viewport||summaryDesktop.width<summaryDesktop.viewport*.85||!summaryDesktop.totalVisible||summaryDesktop.logoDisplay!=='none')throw new Error('Order summary desktop width, bounds, total column, or print-only logo is incorrect: '+JSON.stringify(summaryDesktop)); await page.screenshot({path:out+'/order-summary-desktop.png',animations:'disabled'});
 await page.setViewportSize({width:390,height:844});
 const summaryMobile=await page.locator('.order-summary-dialog').evaluate(dialog=>{const r=dialog.getBoundingClientRect(),wrap=dialog.querySelector('.order-summary-matrix-table')?.parentElement,hint=dialog.querySelector('.order-summary-swipe-hint');return {left:r.left,right:r.right,width:r.width,viewport:innerWidth,bodyWidth:document.documentElement.scrollWidth,tableScrolls:!!wrap&&wrap.scrollWidth>wrap.clientWidth,hintVisible:!!hint&&getComputedStyle(hint).display!=='none'};});
 if(summaryMobile.left<0||summaryMobile.right>summaryMobile.viewport||summaryMobile.bodyWidth>summaryMobile.viewport+1||!summaryMobile.tableScrolls||!summaryMobile.hintVisible)throw new Error('Order summary mobile dialog, table scroll, or hint is incorrect: '+JSON.stringify(summaryMobile));
 await page.screenshot({path:out+'/order-summary-mobile.png',animations:'disabled'});
 await page.setViewportSize({width:320,height:768});
 const summaryNarrow=await page.locator('.order-summary-dialog').evaluate(dialog=>{const r=dialog.getBoundingClientRect(),actions=dialog.querySelector('.order-summary-actions');return {left:r.left,right:r.right,width:r.width,viewport:innerWidth,bodyWidth:document.documentElement.scrollWidth,actionsOverflow:!!actions&&actions.scrollWidth>actions.clientWidth+1};});
 if(summaryNarrow.left<0||summaryNarrow.right>summaryNarrow.viewport||summaryNarrow.bodyWidth>summaryNarrow.viewport+1||summaryNarrow.actionsOverflow)throw new Error('Order summary narrow-mobile controls overflow the viewport: '+JSON.stringify(summaryNarrow));
 await page.setViewportSize({width:1123,height:794});
 await page.emulateMedia({media:'print'});
 const printMatrix=await assertSummaryMatrix('print');
 await page.screenshot({path:out+'/order-summary-print.png',fullPage:true,animations:'disabled'});
 const summaryPdf=await page.pdf({path:out+'/order-summary-print.pdf',format:'A4',landscape:true,preferCSSPageSize:true,printBackground:false});
 const summaryPdfPages=(summaryPdf.toString('latin1').match(/\/Type\s*\/Page\b/g)??[]).length;
 if(summaryPdfPages!==1)throw new Error('The 11-dish customer summary plus 2 whole-roll totals and materials must fit one A4 landscape page: '+summaryPdfPages);
 report.checks.push({customerSummaryPdfPages:summaryPdfPages,paper:'A4 landscape',mainProducts:mainProducts.map(product=>product.code),wholeRollTotalsAfterGrandTotal:true});
 if(JSON.stringify(printMatrix)!==JSON.stringify(screenMatrix))throw new Error('Print matrix order and all quantities must match the screen matrix');
 const printState=await page.locator('.order-summary-dialog').evaluate(dialog=>{const report=dialog.querySelector('.order-summary-print'),content=dialog.querySelector('.order-summary-content'),table=dialog.querySelector('.order-summary-matrix-table'),header=dialog.querySelector('.order-summary-print-header'),backdrop=dialog.closest('.modal-backdrop');return {logo:getComputedStyle(header).display,matrix:getComputedStyle(table).display,materials:getComputedStyle(dialog.querySelector('.order-summary-material-table')).display,dialogMaxHeight:getComputedStyle(dialog).maxHeight,dialogOverflow:getComputedStyle(dialog).overflow,contentOverflow:getComputedStyle(content).overflow,reportPosition:getComputedStyle(report).position,backdropPosition:getComputedStyle(backdrop).position,tableHeader:getComputedStyle(table.querySelector('thead')).display,reportTop:report.getBoundingClientRect().top,headerTop:header.getBoundingClientRect().top};});if(printState.logo==='none'||printState.matrix==='none'||printState.materials==='none'||printState.dialogMaxHeight!=='none'||printState.dialogOverflow!=='visible'||printState.contentOverflow!=='visible'||printState.reportPosition!=='static'||printState.backdropPosition!=='absolute'||printState.tableHeader!=='table-header-group'||printState.reportTop>20||Math.abs(printState.reportTop-printState.headerTop)>1)throw new Error('Print layout must start at the page top with the report header, flow at natural height, repeat table headings, and include ingredient demand: '+JSON.stringify(printState));await page.emulateMedia({media:'screen'});
 if(!summaryOpened)throw new Error('Order summary did not load the server-side aggregate');
 report.pages.push({route:'orders',width:390,orderId,deliverySettled:delivered,returnSubmitted:true,summaryOpened,summaryProductOrder:expectedSummaryProducts.map(product=>product.code),summaryQuantity,summaryMatrixRows:screenMatrix.rows.length,summaryPrintMatches:true,summaryDesktop:summaryDesktop.width,desktopViewport:summaryDesktop.viewport,summaryMobile:summaryMobile.width,summaryNarrow:summaryNarrow.width,overflow:false});
 includeDirectWholeOrders=false;await page.reload();await page.getByRole('button',{name:'Xem bảng tổng hợp khách đặt hàng',exact:true}).click();await page.locator('.order-summary-matrix-table tbody tr').nth(9).waitFor();
 const unorderedWholeRows=await page.locator('.order-summary-matrix-table tbody tr').evaluateAll(rows=>rows.filter(row=>['9','10'].includes(row.firstElementChild?.textContent.trim())).map(row=>[...row.cells].map(cell=>cell.textContent.trim())));
 if(unorderedWholeRows.length!==2||unorderedWholeRows[0][1]!=='Cơm cuộn chiên nguyên cây'||unorderedWholeRows[1][1]!=='Cơm cuộn nguyên cây'||unorderedWholeRows.some(row=>row.slice(2,-1).some(value=>value!=='')||row.at(-1)!=='0'))throw new Error('Unordered whole rolls must stay visible as rows 9/10 with empty store quantities: '+JSON.stringify(unorderedWholeRows));
 const convertedWholeRows=await page.locator('.order-summary-matrix-table tbody tr').evaluateAll(rows=>rows.filter(row=>row.firstElementChild?.textContent.trim()==='#').map(row=>row.lastElementChild.textContent.trim()));
 if(convertedWholeRows.length!==2||convertedWholeRows.some(value=>value==='0'))throw new Error('Portion conversion was copied into direct order rows or lost from # totals');
 report.checks.push('Direct whole rolls remain visible after dish eight when not ordered; only # rows contain portion conversion');includeDirectWholeOrders=true;
 // Print-only invoice must keep the reference menu and the order's real snapshot values.
 invoiceLines=[...expectedSummaryProducts].reverse().map((product,index)=>({order_item_id:product.product_id,product_id:product.product_id,product_code:product.code,product_name:product.name,sale_unit:product.unit,ordered_quantity:'2',price_vnd:product.code==='CC-NC'?'10000':product.code==='CCC-NC'?'11000':'15000',discount_rate:index%2?'0.15':'0.17',available_quantity:'25',delivery_item_id:null,delivered_quantity:'0',returned_quantity:'0'}));
 // Reload again so the fixture detail cannot reuse the earlier cached order lines.
 await page.reload();
 await page.getByRole('button',{name:'Chi tiết đơn 90000000',exact:true}).click();
 await page.getByRole('button',{name:'In phiếu đơn',exact:true}).waitFor();
 await page.locator('.sales-invoice tbody tr[data-product-code]').first().waitFor({state:'attached'});
 if(await page.locator('.sales-invoice').isVisible())throw new Error('Invoice must be hidden outside print');
 await page.setViewportSize({width:506,height:740});await page.emulateMedia({media:'print'});
 const screenOrderCodes=await page.locator('.modal .table-wrap table tbody tr td:first-child small').allTextContents();
 if(JSON.stringify(screenOrderCodes)!==JSON.stringify(expectedSummaryProducts.map(product=>product.code)))throw new Error('Order detail must sort snapshot items before display, including cached items: '+JSON.stringify(screenOrderCodes));
 const invoice=page.locator('.sales-invoice');
 await page.screenshot({path:out+'/sales-invoice-print.png',fullPage:true,animations:'disabled'});
 report.invoiceGeometry=await invoice.evaluate(sheet=>[...sheet.children].map(child=>({tag:child.tagName,class:child.className,height:child.getBoundingClientRect().height,style:getComputedStyle(child).padding,rows:[...child.querySelectorAll('tr')].map(row=>({height:row.getBoundingClientRect().height,padding:getComputedStyle(row.firstElementChild).padding,font:getComputedStyle(row.firstElementChild).fontSize}))})));
 const invoiceState=await invoice.evaluate(sheet=>({codes:[...sheet.querySelectorAll('tr[data-product-code]')].map(row=>row.dataset.productCode),height:sheet.getBoundingClientRect().height,width:sheet.getBoundingClientRect().width,totalColor:getComputedStyle(sheet.querySelector('.sales-invoice-total th')).backgroundColor,font:getComputedStyle(sheet).fontFamily,head:getComputedStyle(sheet.querySelector('thead')).display,totals:sheet.querySelectorAll('.sales-invoice-total').length,text:sheet.innerText,overflow:[...sheet.querySelectorAll('td,th')].some(cell=>cell.scrollWidth>cell.clientWidth+1)}));
 if(JSON.stringify(invoiceState.codes)!==JSON.stringify(expectedSummaryProducts.map(product=>product.code))||invoiceState.height>740||invoiceState.overflow||invoiceState.totalColor!=='rgb(255, 255, 0)'||!invoiceState.font.includes('Times New Roman')||invoiceState.totals!==1||!invoiceState.text.includes('HOÁ ĐƠN BÁN HÀNG')||!invoiceState.text.includes('CK thương mại 15%')||!invoiceState.text.includes('CK thương mại 17%')||!invoiceState.text.includes('BÊN NHẬN HÀNG'))throw new Error('Invoice layout/order failed: '+JSON.stringify(invoiceState));
 await page.screenshot({path:out+'/sales-invoice-print.png',fullPage:true,animations:'disabled'});
 const pdf=await page.pdf({path:out+'/sales-invoice-print.pdf',preferCSSPageSize:true,printBackground:false});
 const pdfPages=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)??[]).length;
 if(pdfPages!==1)throw new Error('Standard 11-item invoice must print on one A5 portrait page, got '+pdfPages);
 const mediaBox=pdf.toString('latin1').match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);
 if(!mediaBox||Math.abs(Number(mediaBox[1])-420)>2||Math.abs(Number(mediaBox[2])-595)>2)throw new Error('Invoice PDF must use A5 portrait: '+mediaBox);
 // Allow wrapping of real customer fields instead of clipping or shrinking the whole invoice.
 await invoice.evaluate(sheet=>{
  const fields=sheet.querySelectorAll('.sales-invoice-customer span');
  fields[0].textContent='Điểm bán kiểm thử tên dài – Cửa hàng cơm nắm và thực phẩm mang đi';
  fields[1].textContent='Địa chỉ kiểm thử: số 123 đường nội bộ, khu dân cư phía đông, phường Bồng Sơn, tỉnh Gia Lai';
  const note=document.createElement('div');note.className='sales-invoice-note';note.textContent='Ghi chú kiểm thử: giao đủ món theo đơn, liên hệ người nhận trước khi giao và kiểm tra số lượng tại điểm bán.';
  sheet.querySelector('.sales-invoice-date').before(note);
 });
 const longFields=await invoice.evaluate(sheet=>({height:sheet.getBoundingClientRect().height,overflow:[...sheet.querySelectorAll('td,th,.sales-invoice-customer span,.sales-invoice-note')].some(cell=>cell.scrollWidth>cell.clientWidth+1)}));
 if(longFields.height>740||longFields.overflow)throw new Error('Long customer fields overflow A5 invoice: '+JSON.stringify(longFields));
 const longPdf=await page.pdf({path:out+'/sales-invoice-a5-long-fields.pdf',preferCSSPageSize:true,printBackground:false});
 if((longPdf.toString('latin1').match(/\/Type\s*\/Page\b/g)??[]).length!==1)throw new Error('A5 invoice with long customer fields must fit on one page');
 await page.emulateMedia({media:'screen'});
 report.checks.push({salesInvoice:invoiceState,pdfPages,paper:'A5 portrait',longFields,fixtureOnly:true});
 report.checks.push('order details show finished stock, settlement records a receivable, return receipt captures kiosk, quantity and exact fractional discount, and aggregate sorts 11 reversed SKU fixtures into the requested product order with every store quantity and total preserved on screen and print, compact counts, ingredient demand, bounded 320px/mobile/desktop layouts, and scrollable matrix; fixture-only network responses');
}

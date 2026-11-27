import path from 'node:path';

export async function checkStoreProduction(page,base,out,report){
 const date='2095-04-12',writes=[];
 let mode='shortage',stock='7',recipeIssue=null,ready=false,uncertain=false;
 const product={product_id:'sp-p',code:'CC',name:'Cơm cuộn thử nghiệm',unit:'Hộp',required_quantity:'12',available_quantity:'7',shortage_quantity:'5'};
 const respond=(route,payload,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(payload)});
 await page.route('**/rest/v1/rpc/order_customer_summary',route=>respond(route,{orders:[{id:'sp-o',code:'SYN-ORDER',status:'approved',store_id:'sp-s',store_name:'Điểm bán thử nghiệm',store_code:'SYN-S',shift:'AM',order_total_vnd:'180000',items:[{...product,quantity:'12',line_total_vnd:'180000'}]}]}));
 await page.route('**/rest/v1/rpc/store_production_readiness',route=>respond(route,ready?{'sp-s':{status:'ready',created_at:date,note:'Synthetic ready'}}:{}));
 await page.route('**/rest/v1/rpc/production_options',route=>respond(route,{warehouses:[{id:'pm-w',name:'Kho thử nghiệm'}]}));
 await page.route('**/rest/v1/rpc/production_material_workspace',route=>respond(route,{products:[{id:'sp-p',code:'CC',name:product.name,recipe_version_id:'sp-v',recipe_issue:recipeIssue}]}));
 await page.route('**/rest/v1/rpc/store_production_diagnostics',route=>mode==='unavailable'?respond(route,{code:'PGRST202',message:'Synthetic missing function'},404):respond(route,{products:[{...product,available_quantity:stock,shortage_quantity:stock==='7'?'5':'0'}],stores:{'sp-s':[{...product,available_quantity:stock,shortage_quantity:stock==='7'?'5':'0'}]}}));
 for(const name of ['confirm_store_production_ready','confirm_all_store_production_ready']){
  await page.route('**/rest/v1/rpc/'+name,route=>{
   writes.push({name,args:route.request().postDataJSON()});
   if(mode==='forbidden')return respond(route,{code:'P0001',message:'FORBIDDEN'},400);
   if(stock==='7')return respond(route,{code:'P0001',message:'INSUFFICIENT_FINISHED_GOODS',details:JSON.stringify({store_name:name==='confirm_all_store_production_ready'?'tất cả điểm bán':'Điểm bán thử nghiệm',products:[product]})},400);
   ready=true;return respond(route,{status:'ready',stores_confirmed:1});
  });
 }
 await page.route('**/rest/v1/rpc/complete_store_production_for_delivery',route=>{
  writes.push({name:'complete_store_production_for_delivery',args:route.request().postDataJSON()});
  if(mode==='forbidden')return respond(route,{code:'P0001',message:'FORBIDDEN'},400);
  if(stock==='7')return respond(route,{code:'P0001',message:'INSUFFICIENT_FINISHED_GOODS',details:JSON.stringify({store_name:'Điểm bán thử nghiệm',products:[product]})},400);
  if(mode==='uncertain'&&!uncertain){uncertain=true;return route.abort();}
  if(mode==='raw-shortage')return respond(route,{code:'P0001',message:'INSUFFICIENT_STOCK',details:JSON.stringify({material_code:'GA',material_name:'Gà thử nghiệm',unit_code:'kg',transaction_date:date,requested_quantity:'3',available_quantity:'1',shortage_quantity:'2'})},400);
  ready=true;return respond(route,{status:'ready',production:{batch_id:'sp-b'},readiness:{status:'ready'}});
 });
 const load=async()=>{await page.goto(base+'/app/store-production-check?date='+date);await page.getByRole('button',{name:'Chi tiết',exact:true}).click();await page.locator('.store-production-detail-row').waitFor();};
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});await load();
  await page.getByText('Thiếu thành phẩm: 1 món',{exact:true}).waitFor();
  if(await page.locator('.store-production-shortage-summary details[open],.store-production-store-shortages[open]').count())throw Error('Shortage item details should start collapsed');
  const layout=await page.locator('.store-production').evaluate(root=>{const summary=root.querySelector('.store-production-summary-table-wrap'),detailRow=root.querySelector('.store-production-detail-row'),detailTable=root.querySelector('.store-production-detail-table-wrap'),hint=root.querySelector('.store-production-scroll-hint');if(!summary||!detailRow||!detailTable||!hint)throw Error('Missing store production detail layout hooks');const expandedRow=root.querySelector('.store-production-table button[aria-expanded="true"]')?.closest('tr');return {summaryMinHeight:getComputedStyle(summary).minHeight,detailMinHeight:getComputedStyle(detailTable).minHeight,attached:detailRow.previousElementSibling===expandedRow,summaryScrolls:summary.scrollWidth>summary.clientWidth+1,detailScrolls:detailTable.scrollWidth>detailTable.clientWidth+1,hintVisible:getComputedStyle(hint).display!=='none',shortageCollapsed:!root.querySelector('.store-production-store-shortages')?.open};});
  if(layout.summaryMinHeight!=='0px'||layout.detailMinHeight!=='0px'||!layout.attached||!layout.shortageCollapsed)throw Error('Store production detail is not attached to its row or shortage details are expanded at '+width+'px: '+JSON.stringify(layout));
  if(width===390&&(layout.summaryScrolls||!layout.detailScrolls||!layout.hintVisible))throw Error('Mobile production summary/detail layout is not usable: '+JSON.stringify(layout));
  if(await page.getByLabel('main Cơm cuộn thử nghiệm SYN-S').inputValue()!=='')throw Error('Actual production should require explicit completion confirmation');
  if(await page.getByLabel('defect Cơm cuộn thử nghiệm SYN-S').inputValue()!=='')throw Error('Unknown defects silently became zero');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Store production overflows viewport '+width);
  await page.screenshot({path:path.join(out,'store-production-'+width+'.png'),fullPage:true});report.pages.push({slug:'store-production',width,overflow:false});
 }
 report.checks.push('Store detail opens directly under its selected row; shortage item lists stay collapsed; the mobile summary remains readable and production inputs have a horizontal-scroll cue');
 const close=async()=>{while(await page.getByRole('button',{name:'Đóng thông báo',exact:true}).count())await page.getByRole('button',{name:'Đóng thông báo',exact:true}).first().click();};
 await page.getByRole('button',{name:'Duyệt tất cả điểm bán đủ tồn',exact:true}).click();await page.getByRole('alert').filter({hasText:'thiếu 5 Hộp'}).waitFor();report.checks.push('bulk readiness still blocks on shared finished-goods shortages');await close();
 await page.getByLabel('Xác nhận đã làm xong Điểm bán thử nghiệm',{exact:true}).check();
 for(const [key,value] of [['main','12'],['extra','0'],['defect','0']])if(await page.getByLabel(key+' Cơm cuộn thử nghiệm SYN-S',{exact:true}).inputValue()!==value)throw Error('Completion confirmation did not fill '+key+' from the approved order');
 if(await page.getByLabel('Bắt đầu').count()||await page.getByLabel('Kết thúc').count()||await page.getByLabel('Lý do / ghi chú').count())throw Error('Removed manual time/reason fields remain in the production form');
 await page.getByRole('button',{name:'Duyệt & sẵn sàng giao',exact:true}).click();await page.getByRole('alert').filter({hasText:'thiếu 5 Hộp'}).waitFor();await close();
 mode='uncertain';stock='12';await page.getByRole('button',{name:'Duyệt & sẵn sàng giao',exact:true}).click();await page.getByRole('alert').filter({hasText:'Kiểm tra kết nối'}).waitFor();await close();
 mode='raw-shortage';await page.getByRole('button',{name:'Duyệt & sẵn sàng giao',exact:true}).click();await page.getByRole('alert').filter({hasText:'GA · Gà thử nghiệm'}).filter({hasText:'thiếu 2 kg'}).waitFor();
 const completions=writes.filter(w=>w.name==='complete_store_production_for_delivery');if(completions.length!==3||completions[1].args.p_key!==completions[2].args.p_key)throw Error('Combined completion retry changed its idempotency key');
 if(completions[1].args.p_lines[0].main_quantity!=='12'||completions[1].args.p_lines[0].extra_quantity!=='0'||completions[1].args.p_lines[0].rejected_quantity!=='0')throw Error('Combined completion submitted unexpected quantities');await close();
 mode='forbidden';await page.getByRole('button',{name:'Duyệt & sẵn sàng giao',exact:true}).click();await page.getByRole('alert').filter({hasText:'thiếu quyền'}).waitFor();await close();
 mode='normal';await page.getByRole('button',{name:'Tải lại kiểm tra',exact:true}).click();await page.locator('.store-production-shortage-summary').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Duyệt & sẵn sàng giao',exact:true}).click();await page.getByRole('button',{name:'Đã duyệt hoàn tất',exact:true}).waitFor();
 if(!await page.getByRole('button',{name:'Đã duyệt hoàn tất',exact:true}).isDisabled())throw Error('Successful approval remains enabled');
 mode='unavailable';await page.goto(base+'/app/store-production-check?date='+date);await page.getByRole('alert').filter({hasText:'cập nhật SQL'}).waitFor();
 mode='normal';ready=false;recipeIssue='PRODUCT_RECIPE_RATIO_REQUIRED';await load();await page.getByRole('status').filter({hasText:'Thiếu tỷ lệ quy đổi'}).waitFor();
 report.checks.push('Store preparation: confirmation auto-fills approved quantities, one atomic action records production and readiness, shortages/permissions block writes, retry key is stable, and manual time/reason fields are removed');
}

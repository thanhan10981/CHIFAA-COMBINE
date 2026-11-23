import path from 'node:path';
export async function checkPublicPortal(page,base,out,report){
 await page.routeWebSocket('**',socket=>socket.close());
 const products=[{product_id:'public-rice',code:'CN',name:'Cơm nắm kiểm thử với tên dài trên màn hình điện thoại',sale_unit:'Phần',price_vnd:'15000'},{product_id:'public-roll',code:'CC',name:'Cơm cuộn kiểm thử',sale_unit:'Hộp',price_vnd:'25000'},{product_id:'public-missing',code:'CG',name:'Món công bố chưa có giá',sale_unit:'Phần',price_vnd:null}];
 let empty=false,priceChanged=false;const requests=[];
 await page.route('**/rest/v1/rpc/public_order_catalog',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rows:empty?[]:products,total:empty?'0':'3'})}));
 await page.route('**/rest/v1/rpc/public_order_catalog_linked',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rows:products.map(product=>({...product,discount_rate:'0.1'})),total:'3'})}));
 await page.route('**/rest/v1/rpc/submit_public_order_v2',async route=>{
  requests.push(route.request().postDataJSON());
  await route.fulfill({status:priceChanged?400:requests.length===1?503:200,contentType:'application/json',body:priceChanged?'{"code":"P0001","message":"PRICE_CHANGED"}':requests.length===1?'{}':'{"order_id":"public-synthetic-order","status":"submitted"}'});
 });
 await page.route('**/rest/v1/rpc/submit_store_link_order_v2',async route=>{requests.push(route.request().postDataJSON());await route.fulfill({status:200,contentType:'application/json',body:'{"order_id":"public-synthetic-order","status":"submitted"}'});});
 await page.route('**/rest/v1/stores*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'store-fixture',code:'GUEST-S',name:'Điểm nhận đơn kiểm thử'}])}));
 await page.route('**/rest/v1/rpc/public_order_links',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
 let createdLink;
 let reviewed;
 await page.route('**/rest/v1/rpc/create_public_order_link',async route=>{createdLink=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({link_id:'link-fixture',token:'a'.repeat(64),store_id:'store-fixture',store_code:'GUEST-S',store_name:'Điểm nhận đơn kiểm thử'})});});
 await page.route('**/rest/v1/rpc/review_public_order',async route=>{reviewed=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:'{"status":"approved"}'});});
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/portal');if(await page.locator('input[type=radio][name=payment_method]').count()!==2)throw new Error('Cash and bank transfer radio choices missing');
  if(await page.getByRole('link',{name:'Đơn điểm bán',exact:true}).count())throw new Error('Legacy store-order button is still shown on the public portal');
  await page.getByRole('heading',{name:products[0].name,exact:true}).waitFor();
  const columns=await page.locator('.public-products').evaluate(element=>getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length);
  const expectedColumns=width>1150?4:width>620?3:width>340?2:1;
  if(columns!==expectedColumns)throw new Error('Public product grid expected '+expectedColumns+' columns at '+width+'px, got '+columns);
  if(columns>1){const quantityRow=await page.locator('.public-product').evaluateAll(cards=>{const rows=cards.map(card=>({top:Math.round(card.getBoundingClientRect().top),bottom:card.querySelector('.public-quantity').getBoundingClientRect().bottom}));const firstTop=rows[0].top;const firstRow=rows.filter(row=>row.top===firstTop);return {count:firstRow.length,spread:Math.max(...firstRow.map(row=>row.bottom))-Math.min(...firstRow.map(row=>row.bottom))};});if(quantityRow.count<2||quantityRow.spread>1)throw new Error('Quantity controls must align at the bottom across each product row at '+width+'px: '+JSON.stringify(quantityRow));}
  if(width===320){await page.waitForFunction(()=>{const input=document.querySelector('input[type=hidden][name=shift]');const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',hourCycle:'h23'}).format(new Date()));return input?.value===(hour<12?'AM':'PM');});if(await page.getByLabel('Ca giao',{exact:true}).count()||await page.locator('input[type=hidden][name=shift]').count()!==1)throw new Error('Delivery shift must be hidden and derived from Vietnam time');report.checks.push('delivery shift is hidden and derived as AM/PM from Vietnam local time');}
  if(await page.getByRole('button',{name:'Đăng nhập',exact:true}).count()||await page.getByLabel('Điểm bán',{exact:true}).count())throw new Error('Public portal requires linked account');
  await page.getByRole('button',{name:'Tăng '+products[0].name,exact:true}).click();
  await page.getByLabel('Số lượng '+products[1].name,{exact:true}).fill('2');
  if(!await page.getByLabel('Số lượng '+products[2].name,{exact:true}).isDisabled())throw new Error('Unpriced dish can be ordered');
  if(!await page.locator('.public-total').innerText().then(value=>value.includes('65.000')))throw new Error('Basket total incorrect');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Public portal overflows '+width);
  if([390,1440].includes(width))await page.screenshot({path:path.join(out,'public-portal-'+width+'.png'),fullPage:true});
  report.checks.push('public portal '+width+': immediate menu, quantities, exact total, no login/store dependency, unpriced disabled, no overflow');
 }
 if(process.argv.includes('--catalog-only')){report.checks.push('catalog-only fixture exit before unrelated order review flows');return;}
 await page.getByLabel('Tên người nhận *',{exact:true}).fill('Khách kiểm thử');
 await page.getByLabel('Số điện thoại *',{exact:true}).fill('0900000035');
 await page.getByLabel('Địa chỉ / điểm giao *',{exact:true}).fill('Địa chỉ kiểm thử không phải dữ liệu thật');
 await page.getByRole('button',{name:'Gửi đơn đặt hàng',exact:true}).click();
 await page.getByRole('button',{name:'Kiểm tra lại lần gửi',exact:true}).waitFor();
 if(!await page.getByLabel('Tên người nhận *',{exact:true}).isDisabled())throw new Error('Uncertain submission fields are editable');
 await page.getByRole('button',{name:'Kiểm tra lại lần gửi',exact:true}).click();await page.getByText('Đã nhận đơn #public-s',{exact:true}).waitFor();
 if(requests.length!==2||JSON.stringify(requests[0])!==JSON.stringify(requests[1]))throw new Error('Guest retry changed the request/key');
 if(requests[0].p_items.some(item=>!['15000','25000'].includes(item.price_vnd)))throw new Error('Quote missing from submission');
 if(!['AM','PM'].includes(requests[0].p_shift))throw new Error('Hidden Vietnam shift is missing from the submitted order');
 report.checks.push('guest503/retry keeps identical request and idempotency key; confirmation only after server success');
 priceChanged=true;
 await page.getByRole('button',{name:'Tăng '+products[0].name,exact:true}).click();
 await page.getByRole('button',{name:'Gửi đơn đặt hàng',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Giá món vừa thay đổi'}).first().waitFor();
 if(await page.locator('.public-cart li').count())throw new Error('Changed quote was silently retained');
 empty=true;await page.reload();await page.getByText('Chưa có món được công bố. Vui lòng quay lại sau.',{exact:true}).waitFor();
 report.checks.push('price change requires a fresh choice; empty published menu has an explicit empty state');
 empty=false;priceChanged=false;await page.goto(base+'/portal#'+'a'.repeat(64));await page.reload();await page.getByRole('heading',{name:products[0].name,exact:true}).waitFor();await page.locator('input[type=radio][name=payment_method][value=bank]').check();
 await page.getByRole('button',{name:'Tăng '+products[0].name,exact:true}).click();
 await page.getByLabel('Tên người nhận *',{exact:true}).fill('Điểm bán kiểm thử');await page.getByLabel('Số điện thoại *',{exact:true}).fill('0900000038');await page.getByLabel('Địa chỉ / điểm giao *',{exact:true}).fill('Địa chỉ kiểm thử điểm bán');
 await page.getByRole('button',{name:'Gửi đơn đặt hàng',exact:true}).click();await page.getByText('Đã nhận đơn #public-s',{exact:true}).waitFor();
 if(requests.at(-1)?.p_link_token!=='a'.repeat(64)||requests.at(-1)?.p_payment_method!=='bank')throw new Error('Store link token or selected payment method was not passed to the order RPC');
 if(!['AM','PM'].includes(requests.at(-1)?.p_shift))throw new Error('Hidden Vietnam shift was not passed with the store order');
 if(!page.url().endsWith('#'+'a'.repeat(64)))throw new Error('Reusable store link was removed after its first order');
 report.checks.push('store-link portal retains the capability token until submit and includes it in the idempotent order request');
 await page.goto(base+'/app/materials');await page.getByRole('button',{name:'Cổng đặt hàng',exact:true}).click();const linkDialog=page.getByRole('dialog',{name:'Tạo link cho điểm bán'});await linkDialog.waitFor();
 if(!await linkDialog.getByLabel('Điểm bán',{exact:true}).count())throw new Error('Store picker missing: '+(await linkDialog.innerText()).slice(0,500));
 await linkDialog.getByLabel('Điểm bán',{exact:true}).selectOption('store-fixture');await page.getByRole('button',{name:'Tạo link',exact:true}).click();
 await page.getByLabel('Đường dẫn đặt hàng',{exact:true}).waitFor();
 if(createdLink?.p_store!=='store-fixture'||!createdLink?.p_key||!(await page.getByLabel('Đường dẫn đặt hàng',{exact:true}).inputValue()).endsWith('#'+'a'.repeat(64)))throw new Error('Store link popup did not create a copyable link for the selected store');
 await page.screenshot({path:path.join(out,'order-link-dialog.png')});report.orderLinkDialog=await page.getByRole('dialog').evaluate(dialog=>({dialog:dialog.getBoundingClientRect().toJSON(),close:dialog.querySelector('button[aria-label="Đóng hộp thoại"]')?.getBoundingClientRect().toJSON(),scrollTop:dialog.scrollTop,scrollHeight:dialog.scrollHeight}));
 await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();await page.goto(base+'/app/orders');
 if(await page.getByRole('navigation',{name:'Chức năng trong phân hệ'}).count())throw new Error('Delivery/return tabs remain on the order page');
 report.checks.push('admin popup creates a store-specific link; order page has no delivery/return context tabs');
 await page.goto(base+'/app/orders?guest-order-linked');await page.getByText('Synthetic linked store',{exact:true}).waitFor();report.checks.push('review list shows the actual assigned store name for a linked portal order');await page.getByRole('button',{name:'Xem đơn',exact:true}).click();
 await page.getByText('Đơn đã gắn với điểm bán từ link đặt hàng.',{exact:false}).waitFor();
 if(await page.getByLabel('Điểm bán tiếp nhận đơn',{exact:true}).count())throw new Error('A store-link order asked the reviewer to reassign its linked store');
 await page.getByRole('button',{name:'Xác nhận duyệt đơn',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 if(reviewed?.p_store!=='guest-store')throw new Error('Review lost the store preassigned by the link');
 report.checks.push('orders created from a store link arrive preassigned and preserve that store on approval');
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/app/orders?guest-order');await page.getByText('Chưa gắn điểm bán',{exact:true}).waitFor();report.checks.push('general portal orders clearly show that no store has been assigned yet');
 await page.getByRole('button',{name:'Xem đơn',exact:true}).click();
 await page.getByLabel('Điểm bán tiếp nhận đơn',{exact:true}).selectOption('guest-store');
 await page.screenshot({path:path.join(out,'guest-review.png')});
 await page.getByRole('button',{name:'Xác nhận duyệt đơn',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 if(reviewed?.p_store!=='guest-store'||reviewed?.p_order!=='guest-fixture')throw new Error('Guest approval lost store or order');
 report.checks.push('internal reviewer sees guest contact/items and explicitly assigns an existing store before approval; all browser writes mocked');
 await page.goto(base+'/portal/account');await page.waitForFunction(()=>location.pathname==='/portal');await page.getByRole('heading',{name:products[0].name,exact:true}).waitFor();report.checks.push('legacy /portal/account URL redirects to the public ordering portal');
}

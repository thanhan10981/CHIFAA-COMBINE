import path from 'node:path';
export async function checkPublicPortal(page,base,out,report){
 await page.routeWebSocket('**',socket=>socket.close());
 const products=[{product_id:'public-rice',code:'CN',name:'Cơm nắm kiểm thử với tên dài trên màn hình điện thoại',sale_unit:'Phần',price_vnd:'15000'},{product_id:'public-roll',code:'CC',name:'Cơm cuộn kiểm thử',sale_unit:'Hộp',price_vnd:'25000'},{product_id:'public-missing',code:'CG',name:'Món công bố chưa có giá',sale_unit:'Phần',price_vnd:null}];
 let empty=false,priceChanged=false;const requests=[];
 await page.route('**/rest/v1/rpc/public_order_catalog',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rows:empty?[]:products,total:empty?'0':'3'})}));
 await page.route('**/rest/v1/rpc/submit_public_order',async route=>{
  requests.push(route.request().postDataJSON());
  await route.fulfill({status:priceChanged?400:requests.length===1?503:200,contentType:'application/json',body:priceChanged?'{"code":"P0001","message":"PRICE_CHANGED"}':requests.length===1?'{}':'{"order_id":"public-synthetic-order","status":"submitted"}'});
 });
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/portal');
  await page.getByRole('heading',{name:products[0].name,exact:true}).waitFor();
  if(await page.getByRole('button',{name:'Đăng nhập',exact:true}).count()||await page.getByLabel('Điểm bán',{exact:true}).count())throw new Error('Public portal requires linked account');
  await page.getByRole('button',{name:'Tăng '+products[0].name,exact:true}).click();
  await page.getByLabel('Số lượng '+products[1].name,{exact:true}).fill('2');
  if(!await page.getByLabel('Số lượng '+products[2].name,{exact:true}).isDisabled())throw new Error('Unpriced dish can be ordered');
  if(!await page.locator('.public-total').innerText().then(value=>value.includes('65.000')))throw new Error('Basket total incorrect');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Public portal overflows '+width);
  if([390,1440].includes(width))await page.screenshot({path:path.join(out,'public-portal-'+width+'.png'),fullPage:true});
  report.checks.push('public portal '+width+': immediate menu, quantities, exact total, no login/store dependency, unpriced disabled, no overflow');
 }
 await page.getByLabel('Tên người nhận *',{exact:true}).fill('Khách kiểm thử');
 await page.getByLabel('Số điện thoại *',{exact:true}).fill('0900000035');
 await page.getByLabel('Địa chỉ / điểm giao *',{exact:true}).fill('Địa chỉ kiểm thử không phải dữ liệu thật');
 await page.getByRole('button',{name:'Gửi đơn đặt hàng',exact:true}).click();
 await page.getByRole('button',{name:'Kiểm tra lại lần gửi',exact:true}).waitFor();
 if(!await page.getByLabel('Tên người nhận *',{exact:true}).isDisabled())throw new Error('Uncertain submission fields are editable');
 await page.getByRole('button',{name:'Kiểm tra lại lần gửi',exact:true}).click();await page.getByText('Đã nhận đơn #public-s',{exact:true}).waitFor();
 if(requests.length!==2||JSON.stringify(requests[0])!==JSON.stringify(requests[1]))throw new Error('Guest retry changed the request/key');
 if(requests[0].p_items.some(item=>!['15000','25000'].includes(item.price_vnd)))throw new Error('Quote missing from submission');
 report.checks.push('guest503/retry keeps identical request and idempotency key; confirmation only after server success');
 priceChanged=true;
 await page.getByRole('button',{name:'Tăng '+products[0].name,exact:true}).click();
 await page.getByRole('button',{name:'Gửi đơn đặt hàng',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Giá món vừa thay đổi'}).first().waitFor();
 if(await page.locator('.public-cart li').count())throw new Error('Changed quote was silently retained');
 empty=true;await page.reload();await page.getByText('Chưa có món được công bố. Vui lòng quay lại sau.',{exact:true}).waitFor();
 report.checks.push('price change requires a fresh choice; empty published menu has an explicit empty state');
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/app/orders?guest-order');
 await page.getByRole('button',{name:'Xem đơn',exact:true}).click();
 await page.getByLabel('Điểm bán tiếp nhận đơn',{exact:true}).selectOption('guest-store');
 let reviewed;
 await page.route('**/rest/v1/rpc/review_public_order',async route=>{reviewed=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:'{"status":"approved"}'});});
 await page.screenshot({path:path.join(out,'guest-review.png')});
 await page.getByRole('button',{name:'Xác nhận duyệt đơn',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 if(reviewed?.p_store!=='guest-store'||reviewed?.p_order!=='guest-fixture')throw new Error('Guest approval lost store or order');
 report.checks.push('internal reviewer sees guest contact/items and explicitly assigns an existing store before approval; all browser writes mocked');
}

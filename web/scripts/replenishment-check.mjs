import assert from 'node:assert/strict';
import path from 'node:path';

export async function checkReplenishment(page,base,out,report){
 let scenario='normal';const requests=[],stockRequests=[],writes=[];
 const stockRow=(id,extra={})=>({id,code:id.toUpperCase(),name:'Vật tư bổ sung '+id,category:'ingredient',unit_id:'kg',unit:'kg',quantity:'5',minimum:'3',needed:'900',suggested:'898',status:'ok',stock_average_unit_cost:null,...extra});
 const material=(id,extra={})=>({material_id:id,code:id.toUpperCase(),name:'Vật tư bổ sung '+id,unit_code:'kg',quantity:'10',stock_quantity:'999',minimum_quantity:'99',shortage_quantity:'0',status:'ok',sources:[{product_id:'p',product_name:'Món trong đơn kiểm thử',quantity:'10'}],...extra});
 const normalRows=[stockRow('order-ok'),stockRow('unknown',{quantity:null,status:'unknown'}),stockRow('minimum',{minimum:null,status:'minimum_missing'}),stockRow('unit'),stockRow('zero',{quantity:'0',minimum:'0',status:'ok'})];
 page.on('request',request=>{if(/\/rpc\/(post_|save_|review_|submit_)/.test(request.url()))writes.push(request.url());});
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/inventory_workspace',async route=>{
  const args=route.request().postDataJSON();stockRequests.push(args);
  if(scenario==='stock-error')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'503',message:'Synthetic stock error'})});
  let rows=scenario==='paging'?Array.from({length:104},(_,i)=>stockRow('page-'+String(i).padStart(3,'0'))):normalRows;
  if(args.p_search)rows=rows.filter(row=>(row.code+' '+row.name).toLowerCase().includes(args.p_search.toLowerCase()));
  if(args.p_category)rows=rows.filter(row=>row.category===args.p_category);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rows:rows.slice(args.p_offset,args.p_offset+50),total:rows.length,summary:{materials:scenario==='paging'?104:5,known:4,unknown:1,low:0},needs_complete:true,planned:true,inventory_version:'123'})});
 });
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/order_material_demand',async route=>{
  const args=route.request().postDataJSON();requests.push(args);
  if(scenario==='error')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'503',message:'Synthetic order demand error'})});
  const empty=scenario==='empty';const materials=empty?[]:scenario==='paging'?Array.from({length:54},(_,i)=>material('page-'+String(i+50).padStart(3,'0'))):[material('order-ok',{quantity:scenario==='date'?'20':'10'}),material('unknown'),material('minimum'),material('unit',{unit_code:'l'})];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({products:empty?[]:[{product_id:'p',quantity:'2'}],materials,issues:scenario==='partial'?[{product_id:'missing',product_name:'Món thiếu công thức',issue:'PUBLISHED_PRODUCT_RECIPE_REQUIRED'}]:[]})});
 });
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});await page.goto(base+'/app/reorder');
  const row=page.getByRole('row').filter({hasText:'ORDER-OK'});await row.waitFor();
  assert.match(await row.locator('td').nth(6).innerText(),/^10\s*Nguồn món$/);
  assert.equal(await row.locator('td').nth(8).innerText(),'8 kg');
  await row.locator('summary').click();await row.getByText('Món trong đơn kiểm thử: 10 kg',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Nguồn nhu cầu',{exact:true}).inputValue(),'orders');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('.inventory-data .table-wrap').scrollLeft=0;});
  await page.screenshot({path:path.join(out,'replenishment-'+width+'.png'),fullPage:true});
 }
 await page.setViewportSize({width:1440,height:900});
 const bodyRow=id=>page.getByRole('row').filter({has:page.locator('td>b').filter({hasText:new RegExp('^'+id+'$')})});
 for(const id of ['UNKNOWN','MINIMUM','UNIT'])assert.match(await bodyRow(id).locator('td').nth(8).innerText(),/Chưa tính được/);
 await bodyRow('UNIT').getByText('Cần xác minh quy đổi về ĐVT chuẩn',{exact:true}).waitFor();
 await page.getByLabel('Trạng thái tồn').selectOption('all');assert.equal(await bodyRow('ZERO').locator('td').nth(8).innerText(),'0 kg');
 // Changing either date must use its own request/cache scope.
 scenario='date';await page.getByLabel('Ngày cần chuẩn bị',{exact:true}).fill('2097-02-03');await page.getByText('18 kg',{exact:true}).waitFor();assert.equal(requests.at(-1).p_date,'2097-02-03');
 await page.getByLabel('Tồn đến ngày',{exact:true}).fill('2097-02-01');await page.waitForFunction(()=>!document.querySelector('.inventory-refresh[disabled]'));await page.getByRole('button',{name:'Tải lại số liệu',exact:true}).click();await page.getByText('18 kg',{exact:true}).waitFor();assert.equal(stockRequests.at(-1).p_date,'2097-02-01');assert.equal(stockRequests.at(-1).p_need_date,'2097-02-03');
 const orderCalls=requests.length;await page.getByLabel('Nguồn nhu cầu',{exact:true}).selectOption('planned');await page.getByText('898 kg',{exact:true}).first().waitFor();assert.equal(requests.length,orderCalls);await page.getByLabel('Nguồn nhu cầu',{exact:true}).selectOption('orders');await page.getByText('18 kg',{exact:true}).waitFor();
 scenario='partial';await page.getByRole('button',{name:'Tải lại số liệu',exact:true}).click();await page.getByText('Chưa tính đủ nhu cầu. Chưa đề xuất mua từ số liệu một phần.',{exact:true}).waitFor();assert.match(await bodyRow('ORDER-OK').locator('td').nth(6).innerText(),/10/);assert.match(await bodyRow('ORDER-OK').locator('td').nth(8).innerText(),/Chưa tính được/);
 scenario='error';await page.getByRole('button',{name:'Tải lại số liệu',exact:true}).click();await page.getByRole('alert').filter({hasText:'Chưa tải được nhu cầu từ đơn đã duyệt.'}).waitFor();assert.match(await bodyRow('ORDER-OK').locator('td').nth(8).innerText(),/Chưa tính được/);
 scenario='empty';await page.getByRole('button',{name:'Tải lại số liệu',exact:true}).click();await page.getByText('Chưa có đơn đã duyệt cho ngày này.',{exact:false}).waitFor();assert.equal(await bodyRow('ORDER-OK').locator('td').nth(8).innerText(),'0 kg');
 scenario='stock-error';await page.getByRole('button',{name:'Tải lại số liệu',exact:true}).click();await page.getByRole('button',{name:'Tải lại bảng tồn',exact:true}).waitFor();assert.match(await bodyRow('ORDER-OK').locator('td').nth(8).innerText(),/Chưa tính được/);
 scenario='paging';stockRequests.length=0;await page.goto(base+'/app/reorder');await page.getByRole('row').filter({hasText:'PAGE-050'}).waitFor();assert.deepEqual(stockRequests.map(args=>args.p_offset),[0,50,100]);assert.ok(stockRequests.every(args=>args.p_status==='all'));await page.getByText('54 vật tư',{exact:true}).waitFor();assert.equal(await page.locator('.inventory-table tbody tr').count(),50);await page.getByRole('button',{name:'Sau',exact:true}).click();await page.getByRole('row').filter({hasText:'PAGE-103'}).waitFor();assert.equal(await page.locator('.inventory-table tbody tr').count(),4);
 await page.getByLabel('Tìm vật tư trong kho').fill('PAGE-103');await page.getByText('1 vật tư',{exact:true}).waitFor();assert.equal(await page.locator('.inventory-table tbody tr').count(),1);
 const callsBefore=requests.length;await page.goto(base+'/app/reorder?no-order-demand');await page.getByLabel('Nguồn nhu cầu',{exact:true}).waitFor();assert.equal(await page.getByLabel('Nguồn nhu cầu',{exact:true}).inputValue(),'planned');assert.equal(await page.getByLabel('Nguồn nhu cầu').locator('option[value=orders]').isDisabled(),true);assert.equal(requests.length,callsBefore);
 assert.deepEqual(writes,[]);report.checks.push('Replenishment: approved orders separate from plans; warehouse/date scopes, recipe source, null/minimum/unit checks, partial/error/retry/empty states, all 104 rows before attention filtering and pagination, search, permission fallback, no business writes; responsive 320/390/768/1440');
}

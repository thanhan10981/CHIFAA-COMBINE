import path from 'node:path';
export async function checkInventory(page,base,out,report){
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const slug of ['inventory','stockmovements','stockhistory','reorder','entry-stock']){
   await page.goto(base+'/app/'+slug);await page.getByText(slug==='stockhistory'?'Chứng từ nhập kiểm thử':'Vật tư kiểm thử nhập kho',{exact:slug!=='stockhistory'}).waitFor();
   if(await page.getByLabel('Kho nguyên liệu',{exact:true}).inputValue()!=='inv-w')throw new Error('Sole warehouse was not selected');
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Inventory overflow '+slug+' '+width);
   await page.screenshot({path:path.join(out,slug+'-'+width+'.png')});report.pages.push({slug,width,overflow:false});
  }
 }
 await page.goto(base+'/app/inventory?empty-warehouse');await page.getByRole('link',{name:'Thiết lập kho nguyên liệu',exact:true}).waitFor();
 await page.goto(base+'/app/inventory');await page.getByText('Vật tư kiểm thử nhập kho',{exact:true}).waitFor();
 const row=page.getByRole('row').filter({hasText:'INV-M'});await row.getByRole('button',{name:'Nhập',exact:true}).click();
 await page.getByLabel('Số lượng phiếu kho',{exact:true}).fill('2,5');await page.getByLabel('Nguồn / số chứng từ / lý do',{exact:true}).fill('Chứng từ kiểm thử nhập bổ sung');
 const sent=[];await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/post_inventory',async route=>{sent.push(route.request().postDataJSON());if(sent.length===1)await route.abort();else await route.fulfill({status:200,contentType:'application/json',body:'{"movement_id":"synthetic-receipt"}'});});
 await page.getByRole('button',{name:'Lưu phiếu kho',exact:true}).click();await page.getByRole('button',{name:'Kiểm tra lại lần lưu',exact:true}).waitFor();
 if(!await page.getByLabel('Số lượng phiếu kho',{exact:true}).isDisabled())throw new Error('Uncertain receipt input unlocked');
 await page.getByRole('button',{name:'Kiểm tra lại lần lưu',exact:true}).click();await page.getByText('Đã ghi phiếu. Tồn kho và lịch sử đã được cập nhật.',{exact:true}).waitFor();
 if(sent.length!==2||JSON.stringify(sent[0])!==JSON.stringify(sent[1])||sent[0].p_lines[0].quantity!=='2.5')throw new Error('Receipt retry payload/quantity changed');
 await page.goto(base+'/app/inventory');await page.getByRole('row').filter({hasText:'INV-M'}).getByRole('button',{name:'Kiểm kê',exact:true}).click();await page.getByLabel('Số lượng phiếu kho',{exact:true}).fill('0');let count;
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/post_stock_count',async route=>{count=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:'{"count_id":"synthetic-zero"}'});});
 await page.getByRole('button',{name:'Lưu phiếu kho',exact:true}).click();await page.getByText('Đã ghi phiếu. Tồn kho và lịch sử đã được cập nhật.',{exact:true}).waitFor();
 if(count?.p_lines[0].counted_quantity!=='0'||count.p_inventory_version!=='123')throw new Error('Zero count/token not retained');
 report.checks.push('Inventory catalogue, movements, history, reorder, entry at 5 widths; sole warehouse; empty warehouse guidance; decimal receipt retry preserves payload/key; confirmed zero count with captured inventory token');
}

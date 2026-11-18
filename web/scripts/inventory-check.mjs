import path from 'node:path';
export async function checkInventory(page,base,out,report){
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
 report.checks.push('Inventory catalogue, movements, history, reorder, entry at 5 widths; sole warehouse; empty warehouse guidance; decimal receipt retry preserves payload/key; confirmed zero count with captured inventory token; accessible icon actions stay in one row, desktop filters fit one row, no duplicate tabs, three compact dialogs at 320/1440');
 await page.goto(base+'/app/warehouses');await page.getByText('V\u1eadt t\u01b0 ki\u1ec3m th\u1eed nh\u1eadp kho',{exact:true}).waitFor();
 report.checks.push('Warehouse catalogue redirects to inventory; ingredient warehouse is resolved automatically without selector');
}

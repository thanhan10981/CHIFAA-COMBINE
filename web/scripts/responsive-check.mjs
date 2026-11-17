import path from 'node:path';
export async function checkResponsive(page,base,out,report){
 const routes=['','opsdashboard','strategy','materials','stores','products','employees','discounts','inventory','stockmovements','stockhistory','kiosk','reorder','recipes','batches','rice','packaging','cost','production','requirements','counts','variance','consumption','entry','entry-stock','sales','attendance','entry-production','targets','loans','receivables','cash','payroll','assets','orders','admin','audit','accounts','units','departments','warehouses'];
 await page.routeWebSocket('**',socket=>socket.close());
 const sizes=[[320,740],[360,780],[390,844],[768,1024],[820,1180],[844,390],[1024,768],[1280,800],[1440,900],[1920,1080],[2560,1440]];
 async function fits(label){
  const state=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,offenders:[...document.querySelectorAll('main *')].filter(el=>{if(el.closest('.table-wrap,.tablebox,[class*=tablewrap],[class*=table-wrap]'))return false;const box=el.getBoundingClientRect();return box.width>0&&box.right>innerWidth+1;}).slice(0,5).map(el=>el.tagName+'.'+el.className)}));
  if(state.overflow)throw new Error(label+' overflows: '+JSON.stringify(state));return state;
 }
 async function dialogFits(label){
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  const box=await dialog.boundingBox(),size=page.viewportSize();
  if(!box||box.x<0||box.y<0||box.x+box.width>size.width+1||box.y+box.height>size.height+1)throw new Error(label+' dialog is outside viewport: '+JSON.stringify(box));
  await fits(label);
  const last=dialog.locator('button').last();await last.scrollIntoViewIfNeeded();
  const action=await last.boundingBox();if(!action||action.y+action.height>size.height+1)throw new Error(label+' action is unreachable');
  await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
 }
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});
  for(const route of routes){
   await page.goto(base+'/app'+(route?'/'+route:''));await page.locator('.sidebar .navgroup').first().waitFor({state:'attached'});await page.evaluate(()=>document.fonts.ready);
   const state=await fits(route||'dashboard');report.pages.push({width,height,route,overflow:state.overflow});
   if(route==='materials'){
    if(!await page.locator('.reference-portal').isVisible())throw new Error('Ordering portal hidden at '+width);
    if(width<1024){
     if(await page.locator('.sidebar').isVisible())throw new Error('Drawer should start closed at '+width);
     const toggle=page.getByRole('button',{name:'Mở menu',exact:true});await toggle.click();await page.locator('.sidebar.open').waitFor();
     await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().x>=-1);
     if(await page.evaluate(()=>document.body.style.overflow)!=='hidden')throw new Error('Drawer does not lock background');
     await page.keyboard.press('Shift+Tab');if(!await page.locator('.sidebar').evaluate(el=>el.contains(document.activeElement)))throw new Error('Drawer keyboard focus escaped');
     await page.keyboard.press('Escape');await page.locator('.sidebar.open').waitFor({state:'detached'});
     if(!await toggle.evaluate(el=>el===document.activeElement))throw new Error('Menu focus was not restored');
     await toggle.click();await page.getByRole('button',{name:'Đóng thanh menu',exact:true}).click();await page.locator('.sidebar').waitFor({state:'hidden'});
     if(await page.evaluate(()=>document.body.style.overflow)==='hidden')throw new Error('Drawer left body locked');
    }
    if([320,390,768,1024,1440,2560].includes(width))await page.screenshot({path:path.join(out,'materials-'+width+'.png')});
    if(width<=1024){
     const table=page.locator('.material-table-card .table-wrap');await table.evaluate(el=>el.scrollLeft=el.scrollWidth);
     if(await table.evaluate(el=>el.scrollWidth>el.clientWidth&&el.scrollLeft===0))throw new Error('Wide table cannot scroll locally');
     if(await page.evaluate(()=>scrollX)!==0)throw new Error('Material table scrolled the entire page');
    }
   }
  }
  // Real production editors, with cached synthetic data and no backend submissions.
  if([320,390,768,1024,1920].includes(width)){
   await page.goto(base+'/app/materials');
   await page.locator('.material-row-actions').first().getByRole('button',{name:'Sửa',exact:true}).click();await dialogFits('Material edit '+width);
   await page.locator('.material-row-actions').nth(1).getByRole('button',{name:'Xác minh',exact:true}).click();
   await page.getByRole('button',{name:'Lưu phiên bản xác minh',exact:true}).waitFor();
   await page.screenshot({path:path.join(out,'material-review-'+width+'.png')});await dialogFits('Material verification '+width);
   await page.getByRole('button',{name:'Cài đặt quy đổi',exact:true}).click();await dialogFits('Conversion '+width);
   await page.locator('.material-row-actions').first().getByRole('button',{name:'Kiểm kê',exact:true}).click();await dialogFits('Stock count '+width);
   await page.goto(base+'/app/accounts');await page.getByRole('button',{name:'Thêm mới',exact:true}).click();
   const generic=await page.getByRole('dialog').boundingBox();if(!generic||generic.width>width)throw new Error('Generic catalog modal too wide');
   await page.getByRole('button',{name:'Đóng',exact:true}).click();
  }
  await page.goto(base+'/portal');await page.getByLabel('Điểm bán',{exact:true}).selectOption('store-fixture');await page.getByRole('heading',{name:'Thực đơn theo điểm bán',exact:true}).waitFor();await fits('Ordering portal '+width);
  if([320,768,1440].includes(width))await page.screenshot({path:path.join(out,'portal-'+width+'.png')});
 }
 await page.setViewportSize({width:820,height:900});await page.goto(base+'/app/materials');await page.getByRole('button',{name:'Mở menu',exact:true}).click();
 await page.setViewportSize({width:1280,height:800});await page.locator('.reference-backdrop').waitFor({state:'detached'});
 if(await page.evaluate(()=>document.body.style.overflow)==='hidden')throw new Error('Tablet to desktop resize left scroll locked');
 report.checks.push('41 routes × 11 sizes (320–2560px), portrait/landscape, tablet drawer focus/scroll/resize, local table scrolling, material/review/count/conversion/catalog dialogs and ordering portal; synthetic offline data');
}

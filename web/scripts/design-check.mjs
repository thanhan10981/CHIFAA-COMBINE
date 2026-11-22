import {checkEntries} from './entry-check.mjs';
import {checkInventory} from './inventory-check.mjs';
import {checkProduction} from './production-check.mjs';
import {checkMaterialTable} from './material-table-check.mjs';
import {checkPublicPortal} from './public-portal-check.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import {checkResponsive} from './responsive-check.mjs';
import {checkCommercial} from './commercial-check.mjs';
import {checkRecipes} from './recipe-check.mjs';
import {checkAccounts} from './account-check.mjs';
const accounts=process.argv.includes('--accounts');
const entries=process.argv.includes('--entries');
const materialTable=process.argv.includes('--materials');
const publicPortal=process.argv.includes('--public-portal');
const inventory=process.argv.includes('--inventory');
const production=process.argv.includes('--production');
const responsive=process.argv.includes('--responsive');
const commercial=process.argv.includes('--commercial');
const recipes=process.argv.includes('--recipes');
const thresholdAction=process.argv.includes('--threshold-action');
const out=path.resolve(thresholdAction?'../output/dashboard-threshold-design':accounts?'../output/account-design':publicPortal?'../output/public-portal-design':materialTable?'../output/material-table-design':entries?'../output/entry-design':inventory?'../output/inventory-design':production?'../output/production-design':recipes?'../output/recipe-design':commercial?'../output/commercial-design':responsive?'../output/responsive-design':'../output/design-parity');await fs.mkdir(out,{recursive:true});
await build({entryPoints:['tests/ui/fixture.tsx'],outfile:path.join(out,'fixture.js'),bundle:true,format:'iife',platform:'browser',jsx:'automatic',alias:{'next/navigation':path.resolve('tests/ui/router-shim.tsx'),'next/link':path.resolve('tests/ui/router-shim.tsx'),'next/image':path.resolve('tests/ui/image-shim.tsx')},define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_SUPABASE_URL':'"https://visual-fixture.supabase.co"','process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'"sb_publishable_visual_fixture_no_real_auth"'}});
async function cssFiles(folder){const entries=await fs.readdir(folder,{withFileTypes:true});const values=await Promise.all(entries.map(entry=>entry.isDirectory()?cssFiles(path.join(folder,entry.name)):entry.name.endsWith('.css')?[path.join(folder,entry.name)]:[]));return values.flat();}
const css=(await Promise.all((await cssFiles(path.resolve('.next/static'))).map(file=>fs.readFile(file,'utf8')))).join('\n').replaceAll('../media/','/_next/static/media/');
const bundle=await fs.readFile(path.join(out,'fixture.js'));
const logo=await fs.readFile('public/logo-chifaa.png');
const server=http.createServer(async(req,res)=>{
 if(req.url.startsWith('/_next/static/media/')){
  const filename=req.url.slice('/_next/static/media/'.length);
  if(!/^[\w.-]+\.woff2?$/.test(filename)){res.writeHead(404);res.end();return;}
  try{res.setHeader('Content-Type',filename.endsWith('.woff2')?'font/woff2':'font/woff');res.end(await fs.readFile(path.resolve('.next/static/media',filename)));}catch{res.writeHead(404);res.end();}
 }else if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle);}
 else if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);}
 else if(req.url==='/logo-chifaa.png'){res.setHeader('Content-Type','image/png');res.end(logo);}
 else if(req.url==='/favicon.ico'){res.statusCode=204;res.end();}
 else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!DOCTYPE html><html lang="vi"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const executable=process.env.CHIFAA_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser=await chromium.launch({headless:true,executablePath:executable});
const report={fixtureOnly:true,cloudAuthTested:false,errors:[],pages:[],checks:[]};
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
 if(thresholdAction){
  for(const [width,height] of [[320,740],[390,844],[768,1024],[1440,900]]){
   await page.setViewportSize({width,height});await page.goto(base+'/app/opsdashboard');await page.evaluate(()=>document.fonts.ready);
   const action=page.getByRole('link',{name:'Cài ngưỡng mục tiêu',exact:true});if(await action.count()!==1)throw new Error('Dashboard target action missing or duplicated at '+width+'px');
   const state=await action.evaluate(element=>{const panel=element.closest('.v14-dashpanel'),head=element.closest('.v14-section-head'),title=head?.querySelector('.v14-dash-heading'),button=element.getBoundingClientRect(),heading=title?.getBoundingClientRect(),header=head?.getBoundingClientRect();return {withinHeader:!!head&&head.contains(element),overflow:document.documentElement.scrollWidth>innerWidth+1,background:getComputedStyle(element).backgroundColor,button:{x:button.x,y:button.y,width:button.width,height:button.height},heading:heading&&{x:heading.x,y:heading.y,width:heading.width,height:heading.height},header:header&&{width:header.width},panelWidth:panel?.getBoundingClientRect().width};});
   if(!state.withinHeader||state.overflow||state.background!=='rgb(223, 114, 47)')throw new Error('Dashboard target action layout failed at '+width+'px: '+JSON.stringify(state));
   if(width>650&&(!state.heading||Math.abs(state.button.y-state.heading.y)>12||state.button.x<=state.heading.x+state.heading.width))throw new Error('Dashboard target action is not aligned with the heading at '+width+'px: '+JSON.stringify(state));
   if(width<=650&&state.button.width<(state.panelWidth??0)-32)throw new Error('Dashboard target action does not fill its mobile header at '+width+'px: '+JSON.stringify(state));
   report.pages.push({route:'opsdashboard',width,height,...state});
   if(width===390||width===1440){await page.locator('.v14-dashpanel').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`dashboard-threshold-${width}.png`),animations:'disabled'});}
  }
  report.checks.push('target setup action stays in the dashboard threshold header, matches the primary style and fits at 320/390/768/1440px');
 }else if(accounts){await checkAccounts(page,base,out,report);}else if(publicPortal){await checkPublicPortal(page,base,out,report);}else if(materialTable){await checkMaterialTable(page,base,out,report);}else if(entries){await checkEntries(page,base,out,report);}else if(inventory){await checkInventory(page,base,out,report);}else if(production){await checkProduction(page,base,out,report);}else if(recipes){await checkRecipes(page,base,out,report);}else if(commercial){await checkCommercial(page,base,out,report);}else if(responsive){await checkResponsive(page,base,out,report);}else{
 const nav=JSON.parse(await fs.readFile('features/design/workspace-nav.json','utf8'));
 const routes=['','opsdashboard','strategy','materials','stores','products','employees','discounts','inventory','stockmovements','stockhistory','kiosk','reorder','recipes','batches','rice','packaging','cost','production','requirements','counts','variance','consumption','entry','entry-stock','sales','attendance','entry-production','targets','loans','receivables','cash','payroll','assets','orders','admin','audit','accounts','units','departments','warehouses'];
 for(const route of routes){
  await page.goto(base+'/app'+(route?'/'+route:''));await page.locator('.sidebar .navgroup').first().waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const state=await page.evaluate(()=>({sidebarWidth:getComputedStyle(document.querySelector('.sidebar')).width,fontFamily:getComputedStyle(document.querySelector('.sidebar')).fontFamily,contentFont:getComputedStyle(document.querySelector('main.content')).fontFamily,headingFont:getComputedStyle(document.querySelector('main.content h1,main.content h2')).fontFamily,groupCount:document.querySelectorAll('.sidebar .navgroup').length,activeCount:document.querySelectorAll('.sidebar [aria-current=page]').length,headerHeight:document.querySelector('.topbar').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth+1}));
  report.pages.push({route,...state});
  if(state.sidebarWidth!=='300px'||state.groupCount!==7||state.activeCount!==(route==='kiosk'?0:1)||state.headerHeight!==75||state.overflow||!state.contentFont.includes('Be Vietnam Pro'))throw new Error('Desktop layout check failed: '+JSON.stringify({route,...state}));
  if(['','opsdashboard','materials','recipes','strategy','kiosk','audit'].includes(route))await page.screenshot({path:path.join(out,(route||'dashboard')+'-desktop.png')});
  const brokenIcons=await page.evaluate(()=>Array.from(document.querySelectorAll('.workspace button:has(>svg),.workspace a:has(>svg)')).flatMap(button=>{
   if(!button.getClientRects().length)return [];
   const node=Array.from(button.childNodes).find(node=>node.nodeType===Node.TEXT_NODE&&node.textContent.trim());
   if(!node)return [];
   const range=document.createRange();range.selectNodeContents(node);
   const text=range.getBoundingClientRect(),icon=button.querySelector(':scope>svg').getBoundingClientRect();
   return Math.abs((text.top+text.bottom)/2-(icon.top+icon.bottom)/2)>6?[button.textContent.trim()]:[];
  }));
  if(brokenIcons.length)throw new Error('Icon/label wrapped on '+route+': '+brokenIcons.join(', '));
  const offCenter=await page.locator('.stat-icon:has(>svg)').evaluateAll(boxes=>boxes.flatMap(box=>{
   const outer=box.getBoundingClientRect(),inner=box.querySelector('svg').getBoundingClientRect();
   return Math.abs(outer.x+outer.width/2-inner.x-inner.width/2)>0.5||Math.abs(outer.y+outer.height/2-inner.y-inner.height/2)>0.5?[box.outerHTML.slice(0,100)]:[];
  }));
  if(offCenter.length)throw new Error('Stat SVG is not centered on '+route+': '+offCenter.join(', '));
 }
 // Sidebar composition: long section names fit, header/account stay fixed while menu scrolls.
 for(const [width,height] of [[1440,900],[1280,720],[1024,768]]){
  await page.setViewportSize({width,height});await page.goto(base+'/app/admin');await page.evaluate(()=>document.fonts.ready);
  const sidebar=await page.evaluate(()=>{
   const brand=document.querySelector('.sidebar .logo').getBoundingClientRect(),footer=document.querySelector('.sidebar .side-bottom').getBoundingClientRect();
   const labels=[...document.querySelectorAll('.navgroup-label')].map(element=>({height:element.getBoundingClientRect().height,overflow:element.scrollWidth>element.clientWidth+1}));
   const nav=document.querySelector('.sidebar nav');nav.scrollTop=nav.scrollHeight;
   return {labels,brandTop:brand.top,footerBottom:footer.bottom,brandMoved:Math.abs(document.querySelector('.sidebar .logo').getBoundingClientRect().top-brand.top)>1,footerMoved:Math.abs(document.querySelector('.sidebar .side-bottom').getBoundingClientRect().bottom-footer.bottom)>1};
  });
  if(sidebar.labels.some(label=>label.height>22||label.overflow)||sidebar.brandMoved||sidebar.footerMoved||sidebar.footerBottom>height)throw new Error('Sidebar alignment/scroll failed: '+JSON.stringify({width,...sidebar}));
  if(width===1440)await page.screenshot({path:path.join(out,'sidebar-admin-desktop.png'),animations:'disabled'});
 }
 report.checks.push('sidebar section labels fit at 1024/1280/1440; fixed brand and account during menu scrolling');
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/app/materials');
 const fonts=await page.evaluate(()=>({loaded:[...document.fonts].filter(font=>font.family.includes('Be Vietnam Pro')&&font.status==='loaded').length,portalVisible:!!document.querySelector('.reference-portal[aria-label="Cổng đặt hàng"]')}));
 if(fonts.loaded<2||!fonts.portalVisible)throw new Error('Vietnamese fonts or ordering portal missing: '+JSON.stringify(fonts));
 report.checks.push('self-hosted Vietnamese fonts loaded and ordering portal retained');
 if(await page.locator('.account-role').textContent()!=='Admin')throw new Error('Actual Admin role label missing');
 if((await page.getByRole('button',{name:'Làm mới dữ liệu',exact:true}).textContent()).trim()||(await page.getByRole('button',{name:'Đăng xuất',exact:true}).textContent()).trim())throw new Error('Topbar buttons must show SVG icons only');
 if(await page.getByRole('button',{name:'Đăng xuất',exact:true}).locator('svg path').count()!==1)throw new Error('Custom logout SVG missing');
 if(await page.getByText('QUẢN TRỊ & TIỆN ÍCH',{exact:true}).count())throw new Error('Flat utility menu returned');
 const warehouse=page.locator('.reference-nav-section').filter({has:page.getByRole('button',{name:'KHO & TỒN KHO',exact:true})});
 if(await warehouse.locator('a[href="/app/kiosk"]').count()!==0)throw new Error('Kiosk outside its legacy warehouse group');
 const customers=page.locator('.reference-nav-section').filter({has:page.getByRole('button',{name:'KHÁCH HÀNG',exact:true})});
 if(await customers.locator('a[href="/app/orders"]').count()!==1)throw new Error('Orders outside legacy customer group');
 report.checks.push('legacy menu groups, kiosk/customer placement and contextual utilities');
 await page.goto(base+'/app/kiosk');
 await page.getByRole('button',{name:'Duyệt hàng thu hồi',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Đóng thao tác ki-ốt',exact:true}).click();
 await page.getByRole('button',{name:'Ghi nhận bán tại ki-ốt',exact:true}).click();await page.getByLabel('Giá bán / phần (đồng)',{exact:true}).waitFor();await page.getByRole('button',{name:'Đóng thao tác ki-ốt',exact:true}).click();
 report.checks.push('real kiosk approval/sale dialogs, no cloud writes');
 await page.goto(base+'/app/accounts');await page.getByRole('button',{name:'Thêm mới',exact:true}).click();await page.getByLabel('Tên quỹ / ngân hàng',{exact:true}).waitFor();await page.getByRole('button',{name:'Đóng',exact:true}).click();
 report.checks.push('cash/bank account setup dialog in its contextual tab');
 await page.goto(base+'/app/materials');
 await page.locator('.material-row-actions').first().getByRole('button',{name:'Sửa',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 const materialPrice=await page.getByLabel('Đơn giá (đ)',{exact:true}).inputValue();
 if(materialPrice!=='16.000'){await page.screenshot({path:path.join(out,'material-editor-failure.png')});throw new Error('Material edit price is not formatted as VND: '+JSON.stringify(materialPrice));}
 await page.getByLabel('Đơn giá (đ)',{exact:true}).fill('260.000');
 if(await page.getByLabel('Đơn giá (đ)',{exact:true}).inputValue()!=='260.000')throw new Error('Currency input lost grouping');
 await page.screenshot({path:path.join(out,'material-editor-desktop.png')});
 await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
 await page.getByRole('button',{name:'Cài đặt quy đổi',exact:true}).click();await page.getByRole('dialog').waitFor();
 await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
 report.checks.push('material editor VND input, single row action, conversion settings; no cloud writes');
 await page.getByRole('button',{name:'Cài đặt quy đổi',exact:true}).click();
 await page.getByRole('dialog').getByRole('combobox').selectOption('material-1');
 await page.getByRole('button',{name:'Xem giá, đơn vị & quy cách',exact:true}).click();
 await page.getByRole('button',{name:'Lưu phiên bản xác minh',exact:true}).waitFor();
 if(await page.getByLabel('Đơn vị tính giá',{exact:true}).inputValue()!=='kg'||await page.getByLabel('Đơn vị mua',{exact:true}).inputValue()!=='chai'||await page.getByLabel('Đơn vị tiêu hao / kho',{exact:true}).inputValue()!=='g')throw new Error('Price, purchase and usage units were conflated');
 if(await page.locator('.material-review-history').count())throw new Error('Material history must not be displayed');
 await page.screenshot({path:path.join(out,'material-verification-desktop.png'),animations:'disabled'});
 await page.setViewportSize({width:390,height:844});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Material verification overflows mobile viewport');
 await page.screenshot({path:path.join(out,'material-verification-mobile.png'),animations:'disabled'});
 await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
 await page.setViewportSize({width:1440,height:1000});
 report.checks.push('Admin verification separates price/purchase/usage/package units and preserves source/history');
 await page.goto(base+'/app/materials');
 const group=page.getByRole('button',{name:'DANH MỤC',exact:true});await group.click();if(await group.getAttribute('aria-expanded')!=='false')throw new Error('Sidebar collapse failed');await group.click();
 await page.getByRole('button',{name:'Thêm vật tư',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();report.checks.push('collapse/expand and real catalog dialog');
 await page.goto(base+'/app/materials?role=staff');if(await page.locator('a[href="/app/admin"]').count())throw new Error('Unauthorized admin menu visible');if(await page.locator('.account-role').textContent()!=='Kế toán')throw new Error('Accountant role label missing');report.checks.push('permission-scoped sidebar and actual Admin/accountant labels with icon-only refresh/logout');
 await page.setViewportSize({width:390,height:844});
 for(const route of ['materials','recipes','strategy','entry-stock','sales','kiosk','opsdashboard']){
  await page.goto(base+'/app/'+route);await page.evaluate(()=>document.fonts.ready);
  if(route==='materials'){
   const centered=await page.locator('.stat-icon:has(>svg)').evaluateAll(boxes=>boxes.length===4&&boxes.every(box=>{const outer=box.getBoundingClientRect(),inner=box.querySelector('svg').getBoundingClientRect();return Math.abs(outer.x+outer.width/2-inner.x-inner.width/2)<=0.5&&Math.abs(outer.y+outer.height/2-inner.y-inner.height/2)<=0.5;}));
   if(!centered)throw new Error('Material stat icons are misaligned on mobile');
  }
  if(!await page.locator('.reference-portal').isVisible())throw new Error('Mobile ordering portal hidden');
  await page.screenshot({path:path.join(out,route+'-mobile-content.png')});
  await page.getByRole('button',{name:'Mở menu',exact:true}).click();await page.locator('.sidebar.open').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>{const box=document.querySelector('.sidebar').getBoundingClientRect();return box.x>=-1&&box.width>=200;},{},{timeout:3000});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Mobile page overflows: '+route);
  await page.screenshot({path:path.join(out,route+'-mobile.png')});
 }
 report.checks.push('mobile drawer and overflow');report.navigationItems=nav.top.length+nav.groups.flatMap(g=>g.items).length;
 // Exercise the production feedback provider with delayed, isolated requests.
 await page.goto(base+'/feedback');await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'Overlap',exact:true}).click();
 await page.locator('.chifaa-request-activity').waitFor();await page.locator('.chifaa-loading').waitFor();await page.screenshot({path:path.join(out,'feedback-loading.png'),animations:'disabled'});
 await page.getByText('Dữ liệu kiểm tra',{exact:true}).waitFor();
 if(!await page.locator('.chifaa-request-activity').isVisible())throw new Error('Loading stopped while a concurrent mutation was running');
 await page.locator('.chifaa-request-activity').waitFor({state:'detached'});
 await page.locator('.chifaa-toast').waitFor();await page.getByRole('button',{name:'Đóng thông báo',exact:true}).click();
 await page.getByRole('button',{name:'Read error',exact:true}).click();await page.locator('.chifaa-toast[role=alert]').waitFor();
 if(await page.locator('.chifaa-toast').count()!==1)throw new Error('Query error was toasted twice');
 await page.waitForTimeout(6200);if(!await page.locator('.chifaa-toast[role=alert]').isVisible())throw new Error('Actionable error dismissed automatically');
 await page.getByRole('button',{name:'Đóng thông báo',exact:true}).click();
 await page.getByRole('button',{name:'Duplicate success',exact:true}).click();
 if(await page.locator('.chifaa-toast').count()!==1)throw new Error('Success toast not deduplicated');
 await page.locator('.chifaa-toast').waitFor({state:'detached',timeout:9000});
 await page.getByRole('button',{name:'Open modal',exact:true}).click();await page.getByRole('button',{name:'Modal notification',exact:true}).click();
 await page.locator('.chifaa-toast[role=alert]').waitFor();
 const toast=await page.locator('.chifaa-toast').boundingBox();if(!toast||toast.x<1000||toast.y>100)throw new Error('Toast is not in the top-right corner');
 if(await page.locator('.chifaa-toast').evaluate(element=>getComputedStyle(element).backgroundColor)!=='rgb(255, 255, 255)')throw new Error('Legacy error CSS overrides toast surface');
 if(!await page.locator('.chifaa-toast').evaluate(element=>{const box=element.getBoundingClientRect();return !!document.elementFromPoint(box.x+20,box.y+20)?.closest('.chifaa-toast');}))throw new Error('Toast is behind the modal backdrop');
 await page.screenshot({path:path.join(out,'feedback-desktop.png'),animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'feedback-mobile.png'),animations:'disabled'});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Feedback overflows mobile viewport');
 await page.emulateMedia({reducedMotion:'reduce'});
 if(await page.locator('.chifaa-toast').evaluate(element=>getComputedStyle(element).animationName)!=='none')throw new Error('Reduced-motion preference ignored');
 await page.getByRole('button',{name:'Đóng thông báo',exact:true}).click();await page.getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();
 await page.getByRole('button',{name:'Write error',exact:true}).click();await page.locator('.chifaa-toast[role=alert]').waitFor();
 report.checks.push('overlapping query/mutation loading, deduplicated query error, persistent errors, timed success, modal toast layering, mobile and reduced motion');
 }
 if(report.errors.length)throw new Error(report.errors.join('\n'));
 report.passed=true;
}catch(error){report.passed=false;report.failure=error.message;process.exitCode=1;}finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify(report));

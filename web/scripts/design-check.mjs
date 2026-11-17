import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
const out=path.resolve('../output/design-parity');await fs.mkdir(out,{recursive:true});
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
 const nav=JSON.parse(await fs.readFile('features/design/workspace-nav.json','utf8'));
 const routes=['','opsdashboard','strategy','materials','stores','products','employees','discounts','inventory','stockmovements','stockhistory','kiosk','reorder','recipes','batches','rice','packaging','cost','production','requirements','counts','variance','consumption','entry','entry-stock','sales','attendance','entry-production','targets','loans','receivables','cash','payroll','assets','orders','admin','audit','accounts','units','departments','warehouses'];
 for(const route of routes){
  await page.goto(base+'/app'+(route?'/'+route:''));await page.locator('.sidebar .navgroup').first().waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const state=await page.evaluate(()=>({sidebarWidth:getComputedStyle(document.querySelector('.sidebar')).width,fontFamily:getComputedStyle(document.querySelector('.sidebar')).fontFamily,contentFont:getComputedStyle(document.querySelector('main.content')).fontFamily,headingFont:getComputedStyle(document.querySelector('main.content h1,main.content h2')).fontFamily,groupCount:document.querySelectorAll('.sidebar .navgroup').length,activeCount:document.querySelectorAll('.sidebar [aria-current=page]').length,headerHeight:document.querySelector('.topbar').getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth+1}));
  report.pages.push({route,...state});
  if(state.sidebarWidth!=='282px'||state.groupCount!==7||state.activeCount!==1||state.headerHeight!==75||state.overflow||!state.contentFont.includes('Be Vietnam Pro'))throw new Error('Desktop layout check failed: '+JSON.stringify({route,...state}));
  if(['','materials','recipes','strategy','kiosk','audit'].includes(route))await page.screenshot({path:path.join(out,(route||'dashboard')+'-desktop.png')});
 }
 await page.goto(base+'/app/materials');
 const fonts=await page.evaluate(()=>({loaded:[...document.fonts].filter(font=>font.family.includes('Be Vietnam Pro')&&font.status==='loaded').length,portalVisible:!!document.querySelector('a[href="/portal"]')}));
 if(fonts.loaded<2||!fonts.portalVisible)throw new Error('Vietnamese fonts or ordering portal missing: '+JSON.stringify(fonts));
 report.checks.push('self-hosted Vietnamese fonts loaded and ordering portal retained');
 if(await page.getByText('QUẢN TRỊ & TIỆN ÍCH',{exact:true}).count())throw new Error('Flat utility menu returned');
 const warehouse=page.locator('.reference-nav-section').filter({has:page.getByRole('button',{name:'KHO & TỒN KHO',exact:true})});
 if(await warehouse.locator('a[href="/app/kiosk"]').count()!==1)throw new Error('Kiosk outside its legacy warehouse group');
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
 const group=page.getByRole('button',{name:'DANH MỤC',exact:true});await group.click();if(await group.getAttribute('aria-expanded')!=='false')throw new Error('Sidebar collapse failed');await group.click();
 await page.getByRole('button',{name:'Thêm vật tư',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Đóng',exact:true}).click();report.checks.push('collapse/expand and real catalog dialog');
 await page.goto(base+'/app/materials?role=staff');if(await page.locator('a[href="/app/admin"]').count())throw new Error('Unauthorized admin menu visible');report.checks.push('permission-scoped sidebar');
 await page.setViewportSize({width:390,height:844});
 for(const route of ['materials','recipes','strategy','entry-stock','sales','kiosk']){
  await page.goto(base+'/app/'+route);await page.evaluate(()=>document.fonts.ready);
  if(!await page.locator('.reference-portal').isVisible())throw new Error('Mobile ordering portal hidden');
  await page.screenshot({path:path.join(out,route+'-mobile-content.png')});
  await page.getByRole('button',{name:'Mở menu',exact:true}).click();await page.locator('.sidebar.open').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>{const box=document.querySelector('.sidebar').getBoundingClientRect();return box.x>=-1&&box.width>=200;},{},{timeout:3000});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Mobile page overflows: '+route);
  await page.screenshot({path:path.join(out,route+'-mobile.png')});
 }
 report.checks.push('mobile drawer and overflow');report.navigationItems=nav.top.length+nav.groups.flatMap(g=>g.items).length;
 if(report.errors.length)throw new Error(report.errors.join('\n'));
 report.passed=true;
}catch(error){report.passed=false;report.failure=error.message;process.exitCode=1;}finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify(report));

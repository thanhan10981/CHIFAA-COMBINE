import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '@playwright/test';

// Read-only UI verification against a local production Next server. No OAuth submission.
const base=process.env.CHIFAA_LOGIN_QA_URL??'http://127.0.0.1:3189';
if(new URL(base).hostname!=='127.0.0.1')throw new Error('Use an isolated loopback server for this check');
const out=path.resolve('../output/login-design');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHIFAA_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report={authenticatedCloudTested:false,oauthSubmitted:false,errors:[],pages:[]};
try {
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
 const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
 for(const [width,height] of [[1902,913],[1440,900],[1024,768],[768,1024],[760,900],[390,844],[320,740]]){
  await page.setViewportSize({width,height});await page.goto(base+'/login');
  await page.evaluate(()=>document.fonts.ready);
  const state=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,font:getComputedStyle(document.querySelector('.access-card')).fontFamily,fontsLoaded:[...document.fonts].filter(font=>font.family.includes('Be Vietnam Pro')&&font.status==='loaded').length,card:document.querySelector('.access-card').getBoundingClientRect().toJSON(),logoLoaded:document.querySelector('.access-brandmark img').naturalWidth>0,button:document.querySelector('.access-google').getBoundingClientRect().toJSON()}));
  if(state.overflow||!state.font.includes('Be Vietnam Pro')||state.fontsLoaded<2||!state.logoLoaded||state.button.height<44||state.button.x<0||state.button.right>width)throw new Error('Login layout failed: '+JSON.stringify(state));
  if(width===1902&&(Math.abs(state.card.width-575)>1||await page.locator('.access-capabilities li').count()!==3))throw new Error('Reference desktop layout missing');
  report.pages.push(state);
  if([1902,390,320].includes(width))await page.screenshot({path:path.join(out,`login-${width}.png`),fullPage:true});
 }
 await page.goto(base+'/login?reason=access&next=/portal');
 await page.locator('.access-error[role=alert]').waitFor();
 if(await page.locator('input[name=target]').inputValue()!=='/portal')throw new Error('Ordering portal login target lost');
 await page.screenshot({path:path.join(out,'login-access-error-mobile.png'),fullPage:true});
 await page.goto(base+'/login?reason=oauth&next=https://invalid.example');
 await page.locator('.access-error[role=alert]').waitFor();
 if(await page.locator('input[name=target]').inputValue()!=='/app')throw new Error('Unsafe login target accepted');
 await page.keyboard.press('Tab');
 await page.getByRole('button').focus();
 if(await page.locator('.access-google').evaluate(element=>getComputedStyle(element).outlineStyle)==='none')throw new Error('Keyboard focus indicator missing');
 if(report.errors.length)throw new Error(report.errors.join('\n'));
 report.checks=['desktop and mobile layout','self-hosted Vietnamese font and official logo','access and OAuth errors','portal target retained; unsafe target rejected','keyboard focus'];
 console.log(JSON.stringify(report,null,2));
}finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}

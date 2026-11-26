import assert from 'node:assert/strict';
import path from 'node:path';

export async function checkProductMenuOrder(page,base,out,report){
 const expected=['CN-XXPM','CN-XXMY','CN-TERI','CN-GPM','CN-BV','CN-CNM','CC','CCC','CN-MY','CC-NC','CCC-NC'];
 const names=['Cơm nắm xúc xích chà bông phô mai','Cơm nắm xúc xích chà bông mayo','Cơm nắm gà sốt Teriyaki','Cơm nắm gà sốt phô mai','Cơm nắm bò viên sốt bơ tỏi','Cơm nắm cá ngừ mayo','Cơm cuộn thường','Cơm cuộn chiên','Mì trộn Chifaa','Cơm cuộn TT (nguyên cây)','Cơm cuộn chiên (nguyên cây)'];
 const products=expected.map((code,index)=>({id:'menu-'+index,version:'1',code,name:names[index],sale_unit:index>=9?'Cây':'Phần',price_vnd:String(12000+index),recipe_cost_vnd:null,recipe_cost_complete:false,recipe_cost_status:'unlinked',published:true,archived:index===10}));
 const extras=Array.from({length:103},(_,index)=>({...products[0],id:'extra-'+index,code:'EXTRA-'+String(index).padStart(3,'0'),name:'Món thêm kiểm thử '+index}));
 let source=[...products].reverse(),scenario='normal';const requests=[],writes=[];
 page.on('request',request=>{if(request.url().includes('/rpc/save_'))writes.push(request.url());});
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/commercial_catalog',async route=>{
  const args=route.request().postDataJSON();requests.push(args);
  if(scenario==='error')return route.fulfill({status:503,json:{code:'503',message:'Synthetic menu error'}});
  let rows=source;
  if(args.p_search)rows=rows.filter(row=>(row.code+' '+row.name).toLowerCase().includes(args.p_search.toLowerCase()));
  if(args.p_status==='active')rows=rows.filter(row=>!row.archived);
  if(args.p_status==='inactive')rows=rows.filter(row=>row.archived);
  return route.fulfill({status:200,json:{rows:rows.slice(args.p_offset,args.p_offset+args.p_limit),total:String(rows.length),metrics:{total:source.length,active:source.length-1,published:source.length-1,missing:0}}});
 });
 const cells=()=>page.locator('.commercial-workspace tbody tr');
 const codes=()=>cells().evaluateAll(rows=>rows.map(row=>row.cells[1].textContent));
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});await page.goto(base+'/app/products');
  // A new date forces the real RPC path instead of the basic offline cache.
  await page.getByLabel('Ngày xem',{exact:true}).fill('2098-04-03');
  await page.getByText('11 bản ghi',{exact:false}).waitFor();assert.deepEqual(await codes(),expected);
  for(let index=0;index<products.length;index++){
   const row=cells().nth(index);assert.equal(await row.locator('td').nth(0).innerText(),String(index+1));assert.equal(await row.locator('td').nth(2).innerText(),names[index]);
   assert.equal(await row.locator('td').nth(3).innerText(),products[index].sale_unit);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(out,'product-menu-order-'+width+'.png'),fullPage:true});
 }
 // The known menu occurs after the first 100 server rows. Sorting must precede
 // the UI's 25-row pagination rather than just reordering each server page.
 // Explicitly put all known menu rows beyond the first server page.
 source=[...extras,...[...products].reverse()];requests.length=0;
 await page.getByLabel('Ngày xem',{exact:true}).fill('2098-04-04');await page.getByText('114 bản ghi',{exact:false}).waitFor();
 assert.deepEqual(requests.map(args=>[args.p_offset,args.p_limit]),[[0,100],[100,100]]);
 assert.deepEqual(await codes(),[...expected,...extras.slice(0,14).map(row=>row.code)]);
 const calls=requests.length;await page.getByRole('button',{name:'Trang sau',exact:true}).click();assert.deepEqual(await codes(),extras.slice(14,39).map(row=>row.code));assert.equal(await cells().first().locator('td').first().innerText(),'26');assert.equal(requests.length,calls,'UI page changes reuse the complete sorted result');
 await page.getByLabel('Tìm mã hoặc tên',{exact:true}).fill('CN-');await page.getByRole('button',{name:'Tìm',exact:true}).click();await page.getByText('7 bản ghi',{exact:false}).waitFor();assert.deepEqual(await codes(),expected.filter(code=>code.startsWith('CN-')));assert.equal(await cells().first().locator('td').first().innerText(),'1');
 await page.getByLabel('Tìm mã hoặc tên',{exact:true}).fill('');await page.getByRole('button',{name:'Tìm',exact:true}).click();await page.getByText('114 bản ghi',{exact:false}).waitFor();await page.getByLabel('Trạng thái danh mục').selectOption('inactive');await page.getByText('1 bản ghi',{exact:false}).waitFor();assert.deepEqual(await codes(),['CCC-NC']);
 await page.getByLabel('Trạng thái danh mục').selectOption('');await page.getByText('114 bản ghi',{exact:false}).waitFor();await page.getByRole('button',{name:'Trang sau',exact:true}).click();source=products;await page.getByLabel('Ngày xem',{exact:true}).fill('2098-04-05');await page.getByText('11 bản ghi',{exact:false}).waitFor();assert.deepEqual(await codes(),expected);
 scenario='error';await page.getByLabel('Ngày xem',{exact:true}).fill('2098-04-06');await page.getByRole('button',{name:'Thử lại',exact:true}).waitFor();scenario='normal';await page.getByRole('button',{name:'Thử lại',exact:true}).click();await page.getByText('11 bản ghi',{exact:false}).waitFor();assert.deepEqual(await codes(),expected);
 assert.deepEqual(writes,[]);report.checks.push('Product catalogue follows the 11-code menu reference at 320/390/768/1440, preserves names/units/row numbers, globally sorts 114 rows across server pages before UI pagination, keeps new products, search/status/date/error/retry work and viewing performs no writes');
}

import assert from 'node:assert/strict';
import path from 'node:path';
export async function checkRecipes(page,base,out,report){
 for(const width of [320,390,768,1024,1440])for(const route of ['recipes','batches','rice','packaging','cost']){
  await page.setViewportSize({width,height:900});await page.goto(base+'/app/'+route);await page.locator('.recipe-catalog .recipe-row').first().waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Page overflow '+route+' '+width);
  assert.ok((await page.locator('.recipe-total').textContent()).includes('Chưa đủ dữ liệu'));
  if(route==='recipes'){
   await page.getByRole('button',{name:'Chỉnh sửa',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=901,'Dialog fit '+width);
   assert.equal(await dialog.getByLabel('Đơn vị 1',{exact:true}).inputValue(),'g');assert.equal(await dialog.locator('.recipe-edit-line').count(),2);assert.equal(await dialog.locator('.recipe-cost-exempt input').count(),2);
   await dialog.getByRole('button',{name:'Thêm thành phần',exact:true}).click();assert.equal(await dialog.locator('.recipe-edit-line').count(),3);await dialog.getByRole('button',{name:'Bỏ thành phần 3',exact:true}).click();
   await page.screenshot({path:path.join(out,'recipe-edit-'+width+'.png')});await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  if(width===1440||width===390)await page.screenshot({path:path.join(out,route+'-'+width+'.png')});
  report.pages.push({route,width,overflow:false,fixtureOnly:true});
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/app/recipes');await page.getByRole('button',{name:'Sao chép',exact:true}).click();const clone=page.getByRole('dialog');assert.equal(await clone.getByLabel('Mã công thức *',{exact:true}).inputValue(),'');assert.match(await clone.getByLabel('Tên công thức *',{exact:true}).inputValue(),/bản sao/);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Chỉnh sửa',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Thành phần 2',{exact:true}).selectOption('material-0');await dialog.locator('.recipe-cost-exempt input').first().check();
 const requests=[];await page.route('**/rest/v1/rpc/save_recipe_revision',async route=>{requests.push(route.request().postDataJSON());await route.fulfill(requests.length===1?{status:503,json:{message:'Synthetic uncertain commit',code:'503'}}:{status:200,json:{recipe_id:'recipe-product',version_id:'new-version'}});});
 await dialog.getByRole('button',{name:'Lưu công thức',exact:true}).click();await dialog.getByRole('button',{name:'Kiểm tra lại lần lưu',exact:true}).waitFor();assert.equal(await dialog.getByLabel('Tên công thức *',{exact:true}).isDisabled(),true);assert.equal(await dialog.getByRole('button',{name:'Đóng hộp thoại',exact:true}).isDisabled(),true);
 await dialog.getByRole('button',{name:'Kiểm tra lại lần lưu',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);assert.equal(requests[0].p_items[0].unit_id,'g');assert.equal(requests[0].p_items[0].quantity,'125');assert.equal(requests[0].p_items[0].cost_exempt,true);
 await page.goto(base+'/app/recipes');await page.getByRole('button',{name:'Công bố / liên kết món bán',exact:true}).click();const publish=page.getByRole('dialog');let sent;
 await page.route('**/rest/v1/rpc/publish_recipe',async route=>{sent=route.request().postDataJSON();await route.fulfill({status:200,json:{status:'published'}});});await publish.getByRole('button',{name:'Công bố',exact:true}).click();await publish.waitFor({state:'detached'});assert.equal(sent.p_product,'product-fixture');assert.equal(sent.p_output_per_product,'1');
 report.checks.push('5 recipe routes × 5 widths, scrollable source/detail tables, unit-preserving edit, add/remove lines, clone, unresolved cost, same-key uncertain retry, proposed product publication; synthetic data only');
}

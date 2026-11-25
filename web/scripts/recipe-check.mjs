import assert from 'node:assert/strict';
import path from 'node:path';
export async function checkRecipes(page,base,out,report){
 for(const width of [320,390,768,1024,1440])for(const route of ['recipes','toppings','batches','rice','packaging','cost']){
  await page.setViewportSize({width,height:900});await page.goto(base+'/app/'+route);await page.locator(route==='cost'?'.cost-summary-total':'.recipe-catalog .recipe-row').first().waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Page overflow '+route+' '+width);
  assert.ok((await page.locator('.recipe-total').textContent()).includes('Chưa đủ dữ liệu'));
  if(route==='recipes'&&width===1440){const ingredient=page.getByRole('row').filter({hasText:'SYN-M'}).first();assert.ok((await ingredient.innerText()).includes('100 g'),'A 0.1 kg recipe amount should display as 100 g');assert.ok((await ingredient.innerText()).includes('1 kg = 1.000 g'),'Formula conversion must display the saved material specification');assert.equal(await page.getByRole('columnheader',{name:'Quy đổi kho',exact:true}).count(),0);assert.equal(await page.getByRole('columnheader',{name:'Quy đổi công thức',exact:true}).count(),1);}
  if(route==='recipes')assert.equal(await page.getByRole('button',{name:'Công bố / liên kết món bán',exact:true}).count(),0,'Redundant publish/link button is still rendered');
  if(route==='recipes'){
   await page.getByRole('button',{name:'Chỉnh sửa',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=901,'Dialog fit '+width);
   assert.ok(await dialog.getByText(/Quy đổi công thức đã xác minh: 1 kg = 1000 g/).count()>0,'The recipe editor must show the separate verified formula ratio');
   assert.equal(await dialog.getByLabel('Đơn vị 1',{exact:true}).inputValue(),'kg');assert.equal(await dialog.locator('.recipe-edit-line').count(),2);assert.equal(await dialog.locator('.recipe-cost-exempt input').count(),2);
   await dialog.getByRole('button',{name:'Thêm thành phần',exact:true}).click();assert.equal(await dialog.locator('.recipe-edit-line').count(),3);await dialog.getByLabel('Thành phần 3',{exact:true}).selectOption('material-0');assert.equal(await dialog.getByLabel('Đơn vị 3',{exact:true}).inputValue(),'g','New materials must use the verified formula unit');await dialog.getByRole('button',{name:'Bỏ thành phần 3',exact:true}).click();
   await page.screenshot({path:path.join(out,'recipe-edit-'+width+'.png')});await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  }
  if(width===1440||width===390)await page.screenshot({path:path.join(out,route+'-'+width+'.png')});
  report.pages.push({route,width,overflow:false,fixtureOnly:true});
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/app/recipes');await page.getByRole('button',{name:'Sao chép',exact:true}).click();const clone=page.getByRole('dialog');assert.equal(await clone.getByLabel('Mã công thức *',{exact:true}).inputValue(),'');assert.match(await clone.getByLabel('Tên công thức *',{exact:true}).inputValue(),/bản sao/);await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Chỉnh sửa',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Đơn vị 1',{exact:true}).selectOption('g');await dialog.getByLabel('Định lượng 1',{exact:true}).fill('100');await dialog.getByLabel('Thành phần 2',{exact:true}).selectOption('material-0');await dialog.locator('.recipe-cost-exempt input').first().check();
 const requests=[];await page.route('**/rest/v1/rpc/save_recipe_revision',async route=>{requests.push(route.request().postDataJSON());await route.fulfill(requests.length===1?{status:503,json:{message:'Synthetic uncertain commit',code:'503'}}:{status:200,json:{recipe_id:'recipe-product',version_id:'new-version'}});});
 await dialog.getByRole('button',{name:'Lưu công thức',exact:true}).click();await dialog.getByRole('button',{name:'Kiểm tra lại lần lưu',exact:true}).waitFor();assert.equal(await dialog.getByLabel('Tên công thức *',{exact:true}).isDisabled(),true);assert.equal(await dialog.getByRole('button',{name:'Đóng hộp thoại',exact:true}).isDisabled(),true);
 await dialog.getByRole('button',{name:'Kiểm tra lại lần lưu',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);assert.equal(requests[0].p_items[0].unit_id,'g');assert.equal(requests[0].p_items[0].quantity,'100');assert.equal(requests[0].p_items[0].cost_exempt,true);
 await page.goto(base+'/app/recipes?approve-recipe');
 const fixtureDate=await page.getByLabel('Ngày xem và công bố công thức',{exact:true}).inputValue();
 const nextDate=new Date(new Date(fixtureDate+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10);
 const kinds=['product','topping','sauce','rice','packaging'];
 const names=new Map(kinds.map(kind=>['recipe-'+kind,'Công thức kiểm thử '+kind]));
 const metadataVersions=new Map(kinds.map(kind=>['recipe-'+kind,'1']));
 const row=(kind)=>({id:'recipe-'+kind,code:'SYN-'+kind,name:names.get('recipe-'+kind),kind,version:'1',version_id:'version-'+kind,revision:1,status:'draft',effective_from:fixtureDate,output_quantity:kind==='rice'?'2000':'1',output_unit:kind==='rice'?'g':'phần',cost:{complete:false,total_vnd:null,lines:[]}});
 const versions=new Map(kinds.map(kind=>['version-'+kind,{kind,status:'draft',revision:1}]));
 versions.set('forward-version',{kind:'product',status:'published',revision:2});
 const detailRequests=[];
 await page.route('**/rest/v1/rpc/recipe_catalog',route=>{const args=route.request().postDataJSON();return route.fulfill({status:200,json:{rows:[row(args.p_kind)],total:1,stats:{products:1,batches:3,materials:6,unpriced:1}}});});
 await page.route('**/rest/v1/rpc/recipe_detail',route=>{
  const args=route.request().postDataJSON(),meta=versions.get(args.p_version)??{kind:'product',status:'draft',revision:1};detailRequests.push(args.p_version);
  return route.fulfill({status:200,json:{version:{id:args.p_version,recipe_id:'recipe-'+meta.kind,revision:meta.revision,effective_from:args.p_date,status:meta.status,output_quantity:meta.kind==='rice'?'2000':'1',output_unit_id:meta.kind==='rice'?'g':'portion',output_unit:meta.kind==='rice'?'g':'phần'},cost:{complete:false,total_vnd:null,lines:[]},lines:meta.kind==='sauce'?[1,2].map(index=>({id:'saved-material-'+index,type:'material',target_id:'material-0',code:'SYN-M',name:'Nguyên liệu kiểm thử',quantity:'1',unit:'g',unit_id:'g',per_output:'1'})):[],products:[]}});
 });
 await page.route('**/rest/v1/recipes?*',route=>{const requestedId=new URL(route.request().url()).searchParams.get('id');if(!requestedId)return route.fulfill({status:200,json:kinds.map(kind=>({...row(kind),archived:false}))});const id=requestedId.replace(/^eq\./,''),kind=id.slice(7);return route.fulfill({status:200,json:{id,code:'SYN-'+kind,name:names.get(id),kind,version:metadataVersions.get(id)}});});
 await page.route('**/rest/v1/rpc/recipe_material_units',route=>route.fulfill({status:200,json:[{id:'material-0',code:'SYN-M',name:'Nguyên liệu kiểm thử',usage_unit_id:'kg',formula_unit_id:'g',formula_source_unit_id:'kg',formula_quantity:'1000',formula_verified:true}]}));
 await page.route('**/rest/v1/material_units?*',route=>route.fulfill({status:200,json:[{id:'kg',code:'kg',name:'Kilôgam'},{id:'g',code:'g',name:'Gam'},{id:'portion',code:'phần',name:'Phần'}]}));
 let versionReads=0,legacyPublications=0;
 await page.route('**/rest/v1/recipe_versions?*',route=>{if(!new URL(route.request().url()).searchParams.has('id'))return route.fulfill({status:200,json:kinds.map(kind=>({id:'version-'+kind,recipe_id:'recipe-'+kind,revision:1,status:'draft',effective_from:fixtureDate,output_unit_id:kind==='rice'?'g':'portion'}))});versionReads++;return route.fulfill({status:200,json:{version:'1'}});});
 await page.route('**/rest/v1/rpc/publish_recipe',route=>{legacyPublications++;return route.fulfill({status:500,json:{message:'The legacy publisher must not be used'}});});
 const published=[];
 await page.route('**/rest/v1/rpc/publish_recipe_at',async route=>{const args=route.request().postDataJSON();published.push(args);await route.fulfill(published.length===1?{status:400,json:{code:'P0001',message:`UNIT_NEEDS_VERIFICATION|material=SYN-M|from=piece|to=bag|date=${fixtureDate}|formula_from=${nextDate}`}}:published.length===2?{status:503,json:{code:'503',message:'Synthetic uncertain response'}}:{status:200,json:{recipe_id:'recipe-product',version_id:'forward-version',status:'published',effective_from:args.p_effective_from,prepared_from_version_id:args.p_version}});});
 await page.getByRole('button',{name:'Kiểm tra & công bố',exact:true}).click();
 await page.getByText(/Vật tư SYN-M có quy đổi công thức từ/).waitFor();
 await page.getByLabel('Ngày xem và công bố công thức',{exact:true}).fill(nextDate);
 await page.getByRole('button',{name:'Kiểm tra & công bố',exact:true}).click();
 await page.getByRole('button',{name:'Kiểm tra lại lần công bố',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Chỉnh sửa',exact:true}).isDisabled(),true);
 assert.equal(await page.getByLabel('Ngày xem và công bố công thức',{exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Kiểm tra lại lần công bố',exact:true}).click();
 await page.getByText('Đã công bố · phiên bản 2',{exact:true}).waitFor();
 assert.equal(published.length,3);assert.deepEqual(published[1],published[2],'Uncertain publication must retry the identical request');assert.equal(published[0].p_expected_version,'1');assert.equal(published[1].p_effective_from,nextDate);assert.ok(detailRequests.includes('forward-version'),'The newly prepared version must be selected after publication');assert.equal(versionReads,2,'An uncertain retry must not reread a changed source version');

 const savedRequests=[],autoPublished=[];let autoUncertain=true;
 await page.route('**/rest/v1/rpc/save_recipe_revision',route=>{const args=route.request().postDataJSON(),kind=args.p_recipe.kind;savedRequests.push(args);names.set('recipe-'+kind,args.p_recipe.name);versions.set('saved-'+kind,{kind,status:'draft',revision:2});return route.fulfill({status:200,json:{recipe_id:'recipe-'+kind,version_id:'saved-'+kind}});});
 await page.route('**/rest/v1/rpc/publish_recipe_at',route=>{
  const args=route.request().postDataJSON(),kind=args.p_version.replace(/^saved-/,'');autoPublished.push(args);
  if(autoUncertain){autoUncertain=false;return route.fulfill({status:503,json:{code:'503',message:'Synthetic publication may have committed'}});}
  versions.set('published-'+kind,{kind,status:'published',revision:3});return route.fulfill({status:200,json:{recipe_id:'recipe-'+kind,version_id:'published-'+kind,status:'published',effective_from:args.p_effective_from,prepared_from_version_id:args.p_version}});
 });
 for(const [route,kind] of [['recipes','product'],['toppings','topping'],['batches','sauce'],['rice','rice'],['packaging','packaging']]){
  await page.goto(base+'/app/'+route+'?approve-recipe');await page.getByRole('button',{name:'Chỉnh sửa',exact:true}).click();const form=page.getByRole('dialog');await form.getByLabel('Thành phần 2',{exact:true}).selectOption('material-0');const effectiveDate=await form.getByLabel('Ngày bắt đầu áp dụng',{exact:true}).inputValue();const beforeReads=versionReads,beforeSaves=savedRequests.length;
  await form.getByRole('button',{name:'Lưu công thức',exact:true}).click();
  if(kind==='product'){
   await form.getByRole('button',{name:'Kiểm tra lại lần lưu',exact:true}).waitFor();assert.equal(await form.getByLabel('Ngày bắt đầu áp dụng',{exact:true}).isDisabled(),true);await form.getByRole('button',{name:'Kiểm tra lại lần lưu',exact:true}).click();assert.equal(savedRequests.length,beforeSaves+1,'A saved draft must not be saved again when retrying publication');assert.equal(versionReads,beforeReads+1,'Publication retries must retain the saved expected version');assert.deepEqual(autoPublished[0],autoPublished[1],'Save/publication retry must retain date, source version and key');
  }
  await form.waitFor({state:'detached'});await page.getByText('Đã công bố · phiên bản 3',{exact:true}).waitFor();assert.equal(autoPublished.at(-1).p_effective_from,effectiveDate);assert.equal(autoPublished.at(-1).p_version,'saved-'+kind);assert.ok(detailRequests.includes('published-'+kind),'Save must select the returned publication version for '+kind);
 }
 await page.goto(base+'/app/recipes?approve-recipe&linked-child');await page.getByRole('button',{name:'SYN-sauce',exact:true}).click();await page.locator('.detail-head h3').filter({hasText:'Công thức kiểm thử sauce'}).waitFor();
 await page.getByLabel('Ngày xem và công bố công thức',{exact:true}).fill(nextDate);await page.locator('.detail-head h3').filter({hasText:'Công thức kiểm thử sauce'}).waitFor();assert.equal(await page.locator('.detail-head .meta').innerText(),'Nhân / sốt','Changing the date must retain the opened child recipe');
 await page.route('**/rest/v1/rpc/publish_recipe_at',route=>{const args=route.request().postDataJSON();if(args.p_version!=='version-sauce')return route.fallback();assert.equal(args.p_effective_from,nextDate,'Pinned child publication must use the newly selected date');metadataVersions.set('recipe-sauce','4');versions.set('forward-sauce',{kind:'sauce',status:'published',revision:2});return route.fulfill({status:200,json:{recipe_id:'recipe-sauce',version_id:'forward-sauce',status:'published',effective_from:args.p_effective_from,prepared_from_version_id:args.p_version}});});
 await page.getByRole('button',{name:'Kiểm tra & công bố',exact:true}).click();await page.getByText('Đã công bố · phiên bản 2',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Chỉnh sửa',exact:true}).click();const childForm=page.getByRole('dialog');await childForm.getByLabel('Tên công thức *',{exact:true}).fill('Sốt đã chỉnh');await childForm.getByLabel('Thành phần 2',{exact:true}).selectOption('material-0');await childForm.getByRole('button',{name:'Lưu công thức',exact:true}).click();await childForm.waitFor({state:'detached'});await page.locator('.detail-head h3').filter({hasText:'Sốt đã chỉnh'}).waitFor();await page.getByText('Đã công bố · phiên bản 3',{exact:true}).waitFor();assert.equal(savedRequests.at(-1).p_id,'recipe-sauce','Saving an opened child must retain its recipe identity');assert.equal(savedRequests.at(-1).p_expected_version,'4','Editing a pinned recipe after forward publication must use refreshed recipe metadata');
 await page.goto(base+'/app/recipes?approve-recipe');await page.route('**/rest/v1/rpc/publish_recipe_at',route=>route.fulfill({status:404,json:{code:'PGRST202',message:'Could not find public.publish_recipe_at in the schema cache'}}));await page.getByRole('button',{name:'Kiểm tra & công bố',exact:true}).click();await page.getByText(/Cần áp dụng bản cập nhật 090/).waitFor();assert.equal(legacyPublications,0,'Missing update 090 must never fall back to the legacy publisher');
 report.checks.push('6 recipe routes × 5 widths; verified formula units; forward date and returned-version selection; publication of every recipe kind on save; child edit stays selected; schema update 090 diagnostic; identical uncertain retries; synthetic data only');
}

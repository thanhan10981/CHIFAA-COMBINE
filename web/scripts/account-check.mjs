export async function checkAccounts(page,base,out,report){
 let invited=false,invitePayload=null,savePayload=null,authListRequests=0;
 const profiles=[
  {id:'account-employee-1',display_name:'Tĩnh Trương',enabled:true,created_at:'2026-10-10T00:00:00.000Z'},
  {id:'account-employee-2',display_name:'Võ Thanh An',enabled:false,created_at:'2026-11-17T00:00:00.000Z'},
 ];
 const listed=()=>invited?[...profiles,{id:'account-employee-3',display_name:'Nguyễn Minh Đức',enabled:false,created_at:new Date().toISOString()}]:profiles;
 await page.route('**/functions/v1/admin-invite',async route=>{
  const body=route.request().postDataJSON();
  if(body?.action==='invite'){invitePayload=body;invited=true;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({invited:true,user_id:'account-employee-3',audit_logged:true})});}
  authListRequests++;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Auth identity listing unavailable"}'});
 });
 await page.route('**/rest/v1/profiles**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(listed())}));
 await page.route('**/rest/v1/role_permissions**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{role_id:'manager',module:'cash',action:'view'},{role_id:'manager',module:'inventory',action:'view'}])}));
 await page.route('**/rest/v1/user_permissions**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{module:'materials',action:'view',allowed:true},{module:'cash',action:'view',allowed:false}])}));
 await page.route('**/rest/v1/user_roles**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{user_id:'account-employee-1',role_id:'manager'}])}));
 await page.route('**/rest/v1/rpc/admin_assign_user',async route=>{savePayload=route.request().postDataJSON();return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({enabled:true})});});
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/app/admin');
 await page.getByRole('heading',{name:'Tài khoản & phân quyền',exact:true}).waitFor();
 await page.getByText('Tài khoản trong database',{exact:true}).waitFor();
 if(await page.locator('.account-status.active').count()!==1||await page.locator('.account-status.disabled').count()!==1||await page.getByText('Chờ xác nhận email',{exact:true}).count())throw new Error('Database account states are not clearly distinguished from Auth email state');
 const search=page.getByRole('textbox',{name:'Tìm theo tên hoặc mã tài khoản'});await search.fill('tinh truong');
 if(await page.getByRole('button',{name:/Tĩnh Trương/}).count()!==1||await page.getByRole('button',{name:/Võ Thanh An/}).count()!==0)throw new Error('Account search does not match Vietnamese names without diacritics');
 await search.fill('');
 await page.getByRole('button',{name:/Tĩnh Trương/}).click();
 await page.locator('.account-detail-heading').waitFor();
 await page.waitForFunction(()=>document.querySelector('.account-permissions')||document.querySelector('.accounts-load-error.inline'));
 if(!await page.locator('.account-permissions').count())throw new Error('Could not load the existing account permissions: '+(await page.locator('.account-details').innerText()));
 const matrix=page.locator('.account-permissions input[type="checkbox"]');
 if(await matrix.count()<100||await page.locator('.account-permissions input:checked').count()!==2||await page.getByRole('checkbox',{name:'Sổ quỹ Xem'}).isChecked()||!await page.getByRole('checkbox',{name:'Kho & tồn kho Xem'}).isChecked()||await page.locator('.account-role-chip.checked').count()!==1)throw new Error('Existing account overrides and permissions inherited from its role were not displayed');
 await page.screenshot({path:out+'/accounts-desktop.png',animations:'disabled'});
 const firstUnchecked=await matrix.evaluateAll(inputs=>inputs.findIndex(input=>!input.checked));if(firstUnchecked<0)throw new Error('Permission matrix has no editable unchecked permission');
 await matrix.nth(firstUnchecked).check();
 await page.getByRole('button',{name:'Lưu phân quyền',exact:true}).click();await page.getByRole('status').filter({hasText:'Đã lưu trạng thái và quyền'}).waitFor();
 if(!savePayload||savePayload.p_user!=='account-employee-1'||savePayload.p_overrides.filter(row=>row.allowed).length!==2)throw new Error('Permission save did not send the selected account and changed permission');
 report.checks.push('database-only account list/status; selecting an account loads DB roles and grants; saving updates DB via scoped RPC while Auth list endpoint is unavailable');
 await page.getByRole('button',{name:'Mời nhân viên',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Mời nhân viên mới'});await dialog.waitFor();
 await dialog.getByLabel('Tên nhân viên',{exact:true}).fill('Nguyễn Minh Đức');await dialog.getByLabel('Email đăng nhập',{exact:true}).fill('duc.nguyen@example.test');
 await dialog.getByRole('button',{name:'Gửi lời mời',exact:true}).click();await dialog.waitFor({state:'detached'});
 if(invitePayload?.action!=='invite'||invitePayload.full_name!=='Nguyễn Minh Đức'||invitePayload.email!=='duc.nguyen@example.test')throw new Error('New employee invitation did not send the name and email');
 await page.getByRole('button',{name:/Nguyễn Minh Đức/}).waitFor();
 if(await page.getByText('3 tài khoản trong hệ thống',{exact:true}).count()!==1)throw new Error('New invitation did not refresh the account registry');
 if(authListRequests!==0)throw new Error('Account page still depends on Auth user listing');
 report.checks.push('new employee invitation captures name/email, sends the invite and refreshes the registered account list');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(260);
 const mobileOverflow=await page.evaluate(()=>{window.scrollTo(500,0);const wrapper=document.querySelector('.account-permissions-wrap');const selectors=['html','body','.workspace','.sidebar','.main','.main main','.accounts-page','.accounts-layout','.account-details','.account-editor','.account-permissions-wrap','.account-permissions'];const state={width:document.documentElement.scrollWidth,viewport:innerWidth,pageScrollX:window.scrollX,matrixScrollWidth:wrapper?.scrollWidth,matrixClientWidth:wrapper?.clientWidth,overflowX:Object.fromEntries(selectors.map(selector=>{const element=document.querySelector(selector);if(!element)return [selector,null];const style=getComputedStyle(element),rect=element.getBoundingClientRect();return [selector,{width:rect.width,left:rect.left,right:rect.right,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,overflowX:style.overflowX,position:style.position,transform:style.transform,visibility:style.visibility,className:element.className}]}))};window.scrollTo(0,0);state.elementsPastViewport=Array.from(document.querySelectorAll('body *')).map(element=>{const rect=element.getBoundingClientRect(),style=getComputedStyle(element);return {tag:element.tagName,className:String(element.className?.baseVal??element.className??''),left:rect.left,right:rect.right,width:rect.width,overflowX:style.overflowX,position:style.position}}).filter(element=>element.width>0&&element.right>innerWidth+1).slice(0,20);return state;});
 if(mobileOverflow.pageScrollX>0||!mobileOverflow.matrixScrollWidth||mobileOverflow.matrixScrollWidth<=mobileOverflow.matrixClientWidth)throw new Error('Account and permissions page does not keep horizontal scrolling inside the permission matrix: '+JSON.stringify(mobileOverflow));
 await page.screenshot({path:out+'/accounts-mobile.png',animations:'disabled'});
 await page.getByRole('button',{name:'Mời nhân viên',exact:true}).click();await page.getByRole('dialog',{name:'Mời nhân viên mới'}).waitFor();
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Employee invite dialog overflows on mobile');
 await page.screenshot({path:out+'/accounts-invite-mobile.png',animations:'disabled'});
 report.checks.push('account directory, permission matrix and invite dialog fit mobile viewport');
}

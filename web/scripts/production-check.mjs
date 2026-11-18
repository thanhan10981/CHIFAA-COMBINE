import path from 'node:path';
export async function checkProduction(page,base,out,report){
 const routes=['production','entry-production','requirements','counts','consumption','variance'];
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const slug of routes){
   await page.goto(base+'/app/'+slug);await page.getByLabel('Kho nguyên liệu',{exact:true}).selectOption('pm-w');
   await page.getByText('Nguyên liệu kiểm thử đối chiếu',{exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('Production page overflow '+slug+' '+width);
   if(await page.getByText('8%',{exact:true}).count()!==1)throw new Error('Variance source or formatting missing');
   await page.screenshot({path:path.join(out,slug+'-'+width+'.png')});report.pages.push({slug,width,overflow:false});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/app/production');await page.getByLabel('Kho nguyên liệu',{exact:true}).selectOption('pm-w');
 await page.getByLabel('Kế hoạch SYN-P',{exact:true}).fill('30');
 if(!await page.getByLabel('Ngày kinh doanh',{exact:true}).isDisabled())throw new Error('Draft scope is not locked');
 await page.getByText('Sau lưu: 130',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Bỏ nhập chưa lưu',exact:true}).click();
 await page.getByLabel('Chế độ sản lượng',{exact:true}).selectOption('replace');
 await page.getByLabel('main SYN-P',{exact:true}).fill('90');await page.getByLabel('extra SYN-P',{exact:true}).fill('0');await page.getByLabel('rejected SYN-P',{exact:true}).fill('0');
 await page.getByText('Xem trước thay thế toàn ngày',{exact:false}).waitFor();
 if(!await page.getByLabel('main SYN-NO',{exact:true}).isDisabled())throw new Error('Missing recipe allows production');
 await page.goto(base+'/app/counts');await page.getByLabel('Kho nguyên liệu',{exact:true}).selectOption('pm-w');
 await page.getByRole('button',{name:'Nguyên liệu kiểm thử đối chiếu',exact:true}).click();
 await page.getByText('Nhập đối chiếu thủ công có bằng chứng',{exact:true}).click();
 await page.getByLabel('incoming',{exact:true}).fill('0');await page.getByLabel('closing',{exact:true}).fill('9,4');
 if(!await page.getByLabel('Ngày kinh doanh',{exact:true}).isDisabled())throw new Error('Physical count scope changed while editing');
 const sent=[];
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/save_material_usage',async route=>{sent.push(route.request().postDataJSON());if(sent.length===1)await route.abort();else await route.fulfill({status:200,contentType:'application/json',body:'{"id":"synthetic-saved"}'});});
 await page.getByRole('button',{name:'Lưu bản kiểm kê thay thế có lịch sử',exact:true}).click();
 await page.getByRole('button',{name:'Kiểm tra lại lần lưu chưa xác nhận',exact:true}).waitFor();
 if(!await page.getByLabel('closing',{exact:true}).isDisabled())throw new Error('Uncertain write unlocked input');
 await page.getByRole('button',{name:'Kiểm tra lại lần lưu chưa xác nhận',exact:true}).click();
 await page.getByText('Đã lưu — database xác nhận giao dịch và lịch sử.',{exact:true}).waitFor();
 if(sent.length!==2||JSON.stringify(sent[0])!==JSON.stringify(sent[1])||sent[0].p_values.closing!=='9.4')throw new Error('Retry payload or decimal normalization changed');
 await page.goto(base+'/app/counts');await page.getByLabel('Kho nguyên liệu',{exact:true}).selectOption('pm-w');
 await page.getByRole('button',{name:'Nguyên liệu kiểm thử đối chiếu',exact:true}).click();
 await page.getByLabel('Lý do đối soát chứng từ',{exact:true}).fill('Nguồn kiểm kê tổng hợp đã đối chiếu');
 if(!await page.getByLabel('Ngày kinh doanh',{exact:true}).isDisabled())throw new Error('Document reconciliation draft does not lock scope');
 let documentRequest;
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/save_material_usage_from_evidence',async route=>{documentRequest=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:'{"id":"synthetic-document-saved"}'});});
 await page.getByRole('button',{name:'Lưu đối chiếu từ chứng từ',exact:true}).click();
 await page.getByText('Đã lưu — database xác nhận giao dịch và lịch sử.',{exact:true}).waitFor();
 if(documentRequest?.p_version!=='synthetic-evidence-token'||'p_values' in documentRequest)throw new Error('Document-derived usage accepted client-side quantities');
 await page.goto(base+'/app/production');await page.getByLabel('Kho nguyên liệu',{exact:true}).selectOption('pm-w');
 await page.getByLabel('Chế độ sản lượng',{exact:true}).selectOption('cancel');await page.getByLabel('Lý do / chứng từ',{exact:true}).fill('Hủy số nhập sai đã đối chiếu');
 await page.getByLabel('Xác nhận hủy số nhập sai',{exact:true}).check();let cancelRequest;
 await page.route('https://visual-fixture.supabase.co/rest/v1/rpc/replace_production_day',async route=>{cancelRequest=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:'{"batch_id":"synthetic-zero","cancelled_entry":true}'});});
 await page.getByRole('button',{name:'Xác nhận hủy số nhập sai & đảo định mức',exact:true}).click();
 await page.getByText('Đã lưu — database xác nhận giao dịch và lịch sử.',{exact:true}).waitFor();
 if(!Array.isArray(cancelRequest?.p_lines)||cancelRequest.p_lines.length||cancelRequest.p_started!==null||cancelRequest.p_finished!==null)throw new Error('Cancellation fabricated production times/quantities');
 report.checks.push('029 document-derived reconciliation sends a source version and no client quantities; cancellation sends explicit empty replacement without fabricated production timestamps');
 report.checks.push('Production/material routes at 5 widths; plan preview; full-day replacement preview; missing-recipe guard; physical count scope/decimal comma; uncertain write retry keeps identical payload/key');
}

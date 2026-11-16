import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {gas} from './gas-mock.mjs';import {send} from './auth-helpers.mjs';
const id=()=>crypto.randomUUID();
function admin(){const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin-sub').token;return {g,token,rpc:(action,args={})=>send(g,action,{token,...args})};}
test('paginated server reads beyond 5000 rows, filters and exports without truncation; stale cursor is rejected',()=>{
 const {g,rpc}=admin(),sheet=g.tables.get('materials');for(let i=0;i<5101;i++)sheet.appendRow(g.ctx.cells_('materials',{recordId:'m'+i,version:1,name:'Material '+i,purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:1,minimum:0}));
 const b=rpc('bootstrap');assert.equal(b.ok,true);assert.equal(b.data.data.materials.length,200);assert.equal(b.data.partialModules.materials.total,5101);
 const p=rpc('list',{module:'materials',offset:5000,limit:200,stamp:b.data.stamp});assert.equal(p.data.rows.length,101);assert.equal(p.data.next,null);
 assert.equal(rpc('list',{module:'materials',search:'Material 5100'}).data.rows[0].recordId,'m5100');
 let offset=0,total=0;do{const page=rpc('export',{module:'materials',offset,limit:200,stamp:b.data.stamp});assert.equal(page.ok,true);total+=page.data.rows.length;offset=page.data.next;}while(offset!=null);assert.equal(total,5101);
 g.ctx.bump_();assert.equal(rpc('list',{module:'materials',stamp:b.data.stamp}).error.code,'CONFLICT');assert.equal(rpc('list',{module:'_Users'}).error.code,'VALIDATION');
});
test('scoped financial summary returns own debt balance without granting raw cash or employee data',()=>{
 const {g}=admin();g.ctx.writeRow_('debts',{recordId:'d',version:1,name:'A',type:'phai-thu',amount:100,date:'2026-01-01',dueDate:'2026-02-01'});g.ctx.writeRow_('cash',{recordId:'c',version:1,date:'2026-01-02',direction:'thu',account:'cash',category:'thu-no',linkedId:'d',amount:30});
 g.ctx.append_('_Users',['accountant','a@example.com','accountant',JSON.stringify({debts:['read']}),true,1]);const token=g.ctx.issueSession_('a@example.com','a-sub').token;
 const r=send(g,'financialSummary',{token,module:'debts',to:'2026-01-03'});assert.equal(r.data.rows[0].remaining,70);assert.equal(Object.keys(r.data).join(','),'rows');assert.equal(send(g,'list',{token,module:'cash'}).error.code,'FORBIDDEN');assert.equal(send(g,'financialSummary',{token,module:'loans',to:'2026-01-03'}).error.code,'FORBIDDEN');
});
test('maintenance initialization is idempotent, backup is registered, restore creates separate copy and triggers deduplicate',()=>{
 const {g,rpc}=admin();assert.equal(rpc('maintenance',{operation:'initialize'}).ok,true);assert.equal(rpc('maintenance',{operation:'configure',BACKUP_FOLDER_ID:'test-folder-id-123456'}).ok,true);
 const backup=rpc('maintenance',{operation:'backup'});assert.equal(backup.ok,true);assert.equal(g.books.size,2);
 const restored=rpc('maintenance',{operation:'restore',backupId:backup.data.fileId});assert.equal(restored.ok,true);assert.notEqual(restored.data.reviewSpreadsheetId,'test');assert.equal(g.properties.get('SPREADSHEET_ID'),'test');assert.equal(g.books.size,3);
 assert.equal(rpc('maintenance',{operation:'restore',backupId:'unregistered-backup-123456'}).error.code,'FORBIDDEN');
 rpc('maintenance',{operation:'installTriggers'});rpc('maintenance',{operation:'installTriggers'});assert.equal(g.triggers.length,4);assert.ok(g.triggers.some(t=>t.handler==='backup_'&&t.days===1));
});
test('import UI backend preview is read-only, applies once and rejects locked periods or duplicate IDs',()=>{
 const {g,rpc}=admin(),bundle={records:[{module:'materials',recordId:'imported',record:{name:'M',purchaseUnit:'kg',unit:'g',conversion:1000,purchasePrice:10,minimum:0}}]};
 const p=rpc('maintenance',{operation:'previewImport',bundle});assert.equal(p.data.errors.length,0);assert.equal(g.ctx.rawRows_('materials').length,0);
 const args={operation:'applyImport',bundle,digest:p.data.digest,key:id()};assert.equal(rpc('maintenance',args).ok,true);assert.equal(rpc('maintenance',args).ok,true);assert.equal(g.ctx.rawRows_('materials').length,1);assert.ok(g.ctx.rowsPlain_('_Requests').some(r=>r[1]==='admin@example.com'));
 assert.equal(rpc('maintenance',{operation:'previewImport',bundle}).data.errors.length,1);
 rpc('workflow',{kind:'close',from:'2026-11-01',to:'2026-11-30',note:'Period reviewed',key:id()});const cash={records:[{module:'cash',recordId:'cash-import',record:{date:'2026-11-02',direction:'thu',account:'cash',amount:1,category:'von-dau',linkedId:'',note:''}}]};assert.match(rpc('maintenance',{operation:'previewImport',bundle:cash}).data.errors[0].message,/CLOSED/);
});
test('Portal clock job imports once, writes approval back and status stays within the exact invitation',()=>{
 const {g,rpc}=admin();g.ctx.writeRow_('stores',{recordId:'s',version:1,name:'Store',address:'',contact:''});g.ctx.writeRow_('dishes',{recordId:'d',version:1,name:'Meal',price:30,published:true});
 const portal=g.makeBook('portal-book-id-123456');g.properties.set('SPREADSHEET_ID',portal.getId());g.properties.set('APP_MODE','portal');g.ctx.setup_();g.properties.set('SPREADSHEET_ID','test');g.properties.set('APP_MODE','internal');g.properties.set('PORTAL_SPREADSHEET_ID',portal.getId());
 assert.equal(rpc('maintenance',{operation:'portalSync'}).ok,true);const invite=g.ctx.invite_('s','Customer',7),other=g.ctx.invite_('s','Other',7);
 g.properties.set('SPREADSHEET_ID',portal.getId());g.properties.set('APP_MODE','portal');const order=g.ctx.portalOrder_({invite,key:id(),record:{date:'2099-01-01',shift:'Morning',dishId:'d',quantity:2,contact:'Phone',customer:'Customer'}});const orderId=order.ids[0];assert.equal(g.ctx.portalStatus_({invite,id:orderId}).status,'pending');assert.throws(()=>g.ctx.portalStatus_({invite:other,id:orderId}),/NOT_FOUND/);
 g.properties.set('SPREADSHEET_ID','test');g.properties.set('APP_MODE','internal');assert.equal(rpc('maintenance',{operation:'portalSync'}).data.imported,1);assert.equal(rpc('maintenance',{operation:'portalSync'}).data.imported,0);const local=g.ctx.rawRows_('orders')[0];assert.equal(rpc('mutate',{module:'orders',operation:'approve',id:local.recordId,expectedVersion:local.version,expectedHash:local._hash,key:id()}).ok,true);assert.equal(rpc('maintenance',{operation:'portalSync'}).data.updated,1);
 rpc('maintenance',{operation:'installTriggers'});assert.equal(g.triggers.some(t=>t.handler==='portalSync_'),false);g.properties.set('PORTAL_WEB_APP_URL','https://script.google.com/macros/s/portal-dev-id/exec');rpc('maintenance',{operation:'installTriggers'});assert.ok(g.triggers.some(t=>t.handler==='portalSync_'&&t.minutes===5));g.properties.set('SPREADSHEET_ID',portal.getId());g.properties.set('APP_MODE','portal');assert.equal(g.ctx.portalStatus_({invite,id:orderId}).status,'approved');
});
test('interest preview/posts cannot overlap, backdated principal correction and direct linked cash reversal are blocked',()=>{
 const {g,rpc}=admin();g.ctx.writeRow_('loans',{recordId:'l',version:1,name:'Bank',principal:36500,annualRate:.1,date:'2026-01-01',dueDate:'2027-01-01'});const args={kind:'interest',id:'l',from:'2026-01-01',to:'2026-01-11',basis:'manual',amount:125,account:'bank'};
 assert.equal(rpc('workflow',{...args,preview:true,key:id()}).data.preview.interest,125);assert.equal(g.ctx.rawRows_('cash').length,0);const key=id();assert.equal(rpc('workflow',{...args,key}).ok,true);assert.equal(rpc('workflow',{...args,key}).ok,true);assert.equal(g.ctx.rawRows_('cash')[0].amount,125);assert.equal(rpc('workflow',{...args,key:id()}).error.code,'CONFLICT');
 const payment={date:'2026-01-05',direction:'chi',account:'bank',amount:100,category:'tra-vay',linkedId:'l',note:''};assert.equal(rpc('mutate',{module:'cash',operation:'create',record:payment,key:id()}).error.code,'CLOSED');const c=g.ctx.rawRows_('cash')[0];assert.equal(rpc('mutate',{module:'cash',operation:'reverse',id:c.recordId,expectedVersion:c.version,expectedHash:c._hash,key:id()}).error.code,'LINKED');
});

test('manual interest rejects automatic modes, missing or invalid amounts and records the entered amount independently of rate',()=>{
 const {g,rpc}=admin();g.ctx.writeRow_('loans',{recordId:'manual',version:1,name:'Manual loan',principal:36500,annualRate:.1,date:'2026-01-01',dueDate:'2027-01-01'});
 const args={kind:'interest',id:'manual',from:'2026-01-01',to:'2026-01-11',basis:'manual',amount:4321,account:'bank',preview:true};
 for(const invalid of [{basis:'actual365'},{amount:null},{amount:0},{amount:-1},{amount:'123'},{from:'bad'},{to:'2026-01-01'}])assert.equal(rpc('workflow',{...args,...invalid,key:id()}).error.code,'VALIDATION');
 const p=rpc('workflow',{...args,key:id()});assert.equal(p.data.preview.interest,4321);assert.equal(p.data.preview.basis,'manual');assert.equal(g.ctx.rawRows_('cash').length,0);
 assert.equal(rpc('workflow',{...args,preview:false,key:id()}).ok,true);assert.equal(g.ctx.rawRows_('cash')[0].amount,4321);
});

test('large imports use hashed journal chunks and recover PREPARED transactions without partial records',()=>{
 const {g,rpc}=admin(),bundle={records:Array.from({length:120},(_,i)=>({module:'materials',recordId:'large-'+i,record:{name:'Material '+i+'x'.repeat(700),purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:1,minimum:0}}))};
 const p=rpc('maintenance',{operation:'previewImport',bundle});assert.equal(p.data.errors.length,0);const key=id(),r=rpc('maintenance',{operation:'applyImport',bundle,digest:p.data.digest,key});assert.equal(r.ok,true);const journal=g.ctx.rowsPlain_('_Requests').find(r=>r[0]===key);assert.ok(JSON.parse(journal[4]).chunks);assert.equal(g.ctx.journalEffects_(journal[4]).length,120);
 const s=g.tables.get('_Requests'),index=s.rows.findIndex(r=>r[0]===key);s.rows[index][3]='PREPARED';assert.equal(rpc('maintenance',{operation:'recover'}).ok,true);assert.equal(g.ctx.rawRows_('materials').length,0);assert.equal(s.rows[index][3],'ROLLED_BACK');
});
test('formula-like operation notes are rejected before they can enter Sheets',()=>{const {rpc}=admin();assert.equal(rpc('workflow',{kind:'close',from:'2026-11-01',to:'2026-11-30',note:'=IMPORTXML("x")',key:id()}).error.code,'VALIDATION');});

test('DEV resource setup creates isolated Portal and private backup folder without exposing signing secret',()=>{
 const {g,rpc}=admin();const a=rpc('maintenance',{operation:'createBackupFolder'});assert.equal(a.ok,true);assert.equal(rpc('maintenance',{operation:'createBackupFolder'}).data.folderId,a.data.folderId);g.folders.get(a.data.folderId).shared=true;assert.equal(rpc('maintenance',{operation:'backup'}).error.code,'FORBIDDEN');g.folders.get(a.data.folderId).shared=false;
 const portal=rpc('maintenance',{operation:'createPortalWorkbook'});assert.equal(portal.ok,true);assert.notEqual(portal.data.spreadsheetId,'test');assert.equal(g.properties.get('PORTAL_SPREADSHEET_ID'),portal.data.spreadsheetId);assert.equal(g.books.get(portal.data.spreadsheetId).getSheetByName('employees'),undefined);assert.doesNotMatch(JSON.stringify(portal),new RegExp(g.properties.get('PORTAL_SIGNING_SECRET')));assert.equal(rpc('maintenance',{operation:'createPortalWorkbook'}).error.code,'CONFLICT');
});

test('accountant can post linked interest without reading cash and cannot forge a direct cash transaction',()=>{
 const {g}=admin();g.ctx.writeRow_('loans',{recordId:'l',version:1,name:'Loan',principal:36500,annualRate:.1,date:'2026-01-01',dueDate:'2027-01-01'});g.ctx.append_('_Users',['acct','acct@example.com','accountant',JSON.stringify({_routes:['entry-loans'],loans:['read','approve'],cash:['create']}),true,1]);const token=g.ctx.issueSession_('acct@example.com','acct-sub').token;
 const args={token,key:id(),kind:'interest',id:'l',from:'2026-01-01',to:'2026-01-11',basis:'manual',amount:125,account:'bank'};assert.equal(send(g,'workflow',args).ok,true);assert.equal(send(g,'list',{token,module:'cash'}).error.code,'FORBIDDEN');assert.equal(send(g,'mutate',{token,key:id(),module:'cash',operation:'create',record:{date:'2026-01-11',direction:'thu',account:'cash',amount:1000,category:'von-dau',linkedId:'',note:''}}).error.code,'FORBIDDEN');assert.equal(send(g,'bootstrap',{token}).data.data.cash,undefined);
 g.tables.get('_Users').rows[2][3]=JSON.stringify({_routes:['entry-loans'],loans:['read']});assert.equal(send(g,'workflow',args).error.code,'FORBIDDEN');assert.equal(g.ctx.rawRows_('cash').length,1);
});

import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {gas} from './gas-mock.mjs';import {send} from './auth-helpers.mjs';
const material={name:'Rice',purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0};
test('saving a catalog record reads only its own business table, not 17 modules',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,seen=new Set(),raw=g.ctx.rawRows_;g.ctx.rawRows_=(m,...rest)=>{seen.add(m);return raw(m,...rest);};
 assert.equal(send(g,'mutate',{token,module:'materials',operation:'create',key:crypto.randomUUID(),record:material}).ok,true);
 assert.deepEqual([...seen].filter(m=>!m.startsWith('_')),['materials']);
});
test('transaction groups contiguous rows and audit into batches without losing rollback/idempotency',()=>{
 const g=gas(),effects=Array.from({length:25},(_,i)=>({module:'materials',before:null,after:{recordId:'m'+i,version:1,...material}})),key=crypto.randomUUID(),before=g.metrics.setValues;
 const r=g.ctx.transact_('fixture',key,{action:'IMPORT'},effects);assert.equal(r.ids.length,25);assert.equal(g.metrics.setValues-before,3);assert.equal(g.ctx.rawRows_('materials').length,25);assert.equal(g.ctx.rowsPlain_('_Audit').filter(r=>r[3]==='IMPORT').length,25);
 assert.equal(g.ctx.transact_('fixture',key,{action:'IMPORT'},effects).ids.length,25);assert.equal(g.ctx.rawRows_('materials').length,25);
 const fail=gas();fail.failNext('materials');assert.throws(()=>fail.ctx.transact_('fixture',key,{action:'IMPORT'},effects));assert.equal(fail.ctx.rawRows_('materials').length,0);assert.equal(fail.properties.has('WRITE_IN_PROGRESS'),false);
});
test('reads refuse to publish a partially committed transaction',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;g.properties.set('WRITE_IN_PROGRESS','pending');
 for(const action of ['bootstrap','list','export'])assert.equal(send(g,action,{token,module:'materials'}).error.code,'BUSY');
 assert.equal(send(g,'health',{token}).ok,true);
});
test('module versions invalidate only touched business modules and raw reads release across requests',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,before=g.ctx.moduleVersions_();
 send(g,'mutate',{token,module:'materials',operation:'create',key:crypto.randomUUID(),record:material});const after=g.ctx.moduleVersions_();assert.notEqual(after.materials,before.materials);assert.equal(after.sales,before.sales);
 send(g,'list',{token,module:'materials'});g.tables.get('materials').rows[1][11]=999;assert.equal(send(g,'list',{token,module:'materials',force:true}).data.rows[0].purchasePrice,999);
});
test('request profiling logs module timings without row contents, identity or credentials',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,logs=[];g.ctx.console.log=v=>logs.push(v);send(g,'bootstrap',{token,force:true});const line=logs.find(v=>v.includes('rpc_profile'));assert.ok(line);assert.match(line,/read:materials/);assert.doesNotMatch(line,new RegExp(token+'|admin@example.com|signingKey'));
});
test('shell bootstrap loads permissions and versions without reading business tables',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,raw=g.ctx.rawRows_,seen=[];g.ctx.rawRows_=(m,...args)=>{seen.push(m);return raw(m,...args);};
 const value=send(g,'bootstrap',{token,shell:true,force:true});assert.equal(value.ok,true);assert.equal(seen.length,0);assert.equal(Object.keys(value.data.permissions).length,17);assert.ok(value.data.partialModules.sales);assert.equal(value.data.data.sales.length,0);
});
test('page cache reduces Sheets reads but rechecks disabled user, permission scope and explicit force',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;g.ctx.writeRow_('materials',{recordId:'m',version:1,...material});
 send(g,'list',{token,module:'materials'});let reads=0,raw=g.ctx.rawRows_;g.ctx.rawRows_=(...args)=>{reads++;return raw(...args);};send(g,'list',{token,module:'materials'});assert.equal(reads,0);
 g.tables.get('materials').rows[1][11]=99;assert.equal(send(g,'list',{token,module:'materials',force:true}).data.rows[0].purchasePrice,99);
 g.ctx.append_('_Users',['staff','staff@example.com','staff','{}',true,1]);const staff=g.ctx.issueSession_('staff@example.com','staff').token;assert.equal(send(g,'list',{token:staff,module:'materials'}).error.code,'FORBIDDEN');
 g.tables.get('_Users').rows[1][4]=false;assert.equal(send(g,'list',{token,module:'materials'}).error.code,'AUTH');
});
test('server Dashboard preserves shared accounting, pages all settlements, caches aggregate and rejects missing permissions',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,put=(m,r)=>g.ctx.writeRow_(m,{version:1,...r});put('stores',{recordId:'s',name:'Store'});put('dishes',{recordId:'d',name:'Meal',price:30,published:false});
 const sale={date:'2026-11-16',storeId:'s',dishId:'d',delivered:1,sold:1,returned:0,creditQty:0,price:30,discount:0,recoveryPrice:0,cash:30,bank:0,oldDebtPaid:0,otherCost:0};
 for(let i=0;i<165;i++)put('sales',{recordId:'s'+i,...sale});const args={token,from:'2026-11-16',to:'2026-11-16'};
 const r=send(g,'summary',args);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.data.report.revenue,4950);assert.equal(r.data.report.revenue,g.ctx.report(g.ctx.data_(),args.from,args.to).revenue);assert.equal(r.data.settlements.rows.length,100);assert.equal(r.data.settlements.total,165);
 const next=send(g,'settlements',{...args,offset:100});assert.equal(next.data.rows.length,65);assert.equal(next.data.next,null);assert.doesNotMatch(JSON.stringify(r.data),/updatedBy|hourlyRate|signingKey/);
 let businessReads=0,raw=g.ctx.rawRows_;g.ctx.rawRows_=(m,...args)=>{if(!m.startsWith('_'))businessReads++;return raw(m,...args);};assert.equal(send(g,'summary',args).ok,true);assert.equal(businessReads,0);
 g.ctx.append_('_Users',['acct','acct@example.com','accountant','{"sales":["read"]}',true,1]);const accountant=g.ctx.issueSession_('acct@example.com','acct').token;assert.equal(send(g,'summary',{...args,token:accountant}).error.code,'FORBIDDEN');
});
test('onEdit reads only the changed module and does not rewrite unrelated sync hashes',()=>{
 const g=gas();g.ctx.writeRow_('materials',{recordId:'m',version:1,...material});g.ctx.writeRow_('dishes',{recordId:'d',version:1,name:'Dish',price:10,published:false});g.ctx.scanSheets_();const prior=g.ctx.rowsPlain_('_Sync').find(r=>r[0]==='dishes'),versions=g.ctx.moduleVersions_(),raw=g.ctx.rawRows_,seen=[];g.ctx.rawRows_=(m,...a)=>{seen.push(m);return raw(m,...a);};
 g.tables.get('materials').rows[1][11]=25;const before={...g.metrics};g.ctx.sheetEdited_({source:g.ctx.db_(),range:{getSheet:()=>({getName:()=> 'materials'})}});assert.deepEqual(seen,['materials']);assert.equal(g.metrics.cellsWritten-before.cellsWritten,19);assert.deepEqual(g.ctx.rowsPlain_('_Sync').find(r=>r[0]==='dishes'),prior);assert.notEqual(g.ctx.moduleVersions_().materials,versions.materials);assert.equal(g.ctx.moduleVersions_().dishes,versions.dishes);
});
test('unchanged scans perform no writes and bounded reconciler covers every module',()=>{
 const g=gas();g.ctx.writeRow_('materials',{recordId:'m',version:1,...material});g.ctx.scanSheets_();const before=g.metrics.setValues;g.ctx.scanSheets_();assert.equal(g.metrics.setValues,before);
 const seen=new Set(),raw=g.ctx.rawRows_;g.ctx.rawRows_=(m,...a)=>{seen.add(m);return raw(m,...a);};for(let i=0;i<5;i++)g.ctx.scanSlice_();assert.equal([...seen].filter(m=>!m.startsWith('_')).length,17);
});
test('structure trigger invalidates caches without deleting history or pretending to know the editor',()=>{
 const g=gas();g.ctx.writeRow_('materials',{recordId:'m',version:1,...material});const stamp=g.ctx.stamp_();g.ctx.sheetChanged_({source:g.ctx.db_(),changeType:'REMOVE_ROW'});assert.notEqual(g.ctx.stamp_(),stamp);assert.equal(g.ctx.rawRows_('materials').length,1);const audit=g.ctx.rowsPlain_('_Audit').at(-1);assert.equal(audit[2],'SHEET_EDITOR_UNVERIFIED');assert.equal(audit[3],'STRUCTURE_CHANGE');
});
test('public asset endpoint cannot read arbitrary private files or open Sheets',()=>{
 const g=gas(),before=g.metrics.open;assert.equal(g.ctx.rpc('publicAsset',{id:'exceljs-4.4.0'}).data.source,'PUBLIC_EXCEL_TEST_SOURCE');assert.equal(g.metrics.open,before);for(const id of ['_Users','Code','Index','../Code'])assert.equal(g.ctx.rpc('publicAsset',{id}).error.code,'NOT_FOUND');
});
test('Strategy server uses the same model and keeps partial permission scopes out of cached aggregates',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,from='2026-11-16',result=send(g,'strategySummary',{token,period:'day',anchor:from});assert.equal(result.ok,true);assert.equal(result.data.aggregate.revenue,g.ctx.strategyAggregate(g.ctx.data_(),from,from).revenue);
 assert.equal(result.data.profitSeries.length,12);assert.doesNotMatch(JSON.stringify(result),/employeeId|hourlyRate|updatedBy/);
});
test('physical snapshot pages read only the requested window, preserve sparse rows and exact hashes',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,sheet=g.tables.get('materials');for(let i=0;i<1001;i++)sheet.appendRow(g.ctx.cells_('materials',{recordId:'m'+i,version:1,...material}));sheet.rows[1000]=Array(13).fill('');
 const before={...g.metrics},result=send(g,'export',{token,module:'materials',window:true,offset:999,limit:2,force:true});assert.equal(result.ok,true);assert.equal(result.data.rows.length,1);assert.equal(result.data.rows[0].recordId,'m1000');assert.equal(result.data.next,null);assert.ok(g.metrics.cellsRead-before.cellsRead<150);assert.equal(Object.hasOwn(result.data.rows[0],'_cells'),false);
 assert.equal(result.data.rows[0]._hash,g.ctx.rawRows_('materials').at(-1)._hash);
});
test('single-cell edit processes only that row and never treats unseen rows as deletions',()=>{
 const g=gas(),sheet=g.tables.get('materials');for(let i=0;i<1001;i++)sheet.appendRow(g.ctx.cells_('materials',{recordId:'m'+i,version:1,...material}));g.ctx.scanSheets_();const others=g.ctx.rowsPlain_('_Sync').filter(r=>r[1]!=='m0').map(r=>r.join('|'));
 sheet.rows[1][11]=99;const before=g.metrics.cellsRead;g.ctx.sheetEdited_({source:g.ctx.db_(),range:{getSheet:()=>({getName:()=> 'materials'}),getRow:()=>2,getNumRows:()=>1,getColumn:()=>12}});assert.ok(g.metrics.cellsRead-before<4200);assert.deepEqual(g.ctx.rowsPlain_('_Sync').filter(r=>r[1]!=='m0').map(r=>r.join('|')),others);assert.equal(sheet.rows[1][1],2);assert.equal(sheet.rows[2][1],1);
});
test('workflow-only debt allocations invalidate augmented loan/debt/production module caches',()=>{
 const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;g.ctx.writeRow_('debts',{recordId:'d',version:1,name:'Customer',type:'phai-thu',amount:100,date:'2026-11-01',dueDate:'2026-12-01'});
 const before=g.ctx.moduleVersions_();assert.equal(send(g,'list',{token,module:'debts'}).data.rows[0].allocations.length,0);
 g.ctx.transact_('fixture',crypto.randomUUID(),{action:'WORKFLOW'},[{module:'_Workflows',before:null,after:{recordId:'allocation',version:1,date:'2026-11-16',kind:'debt',referenceId:'legacy-sale',details:JSON.stringify({saleId:'legacy-sale',allocations:[{id:'d',amount:30}]})}}]);
 const after=g.ctx.moduleVersions_();for(const m of ['production','debts','loans'])assert.notEqual(after[m],before[m]);assert.equal(after.materials,before.materials);assert.equal(send(g,'list',{token,module:'debts'}).data.rows[0].allocations[0].amount,30);
});
test('eight isolated users cannot reuse another users cached page or replay proof',()=>{
 const g=gas();g.ctx.writeRow_('materials',{recordId:'m',version:1,...material});
 const tokens=[];for(let i=0;i<8;i++){g.ctx.append_('_Users',['staff'+i,'staff'+i+'@example.com','staff',i%2?'{}':'{"materials":["read"]}',true,1]);tokens.push(g.ctx.issueSession_('staff'+i+'@example.com','subject'+i).token);}
 for(let turn=0;turn<3;turn++)for(const [i,token]of tokens.entries()){const response=send(g,'list',{token,module:'materials'});if(i%2)assert.equal(response.error.code,'FORBIDDEN');else assert.equal(response.data.rows[0].name,'Rice');}
 assert.equal(g.ctx.rowsPlain_('_AuthRequests').length,24);
});

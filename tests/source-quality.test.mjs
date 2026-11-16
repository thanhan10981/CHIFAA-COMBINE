import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {gas} from './gas-mock.mjs';
import {send} from './auth-helpers.mjs';
import {sourceIssues} from '../src/shared/domain.js';
const material={recordId:'m',version:1,name:'Rice',purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0};
test('Direct Sheets allowance duplicates cannot enter payroll; correcting source unblocks preview without rewriting history',()=>{
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,put=(m,r)=>g.ctx.writeRow_(m,{version:1,deleted:false,reverses:'',...r});
  put('employees',{recordId:'e',name:'Employee',department:'SX',hourlyRate:10,allowance:5});
  const a={date:'2026-11-01',employeeId:'e',start:'08:00',end:'10:00',breakMinutes:0,hourlyRate:10,department:'SX',defaultAllowance:5,dailyAllowance:0,support:0,advance:0,deduction:0};
  put('attendance',{...a,recordId:'a'});put('attendance',{...a,recordId:'b',start:'11:00',end:'12:00'});
  const request={token,kind:'payroll',from:a.date,to:a.date,account:'bank',bonuses:[],preview:true,key:crypto.randomUUID()};
  assert.equal(send(g,'workflow',request).error.code,'DATA_INVALID');assert.equal(g.ctx.rawRows_('cash').length,0);
  put('attendance',{...a,recordId:'b',start:'11:00',end:'12:00',defaultAllowance:0});
  const preview=send(g,'workflow',{...request,key:crypto.randomUUID()});assert.equal(preview.ok,true,JSON.stringify(preview));assert.equal(preview.data.preview.total,35);
  assert.equal(g.ctx.rawRows_('attendance').length,2);assert.equal(g.ctx.rawRows_('cash').length,0);
});
test('Source validation catches direct overnight overlap and excludes reversed shifts',()=>{
  const a={recordId:'a',version:1,date:'2026-11-01',employeeId:'e',start:'23:00',end:'07:00',breakMinutes:0,hourlyRate:10,department:'SX',defaultAllowance:0,dailyAllowance:0,support:0,advance:0,deduction:0},b={...a,recordId:'b',date:'2026-11-02',start:'06:00',end:'08:00'};
  assert.equal(sourceIssues({attendance:[a,b]}).length,2);
  assert.equal(sourceIssues({attendance:[a,b,{...b,recordId:'reverse-b',reverses:'b'}]}).length,0);
});
function fixture(){const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin-sub').token;return {g,token};}
test('source validation checks scalars with unavailable reference permissions, duplicate IDs and recipe cycles',()=>{
 const sale={recordId:'s',version:1,date:'2026-11-01',storeId:'private-store',dishId:'private-dish',delivered:1,sold:1,returned:0,creditQty:0,price:10,discount:0,recoveryPrice:0,otherCost:0,cash:10,bank:0,oldDebtPaid:0};
 assert.equal(sourceIssues({sales:[sale]}).length,0);
 assert.equal(sourceIssues({sales:[{...sale,price:'#REF!'}]}).length,1);
 assert.equal(sourceIssues({materials:[material,material]}).length,2);
 const recipe={recordId:'r',version:1,name:'Loop',kind:'mon',dishId:'d',yield:1,lines:[{type:'recipe',id:'r',quantity:1}]};
 assert.match(sourceIssues({recipes:[recipe]})[0].message,/vòng lặp/);
});
test('bootstrap detects errors beyond the first page without exposing unauthorized tables',()=>{
 const {g,token}=fixture();for(let i=0;i<201;i++)g.ctx.writeRow_('materials',{...material,recordId:'m'+i});
 g.tables.get('materials').rows[201][11]='#REF!';
 g.ctx.writeRow_('employees',{recordId:'secret-person',version:1,name:'Private salary',hourlyRate:'#REF!'});
 g.ctx.append_('_Users',['staff','staff@example.com','staff','{"materials":["read"]}',true,1]);
 const staff=g.ctx.issueSession_('staff@example.com','staff-sub').token;
 const result=send(g,'bootstrap',{token:staff,force:true});assert.equal(result.ok,true);
 assert.equal(result.data.data.materials.length,200);assert.equal(result.data.issues.length,1);assert.equal(result.data.issues[0].id,'m200');
 assert.doesNotMatch(JSON.stringify({data:result.data.data,issues:result.data.issues}),/secret-person|Private salary|employees/);
 assert.ok(send(g,'bootstrap',{token,force:true}).data.issues.some(i=>i.module==='employees'));
});
test('financial summary blocks malformed private cash sources with a non-disclosing error, repair restores balance',()=>{
 const {g}=fixture();g.ctx.writeRow_('debts',{recordId:'d',version:1,name:'Customer',type:'phai-thu',amount:100,date:'2026-11-01',dueDate:'2026-12-01'});
 g.ctx.writeRow_('cash',{recordId:'private-cash',version:1,date:'2026-11-02',direction:'thu',account:'cash',category:'thu-no',linkedId:'d',amount:'#REF!',note:'Private note'});
 g.ctx.append_('_Users',['acct','acct@example.com','accountant','{"debts":["read"]}',true,1]);const token=g.ctx.issueSession_('acct@example.com','acct-sub').token;
 const bad=send(g,'financialSummary',{token,module:'debts',to:'2026-11-03'});assert.equal(bad.error.code,'DATA_INVALID');assert.doesNotMatch(JSON.stringify(bad),/private-cash|Private note|#REF!/);
 g.tables.get('cash').rows[1][10]=30;
 assert.equal(send(g,'financialSummary',{token,module:'debts',to:'2026-11-03'}).data.rows[0].remaining,70);
});
test('payroll refuses invalid source before posting any cash; repair permits the same workflow',()=>{
 const {g,token}=fixture();g.ctx.writeRow_('employees',{recordId:'e',version:1,name:'Employee',department:'SX',hourlyRate:10,allowance:0});
 g.ctx.writeRow_('attendance',{recordId:'a',version:1,date:'2026-11-02',employeeId:'e',start:'08:00',end:'10:00',breakMinutes:0,hourlyRate:'#REF!',department:'SX',defaultAllowance:0,dailyAllowance:0,support:0,advance:0,deduction:0});
 const args={token,key:crypto.randomUUID(),kind:'payroll',from:'2026-11-01',to:'2026-11-30',account:'cash'};
 assert.equal(send(g,'workflow',args).error.code,'DATA_INVALID');assert.equal(g.ctx.rawRows_('cash').length,0);
 g.tables.get('attendance').rows[1][12]=10;
 assert.equal(send(g,'workflow',args).ok,true);assert.equal(g.ctx.rawRows_('cash')[0].amount,20);
});
test('scan rechecks unchanged invalid rows and records the editor as unverified while preserving original cells',()=>{
 const {g}=fixture();g.ctx.writeRow_('materials',{...material,source:'APP',updatedAt:'2026-01-01'});g.ctx.scanSheets_();
 g.tables.get('materials').rows[1][11]='#REF!';g.ctx.scanSheets_();const stamp=g.ctx.stamp_();
 assert.ok(g.ctx.scanSheets_().some(i=>i.issue));assert.equal(g.ctx.stamp_(),stamp);assert.equal(g.tables.get('materials').rows[1][11],'#REF!');
 assert.equal(g.ctx.rawRows_('materials')[0].updatedBy,'SHEET_EDITOR_UNVERIFIED');assert.equal(JSON.parse(g.properties.get('SOURCE_QUALITY')).invalidRows,1);
 g.tables.get('materials').rows[1][11]=10;assert.ok(g.ctx.scanSheets_().every(i=>!i.issue));assert.equal(JSON.parse(g.properties.get('SOURCE_QUALITY')).invalidRows,0);
});
test('invalid deletion and checkbox cells are flagged instead of silently coerced into valid records',()=>{
 const {g,token}=fixture();g.ctx.writeRow_('dishes',{recordId:'d',version:1,name:'Meal',price:10,published:true});
 g.tables.get('dishes').rows[1][9]='#REF!';assert.equal(send(g,'bootstrap',{token,force:true}).data.issues.length,1);
 g.tables.get('dishes').rows[1][9]=true;g.tables.get('dishes').rows[1][5]='not-a-boolean';assert.equal(send(g,'bootstrap',{token,force:true}).data.issues.length,1);
});
test('direct count creation cannot bypass source validation through mutate',()=>{
 const {g,token}=fixture();g.ctx.writeRow_('materials',material);
 g.ctx.writeRow_('stock',{recordId:'opening',version:1,date:'2026-11-01',materialId:'m',type:'nhap',quantity:'#REF!',unitCost:10});
 const request={token,key:crypto.randomUUID(),module:'counts',operation:'create',record:{date:'2026-11-02',materialId:'m',opening:100,closing:95,otherOut:0,note:''}};
 assert.equal(send(g,'mutate',request).error.code,'DATA_INVALID');assert.equal(g.ctx.rawRows_('counts').length,0);assert.equal(g.ctx.rawRows_('stock').length,1);
 g.tables.get('stock').rows[1][10]=100;
 assert.equal(send(g,'mutate',request).ok,true);assert.equal(g.ctx.inventory(g.ctx.data_(),'2026-11-02')[0].balance,95);
});

import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {gas} from '../tests/gas-mock.mjs';
import {send} from '../tests/auth-helpers.mjs';
const label=process.argv[2]||'after';
function fixture(n){
 const g=gas(),meta={version:1,updatedAt:'2026-11-01T00:00:00Z',updatedBy:'fixture',source:'APP',deleted:false,reverses:''};
 const put=(m,r)=>g.tables.get(m).appendRow(g.ctx.cells_(m,{...meta,...r}));
 put('stores',{recordId:'s',name:'Store'});put('dishes',{recordId:'d',name:'Meal',price:30,published:false});put('employees',{recordId:'e',name:'Employee',department:'SX',hourlyRate:10,allowance:0});
 put('recipes',{recordId:'r',name:'Recipe',kind:'mon',dishId:'d',yield:1,lines:[{type:'material',id:'m0',quantity:1}]});
 for(let i=0;i<n;i++){
  put('materials',{recordId:'m'+i,name:'Material '+i,purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0});
  put('stock',{recordId:'st'+i,date:'2026-11-01',materialId:'m0',type:'nhap',quantity:10,unitCost:10,note:''});
  put('sales',{recordId:'s'+i,date:'2026-11-16',storeId:'s',dishId:'d',delivered:1,sold:1,returned:0,creditQty:0,price:30,discount:0,recoveryPrice:0,cash:30,bank:0,oldDebtPaid:0,otherCost:0,note:''});
  put('attendance',{recordId:'a'+i,date:'2026-11-16',employeeId:'e',start:'08:00',end:'09:00',breakMinutes:0,hourlyRate:10,department:'SX',defaultAllowance:0,dailyAllowance:0,support:0,advance:0,deduction:0});
  put('cash',{recordId:'c'+i,date:'2026-11-16',direction:'chi',account:'cash',amount:1,category:'marketing',linkedId:'',note:''});
 }
 const token=g.ctx.issueSession_('admin@example.com','fixture-sub').token;
 return {g,token};
}
const runs=[];
for(const n of [100,1000,5000]){
 const {g,token}=fixture(n),results=[];
 const measure=(name,fn)=>{const before={...g.metrics},start=performance.now(),value=fn(),ms=performance.now()-start;if(value?.ok===false)throw Error(name+': '+JSON.stringify(value.error));results.push({name,ms:+ms.toFixed(2),...Object.fromEntries(Object.keys(before).map(k=>[k,g.metrics[k]-before[k]])),responseBytes:Buffer.byteLength(JSON.stringify(value??null))});return value;};
 measure('bootstrap-cold',()=>send(g,'bootstrap',{token,force:true}));
 measure('bootstrap-hot',()=>send(g,'bootstrap',{token}));
 measure('module-first-page',()=>send(g,'list',{token,module:'materials',limit:50}));
 measure('module-page-repeat',()=>send(g,'list',{token,module:'materials',limit:50}));
 measure('module-last-page',()=>send(g,'list',{token,module:'materials',limit:50,offset:Math.max(0,n-50)}));
 measure('save-material',()=>send(g,'mutate',{token,module:'materials',operation:'create',key:crypto.randomUUID(),record:{name:'New material',purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0}}));
 measure('full-scan',()=>g.ctx.scanSheets_());
 g.tables.get('materials').rows[1][11]=11;
 measure('direct-edit-detection',()=>g.ctx.sheetEdited_({source:g.ctx.db_(),range:{getSheet:()=>({getName:()=> 'materials'}),getRow:()=>2,getNumRows:()=>1,getColumn:()=>12}}));
 // New APIs are measured when present; baseline is retained without pretending
 // that RAM timings include Google network, OAuth, locks or concurrent users.
 if(g.ctx.summary_)measure('dashboard-summary',()=>send(g,'summary',{token,from:'2026-11-16',to:'2026-11-16'}));
 if(g.ctx.summary_)measure('dashboard-summary-hot',()=>send(g,'summary',{token,from:'2026-11-16',to:'2026-11-16'}));
 if(g.ctx.bootstrap_)measure('bootstrap-shell',()=>send(g,'bootstrap',{token,shell:true,force:true}));
 runs.push({rowsPerLargeTable:n,businessRows:5*n+4,results});
}
const result={environment:'Node GAS mock, synthetic fixtures only',networkIncluded:false,googleOAuthMeasured:false,concurrentGoogleUsersMeasured:false,label,at:new Date().toISOString(),runs};
fs.mkdirSync('output',{recursive:true});fs.writeFileSync('output/performance-'+label+'.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

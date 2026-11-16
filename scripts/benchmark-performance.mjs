import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fixture} from '../tests/performance-fixture.mjs';
import {send} from '../tests/auth-helpers.mjs';
const label=process.argv[2]||'after';
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

import fs from 'node:fs';import {performance} from 'node:perf_hooks';
import {fixture} from '../tests/performance-fixture.mjs';import {send} from '../tests/auth-helpers.mjs';
const label=process.argv[2]||'after',runs=[];
for(const n of [100,1000,5000]){
 const {g,token}=fixture(n),results=[];
 for(const m of ['sales','attendance','cash']){const at=g.ctx.headers_(m).indexOf('date');g.tables.get(m).rows.slice(1).forEach((r,i)=>r[at]=new Date(Date.parse('2026-11-16')-(i%1095)*86400000).toISOString().slice(0,10));}
 const measure=(name,fn)=>{const before={...g.metrics},start=performance.now(),value=fn(),ms=performance.now()-start;if(value?.ok===false)throw Error(name+': '+JSON.stringify(value.error));results.push({name,ms:+ms.toFixed(2),...Object.fromEntries(Object.keys(before).map(k=>[k,g.metrics[k]-before[k]])),responseBytes:Buffer.byteLength(JSON.stringify(value??null))});};
 for(const m of Object.keys(g.ctx.moduleVersions_())){measure('list:'+m,()=>send(g,'list',{token,module:m,limit:50,from:'2026-11-10',to:'2026-11-16'}));}
 measure('sales:other-week',()=>send(g,'list',{token,module:'sales',limit:50,from:'2026-11-03',to:'2026-11-09'}));
 measure('dashboard:cold',()=>send(g,'summary',{token,from:'2026-11-10',to:'2026-11-16'}));
 for(const k of g.cache.keys())if(k.startsWith('read:')||k.startsWith('parts:'))g.cache.delete(k);measure('dashboard:cache-evicted',()=>send(g,'summary',{token,from:'2026-11-10',to:'2026-11-16'}));
 if(g.ctx.lookupData_)measure('lookup:recipes',()=>send(g,'lookup',{token,module:'recipes',limit:200,offset:0}));
 if(g.ctx.periodSummary_)for(const kind of ['inventory','payroll','cost','demand','variance']){measure(kind+':summary-cold',()=>send(g,'periodSummary',{token,kind,from:'2026-11-01',to:'2026-11-30'}));measure(kind+':summary-hot',()=>send(g,'periodSummary',{token,kind,from:'2026-11-01',to:'2026-11-30'}));}
 runs.push({rowsPerLargeTable:n,results});
}
const out={environment:'Synthetic Node GAS mock: no Google IO/network/OAuth/concurrent browser measurements',label,runs};fs.writeFileSync('output/data-loading-'+label+'.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));

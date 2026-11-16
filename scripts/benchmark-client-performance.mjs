import fs from 'node:fs';import {performance} from 'node:perf_hooks';import {client} from '../tests/client-fixture.mjs';
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*p)-1)];
const runs=[];
for(const n of [100,1000,5000]){
 const c=await client();c.context.fixtureRows=Array.from({length:n},(_,i)=>({recordId:'m'+i,version:1,name:'Material '+i,purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0}));
 c.run(`state.demo=false;state.grantKey='fixture-admin';state.moduleVersions={materials:'v1',stores:'v1'};state.data.materials=fixtureRows;globalThis.backendRequests=0;
 call=async(action,args)=>{backendRequests++;if(action==='list'){const all=args.module==='materials'?fixtureRows:[];return {rows:all.slice(args.offset,args.offset+50),total:all.length,next:args.offset+50<all.length?args.offset+50:null};}if(action==='strategySummary')return {aggregate:strategyAggregate(state.data,state.from,state.to),prior:strategyAggregate(state.data,state.from,state.to),series:[{label:'Fixture',revenue:100}],profitSeries:[]};throw new Error('Unexpected benchmark RPC');};`);
 const start=performance.now();c.run("location.hash='#catalog';route()");await flush();const cold=performance.now()-start;
 c.run("location.hash='#stores';route()");await flush();const values=[];
 for(let i=0;i<40;i++){c.run("location.hash='#stores';route()");const s=performance.now();c.run("location.hash='#catalog';route()");await flush();values.push(performance.now()-s);}
 c.run("location.hash='#strategy';route()");await flush();const chart=c.document.querySelector('#view svg'),strategy=[];
 for(let i=0;i<40;i++){c.run("location.hash='#stores';route()");const s=performance.now();c.run("location.hash='#strategy';route()");await flush();strategy.push(performance.now()-s);if(c.document.querySelector('#view svg')!==chart)throw Error('Chart was rebuilt on cache hit');}
 runs.push({rows:n,coldModuleCpuMs:+cold.toFixed(2),hotModule:{samples:values.length,p50:+percentile(values,.5).toFixed(2),p95:+percentile(values,.95).toFixed(2),max:+Math.max(...values).toFixed(2)},hotStrategyDom:{samples:strategy.length,p50:+percentile(strategy,.5).toFixed(2),p95:+percentile(strategy,.95).toFixed(2),max:+Math.max(...strategy).toFixed(2)},backendRequests:c.run('backendRequests')});
}
const result={environment:'Node + LinkeDOM CPU only; no browser layout/paint, network, Google OAuth or concurrent service calls',targetMs:200,realBrowserVerified:false,runs};fs.mkdirSync('output',{recursive:true});fs.writeFileSync('output/performance-client.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

import {performance} from 'node:perf_hooks';import fs from 'node:fs/promises';import {database,asUser,identities} from '../tests/database-fixture';
const db=await database(),results=[];let current=0;
for(const size of [100,1000,10000]){
 await db.query("insert into materials(code,name) select 'BENCH-'||n,'Benchmark '||lpad(n::text,6,'0') from generate_series($1::int,$2::int) n",[current+1,size]);current=size;
 await db.exec('analyze materials');const timings:number[]=[];
 for(let run=0;run<20;run++){const at=performance.now();await asUser(db,identities.admin,()=>db.query("select id,code,name from materials where lower(name) like 'benchmark 00%' order by lower(name),id limit 25"));timings.push(performance.now()-at);}
 timings.sort((a,b)=>a-b);const plan=await asUser(db,identities.admin,()=>db.query("explain (format json) select id,code,name from materials where lower(name) like 'benchmark 00%' order by lower(name),id limit 25"));
 results.push({rows:size,samples:timings.length,p50Ms:timings[9],p95Ms:timings[18],plan:plan.rows});
}
await fs.mkdir('../output',{recursive:true});await fs.writeFile('../output/standalone-sql-benchmark.json',JSON.stringify({engine:'PGlite embedded PostgreSQL',cloud:false,concurrentUsersTested:false,includesNetwork:false,scope:'One connection; RLS select with role switch transaction; synthetic catalog data',results},null,2));await db.close();console.log(JSON.stringify(results.map(({rows,p50Ms,p95Ms})=>({rows,p50Ms,p95Ms}))));

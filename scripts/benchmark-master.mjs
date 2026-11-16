import fs from 'node:fs';import {performance} from 'node:perf_hooks';
import {gas} from '../tests/gas-mock.mjs';import {send} from '../tests/auth-helpers.mjs';
const results=[];
for(const size of [100,1000,5000]){
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;
  const put=(module,record)=>{const row={version:1,updatedAt:'2026-11-01T00:00:00Z',updatedBy:'fixture',source:'APP',deleted:false,reverses:'',...record},cells=g.ctx.cells_(module,row);g.tables.get(module).rows.push(cells);return g.ctx.hash_(cells);};
  put('stores',{recordId:'s',name:'Store',address:'',contact:''});put('dishes',{recordId:'d',name:'Meal',price:30,published:true});
  for(let i=0;i<size;i++){
    const sale='s'+i,approval='a'+i,order='o'+i,plan='p'+i;
    const sourceHash=put('sales',{recordId:sale,date:'2026-11-02',storeId:'s',dishId:'d',delivered:100,sold:80,returned:10,creditQty:10,price:30,discount:.1,recoveryPrice:2,cash:2430,bank:0,oldDebtPaid:0,otherCost:0,note:''});
    const orderHash=put('orders',{recordId:order,date:'2026-11-02',shift:'AM',storeId:'s',dishId:'d',quantity:1,contact:'fixture',customer:'fixture',status:'approved'});
    const productionHash=put('production',{recordId:plan,date:'2026-11-02',dishId:'d',planned:10,produced:0,extra:0,rejected:0,note:''});
    for(const [recordId,kind,referenceId,details]of [[approval,'return-approved',sale,{sourceHash,quantity:10,dishId:'d',storeId:'s'}],['r'+i,'return-received',approval,{quantity:10}],['l'+i,'order-plan-link',order,{productionId:plan,quantity:1,orderHash,productionHash}]])put('_Workflows',{recordId,kind,referenceId,date:'2026-11-02',details:JSON.stringify(details)});
  }
  const runs=[];
  for(const actionName of ['kioskReport','kioskReport-hot','orderPlans','orderPlans-hot']){
    const action=actionName.replace('-hot','');
    const before={...g.metrics},at=performance.now(),response=send(g,action,{token,from:'2026-11-01',to:'2026-11-30'});if(!response.ok)throw Error(JSON.stringify(response.error));
    runs.push({action:actionName,ms:+(performance.now()-at).toFixed(2),getValues:g.metrics.getValues-before.getValues,cellsRead:g.metrics.cellsRead-before.cellsRead,rows:response.data.rows.length,total:response.data.total,responseBytes:Buffer.byteLength(JSON.stringify(response))});
  }results.push({size,runs});
}
const output={kind:'Node/GAS mock; NOT Google latency',at:new Date().toISOString(),results};fs.writeFileSync('output/master-benchmark-'+(process.argv[2]||'after')+'.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));

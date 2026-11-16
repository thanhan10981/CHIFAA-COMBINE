import crypto from 'node:crypto';
import {gas} from './gas-mock.mjs';
import {send} from './auth-helpers.mjs';
export function fixture(n){
 const g=gas(),meta={version:1,updatedAt:'2026-11-01T00:00:00Z',updatedBy:'fixture',source:'APP',deleted:false,reverses:''};
 const put=(m,r)=>g.tables.get(m).appendRow(g.ctx.cells_(m,{...meta,...r}));
 put('stores',{recordId:'s',name:'Store'});put('dishes',{recordId:'d',name:'Meal',price:30,published:false});
 put('recipes',{recordId:'r',name:'Recipe',kind:'mon',dishId:'d',yield:1,lines:[{type:'material',id:'m0',quantity:1}]});
 for(let i=0;i<n;i++){
  put('employees',{recordId:'e'+i,name:'Employee '+i,department:'SX',hourlyRate:10,allowance:0});
  put('materials',{recordId:'m'+i,name:'Material '+i,purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0});
  put('stock',{recordId:'st'+i,date:'2026-11-01',materialId:'m0',type:'nhap',quantity:10,unitCost:10,note:''});
  put('sales',{recordId:'s'+i,date:'2026-11-16',storeId:'s',dishId:'d',delivered:1,sold:1,returned:0,creditQty:0,price:30,discount:0,recoveryPrice:0,cash:30,bank:0,oldDebtPaid:0,otherCost:0,note:''});
  put('attendance',{recordId:'a'+i,date:'2026-11-16',employeeId:'e'+i,start:'08:00',end:'09:00',breakMinutes:0,hourlyRate:10,department:'SX',defaultAllowance:0,dailyAllowance:0,support:0,advance:0,deduction:0});
  put('cash',{recordId:'c'+i,date:'2026-11-16',direction:'chi',account:'cash',amount:1,category:'marketing',linkedId:'',note:''});
 }
 const token=g.ctx.issueSession_('admin@example.com','fixture-sub').token;
 return {g,token};
}
export function propertyScenario(action='sync',raw=false){
  const {g,token}=fixture(10),factory=g.ctx.PropertiesService.getScriptProperties,calls={singleReads:0,batchReads:0,writes:0,deletes:0};
  const counted=()=>{const p=factory();return {getProperty:key=>{calls.singleReads++;return p.getProperty(key);},getProperties:()=>{calls.batchReads++;return p.getProperties();},setProperty:(key,value)=>{calls.writes++;return p.setProperty(key,value);},deleteProperty:key=>{calls.deletes++;return p.deleteProperty(key);}};};
  g.ctx.PropertiesService.getScriptProperties=counted;if(raw)g.ctx.props_=counted;
  const args=action==='sync'?{token}:action==='summary'?{token,from:'2026-11-16',to:'2026-11-16'}:{token,module:'materials',operation:'create',key:crypto.randomUUID(),record:{name:'Counter fixture',purchaseUnit:'kg',unit:'kg',conversion:1,purchasePrice:10,minimum:0}};
  const before=g.metrics.getValues,at=performance.now(),result=send(g,action,args);if(!result.ok)throw Error(JSON.stringify(result.error));
  return {action,rawConfigurationMode:raw,ms:+(performance.now()-at).toFixed(2),properties:calls,propertyCalls:Object.values(calls).reduce((n,x)=>n+x,0),sheetsGetValues:g.metrics.getValues-before};
}

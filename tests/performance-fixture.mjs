import crypto from 'node:crypto';
import {gas} from './gas-mock.mjs';
export function fixture(n){
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

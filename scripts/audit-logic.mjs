// Local-only diagnostics. Uses in-memory Apps Script mocks; never connects to Google.
import fs from 'node:fs/promises';
import {SCHEMA} from '../src/shared/schema.js';
import {report,payroll,finance,inventory} from '../src/shared/domain.js';
import {routeReadModules} from '../src/shared/access.js';
import {gas} from '../tests/gas-mock.mjs';
import {send} from '../tests/auth-helpers.mjs';

const day='2026-11-15',empty=()=>Object.fromEntries(Object.keys(SCHEMA).map(m=>[m,[]]));
const data=empty();
data.materials=[{recordId:'m',name:'Material',minimum:0,conversion:1,purchasePrice:2}];
data.recipes=[{recordId:'r',name:'Recipe',kind:'mon',dishId:'d',yield:1,lines:[{type:'material',id:'m',quantity:1}]}];
data.stock=[{recordId:'stock',date:day,materialId:'m',type:'nhap',quantity:100,unitCost:2}];
data.production=[{recordId:'prod',date:day,dishId:'d',planned:1,produced:1,extra:0,rejected:0}];
data.sales=[{recordId:'sale',date:day,delivered:1,sold:1,returned:0,creditQty:0,price:100,discount:0,recoveryPrice:0,cash:100,bank:0,oldDebtPaid:0,otherCost:0}];
const missingAttendance=report(data,day,day);
const beforeRecipeEdit=missingAttendance.cogs;
data.recipes[0].lines[0].quantity=2;
const afterRecipeEdit=report(data,day,day).cogs;

const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;
g.ctx.writeRow_('employees',{recordId:'e',version:1,name:'Employee',department:'SX',hourlyRate:100,allowance:0});
const attendance={date:day,employeeId:'e',start:'07:00',end:'12:00',breakMinutes:0,hourlyRate:100,department:'SX',defaultAllowance:0,dailyAllowance:0,support:0,advance:0,deduction:0};
const a=send(g,'mutate',{token,module:'attendance',operation:'create',key:crypto.randomUUID(),record:attendance});
const b=send(g,'mutate',{token,module:'attendance',operation:'create',key:crypto.randomUUID(),record:{...attendance,start:'08:00',end:'13:00'}});
const wage=payroll(g.ctx.rawRows_('attendance'))[0];
g.ctx.writeRow_('loans',{recordId:'loan',version:1,name:'Lender',principal:100,annualRate:.12,date:day,dueDate:'2026-12-15',note:''});
const payment=send(g,'mutate',{token,module:'cash',operation:'create',key:crypto.randomUUID(),record:{date:day,direction:'chi',account:'cash',amount:150,category:'tra-vay',linkedId:'loan',note:''}});
const loan=finance({loans:g.ctx.rawRows_('loans'),cash:g.ctx.rawRows_('cash')},day).loans[0];
const interestData={loans:[{recordId:'l',name:'Lender',principal:10000,annualRate:0,date:'2026-01-01',dueDate:'2027-01-01'}],cash:[]};
const noInterest=finance(interestData,day);interestData.loans[0].annualRate=.3;
const withInterest=finance(interestData,day);
const result={scope:'LOCAL MOCK ONLY; no Google read/write',cases:{
  missingAttendance:{attendanceRows:0,completeness:missingAttendance.completeness,profit:missingAttendance.profit,sxHours:missingAttendance.sxHours},
  historicalRecipe:{day,cogsBeforeEdit:beforeRecipeEdit,cogsAfterCurrentRecipeEdit:afterRecipeEdit},
  overlappingShifts:{firstAccepted:a.ok,secondAccepted:b.ok,shifts:['07:00-12:00','08:00-13:00'],paidHours:wage.hours,elapsedUnionHours:6,basePay:wage.base},
  overpayment:{accepted:payment.ok,principal:loan.principal,paid:loan.paid,remaining:loan.remaining},
  interestField:{sameResultAtZeroAnd30Percent:JSON.stringify(noInterest)===JSON.stringify(withInterest),returnedLoanFields:Object.keys(withInterest.loans[0])},
  productionInventory:{stockBalance:inventory(data,day)[0].balance,productionExists:data.production.length>0,materialPerUnit:data.recipes[0].lines[0].quantity,note:'Inventory uses stock movements only; production does not create movement effects.'},
  financePagePermissions:Object.fromEntries(['assets','entry-loans','entry-debts'].map(id=>[id,{modules:routeReadModules(id),includesCash:routeReadModules(id).includes('cash')}]))
}};
await fs.mkdir('output',{recursive:true});
await fs.writeFile('output/logic-audit-evidence.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));

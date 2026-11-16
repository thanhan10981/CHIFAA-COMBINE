import test from 'node:test';import assert from 'node:assert/strict';
import {ACCOUNTING_POLICY,salesMetrics,report,targets} from '../src/shared/domain.js';
import {strategyAggregate} from '../src/shared/strategy.js';
import {SCHEMA} from '../src/shared/schema.js';
const date='2026-11-12';
const sale={recordId:'s',date,storeId:'shop',dishId:'dish',delivered:100,sold:80,returned:10,creditQty:10,price:15000,discount:.15,recoveryPrice:5000,otherCost:7000,cash:510000,bank:510000,oldDebtPaid:20000};
function fixture(){const d=Object.fromEntries(Object.keys(SCHEMA).map(m=>[m,[]]));d.sales=[{...sale}];d.production=[{recordId:'p',date,dishId:'dish',produced:100,extra:0,rejected:0,costSnapshot:{total:300000}}];d.attendance=[{recordId:'a',date,employeeId:'e',department:'SX',start:'23:00',end:'09:00',breakMinutes:0,hourlyRate:15000,defaultAllowance:0,dailyAllowance:0,support:0,advance:0,deduction:0}];d.plans=[{date,revenue:1200000,production:100,fixedCost:0,productionCostCap:1,bonusCap:100000}];d.cash=[{recordId:'cash',date,direction:'chi',account:'cash',category:'marketing',amount:10000}];d.recipes=[];return d;}
test('D01/D02/D03 net revenue excludes operating recovery cost, includes store-borne units and never old debt',()=>{
 const m=salesMetrics(sale);assert.equal(m.netRevenue,1147500);assert.equal(m.saleRevenue,1020000);assert.equal(m.creditRevenue,127500);assert.equal(m.recoveryExpense,50000);assert.equal(m.otherExpense,7000);assert.equal(m.received,1020000);assert.equal(m.expectedCurrentCollection,1147500);assert.equal(m.collectionDifference,-147500);assert.equal(m.unsold,0);
 assert.equal(salesMetrics({...sale,oldDebtPaid:0,cash:1,bank:0,recoveryPrice:99999,otherCost:999}).netRevenue,m.netRevenue);
 assert.equal(salesMetrics({...sale,sold:100,returned:0,creditQty:0}).netRevenue,1275000);
});
test('report, targets and strategy share net-sales ratios and count recovery expense once in profit',()=>{
 const d=fixture(),r=report(d,date,date),t=targets(d,date,date),a=strategyAggregate(d,date,date);
 assert.equal(r.revenue,1147500);assert.equal(r.profit,630500);assert.equal(r.operating,67000);assert.equal(r.recoveryExpense,50000);assert.equal(a.profit,r.profit);assert.equal(a.recovery,50000);assert.equal(a.other,17000);assert.equal(a.revenue,r.revenue);assert.equal(t.foodCostPct,r.foodCostPct);assert.equal(a.foodCostPct,r.foodCostPct);assert.equal(a.sxLaborPct,r.sxLaborPct);assert.equal(t.sxLaborPct,r.sxLaborPct);assert.equal(r.foodCostPct,26.14);assert.equal(r.sxLaborPct,13.07);assert.equal(t.foodCostMaxPct,32.2);assert.equal(t.sxLaborMaxPct,15);assert.equal(t.laborCap,172125);assert.equal(t.bonusAvailable,22125);assert.equal(r.policy.version,ACCOUNTING_POLICY.version);
});
test('labor headroom never deducts food cost or uses cash receipts and requires production target achievement',()=>{
 const d=fixture(),before=targets(d,date,date);d.production[0].costSnapshot.total=400000;d.sales[0].cash=1;d.sales[0].bank=0;d.sales[0].oldDebtPaid=0;assert.equal(targets(d,date,date).bonusAvailable,before.bonusAvailable);
 d.plans[0].production=101;assert.equal(targets(d,date,date).bonusAvailable,null);d.plans[0].production=100;d.attendance=[];assert.equal(targets(d,date,date).bonusAvailable,null);
});
test('missing, formula errors and unrecorded days never yield zero ratios or an invented bonus',()=>{
 const d=fixture();d.sales[0].price='#REF!';let r=report(d,date,date);assert.equal(r.revenue,null);assert.equal(r.profit,null);assert.equal(r.foodCostPct,null);assert.equal(targets(d,date,date).bonusAvailable,null);assert.equal(strategyAggregate(d,date,date).revenue,null);
 d.sales=[];r=report(d,date,date);assert.equal(r.revenue,null);assert.equal(r.received,null);assert.equal(r.foodCostPct,null);
 const complete=fixture();assert.equal(targets(complete,'2026-11-11',date).bonusAvailable,null);
 const officeOnly=fixture();officeOnly.attendance[0].department='VP';assert.equal(report(officeOnly,date,date).sxLaborPct,null);assert.equal(targets(officeOnly,date,date).bonusAvailable,null);
});

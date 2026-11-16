import test from 'node:test';
import assert from 'node:assert/strict';
import {strategyRange,strategyShift,strategyAggregate,strategySeries,strategyScenario} from '../src/shared/strategy.js';
const data=()=>({sales:[{recordId:'s',date:'2026-11-02',storeId:'shop',dishId:'dish',sold:8,creditQty:2,delivered:12,returned:2,price:100,discount:0,recoveryPrice:0,otherCost:0,cash:800,bank:0,oldDebtPaid:0}],production:[{recordId:'p',date:'2026-11-02',dishId:'dish',produced:12,extra:0,rejected:0}],attendance:[{recordId:'a',date:'2026-11-02',employeeId:'e',department:'SX',start:'08:00',end:'09:00',breakMinutes:0,hourlyRate:10,defaultAllowance:0,dailyAllowance:0,support:0,advance:0,deduction:0}],cash:[{recordId:'c',date:'2026-11-02',direction:'chi',category:'co-dinh',amount:20,account:'cash'}],recipes:[{recordId:'r',dishId:'dish',yield:1,lines:[{type:'material',id:'m',quantity:1}]}],materials:[{recordId:'m',name:'Rice',purchasePrice:9999,conversion:1}],stock:[{recordId:'st',date:'2026-11-01',type:'nhap',materialId:'m',quantity:100,unitCost:5}],stores:[{recordId:'shop',name:'Shop'}],dishes:[{recordId:'dish',name:'Dish'}]});
test('strategy calendar periods use UTC, Monday weeks, leap years and clamped month shifts',()=>{
  assert.deepEqual(strategyRange('week','2026-11-01'),{start:'2026-10-26',end:'2026-11-01'});
  assert.deepEqual(strategyRange('month','2024-02-29'),{start:'2024-02-01',end:'2024-02-29'});
  assert.deepEqual(strategyRange('quarter','2026-11-16'),{start:'2026-10-01',end:'2026-12-31'});
  assert.equal(strategyShift('month','2026-01-31',1),'2026-02-28');
  assert.equal(strategyShift('year','2024-02-29',1),'2025-02-28');
  assert.throws(()=>strategyRange('month','2026-02-30'));
});
test('strategy uses actual dated prices, distinguishes sold cost from production cost, and excludes old debt receipts',()=>{
  const d=data();d.sales[0].oldDebtPaid=50;d.sales[0].cash=850;
  const a=strategyAggregate(d,'2026-11-01','2026-11-16');
  assert.equal(a.revenue,1000);assert.equal(a.sold,10);assert.equal(a.average,10);assert.equal(a.food,60);assert.equal(a.profit,910);assert.equal(a.variable,7);assert.equal(a.stores[0].cost,50);assert.equal(a.stores[0].gross,950);assert.equal(a.returnRate,2/12*100);
  d.stock.push({recordId:'future-price',date:'2026-11-03',type:'nhap',materialId:'m',unitCost:1000});
  assert.equal(strategyAggregate(d,'2026-11-01','2026-11-16').food,60);
});
test('strategy refuses profit when attendance, matching production or dated prices are missing',()=>{
  for(const change of [d=>d.attendance=[],d=>d.production[0].date='2026-11-03',d=>d.stock=[],d=>delete d.cash]){const d=data();change(d);const a=strategyAggregate(d,'2026-11-01','2026-11-16');assert.equal(a.profit,null);assert.equal(a.variable,null);assert.ok(a.issues.length);}
});
test('strategy trend preserves missing versus recorded zero, excludes future days and reversals',()=>{
  const d=data();d.sales[0].price=0;d.sales.push({...d.sales[0],recordId:'future',date:'2026-11-20',price:1000});
  const rows=strategySeries(d,'month','2026-11-16',3);
  assert.equal(rows.length,3);assert.equal(rows[0].revenue,null);assert.equal(rows[2].revenue,0);assert.equal(rows[2].to,'2026-11-16');
  d.sales.push({...d.sales[0],recordId:'reversal',reverses:'s'});assert.equal(strategyAggregate(d,'2026-11-01','2026-11-16').revenue,null);
});
test('strategy simulator uses explicit costs and wastage, never fixed sample ratios',()=>{
  assert.deepEqual(strategyScenario(100,40,100,10,0),{margin:60,breakEven:2,profit:15000});
  assert.equal(strategyScenario(100,40,100,10,50).margin,20);
  assert.equal(strategyScenario(10,20,100,10,0).breakEven,null);
  assert.throws(()=>strategyScenario(100,40,100,10,100));assert.throws(()=>strategyScenario(100,NaN,100,10,0));
});

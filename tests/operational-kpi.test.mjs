import test from 'node:test';import assert from 'node:assert/strict';
import {report,variance} from '../src/shared/domain.js';import {strategyAggregate} from '../src/shared/strategy.js';import {client} from './client-fixture.mjs';
test('Production productivity includes extra output before rejects; good productivity is separate and incomplete SX days are unknown',()=>{
  const attendance={date:'2026-11-01',employeeId:'e',department:'SX',start:'23:00',end:'09:00',breakMinutes:0,hourlyRate:0,defaultAllowance:0,dailyAllowance:0,support:0,advance:0,deduction:0};
  const data={production:[{date:'2026-11-01',dishId:'d',produced:100,extra:20,rejected:10}],attendance:[attendance,{...attendance,department:'VP'}]};
  const r=report(data,'2026-11-01','2026-11-30');assert.equal(r.productivity,12);assert.equal(r.goodProductivity,11);assert.equal(r.produced,110);assert.equal(r.totalProduced,120);assert.equal(r.rejected,10);
  assert.equal(strategyAggregate(data,'2026-11-01','2026-11-30').productivity,12);
  data.production.push({...data.production[0],date:'2026-11-02'});assert.equal(report(data,'2026-11-01','2026-11-30').productivity,null);
  assert.equal(report({},'2026-11-01','2026-11-30').totalProduced,null);
});
test('Variance percentage is signed difference / theoretical; zero theoretical never divides by zero',()=>{
  const data={counts:[{date:'2026-11-01',materialId:'m',opening:100,closing:0,otherOut:0}],production:[{date:'2026-11-01',dishId:'d',produced:90,extra:0}],recipes:[{recordId:'r',dishId:'d',yield:1,lines:[{type:'material',id:'m',quantity:1}]}]};
  assert.equal(variance(data,'2026-11-01','2026-11-01')[0].percentage,11.11);
  data.counts[0].closing=20;assert.equal(variance(data,'2026-11-01','2026-11-01')[0].percentage,-11.11);
  data.production=[];assert.equal(variance(data,'2026-11-01','2026-11-01')[0].percentage,null);
});
test('Remote variance report headers match cells and show the percentage column',async()=>{
  const c=await client();c.run(`state.demo=false;call=async()=>({rows:[{date:'2026-11-01',name:'Rice',actual:100,theoretical:90,difference:10,percentage:11.11,status:'orange'}],total:1,next:null});location.hash='#variance';route();`);
  for(let i=0;i<6;i++)await Promise.resolve();const table=c.document.querySelector('#view table');assert.equal(table.querySelectorAll('th').length,7);assert.equal(table.querySelector('tbody tr').children.length,7);assert.match(table.textContent,/11,11|11.11/);
});
test('Positive stocktake adjustment does not masquerade as an incoming physical receipt',()=>{
  const data={counts:[{date:'2026-11-01',materialId:'m',opening:100,closing:110,otherOut:0}],stock:[{date:'2026-11-01',materialId:'m',type:'dieu-chinh-tang',quantity:10}],production:[]};
  const row=variance(data,'2026-11-01','2026-11-01')[0];assert.equal(row.actual,-10);assert.equal(row.status,'red');
});

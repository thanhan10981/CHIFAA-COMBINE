import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './performance-fixture.mjs';import {gas} from './gas-mock.mjs';import {send} from './auth-helpers.mjs';
const evictReads=g=>{for(const k of g.cache.keys())if(k.startsWith('read:'))g.cache.delete(k);};
test('warm module index reads only requested period rows and rebuilds after row structure/version changes',()=>{
 const {g,token}=fixture(1000),s=g.tables.get('sales'),date=g.ctx.headers_('sales').indexOf('date');s.rows.slice(1).forEach((r,i)=>r[date]=i<10?'2026-11-16':'2025-01-01');
 let r=send(g,'list',{token,module:'sales',from:'2026-11-16',to:'2026-11-16'});assert.equal(r.data.total,10);evictReads(g);const before=g.metrics.cellsRead;
 r=send(g,'list',{token,module:'sales',from:'2026-11-15',to:'2026-11-16'});assert.equal(r.data.rows.length,10);assert.ok(g.metrics.cellsRead-before<1000);
 const row=[...s.rows[1]];row[0]='new';s.appendRow(row);r=send(g,'list',{token,module:'sales',from:'2026-11-14',to:'2026-11-16'});assert.equal(r.data.total,11);
 s.rows[1][date]='2020-01-01';g.ctx.bump_(['sales']);r=send(g,'list',{token,module:'sales',from:'2026-11-16',to:'2026-11-16'});assert.equal(r.data.total,10);
});
test('5000-row index fits chunk budget and a different period does not scan history again',()=>{
 const {g,token}=fixture(5000),s=g.tables.get('sales'),at=g.ctx.headers_('sales').indexOf('date');s.rows.slice(1).forEach((r,i)=>r[at]=i<7?'2026-11-16':'2024-01-01');send(g,'list',{token,module:'sales',from:'2026-11-16',to:'2026-11-16'});const before=g.metrics.cellsRead;
 const next=send(g,'list',{token,module:'sales',from:'2026-11-10',to:'2026-11-16',dishId:'d'});assert.equal(next.data.total,7);assert.ok(g.metrics.cellsRead-before<1000);assert.ok([...g.cache.keys()].some(k=>k.startsWith('parts:index:')));
});
test('index eviction/corruption, wrong header and direct row movement fail safely or rebuild',()=>{
 const {g,token}=fixture(10);send(g,'list',{token,module:'materials'});evictReads(g);const key=[...g.cache.keys()].find(k=>k.startsWith('parts:index:')&&!k.includes(':0'));
 if(key)g.cache.set(key,'invalid');assert.equal(send(g,'list',{token,module:'materials',offset:1}).ok,true);
 g.tables.get('materials').rows.reverse();assert.equal(send(g,'list',{token,module:'materials',offset:2}).error.code,'SCHEMA');
});
test('large chunk cache preserves Unicode and handles missing/corrupt chunks without partial results',()=>{
 const g=gas(),value={text:'a'.repeat(15992)+'😀 nguyên liệu '.repeat(10000)};g.ctx.cachePartsPut_('parts:fixture',value,60);assert.equal(g.ctx.cachePartsGet_('parts:fixture').text,value.text);
 const manifest=JSON.parse(g.cache.get('parts:fixture'));g.cache.delete('parts:fixture:'+manifest.generation+':1');assert.equal(g.ctx.cachePartsGet_('parts:fixture'),null);
});
test('durable Dashboard snapshot survives read-cache eviction, stays permission scoped and invalidates by version',()=>{
 const {g,token}=fixture(10),args={token,from:'2026-11-16',to:'2026-11-16'},first=send(g,'summary',args);assert.equal(first.ok,true);assert.ok(g.tables.has('_ReportSnapshots'));evictReads(g);
 let reads=0,raw=g.ctx.rawRows_;g.ctx.rawRows_=(...a)=>{reads++;return raw(...a);};const hot=send(g,'summary',args);assert.equal(hot.data.readModel.source,'snapshot');assert.equal(reads,0);assert.equal(hot.data.report.revenue,first.data.report.revenue);
 g.ctx.append_('_Users',['acct','acct@example.com','accountant','{"sales":["read"]}',true,1]);const acct=g.ctx.issueSession_('acct@example.com','acct').token;assert.equal(send(g,'summary',{...args,token:acct}).error.code,'FORBIDDEN');
 g.ctx.bump_(['sales']);assert.equal(send(g,'summary',args).ok,true);assert.ok(reads>0);
});
test('snapshot corruption/expiry/force recomputes; no source cells are changed and non-DEV never creates cache sheet',()=>{
 const {g,token}=fixture(3),args={token,from:'2026-11-16',to:'2026-11-16'},source=JSON.stringify(g.tables.get('sales').rows);send(g,'summary',args);evictReads(g);const sheet=g.tables.get('_ReportSnapshots'),row=sheet.rows.find(r=>r?.[0]?.startsWith('read:'));row[7]='corrupt';assert.equal(send(g,'summary',args).data.readModel.source,'sheets');
 evictReads(g);sheet.rows.find(r=>r?.[0]?.startsWith('read:'))[5]='invalid';assert.equal(send(g,'summary',args).data.readModel.source,'sheets');assert.equal(send(g,'summary',{...args,force:true}).data.readModel.source,'sheets');assert.equal(JSON.stringify(g.tables.get('sales').rows),source);
 const other=fixture(1);other.g.properties.set('AUTH_ENV','PROD');other.g.ctx.snapshotPut_({role:'admin'},'01234567',{}, {},other.g.ctx.stamp_());assert.equal(other.g.tables.has('_ReportSnapshots'),false);
});
test('lookup returns only allowed compact catalog fields; record details retain optimistic hash',()=>{
 const {g,token}=fixture(3);const lookup=send(g,'lookup',{token,module:'recipes'});assert.equal(lookup.ok,true);assert.equal(lookup.data.rows[0].name,'Recipe');assert.equal(lookup.data.rows[0].lines,undefined);
 const list=send(g,'list',{token,module:'recipes',compact:true});assert.equal(list.data.rows[0]._detailDeferred,true);assert.equal(list.data.rows[0].lines,undefined);
 const detail=send(g,'record',{token,module:'recipes',id:'r'});assert.equal(detail.data.row.lines.length,1);assert.ok(detail.data.row._hash);assert.equal(send(g,'lookup',{token,module:'cash'}).error.code,'VALIDATION');
 g.ctx.append_('_Users',['s','staff@example.com','staff','{"recipes":["read"]}',true,1]);const staff=g.ctx.issueSession_('staff@example.com','s').token;assert.equal(send(g,'lookup',{token:staff,module:'employees'}).error.code,'FORBIDDEN');assert.equal(send(g,'record',{token:staff,module:'sales',id:'s0'}).error.code,'FORBIDDEN');
});
test('payroll summary filters month/department after resolving reversals and cached inventory paginates',()=>{
 const {g,token}=fixture(110),attendance=g.tables.get('attendance'),headers=g.ctx.headers_('attendance'),copy=[...attendance.rows[1]];copy[0]='reversal';copy[headers.indexOf('reverses')]='a0';copy[headers.indexOf('date')]='2026-12-01';attendance.appendRow(copy);
 let r=send(g,'periodSummary',{token,kind:'payroll',from:'2026-11-01',to:'2026-11-30',department:'SX'});assert.equal(r.ok,true);assert.equal(r.data.rows[0].hours,1);assert.equal(r.data.rows[0].name,'Employee 1');assert.equal(r.data.total,109);assert.equal(r.data.next,100);
 const payrollNext=send(g,'periodSummary',{token,kind:'payroll',from:'2026-11-01',to:'2026-11-30',department:'SX',offset:100});assert.equal(payrollNext.data.rows.length,9);
 assert.equal(send(g,'periodSummary',{token,kind:'payroll',from:'2026-11-01',to:'2026-11-30',department:'VP'}).data.total,0);
 r=send(g,'periodSummary',{token,kind:'inventory',from:'2026-11-01',to:'2026-11-30'});assert.equal(r.data.rows.length,100);assert.equal(r.data.total,110);assert.equal(r.data.next,100);
 const next=send(g,'periodSummary',{token,kind:'inventory',from:'2026-11-01',to:'2026-11-30',offset:100});assert.equal(next.data.rows.length,10);
});
test('diagnostics separate server/payload timings without transmitting row data in telemetry',()=>{
 const {g,token}=fixture(1);g.properties.set('PERF_DIAGNOSTICS','true');const r=send(g,'list',{token,module:'materials'});assert.ok(Number.isFinite(r.meta.serverMs));assert.ok(r.meta.payloadChars>0);assert.equal(Object.keys(r.meta).sort().join(','),'payloadChars,serializeMs,serverMs');
});
test('cost, demand and variance read models match shared calculations without exporting source history',()=>{
 const {g,token}=fixture(3),args={token,from:'2026-11-01',to:'2026-11-30'},data=g.ctx.data_();
 const cost=send(g,'periodSummary',{...args,kind:'cost'});assert.equal(cost.ok,true);assert.equal(cost.data.rows[0].total,g.ctx.costRecipe('r',1,data,args.to).total);assert.equal(JSON.stringify(cost.data).includes('updatedBy'),false);
 const demand=send(g,'periodSummary',{...args,kind:'demand'});assert.equal(demand.ok,true);assert.equal(demand.data.note,g.ctx.demand(data,args.from,args.to).note);
 const variance=send(g,'periodSummary',{...args,kind:'variance'});assert.equal(variance.ok,true);assert.equal(variance.data.total,g.ctx.variance(data,args.from,args.to).length);
});
test('Dashboard returns department totals instead of the entire employee payroll',()=>{
  const {g,token}=fixture(150),result=send(g,'summary',{token,from:'2026-11-01',to:'2026-11-30'});assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(Object.hasOwn(result.data.report,'payroll'),false);assert.equal(result.data.report.payrollSummary.length,1);
  assert.equal(result.data.report.payrollSummary[0].hours,150);assert.equal(result.data.report.payrollSummary[0].base,1500);
  assert.equal(JSON.stringify(result.data.report).includes('employeeId'),false);assert.equal(result.data.report.revenue,4500);
});

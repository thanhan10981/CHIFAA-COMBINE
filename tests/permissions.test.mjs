import test from 'node:test';
import assert from 'node:assert/strict';
import {gas} from './gas-mock.mjs';
import {send} from './auth-helpers.mjs';
import {routeReadModules,pageActionOptions,canAccessPage} from '../src/shared/access.js';

test('sidebar policy covers reports without granting unrelated financial modules',()=>{
  assert.deepEqual(routeReadModules('entry-sales'),['sales','stores','dishes','discounts']);
  assert.deepEqual(routeReadModules('entry-payroll'),['attendance','employees']);
  for(const id of ['dashboard','opsdashboard','strategy']){
    const modules=routeReadModules(id);assert.ok(modules.includes('attendance'));assert.equal(modules.includes('loans'),false);assert.equal(modules.includes('debts'),false);assert.equal(modules.includes('assets'),false);
  }
  assert.deepEqual(pageActionOptions('entry-sales'),['read','create','approve','export']);
  assert.equal(pageActionOptions('catalog').includes('approve'),false);
  assert.deepEqual(pageActionOptions('inventory'),['read']);
});
test('explicit sidebar choices restrict routes; legacy module permissions remain compatible',()=>{
  const user={role:'accountant'},permissions={_routes:['entry-sales'],sales:['read','create'],stores:['read']};
  assert.equal(canAccessPage(user,permissions,'entry-sales'),true);
  for(const id of ['stores','dashboard','health','admin','no-such-page'])assert.equal(canAccessPage(user,permissions,id),false);
  assert.equal(canAccessPage(user,{sales:['read']},'entry-sales'),true);
  assert.equal(canAccessPage({role:'admin'},permissions,'admin'),true);
});
test('server accepts valid sidebar selections and rejects forged system/unknown grants',()=>{
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;
  const save=permissions=>send(g,'admin',{token,operation:'saveUser',email:'acct@example.com',role:'accountant',enabled:true,permissions});
  assert.equal(save({_routes:['entry-sales'],sales:['read']}).ok,true);
  for(const permissions of [{_routes:['admin']},{_routes:['health']},{_routes:['missing']},{_routes:['entry-sales','entry-sales']},{_routes:'entry-sales'},{sales:['root']},{secrets:['read']},[]])assert.equal(save(permissions).error.code,'VALIDATION');
  const acct=g.ctx.issueSession_('acct@example.com','acct').token;
  const result=send(g,'bootstrap',{token:acct});assert.equal(result.ok,true);assert.deepEqual(Array.from(result.data.permissions._routes),['entry-sales']);assert.deepEqual(Object.keys(result.data.data),['sales']);
  assert.equal(send(g,'health',{token:acct}).error.code,'FORBIDDEN');assert.equal(send(g,'export',{token:acct,module:'employees'}).error.code,'FORBIDDEN');
  assert.equal(send(g,'admin',{token:acct,operation:'saveUser',email:'acct@example.com',role:'admin',enabled:true,permissions:{}}).error.code,'FORBIDDEN');
});

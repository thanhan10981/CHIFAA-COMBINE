import test from 'node:test';import assert from 'node:assert/strict';
import {gas} from './gas-mock.mjs';import {send} from './auth-helpers.mjs';
test('New report caches skip business reads when hot, require fresh authorization and force/version changes revalidate',()=>{
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,args={token,from:'2026-11-01',to:'2026-11-30'};
  for(const action of ['kioskReport','orderPlans']){
    assert.equal(send(g,action,args).ok,true);const before=g.metrics.getValues;
    assert.equal(send(g,action,args).ok,true);assert.equal(g.metrics.getValues-before,3);
    const force=g.metrics.getValues;assert.equal(send(g,action,{...args,force:true}).ok,true);assert.ok(g.metrics.getValues-force>3);
  }
  g.ctx.append_('_Users',['staff','staff@example.com','staff','{}',true,1]);const other=g.ctx.issueSession_('staff@example.com','staff').token;
  assert.equal(send(g,'kioskReport',{...args,token:other}).error.code,'FORBIDDEN');assert.equal(send(g,'orderPlans',{...args,token:other}).error.code,'FORBIDDEN');
  g.tables.get('_Users').rows[1][4]=false;assert.equal(send(g,'kioskReport',args).error.code,'AUTH');
});
test('New read endpoints refuse a snapshot assembled across a concurrent write',()=>{
  for(const [action,fn]of [['kioskReport','kioskReport_'],['orderPlans','orderPlans_']]){
    const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token,read=g.ctx[fn];g.ctx[fn]=(user,args)=>{const value=read(user,args);g.ctx.bump_(['sales']);return value;};
    assert.equal(send(g,action,{token,from:'2026-11-01',to:'2026-11-30'}).error.code,'CONFLICT');
  }
});

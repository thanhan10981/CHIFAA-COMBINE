import test from 'node:test';
import assert from 'node:assert/strict';
import {gas} from './gas-mock.mjs';
import {client} from './client-fixture.mjs';
import {signed} from './auth-helpers.mjs';

test('client signs and sends opaque ASCII JSON; backend previews Unicode import and rejects tamper/replay',async()=>{
  const g=gas(),login=g.ctx.issueSession_('admin@example.com','wire-admin'),captured=[];
  const google={script:{run:{withSuccessHandler(success){return {withFailureHandler(){return {rpc(action,args){captured.push({action,args});success(g.ctx.rpc(action,args));}};}};}}}};
  const c=await client(true,google);c.context.login=structuredClone(login);await c.run('setRpcSession(login)');
  const note='Nguồn Đậu ve ≠ đường vàng\r\n"Cột giá" <>& 😀 \ud800';
  c.context.payload={token:login.token,operation:'previewImport',bundle:{records:[{module:'materials',recordId:'wire-material',record:{name:note,purchaseUnit:'kg',unit:'g',conversion:1000,purchasePrice:16000.125,minimum:0.0000001}}]}};
  const preview=await c.run("rpcCall('maintenance',payload)");assert.equal(preview.errors.length,0);assert.equal(preview.count,1);
  const wire=captured.at(-1).args;assert.equal(typeof wire,'string');assert.match(wire,/^[\x00-\x7f]*$/);assert.equal(JSON.parse(wire).bundle.records[0].record.name,note);
  assert.equal(g.ctx.rpc('maintenance',wire).error.code,'AUTH');
  const tampered=JSON.parse(wire);tampered.bundle.records[0].record.purchasePrice=1;assert.equal(g.ctx.rpc('maintenance',JSON.stringify(tampered)).error.code,'AUTH');
  assert.equal(g.ctx.rawRows_('materials').length,0);
});

test('wire parsing fails closed and preserves legacy signed clients and backend RBAC',()=>{
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','wire-admin').token;
  for(const invalid of ['{','null','[]','1','"text"'])assert.equal(g.ctx.rpc('sync',invalid).error.code,'VALIDATION');
  assert.equal(g.ctx.rpc('sync',JSON.stringify({token})).error.code,'AUTH');
  assert.equal(g.ctx.rpc('sync',signed(g,'sync',{token})).ok,true);
  g.ctx.append_('_Users',['wire-staff','staff@example.com','staff','{}',true,1]);const staff=g.ctx.issueSession_('staff@example.com','wire-staff').token;
  assert.equal(g.ctx.rpc('maintenance',JSON.stringify(signed(g,'maintenance',{token:staff,operation:'inspectSchema'}))).error.code,'FORBIDDEN');
});

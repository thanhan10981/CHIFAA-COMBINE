import test from 'node:test';
import assert from 'node:assert/strict';
import {gas} from './gas-mock.mjs';
import {client} from './client-fixture.mjs';
import {signed} from './auth-helpers.mjs';
import {requestMessage} from '../src/shared/auth-protocol.js';
import crypto from 'node:crypto';

test('V2 signs ASCII even for large Vietnamese payloads and binds its version; backend explicitly requests UTF-8',()=>{
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','wire-v2').token,args=signed(g,'sync',{token,note:'Đậu ve\r\n😀'.repeat(20000)},{version:2}),message=requestMessage('sync',args);
  assert.match(message,/^[\x00-\x7f]*$/);assert.ok(message.length>500000);
  const original=g.ctx.Utilities.computeHmacSha256Signature;g.ctx.Utilities.computeHmacSha256Signature=(text,key,charset)=>{assert.equal(charset,'UTF-8');assert.equal(crypto.createHmac('sha256',key).update(text,'ascii').digest('hex'),crypto.createHmac('sha256',key).update(text,'utf8').digest('hex'));return original(text,key);};
  assert.equal(g.ctx.rpc('sync',JSON.stringify(args)).ok,true);
  const changed=structuredClone(args);delete changed.proof.version;assert.notEqual(requestMessage('sync',changed),message);
  g.ctx.Utilities.computeHmacSha256Signature=original;assert.equal(g.ctx.rpc('sync',JSON.stringify(changed)).error.code,'AUTH');
});

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

test('mismatch diagnostics expose only a content-match flag and never authorize a checksum',()=>{
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','wire-diagnostic').token,args=signed(g,'maintenance',{token,operation:'inspectSchema'},{version:2});
  args.proof.messageHash=crypto.createHash('sha256').update(requestMessage('maintenance',args)).digest('hex');args.proof.signature='0'.repeat(64);
  let result=g.ctx.rpc('maintenance',JSON.stringify(args));assert.equal(result.error.code,'AUTH');assert.match(result.error.message,/nội dung khớp/);assert.ok(!result.error.message.includes(token));assert.ok(!result.error.message.includes(args.proof.messageHash));
  args.operation='backup';result=g.ctx.rpc('maintenance',JSON.stringify(args));assert.equal(result.error.code,'AUTH');assert.match(result.error.message,/nội dung đã thay đổi/);
});

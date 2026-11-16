import test from 'node:test';import assert from 'node:assert/strict';
import {propertyScenario} from './performance-fixture.mjs';import {gas} from './gas-mock.mjs';import {send} from './auth-helpers.mjs';import {client} from './client-fixture.mjs';
test('Request configuration batches property reads without caching live sync state',()=>{
  for(const action of ['sync','summary','mutate']){const before=propertyScenario(action,true),after=propertyScenario(action,false);assert.equal(after.properties.batchReads,1);assert.ok(after.propertyCalls<before.propertyCalls/2,JSON.stringify({before,after}));assert.equal(after.sheetsGetValues,before.sheetsGetValues);}
});
test('Configuration updates are visible within the request; new requests reread auth configuration and live stamps stay fresh',()=>{
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;g.properties.set('BACKUP_FOLDER_ID','before');
  g.ctx.maintenance_=()=>{assert.equal(g.ctx.config_('BACKUP_FOLDER_ID'),'before');g.ctx.props_().setProperty('BACKUP_FOLDER_ID','after');assert.equal(g.ctx.config_('BACKUP_FOLDER_ID'),'after');g.properties.set('SYNC_VERSION','external-change');assert.equal(g.ctx.stamp_(),'external-change');return {saved:true};};
  assert.equal(send(g,'maintenance',{token}).ok,true);g.properties.set('GOOGLE_CLIENT_ID','changed');assert.equal(send(g,'sync',{token}).error.code,'AUTH');
});
test('Returning to a visible page checks sync promptly but repeated visibility events do not flood requests',async()=>{
  const c=await client();Object.defineProperty(c.document,'hidden',{value:false,writable:true,configurable:true});
  c.run(`state.demo=false;state.token='fixture';globalThis.syncCalls=0;call=async()=>{syncCalls++;return {permissionVersion:state.permissionVersion,grants:state.grants,stamp:state.stamp};};document.dispatchEvent(new window.Event('visibilitychange'));`);for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(c.run('syncCalls'),1);c.run(`document.dispatchEvent(new window.Event('visibilitychange'));`);for(let i=0;i<4;i++)await Promise.resolve();assert.equal(c.run('syncCalls'),1);
  c.run(`document.hidden=true;lastSyncAttempt=Date.now()-16000;document.dispatchEvent(new window.Event('visibilitychange'));`);assert.equal(c.run('syncCalls'),1);
  c.run(`document.hidden=false;document.dispatchEvent(new window.Event('visibilitychange'));`);for(let i=0;i<8;i++)await Promise.resolve();assert.equal(c.run('syncCalls'),2);
});

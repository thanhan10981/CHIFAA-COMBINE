import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceNavigation,referenceRoutes} from '../features/design/routes';
import {modules} from '../lib/navigation';
import blueprints from '../features/design/blueprints.json';

test('all 32 draft destinations map to an existing permission-checked module',()=>{
 const links=[...referenceNavigation.top,...referenceNavigation.groups.flatMap(group=>group.items)];
 assert.equal(referenceNavigation.groups.length,5);
 assert.equal(links.length,32);
 for(const link of links){
  const route=referenceRoutes[link.id];assert.ok(route,link.id);assert.ok(blueprints[link.id as keyof typeof blueprints],link.id);
  if(route.slug)assert.ok(modules.some(([slug,,module])=>slug===route.slug&&module===route.module),link.id);
  assert.doesNotMatch(link.icon,/<script|\son\w+\s*=|(?:href|src)\s*=/i);
 }
});

test('reference layouts cannot execute legacy handlers, embed pages, or submit disconnected forms',()=>{
 for(const [id,html] of Object.entries(blueprints)){
  assert.doesNotMatch(html,/<script|<iframe|<object|<embed|\son\w+\s*=|javascript:|\s(?:action|formaction|srcdoc)\s*=/i,id);
  for(const tag of html.matchAll(/<(?:button|input|select|textarea)\b[^>]*>/gi))assert.match(tag[0],/\bdisabled\b/,id);
 }
});

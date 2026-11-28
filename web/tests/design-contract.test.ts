import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceNavigation,referenceRoutes} from '../features/design/routes';
import {modules} from '../lib/navigation';
import blueprints from '../features/design/blueprints.json';
import {readFileSync} from 'node:fs';
import {workspaceNavigation,navigationParents} from '../features/design/routes';

test('workspace menu preserves the actual legacy groups, order and names without a utility dumping ground',()=>{
 const navigation=readFileSync(new URL('../../src/client/navigation.js',import.meta.url),'utf8');
 const sections=JSON.parse(navigation.match(/const NAV_SECTIONS = (\[[\s\S]*?\]);/)![1]) as [string,string,string,string[]][];
 const schema=readFileSync(new URL('../../src/shared/schema.js',import.meta.url),'utf8');
 const names=new Map([...schema.matchAll(/\['([^']+)','([^']+)','([^']+)'\]/g)].map(match=>[match[1],match[2]]));
 assert.equal(workspaceNavigation.groups.length,sections.length);
 for(const [index,[id,label,,items]] of sections.entries()){
  const actual=workspaceNavigation.groups[index];assert.equal(actual.id,'legacy-'+id);assert.equal(actual.label,label);
  assert.deepEqual(actual.items.map(item=>item.id).filter(id=>id!=='toppings'&&id!=='bank-settings'),items.filter(item=>!(id==='warehouse'&&item==='kiosk')&&item!=='assets'));
  for(const item of actual.items.filter(item=>item.id!=='toppings'&&item.id!=='bank-settings')){assert.equal(item.label,names.get(item.id));const route=referenceRoutes[item.id];assert.ok(route,item.id);assert.ok(modules.some(([slug,,module])=>slug===route.slug&&module===route.module),item.id);}
 }
 const links=[...workspaceNavigation.top,...workspaceNavigation.groups.flatMap(group=>group.items)];assert.equal(links.length,37);assert.equal(new Set(links.map(item=>item.id)).size,37);
 assert.ok(referenceRoutes.toppings&&modules.some(([slug,,module])=>slug===referenceRoutes.toppings.slug&&module===referenceRoutes.toppings.module));
 assert.ok(workspaceNavigation.groups.flatMap(group=>group.items).some(item=>item.id==='bank-settings'));
 assert.ok(!workspaceNavigation.groups.find(group=>group.id==='legacy-warehouse')?.items.some(item=>item.id==='kiosk'));
 assert.ok(workspaceNavigation.groups.find(group=>group.id==='legacy-customers')?.items.some(item=>item.id==='orders'));
 for(const [slug,parent] of Object.entries(navigationParents)){assert.ok(modules.some(([path])=>path===slug));assert.ok(links.some(item=>referenceRoutes[item.id].slug===parent));}
});

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

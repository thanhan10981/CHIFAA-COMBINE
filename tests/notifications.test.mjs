import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
function notices(){
  const {document}=parseHTML('<html><body><div id="toast" hidden></div></body></html>'),timers=new Map();let next=0;
  const context=vm.createContext({document,Map,Object,String,setTimeout(fn,ms){const id=++next;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);}});
  vm.runInContext(fs.readFileSync('src/client/notifications.js','utf8').replace(/^export .*$/gm,''),context);
  return {document,timers,run:code=>vm.runInContext(code,context)};
}
test('toast renders untrusted text safely, exposes status/alert and supports dismissal',()=>{
  const n=notices();n.run("toast('<img src=x onerror=alert(1)>')");
  assert.equal(n.document.querySelector('img'),null);assert.equal(n.document.querySelector('.toast-card').getAttribute('role'),'status');
  n.run("notifyError(new Error('Denied'))");assert.equal(n.document.querySelector('.toast-error').getAttribute('role'),'alert');
  assert.equal(n.document.getElementById('toast').hidden,false);
  for(const b of [...n.document.querySelectorAll('.toast-close')])b.onclick();
  assert.equal(n.document.getElementById('toast').hidden,true);assert.equal(n.timers.size,0);
});
test('toast timers cannot hide a newer message; duplicates reset timers and stack is bounded',()=>{
  const n=notices();n.run("toast('Saved')");const old=[...n.timers.values()][0].fn;
  n.run("toast('New message')");old();assert.equal(n.document.getElementById('toast').hidden,false);assert.match(n.document.getElementById('toast').textContent,/New message/);
  n.run("toast('New message')");assert.equal(n.document.querySelectorAll('.toast-card').length,1);assert.equal(n.timers.size,1);
  n.run("for(let i=0;i<6;i++)toast('Notice '+i)");assert.equal(n.document.querySelectorAll('.toast-card').length,4);assert.equal(n.timers.size,4);
  n.run('clearToasts()');assert.equal(n.timers.size,0);assert.equal(n.document.getElementById('toast').hidden,true);
});
test('network uncertainty uses warning, longer lifetime and pauses on pointer/focus',()=>{
  const n=notices();n.run("notifyError(Object.assign(new Error('Not confirmed'),{code:'TIMEOUT'}))");
  const card=n.document.querySelector('.toast-warning');assert.ok(card);assert.equal([...n.timers.values()][0].ms,10000);
  card.onmouseenter();assert.equal(n.timers.size,0);card.onmouseleave();assert.equal(n.timers.size,1);
  card.onfocusin();assert.equal(n.timers.size,0);card.onfocusout();assert.equal(n.timers.size,1);
  [...n.timers.values()][0].fn();assert.equal(n.document.getElementById('toast').hidden,true);
});

test('notifications stay interactive inside a modal then return to body after it closes',()=>{
  const n=notices(),dialog=n.document.createElement('dialog');dialog.setAttribute('open','');n.document.body.append(dialog);
  n.run("toast('Form error','error')");assert.equal(n.document.getElementById('toast').parentElement,dialog);
  dialog.removeAttribute('open');n.run("toast('Saved')");assert.equal(n.document.getElementById('toast').parentElement,n.document.body);
});

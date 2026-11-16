import test from 'node:test';import assert from 'node:assert/strict';
import {cleanRecord,unitConversion,flattenRecipe,costRecipe} from '../src/shared/domain.js';import {gas} from './gas-mock.mjs';import {send} from './auth-helpers.mjs';
test('Known mass/volume units use physical ratios; package yield is explicit and cooking yield is separate',()=>{
  const material={name:'Rice',purchaseUnit:' kg ',unit:'gam',conversion:1000,purchasePrice:20000,minimum:0};
  assert.equal(cleanRecord('materials',material).conversion,1000);assert.throws(()=>cleanRecord('materials',{...material,conversion:2.5}),/Sai quy đổi/);
  assert.equal(unitConversion('lít','ml').expected,1000);assert.equal(unitConversion('g','kg').expected,.001);
  assert.throws(()=>cleanRecord('materials',{...material,unit:'ml'}),/khối lượng/);
  assert.equal(cleanRecord('materials',{...material,purchaseUnit:'túi',unit:'g',conversion:2500}).conversion,2500);
});
test('114g cooked rice x100 at fixture yield2.5 uses4.56kg raw; no application default factor is introduced',()=>{
  const recipes=[{recordId:'meal',yield:1,lines:[{type:'recipe',id:'rice',quantity:.114}]},{recordId:'rice',yield:2.5,lines:[{type:'material',id:'raw',quantity:1}]}];
  const raw=flattenRecipe('meal',100,recipes);assert.ok(Math.abs(raw.raw-4.56)<1e-10);
  assert.equal(costRecipe('meal',100,{recipes,materials:[{recordId:'raw',purchasePrice:20000,conversion:1}],stock:[]},'current').total,91200);
});
test('Schema inspection reports missing/wrong headers without touching cells and setup fails before any rewrite',()=>{
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;
  const inspect=()=>send(g,'maintenance',{token,operation:'inspectSchema'});assert.equal(inspect().data.ready,true);
  g.tables.get('sales').rows[0][7]='legacy-date';const before=JSON.stringify(g.tables.get('sales').rows),result=inspect();assert.equal(result.data.ready,false);assert.equal(result.data.rows.find(r=>r.name==='sales').status,'mismatch');
  assert.throws(()=>g.ctx.setup_(),/SCHEMA/);assert.equal(JSON.stringify(g.tables.get('sales').rows),before);
});

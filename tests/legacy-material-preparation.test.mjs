import test from 'node:test';import assert from 'node:assert/strict';
import {legacyMaterialId,parseLegacyMaterials,prepareLegacyMaterials} from '../scripts/legacy-material-preparation.mjs';import {gas} from './gas-mock.mjs';
const header='STT\tMã SP\tTên vật tư\tĐVT\tĐơn giá (đ/ĐVT)\tNhóm\tTồn tối thiểu\tTồn hiện tại\tGiá trị tồn (đ)\tCảnh báo\tQuy cách (số đv nhỏ / 1 ĐVT)';
const row=(code,{minimum='1',price='16.000',unit='Kg',conversion='1.000'}={})=>['1',code,'Source name',unit,price,'Source group',minimum,'#N/A','#N/A','#N/A',conversion].join('\t');
test('Material source errors stay distinct from opening inventory and blank thresholds stay unknown',()=>{
  const text=header+'\n'+row('A',{minimum:'',price:''})+'\n'+row('B',{price:'0'}),parsed=parseLegacyMaterials(text);assert.equal(parsed[0].minimum,null);assert.equal(parsed[0].purchasePrice,null);assert.equal(parsed[0].sourceBalance,'#N/A');assert.equal(parsed[1].purchasePrice,0);
  const p=prepareLegacyMaterials(text,{});assert.equal(p.materialsReady,1);assert.equal(p.materialsPending.length,1);assert.equal(p.bundle.records[0].record.minimum,1000);assert.equal(p.bundle.records[0].record.purchasePrice,0);
});
test('Vietnamese material codes preserve identity; annotation units cannot silently use kilogram price',()=>{
  assert.notEqual(legacyMaterialId('ĐV'),legacyMaterialId('DV'));assert.match(legacyMaterialId('ĐUA'),/^[\w-]+$/);
  const p=prepareLegacyMaterials(header+'\n'+row('A',{unit:'Kg(chai = 250g)'}),{});assert.equal(p.materialsReady,0);assert.equal(p.materialsPending.length,1);
});
test('Only complete batch recipes are included, with actual consumption quantities and preserved minimum units',()=>{
  const text=header+'\n'+row('ĐV')+'\n'+row('DV'),staging={sections:[{name:'Complete source batch',type:'batch',yieldSource:2,lines:[{code:'DV',quantity:100,unit:'g'}]},{name:'Incomplete batch',type:'batch',yieldSource:2,lines:[{code:'ABSENT',quantity:1,unit:'g'}]}]};
  const p=prepareLegacyMaterials(text,staging);assert.equal(p.materialsReady,2);assert.equal(p.recipesReady,1);assert.equal(p.recipesPending.length,1);assert.deepEqual(p.missingRecipeCodes,['ABSENT']);
  const g=gas(),preview=g.ctx.previewImport_(p.bundle);assert.equal(preview.errors.length,0);g.ctx.applyImport_(p.bundle,preview.digest,'materials-fixture-key-0001');assert.equal(g.ctx.rawRows_('materials').length,2);assert.equal(g.ctx.rawRows_('recipes').length,1);assert.equal(g.ctx.rawRows_('stock').length,0);
});

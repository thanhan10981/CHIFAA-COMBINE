import test from 'node:test';import assert from 'node:assert/strict';
import {legacyNumber,extractLegacyRecipes,prepareLegacyCatalog} from '../scripts/legacy-catalog-preparation.mjs';
import {gas} from './gas-mock.mjs';
test('Legacy numeric parsing preserves decimal commas, thousands, missing and true zero',()=>{
  assert.equal(legacyNumber('1.000'),1000);assert.equal(legacyNumber('0,050'),.05);assert.equal(legacyNumber('6,40'),6.4);assert.equal(legacyNumber(''),null);assert.equal(legacyNumber('0'),0);assert.throws(()=>legacyNumber('2,3 – 2,5'));assert.throws(()=>legacyNumber('1.25'));
});
test('Legacy recipe staging preserves source units and packaging rows without STT',()=>{
  const source='CÔNG THỨC NHÂN A\nSố phần / 1 mẻ\t\t75\nSTT\tMã SP\tTên nguyên liệu\tĐVT\tĐịnh lượng 1 mẻ\n1\tXX\t\tg\t1.000\nCHI PHÍ BAO BÌ / 1 ĐƠN VỊ BÁN\nSTT\tMã SP\tThành phần\tĐVT\tSố lượng\tĐơn giá\tThành tiền\n\t\tHộp\n\tTEMCC\t\tcái\t1\t77,00\t77';
  const parsed=extractLegacyRecipes(source);assert.equal(parsed.sections.length,2);assert.equal(parsed.sections[0].yieldSource,75);assert.equal(parsed.sections[0].lines[0].quantity,1000);assert.equal(parsed.sections[1].lines[0].code,'TEMCC');
});
test('Prepared catalog passes server preview/apply and refuses replayed IDs, keeps unresolved finance out',()=>{
  const input={stores:[{code:'ĐB01',name:'Store',rate:.15},{code:'ĐB02',name:''}],dishes:[{code:'A',name:'Dish',price:15000,sourceCost:5000,unit:'Phần'},{code:'B',name:'Whole',price:10000,sourceCost:6000,unit:'Cây'}],uncheckedDishCodes:['B']};
  const result=prepareLegacyCatalog(input,'');assert.equal(result.bundle.records.length,3);assert.equal(result.skipped.length,1);assert.equal(result.discountsPending.length,1);assert.equal(result.discountsPending[0].recoveryPrice,null);assert.equal(result.bundle.records[1].record.published,false);assert.equal(result.mapping[0].legacyCode,'ĐB01');
  const g=gas(),preview=g.ctx.previewImport_(result.bundle,'owner@example.com');assert.equal(preview.errors.length,0);g.ctx.applyImport_(result.bundle,preview.digest,'legacy-fixture-0001','owner@example.com');assert.equal(g.ctx.rawRows_('stores').length,1);assert.equal(g.ctx.rawRows_('dishes').length,2);assert.equal(g.ctx.previewImport_(result.bundle).errors.length,3);assert.equal(g.ctx.rawRows_('stock').length,0);
});

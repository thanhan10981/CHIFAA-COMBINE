import test from 'node:test';
import assert from 'node:assert/strict';
import {ingredientWarehouseId} from '../features/operations/ingredient-warehouse';
import {contextNavigation} from '../features/design/routes';
test('single ingredient warehouse resolves automatically; missing or ambiguous legacy warehouses cannot be invented or merged',()=>{
 assert.equal(ingredientWarehouseId(undefined),'');assert.equal(ingredientWarehouseId([]),'');
 assert.equal(ingredientWarehouseId([{id:'ingredient-id',name:'Nguyên liệu'}]),'ingredient-id');
 assert.equal(ingredientWarehouseId([{id:'one',name:'Old one'},{id:'two',name:'Old two'}]),'');
 assert.ok(contextNavigation.every(group=>!group.includes('warehouses')));
});

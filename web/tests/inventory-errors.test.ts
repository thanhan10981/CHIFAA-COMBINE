import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryPostError} from '../features/operations/inventory-errors';

test('inventory shortage error explains requested, available, and shortage quantities',()=>{
 const message=inventoryPostError({code:'P0001',message:'INSUFFICIENT_STOCK',details:JSON.stringify({material_code:'BAP',material_name:'Bắp',unit_code:'quả',transaction_date:'2026-11-23',requested_quantity:'1',available_quantity:'0',shortage_quantity:'1',negative_balance_date:'2026-11-23',projected_balance:'-1'})});
 assert.match(message,/BAP · Bắp/);assert.match(message,/cần 1 quả/);assert.match(message,/tồn trước phiếu 0 quả/);assert.match(message,/thiếu 1 quả/);assert.match(message,/23\/11\/2026/);assert.doesNotMatch(message,/INSUFFICIENT_STOCK/);
});

test('inventory shortage explains when a backdated issue would break a later balance',()=>{
 const message=inventoryPostError({code:'P0001',message:'INSUFFICIENT_STOCK',details:JSON.stringify({material_code:'BAP',material_name:'Bắp',unit_code:'quả',transaction_date:'2026-11-23',requested_quantity:'1',available_quantity:'7',shortage_quantity:'2',negative_balance_date:'2026-11-25',projected_balance:'-2'})});
 assert.match(message,/tồn trước phiếu 7 quả/);assert.match(message,/tồn sẽ âm 2 quả vào 25\/11\/2026/);assert.doesNotMatch(message,/INSUFFICIENT_STOCK/);
});

test('inventory shortage fallback remains specific when server details are missing',()=>{
 const message=inventoryPostError({code:'P0001',message:'INSUFFICIENT_STOCK'},{code:'BAP',name:'Bắp',unit:'quả',date:'2026-11-23',requested:'1',available:'7'});
 assert.match(message,/BAP · Bắp/);assert.match(message,/cần 1 quả/);assert.match(message,/tồn trước phiếu 7 quả/);
});

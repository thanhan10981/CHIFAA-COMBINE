import test from 'node:test';
import assert from 'node:assert/strict';
import {loadMenuPages,sortProductsByMenuOrder} from '../lib/product-order';

test('menu items follow the reference, keep unknown products and put whole rolls last',()=>{
 const expected=['CN-XXPM','CN-XXMY','CN-TERI','CN-GPM','CN-BV','CN-CNM','CC','CCC','CN-MY'];
 const source=['CCC-NC','NEW-A',...[...expected].reverse(),'CC-NC','NEW-B'].map(code=>({code,quantity:'1.25'})),before=structuredClone(source);
 assert.deepEqual(sortProductsByMenuOrder(source).map(item=>item.code),[...expected,'NEW-A','NEW-B','CC-NC','CCC-NC']);
 assert.deepEqual(source,before);
 assert.deepEqual(sortProductsByMenuOrder([{product_code:' ccc '},{product_code:'CC'},{product_code:null}],line=>line.product_code).map(line=>line.product_code),['CC',' ccc ',null]);
});

test('menu pages sort the complete result before display pagination and reject an incomplete response',async()=>{
 const offsets:number[]=[];
 const all=await loadMenuPages(async offset=>{offsets.push(offset);return {rows:(offset===0?['CCC-NC','CC']:['CN-XXPM','CN-MY']).map(code=>({code})),total:4};});
 assert.deepEqual(offsets,[0,2]);assert.deepEqual(all.rows.slice(0,2).map(row=>row.code),['CN-XXPM','CC']);
 await assert.rejects(loadMenuPages(async offset=>({rows:offset?[]:[{code:'CC'}],total:2})),/./);
});

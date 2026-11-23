import test from 'node:test';
import assert from 'node:assert/strict';
import {productImageFailure} from '../features/catalog/product-image-errors';

test('product image upload errors distinguish missing bucket, permission denial and network errors',()=>{
 assert.match(productImageFailure({message:'Bucket not found',statusCode:'404'},'upload'),/bucket product-images.*migration 059/i);
 assert.match(productImageFailure({message:'new row violates row-level security policy',statusCode:'403'},'upload'),/products\.edit.*product_images_edit/i);
 assert.match(productImageFailure(new TypeError('Failed to fetch'),'upload'),/Không kết nối được Supabase Storage/i);
 assert.match(productImageFailure({message:'Unexpected storage response',statusCode:'502'},'upload'),/HTTP 502.*Unexpected storage response/);
 assert.match(productImageFailure(Object.assign(new Error('Bad gateway'),{statusCode:'502'}),'upload'),/HTTP 502.*Bad gateway/);
});

test('product image save errors distinguish missing RPC and denied permission',()=>{
 assert.match(productImageFailure({message:'FORBIDDEN'},'save'),/products\.edit/);
 assert.match(productImageFailure({message:'Could not find the function save_product_image',code:'PGRST202'},'save'),/RPC save_product_image.*migration 059/i);
});

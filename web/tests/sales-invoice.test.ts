import assert from 'node:assert/strict';
import test from 'node:test';
import {invoiceAmounts,invoiceRows,invoiceMoneyWords,invoiceSubtotalExpression,vietQrQuickLink,type InvoiceLine} from '../features/orders/sales-invoice';

const line=(code:string,overrides:Partial<InvoiceLine>={}):InvoiceLine=>({order_item_id:code,product_code:code,product_name:code,sale_unit:'phần',ordered_quantity:'2',price_vnd:'15000',discount_rate:'0.17',...overrides});
test('invoice follows template, keeps unlisted/duplicate lines and leaves missing products blank without mutating snapshots',()=>{
 const lines=[line('CCC-NC'),line('NEW'),line('CN-CNM'),line('CN-XXPM'),line('CN-XXPM',{order_item_id:'second',price_vnd:'16000'})],before=structuredClone(lines);
 const rows=invoiceRows(lines);
 assert.deepEqual(rows.main.map(row=>row.code),['CN-XXPM','CN-XXPM','CN-XXMY','CN-TERI','CN-GPM','CN-BV','CN-CNM','CC','CCC','CN-MY','NEW']);
 assert.deepEqual(rows.whole.map(row=>row.code),['CC-NC','CCC-NC']);
 assert.equal(rows.main[2].line,null);assert.equal(rows.whole[0].line,null);
 assert.equal([...rows.main,...rows.whole].filter(row=>row.line).length,lines.length);
 assert.deepEqual(lines,before);
});
test('invoice totals match PostgreSQL per-line half-up rounding for mixed rates, whole rolls, fractions and large exact amounts',()=>{
 const lines=[line('CN-XXPM',{ordered_quantity:'0.5',price_vnd:'1',discount_rate:'0.15'}),line('CC-NC',{ordered_quantity:'1',price_vnd:'10000',discount_rate:'0'}),line('CN-CNM',{ordered_quantity:'3',price_vnd:'15000',discount_rate:'0.17'})];
 assert.deepEqual(invoiceAmounts(lines),{gross:'55001',net:'47350',discounts:[{rate:'0.15',amount:'1'},{rate:'0.17',amount:'7650'}]});
 assert.equal(invoiceAmounts([line('X',{ordered_quantity:'999999999',price_vnd:'999999999',discount_rate:'0'})]).net,'999999998000000001');
 assert.deepEqual(invoiceAmounts([]),{gross:'0',net:'0',discounts:[]});
});
test('invoice subtotal shows total quantity times unit price, grouping different units/prices clearly',()=>{
 assert.equal(invoiceSubtotalExpression([line('A',{ordered_quantity:'30'}),line('B',{ordered_quantity:'46'})]),'76 × 15.000');
 assert.equal(invoiceSubtotalExpression([line('A',{ordered_quantity:'3',sale_unit:'Phần'}),line('B',{ordered_quantity:'2',sale_unit:'Hộp',price_vnd:'20000'})]),'3 Phần × 15.000 + 2 Hộp × 20.000');
 assert.equal(invoiceSubtotalExpression([]),'');
});
test('invoice spells payable in Vietnamese without rounding through Number',()=>{
 for(const [value,expected] of [['0','Không đồng'],['597600','Năm trăm chín mươi bảy nghìn sáu trăm đồng'],['1000001','Một triệu không trăm lẻ một đồng'],['1015000000','Một tỷ không trăm mười lăm triệu đồng'],['25000','Hai mươi lăm nghìn đồng']])assert.equal(invoiceMoneyWords(value),expected);
});

test('VietQR link locks the payable amount and order reference into the bank transfer QR',()=>{const url=vietQrQuickLink({bank_bin:'970415',account_number:'113366668888',account_holder:'CHIFAA COMPANY',amount:'47350',order_code:'A1B2C3D4'});assert.ok(url);const parsed=new URL(url);assert.equal(parsed.hostname,'img.vietqr.io');assert.equal(parsed.searchParams.get('amount'),'47350');assert.equal(parsed.searchParams.get('addInfo'),'THANH TOAN DON HANG A1B2C3D4');assert.equal(parsed.searchParams.get('accountName'),'CHIFAA COMPANY');assert.equal(vietQrQuickLink({bank_bin:'9704',account_number:'12',account_holder:'A',amount:'0',order_code:'X'}),null);});

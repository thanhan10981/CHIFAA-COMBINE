import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {createOrderSummaryWorkbook,type OrderSummaryData} from '../features/orders/order-summary';

test('daily order workbook includes requested columns, store matrix, print layout and company logo',async()=>{
 const originalFetch=globalThis.fetch;
 const logo=await fs.readFile(path.resolve('public/logo-chifaa.png'));
 globalThis.fetch=async()=>new Response(new Uint8Array(logo),{status:200,headers:{'content-type':'image/png'}});
 try {
  const data:OrderSummaryData={date:'2026-11-23',planned_quantity_total:'2',stores:[{id:'store-1',code:'DB01',name:'Điểm Bảo',phone:'0900000000'}],orders:[{id:'order-1',code:'a1b2c3d4',store_id:'store-1',store_code:'DB01',store_name:'Điểm Bảo',store_phone:'0900000000',customer_name:null,customer_phone:null,delivery_date:'2026-11-23',shift:'AM',status:'approved',note:'Giao sáng',total_quantity:'2',discount_rate:'0.15',discount_vnd:'300',order_total_vnd:'1700',old_deduction_vnd:null,cash_received_vnd:'500',bank_received_vnd:'0',payment_method:'Tiền mặt',outstanding_vnd:'1200',items:[{product_id:'product-1',code:'P1',name:'Món thử',quantity:'2',unit:'phần',price_vnd:'1000',discount_rate:'0.15',line_total_vnd:'1700'}]}],products:[{product_id:'product-1',code:'P1',name:'Món thử',unit:'phần',total_quantity:'2',by_store:{'store-1':'2'}}]};
  const blob=await createOrderSummaryWorkbook(data),workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  assert.deepEqual(workbook.worksheets.map(sheet=>sheet.name),['Tổng hợp đơn','Sản lượng theo điểm']);
  const summary=workbook.getWorksheet('Tổng hợp đơn')!;
  const headers:string[]=[];summary.getRow(3).eachCell(cell=>headers.push(String(cell.value??'')));assert.deepEqual(headers,['Mã','Điểm bán · điện thoại','Ngày giao','Tổng số lượng','Mức chiết khấu','Chi tiết món','Trừ tiền đơn cũ','Tổng thanh toán','CK hoặc tiền mặt','Ghi chú']);
  assert.equal(summary.getRow(4).getCell(8).value,1700);
  assert.equal(summary.getRow(4).getCell(5).numFmt,'0.00%');
  assert.equal(summary.getImages().length,1);
  assert.equal(workbook.getWorksheet('Sản lượng theo điểm')!.getRow(2).getCell(3).value,2);
 } finally {globalThis.fetch=originalFetch;}
});

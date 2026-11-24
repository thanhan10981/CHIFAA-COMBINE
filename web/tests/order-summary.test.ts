import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {createOrderSummaryWorkbook,orderDemandIssueText,type OrderMaterialDemandData,type OrderSummaryData} from '../features/orders/order-summary';

test('order demand warnings identify a missing effective recipe and product conversion without guessing requirements',()=>{
 const message=orderDemandIssueText({product_id:'product-1',issue:'PUBLISHED_PRODUCT_RECIPE_REQUIRED'},[{product_id:'product-1',code:'MON-1',name:'Món kiểm thử',unit:'phần',total_quantity:'10',by_store:{}}]);
 assert.match(message,/Món kiểm thử \(MON-1\)/);assert.match(message,/công thức đã công bố và tỷ lệ quy đổi món bán có hiệu lực trong ngày giao/);assert.match(message,/Danh mục món bán/);assert.doesNotMatch(message,/PUBLISHED_PRODUCT_RECIPE_REQUIRED/);
});

test('daily order workbook puts the store matrix and ingredient demand first, then keeps order details',async()=>{
 const originalFetch=globalThis.fetch;
 const logo=await fs.readFile(path.resolve('public/logo-chifaa.png'));
 globalThis.fetch=async()=>new Response(new Uint8Array(logo),{status:200,headers:{'content-type':'image/png'}});
 try {
  const data:OrderSummaryData={date:'2026-11-23',planned_quantity_total:'2',stores:[{id:'store-1',code:'DB01',name:'Điểm Bảo',phone:'0900000000'},{id:'store-2',code:'K02',name:'Điểm Ki ốt',phone:null}],orders:[{id:'order-1',code:'a1b2c3d4',store_id:'store-1',store_code:'DB01',store_name:'Điểm Bảo',store_phone:'0900000000',customer_name:null,customer_phone:null,delivery_date:'2026-11-23',shift:'AM',status:'approved',note:'Giao sáng',total_quantity:'2',discount_rate:'0.15',discount_vnd:'300',order_total_vnd:'1700',old_deduction_vnd:null,cancelled_loss_vnd:'0',cash_received_vnd:'500',bank_received_vnd:'0',payment_method:'Tiền mặt',outstanding_vnd:'1200',items:[{product_id:'product-1',code:'P1',name:'Cơm cuộn',quantity:'2',unit:'phần',price_vnd:'1000',discount_rate:'0.15',line_total_vnd:'1700'}]}],products:[{product_id:'product-1',code:'P1',name:'Cơm cuộn',unit:'phần',total_quantity:'2',by_store:{'store-1':'2','store-2':'0'}}]};
  const demand:OrderMaterialDemandData={issues:[],materials:[{code:'GAO',name:'Gạo',unit_code:'kg',quantity:'1.25',stock_quantity:'3',minimum_quantity:'1',shortage_quantity:'0',status:'ok'}]};
  const blob=await createOrderSummaryWorkbook(data,demand),workbook=new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  assert.deepEqual(workbook.worksheets.map(sheet=>sheet.name),['Bảng tổng hợp','Chi tiết đơn']);
  const matrix=workbook.getWorksheet('Bảng tổng hợp')!;
  assert.equal(matrix.getCell('B1').value,'BẢNG TỔNG HỢP KHÁCH HÀNG ĐẶT HÀNG · 23/11/2026');
  assert.equal(matrix.getCell('A2').value,'Stt');
  assert.equal(matrix.getCell('B2').value,'TÊN SẢN PHẨM');
  assert.equal(matrix.getCell('C2').value,'Danh sách khách đặt hàng');
  assert.equal(matrix.getCell('C3').value,'Điểm Bảo\nDB01');
  assert.equal(matrix.getCell('B4').value,'Cơm cuộn');
  assert.equal(matrix.getCell('C4').value,2);
  assert.equal(matrix.getCell('D4').value,'');
  assert.equal(matrix.getCell('E4').value,2);
  assert.equal(matrix.getCell('A5').value,'TỔNG SỐ LƯỢNG');
  assert.equal(matrix.getCell('C5').value,2);
  assert.equal(matrix.getCell('D5').value,0);
  assert.equal(matrix.getCell('E5').value,2);
  assert.equal(matrix.getCell('A7').value,'NHU CẦU NGUYÊN LIỆU TỪ ĐƠN ĐÃ DUYỆT');
  assert.equal(matrix.getCell('A10').value,'Mã vật tư');
  assert.equal(matrix.getCell('A11').value,'GAO');
  assert.equal(matrix.getCell('D11').value,1.25);
  assert.equal(matrix.getCell('G11').value,'Đủ');
  assert.equal(matrix.getImages().length,1);
  const details=workbook.getWorksheet('Chi tiết đơn')!;
  assert.equal(details.getRow(3).getCell(9).value,'Tổng thanh toán');
  assert.equal(details.getRow(4).getCell(9).value,1700);
  assert.equal(details.getImages().length,1);
 } finally {globalThis.fetch=originalFetch;}
});

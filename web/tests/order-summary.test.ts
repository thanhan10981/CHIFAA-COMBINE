import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {createOrderSummaryWorkbook,orderDemandIssueText,sortOrderSummaryProducts,wholeRollOrderSummaryProducts,type OrderMaterialDemandData,type OrderSummaryData} from '../features/orders/order-summary';

test('order demand warnings identify a missing effective recipe and product conversion without guessing requirements',()=>{
 const message=orderDemandIssueText({product_id:'product-1',issue:'PUBLISHED_PRODUCT_RECIPE_REQUIRED'},[{product_id:'product-1',code:'MON-1',name:'Món kiểm thử',unit:'phần',total_quantity:'10',by_store:{}}]);
 assert.match(message,/Món kiểm thử \(MON-1\)/);assert.match(message,/chưa tìm thấy phiên bản công thức đã công bố/);assert.match(message,/Mở Công thức món ăn/);assert.doesNotMatch(message,/PUBLISHED_PRODUCT_RECIPE_REQUIRED/);
});

test('same-code published recipe with unlike output unit identifies missing conversion',()=>{
 const message=orderDemandIssueText({product_id:'product-1',product_code:'MON-1',product_name:'Món kiểm thử',issue:'PRODUCT_RECIPE_RATIO_REQUIRED'},[]);
 assert.match(message,/Đã tìm thấy công thức đã công bố món Món kiểm thử \(MON-1\)/);assert.match(message,/đơn vị đầu ra khác đơn vị bán/);assert.match(message,/xác minh tỷ lệ/);assert.doesNotMatch(message,/PRODUCT_RECIPE_RATIO_REQUIRED/);
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

test('customer summary and workbook follow the requested menu order while preserving quantities and unknown products',async()=>{
 const expected=['CN-XXPM','CN-XXMY','CN-TERI','CN-GPM','CN-BV','CN-CNM','CC','CCC','CN-MY','CC-NC','CCC-NC'];
 const codes=['NEW-Z',...[...expected].reverse(),'NEW-A'];
 const products=codes.map((code,index)=>({product_id:'product-'+index,code,name:'Tên đã sửa '+code,unit:'phần',total_quantity:String((index+1)/2),by_store:{'store-1':String((index+1)/2),'store-2':'0'}}));
 const before=structuredClone(products),ordered=sortOrderSummaryProducts(products),orderedCodes=[...expected,'NEW-Z','NEW-A'];
 assert.deepEqual(ordered.map(product=>product.code),orderedCodes);
 assert.deepEqual(products,before,'sorting must not mutate query data or change decimal quantities');
 for(const product of ordered)assert.equal(product,products.find(original=>original.product_id===product.product_id));
 assert.deepEqual(sortOrderSummaryProducts([]),[]);
 const data:OrderSummaryData={date:'2026-11-25',planned_quantity_total:'45.5',stores:[{id:'store-1',code:'STORE-1',name:'Điểm thử',phone:null},{id:'store-2',code:'STORE-2',name:'Điểm chưa đặt',phone:null}],orders:[],products};
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(null,{status:404});
 try{
  const blob=await createOrderSummaryWorkbook(data,{issues:[],materials:[]}),workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await blob.arrayBuffer());
  const matrix=workbook.getWorksheet('Bảng tổng hợp')!;
  for(const [index,code] of orderedCodes.entries()){
   const original=products.find(product=>product.code===code)!,row=matrix.getRow(index+4);
   assert.equal(row.getCell(1).value,index+1);assert.equal(row.getCell(2).value,original.name);
   assert.equal(row.getCell(3).value,Number(original.by_store['store-1']));assert.equal(row.getCell(4).value,'');assert.equal(row.getCell(5).value,Number(original.total_quantity));
  }
  const total=matrix.getRow(products.length+4);assert.equal(total.getCell(1).value,'TỔNG SỐ LƯỢNG');assert.equal(total.getCell(3).value,45.5);assert.equal(total.getCell(4).value,0);assert.equal(total.getCell(5).value,45.5);
  assert.deepEqual(data.products,before);
 }finally{globalThis.fetch=originalFetch;}
});

test('customer matrix keeps portion products and adds separate whole-tree totals after the grand total',async()=>{
 const products=[
  {product_id:'cc',code:'CC',name:'Cơm cuộn',unit:'phần',total_quantity:'12',by_store:{a:'12',b:'0'}},
  {product_id:'ccnc',code:'CC-NC',name:'Cơm cuộn nguyên cây',unit:'cây',total_quantity:'2',by_store:{a:'0',b:'2'}},
  {product_id:'ccc',code:'CCC',name:'Cơm cuộn chiên',unit:'phần',total_quantity:'10',by_store:{a:'0',b:'10'}},
  {product_id:'cccnc',code:'CCC-NC',name:'Cơm cuộn chiên nguyên cây',unit:'cây',total_quantity:'1',by_store:{a:'1',b:'0'}},
 ];
 const rows=wholeRollOrderSummaryProducts(products);
 assert.equal(products.find(product=>product.code==='CC')?.total_quantity,'12');assert.equal(products.find(product=>product.code==='CCC')?.total_quantity,'10');
 assert.equal(rows[0].name,'Cơm cuộn TT (nguyên cây)');assert.equal(rows[0].unit,'cây');assert.equal(rows[0].total_quantity,'12.285714285714285714');
 assert.equal(rows[0].by_store.a,'10.285714285714285714');assert.equal(rows[0].by_store.b,'2');
 assert.equal(rows[1].name,'Cơm cuộn chiên (nguyên cây)');assert.equal(rows[1].total_quantity,'17');assert.equal(rows[1].by_store.a,'1');assert.equal(rows[1].by_store.b,'16');
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(null,{status:404});
 try{
  const summary:OrderSummaryData={date:'2026-11-27',orders:[],stores:[{id:'a',code:'A',name:'Điểm A',phone:null},{id:'b',code:'B',name:'Điểm B',phone:null}],products,wholeRollTotals:rows,planned_quantity_total:'24'};
  const blob=await createOrderSummaryWorkbook(summary,{issues:[],materials:[]}),workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await blob.arrayBuffer());
  const matrix=workbook.getWorksheet('Bảng tổng hợp')!;
  assert.equal(matrix.getCell('B4').value,'Cơm cuộn');assert.equal(matrix.getCell('B5').value,'Cơm cuộn chiên');assert.equal(matrix.getCell('B6').value,'Cơm cuộn nguyên cây');assert.equal(matrix.getCell('B7').value,'Cơm cuộn chiên nguyên cây');
  assert.equal(matrix.getCell('A8').value,'TỔNG SỐ LƯỢNG');assert.equal(matrix.getCell('B9').value,rows[0].name);assert.equal(matrix.getCell('E9').value,Number(rows[0].total_quantity));assert.equal(matrix.getCell('B10').value,rows[1].name);assert.equal(matrix.getCell('E10').value,17);
 }finally{globalThis.fetch=originalFetch;}
});

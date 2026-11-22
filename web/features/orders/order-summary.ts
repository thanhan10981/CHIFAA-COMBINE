export type SummaryItem={product_id:string;code:string;name:string;quantity:string;unit:string;price_vnd:string;discount_rate:string;line_total_vnd:string};
export type SummaryOrder={id:string;code:string;store_id:string|null;store_code:string|null;store_name:string|null;store_phone:string|null;customer_name:string|null;customer_phone:string|null;delivery_date:string;shift:string;status:string;note:string|null;total_quantity:string;discount_rate:string;discount_vnd:string;order_total_vnd:string;old_deduction_vnd:string|null;cash_received_vnd:string|null;bank_received_vnd:string|null;payment_method:string|null;outstanding_vnd:string|null;items:SummaryItem[]};
export type SummaryStore={id:string;code:string;name:string;phone:string|null};
export type SummaryProduct={product_id:string;code:string;name:string;unit:string;total_quantity:string;by_store:Record<string,string>};
export type OrderSummaryData={date:string;orders:SummaryOrder[];stores:SummaryStore[];products:SummaryProduct[];planned_quantity_total:string};

const excelNumber=(value:string|null|undefined)=>value===null||value===undefined?'':Number(value);
function styleHeader(row:import('exceljs').Row){row.height=32;row.eachCell(cell=>{cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173349'}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};});}
function addLogo(workbook:import('exceljs').Workbook,sheet:import('exceljs').Worksheet){
 return fetch('/logo-chifaa.png').then(async response=>{
  if(!response.ok)return;
  const bytes=new Uint8Array(await response.arrayBuffer());
  let binary='';for(const value of bytes)binary+=String.fromCharCode(value);
  const id=workbook.addImage({base64:btoa(binary),extension:'png'});
  sheet.addImage(id,{tl:{col:0,row:0},ext:{width:92,height:48}});
 }).catch(()=>undefined);
}

export async function createOrderSummaryWorkbook(data:OrderSummaryData){
 const ExcelJS=(await import('exceljs')).default;
 const workbook=new ExcelJS.Workbook();workbook.creator='CHIFAA COMBINE';workbook.subject='Bảng tổng hợp khách đặt hàng';workbook.created=new Date();
 const sheet=workbook.addWorksheet('Tổng hợp đơn',{views:[{state:'frozen',ySplit:3,showGridLines:false}]});
 sheet.columns=[{width:14},{width:28},{width:14},{width:15},{width:14},{width:52},{width:19},{width:22},{width:24},{width:36}];
 sheet.mergeCells('B1:J1');sheet.getCell('B1').value=`BẢNG TỔNG HỢP KHÁCH ĐẶT HÀNG · ${data.date}`;sheet.getCell('B1').font={bold:true,size:16,color:{argb:'FF173349'}};sheet.getCell('B1').alignment={vertical:'middle',horizontal:'center'};sheet.getRow(1).height=48;
 sheet.mergeCells('A2:J2');sheet.getCell('A2').value='Nguồn: đơn đã ghi trong CHIFAA · Số tiền chỉ phản ánh chứng từ/đối soát đã có';sheet.getCell('A2').font={italic:true,color:{argb:'FF66798A'}};sheet.getCell('A2').alignment={vertical:'middle'};
 await addLogo(workbook,sheet);
 sheet.addRow(['Mã','Điểm bán · điện thoại','Ngày giao','Tổng số lượng','Mức chiết khấu','Chi tiết món','Trừ tiền đơn cũ','Tổng thanh toán','CK hoặc tiền mặt','Ghi chú']);styleHeader(sheet.getRow(3));
 for(const order of data.orders){
  const detail=order.items.map(item=>`${item.name} (${item.code}) · ${item.quantity} ${item.unit}`).join('\n');
  const payment=order.payment_method?`${order.payment_method}\nTM: ${order.cash_received_vnd?Number(order.cash_received_vnd).toLocaleString('vi-VN'):'0'} đ · CK: ${order.bank_received_vnd?Number(order.bank_received_vnd).toLocaleString('vi-VN'):'0'} đ`:'Chưa ghi nhận';
  const row=sheet.addRow([order.code,`${order.store_name??order.customer_name??'Chưa gán điểm bán'}${order.store_code?` (${order.store_code})`:''}\n${order.store_phone??order.customer_phone??''}`,order.delivery_date,excelNumber(order.total_quantity),Number(order.discount_rate),detail,order.old_deduction_vnd===null?'Chưa ghi nhận':Number(order.old_deduction_vnd),Number(order.order_total_vnd),payment,order.note??'']);
  row.height=Math.max(34,Math.min(72,20+order.items.length*14));row.eachCell(cell=>cell.alignment={vertical:'middle',wrapText:true});
  row.getCell(4).numFmt='#,##0.##';row.getCell(5).numFmt='0.00%';for(const column of [7,8])row.getCell(column).numFmt='#,##0 "đ"';
 }
 sheet.autoFilter={from:'A3',to:`J${Math.max(3,data.orders.length+3)}`};sheet.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9};sheet.pageSetup.printTitlesRow='1:3';
 const matrix=workbook.addWorksheet('Sản lượng theo điểm',{views:[{state:'frozen',ySplit:1,showGridLines:false}]});
 matrix.columns=[{width:20},{width:38},...data.stores.map(()=>({width:18})),{width:18}];
 matrix.addRow(['Mã món','Tên món',...data.stores.map(store=>`${store.name} (${store.code})`),'Tổng SL']);styleHeader(matrix.getRow(1));
 for(const product of data.products){const row=matrix.addRow([product.code,product.name,...data.stores.map(store=>excelNumber(product.by_store[store.id])),excelNumber(product.total_quantity)]);row.eachCell((cell,index)=>{cell.alignment={vertical:'middle',wrapText:true,horizontal:index>2?'right':'left'};if(index>2)cell.numFmt='#,##0.##';});}
 matrix.autoFilter={from:'A1',to:`${String.fromCharCode(65+Math.min(data.stores.length+2,24))}${Math.max(1,data.products.length+1)}`};matrix.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9};
 const output=await workbook.xlsx.writeBuffer();return new Blob([output as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

export function saveOrderSummaryWorkbook(blob:Blob,date:string){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`chifaa-tong-hop-don-${date}.xlsx`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}

export type SummaryItem={product_id:string;code:string;name:string;quantity:string;unit:string;price_vnd:string;discount_rate:string;line_total_vnd:string};
export type SummaryOrder={id:string;code:string;store_id:string|null;store_code:string|null;store_name:string|null;store_phone:string|null;customer_name:string|null;customer_phone:string|null;delivery_date:string;shift:string;status:string;note:string|null;total_quantity:string;discount_rate:string;discount_vnd:string;order_total_vnd:string;old_deduction_vnd:string|null;cancelled_loss_vnd:string;cash_received_vnd:string|null;bank_received_vnd:string|null;payment_method:string|null;outstanding_vnd:string|null;items:SummaryItem[]};
export type SummaryStore={id:string;code:string;name:string;phone:string|null};
export type SummaryProduct={product_id:string;code:string;name:string;unit:string;total_quantity:string;by_store:Record<string,string>};
export type SummaryMaterial={code:string;name:string;unit_code:string;quantity:string;stock_quantity:string|null;minimum_quantity:string|null;shortage_quantity:string|null;status:'unknown'|'insufficient'|'low'|'ok'};
export type OrderMaterialDemandData={issues:{issue:string;issue_detail?:string;product_id?:string;product_code?:string;product_name?:string;topping_name?:string}[];materials:SummaryMaterial[]};
export type OrderSummaryData={date:string;orders:SummaryOrder[];stores:SummaryStore[];products:SummaryProduct[];planned_quantity_total:string};

export function orderDemandIssueText(issue:OrderMaterialDemandData['issues'][number],products:OrderSummaryData['products']){
 const product=issue.product_name?null:products.find(item=>item.product_id===issue.product_id),name=issue.product_name??product?.name,code=issue.product_code??product?.code;
 const item=name?` món ${name}${code?` (${code})`:''}`:'';
 if(issue.issue==='PRODUCT_RECIPE_RATIO_REQUIRED')return `Đã tìm thấy công thức đã công bố${item}, nhưng đơn vị đầu ra khác đơn vị bán và chưa có tỷ lệ quy đổi hiệu lực ngày giao. Cần xác minh tỷ lệ trong Danh mục món bán rồi tải lại bảng tổng hợp.`;
 if(issue.issue==='PUBLISHED_PRODUCT_RECIPE_REQUIRED')return `Chưa tính được nhu cầu nguyên liệu của${item}: chưa tìm thấy phiên bản công thức đã công bố. Mở Công thức món ăn, kiểm tra trạng thái và công bố phiên bản đủ dữ liệu. Ngày bắt đầu áp dụng chỉ cần đặt khi tạo hoặc sửa công thức.`;
 if(issue.issue==='UNIT_NEEDS_VERIFICATION'){
  const material=issue.issue_detail?.match(/\|material=([^|]+)/)?.[1];
  return `Chưa tính đủ nguyên liệu${item}${issue.topping_name?` · topping ${issue.topping_name}`:''}: ${material?`vật tư ${material}`:'có vật tư'} chưa có quy đổi công thức đã xác minh cho ngày này. Kiểm tra phần Quy đổi riêng dành cho công thức trong Danh mục vật tư.`;
 }
 if(issue.issue==='RECIPE_NEEDS_REVIEW')return `Chưa tính đủ nguyên liệu${item}: công thức còn thành phần hoặc định lượng chưa xác minh. Mở công thức để kiểm tra các dòng cảnh báo.`;
 return `Chưa tính được một phần nhu cầu${item}: ${issue.issue}`;
}

const excelNumber=(value:string|null|undefined)=>value===null||value===undefined?'':Number(value);
const displayDate=(value:string)=>{const [year,month,day]=value.split('-');return year&&month&&day?`${day}/${month}/${year}`:value;};
const excelColumn=(index:number)=>{let result='',value=index;while(value>0){const remainder=(value-1)%26;result=String.fromCharCode(65+remainder)+result;value=Math.floor((value-1)/26);}return result;};
const materialStatus=(status:SummaryMaterial['status'])=>status==='insufficient'?'Không đủ':status==='low'?'Gần mức tối thiểu':status==='unknown'?'Chưa xác định tồn':'Đủ';
function styleHeader(row:import('exceljs').Row){row.height=30;row.eachCell(cell=>{cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173349'}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};});}
function styleMatrixHeader(row:import('exceljs').Row){row.height=28;row.eachCell(cell=>{cell.font={bold:true,color:{argb:'FF173349'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF0F5'}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};cell.border={top:{style:'thin',color:{argb:'FF394B59'}},bottom:{style:'thin',color:{argb:'FF394B59'}},left:{style:'thin',color:{argb:'FF394B59'}},right:{style:'thin',color:{argb:'FF394B59'}}};});}
async function addLogo(workbook:import('exceljs').Workbook,sheet:import('exceljs').Worksheet){
 return fetch('/logo-chifaa.png').then(async response=>{
  if(!response.ok)return;
  const bytes=new Uint8Array(await response.arrayBuffer());
  let binary='';for(const value of bytes)binary+=String.fromCharCode(value);
  const id=workbook.addImage({base64:btoa(binary),extension:'png'});
  sheet.addImage(id,{tl:{col:0,row:0},ext:{width:82,height:40}});
 }).catch(()=>undefined);
}

export async function createOrderSummaryWorkbook(data:OrderSummaryData,demand:OrderMaterialDemandData){
 const ExcelJS=(await import('exceljs')).default;
 const workbook=new ExcelJS.Workbook();workbook.creator='CHIFAA COMBINE';workbook.subject='Bảng tổng hợp khách đặt hàng';workbook.created=new Date();
 const totalColumn=data.stores.length+3,lastColumn=excelColumn(totalColumn);
 const matrix=workbook.addWorksheet('Bảng tổng hợp',{views:[{state:'frozen',xSplit:2,ySplit:3,showGridLines:false}]});
 matrix.columns=[{width:14},{width:36},...data.stores.map(()=>({width:16})),{width:14}];
 matrix.mergeCells(`B1:${lastColumn}1`);matrix.getCell('B1').value=`BẢNG TỔNG HỢP KHÁCH HÀNG ĐẶT HÀNG · ${displayDate(data.date)}`;matrix.getCell('B1').font={bold:true,size:15,color:{argb:'FF173349'}};matrix.getCell('B1').alignment={vertical:'middle',horizontal:'center'};matrix.getRow(1).height=42;
 await addLogo(workbook,matrix);
 matrix.mergeCells('A2:A3');matrix.getCell('A2').value='Stt';matrix.mergeCells('B2:B3');matrix.getCell('B2').value='TÊN SẢN PHẨM';matrix.mergeCells(`${lastColumn}2:${lastColumn}3`);matrix.getCell(`${lastColumn}2`).value='Tổng SL';
 if(data.stores.length){const lastStoreColumn=excelColumn(totalColumn-1);if(data.stores.length>1)matrix.mergeCells(`C2:${lastStoreColumn}2`);matrix.getCell('C2').value='Danh sách khách đặt hàng';for(const [index,store] of data.stores.entries())matrix.getCell(3,index+3).value=`${store.name}\n${store.code}`;}
 styleMatrixHeader(matrix.getRow(2));styleMatrixHeader(matrix.getRow(3));
 let totalQuantity=0;
 for(const [index,product] of data.products.entries()){
  const row=matrix.getRow(index+4);row.getCell(1).value=index+1;row.getCell(2).value=product.name;
  for(const [storeIndex,store] of data.stores.entries()){const quantity=excelNumber(product.by_store[store.id]);row.getCell(storeIndex+3).value=Number(quantity)===0?'':quantity;row.getCell(storeIndex+3).numFmt='#,##0.###';}
  const quantity=excelNumber(product.total_quantity);row.getCell(totalColumn).value=quantity;row.getCell(totalColumn).numFmt='#,##0.###';totalQuantity+=Number(quantity||0);
  row.height=24;row.eachCell((cell,column)=>{cell.alignment={vertical:'middle',horizontal:column===2?'left':'center',wrapText:true};cell.border={top:{style:'thin',color:{argb:'FF77828A'}},bottom:{style:'thin',color:{argb:'FF77828A'}},left:{style:'thin',color:{argb:'FF77828A'}},right:{style:'thin',color:{argb:'FF77828A'}}};});row.getCell(totalColumn).font={bold:true,color:{argb:'FFCF2733'}};
 }
 if(!data.products.length){matrix.mergeCells(`A4:${lastColumn}4`);matrix.getCell('A4').value='Chưa có số lượng cần chuẩn bị từ các đơn đã duyệt.';matrix.getCell('A4').alignment={horizontal:'center',vertical:'middle'};matrix.getRow(4).height=28;}
 const totalRow=4+Math.max(data.products.length,1);matrix.mergeCells(`A${totalRow}:B${totalRow}`);matrix.getCell(`A${totalRow}`).value='TỔNG SỐ LƯỢNG';matrix.getCell(`A${totalRow}`).font={bold:true};
 for(const [index,store] of data.stores.entries()){const storeTotal=data.products.reduce((sum,product)=>sum+Number(product.by_store[store.id]??0),0);const cell=matrix.getCell(totalRow,index+3);cell.value=storeTotal;cell.numFmt='#,##0.###';cell.font={bold:true};}
 matrix.getCell(totalRow,totalColumn).value=totalQuantity;matrix.getCell(totalRow,totalColumn).numFmt='#,##0.###';matrix.getCell(totalRow,totalColumn).font={bold:true,color:{argb:'FFCF2733'}};
 for(let col=1;col<=totalColumn;col++){const cell=matrix.getCell(totalRow,col);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF4F6F8'}};cell.border={top:{style:'thin',color:{argb:'FF394B59'}},bottom:{style:'thin',color:{argb:'FF394B59'}},left:{style:'thin',color:{argb:'FF394B59'}},right:{style:'thin',color:{argb:'FF394B59'}}};cell.alignment={vertical:'middle',horizontal:col<=2?'left':'center',wrapText:true};}matrix.getRow(totalRow).height=26;
 const materialStart=totalRow+2;matrix.mergeCells(materialStart,1,materialStart,totalColumn);matrix.getCell(materialStart,1).value='NHU CẦU NGUYÊN LIỆU TỪ ĐƠN ĐÃ DUYỆT';matrix.getCell(materialStart,1).font={bold:true,size:12,color:{argb:'FF173349'}};matrix.getCell(materialStart+1,1).value='Tổng định lượng của đơn đã duyệt, đã xếp kế hoạch hoặc đã giao theo đơn vị công thức. Tồn sổ quy về cùng đơn vị để đối chiếu; đây không phải số cần sản xuất thêm.';matrix.mergeCells(materialStart+1,1,materialStart+1,totalColumn);matrix.getCell(materialStart+1,1).font={italic:true,color:{argb:'FF66798A'}};
 const materialHeader=matrix.getRow(materialStart+3);materialHeader.values=['Mã vật tư','Vật tư','ĐVT','Cần','Tồn sổ','Thiếu','Cảnh báo'];styleHeader(materialHeader);
 if(demand.materials.length){for(const material of demand.materials){const row=matrix.addRow([material.code,material.name,material.unit_code,excelNumber(material.quantity),material.stock_quantity===null?'Chưa có tồn':excelNumber(material.stock_quantity),material.shortage_quantity===null?'—':excelNumber(material.shortage_quantity),materialStatus(material.status)]);row.eachCell((cell,column)=>{cell.alignment={vertical:'middle',wrapText:true};if(column>=4&&column<=6&&typeof cell.value==='number')cell.numFmt='#,##0.###';});}}
 else {const row=matrix.addRow(['Chưa có nhu cầu nguyên liệu đủ dữ liệu công thức cho đơn đã duyệt.']);matrix.mergeCells(row.number,1,row.number,7);row.getCell(1).alignment={horizontal:'center',vertical:'middle',wrapText:true};}
 for(const issue of demand.issues){const row=matrix.addRow([orderDemandIssueText(issue,data.products)]);matrix.mergeCells(row.number,1,row.number,Math.max(7,totalColumn));row.getCell(1).font={color:{argb:'FF9C4B28'}};row.getCell(1).alignment={wrapText:true,vertical:'middle'};}
 for(let col=1;col<=7;col++)if(matrix.getColumn(col).width===undefined)matrix.getColumn(col).width=18;
 const finalRow=matrix.rowCount;matrix.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9};matrix.pageSetup.printTitlesRow='1:3';matrix.pageSetup.printArea=`A1:${excelColumn(Math.max(totalColumn,7))}${finalRow}`;

 const details=workbook.addWorksheet('Chi tiết đơn',{views:[{state:'frozen',ySplit:3,showGridLines:false}]});
 details.columns=[{width:14},{width:28},{width:14},{width:15},{width:14},{width:52},{width:19},{width:16},{width:22},{width:24},{width:36}];
 details.mergeCells('B1:K1');details.getCell('B1').value=`CHI TIẾT ĐƠN ĐẶT HÀNG · ${displayDate(data.date)}`;details.getCell('B1').font={bold:true,size:15,color:{argb:'FF173349'}};details.getCell('B1').alignment={vertical:'middle',horizontal:'center'};details.getRow(1).height=42;await addLogo(workbook,details);
 details.mergeCells('A2:K2');details.getCell('A2').value='Thông tin từng đơn được ghi nhận trong ngày giao đã chọn.';details.getCell('A2').font={italic:true,color:{argb:'FF66798A'}};
 details.addRow(['Mã','Điểm bán · điện thoại','Ngày giao','Tổng số lượng','Mức chiết khấu','Chi tiết món','Trừ tiền đơn cũ','Hủy / lỗ','Tổng thanh toán','CK hoặc tiền mặt','Ghi chú']);styleHeader(details.getRow(3));
 for(const order of data.orders){const detail=order.items.map(item=>`${item.name} (${item.code}) · ${item.quantity} ${item.unit}`).join('\n');const payment=order.payment_method?`${order.payment_method}\nTM: ${order.cash_received_vnd?Number(order.cash_received_vnd).toLocaleString('vi-VN'):'0'} đ · CK: ${order.bank_received_vnd?Number(order.bank_received_vnd).toLocaleString('vi-VN'):'0'} đ`:'Chưa ghi nhận';const row=details.addRow([order.code,`${order.store_name??order.customer_name??'Chưa gán điểm bán'}${order.store_code?` (${order.store_code})`:''}\n${order.store_phone??order.customer_phone??''}`,order.delivery_date,excelNumber(order.total_quantity),Number(order.discount_rate),detail,order.old_deduction_vnd===null?'Chưa ghi nhận':Number(order.old_deduction_vnd),Number(order.cancelled_loss_vnd??'0'),Number(order.order_total_vnd),payment,order.note??'']);row.height=Math.max(34,Math.min(72,20+order.items.length*14));row.eachCell(cell=>cell.alignment={vertical:'middle',wrapText:true});row.getCell(4).numFmt='#,##0.##';row.getCell(5).numFmt='0.00%';for(const column of [7,8,9])row.getCell(column).numFmt='#,##0 "đ"';}
 details.autoFilter={from:'A3',to:`K${Math.max(3,data.orders.length+3)}`};details.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9};details.pageSetup.printTitlesRow='1:3';
 const output=await workbook.xlsx.writeBuffer();return new Blob([output as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

export function saveOrderSummaryWorkbook(blob:Blob,date:string){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`chifaa-tong-hop-don-${date}.xlsx`;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}

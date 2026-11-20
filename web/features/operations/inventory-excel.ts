import type ExcelJS from 'exceljs';
import {materialCategories} from '@/features/catalog/material-types';

export const inventoryExcelHeaders=[
 'Mã / vật tư',
 'Tên vật tư',
 'Nhóm',
 'ĐVT chuẩn',
 'Tồn hiện tại',
 'Tối thiểu',
 'Giá trung bình (đ / ĐVT chuẩn)',
 'Số lượng nhập thêm',
 'Giá nhập thêm (đ / ĐVT chuẩn)',
] as const;

export type InventoryExcelRow={code:string;name:string;category:string;unit:string|null;quantity:string|null;minimum:string|null;average:string|null};
export type InventoryImportRow={code:string;name:string;category:string;unit_code:string;minimum_quantity:string|null;added_quantity:string|null;unit_cost:string|null};

const categoryByLabel=new Map(Object.entries(materialCategories).flatMap(([key,label])=>[[key.toLocaleLowerCase(),key],[label.toLocaleLowerCase(),key]]));

function excelNumber(value:string|null){
 if(value===null)return '';
 const number=Number(value);
 return Number.isFinite(number)?number:value;
}

export async function createInventoryWorkbook(rows:InventoryExcelRow[]){
 const ExcelJS=(await import('exceljs')).default;
 const workbook=new ExcelJS.Workbook();
 workbook.creator='CHIFAA COMBINE';
 workbook.subject='Tồn kho và mẫu nhập tồn cộng thêm';
 workbook.created=new Date();
 const sheet=workbook.addWorksheet('Tồn kho',{views:[{state:'frozen',ySplit:1,activeCell:'A2',showGridLines:false}]});
 sheet.columns=[
  {header:inventoryExcelHeaders[0],key:'code',width:18,style:{numFmt:'@'}},
  {header:inventoryExcelHeaders[1],key:'name',width:32},
  {header:inventoryExcelHeaders[2],key:'category',width:20},
  {header:inventoryExcelHeaders[3],key:'unit',width:16},
  {header:inventoryExcelHeaders[4],key:'quantity',width:18,style:{numFmt:'#,##0.######'}},
  {header:inventoryExcelHeaders[5],key:'minimum',width:16,style:{numFmt:'#,##0.######'}},
  {header:inventoryExcelHeaders[6],key:'average',width:27,style:{numFmt:'#,##0.######'}},
  {header:inventoryExcelHeaders[7],key:'added',width:22,style:{numFmt:'#,##0.######'}},
  {header:inventoryExcelHeaders[8],key:'unitCost',width:30,style:{numFmt:'#,##0.######'}},
 ];
 const header=sheet.getRow(1);header.height=30;header.eachCell(cell=>{cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173349'}};cell.alignment={vertical:'middle',wrapText:true};});
 for(const row of rows){
  sheet.addRow({code:row.code,name:row.name,category:materialCategories[row.category as keyof typeof materialCategories]??row.category,unit:row.unit??'',quantity:excelNumber(row.quantity),minimum:excelNumber(row.minimum),average:excelNumber(row.average),added:'',unitCost:''});
 }
 sheet.autoFilter={from:'A1',to:'I'+Math.max(rows.length+1,1)};
 const instructions=workbook.addWorksheet('Hướng dẫn');
 instructions.columns=[{width:34},{width:110}];
 instructions.addRow(['CỘT','CÁCH DÙNG']);
 instructions.addRows([
  ['Mã / vật tư','Mã duy nhất của vật tư. Giữ mã ở dạng văn bản để không mất số 0 ở đầu.'],
  ['Tên vật tư / Nhóm','Vật tư mới cần tên và nhóm. Mã đã có sẽ cập nhật tên, nhóm và mức tối thiểu theo file.'],
  ['ĐVT chuẩn','Dùng mã đơn vị đã có trong danh mục. Với mã đã có, không đổi ĐVT chuẩn nếu đã phát sinh tồn hoặc công thức.'],
  ['Tồn hiện tại / Giá trung bình','Số xem tại ngày xuất file. Hai cột này chỉ để tham khảo, không được dùng để ghi đè hay cộng tồn.'],
  ['Tối thiểu','Mức tồn tối thiểu. Để trống nếu chưa thiết lập.'],
  ['Số lượng nhập thêm','Nhập lượng cần cộng thêm vào tồn. Để trống nếu chỉ thêm/cập nhật thông tin vật tư. Mỗi lần nhập tạo một dòng chứng từ mới.'],
  ['Giá nhập thêm','Đơn giá của chính lần nhập này theo ĐVT chuẩn. Có thể để trống nếu chưa rõ; khi thiếu giá, giá trung bình sẽ chưa xác định.'],
  ['Lưu và nhập','Giữ nguyên hàng tiêu đề. Nhập tối đa 200 dòng mỗi lần. Mỗi mã chỉ xuất hiện một lần trong file. Lưu .xlsx rồi chọn Nhập Excel.'],
 ]);
 instructions.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};instructions.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173349'}};
 instructions.eachRow(row=>row.eachCell(cell=>{cell.alignment={vertical:'top',wrapText:true};}));
 instructions.getColumn(1).font={bold:true};
 const output=await workbook.xlsx.writeBuffer();
 return new Blob([output as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

function cellText(cell:ExcelJS.Cell, rowNumber:number, header:string){
 const value=cell.value;
 if(value===null||value===undefined)return '';
 if(typeof value==='string')return value.trim();
 if(typeof value==='number'&&Number.isFinite(value))return String(value);
 throw new Error(`Dòng ${rowNumber}: ô “${header}” không được chứa công thức hoặc định dạng dữ liệu phức tạp.`);
}

function decimalCell(value:string,rowNumber:number,label:string,positive:boolean){
 if(!value||value==='—'||value==='-')return null;
 let normalized=value.replace(/[\s₫đ]/gi,'');
 if(normalized.includes(',')&&normalized.includes('.')){
  normalized=normalized.lastIndexOf(',')>normalized.lastIndexOf('.')?normalized.replace(/\./g,'').replace(',','.'):normalized.replace(/,/g,'');
 }else if(normalized.includes(','))normalized=normalized.replace(',','.');
 if(!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(normalized))throw new Error(`Dòng ${rowNumber}: “${label}” phải là số không âm, tối đa 6 chữ số thập phân.`);
 if(positive&&Number(normalized)<=0)throw new Error(`Dòng ${rowNumber}: “${label}” phải lớn hơn 0.`);
 return normalized;
}

export async function parseInventoryWorkbook(data:ArrayBuffer):Promise<InventoryImportRow[]>{
 const ExcelJS=(await import('exceljs')).default;
 const workbook=new ExcelJS.Workbook();
 await workbook.xlsx.load(data);
 const sheet=workbook.getWorksheet('Tồn kho');
 if(!sheet)throw new Error('File Excel cần có trang “Tồn kho” được tải từ CHIFAA.');
 const headerRow=sheet.getRow(1);
 const headerMap=new Map<string,number>();
 headerRow.eachCell((cell,column)=>headerMap.set(cellText(cell,1,'tiêu đề').toLocaleLowerCase(),column));
 const columns=inventoryExcelHeaders.map(header=>headerMap.get(header.toLocaleLowerCase()));
 const missing=inventoryExcelHeaders.filter((_,index)=>!columns[index]);
 if(missing.length)throw new Error('File thiếu cột: '+missing.join(', ')+'. Hãy tải lại mẫu Excel mới nhất.');
 const rows:InventoryImportRow[]=[];const seen=new Set<string>();
 for(let rowNumber=2;rowNumber<=sheet.rowCount;rowNumber++){
  const row=sheet.getRow(rowNumber);
  const values=columns.map((column,index)=>cellText(row.getCell(column!),rowNumber,inventoryExcelHeaders[index]));
  if(values.every(value=>!value))continue;
  const [rawCode,rawName,rawCategory,rawUnit,,rawMinimum,,rawQuantity,rawUnitCost]=values;
  const code=rawCode.trim(),name=rawName.trim(),unit=rawUnit.trim();
  if(!code||code.length>64)throw new Error(`Dòng ${rowNumber}: cần mã vật tư từ 1 đến 64 ký tự.`);
  if(!name||name.length>250)throw new Error(`Dòng ${rowNumber}: cần tên vật tư từ 1 đến 250 ký tự.`);
  if(!unit||unit.length>64)throw new Error(`Dòng ${rowNumber}: cần mã ĐVT chuẩn đã có trong danh mục.`);
  const category=categoryByLabel.get(rawCategory.trim().toLocaleLowerCase());
  if(!category)throw new Error(`Dòng ${rowNumber}: nhóm “${rawCategory}” không hợp lệ.`);
  const duplicate=code.toLocaleUpperCase();
  if(seen.has(duplicate))throw new Error(`Mã “${code}” bị lặp trong file.`);
  seen.add(duplicate);
  const minimum_quantity=decimalCell(rawMinimum,rowNumber,'Tối thiểu',false);
  const added_quantity=decimalCell(rawQuantity,rowNumber,'Số lượng nhập thêm',true);
  const unit_cost=decimalCell(rawUnitCost,rowNumber,'Giá nhập thêm',false);
  if(unit_cost!==null&&added_quantity===null)throw new Error(`Dòng ${rowNumber}: nhập số lượng trước khi điền giá nhập thêm.`);
  rows.push({code,name,category,unit_code:unit,minimum_quantity,added_quantity,unit_cost});
  if(rows.length>200)throw new Error('Mỗi lần nhập tối đa 200 dòng vật tư.');
 }
 if(!rows.length)throw new Error('File chưa có dòng vật tư nào để nhập.');
 return rows;
}

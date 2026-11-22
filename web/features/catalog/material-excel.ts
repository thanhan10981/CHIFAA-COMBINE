import type ExcelJS from 'exceljs';
import {materialCategories} from './material-types';

export const materialExcelHeaders=[
 'Mã nội bộ',
 'Phiên bản',
 'Mã SP',
 'Tên vật tư',
 'Nhóm vật tư',
 'Đơn vị mua',
 'Đơn vị tính giá',
 'Đơn giá (đ)',
 'Tồn tối thiểu',
 'Quy cách',
] as const;

export type MaterialExcelRow={material_id:string|null;version:string|null;code:string;name:string;category:string;purchase_unit_code:string;basis_unit_code:string|null;price_amount:string|null;minimum_quantity:string|null;specification:string};

const categoryByLabel=new Map(Object.entries(materialCategories).flatMap(([key,label])=>[[key.toLocaleLowerCase('vi-VN'),key],[label.toLocaleLowerCase('vi-VN'),key]]));

function excelNumber(value:string|null){
 if(value===null)return '';
 const number=Number(value);
 return Number.isFinite(number)?number:value;
}

export async function createMaterialWorkbook(rows:MaterialExcelRow[]){
 const ExcelJS=(await import('exceljs')).default;
 const workbook=new ExcelJS.Workbook();
 workbook.creator='CHIFAA COMBINE';
 workbook.subject='Danh mục vật tư';
 workbook.created=new Date();
 const sheet=workbook.addWorksheet('Danh mục vật tư',{views:[{state:'frozen',ySplit:1,activeCell:'C2',showGridLines:false}]});
 sheet.columns=[
  {header:materialExcelHeaders[0],key:'material_id',width:38,hidden:true,style:{numFmt:'@'}},
  {header:materialExcelHeaders[1],key:'version',width:12,hidden:true,style:{numFmt:'@'}},
  {header:materialExcelHeaders[2],key:'code',width:20,style:{numFmt:'@'}},
  {header:materialExcelHeaders[3],key:'name',width:32},
  {header:materialExcelHeaders[4],key:'category',width:22},
  {header:materialExcelHeaders[5],key:'purchase_unit_code',width:18,style:{numFmt:'@'}},
  {header:materialExcelHeaders[6],key:'basis_unit_code',width:20,style:{numFmt:'@'}},
  {header:materialExcelHeaders[7],key:'price_amount',width:20,style:{numFmt:'General'}},
  {header:materialExcelHeaders[8],key:'minimum_quantity',width:20,style:{numFmt:'General'}},
  {header:materialExcelHeaders[9],key:'specification',width:42},
 ];
 const header=sheet.getRow(1);header.height=32;header.eachCell(cell=>{cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173349'}};cell.alignment={vertical:'middle',wrapText:true};});
 for(const row of rows){
  sheet.addRow({material_id:row.material_id??'',version:row.version??'',code:row.code,name:row.name,category:materialCategories[row.category as keyof typeof materialCategories]??row.category,purchase_unit_code:row.purchase_unit_code,basis_unit_code:row.basis_unit_code??'',price_amount:excelNumber(row.price_amount),minimum_quantity:excelNumber(row.minimum_quantity),specification:row.specification});
 }
 for(let index=0;index<10;index++)sheet.addRow({});
 sheet.autoFilter={from:'C1',to:'J'+Math.max(rows.length+11,1)};
 const instructions=workbook.addWorksheet('Hướng dẫn');
 instructions.columns=[{width:30},{width:112}];
 instructions.addRow(['CỘT','CÁCH DÙNG']);
 instructions.addRows([
  ['Mã nội bộ / Phiên bản','Hai cột ẩn dùng để nhận diện và chống ghi đè bản vật tư đã thay đổi. Giữ nguyên khi sửa; để trống cả hai khi thêm mã mới. Không tự nhập hoặc sao chép hai cột này cho dòng mới.'],
  ['Mã SP','Mã duy nhất. Có thể sửa mã của dòng đã xuất; không dùng lại mã đang thuộc vật tư khác. Giữ dạng văn bản để không mất số 0 đầu mã.'],
  ['Tên vật tư / Nhóm vật tư','Tên bắt buộc. Nhóm nhận mã nội bộ hoặc nhãn tiếng Việt đang có trong danh mục.'],
  ['Đơn vị mua','Mã đơn vị đang có trong danh mục đơn vị. Không tự tạo đơn vị mới từ file. Đổi đơn vị có thể bị từ chối nếu vật tư đã có lịch sử kho/công thức.'],
  ['Đơn vị tính giá / Đơn giá','Đơn giá dùng đơn vị ghi ở cột “Đơn vị tính giá”. Giá thay đổi qua Excel sẽ chuyển sang trạng thái chờ xác minh, không tự thành giá chính thức. Cần quyền quản lý và duyệt vật tư.'],
  ['Tồn tối thiểu','Để trống nếu chưa thiết lập; nhập 0 nếu mức tối thiểu thực sự bằng 0. Tồn hiện tại không được nhập hay ghi đè tại đây.'],
  ['Quy cách','Mô tả quy cách vật tư. Để trống sẽ xóa nội dung quy cách hiện tại.'],
  ['Thêm / sửa nhiều dòng','Tối đa 200 dòng mỗi lần. Không lặp mã hoặc mã nội bộ. Xóa dòng không xóa vật tư khỏi hệ thống.'],
  ['Nhập Excel','CHIFAA kiểm tra rồi hiện bản xem trước. Chỉ sau khi xác nhận mới lưu; lỗi ở bất kỳ dòng nào sẽ hủy toàn bộ lần nhập. Không tạo phiếu nhập/xuất kho.'],
 ]);
 instructions.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};instructions.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173349'}};
 instructions.eachRow(row=>row.eachCell(cell=>{cell.alignment={vertical:'top',wrapText:true};}));
 instructions.getColumn(1).font={bold:true};
 const output=await workbook.xlsx.writeBuffer();
 return new Blob([output as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

function cellText(cell:ExcelJS.Cell,rowNumber:number,header:string){
 const value=cell.value;
 if(value===null||value===undefined)return '';
 if(typeof value==='string')return value.trim();
 if(typeof value==='number'&&Number.isFinite(value))return String(value);
 throw new Error(`Dòng ${rowNumber}: ô “${header}” không được chứa công thức hoặc dữ liệu phức tạp.`);
}

function decimalCell(value:string,rowNumber:number,label:string){
 if(!value)return null;
 let normalized=value.replace(/[\s₫đ]/gi,'');
 if(normalized.includes(',')&&normalized.includes('.')){
  normalized=normalized.lastIndexOf(',')>normalized.lastIndexOf('.')?normalized.replace(/\./g,'').replace(',','.'):normalized.replace(/,/g,'');
 }else if(normalized.includes(','))normalized=normalized.replace(',','.');
 if(!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(normalized))throw new Error(`Dòng ${rowNumber}: “${label}” phải là số không âm, tối đa 6 chữ số thập phân.`);
 return normalized;
}

export async function parseMaterialWorkbook(data:ArrayBuffer):Promise<MaterialExcelRow[]>{
 const ExcelJS=(await import('exceljs')).default;
 const workbook=new ExcelJS.Workbook();
 await workbook.xlsx.load(data);
 const sheet=workbook.getWorksheet('Danh mục vật tư');
 if(!sheet)throw new Error('File Excel cần có trang “Danh mục vật tư” được tải từ CHIFAA.');
 const headerMap=new Map<string,number>();
 sheet.getRow(1).eachCell((cell,column)=>headerMap.set(cellText(cell,1,'tiêu đề').toLocaleLowerCase('vi-VN'),column));
 const columns=materialExcelHeaders.map(header=>headerMap.get(header.toLocaleLowerCase('vi-VN')));
 const missing=materialExcelHeaders.filter((_,index)=>!columns[index]);
 if(missing.length)throw new Error('File thiếu cột: '+missing.join(', ')+'. Hãy tải lại mẫu Excel mới nhất.');
 const rows:MaterialExcelRow[]=[],seenCodes=new Set<string>(),seenIds=new Set<string>();
 for(let rowNumber=2;rowNumber<=sheet.rowCount;rowNumber++){
  const values=columns.map((column,index)=>cellText(sheet.getRow(rowNumber).getCell(column!),rowNumber,materialExcelHeaders[index]));
  if(values.every(value=>!value))continue;
  const [rawId,rawVersion,rawCode,rawName,rawCategory,rawPurchase,rawBasis,rawPrice,rawMinimum,rawSpecification]=values;
  const material_id=rawId.trim()||null,version=rawVersion.trim()||null,code=rawCode.trim(),name=rawName.trim(),purchase_unit_code=rawPurchase.trim();
  if(Boolean(material_id)!==Boolean(version))throw new Error(`Dòng ${rowNumber}: hai cột mã nội bộ và phiên bản phải cùng có hoặc cùng để trống.`);
  if(material_id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(material_id))throw new Error(`Dòng ${rowNumber}: mã nội bộ không hợp lệ.`);
  if(version&&!/^[1-9]\d{0,17}$/.test(version))throw new Error(`Dòng ${rowNumber}: phiên bản không hợp lệ.`);
  if(!code||code.length>64)throw new Error(`Dòng ${rowNumber}: cần mã vật tư từ 1 đến 64 ký tự.`);
  if(!name||name.length>250)throw new Error(`Dòng ${rowNumber}: cần tên vật tư từ 1 đến 250 ký tự.`);
  if(!purchase_unit_code||purchase_unit_code.length>64)throw new Error(`Dòng ${rowNumber}: cần mã đơn vị mua đã có trong danh mục.`);
  const category=categoryByLabel.get(rawCategory.trim().toLocaleLowerCase('vi-VN'));
  if(!category)throw new Error(`Dòng ${rowNumber}: nhóm “${rawCategory}” không hợp lệ.`);
  if(rawSpecification.length>1000)throw new Error(`Dòng ${rowNumber}: quy cách không được quá 1.000 ký tự.`);
  const duplicateCode=code.toLocaleUpperCase('vi-VN');
  if(seenCodes.has(duplicateCode))throw new Error(`Mã “${code}” bị lặp trong file.`);
  seenCodes.add(duplicateCode);
  if(material_id&&seenIds.has(material_id))throw new Error(`Mã nội bộ “${material_id}” bị lặp trong file.`);
  if(material_id)seenIds.add(material_id);
  const price_amount=decimalCell(rawPrice,rowNumber,'Đơn giá');
  const minimum_quantity=decimalCell(rawMinimum,rowNumber,'Tồn tối thiểu');
  const basis_unit_code=rawBasis.trim()||null;
  if(price_amount!==null&&!basis_unit_code)throw new Error(`Dòng ${rowNumber}: chọn đơn vị tính giá khi có đơn giá.`);
  rows.push({material_id,version,code,name,category,purchase_unit_code,basis_unit_code,price_amount,minimum_quantity,specification:rawSpecification});
  if(rows.length>200)throw new Error('Mỗi lần nhập tối đa 200 dòng vật tư.');
 }
 if(!rows.length)throw new Error('File chưa có dòng vật tư nào để nhập.');
 return rows;
}

import {SCHEMA,META} from '../shared/schema.js';
import {parseImportCsv} from './import-csv.js';
import {rpcCall} from './rpc.js';
const EXCEL_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXCEL_ASSET_HASH='__EXCEL_ASSET_HASH__';
let excelLoading=null;
async function ensureExcelRuntime(){
  if(globalThis.ExcelJS)return globalThis.ExcelJS;
  if(excelLoading)return excelLoading;
  excelLoading=(async()=>{
    const url='https://script.google.com/chifaa-public-assets/excel-'+EXCEL_ASSET_HASH+'.js';let cache,source;
    const valid=async text=>{const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')===EXCEL_ASSET_HASH;};
    try{cache=await globalThis.caches?.open('chifaa-public-assets-v1');source=await (await cache?.match(url))?.text();if(source&&!await valid(source)){source=null;await cache.delete(url);}}catch(_){source=null;}
    if(!source){const preview=globalThis.document?.getElementById?.('excel-preview-runtime');source=preview?JSON.parse(preview.textContent):(await rpcCall('publicAsset',{id:'exceljs-4.4.0'})).source;if(typeof source!=='string'||!await valid(source))throw new Error('Thư viện Excel không đúng phiên bản. Tải lại trang rồi thử lại.');try{await cache?.put(url,new Response(source,{headers:{'Content-Type':'application/javascript'}}));}catch(_){/* Public-asset storage is optional. */}}
    const script=document.createElement('script');script.textContent=source;document.head.append(script);script.remove();
    if(!globalThis.ExcelJS)throw new Error('Không thể khởi động Excel trên trình duyệt này.');return globalThis.ExcelJS;
  })();try{return await excelLoading;}finally{excelLoading=null;}
}
function excelRuntime(){if(!globalThis.ExcelJS)throw new Error('Chưa tải thư viện Excel');return globalThis.ExcelJS;}
const metaLabels={recordId:'Mã bản ghi',version:'Phiên bản',updatedAt:'Cập nhật lúc (UTC)',updatedBy:'Người cập nhật',source:'Nguồn',deleted:'Đã xóa',reverses:'Mã phiếu bị đảo'};
function excelColumn(key,field={}){return {key,header:field.label||metaLabels[key]||key,width:key==='recordId'||key==='reverses'||field.ref?38:field.type==='number'?20:field.type==='date'?16:field.type==='boolean'?15:field.type==='lines'?60:key==='updatedAt'?25:30};}
function styleExcelSheet(sheet,headerRow,lastColumn,lastRow){
  sheet.views=[{state:'frozen',ySplit:headerRow,showGridLines:false}];
  sheet.getRow(headerRow).height=32;
  for(let i=1;i<=lastColumn;i++){const c=sheet.getCell(headerRow,i);c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17283D'}};c.font={name:'Calibri',size:11,bold:true,color:{argb:'FFFFFFFF'}};c.alignment={vertical:'middle',wrapText:true};}
  sheet.autoFilter={from:{row:headerRow,column:1},to:{row:Math.max(headerRow,lastRow),column:lastColumn}};
  sheet.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:`${headerRow}:${headerRow}`};
  sheet.headerFooter={oddFooter:'CHIFAA COMBINE | Trang &P / &N'};
}
function typedExcelValue(value,field,key){
  if(value==null||value==='')return null;
  if(typeof value==='number'&&!Number.isFinite(value))return String(value);
  if(Array.isArray(value))return JSON.stringify(value);
  if(field?.type==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value)))return new Date(value+'T00:00:00Z');
  if(key==='updatedAt'&&typeof value==='string'&&!Number.isNaN(Date.parse(value)))return new Date(value);
  // Strings stay strings: never create a formula/hyperlink from untrusted content.
  return ['string','boolean','number'].includes(typeof value)?value:JSON.stringify(value);
}
function excelWorkbookBase(Excel){const book=new Excel.Workbook();book.creator='CHIFAA COMBINE';book.created=new Date();return book;}
function createModuleWorkbook(module,rows,{source='Google Sheets',stamp='',exportedAt=new Date()}={},Excel=excelRuntime()){
  const schema=SCHEMA[module];if(!schema)throw new Error('Phân hệ Excel không hợp lệ');
  const book=excelWorkbookBase(Excel),sheet=book.addWorksheet('Du_lieu'),keys=[...Object.keys(schema.fields),...META];
  sheet.columns=keys.map(k=>excelColumn(k,schema.fields[k]));sheet.getRow(1).values=[];
  const end=keys.length;sheet.mergeCells(1,1,1,end);sheet.getCell('A1').value='CHIFAA COMBINE · '+schema.title;sheet.getCell('A1').font={name:'Calibri',size:20,bold:true,color:{argb:'FF17283D'}};sheet.getRow(1).height=40;
  sheet.mergeCells(2,1,2,end);sheet.getCell('A2').value=source+' · Xuất lúc '+exportedAt.toISOString()+' · '+rows.length+' bản ghi';sheet.getCell('A2').font={name:'Calibri',size:11,color:{argb:'FF596D82'}};
  sheet.mergeCells(3,1,3,end);sheet.getCell('A3').value='Bản chụp dữ liệu · Có cột đánh dấu phiếu xóa / đảo · Mã đồng bộ: '+stamp;sheet.getCell('A3').font={name:'Calibri',size:10,color:{argb:'FF596D82'}};
  sheet.getRow(5).values=keys.map(k=>schema.fields[k]?.label||metaLabels[k]);
  for(const [index,row]of rows.entries()){
    const line=sheet.getRow(index+6);line.height=30;
    keys.forEach((key,i)=>{const field=schema.fields[key],cell=line.getCell(i+1);cell.value=typedExcelValue(row[key],field,key);cell.font={name:'Calibri',size:11,color:{argb:typeof cell.value==='number'?'FF243449':'FF395068'}};cell.alignment={vertical:'middle',wrapText:true};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:index%2?'FFF1F5F9':'FFFFFFFF'}};cell.border={bottom:{style:'hair',color:{argb:'FFE2E8F0'}}};if(field?.type==='date')cell.numFmt='dd/mm/yyyy';else if(key==='updatedAt')cell.numFmt='dd/mm/yyyy hh:mm';else if(field?.type==='number')cell.numFmt=key==='discount'||key==='rate'||key==='annualRate'?'0.00%':'#,##0.##;[Red](#,##0.##);0';});
  }
  styleExcelSheet(sheet,5,end,rows.length+5);
  const guide=book.addWorksheet('Chu_thich');guide.columns=[{width:32},{width:48},{width:72}];guide.addRow(['Tên cột','Mã trường','Ghi chú']);for(const k of keys)guide.addRow([schema.fields[k]?.label||metaLabels[k],k,schema.fields[k]?.ref?'Mã tham chiếu '+SCHEMA[schema.fields[k].ref].title:k==='deleted'?'TRUE: đã xóa mềm; không cộng vào báo cáo':k==='reverses'?'Phiếu đảo: giữ mã phiếu gốc để đối chiếu':schema.fields[k]?.type==='lines'?'Thành phần công thức ở dạng JSON':'Giữ nguyên kiểu dữ liệu; ô trống không thay bằng 0']);styleExcelSheet(guide,1,3,guide.rowCount);
  return book;
}
function createImportWorkbook(module,Excel=excelRuntime()){
  const schema=SCHEMA[module];if(!schema)throw new Error('Phân hệ Excel không hợp lệ');const book=excelWorkbookBase(Excel),sheet=book.addWorksheet('Nhap_lieu'),keys=['recordId',...Object.keys(schema.fields)];
  sheet.columns=keys.map(k=>({...excelColumn(k,schema.fields[k]),header:k}));
  keys.forEach((k,i)=>{sheet.getCell(1,i+1).note=(schema.fields[k]?.label||metaLabels[k])+(schema.fields[k]?.required?' · Bắt buộc':'');});
  for(let r=2;r<=101;r++)keys.forEach((k,i)=>{const f=schema.fields[k],c=sheet.getCell(r,i+1);c.font={name:'Calibri',size:11,color:{argb:'FF175B9B'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:r%2?'FFFFFFFF':'FFF1F5F9'}};if(f?.type==='number'){c.numFmt='#,##0.##';c.dataValidation={type:'decimal',operator:'greaterThanOrEqual',allowBlank:!f.required,formulae:[f.min??0],showErrorMessage:true,error:'Nhập số hợp lệ'};}else if(f?.type==='select'||f?.type==='boolean')c.dataValidation={type:'list',allowBlank:!f.required,formulae:['"'+(f.options||['TRUE','FALSE']).join(',')+'"']};else c.numFmt='@';});
  styleExcelSheet(sheet,1,keys.length,101);
  const guide=book.addWorksheet('Huong_dan');guide.columns=[{width:30},{width:42},{width:74}];guide.addRow(['CHIFAA · '+schema.title,'Tên hiển thị','Cách nhập']);guide.addRow(['Giữ sheet Nhap_lieu','Không đổi hàng tiêu đề','Điền tối đa 500 dòng, không công thức Excel. Ngày: YYYY-MM-DD; mã bản ghi duy nhất.']);for(const k of keys){const f=schema.fields[k];guide.addRow([k,f?.label||metaLabels[k],f?.type==='lines'?'Mảng JSON gồm type, id, quantity':f?.ref?'Mã bản ghi thuộc '+SCHEMA[f.ref].title:f?.options?.join(' / ')||f?.type==='boolean'&&'TRUE / FALSE'||f?.type==='date'&&'YYYY-MM-DD'||f?.type==='number'&&'Số thật, không gõ dấu phân cách nghìn'||'Văn bản']);}styleExcelSheet(guide,1,3,guide.rowCount);guide.eachRow(r=>r.eachCell(c=>{c.alignment={wrapText:true,vertical:'middle'};}));return book;
}
function validateExcelArchive(buffer){
  const bytes=new Uint8Array(buffer),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw new Error('Tệp Excel .xlsx không hợp lệ');
  const count=v.getUint16(end+10,true);let at=v.getUint32(end+16,true),total=0;
  if(count>300||!count)throw new Error('Tệp Excel có quá nhiều thành phần');
  for(let i=0;i<count;i++){if(at+46>bytes.length||v.getUint32(at,true)!==0x02014b50)throw new Error('Cấu trúc Excel không hợp lệ');if(v.getUint16(at+8,true)&1)throw new Error('Không nhận Excel có mật khẩu');total+=v.getUint32(at+24,true);if(total>12000000)throw new Error('Dữ liệu Excel sau giải nén vượt 12 MB');at+=46+v.getUint16(at+28,true)+v.getUint16(at+30,true)+v.getUint16(at+32,true);}
}
async function parseImportXlsx(buffer,module,Excel){
  if(!Excel)Excel=await ensureExcelRuntime();
  validateExcelArchive(buffer);const book=new Excel.Workbook();await book.xlsx.load(buffer);const sheet=book.getWorksheet('Nhap_lieu');if(!sheet)throw new Error('Dùng mẫu Excel có sheet Nhap_lieu');
  if(sheet.rowCount>501||sheet.columnCount>Object.keys(SCHEMA[module]?.fields||{}).length+META.length)throw new Error('Excel tối đa 500 dòng và các cột theo mẫu');
  const lines=[];for(let r=1;r<=sheet.rowCount;r++){const row=[];for(let c=1;c<=sheet.columnCount;c++){const value=sheet.getCell(r,c).value;if(value&&typeof value==='object'&&!(value instanceof Date))throw new Error('Không nhận công thức, liên kết hoặc ô phức tạp ở dòng '+r);row.push(value instanceof Date?value.toISOString().slice(0,10):String(value??''));}if(r===1||row.some(v=>v!==''))lines.push(row.map(v=>'"'+v.replace(/"/g,'""')+'"').join(','));}
  return parseImportCsv(lines.join('\r\n'),module);
}
async function downloadExcel(book,filename){const buffer=await book.xlsx.writeBuffer(),url=URL.createObjectURL(new Blob([buffer],{type:EXCEL_MIME})),a=document.createElement('a');a.href=url;a.download=filename.replace(/\.xlsx$/i,'')+'.xlsx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export {EXCEL_MIME,ensureExcelRuntime,createModuleWorkbook,createImportWorkbook,parseImportXlsx,validateExcelArchive,downloadExcel};

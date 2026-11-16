import {SCHEMA,META} from '../shared/schema.js';
function parseImportCsv(text,module){
  if(!SCHEMA[module]||typeof text!=='string')throw new Error('Chọn phân hệ CSV hợp lệ');text=text.replace(/^\uFEFF/,'');
  const first=text.split(/\r?\n/)[0],separator=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted)quoted=false;else if(cell==='')quoted=true;else throw new Error('CSV có dấu nháy sai vị trí');}else if(c===separator&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw new Error('CSV chưa đóng dấu nháy');row.push(cell);if(row.some(v=>v!==''))rows.push(row);if(rows.length<2||rows.length>501)throw new Error('CSV cần tiêu đề và 1–500 dòng');
  const headers=rows.shift().map(s=>s.trim());if(new Set(headers).size!==headers.length||!headers.includes('recordId')||headers.some(h=>!META.includes(h)&&!Object.hasOwn(SCHEMA[module].fields,h)))throw new Error('Cột CSV không khớp mẫu hoặc thiếu recordId');
  const records=rows.map((values,index)=>{
    if(values.length!==headers.length)throw new Error('Sai số cột CSV ở dòng '+(index+2));const raw=Object.fromEntries(headers.map((h,i)=>[h,values[i]])),record={};
    for(const [key,f]of Object.entries(SCHEMA[module].fields)){const value=raw[key]??'';if(value===''){record[key]='';continue;}if(f.type==='number'){record[key]=Number(value);if(!Number.isFinite(record[key]))throw new Error('Số không hợp lệ tại dòng '+(index+2)+', cột '+key+'; dùng số không phân cách hàng nghìn');}else if(f.type==='boolean'){if(!['true','false','TRUE','FALSE','1','0'].includes(value))throw new Error('Boolean dùng TRUE/FALSE tại dòng '+(index+2));record[key]=['true','TRUE','1'].includes(value);}else if(f.type==='lines'){try{record[key]=JSON.parse(value);}catch(_){throw new Error('Thành phần công thức cần mảng JSON hợp lệ');}}else record[key]=value;}
    return {module,recordId:raw.recordId,record};
  });return {records};
}
export {parseImportCsv};

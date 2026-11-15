import fs from'node:fs/promises';import crypto from'node:crypto';
import {SCHEMA}from'../src/shared/schema.js';import{cleanRecord}from'../src/shared/domain.js';
export function parseCSV(text){
  const rows=[];let row=[],cell='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell)throw new Error('Dấu nháy giữa ô CSV');else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('CSV thiếu dấu nháy đóng');if(cell||row.length){row.push(cell);if(row.some(Boolean))rows.push(row);}return rows;
}
if(process.argv[1]?.endsWith('import-preview.mjs')){
  const [module,input]=process.argv.slice(2);if(!SCHEMA[module]||!input){console.error('Usage: node scripts/import-preview.mjs materials path/to/data.csv');process.exit(1);}
  const [headers,...rows]=parseCSV(await fs.readFile(input,'utf8')),fields=SCHEMA[module].fields;
  if(headers.length!==new Set(headers).size)throw new Error('Trùng tên cột');
  for(const h of headers)if(h!=='legacyId'&&!Object.hasOwn(fields,h))throw new Error('Cột không rõ: '+h);
  const records=[],errors=[];const refs={};
  for(const [index,values]of rows.entries()){
    const record={};for(const [key,f]of Object.entries(fields)){
      const value=values[headers.indexOf(key)]??'';record[key]=f.type==='number'&&value!==''?Number(value):f.type==='boolean'?value==='true':f.type==='lines'?JSON.parse(value||'[]'):value;
    }
    // References cannot be validated without the destination dataset: flag them for server preview.
    for(const [key,f]of Object.entries(fields))if(f.ref&&record[key]){refs[f.ref]||=[];refs[f.ref].push({recordId:record[key]});}
    const legacyId=values[headers.indexOf('legacyId')];if(!legacyId){errors.push({row:index+2,error:'Thiếu legacyId ổn định'});continue;}
    try{if(!Object.values(fields).some(f=>f.type==='lines'))cleanRecord(module,record,refs);records.push({module,recordId:'legacy-'+crypto.createHash('sha256').update(module+':'+legacyId).digest('hex').slice(0,24),record});}catch(e){errors.push({row:index+2,error:e.message});}
  }
  await fs.mkdir('output',{recursive:true});await fs.writeFile('output/import-bundle.json',JSON.stringify({records},null,2));await fs.writeFile('output/import-errors.json',JSON.stringify(errors,null,2));
  console.log(JSON.stringify({records:records.length,errors:errors.length,output:'output/import-bundle.json',note:'Local preview only. Requires server previewImport_ before any write.'}));
  if(errors.length)process.exitCode=1;
}

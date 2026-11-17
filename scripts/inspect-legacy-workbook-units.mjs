import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import ExcelJS from 'exceljs';
// Read-only extraction. Excel cached errors/formulas/notes remain source evidence, never zero.
const [out,...files]=process.argv.slice(2);if(!out||!files.length)throw Error('Usage: node scripts/inspect-legacy-workbook-units.mjs output.json workbook.xlsx ...');
const result=[];
for(const file of files){
  const before=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'),book=new ExcelJS.Workbook();await book.xlsx.readFile(file);
  const sheets=[];for(const sheet of book.worksheets.filter(s=>/DANH MỤC|CÔNG THỨC|NHU CẦU NGUYÊN LIỆU/.test(s.name))){
    const cells=[];sheet.eachRow(row=>row.eachCell(cell=>{if(cell.value===null||cell.value==='')return;cells.push({address:cell.address,value:cell.value,formula:cell.formula||null,note:cell.note||null});}));sheets.push({name:sheet.name,rows:sheet.rowCount,cells});
  }
  const after=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');if(before!==after)throw Error('Original file changed during extraction');result.push({file:path.basename(file),sha256:before,unchanged:true,sheets});
}
await fs.writeFile(out,JSON.stringify(result,null,2));console.log(JSON.stringify({workbooks:result.length,unchanged:result.every(x=>x.unchanged),sheets:result.reduce((n,b)=>n+b.sheets.length,0),output:out}));

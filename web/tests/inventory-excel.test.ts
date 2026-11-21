import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {createInventoryWorkbook,parseInventoryWorkbook,type InventoryExcelRow} from '../features/operations/inventory-excel';

const sample:InventoryExcelRow[]=[{code:'0012',name:'Gạo thơm',category:'ingredient',unit:'kg',quantity:'12.500000',minimum:'2.000000',average:'31000.500000'}];

test('inventory workbook exports a snapshot with separate additive quantity and receipt price columns',async()=>{
 const blob=await createInventoryWorkbook(sample),workbook=new ExcelJS.Workbook();
 await workbook.xlsx.load(await blob.arrayBuffer());
 const sheet=workbook.getWorksheet('Tồn kho');assert.ok(sheet);
 assert.equal(sheet.getCell('A2').value,'0012');assert.equal(sheet.getCell('E2').value,12.5);assert.equal(sheet.getCell('F2').value,2);assert.equal(sheet.getCell('G2').value,31000.5);assert.ok(!sheet.getCell('E2').numFmt||sheet.getCell('E2').numFmt==='General');assert.ok(!sheet.getCell('F2').numFmt||sheet.getCell('F2').numFmt==='General');assert.equal(sheet.getCell('H2').value,'');assert.equal(sheet.getCell('I2').value,'');
 assert.ok(workbook.getWorksheet('Hướng dẫn'));
});

test('inventory workbook accepts numeric fractional receipt quantities such as 1.2 and 3.32',async()=>{
 const blob=await createInventoryWorkbook(sample),workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await blob.arrayBuffer());
 const sheet=workbook.getWorksheet('Tồn kho')!;sheet.getCell('H2').value=1.2;sheet.getCell('I2').value=12000;
 sheet.addRow(['0003','Muối','Phụ liệu','kg','','','',3.32,750.5]);
 const rows=await parseInventoryWorkbook(await workbook.xlsx.writeBuffer() as ArrayBuffer);
 assert.deepEqual(rows.map(row=>({code:row.code,added_quantity:row.added_quantity,unit_cost:row.unit_cost})),[
  {code:'0012',added_quantity:'1.2',unit_cost:'12000'},
  {code:'0003',added_quantity:'3.32',unit_cost:'750.5'},
 ]);
});

test('inventory workbook parser reads add-only rows and keeps leading-zero codes and decimal comma',async()=>{
 const blob=await createInventoryWorkbook(sample),workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await blob.arrayBuffer());
 const sheet=workbook.getWorksheet('Tồn kho')!;sheet.getCell('H2').value='1,25';sheet.getCell('I2').value='12000';
 sheet.addRow(['0003','Muối','Phụ liệu','kg','99','0','500','2','750']);
 const rows=await parseInventoryWorkbook(await workbook.xlsx.writeBuffer() as ArrayBuffer);
 assert.deepEqual(rows,[
  {code:'0012',name:'Gạo thơm',category:'ingredient',unit_code:'kg',minimum_quantity:'2',added_quantity:'1.25',unit_cost:'12000'},
  {code:'0003',name:'Muối',category:'auxiliary',unit_code:'kg',minimum_quantity:'0',added_quantity:'2',unit_cost:'750'},
 ]);
});

test('inventory workbook parser rejects duplicate codes and formula cells',async()=>{
 const blob=await createInventoryWorkbook(sample),duplicate=new ExcelJS.Workbook();await duplicate.xlsx.load(await blob.arrayBuffer());
 duplicate.getWorksheet('Tồn kho')!.addRow(['0012','Duplicate','Nguyên liệu','kg','','','','','']);
 await assert.rejects(async()=>parseInventoryWorkbook(await duplicate.xlsx.writeBuffer() as ArrayBuffer),/bị lặp/);
 const formula=new ExcelJS.Workbook();await formula.xlsx.load(await blob.arrayBuffer());formula.getWorksheet('Tồn kho')!.getCell('H2').value={formula:'1+1',result:2};
 await assert.rejects(async()=>parseInventoryWorkbook(await formula.xlsx.writeBuffer() as ArrayBuffer),/công thức/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {createMaterialWorkbook,parseMaterialWorkbook,type MaterialExcelRow} from '../features/catalog/material-excel';
import {database,asUser,identities} from './database-fixture';
import {buildMaterialImport} from '../lib/deploy/material-import';

const sample:MaterialExcelRow={material_id:'123e4567-e89b-42d3-a456-426614174000',version:'4',code:'0012',name:'Gạo thơm',category:'ingredient',purchase_unit_code:'kg',basis_unit_code:'kg',price_amount:'16000',minimum_quantity:'2.5',specification:'1 kg = 1.000 g'};
const day='2026-11-17';

test('material workbook exports and parses editable fields, hidden row identity and blank new rows',async()=>{
 const blob=await createMaterialWorkbook([sample]),workbook=new ExcelJS.Workbook();
 await workbook.xlsx.load(await blob.arrayBuffer());
 const sheet=workbook.getWorksheet('Danh mục vật tư');assert.ok(sheet);
 assert.equal(sheet.getColumn(1).hidden,true);assert.equal(sheet.getColumn(2).hidden,true);
 assert.equal(sheet.getCell('C2').value,'0012');assert.equal(sheet.getCell('H2').value,16000);assert.equal(sheet.getCell('I2').value,2.5);
 assert.ok(workbook.getWorksheet('Hướng dẫn'));
 sheet.addRow(['','','0003','Muối','Phụ liệu','kg','kg',0,'','Chưa rõ quy cách']);
 const rows=await parseMaterialWorkbook(await workbook.xlsx.writeBuffer() as ArrayBuffer);
 assert.deepEqual(rows,[sample,{material_id:null,version:null,code:'0003',name:'Muối',category:'auxiliary',purchase_unit_code:'kg',basis_unit_code:'kg',price_amount:'0',minimum_quantity:null,specification:'Chưa rõ quy cách'}]);
});

test('material workbook accepts localized decimals and rejects duplicate or formula values',async()=>{
 const blob=await createMaterialWorkbook([sample]),workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await blob.arrayBuffer());
 const sheet=workbook.getWorksheet('Danh mục vật tư')!;sheet.getCell('H2').value='12.500,25';sheet.getCell('I2').value='1,25';
 const rows=await parseMaterialWorkbook(await workbook.xlsx.writeBuffer() as ArrayBuffer);assert.equal(rows[0].price_amount,'12500.25');assert.equal(rows[0].minimum_quantity,'1.25');
 const duplicate=new ExcelJS.Workbook();await duplicate.xlsx.load(await blob.arrayBuffer());duplicate.getWorksheet('Danh mục vật tư')!.addRow(['','',sample.code,'Bản sao','Nguyên liệu','kg','kg','','','']);
 await assert.rejects(async()=>parseMaterialWorkbook(await duplicate.xlsx.writeBuffer() as ArrayBuffer),/bị lặp/);
 const formula=new ExcelJS.Workbook();await formula.xlsx.load(await blob.arrayBuffer());formula.getWorksheet('Danh mục vật tư')!.getCell('H2').value={formula:'1+1',result:2};
 await assert.rejects(async()=>parseMaterialWorkbook(await formula.xlsx.writeBuffer() as ArrayBuffer),/công thức/);
});

test('material catalog Excel import is atomic, idempotent, audited and separate from stock',async()=>{
 const db=await database();try{
  await db.exec(buildMaterialImport([{position:1,code:'XLS-CAT-1',name:'Tên ban đầu',category:'ingredient',unit:'kg',amount:'16000',minimum:'0',reference:null,specification:'1 kg'}],'f'.repeat(64),day));
  const existing=(await db.query<{id:string;version:string}>('select id,version from materials where code=$1',['XLS-CAT-1'])).rows[0];
  const payload=[
   {material_id:existing.id,version:existing.version,code:'XLS-CAT-1',name:'Tên đã sửa',category:'ingredient',purchase_unit_code:'kg',basis_unit_code:'kg',price_amount:'16000',minimum_quantity:'2.5',specification:'Cập nhật bằng Excel'},
   {material_id:null,version:null,code:'XLS-CAT-NEW',name:'Vật tư mới',category:'auxiliary',purchase_unit_code:'kg',basis_unit_code:null,price_amount:null,minimum_quantity:null,specification:''},
  ];
  const importRows=JSON.stringify(payload),key=crypto.randomUUID();
  const first=await asUser(db,identities.admin,()=>db.query<{result:{materials_created:number;materials_updated:number;materials_unchanged:number}}>('select import_material_catalog_excel($1::jsonb,$2) result',[importRows,key]));
  assert.deepEqual(first.rows[0].result,{materials_created:1,materials_updated:1,materials_unchanged:0});
  const auditCount=(await db.query<{count:string}>('select count(*) count from audit_logs')).rows[0].count;
  const replay=await asUser(db,identities.admin,()=>db.query<{import_material_catalog_excel:{materials_created:number;materials_updated:number;materials_unchanged:number}}>('select import_material_catalog_excel($1::jsonb,$2)',[importRows,key]));
  assert.deepEqual(replay.rows[0].import_material_catalog_excel,first.rows[0].result);
  assert.equal((await db.query<{count:string}>('select count(*) count from audit_logs')).rows[0].count,auditCount);
  assert.equal(Number((await db.query<{count:string|number}>('select count(*) count from inventory_movements')).rows[0].count),0);
  assert.equal((await db.query<{name:string}>('select name from materials where id=$1',[existing.id])).rows[0].name,'Tên đã sửa');
  const updated=(await db.query<{version:string}>('select version from materials where id=$1',[existing.id])).rows[0];
  const noChange=[{...payload[0],version:updated.version}];
  const noop=await asUser(db,identities.admin,()=>db.query<{result:{materials_updated:number;materials_unchanged:number}}>('select import_material_catalog_excel($1::jsonb,$2) result',[JSON.stringify(noChange),crypto.randomUUID()]));
  assert.deepEqual(noop.rows[0].result,{materials_created:0,materials_updated:0,materials_unchanged:1});
  const priceUpdate=[{...noChange[0],price_amount:'17000'}];
  await asUser(db,identities.admin,()=>db.query('select import_material_catalog_excel($1::jsonb,$2)',[JSON.stringify(priceUpdate),crypto.randomUUID()]));
  const latestPrice=(await db.query<{amount:string;verification:string}>('select amount::text,verification from material_resolutions where material_id=$1 order by revision desc limit 1',[existing.id])).rows[0];
  assert.deepEqual(latestPrice,{amount:'17000.000000',verification:'needs_verification'});

  const exported=await asUser(db,identities.admin,()=>db.query<{result:{total:number;rows:Record<string,unknown>[]}}>('select material_catalog_excel_export($1,$2,$3) result',[day,0,500]));
  assert.equal(exported.rows[0].result.total,2);assert.ok(exported.rows[0].result.rows.some(row=>row.code==='XLS-CAT-NEW'));
  assert.ok(exported.rows[0].result.rows.every(row=>!('stock_quantity' in row)));

  const before=(await db.query<{count:string}>('select count(*) count from materials')).rows[0].count;
  const badRows=[{material_id:null,version:null,code:'XLS-ROLLBACK',name:'Không được tạo',category:'ingredient',purchase_unit_code:'kg',basis_unit_code:null,price_amount:null,minimum_quantity:null,specification:''},{...noChange[0],version:'999'}];
  await assert.rejects(()=>asUser(db,identities.admin,()=>db.query('select import_material_catalog_excel($1::jsonb,$2)',[JSON.stringify(badRows),crypto.randomUUID()])),/VERSION_CONFLICT/);
  assert.equal((await db.query<{count:string}>('select count(*) count from materials')).rows[0].count,before);
 }finally{await db.close();}
});

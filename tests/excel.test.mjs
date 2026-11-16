import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createModuleWorkbook,createImportWorkbook,parseImportXlsx,validateExcelArchive} from '../src/client/excel.js';
const reload=async book=>{const bytes=await book.xlsx.writeBuffer(),copy=new ExcelJS.Workbook();await copy.xlsx.load(bytes);return {bytes,book:copy};};
test('real XLSX preserves Unicode, native dates/numbers, missing vs zero, inert formula-like text and trace metadata',async()=>{
 const date=new Date('2026-11-16T10:00:00Z'),rows=[{recordId:'00123',version:1,name:'Gạo & nếp <loại A>',purchaseUnit:'kg',unit:'g',conversion:1000,purchasePrice:0,minimum:2,updatedAt:date.toISOString(),deleted:false,reverses:''},{recordId:'002',version:NaN,name:'=HYPERLINK("https://example.com","click")',purchasePrice:'',deleted:true,reverses:'00123'}];
 const {bytes,book}=await reload(createModuleWorkbook('materials',rows,{exportedAt:date,stamp:'snapshot'},ExcelJS));assert.equal(bytes.subarray(0,2).toString(),'PK');
 const sheet=book.getWorksheet('Du_lieu');assert.match(sheet.getCell('A1').value,/CHIFAA COMBINE/);assert.match(sheet.getCell('A2').value,/2 bản ghi/);
 assert.equal(sheet.getCell('A6').value,rows[0].name);assert.equal(sheet.getCell('E6').value,0);assert.equal(sheet.getCell('E7').value,null);assert.equal(sheet.getCell('A7').type,ExcelJS.ValueType.String);assert.equal(sheet.getCell('A7').value,rows[1].name);
 assert.equal(sheet.getCell('G6').value,'00123');assert.equal(sheet.getCell('I6').value.toISOString(),date.toISOString());assert.equal(sheet.views[0].ySplit,5);assert.equal(sheet.autoFilter,'A5:M7');assert.equal(sheet.getCell('A5').fill.fgColor.argb,'FF17283D');assert.equal(book.worksheets.length,2);
 assert.equal(sheet.getCell('H7').value,'NaN');
});
test('empty exports and all pages are preserved without invented zero rows',async()=>{
 const empty=await reload(createModuleWorkbook('materials',[],{},ExcelJS));assert.equal(empty.book.getWorksheet('Du_lieu').rowCount,5);
 const rows=Array.from({length:5101},(_,i)=>({recordId:'m'+i,name:'Vật tư '+i,purchasePrice:i}));const {book}=await reload(createModuleWorkbook('materials',rows,{},ExcelJS));assert.equal(book.getWorksheet('Du_lieu').rowCount,5106);assert.equal(book.getWorksheet('Du_lieu').getCell('A5106').value,'Vật tư 5100');
});
test('Excel template round-trips typed input through existing import preview contract',async()=>{
 const book=createImportWorkbook('materials',ExcelJS),sheet=book.getWorksheet('Nhap_lieu');sheet.getRow(2).values=['m1','Gạo thơm','kg','g',1000,22000,0];
 const bundle=await parseImportXlsx(await book.xlsx.writeBuffer(),'materials',ExcelJS);assert.equal(bundle.records.length,1);assert.equal(bundle.records[0].record.purchasePrice,22000);assert.equal(bundle.records[0].record.minimum,0);assert.equal(bundle.records[0].recordId,'m1');
 const orders=createImportWorkbook('dishes',ExcelJS);orders.getWorksheet('Nhap_lieu').getRow(2).values=['d1','Cơm',15000,true];assert.equal((await parseImportXlsx(await orders.xlsx.writeBuffer(),'dishes',ExcelJS)).records[0].record.published,true);
});
test('Excel import rejects formulas even with cached numeric results, rich links, wrong sheets and oversized rows',async()=>{
 for(const value of [{formula:'1+1',result:2},{text:'Gạo',hyperlink:'https://example.com'}]){const b=createImportWorkbook('materials',ExcelJS);b.getWorksheet('Nhap_lieu').getRow(2).values=['m',value,'kg','g',1,10,0];await assert.rejects(()=>b.xlsx.writeBuffer().then(bytes=>parseImportXlsx(bytes,'materials',ExcelJS)),/công thức, liên kết/);}
 const wrong=new ExcelJS.Workbook();wrong.addWorksheet('Sheet1');await assert.rejects(()=>wrong.xlsx.writeBuffer().then(bytes=>parseImportXlsx(bytes,'materials',ExcelJS)),/Nhap_lieu/);
 const large=createImportWorkbook('materials',ExcelJS);large.getWorksheet('Nhap_lieu').getCell('A502').value='too-many';await assert.rejects(()=>large.xlsx.writeBuffer().then(bytes=>parseImportXlsx(bytes,'materials',ExcelJS)),/500 dòng/);
});
test('Excel archive guard rejects invalid zip and declared decompression bombs before parsing',async()=>{
 assert.throws(()=>validateExcelArchive(new Uint8Array(30)),/không hợp lệ/);
 const book=createImportWorkbook('materials',ExcelJS),bytes=Buffer.from(await book.xlsx.writeBuffer());validateExcelArchive(bytes);
 const central=bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));bytes.writeUInt32LE(13000000,central+24);assert.throws(()=>validateExcelArchive(bytes),/12 MB/);
});
test('browser build separates Excel runtime and verifies cached public asset integrity before execution',()=>{
 const build=fs.readFileSync('scripts/build.mjs','utf8'),source=fs.readFileSync('src/client/excel.js','utf8');assert.match(build,/dist\/ExcelRuntime.html/);assert.match(build,/node_modules\/exceljs\/dist\/exceljs.min.js/);assert.match(build,/replace\('<!--APP-->',\(\)=>/);assert.match(source,/rpcCall\('publicAsset'/);assert.match(source,/subtle.digest\('SHA-256'/);assert.doesNotMatch(source,/cdnjs|unpkg|jsdelivr/);
 const browser=vm.createContext({setTimeout,clearTimeout,console});vm.runInContext(fs.readFileSync('node_modules/exceljs/dist/exceljs.min.js','utf8'),browser);assert.equal(typeof browser.ExcelJS.Workbook,'function');assert.equal(vm.runInContext('new ExcelJS.Workbook().worksheets.length',browser),0);
});
test('Excel lazy loader rejects a tampered public cache, downloads once and reuses verified code without authentication',async()=>{
 const code='globalThis.ExcelJS={Workbook:function FixtureWorkbook(){}};',hash=crypto.createHash('sha256').update(code).digest('hex');let cached='globalThis.untrustedExecuted=true;',calls=0;
 const ctx=vm.createContext({crypto:crypto.webcrypto,TextEncoder,Uint8Array,Response,document:{createElement:()=>({remove(){}}),head:{append:script=>vm.runInContext(script.textContent,ctx)}},caches:{open:async()=>({match:async()=>cached?new Response(cached):undefined,delete:async()=>{cached=null;},put:async(_,response)=>{cached=await response.text();}})},rpcCall:async(action,args)=>{assert.equal(action,'publicAsset');assert.equal(args.id,'exceljs-4.4.0');calls++;return {source:code};}});
 const source=fs.readFileSync('src/client/excel.js','utf8').replace(/^import .*?;\r?\n/gm,'').replace(/^export \{[^}]*\};?\r?\n?/gm,'').replaceAll('__EXCEL_ASSET_HASH__',hash);vm.runInContext(source,ctx);
 await vm.runInContext('ensureExcelRuntime()',ctx);assert.equal(ctx.untrustedExecuted,undefined);assert.equal(calls,1);assert.equal(cached,code);ctx.ExcelJS=undefined;await vm.runInContext('ensureExcelRuntime()',ctx);assert.equal(calls,1);assert.equal(typeof ctx.ExcelJS.Workbook,'function');
});
test('Excel lazy loader fails closed if a downloaded library does not match the build hash',async()=>{
 const ctx=vm.createContext({crypto:crypto.webcrypto,TextEncoder,Uint8Array,rpcCall:async()=>({source:'globalThis.untrustedExecuted=true;'})});
 vm.runInContext(fs.readFileSync('src/client/excel.js','utf8').replace(/^import .*?;\r?\n/gm,'').replace(/^export \{[^}]*\};?\r?\n?/gm,'').replaceAll('__EXCEL_ASSET_HASH__','0'.repeat(64)),ctx);
 await assert.rejects(()=>vm.runInContext('ensureExcelRuntime()',ctx),/không đúng phiên bản/);assert.equal(ctx.untrustedExecuted,undefined);
});

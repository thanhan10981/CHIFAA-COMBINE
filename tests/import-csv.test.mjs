import test from 'node:test';import assert from 'node:assert/strict';import {parseImportCsv} from '../src/client/import-csv.js';
test('CSV imports typed numbers, quoted commas/newlines, BOM and semicolon sheets',()=>{
 const csv='\uFEFFrecordId,name,purchaseUnit,unit,conversion,purchasePrice,minimum\r\nm1,"Rice, premium\nGrade ""A""",kg,g,1000,22000,0\r\n';const b=parseImportCsv(csv,'materials');assert.equal(b.records[0].record.name,'Rice, premium\nGrade "A"');assert.equal(b.records[0].record.conversion,1000);
 const d=parseImportCsv('recordId;name;price;published\nd1;Meal;20000;TRUE','dishes');assert.equal(d.records[0].record.published,true);assert.equal(d.records[0].record.price,20000);
});
test('CSV rejects ambiguous numbers, missing IDs, duplicate/unknown headers and broken quotes',()=>{
 for(const csv of ['name,price,published\nMeal,20,TRUE','recordId,name,name\nd,Meal,Meal','recordId,password\nd,secret','recordId,name,price,published\nd,Meal,"1,5",TRUE','recordId,name,price,published\nd,"Meal,20,TRUE'])assert.throws(()=>parseImportCsv(csv,'dishes'));
});

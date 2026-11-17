import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cleanRecord} from '../src/shared/domain.js';

// Preparation only. No Google credentials, services or destination writes.
export function legacyNumber(value){
  const text=String(value??'').trim();if(!text)return null;
  if(!/^-?\d+(?:\.\d{3})*(?:,\d+)?$/.test(text))throw Error('Invalid Vietnamese source number: '+text);
  const number=Number(text.replaceAll('.','').replace(',','.'));if(!Number.isFinite(number))throw Error('Nonfinite source number');return number;
}
export function extractLegacyRecipes(text){
  const rows=text.replace(/^\uFEFF/,'').split(/\r?\n/).map((s,i)=>({line:i+1,cells:s.split('\t').map(c=>c.trim())}));
  const sections=[],sourceCostSummary=[],parameters=[];let heading='',current=null,mode='';
  for(const row of rows){const c=row.cells;
    if(!c.some(Boolean))continue;
    if(c[0]==='THÔNG SỐ CHUNG'){mode='parameters';continue;}
    if(c[0]==='TỔNG HỢP COST TỪNG MÓN'){mode='summary';continue;}
    if(mode==='parameters'&&c[0]&&c[4])parameters.push({sourceLine:row.line,label:c[0],value:c[4],note:c[5]||''});
    if(mode==='summary'&&/^\d+$/.test(c[0])&&c[1]){sourceCostSummary.push({sourceLine:row.line,name:c[1],unit:c[5],cost:legacyNumber(c[6]),ingredients:legacyNumber(c[7]),packaging:legacyNumber(c[8])});continue;}
    if(c[0]&& !/^\d+$/.test(c[0])&&c[0]!=='STT'&&c.slice(1).every(v=>!v)){
      heading=c[0];current=null;mode='';continue;
    }
    if(c[0]==='STT'&&c[1]==='Mã SP'){
      const batch=c[4]==='Định lượng 1 mẻ';
      current={sourceLine:row.line,name:heading,type:batch?'batch':heading.startsWith('CHI PHÍ')?'packaging':'dish',yieldSource:null,lines:[],notes:[]};
      if(batch){const previous=rows.slice(0,row.line-1).reverse().find(r=>r.cells[0]?.startsWith('Số phần'));if(previous&&previous.line>(sections.at(-1)?.sourceLine||0))current.yieldSource=legacyNumber(previous.cells[2]);}
      sections.push(current);continue;
    }
    if(current?.type==='packaging'&& !c[0]&&!c[1]&&c[2]&& !c[2].startsWith('TỔNG')){
      if(current.lines.length){current={...current,sourceLine:row.line,name:c[2],lines:[],notes:[]};sections.push(current);}else current.name=c[2];continue;
    }
    if(current&&c[3]&&c[4]&&(/^\d+$/.test(c[0])||(!c[0]&&c[1]&&!c[2]))){
      current.lines.push({sourceLine:row.line,code:c[1]||null,name:c[2]||null,unit:c[3],quantity:legacyNumber(c[4]),sourceQuantity:c[4],sourceUnitPrice:current.type==='batch'?null:legacyNumber(c[5]),sourceLineTotal:current.type==='batch'?null:legacyNumber(c[6]),sourceCells:c});continue;
    }
    if(current)current.notes.push({sourceLine:row.line,cells:c});
  }
  return {parameters,sourceCostSummary,sections:sections.filter(s=>s.lines.length)};
}
export function prepareLegacyCatalog(catalog,recipeText){
  const records=[],data={stores:[],dishes:[]},skipped=[],mapping=[],discountsPending=[];
  const add=(module,legacyCode,record)=>{const ascii=legacyCode.normalize('NFKD').replaceAll('Đ','D').replaceAll('đ','d').replace(/[\u0300-\u036f]/g,'');if(!/^[A-Za-z0-9-]+$/.test(ascii))throw Error('Unmapped legacy code');const recordId='legacy-'+module+'-'+ascii;if(data[module].some(x=>x.recordId===recordId))throw Error('Duplicate legacy code');const clean=cleanRecord(module,record,data);data[module].push({...clean,recordId});records.push({module,recordId,record:clean});mapping.push({module,legacyCode,recordId});return recordId;};
  for(const store of catalog.stores){if(!store.name?.trim()){skipped.push({module:'stores',code:store.code,reason:'Empty name'});continue;}add('stores',store.code,{name:store.name.trim(),address:store.address?.trim()||'',contact:''});}
  for(const dish of catalog.dishes)add('dishes',dish.code,{name:dish.name.trim(),price:dish.price,published:false});
  for(const store of catalog.stores.filter(s=>s.name?.trim()))for(const dish of catalog.dishes){
    if(catalog.uncheckedDishCodes.includes(dish.code))continue;
    const storeId=mapping.find(x=>x.module==='stores'&&x.legacyCode===store.code).recordId,dishId=mapping.find(x=>x.module==='dishes'&&x.legacyCode===dish.code).recordId;
    discountsPending.push({module:'discounts',recordId:`legacy-ck-${storeId.slice(14)}-${dish.code}`,storeId,dishId,rate:store.rate,recoveryPrice:null,status:'NEEDS_RECOVERY_SUPPORT_VALUE',effectiveFrom:null});
  }
  const recipes=extractLegacyRecipes(recipeText),materialCodes=new Map();
  for(const section of recipes.sections)for(const line of section.lines)if(line.code){const entry=materialCodes.get(line.code)||{code:line.code,names:[],units:[],sourceLines:[]};if(line.name&&!entry.names.includes(line.name))entry.names.push(line.name);if(!entry.units.includes(line.unit))entry.units.push(line.unit);entry.sourceLines.push(line.sourceLine);materialCodes.set(line.code,entry);}
  const costDifferences=catalog.dishes.map((dish,i)=>({code:dish.code,name:dish.name,catalogCost:dish.sourceCost,recipeSummaryCost:recipes.sourceCostSummary[i]?.cost??null})).filter(x=>x.catalogCost!==x.recipeSummaryCost);
  return {bundle:{records},mapping,skipped,discountsPending,recipes,materialsPending:[...materialCodes.values()],costDifferences,status:'PREPARED_NOT_IMPORTED',sourceHash:crypto.createHash('sha256').update(recipeText).digest('hex'),notes:['No existing destination rows checked. Server preview must check duplicate IDs, names/codes and references before apply.','Recipes are staging source, not an importable bundle: material identities and purchase units/prices missing.','Recovery support is unspecified. Do not substitute the deprecated12000 return price or invent0.','Dish unit and historical cost stay in staging: destination dishes schema has no such fields.','Public catalog flags remain false. No stock, sales, cash or opening balances generated.']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [catalogPath,recipePath,outputDir]=process.argv.slice(2);if(!outputDir)throw Error('Usage: node scripts/legacy-catalog-preparation.mjs catalog.json recipes.txt outputDir');
  const catalog=JSON.parse(await fs.readFile(catalogPath,'utf8')),recipeText=await fs.readFile(recipePath,'utf8'),result=prepareLegacyCatalog(catalog,recipeText);
  await fs.mkdir(outputDir,{recursive:true});await fs.writeFile(path.join(outputDir,'01-diem-ban-mon.json'),JSON.stringify(result.bundle,null,2));await fs.writeFile(path.join(outputDir,'02-du-lieu-cho-doi-chieu.json'),JSON.stringify({...result,bundle:undefined},null,2));
  console.log(JSON.stringify({status:result.status,records:result.bundle.records.length,recipeSections:result.recipes.sections.length,recipeLines:result.recipes.sections.reduce((n,s)=>n+s.lines.length,0),materialCodes:result.materialsPending.length,discountsPending:result.discountsPending.length,costDifferences:result.costDifferences.length}));
}

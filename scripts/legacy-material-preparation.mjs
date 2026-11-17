import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {legacyNumber} from './legacy-catalog-preparation.mjs';import {cleanRecord} from '../src/shared/domain.js';

// Escape rather than transliterate identifiers: Vietnamese codes must remain distinct.
export const legacyMaterialId=code=>'legacy-materials-'+Array.from(code.normalize('NFC')).map(c=>/[A-Za-z0-9-]/.test(c)?c:'_u'+c.codePointAt(0).toString(16)+'_').join('');
const key=s=>s.normalize('NFC').trim().toLowerCase();
export function parseLegacyMaterials(text){
  const rows=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim()).map(l=>l.split('\t').map(v=>v.trim()));
  const headers=rows.shift();if(headers?.[1]!=='Mã SP'||headers?.[2]!=='Tên vật tư'||headers?.length!==11)throw Error('Unexpected legacy material header');
  const seen=new Set();return rows.map((c,index)=>{
    if(c.length!==11||!/^\d+$/.test(c[0])||!c[1]||!c[2])throw Error('Invalid source row '+(index+2));
    if(seen.has(c[1]))throw Error('Duplicate source material code');seen.add(c[1]);
    return {sourceLine:index+2,code:c[1],name:c[2],purchaseUnit:c[3],purchasePrice:legacyNumber(c[4]),group:c[5],minimum:legacyNumber(c[6]),sourceBalance:c[7],sourceInventoryValue:c[8],sourceWarning:c[9],sourceConversion:legacyNumber(c[10]),sourceCells:c};
  });
}
export function prepareLegacyMaterials(text,recipeStaging,{unitRules={}}={}){
  const source=parseLegacyMaterials(text),ready=[],pending=[],mapping=[],mapped=new Map(),priceDifferences=[];
  for(const row of source){
    const recordId=legacyMaterialId(row.code),issues=[];if(recordId.length>100)throw Error('Material ID too long');
    let units=unitRules[row.code];
    if(!units){
      if(key(row.purchaseUnit)==='kg'&&row.sourceConversion===1000)units={purchaseUnit:'kg',unit:'g',conversion:1000};
      else if(['cái','quả'].includes(key(row.purchaseUnit))&&[null,1].includes(row.sourceConversion))units={purchaseUnit:key(row.purchaseUnit),unit:key(row.purchaseUnit),conversion:1};
      else issues.push('Cần xác nhận đơn vị mua/sử dụng, quy cách và cơ sở đơn giá');
    }
    if(row.minimum==null)issues.push('Tồn tối thiểu trống; schema hiện yêu cầu số, chưa tự đặt0');
    const record=units?{name:row.name,...units,purchasePrice:row.purchasePrice??'',minimum:row.minimum==null?null:row.minimum*units.conversion}:null;
    if(record&& !issues.length){cleanRecord('materials',record);ready.push({module:'materials',recordId,record});}
    const item={...row,recordId,normalized:record,issues,status:issues.length?'PENDING':'READY_FOR_SERVER_PREVIEW'};
    if(issues.length)pending.push(item);mapped.set(row.code,item);mapping.push({legacyCode:row.code,recordId,name:row.name,status:item.status});
  }
  const recipes=[],recipesPending=[],recipeJoins=[];const readyData={materials:ready.map(x=>({...x.record,recordId:x.recordId})),recipes:[]};
  const sections=recipeStaging.recipes?.sections||recipeStaging.sections||[];
  for(const section of sections){
    const issues=[],lines=[];
    for(const line of section.lines){
      const material=line.code?mapped.get(line.code):null;
      recipeJoins.push({section:section.name,sourceLine:line.sourceLine,code:line.code,materialId:material?.recordId||null,name:material?.name||line.name,sourceUnit:line.unit,sourceQuantity:line.quantity,materialReady:material?.status==='READY_FOR_SERVER_PREVIEW'});
      if(!material){issues.push({line:line.sourceLine,reason:line.code?'Mã chưa có trong danh mục':'Liên kết cơm/nhân/sốt/nước cần mapping công thức, không tự tạo vật tư'});continue;}
      if(material.issues.length)issues.push({line:line.sourceLine,reason:'Vật tư chờ xác nhận: '+line.code});
      if(material.normalized&&key(material.normalized.unit)!==key(line.unit))issues.push({line:line.sourceLine,reason:'Đơn vị thành phần khác đơn vị sử dụng; cần quy đổi được duyệt'});
      lines.push({type:'material',id:material.recordId,quantity:line.quantity});
      if(section.type!=='batch'&&material.normalized&&key(material.normalized.unit)===key(line.unit)&&line.sourceUnitPrice!=null&&material.purchasePrice!=null){
        const catalogUnitPrice=material.purchasePrice/material.normalized.conversion;
        if(Math.abs(line.sourceUnitPrice-catalogUnitPrice)>1e-9)priceDifferences.push({code:line.code,section:section.name,sourceLine:line.sourceLine,formulaUnitPrice:line.sourceUnitPrice,catalogUnitPrice});
      }
    }
    if(section.type!=='batch')issues.push({reason:'Công thức món/bao bì cần nối công thức con và đúng đơn vị hộp/cây/phần trước khi nhập'});
    if(!(section.yieldSource>0))issues.push({reason:'Chưa có sản lượng mẻ xác định'});
    const recordId='legacy-recipes-'+crypto.createHash('sha256').update(section.name).digest('hex').slice(0,24);
    if(issues.length){recipesPending.push({recordId,source:section,issues});continue;}
    const record={name:section.name,kind:'nhan-sot',dishId:'',yield:section.yieldSource,lines};cleanRecord('recipes',record,readyData);readyData.recipes.push({...record,recordId});recipes.push({module:'recipes',recordId,record});
  }
  return {status:'PREPARED_NOT_IMPORTED',bundle:{records:[...ready,...recipes]},source,materialsReady:ready.length,materialsPending:pending,recipesReady:recipes.length,recipesPending,mapping,recipeJoins,priceDifferences,missingRecipeCodes:[...new Set(recipeJoins.filter(x=>x.code&&!x.materialId).map(x=>x.code))],sourceHash:crypto.createHash('sha256').update(text).digest('hex'),notes:['Source balances/errors retained only; no opening-stock, cash or historical transactions generated.','Blank minimum is not0. Minimum amounts converted from purchase units to usage units.','Partial recipes are never written. Parent, packaging and rice/sauce ambiguities remain staging.','Source price0 remains explicit0; blank price remains blank. Price discrepancies are reported, not silently replaced.']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [sourcePath,recipePath,rulesPath,out]=process.argv.slice(2);if(!out)throw Error('Usage: node scripts/legacy-material-preparation.mjs materials.tsv staging.json rules.json outputDir');
  const result=prepareLegacyMaterials(await fs.readFile(sourcePath,'utf8'),JSON.parse(await fs.readFile(recipePath,'utf8')),JSON.parse(await fs.readFile(rulesPath,'utf8')));
  await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'03-vat-tu-cong-thuc-ro-rang.json'),JSON.stringify(result.bundle,null,2));await fs.writeFile(path.join(out,'04-doi-chieu-vat-tu.json'),JSON.stringify({...result,bundle:undefined},null,2));
  console.log(JSON.stringify({status:result.status,sourceRows:result.source.length,materialsReady:result.materialsReady,materialsPending:result.materialsPending.length,recipesReady:result.recipesReady,recipesPending:result.recipesPending.length,recipeMaterialCodesMatched:new Set(result.recipeJoins.filter(x=>x.materialId).map(x=>x.code)).size,missingRecipeCodes:result.missingRecipeCodes.length,priceDifferences:result.priceDifferences.length}));
}

import Decimal from 'decimal.js';
import {recipeIssues} from './store-production-errors';

export type ProductionInput={main:string;extra:string;defect:string};
export type ProductionProduct={id:string;code:string;name:string;recipe_version_id:string|null;recipe_issue?:string|null};
export const emptyProductionInput:ProductionInput={main:'',extra:'',defect:''};
export function isValidFinishedGoodsQuantity(value:string){
 const raw=value.trim();if(!/^\d+$/.test(raw))return false;
 const quantity=Number(raw);
 return Number.isSafeInteger(quantity)&&quantity<1e14;
}
export function storeProductionInputsAreZero(items:{product_id:string}[],inputs:Record<string,ProductionInput>={}){
 return items.length>0&&items.every(item=>{
  const input=inputs[item.product_id];
  return !!input&&(['main','extra','defect'] as const).every(key=>/^\d+(?:\.\d{1,6})?$/.test(input[key])&&new Decimal(input[key]).isZero());
 });
}
export function storeProductionLines(items:{product_id:string;name:string}[],products:ProductionProduct[],inputs:Record<string,ProductionInput>={},options:{allowZeroProduction?:boolean}={}){
 if(!items.length)throw new Error('Không có món cần ghi sản xuất trong các đơn đã duyệt.');
 const map=new Map(products.map(p=>[p.id,p]));
 return items.flatMap(item=>{
  const input=inputs[item.product_id]??emptyProductionInput;
  for(const [key,label] of [['main','sản xuất chính'],['extra','sản xuất thêm'],['defect','lỗi SX']] as const){
   if(!/^\d+(?:\.\d{1,6})?$/.test(input[key])||new Decimal(input[key]).gte('1e14'))throw new Error(`${item.name}: nhập ${label} hợp lệ (kể cả 0 nếu không có).`);
  }
  const total=new Decimal(input.main).plus(input.extra);
  if(new Decimal(input.defect).gt(total))throw new Error(`${item.name}: lỗi SX không được vượt tổng sản xuất.`);
  if(total.isZero()){
   if(options.allowZeroProduction)return [];
   throw new Error(`${item.name}: tổng sản xuất chính + thêm phải lớn hơn 0.`);
  }
  const product=map.get(item.product_id);
  if(!product?.recipe_version_id||product.recipe_issue)throw new Error(`${item.name}: ${recipeIssues[product?.recipe_issue??'PUBLISHED_PRODUCT_RECIPE_REQUIRED']??product?.recipe_issue}`);
  return {product_id:item.product_id,recipe_version_id:product.recipe_version_id,main_quantity:input.main,extra_quantity:input.extra,rejected_quantity:input.defect};
 });
}

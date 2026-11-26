import Decimal from 'decimal.js';
import type {OrderMaterialDemandData} from '../orders/order-summary';

export type InventoryRow={id:string;code:string;name:string;category:string;unit_id:string|null;unit:string|null;quantity:string|null;minimum:string|null;needed:string|null;suggested:string|null;status:string;stock_average_unit_cost:string|null};
export type InventoryResult={rows:InventoryRow[];total:number;summary:{materials:number;known:number;unknown:number;low:number};needs_complete:boolean;planned:boolean;inventory_version:string};
export type ReplenishmentDemand=Omit<OrderMaterialDemandData,'materials'>&{
 products:{product_id:string;quantity:string}[];
 materials:(OrderMaterialDemandData['materials'][number]&{material_id:string;sources?:{product_id?:string;product_name?:string;product_code?:string;quantity:string}[]})[];
};
const Quantity=Decimal.clone({precision:40});

// Read every matching catalogue page before filtering by the new order-based
// suggestion. The server's attention filter only knows saved production plans.
export async function inventoryPages(read:(offset:number)=>Promise<InventoryResult>){
 const first=await read(0),rows=[...first.rows],ids=new Set(rows.map(row=>row.id));
 while(rows.length<first.total){
  const page=await read(rows.length);
  if(page.inventory_version!==first.inventory_version||page.total!==first.total||!page.rows.length||page.rows.some(row=>ids.has(row.id)))throw new Error('Số liệu kho vừa thay đổi. Tải lại để tính đủ đề xuất.');
  for(const row of page.rows){rows.push(row);ids.add(row.id);}
 }
 return {...first,rows};
}

export function orderReplenishment(inventory:InventoryResult,demand:ReplenishmentDemand|undefined,status:string,offset:number):InventoryResult{
 const complete=!!demand&&demand.issues.length===0;
 const byMaterial=new Map<string,ReplenishmentDemand['materials']>();
 for(const material of demand?.materials??[])byMaterial.set(material.material_id,[...(byMaterial.get(material.material_id)??[]),material]);
 const rows=inventory.rows.map(row=>{
  const materials=byMaterial.get(row.id)??[];
  const sameUnit=!!row.unit_id&&!!row.unit&&materials.every(material=>material.unit_code===row.unit);
  const needed=sameUnit&&(complete||materials.length>0)?materials.reduce((sum,material)=>sum.plus(material.quantity),new Quantity(0)).toFixed():null;
  const suggested=complete&&needed!==null&&row.quantity!==null&&row.minimum!==null?Quantity.max(0,new Quantity(row.minimum).plus(needed).minus(row.quantity)).toFixed():null;
  return {...row,needed,suggested};
 }).filter(row=>status==='all'||row.status===status||status==='attention'&&(row.status!=='ok'||row.suggested===null||new Quantity(row.suggested).gt(0)));
 return {...inventory,rows:rows.slice(offset,offset+50),total:rows.length,needs_complete:complete,planned:!!demand?.products.length};
}

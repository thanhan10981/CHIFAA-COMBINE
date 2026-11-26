import Decimal from 'decimal.js';
export type QuantityDiscountRule={version:number;threshold:string;base_rate:string;upgraded_rate:string};
export function quantityDiscountRate(_product:{discount_rate?:string|null;discount_eligible?:boolean},totalQuantity:string,rule?:QuantityDiscountRule){
 if(rule?.version!==2)return '0';
 const base=new Decimal(rule.base_rate||'0');
 return base.eq('0.15')&&new Decimal(totalQuantity||'0').gt(rule.threshold)?rule.upgraded_rate:base.toString();
}

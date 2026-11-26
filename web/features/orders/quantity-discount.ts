import Decimal from 'decimal.js';
export type QuantityDiscountRule={version:number;threshold:string;below:string;at_or_above:string};
export function quantityDiscountRate(product:{discount_rate?:string|null;discount_eligible?:boolean},quantity:string,rule?:QuantityDiscountRule){
 if(rule?.version!==1)return product.discount_rate??'0';
 if(!product.discount_eligible)return '0';
 return new Decimal(quantity||'0').gte(rule.threshold)?rule.at_or_above:rule.below;
}

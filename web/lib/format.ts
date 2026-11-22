import Decimal from 'decimal.js';

/** Display numeric business values with no more than two decimal places. */
export function formatNumber(value:string|number|null|undefined,maxFractionDigits=2){
 if(value==null)return '—';
 const raw=String(value).trim();if(!raw)return raw;
 try{
  const decimal=new Decimal(raw);
  if(!decimal.isFinite())return raw;
  const rounded=decimal.toDecimalPlaces(maxFractionDigits,Decimal.ROUND_HALF_UP);
  if(rounded.isZero())return '0';
  const [whole,fraction='']=rounded.toFixed(maxFractionDigits).split('.');
  const negative=whole.startsWith('-');
  const grouped=new Intl.NumberFormat('vi-VN').format(BigInt(negative?whole.slice(1):whole));
  const trimmedFraction=fraction.replace(/0+$/,'');
  return `${negative?'-':''}${grouped}${trimmedFraction?','+trimmedFraction:''}`;
 }catch{return raw;}
}

export function formatVnd(value:string|number|null|undefined){return formatNumber(value,2);}
export function formatVndCurrency(value:string|null|undefined){
 if(value==null)return '—';
 try{return formatVnd(new Decimal(value).toDecimalPlaces(0,Decimal.ROUND_HALF_UP).toFixed(0));}
 catch{return value;}
}
export function formatQuantity(value:string|number|null|undefined){return formatNumber(value,2);}
export function moneyInputValue(value:string){if(!value)return '';const [whole,fraction]=value.split('.');return formatVnd(whole)+(value.includes('.')?','+fraction:'');}
export function parseMoneyInput(value:string){const raw=value.replace(/[.\s₫đ]/g,'').replace(',','.');return /^\d{0,14}(?:\.\d{0,6})?$/.test(raw)?raw:null;}

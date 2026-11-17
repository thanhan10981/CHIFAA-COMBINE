export function formatVnd(value:string|null|undefined){
 if(value==null)return '—';
 const match=/^(-?)(\d+)(?:\.(\d+))?$/.exec(value);if(!match)return value;
 const fraction=match[3]?.replace(/0+$/,'');
 return match[1]+new Intl.NumberFormat('vi-VN').format(BigInt(match[2]))+(fraction?','+fraction:'');
}
export function formatQuantity(value:string|null|undefined){return formatVnd(value);}
export function moneyInputValue(value:string){if(!value)return '';const [whole,fraction]=value.split('.');return formatVnd(whole)+(value.includes('.')?','+fraction:'');}
export function parseMoneyInput(value:string){const raw=value.replace(/[.\s₫đ]/g,'').replace(',','.');return /^\d{0,14}(?:\.\d{0,6})?$/.test(raw)?raw:null;}

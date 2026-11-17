export function formatVnd(value:string|null|undefined){
 if(value==null)return '—';
 if(!/^-?\d+$/.test(value))return value;
 return new Intl.NumberFormat('vi-VN').format(BigInt(value));
}

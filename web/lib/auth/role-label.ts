const labels:Record<string,string>={admin:'Admin',accountant:'Kế toán',manager:'Quản lý',production:'Sản xuất',warehouse:'Kho',sales:'Bán hàng',customer:'Khách hàng'};
const order=Object.keys(labels);
export function accountRoleLabel(roles:string[]){return [...new Set(roles)].sort((a,b)=>{const x=order.indexOf(a),y=order.indexOf(b);return (x<0?order.length:x)-(y<0?order.length:y)||a.localeCompare(b);}).map(role=>labels[role]??role).join(' · ')||'Chưa có vai trò';}

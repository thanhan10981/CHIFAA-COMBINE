import Decimal from 'decimal.js';
import {formatNumber,formatQuantity,formatVnd} from '../../lib/format';
import {sortProductsByMenuOrder} from '../../lib/product-order';

export type InvoiceLine={order_item_id:string;product_code:string|null;product_name:string|null;sale_unit:string|null;ordered_quantity:string;price_vnd:string;discount_rate:string};
const menu=[
 ['CN-XXPM','Cơm nắm xúc xích chà bông phô mai'],
 ['CN-XXMY','Cơm nắm xúc xích chà bông mayo'],
 ['CN-TERI','Cơm nắm gà sốt Teriyaki'],
 ['CN-GPM','Cơm nắm gà sốt phô mai'],
 ['CN-BV','Cơm nắm bò viên sốt bơ tỏi'],
 ['CN-CNM','Cơm nắm cá ngừ mayo'],
 ['CC','Cơm cuộn không chiên'],['CCC','Cơm cuộn chiên'],['CN-MY','Mì trộn Chifaa'],
 ['CC-NC','Cơm cuộn TT (Sỉ nguyên cây)'],['CCC-NC','Cơm cuộn chiên (Sỉ nguyên cây)']
];
const wholeCodes=new Set(['CC-NC','CCC-NC']);
const codeOf=(line:InvoiceLine)=>line.product_code?.trim().toUpperCase()??'';
// Match PostgreSQL: round each gross/net line, then sum. Never use binary floats for money.
export function invoiceAmounts(lines:readonly InvoiceLine[]){
 let gross=new Decimal(0),net=new Decimal(0);
 const discounts=new Map<string,Decimal>();
 for(const line of lines){
  const base=new Decimal(line.ordered_quantity).mul(line.price_vnd),rate=new Decimal(line.discount_rate);
  const before=base.toDecimalPlaces(0,Decimal.ROUND_HALF_UP),after=base.mul(new Decimal(1).minus(rate)).toDecimalPlaces(0,Decimal.ROUND_HALF_UP);
  gross=gross.plus(before);net=net.plus(after);
  if(!rate.isZero())discounts.set(rate.toString(),(discounts.get(rate.toString())??new Decimal(0)).plus(before.minus(after)));
 }
 return {gross:gross.toFixed(0),net:net.toFixed(0),discounts:[...discounts].map(([rate,amount])=>({rate,amount:amount.toFixed(0)}))};
}
export function invoiceRows(lines:readonly InvoiceLine[]){
 const rows=menu.flatMap<{code:string;name:string;line:InvoiceLine|null}>(([code,name])=>{
  const matches=lines.filter(line=>codeOf(line)===code);
  return matches.length?matches.map(line=>({code,name:line.product_name??name,line})): [{code,name,line:null}];
 });
 const known=new Set(menu.map(([code])=>code));
 rows.push(...sortProductsByMenuOrder(lines.filter(line=>!known.has(codeOf(line))).map(line=>({code:codeOf(line),name:line.product_name??'Món chưa có tên',line}))));
 return {main:rows.filter(row=>!wholeCodes.has(row.code)),whole:rows.filter(row=>wholeCodes.has(row.code))};
}

export function invoiceMoneyWords(value:string){
 const amount=BigInt(value);if(amount===0n)return 'Không đồng';
 const digits=['không','một','hai','ba','bốn','năm','sáu','bảy','tám','chín'];
 const group=(value:number,full:boolean)=>{
  const hundred=Math.floor(value/100),ten=Math.floor(value/10)%10,one=value%10,words:string[]=[];
  if(hundred||full)words.push(digits[hundred],'trăm');
  if(ten>1)words.push(digits[ten],'mươi');else if(ten===1)words.push('mười');else if(one&&(hundred||full))words.push('lẻ');
  if(one)words.push(one===1&&ten>1?'mốt':one===5&&ten>0?'lăm':digits[one]);
  return words.join(' ');
 };
 const groups:number[]=[];let remaining=amount<0n?-amount:amount;
 while(remaining){groups.push(Number(remaining%1000n));remaining/=1000n;}
 const words:string[]=[];
 for(let index=groups.length-1;index>=0;index--){if(!groups[index])continue;const scale=['','nghìn','triệu'][index%3],billions='tỷ '.repeat(Math.floor(index/3)).trim();words.push(group(groups[index],index<groups.length-1),[scale,billions].filter(Boolean).join(' '));}
 const result=(amount<0n?'âm ':'')+words.filter(Boolean).join(' ')+' đồng';
 return result[0].toUpperCase()+result.slice(1);
}

export function SalesInvoice({order,lines}:{order:{id:string;delivery_date:string;store_name:string|null;guest_name:string|null;guest_address:string|null;note:string|null};lines:readonly InvoiceLine[]}){
 const rows=invoiceRows(lines),mainAmounts=invoiceAmounts(lines.filter(line=>!wholeCodes.has(codeOf(line)))),amounts=invoiceAmounts(lines);
 const rates=[...new Set(['0.15','0.17',...amounts.discounts.map(discount=>discount.rate)])];
 const [year,month,day]=order.delivery_date.split('-');
 const renderRow=(row:ReturnType<typeof invoiceRows>['main'][number],index?:number)=> <tr key={row.line?.order_item_id??row.code} data-product-code={row.code}><td>{index===undefined?'':index+1}</td><td>{row.name}</td><td>{row.line?.sale_unit??''}</td><td>{row.line?formatQuantity(row.line.ordered_quantity):''}</td><td>{row.line?formatVnd(row.line.price_vnd):''}</td><td>{row.line?formatVnd(invoiceAmounts([row.line]).gross):''}</td></tr>;
 return <section className="order-print-sheet sales-invoice" aria-label="Hóa đơn bán hàng">
  <header className="sales-invoice-heading"><strong>CƠ SỞ SẢN XUẤT - NHƯỢNG QUYỀN THƯƠNG HIỆU<br/>CƠM NẮM CHIFAA</strong></header>
  <div>Địa chỉ: 223 Trần Hưng Đạo, Phường Bồng Sơn, Tỉnh Gia Lai</div>
  <div>Điện thoại: 0985 447 938</div>
  <h2>HOÁ ĐƠN BÁN HÀNG</h2>
  <div className="sales-invoice-customer">Họ tên khách hàng: <span>{order.guest_name??order.store_name??''}</span></div>
  <div className="sales-invoice-customer">Địa chỉ: <span>{order.guest_address??''}</span></div>
  <table><colgroup><col style={{width:'7%'}}/><col style={{width:'43%'}}/><col style={{width:'9%'}}/><col style={{width:'8%'}}/><col style={{width:'15%'}}/><col style={{width:'18%'}}/></colgroup>
   <thead><tr><th>TT</th><th>TÊN SẢN PHẨM</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
   <tbody>{rows.main.map((row,index)=>renderRow(row,index))}
    <tr className="sales-invoice-subtotal"><th colSpan={5}>Tổng cộng</th><td>{formatVnd(mainAmounts.gross)}</td></tr>
    {rates.map(rate=>{const discount=amounts.discounts.find(item=>item.rate===rate);return <tr key={rate}><th colSpan={5}>CK thương mại {formatNumber(new Decimal(rate).mul(100).toString())}%</th><td>{discount?formatVnd(discount.amount):''}</td></tr>;})}
    {rows.whole.map(row=>renderRow(row))}
    <tr className="sales-invoice-total"><th colSpan={5}>Tổng tiền thanh toán</th><td>{formatVnd(amounts.net)}</td></tr>
   </tbody>
  </table>
  <div className="sales-invoice-words">(Viết bằng chữ): {invoiceMoneyWords(amounts.net)}.</div>
  {order.note&&<div className="sales-invoice-note">Ghi chú: {order.note}</div>}
  <div className="sales-invoice-date">Bồng Sơn, ngày {day} tháng {month} năm {year}</div>
  <div className="sales-invoice-signatures"><strong>BÊN NHẬN HÀNG</strong><strong>BÊN GIAO HÀNG</strong></div>
 </section>;
}

import Decimal from 'decimal.js';
import Image from 'next/image';
import {formatNumber,formatQuantity,formatVnd} from '../../lib/format';
import {sortProductsByMenuOrder,productMenu,isWholeRollCode} from '../../lib/product-order';

export type InvoiceLine={order_item_id:string;product_code:string|null;product_name:string|null;sale_unit:string|null;ordered_quantity:string;price_vnd:string;discount_rate:string};
export type InvoicePaymentQr={bank_bin:string;account_number:string;account_holder:string;amount:string;order_code:string};
export type InvoiceReceivingAccount={id:string;kind:string;bank_bin:string|null;account_number:string|null;account_holder:string|null};
const validReceivingAccount=(account:InvoiceReceivingAccount)=>account.kind==='bank'&&/^\d{6}$/.test(account.bank_bin??'')&&/^[A-Za-z0-9]{6,19}$/.test(account.account_number??'')&&!!account.account_holder?.trim();
export function invoicePaymentForOrder(accounts:readonly InvoiceReceivingAccount[],preferredAccountId:string|null,lines:readonly InvoiceLine[],orderId:string,amountOverride?:string|null):InvoicePaymentQr|null{
 const preferred=accounts.find(row=>row.id===preferredAccountId&&row.kind==='bank');
 const account=preferred?(validReceivingAccount(preferred)?preferred:null):accounts.find(validReceivingAccount);
 const amount=amountOverride&&/^[1-9]\d{0,12}$/.test(amountOverride)?amountOverride:invoiceAmounts(lines).net;
 if(!account||!/^([1-9]\d{0,12})$/.test(amount))return null;
 return {bank_bin:account.bank_bin!,account_number:account.account_number!,account_holder:account.account_holder!.trim(),amount,order_code:orderId.slice(0,8).toUpperCase()};
}
export function vietQrQuickLink(payment:InvoicePaymentQr){
 if(!/^\d{6}$/.test(payment.bank_bin)||!/^[A-Za-z0-9]{6,19}$/.test(payment.account_number)||!/^[1-9]\d{0,12}$/.test(payment.amount))return null;
 const memo=`THANH TOAN DON HANG ${payment.order_code}`;
 return `https://img.vietqr.io/image/${encodeURIComponent(payment.bank_bin)}-${encodeURIComponent(payment.account_number)}-compact2.png?${new URLSearchParams({amount:payment.amount,addInfo:memo,accountName:payment.account_holder})}`;
}
const menu=productMenu;
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
export function invoiceSubtotalExpression(lines:readonly InvoiceLine[]){
 const groups=new Map<string,{unit:string;price:string;quantity:Decimal}>();
 for(const line of lines){
  const unit=line.sale_unit?.trim()??'',price=new Decimal(line.price_vnd).toFixed(0),key=`${unit}\u0000${price}`,group=groups.get(key);
  if(group)group.quantity=group.quantity.plus(line.ordered_quantity);
  else groups.set(key,{unit,price,quantity:new Decimal(line.ordered_quantity)});
 }
 return [...groups.values()].map(group=>`${formatQuantity(group.quantity.toString())}${groups.size>1&&group.unit?` ${group.unit}`:''} × ${formatVnd(group.price)}`).join(' + ');
}
export function invoiceRows(lines:readonly InvoiceLine[]){
 const rows=menu.flatMap<{code:string;name:string;line:InvoiceLine|null}>(([code,name])=>{
  const matches=lines.filter(line=>codeOf(line)===code);
  return matches.length?matches.map(line=>({code,name:line.product_name??name,line})): [{code,name,line:null}];
 });
 const known=new Set(menu.map(([code])=>code));
 rows.push(...sortProductsByMenuOrder(lines.filter(line=>!known.has(codeOf(line))).map(line=>({code:codeOf(line),name:line.product_name??'Món chưa có tên',line}))));
 return {main:rows.filter(row=>!isWholeRollCode(row.code)),whole:rows.filter(row=>isWholeRollCode(row.code))};
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

export function SalesInvoice({order,lines,payment}:{order:{id:string;delivery_date:string;store_name:string|null;guest_name:string|null;guest_address:string|null;note:string|null};lines:readonly InvoiceLine[];payment?:InvoicePaymentQr|null}){
 const rows=invoiceRows(lines),mainLines=lines.filter(line=>!isWholeRollCode(codeOf(line))),mainAmounts=invoiceAmounts(mainLines),amounts=invoiceAmounts(lines);
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
     <tr className="sales-invoice-subtotal"><th colSpan={3}>Tổng cộng</th><td colSpan={2} className="sales-invoice-subtotal-expression">{invoiceSubtotalExpression(mainLines)}</td><td>{formatVnd(mainAmounts.gross)}</td></tr>
    {rates.map(rate=>{const discount=amounts.discounts.find(item=>item.rate===rate);return <tr key={rate}><th colSpan={5}>CK thương mại {formatNumber(new Decimal(rate).mul(100).toString())}%</th><td>{discount?formatVnd(discount.amount):''}</td></tr>;})}
    {rows.whole.map(row=>renderRow(row))}
    <tr className="sales-invoice-total"><th colSpan={5}>Tổng tiền thanh toán</th><td>{formatVnd(amounts.net)}</td></tr>
   </tbody>
  </table>
  <div className="sales-invoice-words">(Viết bằng chữ): {invoiceMoneyWords(amounts.net)}.</div>
  {payment&&vietQrQuickLink(payment)&&<div className="sales-invoice-payment"><strong>THANH TOÁN CHUYỂN KHOẢN</strong><span>Ngân hàng BIN {payment.bank_bin} · STK {payment.account_number}</span><span>Chủ tài khoản: {payment.account_holder}</span><span>Nội dung: THANH TOAN DON HANG {payment.order_code}</span><span>Số tiền: {formatVnd(payment.amount)} đ</span><Image src={vietQrQuickLink(payment)!} alt="Mã QR thanh toán VietQR" width={540} height={640} unoptimized/></div>}
  {order.note&&<div className="sales-invoice-note">Ghi chú: {order.note}</div>}
  <div className="sales-invoice-date">Bồng Sơn, ngày {day} tháng {month} năm {year}</div>
  <div className="sales-invoice-signatures"><strong>BÊN NHẬN HÀNG</strong><strong>BÊN GIAO HÀNG</strong></div>
 </section>;
}

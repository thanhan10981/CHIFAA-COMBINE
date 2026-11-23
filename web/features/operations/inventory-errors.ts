import {formatQuantity} from '@/lib/format';
import Decimal from 'decimal.js';

type StockFailureDetails={
 material_code?:unknown;material_name?:unknown;unit_code?:unknown;transaction_date?:unknown;
 requested_quantity?:unknown;available_quantity?:unknown;shortage_quantity?:unknown;
 negative_balance_date?:unknown;projected_balance?:unknown;
};
type InventoryRpcError={code?:string;message?:string;details?:string|null};
type StockIssueContext={code:string;name:string;unit:string;date:string;requested:string;available:string|null};

const displayDate=(value:string)=>{const [year,month,day]=value.split('-');return year&&month&&day?`${day}/${month}/${year}`:value;};
const quantity=(value:unknown)=>typeof value==='string'||typeof value==='number'?formatQuantity(String(value)):'—';

export function inventoryPostError(error:InventoryRpcError,context?:StockIssueContext){
 if(error.message?.includes('INVENTORY_VERSION_CONFLICT'))return 'Tồn đã thay đổi. Đóng phiếu, tải lại tồn và đối chiếu số đếm trước khi lưu.';
 if(error.message?.includes('INSUFFICIENT_STOCK')){
  let detail:StockFailureDetails|undefined;
  try{detail=error.details?JSON.parse(error.details) as StockFailureDetails:undefined;}catch{}
  const code=typeof detail?.material_code==='string'?detail.material_code:context?.code;
  const name=typeof detail?.material_name==='string'?detail.material_name:context?.name;
  const unit=typeof detail?.unit_code==='string'?detail.unit_code:context?.unit;
  const transactionDate=typeof detail?.transaction_date==='string'?detail.transaction_date:context?.date;
  const negativeDate=typeof detail?.negative_balance_date==='string'?detail.negative_balance_date:null;
  const requested=detail?.requested_quantity??context?.requested;
  const available=detail?.available_quantity??context?.available;
  const shortage=detail?.shortage_quantity??(requested!==undefined&&available!==undefined?Decimal.max(0,new Decimal(String(requested)).minus(String(available))).toString():undefined);
  const material=code?`${code}${name?` · ${name}`:''}`:name??'Vật tư';
  if(negativeDate&&transactionDate&&negativeDate>transactionDate){
   return `Không thể xuất ${material}: phiếu ngày ${displayDate(transactionDate)} yêu cầu ${quantity(requested)} ${unit??''}, tồn trước phiếu ${quantity(available)} ${unit??''}; sau khi tính các phiếu đã ghi, tồn sẽ âm ${quantity(shortage)} ${unit??''} vào ${displayDate(negativeDate)}. Kiểm tra phiếu kho từ ngày này trở đi.`;
  }
  if(requested!==undefined&&available!==undefined){
   return `Không thể xuất ${material} ngày ${transactionDate?displayDate(transactionDate):'đã chọn'}: cần ${quantity(requested)} ${unit??''}, tồn trước phiếu ${quantity(available)} ${unit??''}, thiếu ${quantity(shortage)} ${unit??''}. Kiểm tra tồn và phiếu kho trước ngày này.`;
  }
  return `Không thể xuất ${material}: số dư kho tại ngày phiếu không đủ hoặc sẽ âm sau khi tính các phiếu liên quan. Tải lại tồn và kiểm tra lịch sử kho.`;
 }
 const known:Record<string,string>={PERIOD_CLOSED:'Ngày phiếu thuộc kỳ đã khóa, không thể ghi kho.',FORBIDDEN:'Tài khoản hiện không có quyền ghi phiếu kho.',INGREDIENT_WAREHOUSE_REQUIRED:'Kho đã chọn không phải kho nguyên vật liệu đang hoạt động.',INVALID_MOVEMENT_DIRECTION:'Loại phiếu và dấu số lượng không khớp. Phiếu xuất phải làm giảm tồn, phiếu nhập phải làm tăng tồn.',MATERIAL_STANDARD_UNIT_REQUIRED:'Vật tư chưa có đơn vị kho chuẩn. Cập nhật danh mục vật tư trước khi ghi phiếu.'};
 const reason=Object.entries(known).find(([code])=>error.message?.includes(code))?.[1];
 return reason?`Chưa lưu phiếu kho: ${reason}`:'Chưa lưu phiếu kho: kiểm tra quyền, kỳ kế toán, đơn vị và dữ liệu vừa chọn.';
}

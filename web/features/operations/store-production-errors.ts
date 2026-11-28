import {formatQuantity} from '@/lib/format';
import {inventoryPostError} from './inventory-errors';

export type FinishedStockCheck={product_id:string;code:string;name:string;unit:string;required_quantity:string;available_quantity:string;shortage_quantity:string};
type RpcError={code?:string;message?:string;details?:string|null};
export const recipeIssues:Record<string,string>={
 PUBLISHED_PRODUCT_RECIPE_REQUIRED:'Chưa có công thức công bố có hiệu lực cho ngày này.',
 PRODUCT_RECIPE_RATIO_REQUIRED:'Thiếu tỷ lệ quy đổi đơn vị món sang đầu ra công thức.',
 UNIT_NEEDS_VERIFICATION:'Quy đổi đơn vị nguyên liệu chưa được xác minh.',
 RECIPE_NEEDS_REVIEW:'Công thức có thành phần cần xác minh.',
 CHILD_OUTPUT_UNIT_MISMATCH:'Đơn vị đầu ra công thức con chưa khớp.',
 EMPTY_RECIPE:'Công thức chưa có thành phần.',
 RECIPE_CYCLE:'Các công thức con đang tham chiếu vòng lặp. Kiểm tra liên kết công thức.',
 RECIPE_NOT_FOUND:'Không tìm thấy phiên bản công thức được chọn.'
};
export function finishedStockMessage(lines:FinishedStockCheck[]){
 return lines.map(p=>`${p.code} · ${p.name}: cần ${formatQuantity(p.required_quantity)} ${p.unit}, tồn ${formatQuantity(p.available_quantity)} ${p.unit}, thiếu ${formatQuantity(p.shortage_quantity)} ${p.unit}`).join('; ');
}
export function storeProductionError(error:RpcError){
 const message=error.message??'';
 if(message.includes('finished_goods_stock_adjustments_after_quantity_integer'))return 'Chưa thực hiện: số tồn thành phẩm phải là số nguyên không âm.';
 const adjustmentErrors:Record<string,string>={FINISHED_GOODS_VERSION_CONFLICT:'Ồn thành phẩm vừa thay đổi. Tải lại danh sách trước khi sửa.',FINISHED_GOODS_ADJUSTMENT_BELOW_COMMITTED_STOCK:'Số tồn mới thấp hơn lượng đã cam kết cho giao/bán sau ngày này.',INVALID_FINISHED_GOODS_ADJUSTMENT:'Kiểm tra ngày, số tồn không âm (tối đa 6 chữ số thập phân) và lý do từ 5 ký tự.',PRODUCT_NOT_FOUND:'Món không còn tồn tại.'};
 for(const [code,reason] of Object.entries(adjustmentErrors))if(message.includes(code))return `Chưa thực hiện: ${reason}`;
 if(message.includes('INSUFFICIENT_STOCK'))return inventoryPostError(error);
 if(message.includes('INSUFFICIENT_FINISHED_GOODS')){
  try{
   const detail=JSON.parse(error.details??'{}') as {store_name?:string;products?:FinishedStockCheck[]};
   if(detail.products?.length)return `Chưa duyệt ${detail.store_name??'chuẩn bị'}: thiếu thành phẩm. ${finishedStockMessage(detail.products)}. Ghi sản xuất thực tế hoặc kiểm tra phiếu thành phẩm trước khi duyệt lại.`;
  }catch{}
  return 'Chưa duyệt: tồn thành phẩm không đủ cho đơn đã duyệt. Xem bảng kiểm tra thành phẩm; ghi sản xuất thực tế trước khi duyệt chuẩn bị. Nếu chưa có bảng chi tiết, cần cập nhật SQL chẩn đoán sản xuất 099.';
 }
 if(error.code==='PGRST202'||error.code==='42883')return 'Chưa có hàm dữ liệu cần thiết trên máy chủ. Quản trị cần đối chiếu và cập nhật SQL bàn sản xuất (095/099/102), rồi tải lại trang.';
 const reasons:Record<string,string>={...recipeIssues,FORBIDDEN:'Tài khoản thiếu quyền cho thao tác này. Kiểm tra quyền xem Đơn hàng/Sản xuất; ghi sản xuất cần thêm duyệt Sản xuất và tạo phiếu Kho.',PERIOD_CLOSED:'Ngày sản xuất thuộc kỳ đã khóa.',STORE_ORDER_SET_CHANGED:'Danh sách đơn đã thay đổi. Tải lại đơn trước khi ghi sản xuất.',NO_APPROVED_STORE_ORDERS:'Điểm bán không còn đơn đã duyệt trong ngày đã chọn.',NO_UNCONFIRMED_STORE_ORDERS:'Các điểm bán đã được duyệt hoặc không còn đơn cần chuẩn bị.',STORE_NOT_FOUND:'Điểm bán không tồn tại hoặc đã ngừng hoạt động.',INVALID_STORE_READINESS:'Chọn ngày, điểm bán và nhập lý do ít nhất 3 ký tự.',INVALID_PRODUCTION_RUN:'Nhập đủ giờ bắt đầu/kết thúc, kết thúc không trước bắt đầu và cách nhau tối đa 48 giờ; lý do từ 3 đến 2.000 ký tự.',INVALID_PRODUCTION_QUANTITY:'Sản lượng chính cộng thêm phải lớn hơn 0; lỗi không được vượt tổng sản lượng.',INGREDIENT_WAREHOUSE_REQUIRED:'Chưa xác định được kho nguyên liệu đang hoạt động.',MATERIAL_STANDARD_UNIT_REQUIRED:'Nguyên liệu chưa có đơn vị kho chuẩn.',IDEMPOTENCY_CONFLICT:'Phiếu đang chờ xác nhận có dữ liệu khác. Kiểm tra kết quả phiếu trước khi tạo lần mới.'};
 const reason=Object.entries(reasons).find(([code])=>message.includes(code))?.[1];
 if(reason)return `Chưa thực hiện: ${reason}`;
 if(error.code==='42501')return 'Tài khoản không có quyền thực hiện thao tác này.';
 return `Chưa nhận được xác nhận từ máy chủ. Kiểm tra kết nối và tải lại dữ liệu. Chi tiết: ${message||error.code||'Không có phản hồi'}`;
}

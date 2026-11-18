import type {MaterialRow} from './material-types';

// Empty values are distinct from a known zero. Review/stock thresholds belong to their workflows.
export function materialMissingFields(row:MaterialRow){
 return [
  !row.code.trim()&&'Mã SP',!row.name.trim()&&'Tên vật tư',!row.category&&'Nhóm',
  !row.purchase_unit_id&&'ĐVT',row.price_amount===null&&'Đơn giá',
  row.minimum_quantity===null&&'Tồn tối thiểu',
  row.stock_quantity===null&&'Tồn hiện tại',
  !row.specification.trim()&&'Quy cách',
 ].filter((field):field is string=>!!field);
}

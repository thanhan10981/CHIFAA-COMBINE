type Warehouse={id:string;name:string};
// Callers load only active ingredient warehouses. Never merge separate stock ledgers.
export function ingredientWarehouseId(rows:Warehouse[]|undefined){return rows?.length===1?rows[0].id:'';}
export function IngredientWarehouseStatus({rows}:{rows:Warehouse[]|undefined}){
 if(!rows||rows.length===1)return null;
 return <p role="status" className="muted">{rows.length===0?'Kho nguyên liệu chưa được khởi tạo. Liên hệ quản trị để thiết lập kho mặc định.':'Có nhiều kho nguyên liệu trong dữ liệu cũ. Cần xác định kho mặc định trước khi ghi phiếu; các số tồn chưa được gộp.'}</p>;
}

/* Shared schema: plain scalar columns stay editable in Google Sheets. */
const FIELD = (label, type = 'text', required = true, extra = {}) => ({ label, type, required, ...extra });
const DAY = FIELD('Ngày', 'date');
const QTY = label => FIELD(label, 'number', true, { min: 0 });
const REF = (label, ref) => FIELD(label, 'ref', true, { ref });
const CHOICE = (label, options) => FIELD(label, 'select', true, { options });
const SCHEMA = {
  materials: { title: 'Danh mục vật tư', group: 'Danh mục', fields: {
    name: FIELD('Tên vật tư'), purchaseUnit: FIELD('Đơn vị mua'), unit: FIELD('Đơn vị sử dụng'),
    conversion: FIELD('Số đơn vị sử dụng / đơn vị mua', 'number', true, { min: 0.000001 }),
    purchasePrice: FIELD('Giá mua', 'number', false, { min: 0 }), minimum: QTY('Tồn tối thiểu') } },
  dishes: { title: 'Danh mục món bán', group: 'Danh mục', fields: {
    name: FIELD('Tên món'), price: QTY('Giá bán'), published: FIELD('Công bố cho khách', 'boolean', false) } },
  stores: { title: 'Danh mục điểm bán', group: 'Danh mục', fields: {
    name: FIELD('Tên điểm bán'), address: FIELD('Địa chỉ', 'text', false), contact: FIELD('Liên hệ', 'text', false) } },
  employees: { title: 'Danh mục nhân viên', group: 'Danh mục', sensitive: true, fields: {
    name: FIELD('Họ tên'), department: CHOICE('Bộ phận', ['SX', 'VP', 'BH']),
    hourlyRate: QTY('Lương giờ'), allowance: QTY('Phụ cấp mặc định / ngày') } },
  discounts: { title: 'Bảng chiết khấu', group: 'Danh mục', fields: {
    storeId: REF('Điểm bán', 'stores'), dishId: REF('Món bán', 'dishes'),
    rate: FIELD('Tỷ lệ chiết khấu (0–1)', 'number', true, { min: 0, max: 1 }), recoveryPrice: QTY('Hỗ trợ thu hồi / phần') } },
  recipes: { title: 'Công thức nhiều cấp', group: 'Công thức', fields: {
    name: FIELD('Tên công thức'), kind: CHOICE('Loại', ['mon', 'nhan-sot', 'com', 'bao-bi']),
    dishId: FIELD('Món liên kết', 'ref', false, { ref: 'dishes' }), yield: FIELD('Sản lượng / mẻ', 'number', true, { min: 0.000001 }),
    lines: FIELD('Thành phần', 'lines') } },
  stock: { title: 'Nhập / xuất / kiểm kê', group: 'Kho', immutable: true, fields: {
    date: DAY, materialId: REF('Vật tư', 'materials'), type: CHOICE('Loại phiếu', ['nhap', 'xuat', 'dieu-chinh-tang', 'dieu-chinh-giam']),
    quantity: QTY('Số lượng (đơn vị sử dụng)'), unitCost: FIELD('Giá / đơn vị sử dụng', 'number', false, { min: 0 }), note: FIELD('Ghi chú', 'text', false) } },
  counts: { title: 'Kiểm kê thực tế', group: 'Kho', immutable: true, fields: {
    date: DAY, materialId: REF('Vật tư', 'materials'), opening: QTY('Tồn đầu'), closing: QTY('Tồn cuối'), otherOut: QTY('Xuất khác'), note: FIELD('Ghi chú', 'text', false) } },
  production: { title: 'Kế hoạch & chốt sản xuất', group: 'Sản xuất', immutable: true, fields: {
    date: DAY, dishId: REF('Món bán', 'dishes'), planned: QTY('Kế hoạch'), produced: QTY('Sản xuất chính'), extra: QTY('Sản xuất thêm'), rejected: QTY('Lỗi / hủy'), note: FIELD('Ghi chú', 'text', false) } },
  sales: { title: 'Doanh thu hằng ngày', group: 'Nhập liệu', immutable: true, sensitive: true, fields: {
    date: DAY, storeId: REF('Điểm bán', 'stores'), dishId: REF('Món bán', 'dishes'), delivered: QTY('Đã giao'), sold: QTY('Đã bán'), returned: QTY('Trả về ki-ốt'), creditQty: QTY('Điểm bán chịu (phần)'),
    price: QTY('Đơn giá bán tại thời điểm'), discount: FIELD('Chiết khấu (0–1)', 'number', true, { min: 0, max: 1 }), recoveryPrice: QTY('Hỗ trợ thu hồi / phần'), cash: QTY('Thực thu tiền mặt'), bank: QTY('Thực thu chuyển khoản'), oldDebtPaid: QTY('Thu công nợ cũ'), otherCost: QTY('Chi phí khác'), note: FIELD('Ghi chú', 'text', false) } },
  attendance: { title: 'Chấm công', group: 'Nhập liệu', immutable: true, sensitive: true, fields: {
    date: DAY, employeeId: REF('Nhân viên', 'employees'), start: FIELD('Bắt đầu (HH:mm)', 'time'), end: FIELD('Kết thúc (HH:mm)', 'time'), breakMinutes: QTY('Nghỉ (phút)'),
    hourlyRate: QTY('Lương giờ tại thời điểm'), department: CHOICE('Bộ phận tại thời điểm', ['SX', 'VP', 'BH']), defaultAllowance: QTY('Phụ cấp mặc định'), dailyAllowance: QTY('Phụ cấp thêm'), support: QTY('Hỗ trợ ngày'), advance: QTY('Tạm ứng'), deduction: QTY('Khấu trừ') } },
  plans: { title: 'Kế hoạch & mục tiêu', group: 'Quản trị', fields: {
    date: DAY, revenue: QTY('Doanh thu mục tiêu'), production: QTY('Sản lượng mục tiêu'), fixedCost: QTY('Chi phí cố định'), productionCostCap: QTY('Ngân sách sản xuất (đ)'), bonusCap: QTY('Trần thưởng') } },
  loans: { title: 'Khoản vay', group: 'Tài chính', sensitive: true, fields: {
    name: FIELD('Bên cho vay'), principal: QTY('Tiền gốc'), annualRate: QTY('Lãi suất năm (0–1)'), date: DAY, dueDate: FIELD('Ngày đến hạn', 'date'), note: FIELD('Ghi chú', 'text', false) } },
  debts: { title: 'Công nợ', group: 'Tài chính', sensitive: true, fields: {
    name: FIELD('Đối tác'), type: CHOICE('Loại', ['phai-thu', 'phai-tra']), amount: QTY('Giá trị gốc'), date: DAY, dueDate: FIELD('Ngày đến hạn', 'date'), note: FIELD('Ghi chú', 'text', false) } },
  cash: { title: 'Sổ quỹ thu – chi', group: 'Tài chính', immutable: true, sensitive: true, fields: {
    date: DAY, direction: CHOICE('Thu / chi', ['thu', 'chi']), account: CHOICE('Tài khoản', ['cash', 'bank']), amount: QTY('Số tiền'), category: CHOICE('Nhóm', ['von-dau', 'thu-no', 'tra-no', 'vay', 'tra-vay', 'lai-vay', 'luong-thuong', 'co-dinh', 'quan-ly', 'marketing', 'khac']),
    linkedId: FIELD('ID công nợ / khoản vay liên kết', 'text', false), note: FIELD('Ghi chú', 'text', false) } },
  assets: { title: 'Tài sản & khấu hao', group: 'Tài chính', sensitive: true, fields: {
    name: FIELD('Tên tài sản'), date: DAY, cost: QTY('Nguyên giá'), salvage: QTY('Giá trị còn lại'), months: FIELD('Thời gian khấu hao (tháng)', 'number', true, { min: 1 }) } },
  orders: { title: 'Đơn đặt hàng', group: 'Khách hàng', fields: {
    date: DAY, shift: FIELD('Ca giao'), storeId: REF('Điểm giao', 'stores'), dishId: REF('Món bán', 'dishes'), quantity: FIELD('Số lượng', 'number', true, { min: 1 }), contact: FIELD('Liên hệ'), customer: FIELD('Tên khách'), status: CHOICE('Trạng thái', ['pending', 'approved', 'rejected']) } }
};
const META = ['recordId', 'version', 'updatedAt', 'updatedBy', 'source', 'deleted', 'reverses'];
const ACTIONS = ['read', 'create', 'update', 'delete', 'approve', 'export'];
const ROUTES = [
  ['dashboard','Tổng quan điều hành','report'], ['opsdashboard','Dashboard vận hành','report'], ['strategy','Chiến lược kinh doanh','report'],
  ['catalog','Danh mục vật tư','materials'], ['stores','Danh mục điểm bán','stores'], ['dishes','Danh mục món bán','dishes'], ['employees','Danh mục nhân viên','employees'], ['discounts','Bảng chiết khấu','discounts'],
  ['inventory','Tồn kho hiện tại','inventory'], ['stockmovements','Nhập / xuất / kiểm kê','stock'], ['stockhistory','Lịch sử kho','stock'], ['reorder','Cảnh báo & bổ sung hàng','inventory'],
  ['kiosk','Thu hồi & ki-ốt','kiosk'],
  ['recipes','Công thức món ăn','recipes'], ['batches','Công thức nhân / sốt','recipes'], ['rice','Công thức cơm chín','recipes'], ['packaging','Định mức bao bì','recipes'], ['cost','Tổng hợp giá vốn','cost'],
  ['production','Kế hoạch & chốt sản xuất','production'], ['demand','Nhu cầu nguyên liệu','demand'], ['audit','Kiểm kê thực tế','counts'], ['variance','Đối chiếu hao hụt','variance'], ['consumption','Tiêu hao & kiểm tra chênh lệch','variance'],
  ['entry','Tổng quan nhập liệu','entry'], ['entry-stock','01 · Kiểm kho','counts'], ['entry-sales','02 · Doanh thu hằng ngày','sales'], ['entry-attendance','03 · Chấm công','attendance'], ['entry-production','04 · Sản xuất – Lỗi – Hủy','production'], ['entry-plans','05 · Kế hoạch & mục tiêu','plans'], ['entry-loans','06 · Khoản vay','loans'], ['entry-debts','07 · Công nợ','debts'], ['entry-cash','08 · Sổ quỹ thu – chi','cash'], ['entry-payroll','09 · Bảng lương tháng','payroll'],
  ['assets','Tài sản & khấu hao','assets'], ['orders','Đơn đặt hàng','orders'], ['admin','Tài khoản & phiên đăng nhập','admin'], ['health','Nhật ký & đồng bộ','health']
];
export { SCHEMA, META, ACTIONS, ROUTES };

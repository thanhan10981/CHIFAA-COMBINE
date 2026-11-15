# Đối chiếu giao diện

Bản HTML gốc: 588.113 byte, 32 menu, nhiều lớp cập nhật V7–V16. Bảng dưới được trích từ source thật; không coi giữ route là tương đương đầy đủ từng màn hình. Bản HTML thay logo giữ nguyên các script gốc để đối chiếu.

| Route | Màn hình | Kết nối mới | Phạm vi |
| --- | --- | --- | --- |
| dashboard | Tổng quan điều hành | report | Báo cáo tạm tính; một số thẻ/cảnh báo/biểu đồ phác thảo chưa chuyển đủ |
| opsdashboard | Dashboard vận hành | report | Báo cáo tạm tính; một số thẻ/cảnh báo/biểu đồ phác thảo chưa chuyển đủ |
| strategy | Chiến lược kinh doanh | report | Báo cáo tạm tính; một số thẻ/cảnh báo/biểu đồ phác thảo chưa chuyển đủ |
| catalog | Danh mục vật tư | materials | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| stores | Danh mục điểm bán | stores | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| dishes | Danh mục món bán | dishes | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| employees | Danh mục nhân viên | employees | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| discounts | Bảng chiết khấu | discounts | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| inventory | Tồn kho hiện tại | inventory | Báo cáo domain tương ứng; cần đối chiếu dữ liệu thật |
| stockmovements | Nhập / xuất / kiểm kê | stock | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| stockhistory | Lịch sử kho | stock | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| reorder | Cảnh báo & bổ sung hàng | inventory | Báo cáo domain tương ứng; cần đối chiếu dữ liệu thật |
| recipes | Công thức món ăn | recipes | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| batches | Công thức nhân / sốt | recipes | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| rice | Công thức cơm chín | recipes | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| packaging | Định mức bao bì | recipes | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| cost | Tổng hợp giá vốn | cost | Báo cáo domain tương ứng; cần đối chiếu dữ liệu thật |
| production | Kế hoạch & chốt sản xuất | production | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| demand | Nhu cầu nguyên liệu | demand | Báo cáo domain tương ứng; cần đối chiếu dữ liệu thật |
| audit | Kiểm kê thực tế | counts | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| variance | Đối chiếu hao hụt | variance | Báo cáo domain tương ứng; cần đối chiếu dữ liệu thật |
| consumption | Tiêu hao & kiểm tra chênh lệch | variance | Báo cáo domain tương ứng; cần đối chiếu dữ liệu thật |
| entry | Tổng quan nhập liệu | entry | Menu nhập liệu chuẩn hóa |
| entry-stock | 01 · Kiểm kho | counts | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| entry-sales | 02 · Doanh thu hằng ngày | sales | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| entry-attendance | 03 · Chấm công | attendance | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| entry-production | 04 · Sản xuất – Lỗi – Hủy | production | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| entry-plans | 05 · Kế hoạch & mục tiêu | plans | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| entry-loans | 06 · Khoản vay | loans | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| entry-debts | 07 · Công nợ | debts | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| entry-cash | 08 · Sổ quỹ thu – chi | cash | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| entry-payroll | 09 · Bảng lương tháng | payroll | Báo cáo domain tương ứng; cần đối chiếu dữ liệu thật |
| assets | Tài sản & khấu hao | assets | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| orders | Đơn đặt hàng | orders | Form/table schema, API/RBAC/version; cần UAT từng biểu mẫu |
| admin | Tài khoản & phiên đăng nhập | admin | Quản trị quyền/phiên; cần Google auth thật |
| health | Nhật ký & đồng bộ | health | Audit metadata/health/journal; cần Google triggers |

Các điểm chưa tương đương hoàn toàn: dashboard điều hành nhiều cảnh báo và biểu đồ chi tiết, luân chuyển hàng trả sang ki-ốt, các bước nhập liệu/chốt ngày theo phác thảo, snapshot giá/chiết khấu tự điền, thanh toán công nợ từ phiếu doanh thu, lãi vay/khấu hao trong báo cáo lợi nhuận, catalog IndexedDB, pagination, lọc nhóm payroll riêng, tra cứu trạng thái đơn khách, mẫu in từng biểu. Không xóa phác thảo hoặc đánh dấu các điểm này DONE khi chưa thực hiện.

# Kiểm kê route, handler và nguồn dữ liệu

Sinh từ ROUTES + routeReadModules; 36 route, 17 bảng nghiệp vụ. Đây là kiểm kê mã, không là bằng chứng nút/chức năng đã UAT. Renderer ở src/client/app.js; Strategy ở strategy-view.js; nghiệp vụ chốt/bảo trì/in ở operations-view.js.

| Route | Nhãn | Handler | Nguồn đọc | RPC / tác động | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| dashboard | Tổng quan điều hành | renderReport | sales, production, attendance, cash, recipes, materials, stock, stores, dishes | bootstrap / list (nguồn được cấp quyền) | PARTIAL; xem matrix |
| opsdashboard | Dashboard vận hành | renderReport | sales, production, attendance, cash, recipes, materials, stock, stores, dishes | bootstrap / list (nguồn được cấp quyền) | PARTIAL; xem matrix |
| strategy | Chiến lược kinh doanh | renderStrategy | sales, production, attendance, cash, recipes, materials, stock, stores, dishes | bootstrap / list (nguồn được cấp quyền) | PARTIAL; xem matrix |
| catalog | Danh mục vật tư | renderRecords | materials | list / mutate / export | PARTIAL; xem matrix |
| stores | Danh mục điểm bán | renderRecords | stores | list / mutate / export | PARTIAL; xem matrix |
| dishes | Danh mục món bán | renderRecords | dishes | list / mutate / export | PARTIAL; xem matrix |
| employees | Danh mục nhân viên | renderRecords | employees | list / mutate / export | PARTIAL; xem matrix |
| discounts | Bảng chiết khấu | renderRecords | discounts, stores, dishes | list / mutate / export | PARTIAL; xem matrix |
| inventory | Tồn kho hiện tại | renderReport | materials, stock | bootstrap / list (nguồn được cấp quyền) | PARTIAL; xem matrix |
| stockmovements | Nhập / xuất / kiểm kê | renderRecords | stock, materials | list / mutate / export | PARTIAL; xem matrix |
| stockhistory | Lịch sử kho | renderRecords | stock, materials | list / mutate / export | PARTIAL; xem matrix |
| reorder | Cảnh báo & bổ sung hàng | renderReport | materials, stock | bootstrap / list (nguồn được cấp quyền) | PARTIAL; xem matrix |
| recipes | Công thức món ăn | renderRecords | recipes, dishes, materials | list / mutate / export | PARTIAL; xem matrix |
| batches | Công thức nhân / sốt | renderRecords | recipes, dishes, materials | list / mutate / export | PARTIAL; xem matrix |
| rice | Công thức cơm chín | renderRecords | recipes, dishes, materials | list / mutate / export | PARTIAL; xem matrix |
| packaging | Định mức bao bì | renderRecords | recipes, dishes, materials | list / mutate / export | PARTIAL; xem matrix |
| cost | Tổng hợp giá vốn | renderReport | materials, recipes, stock, dishes | bootstrap / list (nguồn được cấp quyền) | PARTIAL; xem matrix |
| production | Kế hoạch & chốt sản xuất | renderRecords | production, dishes | list / mutate / export | PARTIAL; xem matrix |
| demand | Nhu cầu nguyên liệu | renderReport | materials, recipes, production, orders, stores, dishes | bootstrap / list (nguồn được cấp quyền) | PARTIAL; xem matrix |
| audit | Kiểm kê thực tế | renderRecords | counts, materials | list / mutate / export | PARTIAL; xem matrix |
| variance | Đối chiếu hao hụt | renderReport | materials, counts, stock, production, recipes, dishes | bootstrap / list (nguồn được cấp quyền) | PARTIAL; xem matrix |
| consumption | Tiêu hao & kiểm tra chênh lệch | renderReport | materials, counts, stock, production, recipes, dishes | bootstrap / list (nguồn được cấp quyền) | PARTIAL; xem matrix |
| entry | Tổng quan nhập liệu | renderEntry | Admin / điều hướng | Không ghi tại menu | PARTIAL; xem matrix |
| entry-stock | 01 · Kiểm kho | renderRecords | counts, materials | list / mutate / export | PARTIAL; xem matrix |
| entry-sales | 02 · Doanh thu hằng ngày | renderRecords | sales, stores, dishes, discounts | list / mutate / export | PARTIAL; xem matrix |
| entry-attendance | 03 · Chấm công | renderRecords | attendance, employees | list / mutate / export | PARTIAL; xem matrix |
| entry-production | 04 · Sản xuất – Lỗi – Hủy | renderRecords | production, dishes | list / mutate / export | PARTIAL; xem matrix |
| entry-plans | 05 · Kế hoạch & mục tiêu | renderRecords | plans | list / mutate / export | PARTIAL; xem matrix |
| entry-loans | 06 · Khoản vay | renderRecords | loans | list / mutate / export | PARTIAL; xem matrix |
| entry-debts | 07 · Công nợ | renderRecords | debts | list / mutate / export | PARTIAL; xem matrix |
| entry-cash | 08 · Sổ quỹ thu – chi | renderRecords | cash | list / mutate / export | PARTIAL; xem matrix |
| entry-payroll | 09 · Bảng lương tháng | renderReport | attendance, employees | bootstrap / list (nguồn được cấp quyền) | PARTIAL; xem matrix |
| assets | Tài sản & khấu hao | renderRecords | assets | list / mutate / export | PARTIAL; xem matrix |
| orders | Đơn đặt hàng | renderRecords | orders, stores, dishes | list / mutate / export | PARTIAL; xem matrix |
| admin | Tài khoản & phiên đăng nhập | renderAdmin | Admin / điều hướng | admin | PARTIAL; xem matrix |
| health | Nhật ký & đồng bộ | renderHealth | Admin / điều hướng | health / workflowStatus / maintenance / workflow | PARTIAL; xem matrix |

Nút dùng chung: Thêm/Sửa/Xóa/Đảo/Duyệt → mutate; Lưu tài khoản/Thu hồi phiên → admin; Đồng bộ → bootstrap(force); CSV → export; In → DOM/window.print; chốt tài chính/khóa kỳ → workflow; backup/restore/import/lịch → maintenance. Chỉ báo thành công sau ACK. Portal: catalog/order/status qua API riêng, không có internal data preload.

Thiếu chức năng chuyên biệt: returnId/nhận/bán kiosk, recipe lines chuẩn hóa, bốn mode nhập liệu, modal conflict diff, draft theo user/date/module, settings đầy đủ và alert center. Không gán DONE vì chỉ có route.

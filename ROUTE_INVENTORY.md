# Kiểm kê route, handler và nguồn dữ liệu

Sinh từ ROUTES + routeReadModules; 37 route, 17 bảng nghiệp vụ. Đây là kiểm kê mã, không là bằng chứng nút/chức năng đã UAT. Renderer ở src/client/app.js; Strategy ở strategy-view.js; nghiệp vụ chốt/bảo trì/in ở operations-view.js.

| Route | Nhãn | Handler | Nguồn đọc | RPC / tác động | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| dashboard | Tổng quan điều hành | renderDashboard | sales, production, attendance, cash, recipes, materials, stock, stores, dishes | summary / settlements | PARTIAL; xem matrix |
| opsdashboard | Dashboard vận hành | renderDashboard | sales, production, attendance, cash, recipes, materials, stock, stores, dishes | summary / settlements | PARTIAL; xem matrix |
| strategy | Chiến lược kinh doanh | renderStrategyRemote | sales, production, attendance, cash, recipes, materials, stock, stores, dishes | strategySummary | PARTIAL; xem matrix |
| catalog | Danh mục vật tư | renderRecords | materials | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| stores | Danh mục điểm bán | renderRecords | stores | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| dishes | Danh mục món bán | renderRecords | dishes | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| employees | Danh mục nhân viên | renderRecords | employees | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| discounts | Bảng chiết khấu | renderRecords | discounts, stores, dishes | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| inventory | Tồn kho hiện tại | renderPeriodSummary | materials, stock | periodSummary | PARTIAL; xem matrix |
| stockmovements | Nhập / xuất / kiểm kê | renderRecords | stock, materials | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| stockhistory | Lịch sử kho | renderRecords | stock, materials | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| reorder | Cảnh báo & bổ sung hàng | renderPeriodSummary | materials, stock | periodSummary | PARTIAL; xem matrix |
| kiosk | Thu hồi & ki-ốt | renderKiosk | sales, stores, dishes | kioskReport / kiosk | PARTIAL; xem matrix |
| recipes | Công thức món ăn | renderRecords | recipes, dishes, materials | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| batches | Công thức nhân / sốt | renderRecords | recipes, dishes, materials | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| rice | Công thức cơm chín | renderRecords | recipes, dishes, materials | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| packaging | Định mức bao bì | renderRecords | recipes, dishes, materials | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| cost | Tổng hợp giá vốn | renderPeriodSummary | materials, recipes, stock, dishes | periodSummary | PARTIAL; xem matrix |
| production | Kế hoạch & chốt sản xuất | renderRecords | production, dishes | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| demand | Nhu cầu nguyên liệu | renderPeriodSummary | materials, recipes, production, orders, stores, dishes | periodSummary | PARTIAL; xem matrix |
| audit | Kiểm kê thực tế | renderRecords | counts, materials | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| variance | Đối chiếu hao hụt | renderPeriodSummary | materials, counts, stock, production, recipes, dishes | periodSummary | PARTIAL; xem matrix |
| consumption | Tiêu hao & kiểm tra chênh lệch | renderPeriodSummary | materials, counts, stock, production, recipes, dishes | periodSummary | PARTIAL; xem matrix |
| entry | Tổng quan nhập liệu | renderEntry | Admin / điều hướng | Không ghi tại menu | PARTIAL; xem matrix |
| entry-stock | 01 · Kiểm kho | renderRecords | counts, materials | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| entry-sales | 02 · Doanh thu hằng ngày | renderRecords | sales, stores, dishes, discounts | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| entry-attendance | 03 · Chấm công | renderRecords | attendance, employees | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| entry-production | 04 · Sản xuất – Lỗi – Hủy | renderRecords | production, dishes | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| entry-plans | 05 · Kế hoạch & mục tiêu | renderRecords | plans | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| entry-loans | 06 · Khoản vay | renderRecords | loans | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| entry-debts | 07 · Công nợ | renderRecords | debts | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| entry-cash | 08 · Sổ quỹ thu – chi | renderRecords | cash | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| entry-payroll | 09 · Bảng lương tháng | renderPeriodSummary | attendance, employees | periodSummary | PARTIAL; xem matrix |
| assets | Tài sản & khấu hao | renderRecords | assets | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| orders | Đơn đặt hàng | renderRecords | orders, stores, dishes | list / lookup / record / mutate / export; entry (immutable), order link (orders) | PARTIAL; xem matrix |
| admin | Tài khoản & phiên đăng nhập | renderAdmin | Admin / điều hướng | admin | PARTIAL; xem matrix |
| health | Nhật ký & đồng bộ | renderHealth | Admin / điều hướng | health / workflowStatus / maintenance / workflow | PARTIAL; xem matrix |

Nút dùng chung: Thêm/Sửa/Xóa/Đảo/Duyệt → mutate; Lưu tài khoản/Thu hồi phiên → admin; Đồng bộ → bootstrap(force); XLSX → export; In → DOM/window.print; chốt tài chính/khóa kỳ → workflow; backup/restore/import/lịch → maintenance. Chỉ báo thành công sau ACK. Portal: catalog/order/status qua API riêng, không có internal data preload.

Thiếu chức năng chuyên biệt: database recipe-line migration, private drafts and policy settings; Google UAT remains pending. Kiosk, checked entry modes, preview diffs and security alerts have local implementations/tests. Không gán DONE vì chỉ có route.

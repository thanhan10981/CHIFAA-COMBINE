# Theo dõi công việc

Danh sách T00–T19 dưới đây được lập lại từ 3 prompt vì người dùng chưa cung cấp TASKS.md gốc. DONE_LOCAL chỉ nghĩa đã viết/kiểm tra tại máy; chưa thay cho nghiệm thu Google hoặc khách hàng.

| Task | Nội dung | Trạng thái |
| --- | --- | --- |
| T00 | Giữ đầu vào, kiểm kê 32 menu, mapping | DONE_LOCAL |
| T01 | Repo/module/build/check/test, logo | DONE_LOCAL; visual browser pending |
| T02 | Schema/workbook/setup idempotent/protection | LOCAL; Google/import pending |
| T03 | Import preview/apply/rollback | LOCAL; Excel gốc chưa có |
| T04 | Google auth/RBAC/admin session | LOCAL; OAuth, verifier deployment pending |
| T05 | Danh mục/quy đổi/chiết khấu | LOCAL; dữ liệu thật pending |
| T06 | Công thức nhiều cấp/giá theo ngày | LOCAL; đối chiếu legacy pending |
| T07 | Kho/sổ giao dịch/bút toán đảo | LOCAL; opening stock, Google pending |
| T08 | Sản xuất chính/thêm/hủy/kế hoạch | LOCAL; phiếu ki-ốt chi tiết pending |
| T09 | Hàng trả/doanh thu/đối soát | PARTIAL; mô hình ki-ốt tự động & quy tắc khách pending |
| T10 | Ca qua đêm/phụ cấp/lương theo nhóm | LOCAL; đối chiếu mẫu và dữ liệu thật pending |
| T11 | Sổ quỹ/nợ/vay/tài sản | PARTIAL; phân bổ khấu hao/lãi, liên kết thu nợ từ sales pending |
| T12 | Dashboard/KPI/cùng thứ hai tuần | PARTIAL; bộ cảnh báo/biểu đồ phác thảo chưa tương đương hoàn toàn |
| T13 | Chiến lược/hòa vốn/thưởng trong trần | LOCAL CORE; kịch bản/chi tiết phác thảo cần đối chiếu |
| T14 | Cổng khách riêng/thư mời/duyệt | LOCAL; Google & customer status view pending |
| T15 | Đồng bộ edit/poll/version/conflict | LOCAL; Google trigger & multi-cell edits pending |
| T16 | Cache/UX/performance/responsive | PARTIAL; RAM-only, chưa IndexedDB/preload catalog/p95 |
| T17 | Logs/health/backup/restore | LOCAL; restore thật & retention pending |
| T18 | Browser/mobile/security/load/UAT | PENDING; 66 local tests, chưa Google/browser |
| T19 | Deploy/bàn giao tài khoản khách | BLOCKED_EXTERNAL; Google chưa kết nối, khách chưa nhận bàn giao |

Ưu tiên tiếp: import workbook mới vào Drive khi được kết nối, nhận Gmail admin, tạo Google project/OAuth dev; chạy bộ nghiệm thu. Tiếp tục các mục PARTIAL theo dữ liệu và quy tắc khách, không đánh dấu toàn bộ đã hoàn thành.

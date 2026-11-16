# Theo dõi công việc

Danh sách T00–T19 dưới đây được lập lại từ 3 prompt vì người dùng chưa cung cấp TASKS.md gốc. DONE_LOCAL chỉ nghĩa đã viết/kiểm tra tại máy; chưa thay cho nghiệm thu Google hoặc khách hàng.

| Task | Nội dung | Trạng thái |
| --- | --- | --- |
| T00 | Giữ đầu vào, kiểm kê 32 menu, mapping | DONE_LOCAL |
| T01 | Repo/module/build/check/test, logo | DONE_LOCAL; đã review Chrome cục bộ desktop/màn hình nhỏ |
| T02 | Schema/workbook/setup idempotent/protection | LOCAL; Google/import pending |
| T03 | Import preview/apply/rollback | IMPLEMENTED_DEV_CODE: CSV/JSON, mẫu CSV, xem trước ràng buộc trạng thái nguồn, chống trùng, liên kết kho, journal chunk/rollback; chưa nhập dữ liệu Google thật |
| T04 | OAuth Apps Script/RBAC/admin session | DEPLOYED_DEV v21; Admin workspace đã được người dùng xác nhận; hai Google accounts thật/ACL chưa nghiệm thu |
| T05 | Danh mục/quy đổi/chiết khấu | LOCAL; dữ liệu thật pending |
| T06 | Công thức nhiều cấp/giá theo ngày | Phiếu sản xuất liên kết có snapshot định lượng/giá vốn; legacy chưa snapshot cần đối chiếu |
| T07 | Kho/sổ giao dịch/bút toán đảo | Đã nối sản xuất xuất kho/kiểm kê điều chỉnh, đảo theo lô, khóa kỳ; tồn đầu và Google UAT còn chờ |
| T08 | Sản xuất chính/thêm/hủy/kế hoạch | Phiếu mới tạo hiệu ứng kho tự động, thiếu tồn/giá không ghi; giữ dữ liệu cũ, không tự backfill |
| T09 | Hàng trả/doanh thu/đối soát | PARTIAL; mô hình ki-ốt tự động & quy tắc khách pending |
| T10 | Ca qua đêm/phụ cấp/lương theo nhóm | Đã chặn giao ca kể cả qua đêm, chốt lương/thưởng tạo chi, snapshot/in lại/hoàn tác; Google UAT còn chờ |
| T11 | Sổ quỹ/nợ/vay/tài sản | Đã phân bổ nợ theo khoản/thu nợ cũ, chặn trả vượt, tự nhập tiền lãi và lập chi theo kỳ theo yêu cầu, summary theo quyền; khấu hao/tồn thành phẩm trong kết quả còn chờ quy tắc |
| T12 | Dashboard/KPI/cùng thứ hai tuần | PARTIAL; bộ cảnh báo/biểu đồ phác thảo chưa tương đương hoàn toàn |
| T13 | Chiến lược/hòa vốn/thưởng trong trần | Chiến lược đã làm lại theo phác thảo: 8 khối phân tích, bảng chi tiết, bộ lọc kỳ và mô phỏng 30 ngày; 127 test đạt. Xem docs/CHIEN_LUOC.md; Google UAT và quy tắc kế toán đầy đủ còn chờ nghiệm thu. |
| T14 | Cổng khách riêng/thư mời/duyệt | Đã có tạo workbook riêng/thư mời/đồng bộ lịch/đẩy trạng thái/khách tra cứu theo thư mời; cần URL dự án Portal và cấu hình Google thật |
| T15 | Đồng bộ edit/poll/version/conflict | LOCAL; Google trigger & multi-cell edits pending |
| T16 | Cache/UX/performance/responsive | PARTIAL; có server cache theo quyền, loading và IndexedDB cho khóa phiên; dữ liệu nghiệp vụ chỉ RAM; p95 Google chưa đo |
| T17 | Logs/health/backup/restore | Có màn hình khóa kỳ, cấu hình/lịch, backup riêng tư/restore bản mới/import/recovery; Google UAT và retention còn chờ |
| T18 | Browser/mobile/security/load/UAT | 164 kiểm thử local đạt, 5.101 dòng, rollback/chunk, Portal hai workbook mock, quyền ghi-only, desktop/390px/mẫu in; Google/hai tài khoản thật vẫn chờ |
| T19 | Deploy/bàn giao tài khoản khách | PARTIAL; hai link DEV đã triển khai v21; chưa nghiệm thu Production/bàn giao khách |

Đợt mới đã xử lý L01/L02/L04/L05 và snapshot cho phiếu sản xuất mới liên kết (L03 legacy không thể tự suy ra quá khứ). Hướng dẫn 7 nhóm tại `docs/NGHIEP_VU_LIEN_KET.md`. Tiếp theo khởi tạo trên DEV, cấu hình Portal/backup thật, đối chiếu dữ liệu cũ và nghiệm thu hai Google accounts/ACL/trigger. Luân chuyển hàng trả, phân bổ tồn/khấu hao và mọi quy tắc kế toán chưa duyệt vẫn không được đánh dấu nghiệm thu theo số test.
## Lộ trình chính thức từ bộ tài liệu mới — 16/11/2026

Các ID T00–T19 ở bảng cũ phía trên là lịch sử, **không trùng nghĩa** với T00–T25 trong docs/requirements/07_TASKS_LO_TRINH.md. Từ đây dùng bộ mới và matrix78REQ.

| Task mới | Trạng thái thực tế |
| --- | --- |
| T00 audit/matrix | LOCAL_AUDIT_DONE:78REQ/36route/93acceptance, baseline166pass; Google inventory/legacy blocked |
| T01 auth feasibility | CODE_MOCK_PARTIAL / BLOCKED_GOOGLE_UAT: chưa hai Gmail và ACL thật |
| T02–T06 foundation/schema/journal | PARTIAL: code/test có; chưa normalized lines, migration versioned/clean-checkout checkpoint đầy đủ |
| T07 two-way sync | PARTIAL: hash/versions có; thiếu quarantine/onChange/cursor và latency Google |
| T08–T12 catalogs/recipes/production/stock | PARTIAL: xem matrix; thiếu effective master/recipe lines/source policies |
| T13 returns/kiosk | MISSING chuỗi returnId→received→sale, không coi sales.returned là ledger kiosk |
| T14 revenue/settlement | NEXT_G02: D01/D02/D03 đã chốt, cần shared formula/tests trước nghiệm thu |
| T15 entry modes | PARTIAL/MISSING: chưa acceptance100→130→90, lý do backfill và draft/diff |
| T16–T18 HR/finance/targets | PARTIAL: policy allowance/expense, labor cap cũ còn trừ cogs phải sửa |
| T19–T21 dashboards/CEO/Strategy | PARTIAL: shared metrics cần G02, thiếu đầy đủ KPI/sources/alerts |
| T22 Portal | CODE_MOCK_PARTIAL / GOOGLE_CONFIG_PENDING |
| T23 performance/UI | PARTIAL: chưa Google P50/P95, 10users, visual theme mới |
| T24 legacy migration | BLOCKED_SOURCE: thiếu hai workbook source, không import phỏng đoán |
| T25 release | BLOCKED_GATES: authGoogle/source/accounting/UAT, không production-ready |

### Tiến độ G02 sau xác nhận D01/D02/D03

T14/T18 core formula đã LOCAL_TESTED: net trước chi phí, hỗ trợ thu hồi riêng, phần điểm chịu phải trả; Food cost32,2%/SX15% cùng mẫu số; sửa labor headroom không trừ COGS và không tính khi thiếu nguồn/không đạt kế hoạch. 170test đạt, syntax49/build đạt. T00 checkpoint ba0ad6c. Chưa đủ return/kiosk/AR/COGS allocation/giảm trừ khác và Google UAT nên không đổi toàn task thành DONE. Xem docs/ACCOUNTING_POLICY.md.

G02 đã DEPLOYED_DEV22 sau readback4file; source3896256 được xuất archive/build/test170đạt. Chưa GoogleGate1/legacy/UAT, không setup lại vì không đổi header. Checkpoint docs/checkpoints/REQUIREMENTS_2026-11-16.md.


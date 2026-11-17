# Bằng chứng chức năng hiện tại

Chưa có nhóm nào được nghiệm thu trên Supabase cloud. Người dùng chưa tạo DEV. Schema hoặc route rỗng không được coi là nghiệp vụ đã hoàn thành.

| Nhóm | Đã có | Còn thiếu |
|---|---|---|
| Auth | Next SSR/proxy/getUser, profile disabled mặc định, DB permissions, callback cố định | Google OAuth, expiry/revoke, một phiên Admin và E2E cloud |
| Danh mục | 7 form, CRUD RPC, dropdown, tìm/phân trang/cache, form tạo quy đổi/giá có cơ sở và bằng chứng, quyền approve riêng | Chỉnh draft giá/quy đổi, giá theo điểm và pay rates; tìm lookup quá 200 dòng |
| Công thức | Editor thành phần, draft/publish/copy revision, BOM/cost theo ngày, cycle/yield/unit/price, bảo vệ lịch sử | Lịch sử/so sánh sâu, bao bì chuyên biệt, lookup lớn và browser/cloud UAT |
| Sản xuất | RPC chính + thêm, ràng buộc lỗi, snapshot/xuất kho atomic; UI ghi một món | Plan editor, nhiều dòng, bổ sung/điều chỉnh/đảo và kho thành phẩm |
| Kho | Sổ chuyển động, tồn, nhập/xuất UI, count adjustment RPC, khóa kỳ | Count UI, chuyển/đảo phiếu, phân trang tồn và định giá |
| Portal | Giá riêng, submit/idempotency/capacity/cutoff/rate, 50 đơn gần nhất, trạng thái/realtime source | Hosted test, lịch sử đầy đủ, cancel/OTP và quản trị giá |
| Duyệt đơn | UI/RPC/version/audit, link kế hoạch có sẵn không cộng trùng | Scheduling UI, tạo/merge kế hoạch |
| Giao/thu hồi/ki-ốt | Schema chuẩn hóa | Posting RPC, kho sản phẩm, lifecycle và UI; chính sách chưa chốt |
| Doanh thu | Schema, truy vấn chứng từ posted, dữ liệu thiếu trả null | Sales posting, adjustments/reversals/UI; chưa ghi sổ theo giả định |
| Thu nợ/quỹ | Receipt → allocation + cash atomic, chặn trả dư, không tăng doanh thu; SQL tests | UI, số đầu kỳ và hoàn tác |
| Vay/chi phí | Lãi nhập tay, chặn trả gốc dư, expense + cash RPC; SQL tests | UI, giải ngân và kiểm soát số dư |
| Nhân sự | Ca đêm 8/9/10 giờ, overlap guard, snapshot; lương tách RLS riêng | UI, chế độ nhập liệu, allowance policy và payroll posting/cash |
| Kỳ | Close/reopen RPC, lý do/audit/locks | UI và kiểm thử race nhiều kết nối |
| Dashboard | 4 KPI tổng hợp, lọc ngày, null/completeness, cache theo user | Charts/drilldown/presets/snapshot refresh/report/strategy/targets |
| Import | Audit/mapping, staging CLI UUID ổn định, không tự apply | Đọc đầy đủ lịch sử XLSX, staging DB/approve/import/reconcile/replay |
| Offline | Public shell SW, trang offline, IndexedDB nháp với whitelist, không auto sync | Editor integration, khôi phục xung đột và browser E2E |
| Storage/Realtime | Private bucket policy, subscription đơn theo điểm bán | Hosted policies, signed URL, Edge invite/rate UAT |
| Triển khai | CI source, 30 tests, TS/lint/build, HTTP local, SQL benchmark | Supabase DEV/E2E, 10 concurrent/p95 network, backup/restore, preview |

Không nhập dữ liệu thật hoặc deploy public. Mã cũ và workbook chỉ là tư liệu; root npm scripts chạy Next.js.

# Bằng chứng chức năng hiện tại

Cập nhật chuyển dự án cũ: [LEGACY_PARITY.md](LEGACY_PARITY.md). Menu runtime 7 nhóm/37 mục; Ki-ốt có UI/RPC thật, thêm nhật ký và cấu hình quỹ. Migrations 021/022 gồm Ki-ốt và sửa các lỗi audit, **chưa được công cụ áp lên cloud**. Bộ kiểm tra hiện có 47 tests; kiểm tra layout 41 route và 6 màn mobile trên fixture.

Kiểm tra mới: [Báo cáo 17/11/2026](SYSTEM_AUDIT_2026-11-17.md). 37 tests hiện có đạt, nhưng kiểm tra bổ sung xác nhận lỗi null/version và gắn đơn vượt kế hoạch; chưa đủ điều kiện nghiệm thu.

Giao diện hiện có bố cục tham chiếu cho 32 mục điều hướng; bố cục tĩnh có khóa thao tác không được tính là workflow hoàn tất. Xem [đối chiếu giao diện](UI_REFERENCE.md).

Chưa có nhóm nghiệp vụ nào được nghiệm thu đầy đủ trên Supabase cloud. Người dùng đã chạy schema và deploy Vercel; Google provider bật, trang login và callback online phản hồi. Chưa xác nhận trạng thái tài khoản Admin trên cloud. Schema hoặc route rỗng không được coi là nghiệp vụ đã hoàn thành.

| Nhóm | Đã có | Còn thiếu |
|---|---|---|
| Auth | Next SSR/proxy/getUser, profile disabled mặc định, DB permissions, callback cố định; Google bật trên cloud, script cấp Admin đầu tiên có kiểm tra/audit | Chạy lệnh Admin trên DEV, UAT OAuth/expiry/revoke, một phiên Admin và E2E cloud |
| Danh mục | 8 form gồm tài khoản quỹ/ngân hàng, CRUD RPC, dropdown, tìm/phân trang/cache, form tạo quy đổi/giá có cơ sở và bằng chứng, quyền approve riêng | Cài 022 cho quỹ; chỉnh draft giá/quy đổi, giá theo điểm và pay rates; tìm lookup quá 200 dòng |
| Công thức | Editor thành phần, draft/publish/copy revision, BOM/cost theo ngày, cycle/yield/unit/price, bảo vệ lịch sử | Lịch sử/so sánh sâu, bao bì chuyên biệt, lookup lớn và browser/cloud UAT |
| Sản xuất | RPC chính + thêm, ràng buộc lỗi, snapshot/xuất kho atomic; UI ghi một món | Plan editor, nhiều dòng, bổ sung/điều chỉnh/đảo và kho thành phẩm |
| Kho | Sổ chuyển động, tồn, nhập/xuất UI; kiểm kê UI 50 dòng/trang + snapshot/version, adjustment atomic, khóa kỳ | Browser/cloud UAT, chuyển/đảo phiếu, phân trang màn hình tồn chung và định giá |
| Portal | Giá riêng, submit/idempotency/capacity/cutoff/rate, 50 đơn gần nhất, trạng thái/realtime source | Hosted test, lịch sử đầy đủ, cancel/OTP và quản trị giá |
| Duyệt đơn | UI/RPC/version/audit, link kế hoạch có sẵn không cộng trùng | Scheduling UI, tạo/merge kế hoạch |
| Giao/thu hồi nguồn | Schema chuẩn hóa | Posting/UI đầy đủ cho giao hàng và doanh thu có thu hồi; chính sách chưa chốt |
| Ki-ốt | 021: duyệt/thực nhận/từ chối/bán/hoàn tác, giới hạn tồn, tiền/quỹ/công nợ atomic, nguồn/version/period guards và UI; giá vốn chưa xác định giữ null | Cài 021/022 và UAT cloud; UI nguồn doanh thu; định giá theo lô/hạn dùng |
| Doanh thu | Schema, truy vấn chứng từ posted, dữ liệu thiếu trả null | Sales posting, adjustments/reversals/UI; chưa ghi sổ theo giả định |
| Thu nợ/quỹ | Receipt → allocation + cash atomic, chặn trả dư, không tăng doanh thu; SQL tests | UI, số đầu kỳ và hoàn tác |
| Vay/chi phí | Lãi nhập tay, chặn trả gốc dư, expense + cash RPC; SQL tests | UI, giải ngân và kiểm soát số dư |
| Nhân sự | Ca đêm 8/9/10 giờ, overlap guard, snapshot; lương tách RLS riêng | UI, chế độ nhập liệu, allowance policy và payroll posting/cash |
| Kỳ | Close/reopen RPC, lý do/audit/locks | UI và kiểm thử race nhiều kết nối |
| Dashboard | 4 KPI tổng hợp, lọc ngày, null/completeness, cache theo user | Charts/drilldown/presets/snapshot refresh/report/strategy/targets |
| Import | Audit/mapping, staging CLI UUID ổn định, không tự apply | Đọc đầy đủ lịch sử XLSX, staging DB/approve/import/reconcile/replay |
| Offline | Public shell SW, trang offline, IndexedDB nháp với whitelist, không auto sync | Editor integration, khôi phục xung đột và browser E2E |
| Storage/Realtime | Private bucket policy, subscription đơn theo điểm bán | Hosted policies, signed URL, Edge invite/rate UAT |
| Triển khai | CI source, 47 tests, TS/lint/build, HTTP local/online, SQL benchmark, Vercel Ready, SQL Editor bootstrap, Google provider bật | Cài bản cập nhật 021/022, Admin và E2E nghiệp vụ, 10 concurrent/p95 network, backup/restore |

Không nhập dữ liệu thật hoặc deploy public. Mã cũ và workbook chỉ là tư liệu; root npm scripts chạy Next.js.

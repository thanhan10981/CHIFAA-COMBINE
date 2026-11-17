# Đối chiếu giao diện

Bản HTML gốc: 588.113 byte, 32 menu, nhiều lớp cập nhật V7–V16. Bảng dưới được trích từ source thật; không coi giữ route là tương đương đầy đủ từng màn hình. Bản HTML thay logo giữ nguyên các script gốc để đối chiếu.

| Route | Màn hình | Kết nối mới | Phạm vi |
| --- | --- | --- | --- |
| dashboard | Tổng quan điều hành | report | Báo cáo tạm tính; một số cảnh báo phác thảo cần đối chiếu thêm |
| opsdashboard | Dashboard vận hành | report | Báo cáo tạm tính; một số cảnh báo phác thảo cần đối chiếu thêm |
| strategy | Chiến lược kinh doanh | report | Màn hình riêng theo phác thảo, 8 khối phân tích, bộ lọc kỳ, mô phỏng và in báo cáo |
| catalog | Danh mục vật tư | materials | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| stores | Danh mục điểm bán | stores | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| dishes | Danh mục món bán | dishes | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| employees | Danh mục nhân viên | employees | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| discounts | Bảng chiết khấu | discounts | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| inventory | Tồn kho hiện tại | inventory | Báo cáo domain; tải đủ chunk trước khi tính; cần Google UAT |
| stockmovements | Nhập / xuất / kiểm kê | stock | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| stockhistory | Lịch sử kho | stock | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| reorder | Cảnh báo & bổ sung hàng | inventory | Báo cáo domain; tải đủ chunk trước khi tính; cần Google UAT |
| recipes | Công thức món ăn | recipes | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| batches | Công thức nhân / sốt | recipes | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| rice | Công thức cơm chín | recipes | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| packaging | Định mức bao bì | recipes | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| cost | Tổng hợp giá vốn | cost | Báo cáo domain; tải đủ chunk trước khi tính; cần Google UAT |
| production | Kế hoạch & chốt sản xuất | production | Tạo phiếu + tự xuất kho + snapshot giá vốn; đảo theo lô |
| demand | Nhu cầu nguyên liệu | demand | Báo cáo domain; tải đủ chunk trước khi tính; cần Google UAT |
| audit | Kiểm kê thực tế | counts | Kiểm kê tự điều chỉnh tồn; chống sửa hồi tố qua kiểm kê |
| variance | Đối chiếu hao hụt | variance | Báo cáo domain; tải đủ chunk trước khi tính; cần Google UAT |
| consumption | Tiêu hao & kiểm tra chênh lệch | variance | Báo cáo domain; tải đủ chunk trước khi tính; cần Google UAT |
| entry | Tổng quan nhập liệu | entry | Menu nhập liệu chuẩn hóa |
| entry-stock | 01 · Kiểm kho | counts | Kiểm kê tự điều chỉnh tồn; chống sửa hồi tố qua kiểm kê |
| entry-sales | 02 · Doanh thu hằng ngày | sales | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| entry-attendance | 03 · Chấm công | attendance | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| entry-production | 04 · Sản xuất – Lỗi – Hủy | production | Tạo phiếu + tự xuất kho + snapshot giá vốn; đảo theo lô |
| entry-plans | 05 · Kế hoạch & mục tiêu | plans | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| entry-loans | 06 · Khoản vay | loans | So du, lai tu nhap theo ky, xem truoc/lap chi, chong trung ky |
| entry-debts | 07 · Công nợ | debts | Phân bổ từng khoản, liên kết thu nợ cũ không ghi quỹ hai lần |
| entry-cash | 08 · Sổ quỹ thu – chi | cash | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| entry-payroll | 09 · Bảng lương tháng | payroll | Xem trước/chốt lương–thưởng → phiếu chi; mở/in lại snapshot |
| assets | Tài sản & khấu hao | assets | Form/table, API/RBAC/version; phân trang server, CSV đủ trang, mẫu in |
| orders | Đơn đặt hàng | orders | Duyệt/từ chối; đồng bộ Portal theo lịch, khách tra cứu đúng thư mời |
| admin | Tài khoản & phiên đăng nhập | admin | Tick quyền sidebar, phiếu liên kết ghi-only, một phiên Admin |
| health | Nhật ký & đồng bộ | health | Khóa/mở kỳ, cấu hình/lịch, backup/restore/import, Portal, hoàn tác lô, audit |

Nghiệp vụ liên kết: [NGHIEP_VU_LIEN_KET.md](docs/NGHIEP_VU_LIEN_KET.md). Khởi tạo thêm bảng hệ thống từ màn hình Admin, giữ header nghiệp vụ cũ. Các luồng đã có mã và kiểm thử local, chưa thay cho Google UAT, cấu hình Portal riêng, lịch chạy thật hoặc số liệu kế toán được duyệt. Còn đối chiếu: độ đầy đủ dashboard, luân chuyển/hủy/tái bán hàng trả, phân bổ tồn thành phẩm/khấu hao, dữ liệu lịch sử chưa có snapshot, retention backup. Không coi giữ đủ route là nghiệm thu đầy đủ.

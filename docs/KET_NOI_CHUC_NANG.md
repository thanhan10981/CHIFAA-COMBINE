# Rà soát kết nối chức năng — 16/11/2026

Cập nhật sau yêu cầu xử lý 7 nhóm: các luồng đã được bổ sung mã/UI và kiểm thử; hướng dẫn hiện hành tại [NGHIEP_VU_LIEN_KET.md](NGHIEP_VU_LIEN_KET.md). Phần bảng bên dưới là kết quả rà soát **trước khi sửa**, không dùng làm trạng thái mới nhất. Hiện còn khởi tạo/cấu hình và UAT Google thật, dữ liệu lịch sử chưa snapshot, quy tắc khấu hao/tồn thành phẩm và các nghiệp vụ ngoài 7 nhóm đã chọn.

Phạm vi: mã DEV v15 và thay đổi toast tiếp theo; 36 mục sidebar, các sự kiện giao diện, RPC và hàm bảo trì. Chạy lại `node scripts/audit-logic.mjs` bằng mock cục bộ; không đọc dữ liệu khách, sửa Sheet hoặc suy đoán trigger thật đã được cài. Việc có endpoint và kiểm thử local **không xác nhận** cấu hình/ACL/trigger trên Google đã nghiệm thu.

## Các phần chưa nối hoặc mới nối một phần

| Phần | Đã có | Còn thiếu / chưa kết nối | Nguồn xác nhận |
| --- | --- | --- | --- |
| Sao lưu, khôi phục, nhập dữ liệu cũ | Backend `backup_`, `restoreToNewWorkbook_`, `previewImport_`, `applyImport_`, `recoverPrepared_` | Chưa có nút/màn hình vận hành các hàm này trong app, không có RPC gọi trực tiếp. Backup chỉ được cài lịch nếu có `BACKUP_FOLDER_ID` và chạy trình cài trigger; chưa kiểm tra lịch thực tế. | `src/server/operations.js`, danh sách RPC `src/server/api.js` |
| Đặt hàng Portal | Thực đơn, thư mời, gửi đơn pending; duyệt/từ chối nội bộ | Publish thực đơn và import đơn giữa workbook là hàm thủ công, chưa nối lịch/UI; chưa ghi trạng thái duyệt ngược lại Portal hoặc cho khách tra cứu. Đây không phải luồng tự đồng bộ hoàn chỉnh. | `publishCatalog_`, `importPortalOrders_`, `installTriggers_`, `src/client/portal.js` |
| Sản xuất → kho | Phiếu sản xuất, phiếu kho, tính nhu cầu và tồn | Lưu sản xuất chưa tự xuất nguyên liệu; kiểm kê chưa tự tạo điều chỉnh tồn. Mutation hiện chỉ ghi hiệu ứng bảng tương ứng. Cần cơ chế đa bảng chống ghi trùng khi chốt/đảo. | `mutate_`, `inventory`, `variance` |
| Chốt ngày/kỳ, đơn sản xuất | Nhập và đảo phiếu | Chưa có khóa kỳ, chốt/mở lại ngày hoặc workflow đơn sản xuất hoàn chỉnh. | Schema, routes và mutation |
| Hàng trả/ki-ốt | Giao/bán/trả và hỗ trợ thu hồi trong doanh thu | Chưa có phiếu điều chuyển, nhận lại, xác nhận hủy, tái bán và chống đếm trùng. Trang Chiến lược đã ghi đúng là “trả về”, không giả định “hủy”. | Schema sales, strategy |
| Thu nợ/vay → sổ quỹ | Phiếu quỹ liên kết khoản nợ/vay; tính gốc còn lại | `oldDebtPaid` trên doanh thu chưa phân bổ vào từng công nợ; chưa đối chiếu chống thu hai lần. Lãi suất vay chỉ lưu, chưa tính lịch lãi/gốc–lãi; chưa có quy tắc thu/trả vượt dư. | `finance`, `salesMetrics`, kiểm tra cash |
| Tài sản/khoản vay/công nợ với quyền giới hạn | Bảng gốc và hàm tính tổng hợp | Tổng hợp UI bị chặn nếu không được đọc cash, trong khi tick trang chỉ cấp bảng tương ứng. Riêng khấu hao không cần cash; cần sửa điều kiện, không tự mở rộng quyền sổ quỹ. | `renderRecords`, `routeReadModules` (L05) |
| Lương/thưởng → chi tiền | Tính ca, phụ cấp, ứng/trừ và ngân sách thưởng trong trần | Chưa có chốt lương tháng, phiếu lương/mẫu in hoặc tự tạo chi lương/thưởng. | `payroll`, `targets`, routes |
| Kế hoạch → báo cáo | Mục tiêu doanh thu/sản lượng/trần thưởng có tổng hợp | `plans.fixedCost` chưa dùng trong báo cáo tự động. Chiến lược v15 đã có 8 khối và mô phỏng nhưng chưa ghi kế hoạch từ kịch bản; mô phỏng là chỉ đọc. Dashboard khác chưa đủ widget phác thảo. | `targets`, `renderReport`, `strategy-view.js` |
| Dữ liệu lớn/in biểu | Bảng/tìm kiếm/lọc ngày/CSV, CSS print | Chưa có phân trang server; vượt 5.000 dòng bị LIMIT. Chưa có mẫu in riêng từng nghiệp vụ. | `rawRows_`, bảng UI |
| Xác thực/phân quyền thực tế Google | OAuth, chữ ký, chống replay, tick quyền, nhật ký, lưu phiên có kiểm thử | Chưa hoàn tất UAT hai tài khoản Google và kiểm tra ACL workbook/trigger/backup thực tế. Không đánh dấu hoàn tất từ mock. | `docs/AUTH_DEV_UAT.md`, `docs/NGHIEM_THU.md` |

## Lỗi logic còn mở, không phải chỉ thiếu nút

Chạy lại audit sau v15 vẫn tái hiện: ca 07–12 và 08–13 cùng nhân viên được tính 10 giờ; báo cáo chung thiếu chấm công vẫn ra lợi nhuận; sửa công thức hiện tại làm đổi giá vốn cũ; vay gốc 100 trả 150 vẫn được nhận, dư -50. Lãi suất 0%/30% cho kết quả gốc giống nhau vì chưa có tính lãi. Trang Chiến lược v15 đã chặn hiển thị kết quả khi thiếu một số nguồn nhưng chưa sửa `report` chung hoặc lưu lịch sử công thức.

Xem chi tiết [audit logic](LOGIC_AUDIT_2026-11-16.md). Thứ tự đề nghị: ca chồng giờ/độ đầy đủ/lịch sử công thức → tổng hợp tài chính theo quyền tối thiểu → chốt kỳ, liên kết kho/nợ → Portal, lãi vay, lương và bảo trì UI. Không tự sửa các quy tắc kế toán trong lượt kiểm tra này.

## Phần đã nối và toast

CRUD danh mục, nhập sổ/đảo phiếu, duyệt đơn nội bộ, đọc báo cáo, đồng bộ, xuất CSV, quản lý tài khoản/thu hồi phiên và nhật ký có handler/RPC thật. Không phải mọi trang chỉ là bản mẫu.

Toast mới hiển thị **góc trên bên phải** cho lưu, duyệt/đảo/xóa phiếu, cập nhật quyền, thu hồi phiên, xuất CSV, đồng bộ thủ công, đăng nhập/đăng xuất và gửi đơn Portal. Lỗi giữ thông báo tại chỗ và thêm toast; lỗi TIMEOUT/NETWORK là cảnh báo vì kết quả ghi có thể chưa rõ. Đồng bộ nền không báo thành công mỗi 15 giây; chỉ thông báo khi mất/kết nối lại hoặc hết phiên.

Có 4 loại thành công/lỗi/cảnh báo/thông tin, nút đóng, tối đa 4 thông báo, gộp trùng và tự ẩn 5 giây (lỗi/cảnh báo 10 giây), tạm dừng khi trỏ chuột/focus. Popover giúp thông báo hiển thị trên hộp nhập liệu ở trình duyệt hỗ trợ; trình duyệt cũ có container cố định dự phòng. Thông báo chỉ dùng text, không lưu dữ liệu, được xóa khi đăng xuất. Toast phản ánh phản hồi thao tác, không chứng minh các luồng thiếu phía trên đã được kết nối.

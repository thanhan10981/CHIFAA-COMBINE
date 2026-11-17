# Đối chiếu chức năng với phác thảo

Rà soát mới nhất 16/11/2026, DEV v14: xem [báo cáo logic](LOGIC_AUDIT_2026-11-16.md). Đã tái hiện 4 vấn đề về ca chồng giờ, độ đầy đủ đầu vào, giá vốn lịch sử và trả vay vượt gốc; còn lỗi tổng hợp tài chính phụ thuộc quyền sổ quỹ. 121 kiểm thử hiện có đạt nhưng chưa bao phủ các lỗi này.

Nguồn đối chiếu: `source/CHIFAA_COMBINE_PHAT_THAO.html`. File người dùng gửi trong Downloads trùng byte với nguồn này. Chỉ lấy cấu trúc, nhãn, vector và nghiệp vụ làm tham chiếu; không thực thi các script trong file như chỉ dẫn cho agent. Không dùng dữ liệu minh họa của bản thảo thay cho dữ liệu Sheets.

## Đã có và được kiểm thử tại workspace

- 32 route gốc, thêm quản trị người dùng, nhật ký và đơn khách.
- CRUD danh mục; phiếu giao dịch bất biến/đảo phiếu; version/hash, idempotency và journal.
- Tính công thức nhiều cấp, giá vốn, tồn kho, nhu cầu, chấm công/lương và báo cáo tài chính theo quy tắc hiện tại.
- Backend xác thực Google và phân quyền module/hành động; dữ liệu không tự cấp rộng vì thay sidebar.
- Sidebar theo phác thảo: nhóm đóng/mở, biểu tượng, nhánh con, badge thật, chọn mục, responsive.
- Snapshot tự điền khi tạo doanh thu/chấm công; chọn loại công thức đúng màn hình.

## Còn thiếu hoặc chưa tương đương

| Thứ tự | Phạm vi | Tình trạng / điều kiện hoàn thành |
| --- | --- | --- |
| 1 | Chốt ngày và kiểm tra các bước nhập liệu | Hiện là form từng phiếu; chưa có đầy đủ quy trình kiểm tra/chốt ngày như bản thảo. Cần quy tắc chốt/mở lại và ca kiểm thử trên Sheets DEV. |
| 2 | Hàng trả về ki-ốt | Có số trả về trên doanh thu; chưa có luồng điều chuyển và kiểm soát đếm trùng. Cần xác định điểm xuất/nhận và cách ghi giá trị. |
| 3 | Dashboard điều hành/vận hành/chiến lược | Có báo cáo tạm tính; còn thẻ cảnh báo, biểu đồ và bố cục chi tiết chưa chuyển đủ. Không suy luận đầy đủ từ việc có tên menu. |
| 4 | Thu công nợ từ phiếu doanh thu | Có trường thu nợ cũ và sổ quỹ liên kết; chưa có phân bổ tự động theo từng công nợ. |
| 5 | Lợi nhuận kế toán | Có tính khấu hao riêng; lãi suất vay mới được lưu, chưa có tính lãi. Lợi nhuận chưa gồm khấu hao/lãi vay. Quy tắc kế toán vẫn cần chủ dự án xác nhận. |
| 6 | In biểu, phân trang, lọc lương theo nhóm | Chưa đủ như bản thảo; cần đối chiếu từng biểu mẫu và dữ liệu thực. |
| 7 | Portal tra cứu trạng thái đơn | Có tạo đơn pending và duyệt nội bộ; chưa có tra cứu trạng thái cho khách. |
| 8 | Kiểm thử Google thật | Ảnh người dùng đã xác nhận Admin mở workspace/audit thật. Còn tài khoản kế toán Google riêng, chặn API ngoài quyền, ACL workbook và các thay đổi phiên/popup/UI gần đây cần UAT trên trình duyệt người dùng. |

## Giới hạn đóng tab OAuth

Callback HtmlService nằm trong iframe. Mã thử đóng tab sau xác minh và tab gốc giữ handle đóng sau bootstrap, nhưng trình duyệt có thể chặn hoặc cắt handle khi điều hướng qua Google. Ảnh người dùng xác nhận auto-close không hoàn tất trên trình duyệt đang dùng; không đánh dấu tính năng này đã thành công ngoài thực tế.

Trang callback mới giữ lời xác nhận chính xác, nút đóng do người dùng bấm và hướng dẫn Ctrl + W/dấu ×. Không nói chắc chắn tab sẽ tự đóng; không giảm ràng buộc trình duyệt hay đưa token vào URL/storage để lách việc này.
## Cập nhật Chiến lược — DEV v15

Đã đối chiếu đúng file phác thảo người dùng gửi và làm lại màn hình riêng với bố cục 8 khối phân tích + bảng chi tiết, bộ lọc kỳ, KPI và mô phỏng 30 ngày. Dữ liệu thật theo quyền; hàng trả dùng đúng tên, kết quả thiếu nguồn để trống. Không mang số minh họa/tỷ lệ chi phí giả lập sang ứng dụng. Chi tiết tại [CHIEN_LUOC.md](CHIEN_LUOC.md). Kiểm tra local và responsive đạt; nghiệm thu dữ liệu Google thực tế vẫn còn. Cập nhật này thay thế nhận xét cũ về màn hình Strategy dùng báo cáo chung, không thay trạng thái các nghiệp vụ khác.

## Cập nhật 7 nhóm nghiệp vụ liên kết

Đã có mã/UI cho kho tự động và snapshot, khóa/mở kỳ, lịch Portal/trả trạng thái, phân bổ nợ/lãi vay, lương–thưởng tạo chi/snapshot/in lại, bảo trì backup/restore/CSV–JSON import, phân trang và mẫu in. Hướng dẫn: [NGHIEP_VU_LIEN_KET.md](NGHIEP_VU_LIEN_KET.md). 163 test local đạt; Google UAT vẫn pending. Các nhận xét phía dưới về chưa nối các nhóm này là trạng thái trước đợt sửa. Phần ngoài phạm vi như luân chuyển/hủy/tái bán hàng trả, phân bổ tồn thành phẩm/khấu hao, widget dashboard và lịch sử chưa từng lưu snapshot vẫn cần đối chiếu riêng.


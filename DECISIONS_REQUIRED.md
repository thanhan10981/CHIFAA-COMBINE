# Quyết định và rào cản cần xác nhận

17/11/2026 — master request mới ưu tiên; đối chiếu DECISIONS.md, không coi quyết định đã chốt là chức năng đã nghiệm thu.

Đã chốt: D01 base doanh thu thuần cho Food32,2%/SX15%; D02 phần điểm bán chịu phải trả sau chiết khấu; D03 hỗ trợ thu hồi là chi phí riêng; D28 lãi tự nhập. Master yêu cầu năng suất theo tổng sản xuất/giờ SX; giữ sản lượng đạt và năng suất đạt riêng, chưa suy ra mẫu số tỷ lệ lỗi được duyệt.

| ID | Cần chốt / cung cấp | Xử lý an toàn trong khi chờ |
| --- | --- | --- |
| D07 | Hệ số/quy cách từng mẻ gạo, can/túi/chai | Chỉ dùng conversion đã nhập, không lấy ví dụ2,5 làm mặc định |
| D08/D09 | Mẫu số/ngưỡng lỗi, hủy, trả | Tách lượng và mẫu số, không gắn target giả |
| D10/D11 | Phụ cấp ca/ngày/tháng, ngày công/ca đêm | Giữ snapshot; không tính lại lịch sử theo master mới |
| D15/D16 | Giá vốn kế toán, giá trị/lô/hạn hàng thu hồi | Theo dõi lượng/lifecycle; chi phí/P&L chưa đủ căn cứ ghi chờ, không tự duyệt |
| D17/D18/D20 | Ngưỡng gần giới hạn, bonus cam kết, lịch bán | Cấu hình hoặc chưa đủ dữ liệu, không mặc định30ngày |
| D19/D24 | Số đầu kỳ và mã chính thức từ2workbook gốc | Chưa có file, không import/xóa/ghi đè nguồn |
| D21/D22 | Mô hình khách cuối và merge order→plan | Giữ Portal riêng và approved orders riêng; không cộng trùng |
| D23 | ACL sửa Sheets trực tiếp | Không cấp Editor toàn workbook cho quyền app hẹp |
| D25/D26 | Retention, phân bổ chi phí/xếp hạng lợi nhuận | Không tự xóa archive; nhãn lãi góp/tạm tính đúng căn cứ |
| GOOGLE_UAT | Browser kết nối, hai Google account, ACL, trigger, Portal/backup riêng | Mã/CLI không thay nghiệm thu; không bypass OAuth |

Các phần không phụ thuộc các quyết định này tiếp tục triển khai. Không tự bật ACCOUNTING_APPROVED hoặc production.

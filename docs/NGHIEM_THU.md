# Nghiệm thu trước bàn giao

Local: chạy `npm ci`, `npm run check`, `npm test`, `npm run build`. Kiểm thử hiện dùng Node, DOM emulator và mock Apps Script; chưa chứng minh runtime thật của Google. Preview trình duyệt chưa thực hiện vì không có browser khả dụng trong phiên.

Các bước Google bắt buộc, hiện chưa đánh dấu đạt:

- Nhập workbook mẫu, chạy setup hai lần; dữ liệu giữ nguyên, header/metadata/ledger được bảo vệ đúng tài khoản. Tài khoản app không được share backend vẫn làm việc qua owner-owned endpoint.
- Kiểm tra GIS HtmlService trên desktop/mobile, token sai audience/issuer/nonce/hết hạn; email ngoài allowlist bị từ chối, thư mời không truy cập nội bộ.
- Admin đăng nhập máy 2 bị từ chối, hiện cảnh báo denied; phiên hiện tại thu hồi được phiên khác; recovery có thao tác owner rõ ràng.
- Tài khoản read-only không gọi được endpoint create/update/delete/approve/export bằng console; thu hồi quyền phản ánh endpoint kế tiếp, UI xóa dữ liệu ở poll tiếp theo.
- Sửa một ô/dán nhiều ô/xóa giá trị/đổi tên/đổi giá danh mục trên Sheet. Giá thiếu/#REF không thành 0; version cập nhật; UI thấy thay đổi sau Đồng bộ/trigger; form cũ nhận CONFLICT và giữ nội dung để đối chiếu.
- Hai người ghi cùng dòng: một thành công, người sau nhận xung đột. Hai request cùng key chỉ có một phiếu. Mất mạng khi lưu không có thông báo thành công sớm.
- Phiếu kho đảo: tồn quay lại đúng, vẫn đủ audit. Setup không sửa hoặc xóa giao dịch cũ. Hủy phiếu tạo nhu cầu/thu tiền không bị đếm lại.
- Công thức lồng 3 cấp, vòng lặp, thiếu nguyên liệu, giá 0 thực sự, giá thiếu, giá thay đổi sau ngày báo cáo, quy đổi can/g có quy cách thật.
- Ca 23:00–07/08/09, nghỉ giữa ca, ca SX/VP/BH, phụ cấp ngày chỉ một lần; bảng lương theo từng nhóm và năng suất chỉ giờ SX.
- Sản xuất thêm/lỗi/hủy, hàng trả từng điểm bán về ki-ốt; xác nhận cách tái bán, chi hỗ trợ, hàng điểm bán chịu. Hiện ki-ốt được mô hình như một điểm bán, chưa có phiếu luân chuyển hàng trả tự động.
- Doanh thu tách thu tiền, công nợ cũ; chủ khách hàng chốt cách ghi nhận và ký duyệt bộ ví dụ tính tay. Hoàn thiện ledger tài chính nếu cần kế toán kép hoặc phân bổ khấu hao/lãi.
- Cổng khách dùng project/workbook riêng, chỉ món công bố; đặt đơn pending, import đúng một lần, duyệt/từ chối, nhu cầu không cộng trùng kế hoạch. Kiểm tra chống spam và chính sách thư mời với dữ liệu thật.
- 10 người thực tế: bootstrap, đổi tab, filter, batch write, polling; ghi p50/p95/quota và thời gian thao tác mobile, giảm animation theo prefers-reduced-motion.
- Sao lưu thật và restore thành file mới; đối chiếu tổng số dòng, tồn kho, doanh thu, sổ quỹ, quyền file. Chỉ đổi nguồn sau kiểm tra. Chính sách giữ backup do chủ dự án duyệt.
- So sánh từng mục trong MAPPING_GIAO_DIEN với phác thảo; các biểu mẫu/tính năng còn thiếu phải hoàn thiện trước khi ghi T19 DONE.

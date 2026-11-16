# Kiểm tra dữ liệu nguồn — G04 / T07

Checkpoint 2026-11-16, kiểm thử local/mock; chưa nghiệm thu Google Sheets thật.

`sourceIssues` dùng chung cho máy chủ và giao diện: kiểm tra ID/version, ID trùng, trường bắt buộc, số/ngày/lựa chọn, tham chiếu khi có đủ nguồn và vòng lặp công thức. Thiếu quyền đọc bảng tham chiếu không bị quy thành dữ liệu sai. Không đọc thêm bảng riêng tư để trả lỗi cho người không có quyền.

Bootstrap kiểm tra toàn bộ các bảng được phép đọc trước khi chia trang 200 dòng, trả danh sách lỗi riêng. Giao diện giữ kiểm tra khi tải đủ các trang, chặn báo cáo khi nguồn có lỗi. Các dòng vẫn hiện tại phân hệ nguồn để đối chiếu; không xóa hoặc đổi lỗi thành 0. Cờ xóa/checkbox sai kiểu được đánh dấu trước khi chuyển sang boolean.

Máy chủ kiểm tra nguồn trước financialSummary; trước workflow sản xuất/kiểm kê/lương/lãi/phân bổ nợ/khóa kỳ; và trước mutate tạo sản xuất, kiểm kê, chấm công, doanh thu, quỹ. Nguồn lỗi trả DATA_INVALID trước khi tạo bút toán. Lỗi này dùng thông báo chung, không trả giá trị hoặc mã phiếu quỹ riêng tư. Kiểm tra bảo thủ trên toàn bảng liên quan, có thể chặn cả khi dòng lỗi nằm ngoài kỳ; cần sửa nguồn trước. Mở kỳ/hoàn tác vẫn giữ cơ chế cũ để xử lý sai sót.

Scan kiểm tra lại cả dòng lỗi chưa thay đổi, giữ nguyên ô nghiệp vụ. Script Property SOURCE_QUALITY chỉ chứa checkedAt/invalidRows, không chứa dữ liệu tài chính. Audit sửa/xóa trực tiếp dùng SHEET_EDITOR_UNVERIFIED; đây không phải danh tính người sửa đã được xác minh. Scan chỉ tăng sync stamp khi có thay đổi nguồn/metadata, không tăng liên tục vì lỗi tồn tại.

Không đổi header, không thêm bảng, không cần chạy setup lại chỉ vì cập nhật này. Cache bootstrap vẫn tối đa 30 giây; nút Đồng bộ ép đọc mới. Quyền và phiên vẫn được xác minh trước cache.

## Kiểm thử

177/177 local tests; syntax 50 file và build đạt. Bảy ca mới ở tests/source-quality.test.mjs: lỗi dòng 201, không lộ bảng ngoài quyền, nguồn quỹ riêng tư sai rồi sửa, lương chặn trước ghi rồi sửa, kiểm kê mutate không đi vòng, lỗi boolean/metadata, ID trùng/vòng lặp và scan lặp. Các fixture cũ được bổ sung đủ cột bắt buộc để phản ánh phiếu hợp lệ, không nới bộ kiểm tra.

## Chưa hoàn tất G04

Chưa bảng cách ly/duyệt phục hồi độc lập, chưa kiểm định integrity toàn journal/allocations/reversal và toàn luồng import/Portal; không coi helper này là xác nhận kế toán mọi nguồn. Chưa onChange, cursor/incremental scan, giới hạn công việc và P50/P95 thực tế. API list/export vẫn cho đọc dữ liệu gốc theo quyền, không phải chứng nhận dữ liệu đã hợp lệ. Chưa kiểm thử trigger, protected ranges, ACL và hai Gmail trên Google thật. Không đổi trạng thái REQ thành DONE.

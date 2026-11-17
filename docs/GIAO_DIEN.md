# Giao diện CHIFAA — 16/11/2026

Giao diện theo hướng ứng dụng quản trị: phân cấp rõ, ít trang trí, dữ liệu dễ quét và thao tác nhất quán. “5 sao” là định hướng chất lượng người dùng yêu cầu, không phải chứng nhận đã đạt.

Nguồn giao diện dùng chung là `src/client/theme.css`, được build sau CSS cấu trúc cho cả Index và Portal. Chỉ áp dụng trên màn hình, giữ mẫu in nghiệp vụ riêng. Không tải font/CDN ngoài. Logo gốc tách nền được giữ nguyên.

- Màu: xanh đậm `#142b40`, chữ `#1e3348`, chữ phụ `#607287`, nền `#f3f6f9`. Cam thao tác `#bf5117` có tỷ lệ tương phản chữ trắng khoảng 4,77:1; logo vẫn giữ màu gốc.
- Đăng nhập: phần nhận diện gọn, ba phạm vi công việc, ô đăng nhập 460px, tiêu đề một dòng theo độ rộng, nút Google trắng có biểu tượng SVG bốn màu và thông tin quyền truy cập rõ. Không đổi OAuth/popup/lưu phiên.
- Sidebar: giữ nhóm và thu gọn theo phác thảo, giảm độ nặng của khung, rõ trạng thái đang chọn và focus bàn phím. Header và footer thu gọn.
- Bảng: chữ 13px, hàng 49px, header nổi, số dạng tabular và căn phải theo kiểu dữ liệu gốc. Thao tác và trạng thái nhất quán.
- Form/dialog: chiều cao ô nhập 44px, label 12px, khoảng cách 20px, trạng thái focus rõ, footer thao tác riêng. Giữ validator và thông báo lỗi hiện có.
- Báo cáo, chiến lược, quản trị quyền, bảo trì, loading, toast và Portal dùng cùng màu, kiểu chữ, bo góc và khoảng cách. Trạng thái không có dữ liệu có lời hướng dẫn thao tác.
- Responsive: login chuyển sang header thương hiệu và một cột dưới 850px; sidebar dạng ngăn kéo dưới 700px; nội dung/form thu gọn dưới 420px. Bảng rộng cuộn bên trong.

Kiểm tra: 166 Node/DOM/GAS-mock tests đạt; syntax47/build đạt; CSS parser đọc được cả sáu nhóm media. Kiểm tra màu nút chính bằng luminance WCAG. Đây không phải nghiệm thu accessibility toàn ứng dụng.

Không có trình duyệt kết nối trong phiên: `cua.getState()` trả danh sách trống, mở iab báo không khả dụng. Vì vậy chưa có screenshot hoặc nghiệm thu layout trên trình duyệt cho giao diện mới. Cần xem bản DEV thực tế trên desktop/mobile, kiểm tra dialog dài, dữ liệu dài, zoom 200%, bàn phím và bản in trước khi nghiệm thu thiết kế.

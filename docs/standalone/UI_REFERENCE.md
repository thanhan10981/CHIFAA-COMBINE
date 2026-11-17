# Đối chiếu giao diện với phác thảo

Nguồn: `CHIFAA_COMBINE_PHAT_THAO.html` do người dùng cung cấp ngày 17/11/2026. SHA256: `c15cc8d2cfc64cd46877ba8a09e553c02a7251f17fbce97904d628932503c0b2`.

Style gốc được giới hạn trong `.workspace` ở `web/features/design/reference.css`. Sidebar lấy 32 mục, 5 nhóm và SVG từ bản phác thảo; dùng permission thật để lọc menu. Desktop rộng 282px, header 75px; mobile dùng drawer. Giữ logo CHIFAA chính thức.

Theo yêu cầu nâng cấp giao diện sau đó, `polish.css` bổ sung font Be Vietnam Pro tự phục vụ (400/600/700, đầy đủ dấu tiếng Việt), thang chữ, khoảng cách, navy–cam, card, bảng và form dễ đọc hơn. Giấy phép font đi kèm tại `public/fonts/Be-Vietnam-Pro-OFL.txt`. Nút chính có màu đậm hơn, focus bàn phím rõ, ô nhập tối thiểu 44px và font 16px trên mobile. Cổng đặt hàng giữ trên desktop và mobile. Không gọi đây là chứng nhận “5 sao” hoặc kiểm định WCAG đầy đủ; kiểm tra Chrome xác nhận font thực sự được tải.

Danh mục, tổng quan và trình xem công thức dùng bố cục mới cùng truy vấn/RPC hiện có. Editor kho, sản xuất, kiểm kê, quản trị và duyệt đơn vẫn dùng các biểu mẫu nghiệp vụ đã triển khai; chưa đồng nhất từng thành phần với phác thảo. Các phân hệ chưa có UI nghiệp vụ dùng bố cục tham chiếu đã làm sạch, có thông báo đang hoàn thiện và khóa thao tác. Đây chưa phải nghiệm thu giống 100% từng pixel hoặc hoàn tất backend.

Không mang JavaScript cũ, dữ liệu minh họa, giá giả, email hay khóa vào runtime. Chỉ tiêu thiếu nguồn giữ trạng thái chưa xác định; Food cost 32,2% và nhân sự SX 15% tính trên doanh thu thuần. Các bảng tài chính của bố cục chờ backend không hiển thị số mẫu.

## Kiểm tra lại

Trong `web`, chạy `npm run verify`, sau đó `npm run test:design`. Kiểm tra giao diện cần Chrome cài sẵn; có thể đặt `CHIFAA_CHROME_PATH`. Fixture chỉ được bundle ra `output/design-parity`, không tạo route thử nghiệm hoặc bỏ qua Auth trong ứng dụng.

Chrome headless kiểm tra 32 route ở 1440×1000: kích thước sidebar/header, 5 nhóm, một mục đang chọn, không tràn ngang; thêm đóng/mở nhóm, mở modal danh mục, ẩn Admin với quyền hạn chế. Kiểm tra drawer và tràn ngang cho 5 màn ở 390×844. Ảnh và báo cáo nằm trong `output/design-parity/`. Đây là fixture cô lập, chặn mạng ngoài; không thay thế đăng nhập thật hoặc UAT Supabase cloud.

Triển khai tiếp qua nhánh `chifaa-next-dev`, Vercel root `web`. Cần kiểm tra deployment và domain chính sau build; Git push không chứng minh bản online đã cập nhật. Không chạy lại SQL bootstrap vì thay đổi này chỉ ở frontend.

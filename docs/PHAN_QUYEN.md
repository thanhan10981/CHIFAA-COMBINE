# Cấp tài khoản bằng ô tick

Trong **Tài khoản & phiên đăng nhập**:

1. Chọn tài khoản đã có hoặc chọn **Tạo tài khoản mới** và nhập email Google.
2. Chọn **Nhân viên** hoặc **Kế toán**, bật **Kích hoạt tài khoản**.
3. Tick **Xem** ở các mục muốn hiện trên sidebar. Có thể tick tên nhóm để chọn cả nhóm.
4. Tick thêm **Thêm / Sửa / Xóa / Duyệt, đảo / Xuất** ở những mục cần thao tác. Chỉ hiện các thao tác phù hợp với bảng; các sổ bất biến không có Sửa/Xóa.
5. Đọc danh sách **Dữ liệu được phép đọc** bên dưới, rồi bấm **Lưu tài khoản**. Thanh lưu bám cuối màn hình khi cuộn trong biểu mẫu.

Chọn tài khoản cũ hoặc bấm **Chỉnh quyền** để nạp lại các ô đã chọn. Email tài khoản cũ được khóa trong biểu mẫu; dùng **Tạo tài khoản mới** để nhập email khác.

**Admin có toàn quyền**, bao gồm cấp tài khoản và nhật ký; các ô tick được đánh dấu và khóa khi chọn vai trò Admin. Không cần cấp quyền Editor workbook cho nhân viên/kế toán.

Các màn hình dùng chung một bảng có chung quyền thao tác. Ví dụ các màn hình công thức cùng dùng bảng công thức. Việc hiện từng màn hình trên sidebar vẫn được chọn riêng. Báo cáo và biểu mẫu được cấp đọc các bảng nguồn/tham chiếu cần thiết; danh sách này luôn hiện trước khi lưu. Chọn báo cáo tổng hợp có thể bao gồm dữ liệu doanh thu, chấm công và sổ quỹ; chỉ chọn nếu phù hợp phạm vi công việc.

## Ghi chú kỹ thuật

Giữ nguyên cột và dữ liệu `_Users`. `permissions` vẫn chứa quyền theo module/action; trường tùy chọn `_routes` lưu danh sách mục sidebar. Server kiểm tra danh sách hợp lệ, không cho vai trò ngoài Admin chọn mục quản trị/nhật ký và vẫn xác minh phiên, chữ ký, chống phát lại, quyền module/action trước mọi đọc/ghi. `_routes` điều khiển điều hướng và chặn mở màn hình không chọn trong app; nó không thay thế phân quyền dữ liệu phía server hay tạo phân quyền theo dòng/cột.

Bootstrap trả `_routes` cùng quyền module; cache đã gắn với toàn bộ quyền, phiên bản quyền và sync stamp. Lưu quyền tăng permissionVersion/sync stamp; tài khoản đang mở cập nhật qua đồng bộ. Tài khoản cũ chưa có `_routes` tiếp tục dùng quy tắc cũ cho tới khi Admin chỉnh/lưu bằng biểu mẫu mới. Không sửa dữ liệu live hay cấp tài khoản thật trong quá trình triển khai mã.
## Phiếu liên kết và quyền ghi mà không đọc sổ đích

Ô **Phiếu liên kết** được bổ sung cho sản xuất, kiểm kê, lương, khoản vay và công nợ. Giao diện liệt kê rõ các quyền ghi vào kho/sổ quỹ cần thiết; không tự cấp quyền đọc hai sổ này. Payroll dùng quyền duyệt chấm công; chi lãi dùng quyền duyệt khoản vay và tạo chi qua endpoint nghiệp vụ, không cần quyền sửa gốc vay hoặc đọc cash.

Với tài khoản đã lưu `_routes`, backend còn chặn `mutate` trực tiếp vào bảng không có mục nguồn được chọn. Các quyền ghi-only được cấp từ ô liên kết chỉ dùng qua workflow đã kiểm tra nghiệp vụ. `_routes` vẫn không thay cho quyền đọc module hoặc tạo bảo mật theo dòng/cột; quyền nguồn và thông tin người dùng tiếp tục được kiểm tra mỗi RPC. Phân quyền legacy không có `_routes` giữ hành vi module/action cũ, nên lưu lại bằng UI mới nếu muốn giới hạn này.

Ví dụ đã kiểm thử: tài khoản chỉ có mục Khoản vay + Phiếu liên kết được tính/lập chi lãi, API đọc cash và tự ghi vốn đầu kỳ bị FORBIDDEN. Không cần Editor workbook. Chốt lương có thưởng còn cần Xem kế hoạch để áp dụng trần; không tự mở thêm dữ liệu báo cáo cho người chỉ được xem lương.


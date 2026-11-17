# Cấp Admin đầu tiên trên Supabase DEV

Google OAuth xác minh danh tính; profile mới vẫn disabled cho đến khi được chủ hệ thống cấp quyền. Màn hình “Tài khoản chưa được cấp quyền hoặc đã bị khóa” tương ứng `my_access().enabled=false`; không bỏ kiểm tra backend để vượt qua bước này.

## Quy trình

1. Chủ hệ thống đăng nhập Google một lần trên ứng dụng online để tài khoản xuất hiện trong Supabase Auth. Email phải được xác minh.
2. Chuẩn bị file bằng `npm --prefix web run admin:bootstrap -- owner@example.test`, thay email bằng tài khoản chủ sở hữu đã xác nhận. Đây chỉ là công cụ tạo SQL, không chạy ứng dụng localhost và không tự gửi lệnh lên cloud.
3. Trên đúng project Supabase DEV, mở **SQL Editor → New query**, vai trò **postgres**. Dán toàn bộ nội dung `output/CHIFAA_FIRST_ADMIN_DEV.sql`, rồi Run.
4. Kết quả mong đợi là một dòng `id`, `enabled=true`, `role_id=admin`. Mở lại `/app` trên domain Vercel chính hoặc đăng nhập lại nếu phiên đã hết hạn.

Không chạy lại file tạo toàn bộ schema `CHIFAA_SUPABASE_DEV.sql` để cấp quyền. Không cần thay đổi biến môi trường hay redeploy frontend cho việc cấp role trong database.

## Bảo vệ

- Chỉ tài khoản Auth khớp chính xác email và đã xác minh mới được cấp quyền; nhiều tài khoản trùng email hoặc không có tài khoản đều dừng.
- SQL yêu cầu vai trò owner, dùng khóa quản trị và một transaction; không tạo RPC công khai cấp Admin.
- Nếu đã có người quản trị hiệu lực, dùng giao diện Admin hiện có. Lệnh không mở đường cấp thêm Admin ngoài luồng đó.
- Không xóa role hoặc ghi đè các quyền bị từ chối. Trường hợp có deny override phải được xem xét riêng.
- Chạy lại cùng tài khoản đã cấp thành công không tạo role hoặc nhật ký trùng. Có audit `ADMIN_BOOTSTRAP` ghi phương thức owner SQL Editor.
- File SQL có email thực nằm trong `output/` bị Git bỏ qua. Mã nguồn và test chỉ dùng email tổng hợp.

Lệnh này chỉ giải quyết quyền quản trị ban đầu. Những nghiệp vụ backend còn lại được theo dõi riêng trong FEATURE_MATRIX.md; không nhập dữ liệu lịch sử ở bước này.

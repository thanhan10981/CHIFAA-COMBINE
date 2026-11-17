# Biên bản thử xác thực DEV

**Chưa chạy trên Google thật.** Chỉ điền PASS sau khi thực hiện bằng hai tài khoản riêng. Không ghi Client Secret, code callback, state, session/signing key hoặc Google tokens vào biên bản/ảnh.

| Mục | Bằng chứng cần ghi | Kết quả |
| --- | --- | --- |
| Môi trường | Spreadsheet DEV, deployment/version, OAuth client đã kiểm tra đúng; không dùng production | CHƯA CHẠY |
| Quyền file | Kế toán không có quyền qua Share, group, thư mục cha hoặc link; mở URL workbook bằng kế toán bị từ chối | CHƯA CHẠY |
| Google login | Admin ở profile A và kế toán ở profile B chọn đúng account, callback `/exec` không còn GIS 401 | CHƯA CHẠY |
| Admin | Bootstrap có các module được phép, quản trị tài khoản/phiên dùng được | CHƯA CHẠY |
| Kế toán read-only | Cấu hình chỉ sales read; response bootstrap chỉ có sales; không có employees/attendance/cash/loans/debts/assets | CHƯA CHẠY |
| Gọi trực tiếp | Trong DevTools của iframe app gọi `call('export',{module:'employees'})`, `call('admin',{operation:'list'})`, `call('health')`: FORBIDDEN | CHƯA CHẠY |
| Giả chữ ký | `google.script.run.withSuccessHandler(console.log).rpc('bootstrap',{token:'fake'})`: AUTH, không có dữ liệu | CHƯA CHẠY |
| Phát lại | Bắt một request signed trong DEV, gửi lại nguyên payload: AUTH; không có lần ghi thứ hai | CHƯA CHẠY |
| Chặn action | Kế toán thử mutate sales/create và employees/create bằng `call`: FORBIDDEN khi chỉ có sales/read | CHƯA CHẠY |
| Thu hồi/quyền | Admin gỡ sales/read: response lần sau không có sales; khóa user hoặc revoke phiên: AUTH | CHƯA CHẠY |
| Admin đơn | Profile C thử đăng nhập Admin khi A đang active: SESSION, audit LOGIN_DENIED; kế toán vẫn hoạt động | CHƯA CHẠY |
| Callback | Hủy Google, callback thiếu/sai state, dùng lại callback, hết 5 phút: không tạo phiên | CHƯA CHẠY |
| Bí mật | View Source/HTML/storage không chứa Client Secret/Google token; app key chỉ RAM CryptoKey không extractable; không script GIS | CHƯA CHẠY |
| Đăng xuất | Sau logout không đọc được bằng phiên cũ; reload không tự đăng nhập bằng phiên cũ | CHƯA CHẠY |
| Nghiệp vụ | Tạo 1 phiếu DEV được cấp quyền, retry cùng key không trùng, conflict/đảo giữ nguyên; không dùng dữ liệu khách thật | CHƯA CHẠY |

Nếu Console chưa thấy `call`, chọn execution context của iframe HtmlService. Đây là helper nội bộ để thử bằng tài khoản đang đăng nhập DEV, không bật endpoint debug hoặc thêm hàm public trên server. Không chụp/log nguyên payload auth. Khi thử ghi phải dùng dữ liệu DEV và ghi rõ record ID để đối chiếu; không xóa lịch sử giao dịch bằng tay.

Không thể thay thế kiểm tra ACL Drive bằng việc ẩn tab hoặc bảo vệ range. Nếu kế toán mở được workbook, mục quyền file FAIL dù UI/RPC chặn đúng.

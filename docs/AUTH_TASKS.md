# Chuyển xác thực sang Apps Script — DEV

| Task | Phạm vi | Trạng thái |
| --- | --- | --- |
| A1 | OAuth code, callback /exec, UserInfo, state một lần và bí mật ràng buộc tab | LOCAL: 10/10 OAuth tests |
| A2 | Phiên có chữ ký HMAC, chống phát lại, RBAC, một Admin, thu hồi | LOCAL: 35/35 OAuth + backend + session tests |
| A3 | Thay GIS bằng nút mở Google, giữ UI/nghiệp vụ, kiểm thử client | LOCAL: 8/8 client tests, có hai tab mô phỏng |
| A4 | Cloud/Properties/deploy DEV, hướng dẫn hai tài khoản, build và HANDOFF | DONE_LOCAL: 90/90 tests, check 27 files, build/parse GAS + HTML, package SHA256/CRC, HANDOFF cập nhật |
| A5 | Triển khai thật DEV và thử Admin/kế toán ở hai tài khoản Google | API đã bật; push 4 files thành công, read-back khớp local, tạo version 2. /exec vẫn v1; chờ cấu hình OAuth/setup và UAT hai tài khoản thật |

Mỗi task chạy kiểm thử phù hợp trước khi chuyển tiếp. Kết quả mock không thay thế nghiệm thu Google thật.

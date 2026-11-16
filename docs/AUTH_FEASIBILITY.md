# T01 — Auth feasibility và gate nghiệm thu

## Điều đã xác nhận bằng mã và local tests

Ứng dụng hiện dùng executeAs USER_DEPLOYING, access ANYONE trong manifest. ANYONE chỉ là quyền mở Web App, không là quyền đọc dữ liệu: doGet trả shell; các RPC nội bộ bắt buộc authConfig DEV, phiên còn hạn, Google identity allowlist, chữ ký HMAC/browser-held non-exportable key, nonce durable và RBAC module/action. Portal deployment mode chặn RPC nội bộ. Không thay executeAs, không cấp Editor workbook cho tài khoản ứng dụng.

Luồng: oauthStart tạo state + PKCE + browserProof → Google authorization bên ngoài iframe → callback /exec đổi code trên server với Client Secret → Google UserInfo qua HTTPS với access token vừa đổi → email_verified/sub + _Users → oauthFinish kiểm tra browserSecret → phiên ứng dụng. Không parse một JWT chưa xác minh; identity lấy từ authenticated UserInfo back-channel. Google tokens không lưu trong HTML/Sheets; secrets server Script Properties. Không dùng Session.getActiveUser email để đăng nhập.

Tài liệu Google xác nhận quyền chạy theo chủ triển khai khác quyền người truy cập: [Web Apps](https://developers.google.com/apps-script/guides/web). Email active user có thể không khả dụng khi owner-execute: [Session](https://developers.google.com/apps-script/reference/base/session). Google hỗ trợ lấy thông tin người dùng qua access token/UserInfo: [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect). Đây là cơ sở thiết kế, không chứng nhận bản triển khai của dự án đã an toàn hoàn toàn.

Local suites đã chạy cùng baseline166: tests/oauth.test.mjs, session-security.test.mjs, cache.test.mjs, client.test.mjs, permissions.test.mjs. Bao gồm unknown/disabled/unverified, state/callback replay, forged browser proof, signed RPC replay, account/permission changes, Admin concurrent/re-auth và accountant denied payroll/health/admin/export. Kết quả mock không là hai Gmail Google thật.

## Kiểm kê Google thực tế

- CLI deployments đọc được: hai deployment DEV đang dùng phiên bản21; historical deployment riêng phiên bản2 không thay đổi. URL/Script/Sheet IDs chỉ giữ ở cấu hình local bị gitignore; không in secret hoặc giá trị Script Properties.
- Manifest local và bản đọc lại21 cùng owner-execute/V8/Asia_Ho_Chi_Minh; code đọc lại21 đã khớp bốn file ở phiên trước. Audit hiện tại sẽ lưu bản đọc lại mới nếu có quyền.
- Không có tool kết nối trực tiếp Sheets/Drive/Google Cloud và không có trình duyệt đã kết nối. Không đọc được live Script Properties, linked Cloud project/client, ACL workbook, headers/counts/protections, job triggers hoặc /dev/authenticated /exec. Không suy ra đã cấu hình từ tên khóa trong source.
- Tên khóa cấu hình: APP_MODE, AUTH_ENV, AUTH_DEV_SPREADSHEET_ID, SPREADSHEET_ID, ADMIN_EMAIL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, WEB_APP_URL; tùy chọn WORKSPACE_DOMAIN, ACCOUNTING_APPROVED, BACKUP_FOLDER_ID, PORTAL_SPREADSHEET_ID, PORTAL_WEB_APP_URL, PORTAL_SIGNING_SECRET. Không yêu cầu gửi secret qua chat.

## Kết luận gate

**T01/Gate1: BLOCKED_GOOGLE_UAT.** Kiến trúc đã có implementation/mock, không kết luận AUTH_ARCHITECTURE bất khả thi. Chưa chứng minh đủ hai Gmail thật và ACL. Không được gọi DONE, mở rộng truy cập nhạy cảm hoặc bypass cơ chế hiện tại để test.

Khi có trình duyệt Google kết nối: kiểm tra đúng Cloud client/redirect và owner identity → Admin login/bootstrap/mutate fixture DEV → tài khoản kế toán chỉ sales, thử RPC/export payroll bị từ chối → unknown/disabled bị chặn → Gmail kế toán không mở được workbook nội bộ → revoke/session replay/second Admin → ghi log kiểm thử và quyền thực tế. Không cấp Editor để làm test pass. Snapshot người dùng trước cho thấy Admin đã vào ứng dụng nhưng không thay được các ca trên.

# Bằng chứng kiểm tra local — 2026-11-15

`npm test`: 90 tests, 90 pass, 0 fail sau chuyển auth OAuth thuần Apps Script. Bộ test chạy Node 24 với --test-isolation=none; gồm pure domain, DOM emulator linkedom và mock các dịch vụ Apps Script. Các test source đọc 32 route trực tiếp từ HTML đầu vào, kiểm tra chúng tồn tại trong app mới.

Các bằng chứng có ý nghĩa: giá thiếu/null khác 0, giá lịch sử không lấy phiếu tương lai, công thức vòng lặp, ca qua đêm, năng suất chỉ SX, sản xuất thêm, doanh thu khác thu tiền/công nợ cũ, bút toán đảo, hash conflict trước trigger, RBAC và revoke, idempotency key, rollback hai bảng khi bảng thứ hai lỗi, import preview không ghi, portal chỉ món công bố/pending/idempotent, từ chối đơn, bootstrap không tải dữ liệu khi chưa auth, dữ liệu XSS được render text, logout xóa dữ liệu DOM/RAM.

`npm run check`: syntax checks 27 file JS nguồn/scripts/tests; không thay cho type checker hoặc kiểm thử Apps Script runtime.

`npm run build`: tạo Code.gs, Index.html, Portal.html, manifest và HTML xem thử. Build đối chiếu toàn bộ script trong HTML gốc với HTML thay logo; không đổi JavaScript nghiệp vụ của phác thảo.

Auth mới: callback code/PKCE/state một lần, sai tab/secret, hết hạn/cấu hình thay đổi, Google từ chối, email chưa xác minh/ngoài allowlist, subject binding, Admin đơn giữa hai account, HMAC sai/action hoặc payload thay đổi, request phát lại, mất cache, thu hồi/đổi role/vô hiệu hóa, DEV guard đều có kiểm thử. Client test nối Web Crypto HMAC thật tới GAS mock qua bridge RPC: đăng nhập và bootstrap hai tab Admin/kế toán trả đúng scope. Đây là hai danh tính mô phỏng, không phải hai tài khoản Google thật. Verifier Node cũ đã được loại bỏ, không cần Cloud Run.

Workbook: cấu trúc OpenXML/header cả 22 bảng khớp schema, không có bản ghi giả/công thức lỗi. Chưa render hoặc tính toán trên Excel/Google. Workbook là nguồn rỗng, domain tính toán nằm trong app; không có công thức cần recalc trong file này.

Google thật/GAS/OAuth/Google Sheets/triggers/backup-restore/quota/load: **agent chưa chạy**. Người dùng đã tạo project DEV thủ công nhưng chưa cung cấp ID/deployment để xác nhận. Không suy luận đã đạt từ mock tests. Windows Computer Use trả lỗi `Computer Use native pipe is unavailable ... os error 2`; `.clasp.json` không tồn tại. Danh sách phải kiểm tra nằm trong NGHIEM_THU.md và AUTH_DEV_UAT.md.

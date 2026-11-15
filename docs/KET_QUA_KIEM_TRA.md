# Bằng chứng kiểm tra local — 2026-11-15

`npm test`: 66 tests, 66 pass, 0 fail. Bộ test chạy Node 24 với --test-isolation=none; gồm pure domain, DOM emulator linkedom và mock các dịch vụ Apps Script. Các test source đọc 32 route trực tiếp từ HTML đầu vào, kiểm tra chúng tồn tại trong app mới.

Các bằng chứng có ý nghĩa: giá thiếu/null khác 0, giá lịch sử không lấy phiếu tương lai, công thức vòng lặp, ca qua đêm, năng suất chỉ SX, sản xuất thêm, doanh thu khác thu tiền/công nợ cũ, bút toán đảo, hash conflict trước trigger, RBAC và revoke, idempotency key, rollback hai bảng khi bảng thứ hai lỗi, import preview không ghi, portal chỉ món công bố/pending/idempotent, từ chối đơn, bootstrap không tải dữ liệu khi chưa auth, dữ liệu XSS được render text, logout xóa dữ liệu DOM/RAM.

`npm run check`: syntax checks các file JS nguồn/scripts/tests/verifier; không thay cho type checker hoặc kiểm thử Apps Script runtime.

`npm run build`: tạo Code.gs, Index.html, Portal.html, manifest và HTML xem thử. Build đối chiếu toàn bộ script trong HTML gốc với HTML thay logo; không đổi JavaScript nghiệp vụ của phác thảo.

Verifier smoke test: Node service khởi động, POST thiếu secret nhận 403, POST JWT giả với secret thử nhận 401. Chưa có ID token Google thật để kiểm tra thành công end-to-end.

Workbook: cấu trúc OpenXML/header cả 22 bảng khớp schema, không có bản ghi giả/công thức lỗi. Chưa render hoặc tính toán trên Excel/Google. Workbook là nguồn rỗng, domain tính toán nằm trong app; không có công thức cần recalc trong file này.

Browser/GAS/OAuth/Google Sheets/triggers/backup-restore/quota/load: **chưa chạy**. Không suy luận đã đạt từ mock tests. Danh sách phải kiểm tra nằm trong NGHIEM_THU.md. Đầu ra chưa có URL Google Sheet hoặc deployment live.

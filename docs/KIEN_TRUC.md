# Kiến trúc và giới hạn

Frontend SPA → `rpc(action,args)` → kiểm tra phiên/permission → schema/domain → LockService → journal PREPARED → ghi Sheet/audit → APPLIED → bump sync version. Backend chỉ công khai doGet/rpc có quyền truy cập dữ liệu; helpers kết thúc `_`. Pure functions được bundle cùng source không truy cập dịch vụ Google.

Source chia `src/client`, `src/shared`, `src/server`; build tạo một Code.gs và HTML tự chứa cho HtmlService. Không phụ thuộc bundler remote. Mọi dữ liệu nghiệp vụ trên client ở RAM; không localStorage, không preload tài chính trước login. Không IndexedDB trong phiên bản này. Không CacheService cho nội dung nghiệp vụ; chỉ cache nonce đăng nhập có TTL 5 phút. Trường nhạy cảm không được log trong console. Audit có ảnh trước/sau, chỉ chủ file backend và người được chủ file cho phép có thể xem trực tiếp.

17 bảng nghiệp vụ khai báo trong `src/shared/schema.js`. Metadata chung: recordId, version, updatedAt, updatedBy, source, deleted, reverses. Cột lines chứa JSON của thành phần công thức; nên sửa bằng UI, các cột scalar danh mục có thể sửa trên Sheet. 5 bảng hệ thống: _Users, _Sessions, _Audit, _Requests, _Sync. Header phải khớp tuyệt đối; setup preflight trước khi thay đổi bảng. Chưa có schema migration tự động cho nâng phiên bản, phải backup và viết migration riêng.

Ghi API so sánh cả version và hash toàn dòng. Dữ liệu sửa ngoài API không bị ghi đè âm thầm. Lock chỉ phối hợp các lệnh Apps Script, không khóa tay người đang sửa Sheet. Vì vậy transaction Sheets không ACID: journal và rollback giảm rủi ro, PREPARED chưa phục hồi sẽ chặn các lệnh ghi mới. Chủ file vẫn có thể sửa journal. Audit không phải log chống sửa tuyệt đối.

Phiếu stock/counts/production/sales/attendance/cash là bất biến qua API, đảo bằng phiếu tham chiếu reverses. Lịch sử giữ nguyên, các phép tính loại cả phiếu gốc đã đảo và phiếu đảo. Đảo cả phiếu rồi nhập phiếu mới là quy tắc correction hiện tại; chưa có partial reversal. Tài sản/công nợ/khoản vay là dữ liệu đầu vào có version; sổ quỹ ghi liên kết theo ID. Chi phí bán hàng thu hồi và sổ lương chưa phải ledger kế toán kép.

Giới hạn chủ động: tối đa 5.000 dòng/bảng, import 500 bản ghi/lô, công thức 100 thành phần. Chưa phân trang backend hoặc đo p95; khi vượt giới hạn trả lỗi rõ thay vì cắt dữ liệu. Không có offline queue tự ghi lại. Mutations timeout phải thử lại cùng key; app không tự retry ghi. Trạng thái thành công chỉ xuất hiện sau server xác nhận. Thao tác đảo/xóa có thể cần Đồng bộ để xác định kết quả sau mất mạng; chưa có hàng đợi bền vững qua reload.

Frontend giữ 32 route cũ nhưng nhiều màn hình đã chuẩn hóa theo form/table chung. Cần so sánh chi tiết phác thảo trước nghiệm thu; không xem số route bằng bằng chứng tương đương toàn bộ nghiệp vụ.

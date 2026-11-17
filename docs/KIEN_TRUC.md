# Kiến trúc và giới hạn

OAuth / signed-session details: [AUTH_DEV.md](AUTH_DEV.md).

Nghiệp vụ liên kết và khởi tạo: [NGHIEP_VU_LIEN_KET.md](NGHIEP_VU_LIEN_KET.md). Sản xuất/kiểm kê/lương/lãi/phân bổ nợ dùng journal nhiều bảng, `_Workflows` lưu snapshot, `_Periods` khóa kỳ, `_JournalChunks` lưu payload lớn có hash. Preview không ghi; apply kiểm tra lại dữ liệu, quyền hiện tại kể cả retry, khóa kỳ và idempotency. Restore tạo workbook mới, không đổi nguồn đang chạy. Portal dùng workbook riêng.

Frontend SPA → `rpc(action,args)` → kiểm tra phiên/permission → schema/domain → LockService → journal PREPARED → ghi Sheet/audit → APPLIED → bump sync version. Backend chỉ công khai doGet/rpc có quyền truy cập dữ liệu; helpers kết thúc `_`. Pure functions được bundle cùng source không truy cập dịch vụ Google.

Source chia `src/client`, `src/shared`, `src/server`; build tạo Code.gs và HTML tự chứa. Dữ liệu nghiệp vụ trên client ở RAM, không preload trước login. IndexedDB chỉ giữ ID phiên/khóa HMAC không xuất được/expiry trong scope riêng, không lưu Google token, Client Secret hoặc dữ liệu nghiệp vụ. Cache bootstrap server tối đa 30 giây theo workbook/stamp/user/role/permissions/version, vẫn xác thực mỗi RPC trước khi dùng cache. Cache khóa ký mất thì từ chối; chống replay dùng `_AuthRequests`. Bootstrap tối đa 200 dòng/bảng và metadata phần còn lại; bảng phân trang server, báo cáo tải đủ chunk trước tính, CSV tải hết trang và kiểm tra stamp. Audit giữ trước/sau; payload lớn có hash và journal chunk, không cấp cho tài khoản thường.

17 bảng nghiệp vụ khai báo trong `src/shared/schema.js`. Metadata chung giữ nguyên. Có 9 bảng hệ thống gồm 6 bảng xác thực/journal cũ và `_Workflows`, `_Periods`, `_JournalChunks`. Header phải khớp; setup preflight và chỉ thêm bảng mới, không đổi cột nghiệp vụ hoặc suy ra snapshot cho dữ liệu quá khứ. Admin khởi tạo qua màn hình Nhật ký & đồng bộ. Mọi migration làm đổi cột hoặc dữ liệu cũ vẫn cần backup/đối chiếu riêng.

Ghi API so sánh cả version và hash toàn dòng. Dữ liệu sửa ngoài API không bị ghi đè âm thầm. Lock chỉ phối hợp các lệnh Apps Script, không khóa tay người đang sửa Sheet. Vì vậy transaction Sheets không ACID: journal và rollback giảm rủi ro, PREPARED chưa phục hồi sẽ chặn các lệnh ghi mới. Chủ file vẫn có thể sửa journal. Audit không phải log chống sửa tuyệt đối.

Phiếu stock/counts/production/sales/attendance/cash là bất biến qua API, đảo bằng phiếu tham chiếu reverses. Lịch sử giữ nguyên, các phép tính loại cả phiếu gốc đã đảo và phiếu đảo. Đảo cả phiếu rồi nhập phiếu mới là quy tắc correction hiện tại; chưa có partial reversal. Tài sản/công nợ/khoản vay là dữ liệu đầu vào có version; sổ quỹ ghi liên kết theo ID. Chi phí bán hàng thu hồi và sổ lương chưa phải ledger kế toán kép.

Giới hạn chủ động: tối đa 5.000 dòng/bảng, import 500 bản ghi/lô, công thức 100 thành phần. Chưa phân trang backend hoặc đo p95; khi vượt giới hạn trả lỗi rõ thay vì cắt dữ liệu. Không có offline queue tự ghi lại. Mutations timeout phải thử lại cùng key; app không tự retry ghi. Trạng thái thành công chỉ xuất hiện sau server xác nhận. Thao tác đảo/xóa có thể cần Đồng bộ để xác định kết quả sau mất mạng; chưa có hàng đợi bền vững qua reload.

Frontend giữ 32 route cũ nhưng nhiều màn hình đã chuẩn hóa theo form/table chung. Cần so sánh chi tiết phác thảo trước nghiệm thu; không xem số route bằng bằng chứng tương đương toàn bộ nghiệp vụ.

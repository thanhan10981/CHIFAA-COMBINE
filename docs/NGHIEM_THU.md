# Nghiệm thu trước bàn giao

Local: chạy `npm ci`, `npm run check`, `npm test`, `npm run build`. Hiện có 164 kiểm thử Node/DOM/mock đạt và đã review Chrome cục bộ desktop/390px/mẫu in, gồm khôi phục CryptoKey sau reload. Chưa thay cho UAT Google thật. Đợt mới đã nối 7 nhóm tại [NGHIEP_VU_LIEN_KET.md](NGHIEP_VU_LIEN_KET.md), giữ các nhận xét audit cũ làm lịch sử.

Các biện pháp đã có trong mã, cần kiểm chứng trên Google trước nghiệm thu số liệu:

- Chặn ca chấm công chồng giờ, kể cả ca qua đêm; không cộng lương trùng thời gian.
- Phân biệt thiếu chấm công/chi phí với đã xác nhận không phát sinh; không báo đủ đầu vào khi thiếu.
- Giữ đúng phiên bản công thức/định lượng cho phiếu và báo cáo lịch sử.
- Xác định và kiểm soát quy tắc thu/trả vượt số dư; sửa phần tổng hợp tài chính bị phụ thuộc quyền sổ quỹ không phù hợp.

Checklist nghiệp vụ liên kết DEV:

- Admin mở Nhật ký & đồng bộ, khởi tạo 3 bảng hệ thống, chạy lại không mất dữ liệu. Tài khoản thường không có quyền khởi tạo/bảo trì/khóa kỳ.
- Nhập tồn/giá hợp lệ rồi tạo sản xuất: tồn giảm đúng định mức chính + thêm; sửa công thức không đổi snapshot phiếu đã chốt. Thiếu tồn/giá phải không lưu cả lô. Đảo nguồn hoàn tác kho, đảo riêng phiếu tự động bị chặn.
- Kiểm kê tạo điều chỉnh đến tồn cuối; không ghi thêm hồi tố qua kiểm kê. Khóa kỳ chặn cả UI/API/import; mở lại cần Admin và lý do.
- Thu nợ theo từng khoản không vượt dư; phân bổ thu nợ cũ giảm nợ nhưng không cộng tiền lần hai. Trả gốc giảm lãi từ ngày trả; xem trước từng đoạn; không chi hai kỳ lãi giao nhau.
- Lương xem trước rồi chốt mới tạo chi, thưởng trong trần, không hai kỳ giao nhau; chấm công đã chốt bị khóa. Snapshot mở/in lại đúng số đã chốt; hoàn tác lô mới sửa được nguồn.
- Cấp tài khoản chỉ Khoản vay/Bảng lương + Phiếu liên kết: được ghi qua nghiệp vụ, không đọc cash, không giả mạo mutate ghi thẳng vào sổ không được chọn. Kiểm tra bằng hai Google accounts riêng và trực tiếp ACL workbook.
- Tạo backup vào thư mục riêng tư, restore thành workbook kiểm tra mới (không đổi nguồn đang chạy); import CSV/JSON không ghi ở preview, nguồn đổi buộc preview lại, retry không nhập đôi, journal chunk phục hồi được.
- Portal riêng chạy lịch 5 phút: công bố danh mục, nhập đơn một lần, trả trạng thái đã duyệt; thư mời khác không xem được mã đơn. Không share dữ liệu nhân viên/tài chính qua Portal.
- Phân trang 50 dòng, nguồn báo cáo tải đủ chunk, CSV đủ dòng, thay stamp giữa trang phải báo xung đột; in phiếu/lương/báo cáo đúng phạm vi.

Đã thử các ca tương ứng ở mock/DOM. Chưa thao tác khởi tạo/tạo chứng từ/Drive/trigger trên Google trong phiên này vì không có trình duyệt đăng nhập kết nối; không tự đánh dấu các mục Google đạt. Không suy ra giá vốn quá khứ cho phiếu cũ chưa snapshot; cần đối chiếu riêng.

Các bước Google bắt buộc, hiện chưa đánh dấu đạt:

- Nhập workbook mẫu, chạy setup hai lần; dữ liệu giữ nguyên, header/metadata/ledger được bảo vệ đúng tài khoản. Tài khoản app không được share backend vẫn làm việc qua owner-owned endpoint.
- Kiểm tra OAuth code/PKCE callback Apps Script trên desktop/mobile, state/secret ràng buộc tab/chữ ký/nonce/hết hạn; email ngoài allowlist bị từ chối, thư mời không truy cập nội bộ. Thực hiện toàn bộ [AUTH_DEV_UAT.md](AUTH_DEV_UAT.md), gồm hai Google accounts thật và ACL workbook.
- Chỉ một phiên Admin hoạt động: khôi phục phiên cũ không tạo phiên mới; cùng tài khoản xác minh Google mới sẽ thu hồi phiên cũ; một Admin khác không chiếm được phiên đang hoạt động. Thu hồi/recovery phải kiểm thử rõ ràng.
- Tài khoản read-only không gọi được endpoint create/update/delete/approve/export bằng console; thu hồi quyền phản ánh endpoint kế tiếp, UI xóa dữ liệu ở poll tiếp theo.
- Sửa một ô/dán nhiều ô/xóa giá trị/đổi tên/đổi giá danh mục trên Sheet. Giá thiếu/#REF không thành 0; version cập nhật; UI thấy thay đổi sau Đồng bộ/trigger; form cũ nhận CONFLICT và giữ nội dung để đối chiếu.
- Hai người ghi cùng dòng: một thành công, người sau nhận xung đột. Hai request cùng key chỉ có một phiếu. Mất mạng khi lưu không có thông báo thành công sớm.
- Phiếu kho đảo: tồn quay lại đúng, vẫn đủ audit. Setup không sửa hoặc xóa giao dịch cũ. Hủy phiếu tạo nhu cầu/thu tiền không bị đếm lại.
- Công thức lồng 3 cấp, vòng lặp, thiếu nguyên liệu, giá 0 thực sự, giá thiếu, giá thay đổi sau ngày báo cáo, quy đổi can/g có quy cách thật.
- Ca 23:00–07/08/09, nghỉ giữa ca, ca SX/VP/BH, phụ cấp ngày chỉ một lần; bảng lương theo từng nhóm và năng suất chỉ giờ SX.
- Sản xuất thêm/lỗi/hủy, hàng trả từng điểm bán về ki-ốt; xác nhận cách tái bán, chi hỗ trợ, hàng điểm bán chịu. Hiện ki-ốt được mô hình như một điểm bán, chưa có phiếu luân chuyển hàng trả tự động.
- Doanh thu tách thu tiền, công nợ cũ; chủ khách hàng chốt cách ghi nhận và ký duyệt bộ ví dụ tính tay. Hoàn thiện ledger tài chính nếu cần kế toán kép hoặc phân bổ khấu hao/lãi.
- Cổng khách dùng project/workbook riêng, chỉ món công bố; đặt đơn pending, import đúng một lần, duyệt/từ chối, nhu cầu không cộng trùng kế hoạch. Kiểm tra chống spam và chính sách thư mời với dữ liệu thật.
- 10 người thực tế: bootstrap, đổi tab, filter, batch write, polling; ghi p50/p95/quota và thời gian thao tác mobile, giảm animation theo prefers-reduced-motion.
- Sao lưu thật và restore thành file mới; đối chiếu tổng số dòng, tồn kho, doanh thu, sổ quỹ, quyền file. Chỉ đổi nguồn sau kiểm tra. Chính sách giữ backup do chủ dự án duyệt.
- So sánh từng mục trong MAPPING_GIAO_DIEN với phác thảo; các biểu mẫu/tính năng còn thiếu phải hoàn thiện trước khi ghi T19 DONE.
## Chiến lược kinh doanh — DEV v15

Đã làm lại bố cục theo phác thảo và kiểm tra cục bộ 127 test, desktop/điện thoại. Xem [cách dùng và cơ sở tính](CHIEN_LUOC.md). Trên DEV cần đối chiếu số thật với phiếu: chọn kỳ/ngày, kiểm tra xếp hạng và bảng chi tiết, nhập kịch bản rồi đặt lại; xác nhận không sinh phiếu mới. Thiếu giá/chấm công/sản xuất phải để trống kết quả, hàng trả không được gọi là hàng hủy. Các giới hạn kế toán và kiểm thử hai tài khoản trong tài liệu vẫn cần nghiệm thu; nâng cấp giao diện không đóng các lỗi audit khác.

## Rà soát kết nối và thông báo toast

Danh sách chức năng còn thiếu kết nối, mức đã có và nguồn mã: [KET_NOI_CHUC_NANG.md](KET_NOI_CHUC_NANG.md). Đã chạy lại audit mock; các lỗi ca chồng giờ, báo cáo chung thiếu chấm công, lịch sử công thức và thu/trả vượt vẫn còn. Đây là kết quả rà soát, không phải đã sửa các nghiệp vụ đó.

Toast góc trên bên phải: kiểm tra lưu/đảo/duyệt/xóa phiếu, đồng bộ thủ công, xuất CSV, quyền tài khoản/thu hồi phiên, đăng nhập/đăng xuất và đơn Portal. Lỗi mạng chưa xác nhận ghi phải là cảnh báo, không báo thành công. Thử lỗi khi dialog mở, đóng toast, trỏ chuột/focus để giữ thông báo, đăng xuất xóa nội dung cũ. Đồng bộ nền không được tạo toast thành công liên tục. Kiểm tra Chrome cục bộ desktop/390px và 132 test đạt; Google UAT còn chờ.


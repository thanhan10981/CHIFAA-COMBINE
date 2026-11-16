# Xuất / nhập Excel

Các nút Xuất CSV được đổi thành **Xuất Excel** cho toàn bộ phân hệ dùng bảng nghiệp vụ. File là `.xlsx` thật (OpenXML ZIP), không phải CSV đổi đuôi.

- Sheet Du_lieu: tiêu đề CHIFAA, nguồn/thời điểm/số bản ghi/mã đồng bộ, hàng tiêu đề cố định, bộ lọc, màu xen kẽ và cấu hình in A4 ngang.
- Tên cột tiếng Việt; số và ngày đúng kiểu Excel; phần trăm có định dạng riêng. Giữ ô trống khác số 0, giữ mã có số 0 đầu. Cột metadata gồm cả cờ xóa và phiếu đảo để không hiểu nhầm tổng lịch sử là số liệu còn hiệu lực.
- Sheet Chu_thich giải thích mã trường và tham chiếu. Các tham chiếu giữ mã gốc, không tự đọc thêm bảng ngoài quyền để lấy tên.
- Xuất tất cả trang qua RPC export đã xác thực; dừng nếu phiên hoặc sync stamp thay đổi khi lấy các trang. Nút có trạng thái chờ và toast.

Trong bảo trì, **Tải mẫu Excel** tạo sheet Nhap_lieu với hàng khóa cột giữ nguyên, định dạng cột, danh sách chọn và sheet Huong_dan. Chấp nhận `.xlsx`, vẫn giữ CSV/JSON cũ để tương thích. Excel tối đa 1 MB và 500 dòng; phải dùng sheet Nhap_lieu. Ngày trong mẫu: YYYY-MM-DD. Không nhận công thức Excel, hyperlink/rich cells; luôn qua previewImport/applyImport và kiểm tra backend hiện có. Chặn ZIP không hợp lệ, thành phần mã hóa, quá nhiều thành phần và kích thước giải nén khai báo quá 12 MB trước parser.

Chuỗi bắt đầu `=` vẫn là văn bản trong file xuất, không tạo công thức. Không thêm tính toán kinh doanh, không tự thay lỗi nguồn hoặc thiếu số liệu thành 0. Backup/restore giữ định dạng workbook native hiện có; không chuyển bản sao lưu thành file Excel tải xuống.

ExcelJS 4.4.0 cố định trong package-lock; bản tối ưu17/11 tách browser bundle thành **ExcelRuntime.html**, tải qua publicAsset allowlist khi dùng Excel, kiểm tra SHA256 trước thực thi. CacheStorage tùy chọn chỉ lưu mã thư viện công khai, không lưu dữ liệu nghiệp vụ; cache lỗi/tắt thì tải lại. Không CDN, không gửi dữ liệu ra ngoài. 948KB này không còn nằm trong Index tải ban đầu. Preview local vẫn nhúng bản inert để xuất Excel offline. Deploy cần đủ5file kể cả ExcelRuntime.html; schema không đổi. License: assets/licenses/ExcelJS-LICENSE.txt; upstream https://github.com/exceljs/exceljs.

185 local/mock tests đạt; syntax52/build đạt. Các ca mới kiểm tra mở lại XLSX, 5.101 dòng, Unicode/kiểu dữ liệu/ô trống, mẫu nhập lại, công thức/link, ZIP guard và UI phân trang/xử lý đổi phiên. Chưa mở bằng Microsoft Excel thật hoặc kiểm tra tải file trên Apps Script trong trình duyệt Google; chưa tuyên bố đã UAT trực quan.

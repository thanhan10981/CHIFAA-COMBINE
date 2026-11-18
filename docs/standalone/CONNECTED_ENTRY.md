# Nhập liệu liên thông và nguồn phát thảo —032

Yêu cầu chủ dự án18/11/2026: lấy dữ liệu phần Nhập liệu trong HTML được cung cấp, có đủ các mục con và dùng chung logic nghiệp vụ. Đã đọc AGENTS, MASTER_SPEC và KH-01..KH-10; KH-11 dùng công thức đã triển khai, không công bố lại công thức từ ảnh.

## Nguồn và cách nhập

Nguồn HTML được đọc bằng AST literal, không chạy JavaScript hoặc sự kiện trong tệp. Hash nguồn và nội dung gốc lưu riêng trong `private.entry_source_rows`; dữ liệu riêng chỉ nằm trong ignored output/database, không Git. LocalStorage của trình duyệt không nằm trong HTML nên không được giả lập là dữ liệu đã cung cấp.

- 63 vật tư,11 điểm bán,11 món,5 nhân viên: lưu nguồn đối chiếu, dùng lại UUID/danh mục hiện có, không nhập chồng danh mục hoặc đổi giá/lương/quy đổi đã xác minh.
- 2 khoản vay: nhập theo tên/mã/người cho vay, ngày, gốc và kỳ hạn có trong nguồn. Không tự cộng tiền đầu kỳ; lãi suất nguồn chỉ tham khảo, lãi thực trả nhập bằng tiền theo D28.
- 4 tháng kế hoạch có literal,29 giá trị mục tiêu xác định: nhập theo tháng. Tháng/chỉ tiêu trống vẫn không có giá trị; không tự suy doanh thu các tháng khác. Các tỷ lệ chi phí dùng net_revenue theo D01, giữ nguyên nguồn để truy khác biệt với bản minh họa.
- 33 dòng sổ quỹ tháng10/2026: giữ bảng lịch sử chỉ đọc đúng như bản phát thảo. Không dựng phiếu bán/phân bổ thu nợ/tồn tiền đầu kỳ từ khoản thu gộp chưa có chứng từ chi tiết; không cộng vào quỹ vận hành lần nữa.
-Stock/sales/attendance/production/debts/cash của các phiếu nhập mới trong v9Blank vốn là mảng rỗng. Không tạo phiếu công, doanh thu, tồn, lương giả từ số minh họa hoặc KPI tổng hợp.

Gói logic `output/CHIFAA_PATCH_NHAP_LIEU_DEV.sql` sau031, chỉ cấu trúc. Gói dữ liệu `output/CHIFAA_DU_LIEU_PHAT_THAO_DEV.sql` sau032, một DO nguyên tử. Chạy lại nguồn cùng hash/key không sinh trùng; xung đột khoản vay/mục tiêu hiện có dừng để đối chiếu, không ghi đè. Không chạy bootstrap hoặc nhập lại gói danh mục cũ.

## Các luồng dùng chung

| Mục | Nguồn chuẩn / liên kết |
| --- | --- |
|01 Kiểm kho| Bảng kho hiện có, kiểm kê từng dòng hoặc Phiếu kiểm kê chung cùng `stock_counts`, token tồn và điều chỉnh nguyên tử; không thêm sổ đếm riêng. |
|02 Doanh thu & thanh toán| Phiếu bán snapshot giá/CK theo điểm/ngày từ `commercial_offer`; lượng bán + điểm chịu tạo doanh thu D02, thu hồi riêng. Phiếu bán tạo receivable; tiền thu chọn khoản nợ và tài khoản, phân bổ giảm nợ và tăng quỹ cùng giao dịch. |
|03 Chấm công3 bộ phận| Nhân viên chung, ngày giờ ca đầy đủ + nghỉ, bộ phận chọn rõ cho ca hoặc theo danh mục, lương giờ snapshot, phụ cấp/hỗ trợ/ứng/trừ nhập rõ. Ca sửa đảo trạng thái cũ và ghi ca thay thế có journal, không xóa lịch sử. |
|04 Sản xuất thêm & thu hồi| Dùng luồng031 chính/thêm/lỗi, xuất định mức; liên kết đúng ngày sang phiếu bán và thu hồi đã duyệt. Thu hồi/nhận về vẫn dùng kiosk workflow có nguồn, không tăng sản xuất hoặc doanh thu chỉ vì nhận lại. |
|05 Kế hoạch & mục tiêu| Mục tiêu theo tháng, token ID phiên bản trước và journal; trần tỷ lệ0..100, nguồn thiếu không tự điền0; tỷ lệ chi phí trên net revenue theo D01. |
|06 Khoản vay| Vay đầu kỳ hoặc nhận vay mới có lựa chọn thu quỹ rõ ràng; trả gốc/lãi một lần, giảm gốc và chi quỹ; không tự tính lãi bằng tỷ lệ nguồn. |
|07 Công nợ| Phải thu từ bán hàng hoặc đầu kỳ, phải trả nhà cung cấp độc lập; phân bổ thu/chi đúng khoản và tài khoản, chặn vượt nợ. Thu nợ cũ không tạo doanh thu hôm nay. |
|08 Sổ quỹ| Đọc chung cash_ledger từ phiếu thu, vay, công nợ NCC, lương, chi phí; các khoản góp/rút vốn/thu chi khác có phân loại riêng. Chưa có số đầu kỳ xác nhận thì số dư vẫn chưa xác định. Không nhập lại một lần tiền đã tự ghi từ chứng từ nguồn. |
|09 Bảng lương| Tính từ ca posted và pay snapshots + phụ cấp tháng mới nhất đúng1 lần; người làm nhiều bộ phận hiện MULTI, không tự chia phụ cấp vào SX. Chốt dùng source version, khóa tháng chống thêm/sửa ca/phụ cấp. Chốt không tự chi quỹ; thanh toán lương có liên kết duy nhất. |

`entry_workspace` đọc theo quyền hiện hành; nguồn/lịch sử chấm công bỏ lương/phụ cấp khi thiếu payroll:view. `submit_entry` kiểm tra quyền nghiệp vụ và quyền liên quan, ngày khóa, chứng từ, exact numeric/bigint, idempotency và journal. Không nhận giá bán/CK từ client. Ngày nghiệp vụ giữ qua các liên kết; ghi nhận lúc thực hiện riêng trong audit.

Nhập bù dùng ngày cũ còn mở; mỗi phiếu mới là phần phát sinh thêm. Lịch sử hỗ trợ thay phiếu bán chưa thu/thu hồi, ca chưa chốt lương và mục tiêu, luôn tham chiếu bản cũ. Phiếu tài chính đã thu/chi không có UI đảo/chỉnh riêng trong checkpoint này; API chặn ghi đè bằng LINKED_ADJUSTMENT_REQUIRED/SETTLED_DOCUMENT_ADJUSTMENT_REQUIRED. Chỉnh toàn bộ ngày tài chính sau quyết toán và mở lại lương đã chi còn là workflow riêng, không tuyên bố đã hoàn tất KH-09 cho mọi phân hệ. Không chuyển số lịch sử chỉ đọc thành sổ quỹ chính thức khi chưa có phân bổ/đầu kỳ xác minh.

## Kiểm chứng và triển khai

`npm run verify`:104 tests,93 public tables/58 RPCs, types/lint/build. Chrome fixture50 tổ hợp10 màn ×5 kích thước, retry cùng key/payload và phiếu100/80/10/10. Nguồn thật được thử nhập hai lần trong PostgreSQL nhúng:132 dòng nguồn,2 khoản vay,29 giá trị mục tiêu,0 phiếu bán/ca/quỹ/kho tự phát sinh. Không phải UAT authenticated cloud.

SQL DEV phải được owner chạy trước khi phát hành UI032; kết quả032_READY rồi032_SOURCE_READY. Giữ bản trước031 nếu SQL chưa sẵn sàng. Không tự áp SQL cloud. Khi rollback giao diện, giữ schema/source/journal mới nguyên trạng; không xóa các giao dịch đã ghi. Trạng thái phát hành thực tế theo HANDOFF và ignored `output/entry-release-status.json`.

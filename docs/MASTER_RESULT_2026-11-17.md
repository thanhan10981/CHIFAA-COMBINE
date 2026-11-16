# Bàn giao master CHIFAA COMBINE — DEV32

Hai deployment DEV hiện có đã ở **bản 32**. Source đầu đợt khớp bản28, trước bản cuối khớp bản31; bản32 được đọc lại và đối chiếu đủ5file. Không tạo deployment công khai mới, không thay scope/ACL/dữ liệu nghiệp vụ/hai workbook gốc. Chưa nghiệm thu vận hành chính thức.

| Nhóm | Phần đã có backend, giao diện và kiểm thử |
| --- | --- |
| Xác thực | Google HTTP ngoài khóa; ngân sách OAuth; phiên server tồn tại qua cache eviction, vẫn có TTL/chữ ký/nonce và kiểm tra quyền |
| Quản trị | Nhãn thiết bị tự khai, lastSeen server, cảnh báo/ack; thu hồi xóa cả khóa cache và server |
| Thu hồi & ki-ốt | Duyệt→thực nhận→bán từ lô→hoàn tác ngược; không tăng tồn trước nhận hoặc doanh thu trước bán |
| Nhập có kiểm tra | NEW/BACKFILL/APPEND/CORRECT, lý do, preview/diff, kiểm tra nguồn, đảo+thay+liên kết kho trong một giao dịch |
| Báo cáo/kho | Năng suất tổng và đạt riêng, hao hụt%, sửa cột báo cáo, giữ0,001kg, tách điều chỉnh kiểm kê khỏi nhập thực tế |
| Chấm công | Chặn ca giao nhau qua đêm/phụ cấp lặp cả khi sửa trực tiếp Sheets trước chốt lương |
| Đơn→kế hoạch | Liên kết đơn duyệt vào phần kế hoạch còn trống, đúng món/hash; không tự tăng sản lượng/xuất kho |
| Bảo trì | Kiểm tra nguồn/schema chỉ đọc, backup có manifest/consistency, chặn restore bản bị đổi hoặc chưa xác nhận |
| Hiệu năng | Index tra cứu nhật ký, cache quyền/phiên bản, API mới trả100dòng/trang và dùng hàng đợi đọc |

**Bằng chứng:**273/273 kiểm thử Node/DOM/GAS mock; syntax83file; build và parse bundle đạt. Log `output/master-m08-tests.txt`; readback `output/chifaa-dev/master-version32-readback.json`. CLI xác nhận hai DEV@32 và lịch sử@2 không đổi. CUA vẫn `apps:[],browsers:[]`: chưa Google hai tài khoản/ACL/popup/trigger/Drive/concurrency/visual UAT. Dashboard chỉ trả tổng lương theo bộ phận, chi tiết qua API lương phân trang.

Các nút mới: Kho & tồn kho→Thu hồi & ki-ốt; trang phiếu→Nhập có kiểm tra/Bổ sung & điều chỉnh; đơn đã duyệt→Liên kết kế hoạch; Nhật ký & đồng bộ→Kiểm tra nguồn/schema/toàn vẹn backup; quản trị→cảnh báo/phiên.

Điều chỉnh thay **một phiếu được chọn**:100gốc+30bổ sung, sửa riêng gốc thành90 thì tổng120. Muốn tổng90 cần đối chiếu các phiếu còn hiệu lực; không tự xóa30bổ sung.

Ki-ốt mới chốt số lượng; D16 giá trị/lô/hạn và phân bổ giá vốn chờ xác nhận. Liên kết đơn không tự merge/split/tăng kế hoạch. Lợi nhuận còn tạm tính; không bật `ACCOUNTING_APPROVED`. Migration DB dòng công thức/giá hiệu lực và dữ liệu hai workbook gốc chưa được tự suy đoán.

Backup kiểm tra các bảng đã biết. Cache/Script Properties/bảng ngoài schema không thuộc cam kết kiểm chứng; khóa phiên và Client Secret không nằm trong workbook backup. Backup cũ thiếu manifest cần đối soát riêng; bản không nhất quán không được phục hồi qua API. Restore chỉ tạo workbook kiểm tra, không đổi nguồn đang chạy.

Cache báo cáo có thể cũ trong thời hạn ngắn; màn hình ghi thời điểm kiểm tra và có tải lại cưỡng bức. Ghi dữ liệu luôn kiểm tra lại nguồn/quyền/phiên/xung đột. Cold read ki-ốt/liên kết còn đọc đủ lịch sử nguồn liên quan; số đo local không là SLA Google. Bài đo chi tiết ở PERFORMANCE_REPORT.md.

Không chạy setup chỉ để cập nhật UI. Nếu thiếu bảng nghiệp vụ liên kết cũ, Admin dùng nút khởi tạo DEV; preflight chặn cột sai trước khi ghi header.

`OAUTH_STARTS_PER_MINUTE` tùy chọn: mặc định30, nhận10–120, ngân sách toàn app. Không chỉnh tay `SESSION_KEY_INDEX`, `session-key:*`, metadata phiên/ledger. Khóa phiên server có TTL/thu hồi và chỉ mục giới hạn80; phiên cache cũ hợp lệ được chuyển một lần, không kéo dài hạn. Script Properties chỉ dành cho chủ sở hữu/dự án đáng tin, không chia sẻ cho nhân viên.

Nguồn giới hạn chính thức: [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas), [Cache có thể bị thu hồi trước hạn](https://developers.google.com/apps-script/reference/cache/cache). Giới hạn80 là thiết kế ứng dụng; không thay nghiệm thu quota thực tế.

**Rollback:** ưu tiên sửa tiếp trên code hiểu ledger mới. Nếu buộc quay code28, chủ sở hữu dừng ghi bằng cách tạm đặt `AUTH_ENV` sang giá trị bảo trì, rồi đổi cả hai deployment về bản đã xác minh. Giữ toàn bộ dữ liệu/Script Properties. Không mở lại ghi với code28 khi đã có giao dịch ki-ốt/liên kết/entry29 mà chưa đối soát tương thích; code cũ không biết đầy đủ ràng buộc mới. Không xóa lịch sử để làm code cũ chạy.

**Cần con người:** hai tài khoản Google, ACL thật, popup/mở lại phiên, cài/đo lịch, Drive restore drill, tài nguyên Portal riêng, hai workbook gốc và các quyết định tại DECISIONS_REQUIRED.md. Đây là các cổng chưa hoàn tất, không được đánh dấu PASS từ273test local.

## Bổ sung bản32

Source commit `7f3bf88`; hai deployment DEV32 đã xác minh CLI và readback đủ5file. Không thay dữ liệu nghiệp vụ hoặc ACL. Nhóm M09: thiếu sản lượng thực tế/giờ SX hoặc còn giá vốn ki-ốt chưa chốt thì giá vốn/lợi nhuận liên quan hiển thị Chưa đủ dữ liệu; chi phí0 được nhập rõ vẫn được giữ. Ô đơn giá nhập tùy chọn để trống. Backup báo rõ tình trạng kiểm chứng.

Cấu hình tĩnh được nạp gộp theo từng RPC; phiên, quyền, nonce, khóa ghi và phiên bản dữ liệu vẫn kiểm tra mới. Mock Properties calls sync31→5, summary59→12, mutate64→9; đây không là kết quả quota Google. Poll nền60giây khi hiện trang, quay lại kiểm tra sau tối thiểu15giây kể từ lần gần nhất; trang ẩn không poll. Phát hiện sửa Sheets phụ thuộc lịch trigger/lát quét; fallback toàn nguồn5phút cần cài và đo thật. Nút tải lại thủ công còn nguyên.

Pending write còn trong RAM: chuyển trang nội bộ có giữ khóa yêu cầu; đóng/reload khi chưa ACK cần đối soát request/journal trước khi lập lại. Chưa có durable business outbox/draft. Xem MASTER_M09_2026-11-17.md và PERFORMANCE_REPORT.md.

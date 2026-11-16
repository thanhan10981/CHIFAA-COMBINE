# 06 — BỘ KIỂM THỬ NGHIỆM THU BẮT BUỘC

**Cách ghi:** Mỗi test có `TEST_ID`, `REQ_ID`, Arrange–Act–Assert, log thực thi, ảnh/video (nếu UI), tiêu chí PASS/FAIL/BLOCKED. Chạy trên workbook DEV, không dùng dữ liệu kế toán thật. Các test kế toán còn thiếu policy phải ghi `BLOCKED_DECISION`, không giả số expected.

## A. Khởi tạo, dữ liệu và migration

| Test | Tình huống | Kết quả bắt buộc |
|---|---|---|
| T-001 | `setup` trên workbook DEV mới | Tạo chính xác các bảng/schema/version/protection; Admin được đăng ký một lần |
| T-002 | Chạy lại setup hai lần | Không nhân đôi bảng/dòng/tài khoản, không xóa dữ liệu |
| T-003 | `SPREADSHEET_ID` nhập cả URL | Cấu hình báo rõ phải dùng ID, không phá dữ liệu |
| T-004 | Thay header/ID cột bất hợp lệ | Phát hiện SCHEMA mismatch và chặn ghi sai cột |
| T-005 | Import 2 workbook legacy | Có preview mapping/count/tổng, không sửa nguồn, log `#REF!` là null/error |
| T-006 | Import batch lần hai cùng khóa | Không nhân đôi dữ liệu, trả kết quả idempotent |
| T-007 | Giá vật tư trống/công thức nguồn `#REF!` | Cost và KPI liên quan `INCOMPLETE`, không hiển thị 0 hợp lệ |
| T-008 | Backup hằng ngày & restore trên workbook mới | So row count/foreign keys/số dư; nguồn cũ không bị thay |

## B. Xác thực và phân quyền

| Test | Tình huống | Kết quả |
|---|---|---|
| T-010 | Gmail Admin có trong `_Users`, enabled | Google auth POC hợp lệ và RBAC Admin hoạt động |
| T-011 | Gmail kế toán được cấp read sales, không cấp payroll | Sales load được; payroll RPC/export trực tiếp bị FORBIDDEN |
| T-012 | Gmail ngoài `_Users`/disabled | Không đọc bất kỳ business dataset/endpoint nào |
| T-013 | Mở `/exec` khi chưa xác thực | Không leak lương, cost, email khách hoặc tài chính ở HTML/JSON |
| T-014 | Admin login trên thiết bị B khi A còn active | Chặn/luồng chính sách, ghi cảnh báo trong Cài đặt; không tạo hai active |
| T-015 | Admin thu hồi session, client cũ gọi API | Không còn được truy cập, cache sensitive invalidated |
| T-016 | Kế toán tự gọi mutation module không có quyền | Bị chặn **trên server**, không phụ thuộc menu ẩn |
| T-017 | Token sai/expired/nonce reused/CSRF | Reject và audit, không mở session |
| T-018 | Google iframe OAuth có `no registered origin` | Được sửa bằng luồng auth đã test thực tế hoặc `BLOCKED`, không bypass |
| T-019 | Xem data trực tiếp qua Sheets bằng Gmail chỉ có quyền app | Không xem được workbook nhạy cảm trái quyền UI |
| T-020 | Khách cố gọi internal RPC export/_Users | Reject, không leak nội bộ |

## C. Danh mục, đơn vị, công thức

| Test | Tình huống | Kết quả |
|---|---|---|
| T-030 | App thêm vật tư, Sheets xem | Row mới có ID/UOM/version, hiển thị đúng |
| T-031 | Sheets sửa tên/đơn giá master được phép | App sau sync thấy thay đổi, revision/audit cập nhật |
| T-032 | Sheets sửa mã ID/header/meta protected | Bị cấm hoặc detect/quarantine, không làm hỏng bảng |
| T-033 | Sửa đồng thời app version 5 vs Sheets version 6 | App conflict, hiển thị diff, không overwrite |
| T-034 | 1kg → gram | Chính xác 1000g; giá/kg → giá/g đúng |
| T-035 | 4,5 can không có netContent/can | Không tự chuyển ra kg, cảnh báo thiếu quy cách |
| T-036 | Món tham chiếu nhân/sốt và nguyên liệu trùng ở nhiều công thức con | Tổng material được gộp đúng và có breakdown |
| T-037 | Recipe A→B→A | Reject vòng lặp, giữ bản trước |
| T-038 | Sửa đơn giá hôm nay | Cost dự kiến đổi; snapshot lịch sử đã chốt không đổi |
| T-039 | 100 phần × 114g cơm chín, yield 2,5kg/kg gạo | 11,4kg cơm chín, 4,56kg gạo khô |
| T-040 | 1 phần có giá vật tư chưa biết/0 chưa xác minh | Không hiện total cost chính thức bằng 0 |

## D. Sản xuất, nhu cầu, kho

| Test | Tình huống | Kết quả |
|---|---|---|
| T-050 | Lập kế hoạch 100 phần cho sáng mai | Nhu cầu tính cho ngày giao, không nhập nhầm ngày lập |
| T-051 | SX chính 100, SX thêm 20, lỗi 2 | Tổng 120, tỷ lệ lỗi `2/120=1,666...%`, có nhãn làm tròn |
| T-052 | SX 1000 phần/tuần từ nhiều món | Nhu cầu từng material cộng toàn bộ recipe đúng UOM |
| T-053 | Tương ớt từ 7 món | Mức dùng lý thuyết cộng đủ cả 7, không chỉ một món |
| T-054 | Định mức 4,5 can, thực dùng 5 can sau quy đổi hợp lệ | Chênh +0,5 can / +11,11%; không kết luận gian lận |
| T-055 | Gạo 45,6kg định mức, 48kg thực dùng | Chênh +2,4kg / +5,26% |
| T-056 | Không có tồn đầu kỳ kiểm kê | Không kết luận hao hụt, status incomplete |
| T-057 | Tồn 20kg, tối thiểu 30kg | Cảnh báo thiếu 10kg, link sang bổ sung hàng |
| T-058 | Kế hoạch mai vượt tồn 5kg | Cảnh báo thiếu dự kiến; chưa tự xuất kho khi mới lập kế hoạch |
| T-059 | Ghi kiểm kê và bút toán điều chỉnh | Không trừ kho 2 lần; có audit/duyệt |
| T-060 | Các dữ liệu thành phẩm thu hồi | Không cộng vào giá trị kho NVL/bọc; tồn kiosk riêng |

## E. Bán hàng, thu hồi kiosk và thu tiền

| Test | Tình huống | Kết quả |
|---|---|---|
| T-070 | Giao 100, bán 80, thu hồi 10, khách tự chịu 10 | Bốn lượng riêng, tổng cân bằng, không tự hủy 10 |
| T-071 | Phê duyệt 10 thu hồi, kiosk chưa nhận | Doanh thu có phiếu thu hồi; tồn vật lý kiosk chưa tăng |
| T-072 | Kiosk nhận 10 | Kiosk +10 một lần theo returnId, không tự xem là bán |
| T-073 | Refresh/retry receipt cùng returnId | Tồn kiosk vẫn +10, không thành +20 |
| T-074 | Kiosk bán lại 6 | Kiosk giảm 6, có dòng sale riêng, không cộng doanh thu về điểm ban đầu |
| T-075 | Giá bán 15.000; giá hỗ trợ 5.000 | Lưu hai snapshot khác nhau; rule bù trừ P0 nếu chưa chốt không đưa net chính thức |
| T-076 | Chiết khấu 15% cho điểm A món X, 0% điểm B | App tính theo đúng cặp điểm × món × hiệu lực |
| T-077 | 100 phần giá 15.000, chiết khấu 15% trên đủ 100 sold | Gross=1.500.000; discount=225.000; after discount=1.275.000 (chỉ trong case sold=100) |
| T-078 | Phiếu có tiền mặt 510.000, bank 510.000 | Total received=1.020.000, không tự đồng nhất với doanh thu nếu còn AR |
| T-079 | Cùng phiếu doanh thu hiển thị ở sổ quỹ | Không cộng tiền nhận 2 lần |
| T-080 | Thu tiền công nợ kỳ trước | Phải thu giảm, tiền tăng, **không làm tăng net sales kỳ mới** |
| T-081 | Điểm bán ghi hàng hủy và hàng trả | Hai tỷ lệ khác nhau, không nhập thành một cột |
| T-082 | Bán 80 + trả 10 + chịu 15 trên giao 100 | Chặn vì tổng > giao |

## F. Nhập bù/bổ sung/sửa; chấm công và lương

| Test | Tình huống | Kết quả |
|---|---|---|
| T-090 | Hôm nay mặc định | Form chọn ngày hiện tại VN |
| T-091 | Ngày quá khứ chưa có phiếu | Nhập bù tạo chứng từ mới đúng ngày, có lý do |
| T-092 | SX ban đầu 100 → bổ sung +30 | Tổng 130, không ghi đè 100 |
| T-093 | Sau đó sửa số cuối =90 | Tổng 90, audit 100/+30/→90, không cộng 90 thêm |
| T-094 | Mở lại ngày sáng đã nhập | Hiển thị dữ liệu buổi sáng để chiều bổ sung, không tạo trùng |
| T-095 | Ca 23:00→07:00/08:00/09:00 | 8/9/10 giờ, không âm |
| T-096 | Ca 23→09, 15k/giờ, 10k phụ cấp ca, 15k phụ cấp ngày, 5k hỗ trợ | Tổng 180k, bảng lương nhóm SX đúng |
| T-097 | Hai ca cùng NV ngày, phụ cấp chính sách theo ngày | Phụ cấp default theo ngày chỉ tính một lần |
| T-098 | NV đổi lương và bộ phận sau khi chốt ca | Lương/bộ phận của ca cũ vẫn snapshot |
| T-099 | Giờ SX=10, VP=20, BH=5; SX tạo 120 phần | Năng suất 120/10=12 phần/giờ, không chia 35h |
| T-100 | Khoản ứng 700.000 từ file cũ chưa biết NV | Chờ xác minh, không tự gán vào ai |

## G. Kế hoạch, Dashboard, Chiến lược

| Test | Tình huống | Kết quả |
|---|---|---|
| T-110 | Kế hoạch doanh thu tháng 260tr/26 ngày bán (minh họa) | Kế hoạch ngày = 10tr; có nguồn và kỳ |
| T-111 | Doanh thu hôm nay 12tr, hôm qua 10tr | Tăng +20%; null nếu ngày thiếu |
| T-112 | So Thu 12/11 vs Thu 05/11 | Đúng hai ngày cùng thứ, không lệch tuần |
| T-113 | Tuần chưa kết thúc | Hiển thị lũy kế tuần có nhãn độ phủ, không coi ngày tương lai là 0 |
| T-114 | Trần nhân sự SX 15%, labor 12% trên dữ liệu đầy đủ, SX vượt plan | Hiện dư trần tham khảo = (15%-12%)×basis, không tự chi thưởng |
| T-115 | Trần 15% nhưng thiếu lương SX hoặc net revenue | `NOT_READY`, không hiện tiền thưởng giả |
| T-116 | Food cost ratio 32,2% theo cơ sở đã chốt | Tính đúng, hiện target và trạng thái |
| T-117 | Tồn vật tư dưới min ở màn kho | Báo cáo sếp có số lượng mã thiếu và drilldown đúng |
| T-118 | Chỉ tiêu chưa cấu hình | Xám “Chưa thiết lập”, không xanh/0 |
| T-119 | 8 biểu đồ chiến lược | Đổi bộ lọc đúng dataset, không lẫn demo/thật |
| T-120 | Break-even margin≤0 | Không cho số lượng hòa vốn giả |
| T-121 | 100đ doanh thu phân bổ | Các tỷ lệ trên cùng basis, tổng đúng/ghi “chi phí chưa phân loại” nếu thiếu |

## H. Cổng khách, đồng bộ, UI, deploy

| Test | Tình huống | Kết quả |
|---|---|---|
| T-130 | Khách tạo đơn mới 30 phần | Lưu PENDING, internal duyệt trước khi gửi sang plan |
| T-131 | Duyệt đơn hai lần/retry | Plan chỉ thêm một lần, ref orderLineId rõ |
| T-132 | Người ngoài xem dữ liệu lương/cost/đơn khác | Bị chặn server |
| T-133 | Sửa master trực tiếp Sheets khi app đang mở | UI thấy revision mới trong giới hạn sync đo thực tế |
| T-134 | Google Sheets sửa qua API/Apps Script khác | Periodic reconciliation phát hiện dù onEdit không kích hoạt |
| T-135 | Hai user edit cùng row | Có conflict, không silent overwrite |
| T-136 | Net timeout khi gửi write, retry cùng idempotencyKey | Không ghi trùng tiền/SL/kho |
| T-137 | Mất mạng khi đang lưu | UI không báo success, draft có trạng thái chưa gửi; không tạo chứng từ ảo |
| T-138 | 10 user đồng thời thao tác | Không lộ dữ liệu và không lost update, có perf/lock metrics |
| T-139 | Sidebar mở/đóng các menu/đổi tab | Không vỡ label Doanh thu/Chấm công/Sản xuất ở desktop/mobile |
| T-140 | Animations với OS reduced-motion | Giảm/tắt animation, không ảnh hưởng thao tác |
| T-141 | Giao diện public trước login | Không embed bảng lương/công nợ/dữ liệu nội bộ |
| T-142 | Sửa code local rồi mở `/exec` | Chưa thay tới khi push+new version; tài liệu hướng dẫn đúng |
| T-143 | Chỉnh sửa HTML/CSS không đổi schema | Không phải chạy lại `khoiTaoDEV` |
| T-144 | `clasp push` rồi new version trên deployment cũ | URL `/exec` giữ nguyên, code mới hoạt động |
| T-145 | Sau rebuild V17 logo | Logo là ảnh gốc, không có asset thay thế và sidebar hiển thị đúng |

## Trạng thái báo cáo test

Bắt buộc có `TEST_REPORT.md`: tổng pass/fail/blocked; time, môi trường DEV, commit SHA, data fixtures, screenshots, RPC latency summary, source IDs được mask. **Không được mô tả “đã kiểm tra” nếu chưa chạy kiểm thử tự động/thực tế và có bằng chứng.**

# Báo cáo kiểm thử theo bộ yêu cầu

Thời điểm UTC: 2026-11-16T14:54:08.335Z; ngày Việt Nam 2026-11-16. HEAD: 90f7925; working tree dirty, không gán kết quả cho riêng HEAD. Baseline Node/DOM/GAS-mock: **166 pass / 0 fail / 166 tests**. Log: output/requirements-baseline-tests.txt (local, không commit dữ liệu nhạy cảm). Syntax47 và build đã chạy đạt cùng phiên.

Mock Sheets/Drive/OAuth đều là fixture RAM, không gọi Google. Local tests không chứng minh Gmail/ACL/trigger/quota hay số liệu thật. Chưa chạy Google/browser/UAT/10-user load/legacy import. Không có latency Google P50/P95; không bịa số. Mã IDs tài nguyên thực tế không đưa vào báo cáo này.

Bộ acceptance gốc có 93 ca. Bảng dưới là **trạng thái toàn bộ tiêu chí của ca**, không đổi tên 166 test local thành 166 ca Google. LOCAL_REVIEW nghĩa đã có một phần unit/mock liên quan nhưng cần test exact/luồng đầy đủ; không phải PASS. BLOCKED_DECISION phải cập nhật sau khi policy đã triển khai và có test.

| TEST_ID | Toàn tiêu chí | Tiêu chí nguồn |
| --- | --- | --- |
| T-001 | LOCAL_REVIEW / NOT_ACCEPTED | `setup` trên workbook DEV mới / Tạo chính xác các bảng/schema/version/protection; Admin được đăng ký một lần / |
| T-002 | LOCAL_REVIEW / NOT_ACCEPTED | Chạy lại setup hai lần / Không nhân đôi bảng/dòng/tài khoản, không xóa dữ liệu / |
| T-003 | LOCAL_REVIEW / NOT_ACCEPTED | `SPREADSHEET_ID` nhập cả URL / Cấu hình báo rõ phải dùng ID, không phá dữ liệu / |
| T-004 | LOCAL_REVIEW / NOT_ACCEPTED | Thay header/ID cột bất hợp lệ / Phát hiện SCHEMA mismatch và chặn ghi sai cột / |
| T-005 | BLOCKED_GOOGLE | Import 2 workbook legacy / Có preview mapping/count/tổng, không sửa nguồn, log `#REF!` là null/error / |
| T-006 | LOCAL_REVIEW / NOT_ACCEPTED | Import batch lần hai cùng khóa / Không nhân đôi dữ liệu, trả kết quả idempotent / |
| T-007 | LOCAL_REVIEW / NOT_ACCEPTED | Giá vật tư trống/công thức nguồn `#REF!` / Cost và KPI liên quan `INCOMPLETE`, không hiển thị 0 hợp lệ / |
| T-008 | BLOCKED_GOOGLE | Backup hằng ngày & restore trên workbook mới / So row count/foreign keys/số dư; nguồn cũ không bị thay / |
| T-010 | BLOCKED_GOOGLE | Gmail Admin có trong `_Users`, enabled / Google auth POC hợp lệ và RBAC Admin hoạt động / |
| T-011 | BLOCKED_GOOGLE | Gmail kế toán được cấp read sales, không cấp payroll / Sales load được; payroll RPC/export trực tiếp bị FORBIDDEN / |
| T-012 | BLOCKED_GOOGLE | Gmail ngoài `_Users`/disabled / Không đọc bất kỳ business dataset/endpoint nào / |
| T-013 | BLOCKED_GOOGLE | Mở `/exec` khi chưa xác thực / Không leak lương, cost, email khách hoặc tài chính ở HTML/JSON / |
| T-014 | BLOCKED_GOOGLE | Admin login trên thiết bị B khi A còn active / Chặn/luồng chính sách, ghi cảnh báo trong Cài đặt; không tạo hai active / |
| T-015 | BLOCKED_GOOGLE | Admin thu hồi session, client cũ gọi API / Không còn được truy cập, cache sensitive invalidated / |
| T-016 | BLOCKED_GOOGLE | Kế toán tự gọi mutation module không có quyền / Bị chặn trên server, không phụ thuộc menu ẩn / |
| T-017 | BLOCKED_GOOGLE | Token sai/expired/nonce reused/CSRF / Reject và audit, không mở session / |
| T-018 | BLOCKED_GOOGLE | Google iframe OAuth có `no registered origin` / Được sửa bằng luồng auth đã test thực tế hoặc `BLOCKED`, không bypass / |
| T-019 | BLOCKED_GOOGLE | Xem data trực tiếp qua Sheets bằng Gmail chỉ có quyền app / Không xem được workbook nhạy cảm trái quyền UI / |
| T-020 | BLOCKED_GOOGLE | Khách cố gọi internal RPC export/_Users / Reject, không leak nội bộ / |
| T-030 | BLOCKED_GOOGLE | App thêm vật tư, Sheets xem / Row mới có ID/UOM/version, hiển thị đúng / |
| T-031 | BLOCKED_GOOGLE | Sheets sửa tên/đơn giá master được phép / App sau sync thấy thay đổi, revision/audit cập nhật / |
| T-032 | BLOCKED_GOOGLE | Sheets sửa mã ID/header/meta protected / Bị cấm hoặc detect/quarantine, không làm hỏng bảng / |
| T-033 | LOCAL_REVIEW / NOT_ACCEPTED | Sửa đồng thời app version 5 vs Sheets version 6 / App conflict, hiển thị diff, không overwrite / |
| T-034 | LOCAL_REVIEW / NOT_ACCEPTED | 1kg → gram / Chính xác 1000g; giá/kg → giá/g đúng / |
| T-035 | LOCAL_REVIEW / NOT_ACCEPTED | 4,5 can không có netContent/can / Không tự chuyển ra kg, cảnh báo thiếu quy cách / |
| T-036 | LOCAL_REVIEW / NOT_ACCEPTED | Món tham chiếu nhân/sốt và nguyên liệu trùng ở nhiều công thức con / Tổng material được gộp đúng và có breakdown / |
| T-037 | LOCAL_REVIEW / NOT_ACCEPTED | Recipe A→B→A / Reject vòng lặp, giữ bản trước / |
| T-038 | LOCAL_REVIEW / NOT_ACCEPTED | Sửa đơn giá hôm nay / Cost dự kiến đổi; snapshot lịch sử đã chốt không đổi / |
| T-039 | LOCAL_REVIEW / NOT_ACCEPTED | 100 phần × 114g cơm chín, yield 2,5kg/kg gạo / 11,4kg cơm chín, 4,56kg gạo khô / |
| T-040 | LOCAL_REVIEW / NOT_ACCEPTED | 1 phần có giá vật tư chưa biết/0 chưa xác minh / Không hiện total cost chính thức bằng 0 / |
| T-050 | LOCAL_REVIEW / NOT_ACCEPTED | Lập kế hoạch 100 phần cho sáng mai / Nhu cầu tính cho ngày giao, không nhập nhầm ngày lập / |
| T-051 | LOCAL_REVIEW / NOT_ACCEPTED | SX chính 100, SX thêm 20, lỗi 2 / Tổng 120, tỷ lệ lỗi `2/120=1,666...%`, có nhãn làm tròn / |
| T-052 | LOCAL_REVIEW / NOT_ACCEPTED | SX 1000 phần/tuần từ nhiều món / Nhu cầu từng material cộng toàn bộ recipe đúng UOM / |
| T-053 | LOCAL_REVIEW / NOT_ACCEPTED | Tương ớt từ 7 món / Mức dùng lý thuyết cộng đủ cả 7, không chỉ một món / |
| T-054 | LOCAL_REVIEW / NOT_ACCEPTED | Định mức 4,5 can, thực dùng 5 can sau quy đổi hợp lệ / Chênh +0,5 can / +11,11%; không kết luận gian lận / |
| T-055 | LOCAL_REVIEW / NOT_ACCEPTED | Gạo 45,6kg định mức, 48kg thực dùng / Chênh +2,4kg / +5,26% / |
| T-056 | LOCAL_REVIEW / NOT_ACCEPTED | Không có tồn đầu kỳ kiểm kê / Không kết luận hao hụt, status incomplete / |
| T-057 | LOCAL_REVIEW / NOT_ACCEPTED | Tồn 20kg, tối thiểu 30kg / Cảnh báo thiếu 10kg, link sang bổ sung hàng / |
| T-058 | LOCAL_REVIEW / NOT_ACCEPTED | Kế hoạch mai vượt tồn 5kg / Cảnh báo thiếu dự kiến; chưa tự xuất kho khi mới lập kế hoạch / |
| T-059 | LOCAL_REVIEW / NOT_ACCEPTED | Ghi kiểm kê và bút toán điều chỉnh / Không trừ kho 2 lần; có audit/duyệt / |
| T-060 | LOCAL_REVIEW / NOT_ACCEPTED | Các dữ liệu thành phẩm thu hồi / Không cộng vào giá trị kho NVL/bọc; tồn kiosk riêng / |
| T-070 | LOCAL_REVIEW / NOT_ACCEPTED | Giao 100, bán 80, thu hồi 10, khách tự chịu 10 / Bốn lượng riêng, tổng cân bằng, không tự hủy 10 / |
| T-071 | LOCAL_REVIEW / NOT_ACCEPTED | Phê duyệt 10 thu hồi, kiosk chưa nhận / Doanh thu có phiếu thu hồi; tồn vật lý kiosk chưa tăng / |
| T-072 | LOCAL_REVIEW / NOT_ACCEPTED | Kiosk nhận 10 / Kiosk +10 một lần theo returnId, không tự xem là bán / |
| T-073 | LOCAL_REVIEW / NOT_ACCEPTED | Refresh/retry receipt cùng returnId / Tồn kiosk vẫn +10, không thành +20 / |
| T-074 | LOCAL_REVIEW / NOT_ACCEPTED | Kiosk bán lại 6 / Kiosk giảm 6, có dòng sale riêng, không cộng doanh thu về điểm ban đầu / |
| T-075 | BLOCKED_IMPLEMENTATION | Giá bán 15.000; giá hỗ trợ 5.000 / Lưu hai snapshot khác nhau; rule bù trừ P0 nếu chưa chốt không đưa net chính thức / |
| T-076 | LOCAL_REVIEW / NOT_ACCEPTED | Chiết khấu 15% cho điểm A món X, 0% điểm B / App tính theo đúng cặp điểm × món × hiệu lực / |
| T-077 | LOCAL_REVIEW / NOT_ACCEPTED | 100 phần giá 15.000, chiết khấu 15% trên đủ 100 sold / Gross=1.500.000; discount=225.000; after discount=1.275.000 (chỉ trong case sold=100) / |
| T-078 | LOCAL_REVIEW / NOT_ACCEPTED | Phiếu có tiền mặt 510.000, bank 510.000 / Total received=1.020.000, không tự đồng nhất với doanh thu nếu còn AR / |
| T-079 | LOCAL_REVIEW / NOT_ACCEPTED | Cùng phiếu doanh thu hiển thị ở sổ quỹ / Không cộng tiền nhận 2 lần / |
| T-080 | LOCAL_REVIEW / NOT_ACCEPTED | Thu tiền công nợ kỳ trước / Phải thu giảm, tiền tăng, không làm tăng net sales kỳ mới / |
| T-081 | LOCAL_REVIEW / NOT_ACCEPTED | Điểm bán ghi hàng hủy và hàng trả / Hai tỷ lệ khác nhau, không nhập thành một cột / |
| T-082 | LOCAL_REVIEW / NOT_ACCEPTED | Bán 80 + trả 10 + chịu 15 trên giao 100 / Chặn vì tổng > giao / |
| T-090 | LOCAL_REVIEW / NOT_ACCEPTED | Hôm nay mặc định / Form chọn ngày hiện tại VN / |
| T-091 | LOCAL_REVIEW / NOT_ACCEPTED | Ngày quá khứ chưa có phiếu / Nhập bù tạo chứng từ mới đúng ngày, có lý do / |
| T-092 | LOCAL_REVIEW / NOT_ACCEPTED | SX ban đầu 100 → bổ sung +30 / Tổng 130, không ghi đè 100 / |
| T-093 | LOCAL_REVIEW / NOT_ACCEPTED | Sau đó sửa số cuối =90 / Tổng 90, audit 100/+30/→90, không cộng 90 thêm / |
| T-094 | LOCAL_REVIEW / NOT_ACCEPTED | Mở lại ngày sáng đã nhập / Hiển thị dữ liệu buổi sáng để chiều bổ sung, không tạo trùng / |
| T-095 | LOCAL_REVIEW / NOT_ACCEPTED | Ca 23:00→07:00/08:00/09:00 / 8/9/10 giờ, không âm / |
| T-096 | LOCAL_REVIEW / NOT_ACCEPTED | Ca 23→09, 15k/giờ, 10k phụ cấp ca, 15k phụ cấp ngày, 5k hỗ trợ / Tổng 180k, bảng lương nhóm SX đúng / |
| T-097 | LOCAL_REVIEW / NOT_ACCEPTED | Hai ca cùng NV ngày, phụ cấp chính sách theo ngày / Phụ cấp default theo ngày chỉ tính một lần / |
| T-098 | LOCAL_REVIEW / NOT_ACCEPTED | NV đổi lương và bộ phận sau khi chốt ca / Lương/bộ phận của ca cũ vẫn snapshot / |
| T-099 | LOCAL_REVIEW / NOT_ACCEPTED | Giờ SX=10, VP=20, BH=5; SX tạo 120 phần / Năng suất 120/10=12 phần/giờ, không chia 35h / |
| T-100 | LOCAL_REVIEW / NOT_ACCEPTED | Khoản ứng 700.000 từ file cũ chưa biết NV / Chờ xác minh, không tự gán vào ai / |
| T-110 | LOCAL_REVIEW / NOT_ACCEPTED | Kế hoạch doanh thu tháng 260tr/26 ngày bán (minh họa) / Kế hoạch ngày = 10tr; có nguồn và kỳ / |
| T-111 | LOCAL_REVIEW / NOT_ACCEPTED | Doanh thu hôm nay 12tr, hôm qua 10tr / Tăng +20%; null nếu ngày thiếu / |
| T-112 | LOCAL_REVIEW / NOT_ACCEPTED | So Thu 12/11 vs Thu 05/11 / Đúng hai ngày cùng thứ, không lệch tuần / |
| T-113 | LOCAL_REVIEW / NOT_ACCEPTED | Tuần chưa kết thúc / Hiển thị lũy kế tuần có nhãn độ phủ, không coi ngày tương lai là 0 / |
| T-114 | BLOCKED_IMPLEMENTATION | Trần nhân sự SX 15%, labor 12% trên dữ liệu đầy đủ, SX vượt plan / Hiện dư trần tham khảo = (15%-12%)×basis, không tự chi thưởng / |
| T-115 | LOCAL_REVIEW / NOT_ACCEPTED | Trần 15% nhưng thiếu lương SX hoặc net revenue / `NOT_READY`, không hiện tiền thưởng giả / |
| T-116 | BLOCKED_IMPLEMENTATION | Food cost ratio 32,2% theo cơ sở đã chốt / Tính đúng, hiện target và trạng thái / |
| T-117 | LOCAL_REVIEW / NOT_ACCEPTED | Tồn vật tư dưới min ở màn kho / Báo cáo sếp có số lượng mã thiếu và drilldown đúng / |
| T-118 | LOCAL_REVIEW / NOT_ACCEPTED | Chỉ tiêu chưa cấu hình / Xám “Chưa thiết lập”, không xanh/0 / |
| T-119 | LOCAL_REVIEW / NOT_ACCEPTED | 8 biểu đồ chiến lược / Đổi bộ lọc đúng dataset, không lẫn demo/thật / |
| T-120 | LOCAL_REVIEW / NOT_ACCEPTED | Break-even margin≤0 / Không cho số lượng hòa vốn giả / |
| T-121 | BLOCKED_IMPLEMENTATION | 100đ doanh thu phân bổ / Các tỷ lệ trên cùng basis, tổng đúng/ghi “chi phí chưa phân loại” nếu thiếu / |
| T-130 | LOCAL_REVIEW / NOT_ACCEPTED | Khách tạo đơn mới 30 phần / Lưu PENDING, internal duyệt trước khi gửi sang plan / |
| T-131 | LOCAL_REVIEW / NOT_ACCEPTED | Duyệt đơn hai lần/retry / Plan chỉ thêm một lần, ref orderLineId rõ / |
| T-132 | LOCAL_REVIEW / NOT_ACCEPTED | Người ngoài xem dữ liệu lương/cost/đơn khác / Bị chặn server / |
| T-133 | BLOCKED_GOOGLE | Sửa master trực tiếp Sheets khi app đang mở / UI thấy revision mới trong giới hạn sync đo thực tế / |
| T-134 | BLOCKED_GOOGLE | Google Sheets sửa qua API/Apps Script khác / Periodic reconciliation phát hiện dù onEdit không kích hoạt / |
| T-135 | LOCAL_REVIEW / NOT_ACCEPTED | Hai user edit cùng row / Có conflict, không silent overwrite / |
| T-136 | LOCAL_REVIEW / NOT_ACCEPTED | Net timeout khi gửi write, retry cùng idempotencyKey / Không ghi trùng tiền/SL/kho / |
| T-137 | LOCAL_REVIEW / NOT_ACCEPTED | Mất mạng khi đang lưu / UI không báo success, draft có trạng thái chưa gửi; không tạo chứng từ ảo / |
| T-138 | BLOCKED_GOOGLE | 10 user đồng thời thao tác / Không lộ dữ liệu và không lost update, có perf/lock metrics / |
| T-139 | LOCAL_REVIEW / NOT_ACCEPTED | Sidebar mở/đóng các menu/đổi tab / Không vỡ label Doanh thu/Chấm công/Sản xuất ở desktop/mobile / |
| T-140 | LOCAL_REVIEW / NOT_ACCEPTED | Animations với OS reduced-motion / Giảm/tắt animation, không ảnh hưởng thao tác / |
| T-141 | LOCAL_REVIEW / NOT_ACCEPTED | Giao diện public trước login / Không embed bảng lương/công nợ/dữ liệu nội bộ / |
| T-142 | LOCAL_REVIEW / NOT_ACCEPTED | Sửa code local rồi mở `/exec` / Chưa thay tới khi push+new version; tài liệu hướng dẫn đúng / |
| T-143 | LOCAL_REVIEW / NOT_ACCEPTED | Chỉnh sửa HTML/CSS không đổi schema / Không phải chạy lại `khoiTaoDEV` / |
| T-144 | BLOCKED_GOOGLE | `clasp push` rồi new version trên deployment cũ / URL `/exec` giữ nguyên, code mới hoạt động / |
| T-145 | LOCAL_REVIEW / NOT_ACCEPTED | Sau rebuild V17 logo / Logo là ảnh gốc, không có asset thay thế và sidebar hiển thị đúng / |

Auth local: tests/oauth.test.mjs, session-security.test.mjs, client.test.mjs: code/PKCE/state/UserInfo/browser proof, allowlist, disabled/unknown user, revoke, Admin concurrency, signed-request replay và thiếu quyền. Gate Google thật vẫn BLOCKED_GOOGLE. Xem docs/AUTH_FEASIBILITY.md.

# 09 — HIỆN TRẠNG, NGUỒN THAM CHIẾU VÀ CÁC RỦI RO GHÉP CODE

## A. Các mốc HTML phác thảo từ cuộc trò chuyện

| Mốc | Tính năng/ý tưởng được bổ sung | Cách Codex xử lý |
|---|---|---|
| V1–V4 | Danh mục, công thức món/nhân/sốt, thêm cột phụ cấp NV | Merge vào master+recipe versioned, không duplicate |
| V5 | Logo CHIFAA COMBINE, kế hoạch tối giao sáng mai, nhu cầu NVL, tuần/tháng/quý | Recipe explosion + snapshot plan/actual |
| V6–V7 | Kho, tồn tối thiểu, lịch sử, kiểm kê, tiêu hao/hao hụt, ví dụ 4,5 can | Inventory ledger+count+variance, quy cách pack |
| V8 | Tổng quan báo cáo sếp và Dashboard vận hành từ 2 workbook | Report services, missing-data handling |
| V9 | 8 form nhập liệu: kho, DT, công, sản xuất, KH, vay, nợ, quỹ | Business documents, không phải localStorage |
| V10 | Nhập bù/bổ sung/sửa, nhật ký, bảng lương tháng | 4 modes, audit, one business date |
| V11 | DT theo điểm/món, tiền mặt/chuyển khoản, thu hồi, thuần/đối soát | 3 metrics: netRev/amountDue/received |
| V12 | Ca đêm 23h→7/8/9, 3 nhóm SX/VP/BH, phụ cấp/hỗ trợ | Rate+dept snapshots, payroll per group |
| V13 | Cột SX thêm, hàng trả về ki-ốt theo returnId, giá hỗ trợ riêng | 100/80/10/10, no double count |
| V14 | Mục tiêu food cost, SX 15%, trả hàng, fixed, VP, marketing, depreciation, min cash | Target settings + metric sources |
| V15 | Dashboard lọc tuần, hôm nay/hôm qua, same weekday, năng suất chỉ giờ SX | Period engine + wage/attendance linking |
| V16 | Báo cáo điều hành chi phí %, cảnh báo vật tư thiếu, dự kiến ngân sách thưởng | CEO cockpit + alert engine |
| V16 khách hàng | Bỏ từ ngữ phiên bản, sửa sidebar dropdown và JS cũ gây vỡ chữ | UI source cần giữ fixes |
| V17 | Chiến lược kinh doanh 8 biểu đồ, filter/kịch bản | Separate strategy read model/demo mode |
| Apps Script sau V17 | Xây backend Sheets, Admin/_Users, OAuth, DEV setup, deploy | Auth blocker 401 và chưa chứng minh E2E Sheets |

Các bản trước đây có nhiều data demo/localStorage, nên chỉ **tham khảo UX và business intent**, không xem như implementation production. Cần đối chiếu code mới nhất thực tế của Codex (có thể khác file tải lên), không ghi đè phần đã sửa.

## B. Những file đã xuất hiện trong chat

- `CHIFAA_COMBINE_V17_CHIEN_LUOC_KINH_DOANH.html`: bản HTML phác thảo gần nhất đã có Chiến lược và sidebar đã sửa, dung lượng gần 575KB; có code/biến localStorage và nhiều hàm render HTML. Không đưa toàn bộ raw file vào HTML đầu tiên cho người chưa đăng nhập nếu chứa business demo nhạy cảm chưa tách.
- `CHIFAA_COMBINE_V16_KHACH_HANG_SUA_LOI_SIDEBAR.html`: tham chiếu fix dropdown/labels. V17 kế thừa phần này theo lịch sử nhưng Codex vẫn phải test.
- `DASHBOARD  VẬN HÀNH CHIFAA..xlsx`, `DASHBOARD KẾ TOÁN CHIFAA.xlsx`: dữ liệu gốc cần giữ. Người dùng từng phản ánh nhiều `#REF!` và tham chiếu giữa Sheets; **không xác nhận tất cả tổng đã khớp**.
- Logo chính xác từ ảnh `logochifaa(1).jpg` do user gửi; file mock khác không thay thế.
- `Văn bản đã dán (1)(20261115-104754).txt` chứa `Code.gs` tham khảo 734 dòng. Đây không chắc là repo đang chạy mới nhất.

## C. Các hàm đã tồn tại trong Code.gs mẫu (PHẢI ĐỐI CHIẾU REPO MỚI)

| Hàm | Ý định | Rủi ro/việc cần kiểm tra |
|---|---|---|
| `db_()` | `SpreadsheetApp.openById(SPREADSHEET_ID)` | `SPREADSHEET_ID` chỉ ID, không dán URL; quyền chủ sở hữu và trùng DEV/PROD |
| `setup_()`/`khoiTaoDEV()` | Tạo sheet, `_Users`, protections | Không chạy init trên bảng gốc; `Session.getActiveUser()` có thể khác theo ngữ cảnh, một số bản migrate chưa xử lý |
| `rawRows_()`,`data_()` | Đọc Sheets | Nhiều chỗ đọc toàn bộ tất cả bảng, giới hạn 5.000 dòng và lặp query → chậm |
| `bootstrap_()` | Nạp dữ liệu được cấp quyền | Cần server auth thật và phân trang/caching, không prelogin sensitive data |
| `mutate_()` | CRUD với version/lock/idempotency | Cần regression stale write; ledger correction vs direct edit; không được trust client |
| `transact_()` | `_Requests` journal PREPARED/APPLIED + rollback | Sheets không có ACID, cần recovery khi một phần ghi xong |
| `scanSheets_()` | Hash/checksum, đồng bộ edit trực tiếp | Quét toàn bộ workbook tốn thời gian; audit user trực tiếp có thể không biết; cần chunk/invalidation |
| `sheetEdited_()` | Installable edit trigger | API/script writes không tự kích hoạt onEdit; periodic reconcile bắt buộc |
| `login_()` / `challenge_()` | GIS idToken+nonce và `_Sessions` | **401 no registered origin** ở iframe; auth còn blocker đến khi POC sửa thành công |
| `report()` / `salesMetrics()` | Báo cáo doanh thu/P&L | Chính sách lợi nhuận & support thu hồi `PROVISIONAL` trong code; phải chốt P0 |
| `targets()` | Mục tiêu và thưởng | Mẫu source từng trừ `cogs` khi tính phần còn của labor cap: **không đúng trần riêng 15% lương SX** nếu người dùng không xác nhận |
| `payroll()` | Lương/giờ/phụ cấp | Ca đêm hỗ trợ, nhưng kiểm tra phụ cấp theo ngày/ca, snapshots/ứng/trừ |
| `flattenRecipe()` | Đệ quy recipe | `lines` hiện có thể lưu JSON trong một ô, khó edit trực tiếp Sheets như yêu cầu |
| `invite_()`/`portalOrder_()` | Cổng khách link mời | Xác thực/chia quyền deployment/portal dữ liệu, rate limit, anti-CSRF, catalog public review |

## D. Lỗi xác thực và deployment đã xảy ra

1. Ở màn Google Cloud Auth Platform, từng chọn nhầm project `bu-kanji` thay vì CHIFAA. Khi kiểm tra OAuth, phải xác nhận client ID thuộc đúng Google Cloud Project được liên kết với Apps Script.
2. App có OAuth Client ID và `GOOGLE_CLIENT_ID`; popup đăng nhập Google báo **401 invalid_client/no registered origin**. Thêm email vào `_Users` không chữa được. Không chỉ thêm `Authorized origins` tùy ý cho iframe; phải sửa luồng auth và test thực tế.
3. Cấu hình webapp `MYSELF` chỉ chủ triển khai mở; `ANYONE` + user account gate mở link cho người dùng nhưng bảo mật chỉ đạt nếu backend auth/RBAC bảo vệ dữ liệu trước khi trả; `USER_ACCESSING` có thể buộc chia quyền file; hai hình thức đều có tradeoff.
4. Script Property `SPREADSHEET_ID` từng bị dán cả URL gây `Illegal spreadsheet id or key`; phải là đoạn ID giữa `/d/` và `/edit`.
5. Người dùng đã có Admin row trong `_Users` (`admin`, enabled TRUE), nhưng điều đó chưa chứng minh login/bootstrap thật thành công.
6. `clasp push`/save code không auto update `/exec`; phải update **new version trên deployment hiện có**. `/dev` dành editor có code HEAD.

## E. Audit source repository ngay trước khi code

Codex chạy hoặc tạo `scripts/audit` in ra **không lộ secret**:

1. Git status, branch, commit SHA, source file tree; khác nhau giữa local vs pushed Apps Script; manifest và deploy ID.
2. Route map: mỗi button/menu/form/modal/chart có handler nào, handler gọi RPC/reads localStorage, status DONE/PARTIAL/MOCK.
3. Sheet schema actual: danh sách bảng, headers, counts, PK/FK lỗi, version, `_Users` role states; xác minh DEV không phải workbook nguồn kế toán.
4. Auth call flow và thông tin OAuth **không in client secret/token**; tất cả định danh Origin/redirect URI theo deployment thực tế.
5. Data flow graph nguồn của mỗi KPI/cột; tìm số hardcoded trong HTML, `demoExample` không được tự lẫn reporting.
6. Test harness thực tế, unit/integration e2e fixtures. Lập báo cáo `GAP_REPORT.md` và ưu tiên P0.

## F. Không được lặp lại các sai lầm phác thảo

- Đừng chỉ tạo biểu đồ đẹp với data giả rồi ghi là đã làm xong.
- Đừng auto import giá 0 và #REF! làm 0.
- Đừng chuyển “hàng thu hồi” sang “hàng hủy”.
- Đừng cộng lượng kiosk received thành kiosk sold hoặc ghi return 2 lần.
- Đừng tính `income = cash received` mặc định.
- Đừng lấy tổng giờ VP/BH làm năng suất SX.
- Đừng tự cộng phụ cấp ngày cho từng ca rồi tính lại lương lịch sử theo giá lương mới.
- Đừng giả định OAuth login works chỉ vì Admin record có trong `_Users`.
- Đừng share Editor toàn file Sheets cho nhân viên có quyền app hẹp.
- Đừng mở `/exec` cho khách thật trước khi thử auth deny/export.

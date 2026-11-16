# Tối ưu đọc và truyền dữ liệu — đợt tiếp theo DEV27

Yêu cầu gốc: attachment Pasted text.txt,17/11/2026. Giữ UI/nghiệp vụ/RBAC/khóa/idempotency; không chỉnh hai workbook CHIFAA gốc. Chỉ triển khai mã lên DEV đã xác định. Google/browser inventory apps:[],browsers:[]; không có số đo Google thật trong phiên này. Không lấy mock thay cho nghiệm thu.

## Task 1 — Phân tích và baseline

DEV27 đã có shell bootstrap, API aggregate, RAM cache và scan theo phạm vi. Gaps xác nhận: list lọc kỳ vẫn rawRows cả bảng; lookup dùng full snapshot nhiều RPC; report cache20giây mất thì đọc mọi nguồn lại; công thức truyền cả lines khi chỉ xem danh sách. Cold report hiện cần toàn lịch sử để giữ reversal/giá vốn/quy tắc thiếu dữ liệu; không được cắt lịch sử tùy tiện.

Benchmark `node scripts/benchmark-data-loading.mjs before|after`, dữ liệu tổng hợp100/1.000/5.000 dòng/bảng lớn, doanh thu/chấm công/quỹ rải3năm. Một lượt/cỡ, thời gian CPU mock; không bao gồm IO Google/network/OAuth/render. Output/data-loading-before.json là baseline.

| API, cỡ5.000 | ms mock | getValues | Ô đọc |
| --- | ---: | ---: | ---: |
| materials | 62,14 | 8 | 65.025 |
| stock lọc tuần không có dòng | 59,76 | 9 | 65.043 |
| sales lọc tuần | 145,87 | 9 | 110.061 |
| attendance lọc tuần | 157,67 | 9 | 95.061 |
| cash lọc tuần | 77,51 | 9 | 70.068 |
| sales tuần khác | 95,96 | 9 | 110.085 |
| Dashboard lạnh | 576,67 | 41 | 405.238 |
| Dashboard sau cache eviction | 506,78 | 41 | 405.241 |

Bảng master1dòng/empty: dishes0,46ms/5reads,stores0,33/5,employees0,25/5,discounts0,22/4,recipes0,30/5,counts0,36/4,production0,21/4,plans0,43/4,loans0,30/4,debts0,24/4,assets0,52/4,orders1,12/4. Không so sánh master nhỏ với bảng lớn để suy ra server SLA.

Đo mới: sheets:open tách mở workbook; sheets:values:module tách getValues; decode:module gồm parse/hash; report/strategy và rpc_profile tách JS. Client đã có rpc/UI timings. Thời gian truyền thực phải đo client roundtrip so với server, không lấy ms mock làm mạng.

## Task 2–4 — Backend/index/cache/API

Chỉ mục riêng theo workbook/module/version, bao gồm vị trí vật lý, ID, ngày, món, vật tư, loại, bộ phận và chuỗi tìm. Cache60giây chia16.000ký tự/part, checksum/generation, manifest ghi sau parts. Thiếu một part/hết hạn/hỏng → rebuild, không trả dữ liệu một phần. Cache có thể bị eviction; nguồn chính vẫn Sheets. Chunk Unicode được bọc JSON để giữ surrogate pairs khi chia.

API list dùng chỉ mục chọn kỳ/trang rồi đọc nhóm dòng liền nhau; header kiểm tra, tổng dòng đổi thì rebuild, dòng bị chuyển/xóa hoặc đổi kỳ thì rebuild/reject. First miss vẫn đọc bảng để lập index nhưng tránh decode/hash mọi dòng; các kỳ/trang tiếp dùng index. Tìm trong recipe lines giữ full path để không đổi ngữ nghĩa tìm kiếm. Mutation/preview/chốt tài chính không sử dụng chỉ mục này.

API lookup trả whitelist trường danh mục đã được cấp read, không có recipe lines/history. API record trả đúng phiếu theo ID kèm hash/version. Compact list phân biệt key cache với full list. All auth/proof/nonce/permissions kiểm tra trước cache.

Task2 checkpoint:216tests đạt sau sửa fixture PROD vốn bị auth guard DEV từ chối; không tắt guard để test. Task tiếp theo frontend lazy lookup/recipe/detail, scoped report và trạng thái snapshot.

## Task 5 — Snapshot có version

Dashboard/Strategy dùng snapshot theo kỳ + dependency versions + email/role/quyền + phiên bản thuật toán. Cache RAM/server là tùy chọn. CacheService miss có thể dùng _ReportSnapshots: nguồn cập nhật/versions/checksum, tối đa5phút và key đúng phiên bản; mismatch/hỏng/force → đọc nguồn và tính lại. Không lấy snapshot làm đầu vào ghi/chốt tài chính.

_ReportSnapshots là cache phụ,128slot×16parts (2.049dòng,8cột), chỉ thay ô cache, không xóa/ghi đè lịch sử nghiệp vụ. Tự tạo sau một báo cáo Admin thành công **chỉ khi AUTH_ENV=DEV và SPREADSHEET_ID=AUTH_DEV_SPREADSHEET_ID**; bảo vệ owner, không chia sẻ workbook. Không tự tạo ở hai workbook gốc/PROD. Không có sheet/không ghi được → fallback bình thường. Tài khoản hạn chế không thể lấy snapshot của Admin dù còn cache. Ghi snapshot dùng tryLock50ms rồi bỏ qua nếu bận, không đợi khóa ghi15giây. Chưa tạo sheet thật trong phiên này.

Task6–8 và số đo sau sẽ bổ sung khi kiểm thử frontend/deploy hoàn tất. Snapshot lạnh lần đầu và source validation vẫn có thể đọc lịch sử đầy đủ; cần đo trên Google để định mục tiêu và xác định bước tổng hợp vật lý sâu hơn.

## Task 3–7 — Frontend và đồng bộ

- API tương đương yêu cầu: initialData=bootstrap(shell), moduleData=list, dashboardSummary=summary, moduleChanges=sync, lookupData=lookup; thêm record cho chi tiết, periodSummary cho tồn kho/lương. Giữ tên RPC kiến trúc hiện tại.
- Mở bảng phiếu không chờ tải full master/history. Lookup chỉ trường whitelist, tải trang200, cache RAM theo grant+module version. Ref name mapO(1); nhân viên ngoài quyền không được tải. Đổi quyền/account/logout xóa lookup/map/DOM/data cache; response cũ bị scope/token/generation guard loại bỏ.
- Danh sách công thức nhận compact fields + số thành phần. Xem/sửa/in mới lấy details đầy đủ kèm hash/version. Nhập công thức con dùng lookup tên; backend vẫn xác minh graph và nguồn đầy đủ.
- Bảng lương mặc định tháng, lọc bộ phận, API chỉ trả nhóm lương (100nhóm/trang); tồn kho/cảnh báo trả100vật tư/trang. Kết quả dùng đúng shared domain, giải reversal trước lọc kỳ; không tải attendance/history sang client chỉ để vẽ bảng. Chốt lương/lập chi vẫn preview/chốt backend mới, không dùng snapshot đọc làm đầu vào ghi.
- Cache RAM20giây: quay lại ngay, quá hạn hiện dữ liệu cũ kèm “Đang kiểm tra cập nhật…” rồi thay kết quả. Lỗi có thông báo, không báo đang tải mãi. Dashboard/Strategy/inventory/payroll có nguồn thời gian tổng hợp; không giả dữ liệu thiếu bằng0.
- Hàng đợi tối đa2RPC đọc, tối đa1nền; foreground được ưu tiên khi có slot, mutation không nằm trong hàng đợi đọc. Đăng xuất hủy reads đang xếp hàng; active response vẫn qua token guards. Không gửi dồn tất cả module sau đăng nhập.
- Version module đã bump từ app/onEdit/onChange/slice làm index và snapshot liên quan không còn hợp lệ. Khi user sửa trực tiếp Sheets nhưng trigger chưa chạy, giao diện có thể chậm cập nhật; snapshot có timestamp, tối đa5phút; index60giây. Force bypasscache. Không thay cơ chế nguồn chính/historical/source hash/idempotency.
- Vẫn dùng animation/skeleton/reduced-motion hiện có; không đổi thiết kế hoặc thêm CSS để che độ trễ.

## Task 8 — Kiểm thử và đo sau

223tests đạt tại checkpoint; syntax63/build/bundle + runtime SHA/offline preview đạt. Ca mới: kỳ/ngày/rowmove/schema/index5.000dòng thực sự vừa budgetcache; chunkUnicode/mấtpart; snapshotcorrupt/expiry/force/DEVguard/RBAC; payroll cross-period reversal/department; lazy formula details; không tải attendance snapshot; foreground ưu tiên+save bypass; RAM stale có trạng thái. Testmock không thay cho8tài khoản Google thật.

| API cỡ5.000 | Trước getValues / cells / ms | Sau getValues / cells / ms |
| --- | ---: | ---: |
| Materials cold | 8 / 65.025 / 62,14 | 8 / 65.025 / 35,43 |
| Stock cold empty week | 9 / 65.043 / 59,76 | 9 / 65.043 / 26,46 |
| Sales cold week | 9 / 110.061 / 145,87 | 9 / 110.061 / 44,34 |
| Attendance cold week | 9 / 95.061 / 157,67 | 9 / 95.061 / 38,9 |
| Cash cold week | 9 / 70.068 / 77,51 | 9 / 70.068 / 30,46 |
| Sales next week warm index | 9 / 110.085 / 95,96 | 9 / 855 / 16,52 |
| Dashboard cold | 41 / 405.238 / 576,67 | 42 / 405.246 / 544,24 |
| Dashboard read-cache evicted | 41 / 405.241 / 506,78 | 5 / 205 / 0,66 |

Đây là **một lượt CPU mock**, không phải latencyGoogle/P50/P95. Lần đầu index chưa giảm ô đọc; giảm decode/hash và giữ lại chính cells đã đọc trong request để tránh đọc lại trang. Index sau được encode tuple gọn: cache5.000dòng có test riêng, không giả rằng cache100KB chứa trọn bảng. Chọn dòng rải rác vẫn có thể cần nhiều getValues; ví dụ tuần khác sốcalls9không giảm, chỉ cells giảm99,2%. Không che phần chưa cải thiện. Cold Dashboard vẫn full source validation/cost history để đúng nghiệp vụ.

Benchmark client40lượt/cỡ Node+LinkeDOM: cỡ5.000 bảng nóng P50=9,79ms/P95=49,42ms/max221,95ms; Strategy DOM P50=2,02/P95=2,36/max31,77ms. Không có layout/paint/network; còn outlier>200ms, chưa nghiệm thu mục tiêu browser200ms. Dữ liệu/môi trường100/1.000/5.000 đầy đủ ở output/data-loading-before.json, data-loading-after.json, performance-client.json.

## Rủi ro, file, triển khai và nghiệm thu Google

- Backend mới read-model.js; sửa storage.js, api.js, performance.js. Client app.js, rpc.js, operations-view.js. Build scripts/build.mjs; benchmark mới benchmark-data-loading.mjs, fixture performance-fixture.mjs tách dùng chung; benchmark-performance.mjs dùng lại fixture. Tests mới read-model.test.mjs,data-loading-client.test.mjs; mock bổ sung batch Cache API và nới dòng cache sheet. TASKS/CHANGELOG/HANDOFF ghi checkpoints. Không gộp file có sẵn ngoài task.
- Cache chỉ tối ưu đọc, không authority. Index tìm kiếm theo mã và trường nghiệp vụ; recipe search trong lines vẫn dùng full path. Các module cost/demand/variance và màn hình phân bổ nợ cũ còn dùng raw source đầy đủ khi mở; export vẫn toàn lịch sử có phân trang. Đây là phần còn lại cần benchmark Google riêng, không tuyên bố đã loại mọi full read.
- Snapshot lưu đúng kết quả/cùng dependency version, tối đa5phút, collision128slot/hỏng/mất cache → tính lại. Payload>256.000ký tự không persistSheet; chunk cache giới hạn64parts, quá budget thì fallback. CacheService có thể bị eviction: [giới hạn chính thức](https://developers.google.com/apps-script/reference/cache/cache). Không cache credentials cùng namespace này; auth và nonce vẫn mới.
- Chưa có snapshot đúng version/kỳ thì coldcompute có thể chậm; chưa có scheduler precompute mọi kỳ/người/quyền. Không tự tổng hợp theo ngày rồi cộng ratio/profit vì có phụ thuộc tồn đầu/giá vốn/quyền/reversal. Sẽ chỉ thiết kế incremental daily materialization khi số đo thật và tính đúng đắn chứng minh cần thiết.
- Không chỉnh hai workbook gốc hoặc fake dữ liệu benchmark lên Google. Snapshot sheet mới chỉ tạo trên DEV được guard sau báo cáo Admin. Muốn rollback dùng version27; sheet snapshot phụ có thể để nguyên, bản cũ bỏ qua.
- Bật Script Property **PERF_DIAGNOSTICS=true** để có rpc_payload (serverMs/serializeMs/payloadChars) và client `CHIFAA_PERFORMANCE` có server/transport-queue/UI. Transport-queue gồm mạng+Google queue/framework; không gọi đó là thời gian mạng thuần. Mặc định không stringify thêm payload, tránh phí đo không cần thiết. Log không ghi dữ liệu/token/secret.
- TestGoogle còn pending: Admin/kế toán hạn chế,10tab,tuần/tháng,save khi lookup đang chạy,change directSheets,đổi quyền khicachecòn,mấtkết nối/cacheexpiry,2/5/8phiên. Cần30lượt/case, máy/mạng/rowcounts, P50/P95; chưa thể xác nhận bất kỳ SLA Google nào vì không có browser kết nối.
- Deploy5file giữ nguyên URLcallback/app, backup và readback exactversion trước gán; không setup lại workbook. Dùng trigger incremental DEV27 đã có; nếu chưa cài thì Admin vào Nhật ký & đồng bộ → Cài lịch scan, backup và Portal. Không tự chạy trigger setup trong phiên này.


## Aggregate endpoint benchmark extension

Same synthetic5.000 fixture, single CPU/mock run; cold source still reads full dependencies. Hot getValues3 are fresh auth/nonce, not cached identity.

| API | Cold ms / getValues | Hot ms / getValues | Response bytes |
| --- | ---: | ---: | ---: |
| inventory | 396.83 / 17 | 5.89 / 3 | 14977 |
| payroll | 118.72 / 14 | 0.4 / 3 | 366 |
| cost | 167.65 / 22 | 0.33 / 3 | 385 |
| demand | 80.42 / 20 | 0.52 / 3 | 524 |
| variance | 210.97 / 24 | 0.33 / 3 | 431 |


## Triển khai DEV28

Source28604a7/ef30f54. Backup remote-before-data-loading/source khớp verified27 trước push. Tạo28 rồi đọc lại remote-data-loading-version28/source: đủ5file khớp Code/Index/Portal/ExcelRuntime byte-for-byte, manifest tương đương. CLI xác nhận cả callback/app DEV hiện có@28; giữURL, deployment lịch sử@2 không đổi. Không chỉnh hai workbook gốc, dữ liệu nghiệp vụ, ACL hoặc tự chạy trigger/setup. _ReportSnapshots chưa được tạo trực tiếp bởi agent; ứng dụng có thể tự tạo cache phụ DEV sau báo cáo Admin như mô tả trên. Không cần chạy setup lại. Rollback gán cả2deployment về27, giữ nguyên nguồn lịch sử.

Local224tests/syntax63/build/bundle/runtime hash/offline preview đạt. Task1–7 đã triển khai phần mã; Task8 mới local/mock, Google UAT và độ trễ thực tế chưa nghiệm thu. Không khẳng định200ms hay8người Google đã đạt. Người dùng mở lại link DEV; nếu chưa cài lịch incremental ở27 thì cài một lần qua Nhật ký & đồng bộ. ĐoGoogle theo checklist trước khi dùng làm sổ chính thức.

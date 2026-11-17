# Theo dõi công việc

## Nhập dữ liệu cũ — đang chờ nguồn/kết nối

- Chuẩn bị22bản ghi danh mục và staging công thức có dòng nguồn: đạt local,276tests/syntax85. Công cụ `scripts/legacy-catalog-preparation.mjs` không gọi Google.
- Đọc/backup/preview/apply trên DEV: CHƯA THỰC HIỆN, không có browser hoặc Google Drive đã kết nối. Chưa xác định dữ liệu đích trùng ID/tên.
- Nhận danh mục vật tư, xác minh unit sốt phô mai/hiệu suất cơm/giá thu hồi và sai khác cost: còn chờ. Chi tiết docs/LEGACY_IMPORT_2026-11-17.md. Không thay deployment32.

## Checkpoint master hiện tại — DEV32 — 17/11/2026

- M01 bảo mật/phiên, M02 thu hồi ki-ốt, M03 bốn chế độ nhập, M04 KPI, M05 nguồn/backup, M06 liên kết đơn, M07 UOM/schema: đã có mã và kiểm thử local theo phạm vi ghi tại docs/MASTER_AUDIT_2026-11-17.md.
- M08 tích hợp:273tests/syntax83/build/bundle đạt; hai DEV@32 và readback5file đã xác minh. Không đổi dữ liệu/ACL/trigger hoặc phát hành Portal riêng.
- M09: độ đầy đủ giá vốn/lợi nhuận, batch cấu hình tĩnh theo RPC, poll60s/focus và phản hồi kiểm chứng backup; xem docs/MASTER_M09_2026-11-17.md. Trạng thái pending RAM chưa thay durable draft/outbox.
- Chưa hoàn tất Google/visual/ACL/2–5–8user UAT, migration nguồn gốc, giá trị/lô/hạn ki-ốt, chính sách còn chờ. Matrix vẫn PARTIAL cho tiêu chí chưa đủ bằng chứng; không gán PASS tự động.
- Bàn giao và bước tiếp theo: docs/MASTER_RESULT_2026-11-17.md, HANDOFF.md, DECISIONS_REQUIRED.md. Các mục cũ bên dưới là lịch sử tiến độ.

Danh sách T00–T19 dưới đây được lập lại từ 3 prompt vì người dùng chưa cung cấp TASKS.md gốc. DONE_LOCAL chỉ nghĩa đã viết/kiểm tra tại máy; chưa thay cho nghiệm thu Google hoặc khách hàng.

| Task | Nội dung | Trạng thái |
| --- | --- | --- |
| T00 | Giữ đầu vào, kiểm kê 32 menu, mapping | DONE_LOCAL |
| T01 | Repo/module/build/check/test, logo | DONE_LOCAL; đã review Chrome cục bộ desktop/màn hình nhỏ |
| T02 | Schema/workbook/setup idempotent/protection | LOCAL; Google/import pending |
| T03 | Import preview/apply/rollback | IMPLEMENTED_DEV_CODE: CSV/JSON, mẫu CSV, xem trước ràng buộc trạng thái nguồn, chống trùng, liên kết kho, journal chunk/rollback; chưa nhập dữ liệu Google thật |
| T04 | OAuth Apps Script/RBAC/admin session | DEPLOYED_DEV v21; Admin workspace đã được người dùng xác nhận; hai Google accounts thật/ACL chưa nghiệm thu |
| T05 | Danh mục/quy đổi/chiết khấu | LOCAL; dữ liệu thật pending |
| T06 | Công thức nhiều cấp/giá theo ngày | Phiếu sản xuất liên kết có snapshot định lượng/giá vốn; legacy chưa snapshot cần đối chiếu |
| T07 | Kho/sổ giao dịch/bút toán đảo | Đã nối sản xuất xuất kho/kiểm kê điều chỉnh, đảo theo lô, khóa kỳ; tồn đầu và Google UAT còn chờ |
| T08 | Sản xuất chính/thêm/hủy/kế hoạch | Phiếu mới tạo hiệu ứng kho tự động, thiếu tồn/giá không ghi; giữ dữ liệu cũ, không tự backfill |
| T09 | Hàng trả/doanh thu/đối soát | PARTIAL; mô hình ki-ốt tự động & quy tắc khách pending |
| T10 | Ca qua đêm/phụ cấp/lương theo nhóm | Đã chặn giao ca kể cả qua đêm, chốt lương/thưởng tạo chi, snapshot/in lại/hoàn tác; Google UAT còn chờ |
| T11 | Sổ quỹ/nợ/vay/tài sản | Đã phân bổ nợ theo khoản/thu nợ cũ, chặn trả vượt, tự nhập tiền lãi và lập chi theo kỳ theo yêu cầu, summary theo quyền; khấu hao/tồn thành phẩm trong kết quả còn chờ quy tắc |
| T12 | Dashboard/KPI/cùng thứ hai tuần | PARTIAL; bộ cảnh báo/biểu đồ phác thảo chưa tương đương hoàn toàn |
| T13 | Chiến lược/hòa vốn/thưởng trong trần | Chiến lược đã làm lại theo phác thảo: 8 khối phân tích, bảng chi tiết, bộ lọc kỳ và mô phỏng 30 ngày; 127 test đạt. Xem docs/CHIEN_LUOC.md; Google UAT và quy tắc kế toán đầy đủ còn chờ nghiệm thu. |
| T14 | Cổng khách riêng/thư mời/duyệt | Đã có tạo workbook riêng/thư mời/đồng bộ lịch/đẩy trạng thái/khách tra cứu theo thư mời; cần URL dự án Portal và cấu hình Google thật |
| T15 | Đồng bộ edit/poll/version/conflict | LOCAL; Google trigger & multi-cell edits pending |
| T16 | Cache/UX/performance/responsive | PARTIAL; có server cache theo quyền, loading và IndexedDB cho khóa phiên; dữ liệu nghiệp vụ chỉ RAM; p95 Google chưa đo |
| T17 | Logs/health/backup/restore | Có màn hình khóa kỳ, cấu hình/lịch, backup riêng tư/restore bản mới/import/recovery; Google UAT và retention còn chờ |
| T18 | Browser/mobile/security/load/UAT | 164 kiểm thử local đạt, 5.101 dòng, rollback/chunk, Portal hai workbook mock, quyền ghi-only, desktop/390px/mẫu in; Google/hai tài khoản thật vẫn chờ |
| T19 | Deploy/bàn giao tài khoản khách | PARTIAL; hai link DEV đã triển khai v21; chưa nghiệm thu Production/bàn giao khách |

Đợt mới đã xử lý L01/L02/L04/L05 và snapshot cho phiếu sản xuất mới liên kết (L03 legacy không thể tự suy ra quá khứ). Hướng dẫn 7 nhóm tại `docs/NGHIEP_VU_LIEN_KET.md`. Tiếp theo khởi tạo trên DEV, cấu hình Portal/backup thật, đối chiếu dữ liệu cũ và nghiệm thu hai Google accounts/ACL/trigger. Luân chuyển hàng trả, phân bổ tồn/khấu hao và mọi quy tắc kế toán chưa duyệt vẫn không được đánh dấu nghiệm thu theo số test.
## Lộ trình chính thức từ bộ tài liệu mới — 16/11/2026

Các ID T00–T19 ở bảng cũ phía trên là lịch sử, **không trùng nghĩa** với T00–T25 trong docs/requirements/07_TASKS_LO_TRINH.md. Từ đây dùng bộ mới và matrix78REQ.

| Task mới | Trạng thái thực tế |
| --- | --- |
| T00 audit/matrix | LOCAL_AUDIT_DONE:78REQ/36route/93acceptance, baseline166pass; Google inventory/legacy blocked |
| T01 auth feasibility | CODE_MOCK_PARTIAL / BLOCKED_GOOGLE_UAT: chưa hai Gmail và ACL thật |
| T02–T06 foundation/schema/journal | PARTIAL: code/test có; chưa normalized lines, migration versioned/clean-checkout checkpoint đầy đủ |
| T07 two-way sync | PARTIAL: hash/versions có; thiếu quarantine/onChange/cursor và latency Google |
| T08–T12 catalogs/recipes/production/stock | PARTIAL: xem matrix; thiếu effective master/recipe lines/source policies |
| T13 returns/kiosk | MISSING chuỗi returnId→received→sale, không coi sales.returned là ledger kiosk |
| T14 revenue/settlement | NEXT_G02: D01/D02/D03 đã chốt, cần shared formula/tests trước nghiệm thu |
| T15 entry modes | PARTIAL/MISSING: chưa acceptance100→130→90, lý do backfill và draft/diff |
| T16–T18 HR/finance/targets | PARTIAL: policy allowance/expense, labor cap cũ còn trừ cogs phải sửa |
| T19–T21 dashboards/CEO/Strategy | PARTIAL: shared metrics cần G02, thiếu đầy đủ KPI/sources/alerts |
| T22 Portal | CODE_MOCK_PARTIAL / GOOGLE_CONFIG_PENDING |
| T23 performance/UI | PARTIAL: chưa Google P50/P95, 10users, visual theme mới |
| T24 legacy migration | BLOCKED_SOURCE: thiếu hai workbook source, không import phỏng đoán |
| T25 release | BLOCKED_GATES: authGoogle/source/accounting/UAT, không production-ready |

### Tiến độ G02 sau xác nhận D01/D02/D03

T14/T18 core formula đã LOCAL_TESTED: net trước chi phí, hỗ trợ thu hồi riêng, phần điểm chịu phải trả; Food cost32,2%/SX15% cùng mẫu số; sửa labor headroom không trừ COGS và không tính khi thiếu nguồn/không đạt kế hoạch. 170test đạt, syntax49/build đạt. T00 checkpoint ba0ad6c. Chưa đủ return/kiosk/AR/COGS allocation/giảm trừ khác và Google UAT nên không đổi toàn task thành DONE. Xem docs/ACCOUNTING_POLICY.md.

G02 đã DEPLOYED_DEV22 sau readback4file; source3896256 được xuất archive/build/test170đạt. Chưa GoogleGate1/legacy/UAT, không setup lại vì không đổi header. Checkpoint docs/checkpoints/REQUIREMENTS_2026-11-16.md.


### G04 / T07 checkpoint

LOCAL_TESTED_PARTIAL: shared source validation, paging coverage, financial/linked-write gates, repeated scan quality and unverified editor audit. 177test, syntax50/build pass. No header migration. Remaining quarantine UI/journal integrity/import/Portal/onChange/cursor/Google UAT in docs/SOURCE_QUALITY.md. Deployment tracked in HANDOFF.

G04 checkpoint1e293cf ?? DEPLOYED_DEV23, readback4files kh?p v? hai DEV URL x?c nh?n@23; kh?ng setup l?i. Google UAT v?n pending.

Popup timing: LOCAL_TESTED177, closes before bootstrap after verified oauthFinish; actual Google browser auto-close remains unverified, sandbox/COOP fallback retained.

Excel downloads: LOCAL_TESTED185, all prior CSV output buttons replaced with .xlsx, Excel import template roundtrip and RBAC pagination preserved. No schema migration. Hosted download/desktop Excel UAT pending. See docs/EXCEL_EXPORT.md; rollout status HANDOFF.

Excel DEPLOYED_DEV26 after exact4file readback, no setup required; local185tests pass; hosted/desktop download UAT pending.

## Performance final local checkpoint — 2026-11-17

PERF01–05 LOCAL_TESTED210; PERF06 local benchmarks complete, Google/browser/concurrency UAT pending. Syntax58/build/bundled syntax/SHA/logo/offline Excel verified. Final measured mock and 40-sample client CPU benchmarks: docs/PERFORMANCE_2026-11-17.md. Added submitted-snapshot/ACK regression tests, 8-account permission isolation and derived workflow cache invalidation. No guaranteed Google latency. DEV rollout pending this entry; see HANDOFF for final version. Required after rollout: Admin → Nhật ký & đồng bộ → Cài lịch scan, backup và Portal. No setup/schema reset.

## Performance PERF01/02 checkpoint - 2026-11-17

User requested full-system measured optimization. Added service counters and reproducible synthetic benchmark100/1000/5000, source dependency reads per mutation, request-only raw/table memoization excluding auth, contiguous batch writes/audit, module versions, timing logs and partial-write read guard. 190tests pass. Mock5000-row material save getValues59->11, cells470345->65052, time362.79->54.93ms (single run, NOT Google P50/P95). Reversal stays complete; delete includes all referring modules. Docs/PERFORMANCE_2026-11-17.md lists phases and remaining work. Baseline output/performance-before.json retained. No deployment yet; DEV remains26, no Sheets data/triggers/ACL changed. Next PERF03 shell/module cache/Dashboard, PERF04 scoped scanner, PERF05 RAM router/dedupe, PERF06 benchmarks/UAT. Preserve unrelated files.

## PERF03/04/05 checkpoint - 2026-11-17

206local tests pass. Added permission-scoped shell/bootstrap+module versions, list caches, Dashboard/Strategy aggregate endpoints, settlement pagination, bounded physical snapshot/export windows; cache RAM and read dedupe, Strategy chart DOM reuse, idle catalog prefetch. Scoped onEdit to changed business rows (or module fallback), incremental _Sync/audit, slice reconciler+onChange; trigger install code updated but NOT installed on Google. Public Excel runtime moved to new ExcelRuntime.html with SHA256 verified public CacheStorage/lazy RPC; logo payload shared3places, Index3.58MB->1.02MB uncompressed. Save pending/ACK/unknown-result preserves key and submitted snapshot; no optimistic financial totals. Source rules unchanged. See docs/PERFORMANCE_2026-11-17.md. DEV still26, not deployed yet, no Sheets data/ACL/trigger writes. CUA inventory apps:[],browsers:[]; real Google/browser/concurrent latency BLOCKED, independent benchmark work continues. Next finish repeated benchmarks, client latency and save regression tests; inspect publicAsset and cache scope before 5-file DEV rollout.


## Performance DEV27 verified rollout - 2026-11-17

Source checkpoints7e93fa9/662ec7d/d3e45e8/7cff3c6. Fresh remote-before-performance backup matched26. Google initially rejected shared Strategy logical assignment; changed to equivalent conditional, added Apps Script syntax guard and reran210tests/syntax58/build successfully. Push5files succeeded; exact version27 readback matches Code/Index/Portal/ExcelRuntime bytes and manifest semantics. BOTH existing DEV app/callback deployments confirmed@27, historical@2 unchanged. No schema/setup/business data/ACL/trigger writes. Admin still needs to click "Cai lich scan, backup va Portal" in Nhat ky & dong bo to install incremental schedule. Real Google/browser/OAuth/concurrent-user latency unverified because no connected browser; do not mark PERF06 fully accepted. Full before/after metrics, changed files, risks and UAT steps: docs/PERFORMANCE_2026-11-17.md. Preserve unrelated pre-existing dirty files.


## Data loading follow-up Task1/2 - 2026-11-17

New pasted user task read fully. Baseline per-module and three-year period fixtures captured output/data-loading-before.json. Implemented chunked module index and bounded period/page reads, lookup/record APIs, optional versioned protected DEV-only report snapshots;216tests pass. Details docs/DATA_LOADING_2026-11-17.md. No Google/browser measurements (CUA inventory empty), no deployment yet (DEV27 remains live). Next frontend lazy lookups/recipe details, payroll/stock aggregates, queue/SWR, final benchmarks and DEV readback. No original workbooks edited.


## Data loading follow-up Task3-8 local checkpoint - 2026-11-17

223tests/syntax63/build/bundle/runtime hash/offline preview pass. Connected compact lookup + deferred recipe details, monthly/department payroll and paged inventory summaries, explicit RAM SWR/as-of status, read queue2 total/1 background with foreground priority and writes bypass. Task3/5 intermediate216tests passed; task7 regression222 and final index5000 test223 pass. Versioned report snapshots are owner-protected, optional DEV-only auto-create,128slots; no business history changes. Index uses compact tuples, Unicode-safe chunks, same-request cells reuse and fresh selected rows. PERFDIAGNOSTICS opt-in separates open/getValues/decode/JSON/server/transport-queue timings. Mock week-next read110085->855cells; Dashboard cache-eviction405241->205cells/41->5getValues. Cold source reads remain; exact limits and all-module evidence docs/DATA_LOADING_2026-11-17.md. Google/browser/2-5-8 concurrent accounts UAT still unavailable, not accepted. Fresh remote-before-data-loading backup matches verified27; deployment pending this entry. Preserve unrelated dirty files.


## Data loading report coverage completion - 2026-11-17

Added aggregate/snapshot/pagination for cost, demand and variance too, using shared domain functions and preserving source gates; no history download to browser to render these reports. Added parity regression;224tests/syntax63/build and final bundle syntax pass. Final metrics refreshed in docs/DATA_LOADING_2026-11-17.md with all five period-summary endpoints. Cold source dependencies remain complete for accuracy. Source HEAD uploaded once as candidate only, deployments still27 until final readback.


## Data loading DEV28 verified rollout - 2026-11-17

Source28604a7/ef30f54. Fresh backup matched27; exact28 readback matches5files (manifest semantic). BOTH existing DEV callback/app deployments confirmed@28; historical@2 unchanged.224local tests,syntax63/build/bundle/runtime hash/offline preview pass. No original workbook/business data/ACL/trigger/setup writes. DEV-only _ReportSnapshots may auto-create as a protected disposable cache after first authorized Admin report; no setup rerun. Rollback both IDs to27 if needed. Real Google/browser/2-5-8user UAT still pending (empty CUA inventory), not accepted from mocks. See docs/DATA_LOADING_2026-11-17.md for actual bottlenecks, per-module before/after, cold-read limits and next tests. Preserve pre-existing unrelated files.


## MASTER M00 audit checkpoint - 2026-11-17

Full new master request preserved docs/MASTER_REQUEST_2026-11-17.md. Baseline224tests pass; repository document inventory/hashes output/master-repository-inventory.json. Existing auth/performance DEV28 not restarted. Created required DECISIONS_REQUIRED.md, TEST_RESULTS.md, PERFORMANCE_REPORT.md, DEPLOYMENT_GUIDE.md and docs/MASTER_AUDIT_2026-11-17.md, with M01-08 backlog. M01 next: OAuth rate guard/no network under global lock, session metadata and alert UI. Google/legacy/policy blockers remain explicit. Existing unrelated dirty files retained; no source workbook/ACL/Google data writes.


## MASTER M01 - 2026-11-17

Implemented persistent global OAuth-start budget (default30/minute; config10..120), short callback state locks with Google HTTP outside the global lock, optional client-declared device hints/server lastSeen, Admin security alerts and idempotent acknowledgement. Session revocation/role disable clears signing cache and device metadata; metadata never authorizes access. Files: src/server/security.js,auth.js,oauth.js; src/client/app.js; scripts/build.mjs; tests/gas-mock.mjs,security-center.test.mjs; rebuilt dist. Validation:228/228 local tests,syntax65/build pass (output/master-m01-tests.txt). Google OAuth/browser/concurrency UAT remains pending; live DEV28 unchanged. Global budget is a quota guard, not IP identification; no secret/token shown in security UI. Next M02 return/kiosk physical lifecycle.


## MASTER M02 - 2026-11-17

Added authenticated Thu hoi & ki-ot screen/API using existing _Workflows journal (no business-schema rewrite). Approval -> physical receipt -> bounded sale from remaining lot quantity; rejected returns never enter stock. Sale creates one sales voucher and one linked consumption marker atomically; Admin undo reverses linked sale before receipt/approval, preserves original history. Source hashes/direct-edit checks, closed periods, scoped grants, durable idempotency, rollback and unknown-outcome retry retained. No return approval/receipt creates revenue or treats returned goods as spoilage. Store-borne revenue/D03 expense remain in original sales calculation.233/233 local tests pass including100/80/10/10, replay, overdraw, rollback, undo and UI double-click;syntax68/build passed before final UI test. New src/server/kiosk.js,src/client/kiosk-view.js; integrations schema/access/navigation/app/api/storage/workflows/build/test loaders. Quantity only: valuation/batch/expiry D16 not decided, explicitly pending. Source reads are scoped sales/stores/dishes plus workflow ledger; cold scan of these remains, response pages100. No Google deployment or source workbook edits. Next M03 entry commands and M04 productivity.


## MASTER M03 - 2026-11-17

Added entry API and Nhap co kiem tra UI for immutable operational vouchers: NEW/BACKFILL/APPEND/CORRECT. Mandatory server preview digest includes relevant source hashes and workflow state. Correction prepares reversal+replacement+linked stock effects in one existing journal transaction; no intermediate committed reversal. Scope is explicitly one selected voucher:100base+30append,correct base to90 ->120; correcting that replacement to60 ->90 total. Existing append remains intact. Preview diff, reason, closed periods, grants, stale-source refusal, rollback, retry same request and logout/permission-change private-dialog cleanup covered. Extracted mutationEffects_/mutationAccess_ without changing ordinary mutate behavior.237/237 local tests;syntax71/build pass before final UI regression. Files: src/server/entry.js,api.js,workflows.js; src/client/entry-view.js,app.js,kiosk-view.js; build/test loaders; tests/entry.test.mjs. Existing simple create remains for compatibility; checked flow is additional. Cold correction intentionally validates all dependencies; no claim of Google latency. No Google deployment/data writes. Next M04 shared productivity and variance percentage.


## MASTER M04 shared KPI correction - 2026-11-17

Primary productivity now total produced+extra / SX hours; achieved output/hour remains goodProductivity, separate total/rejected/good fields. Missing SX attendance on any production date returns unknown, not inflated ratio. Shared report drives targets and strategy. Variance adds signed difference/theoretical percentage (100actual/90norm=11.11%; denominator0 ->null). Fixed remote cost/demand/variance headers incorrectly inherited from inventory and repaired mangled price labels. Bumped READ_MODEL_VERSION to invalidate old report snapshots.240/240 local tests,syntax72/build pass. Files shared/domain.js,strategy.js,server/read-model.js,client/app.js and KPI/domain tests. Configurable thresholds/bonus policies and Google daily/monthly UAT remain pending; no invented defaults. DEV28 unchanged.


## MASTER M05 inspection/backup - 2026-11-17

Added Admin read-only source issue workbench (module filter,100issues/page, row/ID/reason, route link). Native private backups now compare canonical hashes/row/column counts for known business/system tables before copy, copied workbook, and source after copy. Manifest stored in main audit; LAST_BACKUP updated only after successful comparison. Registered-copy verification UI; modified or legacy-manifestless backup is refused by restore API. Restore still creates a review workbook and never switches SPREADSHEET_ID. Scope explicitly excludes disposable cache, unknown schema tabs and Script Properties; native copy preserves other workbook content but does not claim independent verification of it. Verification bounded2.5million cells/pass; large data needs separate batch verification.243/243 local tests,syntax74/build pass; Google Drive ACL/restore-drill remains external UAT. Files server/inspection.js,operations.js,maintenance.js; client/operations-view.js; build/mock loader;tests/inspection.test.mjs. No original workbook edits/Google deployment.


## MASTER M06 explicit order-plan link - 2026-11-17

Added authenticated orderPlans/linkOrderPlan API and approved-order row dialog. Authorized orders+production approver explicitly maps one approved order into an existing same-dish plan with remaining planned capacity; quantity is not added to planned/stock/revenue/demand. Duplicate/replay/over-allocation/stale source/closed-day controls; unlink reason and append-only audit. Linked plan reversal/correction blocked until unlink. Source edits flag stale links instead of silently recomputing; private contact/customer omitted from planning response. New read endpoints use global read/write stamp guards.247/247 local tests;syntax77/build passed before final read-guard/UI regressions. Files server/order-planning.js,api.js,workflows.js,storage.js,inspection.js; client/order-planning-view.js,app.js; loaders;tests/order-planning.test.mjs. Existing Portal separate-workbook lifecycle remains; actual Portal project/ACL/invites/status UAT blocked by Google resources, no automatic merge D22 chosen. No Google data or deployment changes.


## MASTER M07 safe units/schema checkpoint - 2026-11-17

Added shared mass/volume unit ratio validation and editor hints:kg->g1000,l/lit->ml1000; incompatible mass/volume refuses implicit density. Custom bags/cans/bottles retain explicit user-supplied conversion; cooking yield remains separate recipe yield. Exact fixture114g cooked x100 /2.5 =4.56kg raw and91200 at20000/kg tested;2.5 is never a default. Centralized unchanged schema definitions; read-only Admin schema diff, and initialize still preflights every table before writing any header. No columns added/reordered or source data auto-converted.250/250 local tests,syntax78/build pass. Files domain.js,inspection.js,maintenance.js,operations.js,client/app.js,operations-view.js;tests/units-schema.test.mjs. Normalized recipe-line database migration/effective price schema remains blocked by source/UOM/policy approval; existing JSON recipe and dated receipts/snapshots preserved. Google UAT still pending. Next M08 cross-feature performance/index review, matrix refresh, DEV-only readback rollout if authorized environment permits.


## MASTER M08 integration checkpoint - 2026-11-17

258/258 local tests;syntax80/build pass. Indexed return/order/production marker joins remove quadratic scans; new scoped20second report caches retain fresh auth, version/stamp guards, force refresh and read queue. Reproducible benchmark scripts/benchmark-master.mjs100/1000/5000:5000cold kiosk3069.21->374.87ms (28reads/275085cells unchanged),orderPlans3164.73->442.69ms (33reads/310075cells unchanged apart from nonce3cells); hot3authreads15/21cells. Node/mock single runs, NOT Google latency. Backup now short claim/final locks, Drive/hash reads outside global lock, core consistency + app-stamp verification; failed creation consistency cannot later be promoted merely by checksum equality. Quantity precision preserves .001kg stock/count adjustments, variance excludes stocktake adjustments from physical incoming. Direct Sheets duplicate allowance and overlapping overnight shifts now block payroll; fixed old benchmark employee fixture to avoid duplicate overlapping shifts (historical performance fixtures not directly comparable). Server app-session signing credentials now also owner-only Script Properties with TTL/fingerprint, bounded80index, cleanup on revoke/disable/recovery; cache eviction no longer forces re-login and signatures/durable nonce replay checks remain. Google tokens/Client Secret never copied to UI or business sheets; Script Properties credentials are NOT included in workbook backups. CUA rechecked apps:[],browsers:[]; real Google/ACL/concurrent/visual UAT blocked. Live DEV28 until verified new rollout.


## MASTER final Dashboard payload follow-up - 2026-11-17

Removed unused employee-level payroll array from Dashboard RPC; now at most three department aggregates, while payroll details stay behind paged payroll API. Backend shared report/targets/strategy calculations unchanged. Bumped read-model version.260/260tests,syntax80/build pass. Final valid distinct-employee fixtures output/data-loading-master-final.json:5000cold Dashboard42reads405246cells/8877bytes; durable snapshot5reads205cells/8879bytes. Cold payroll18reads150255cells/10875bytes,hot3reads84cells. Single Node/mock run, not Google SLA; old overlapping-worker benchmark fixture is historical and not a valid payroll-comparison baseline. Intermediate DEV29 deployed/readback verified; final small code change pending versioned rollout.


## MASTER recovery QA follow-up - 2026-11-17

Added authenticated owner-scoped requestStatus returning only journal state (no effects/records). Unknown kiosk key now survives SPA navigation; retries keep same operation/key. Entry/kiosk/order-link and legacy editor only unlock a replacement after confirmed ROLLED_BACK, never from NOT_FOUND/PREPARED/timeout. Late responses fenced by session/grant scope; logout/permission change clears private pending dialogs. Pending state is RAM, not a durable business outbox: hard reload/closing an unconfirmed write still requires checking source/journal before starting a new voucher.267/267 tests,syntax81/build pass, including cross-account/grant-change callback races. Live DEV30 until verified rollout of this source.


## MASTER M09 checkpoint - 2026-11-17

273/273 local tests; syntax83/build pass. Financial completeness guards, request-local static configuration batching, visible-page sync60s/focus refresh and backup verification feedback. See docs/MASTER_M09_2026-11-17.md. Candidate built; verified DEV31 remains live until final source readback and rollout.

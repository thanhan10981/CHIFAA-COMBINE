## 2026-11-17 — Master DEV30,260kiểm thử local

Thêm chuỗi thu hồi→thực nhận→bán/hoàn tác ki-ốt; nhập mới/bù/bổ sung/điều chỉnh có preview/diff và giao dịch nguyên tử; liên kết đơn duyệt với kế hoạch hiện có. Bổ sung bảo mật phiên bền qua cache eviction, cảnh báo/quản lý phiên, ngân sách OAuth, bỏ lock lúc Google HTTP; kiểm tra nguồn/schema và backup có dấu kiểm tra. Sửa năng suất tổng/đạt, cột báo cáo, tỷ lệ hao hụt, chính xác tồn nhỏ và phụ cấp/ca trùng từ Sheets. Tối ưu index/cache API mới và tổng hợp lương Dashboard. Hai deployment DEV30/readback5file khớp; Google/ACL/visual/concurrency UAT còn chờ. Chi tiết docs/MASTER_RESULT_2026-11-17.md; không thay workbook gốc hoặc dữ liệu nghiệp vụ.

## 2026-11-16 — Styled Excel downloads

- Replace CSV output with real .xlsx, Vietnamese headers, CHIFAA title/source, frozen headers, filters and typed dates/numbers.
- Excel import template + instructions, read-back through existing preview/validation; retain legacy CSV/JSON input.
- Local embedded ExcelJS4.4.0, loading feedback, no CDN/data upload; 185tests/syntax52/build pass. Hosted/desktop visual UAT pending.

## 2026-11-16 ? Close verified login popup sooner

- Main window attempts popup.close immediately when oauthFinish issues a verified session, before session persistence and Sheets bootstrap.
- 177tests pass; popup test verifies close-before-bootstrap order. Browser sandbox/COOP may still block closing; hosted result not yet verified.

## 2026-11-16 ? G04 source validation

- Detect invalid permitted source rows beyond bootstrap page200; block reports and selected linked financial/stock writes without replacing raw errors with0.
- Validate checkbox/deletion cells before coercion; repeated scans retain invalid findings and record an unverified Sheet editor.
- 177 local/mock tests, syntax50/build pass; no schema change, Google UAT still pending. See docs/SOURCE_QUALITY.md.

## 2026-11-16 - Logic audit (no deployment)

- Reviewed current DEV14 logic; documented four locally reproduced data/payroll/report issues and a financial-page permission/display wiring issue.
- Added local-only audit reproducer and detailed completeness report; corrected outdated task/UAT/parity status.
- Existing121 tests still pass, syntax34 passes; these gaps are not proof of completed business acceptance. Live DEV remains14; no business rules or Google data changed.

## 2026-11-16 - DEV version 14

- Replace JSON account permissions with grouped sidebar-page/action checkboxes, group selection, existing-user editing and readable summaries.
- Add optional _routes metadata for explicit page visibility, source-read dependency disclosure and strict server validation; retain module/action authorization and legacy account compatibility.
- 121 tests pass and desktop/narrow layouts reviewed; both active DEV URLs updated to verified version14. No live account/workbook changes performed.

## 2026-11-16 - DEV version 13

- Polished responsive navy/orange login card and branding.
- Initial HTML now shows a dedicated branded loading screen; hide login during session restoration and bootstrap, with connection errors/Retry on the loading screen.
- 115 tests pass and local desktop/narrow Chrome layouts reviewed; both active DEV URLs updated to verified version13.

## 2026-11-16 - DEV version 12

- Request centered 520x680 Google OAuth popup on normal login click instead of default new tab.
- Preserve opener detachment, blocked-popup fallback, duplicate-click guard and best-effort close after signed bootstrap.
- 113 tests pass; both active DEV URLs updated to verified version12. Browser-controlled Google popup closure remains to confirm.

## 2026-11-16 - DEV version 11

- Restore unexpired signed application sessions after page reload using IndexedDB and non-exportable CryptoKey; keep business records in RAM.
- Recheck server session and current permissions before restoring workspace; clear on logout/revocation/expiry and preserve retry on network failure.
- 112 tests and real local Chrome reload/key persistence test passed; both active DEV URLs updated to version11. Hosted Google iframe reload confirmation remains pending.

## 2026-11-16 - DEV version 10

- Added 30-second per-user/permission bootstrap cache with forced fresh refresh and fail-safe Sheets fallback.
- Added contextual spinners and admin/audit skeletons; preserve displayed data during sync and reject stale route responses.
- Prevented overlapping sync; batch expired replay nonce cleanup and optimize duplicate-ID checks.
- 107 tests passed; both active DEV URLs updated to verified version10. Real Google latency/UAT remains pending.

# Changelog

## 0.2.0-dev — 2026-11-15

Thay GIS iframe + verifier Node bằng OAuth code/PKCE, callback `/exec`, back-channel Google UserInfo trong Apps Script. Giữ `_Users`, RBAC, audit, phiên Admin đơn; bổ sung HMAC với khóa RAM không export được và nonce ledger `_AuthRequests`, DEV workbook guard, thu hồi phiên khi đổi role/khóa tài khoản. Không đổi schema nghiệp vụ hoặc các route. Xóa service verifier khỏi source/package. Thêm hướng dẫn Cloud/OAuth/deploy và biên bản UAT hai tài khoản. Kiểm thử local không thay thế nghiệm thu Google DEV thật.

## 0.1.1-dev — 2026-11-15

Sửa cú pháp logical assignment `||=` trong payroll mà Apps Script editor của người dùng từ chối ở dòng 162. Thay bằng biểu thức tương đương, thêm kiểm thử chống tái xuất hiện trong backend. Cần chép lại dist/Code.gs và bật manifest V8 trong project Google; chưa kiểm thử trực tiếp runtime Google.

## 0.1.0-dev — 2026-11-15

Khởi tạo từ đầu vào được cung cấp, giữ phác thảo và logo gốc. Thêm logo navy chỉnh nét, nền tảng Apps Script/SPA, schemas, nghiệp vụ cơ bản, phân quyền/phiên, giao dịch/đồng bộ, portal riêng, importer, verifier, checks/tests và tài liệu. Chưa triển khai lên Google, chưa hoàn tất nghiệm thu nghiệp vụ hay tương đương toàn bộ phác thảo.
# DEV update — 2026-11-16

- Sidebar khôi phục nhóm đóng/mở, SVG, nhánh con, badge vật tư và trạng thái chọn theo phác thảo; vẫn lọc theo quyền.
- Phiếu mới tự điền snapshot giá/chiết khấu, lương/bộ phận/phụ cấp từ danh mục; loại công thức theo trang đang mở. Không sửa snapshot bản ghi cũ.
- Callback Google có giao diện xác nhận, nút đóng và hướng dẫn đóng thủ công; bỏ lời khẳng định chắc chắn auto-close sau phản hồi thực tế của người dùng.
- 95 kiểm thử đạt; đã kiểm tra ảnh local desktop/mobile. Đã triển khai version 6 lên hai URL DEV đang dùng; chưa nghiệm thu đầy đủ chức năng phác thảo hoặc hai tài khoản Google thật.

# DEV session fix — 2026-11-16

- Version 7: Admin xác minh Google lại có thể thay phiên cũ của chính tài khoản đó sau khi đóng tab; khóa ký cũ bị xóa và phiên cũ bị thu hồi. Không cho Admin khác chiếm phiên.
- Mở lại/tải lại vẫn cần xác minh Google vì khóa phiên chỉ lưu trong RAM. Không lưu token vào browser storage.
- 98 kiểm thử đạt; đã triển khai lên hai URL DEV hiện dùng. Kiểm thử đăng nhập lại trên trình duyệt thật đang chờ người dùng xác nhận.

# DEV logo update — 2026-11-16

- Version 8: dùng logo gốc mới do người dùng cung cấp, tách nền thành PNG trong suốt; bỏ logo bạc/nền navy cũ khỏi build.
- Thay tại đăng nhập, sidebar, Portal và bản xem trước; generator workbook dùng asset mới cho template tạo về sau. Không thay dữ liệu Sheets đang dùng.
- Đã kiểm tra alpha, ảnh trên nền xanh/trắng, build và 28 file JavaScript; triển khai hai URL DEV hiện dùng.

## 2026-11-16 — Chiến lược kinh doanh theo phác thảo (DEV v15)

- Làm lại màn hình riêng: tiêu đề xanh đậm, chọn ngày/tuần/tháng/quý/năm, 4 KPI, ưu tiên điều hành, 8 khối phân tích và bảng điểm bán/món.
- Dùng dữ liệu Sheets đã cấp quyền; biểu đồ xu hướng, hòa vốn, xếp hạng, phân bổ doanh thu, 12 tháng và kịch bản 30 ngày. Không dùng số mẫu hoặc coi hàng trả là hàng hủy.
- 127 test đạt; kiểm tra desktop/điện thoại 390px. Đã cập nhật hai URL DEV hiện có lên v15, không đổi dữ liệu hoặc backend. Hướng dẫn và giới hạn tại docs/CHIEN_LUOC.md; Google UAT còn chờ.

## 2026-11-16 — Rà soát kết nối và toast góc phải (DEV v16)

- Thêm toast thành công/lỗi/cảnh báo/thông tin, nút đóng, gộp trùng, tối đa 4 thông báo; tự ẩn và tạm dừng khi hover/focus. Hiển thị và tương tác được trên dialog bằng popover.
- Nối vào lưu/đảo/duyệt/xóa, cập nhật quyền/thu hồi phiên, đồng bộ, CSV, đăng nhập/đăng xuất, mất/kết nối lại và đơn Portal. Giữ lỗi tại chỗ; TIMEOUT/NETWORK là cảnh báo. Không spam thành công khi sync nền.
- Rà soát 36 route/RPC/hàm bảo trì; thêm docs/KET_NOI_CHUC_NANG.md. Chạy lại audit tái hiện các lỗi nghiệp vụ còn mở, không thay quy tắc kế toán hoặc dữ liệu.
- 132 test đạt, syntax39 và build đạt; Chrome desktop/390px xác nhận toast trên dialog có thể tương tác, không tràn ngang.

## 2026-11-16 — Nối 7 nhóm nghiệp vụ — DEV phiên bản 19

- Hai link DEV hiện có cùng chạy phiên bản 19; đã đọc lại bốn file từ Google và đối chiếu với bản build đã kiểm thử. Chưa khởi tạo bảng mới/chạy UAT Google thay người dùng.

- Sản xuất tự xuất nguyên liệu và snapshot giá vốn, kiểm kê tự điều chỉnh tồn; đảo nguồn hoàn tác theo lô, chặn hồi tố qua kiểm kê. Khóa/mở kỳ có lý do và kiểm tra backend.
- Portal có lịch publish/import/trả trạng thái, tạo workbook/thư mời và khách tra cứu đúng thư mời; dự án/URL Portal và lịch Google thật cần cấu hình.
- Phân bổ thanh toán theo nợ và thu nợ cũ không cộng quỹ hai lần; chặn trả vượt. Lãi vay tự nhập số tiền theo kỳ theo yêu cầu người dùng, xem trước/lập chi/chống trùng kỳ; không tự tính theo lãi suất. Lương–thưởng chốt tạo chi, snapshot/in lại/hoàn tác, chặn sửa chấm công đã chi.
- Màn hình Admin backup riêng tư/restore bản mới/CSV–JSON import có mẫu/xem trước/recovery; journal chunk có hash cho lô lớn. Phân trang server, lazy chunk cho báo cáo và CSV đầy đủ, mẫu in phiếu/lương/báo cáo.
- Ô Phiếu liên kết cấp ghi-only, không tự mở sổ quỹ/kho; backend chặn ghi trực tiếp sổ không được chọn. Giữ OAuth/RBAC/chữ ký/replay và DEV-only, không đổi cột nghiệp vụ hoặc ACL workbook.
- 164 test đạt; thử 5.101 dòng, Portal hai workbook mock, lương snapshot lớn/chunk và Chrome desktop/390px/mẫu in. Lãi nhập tay kiểm tra bằng DOM/API. Google UAT hai tài khoản, kích hoạt thực tế và dữ liệu legacy còn chờ. Hướng dẫn: docs/NGHIEP_VU_LIEN_KET.md.

## 2026-11-16 — Sửa timeout khi khởi động

- Tách thông báo tải/xác thực khỏi trạng thái ghi chưa rõ; giữ khóa phiên khi lỗi mạng để thử lại, không tự ghi lại phiếu.
- Bootstrap chờ tối đa 90 giây thay vì 25 giây; xác thực/kết nối thông thường 60 giây, thao tác bảo trì 180 giây. Spinner vẫn hiển thị khi chờ.
- Backend dùng lại một handle workbook trong từng RPC, giải phóng ở cả nhánh thành công/lỗi; không cache danh tính hay bỏ kiểm tra quyền.
- 166 kiểm thử đạt, syntax47 và build đạt. Chưa đo độ trễ trên Google bằng trình duyệt thật.

## 2026-11-16 — Giao diện quản trị đồng bộ — DEV phiên bản 21

- Hai link DEV hiện có đã cập nhật phiên bản 21; bốn file đọc lại từ Google khớp bản build đã kiểm thử.

- Thiết kế lại đăng nhập với nhận diện gọn, ô tài khoản rõ, nút Google nền trắng và biểu tượng bốn màu. Giữ nguyên xác thực và lưu phiên.
- Thêm theme dùng chung cho ứng dụng và Portal: chữ dễ đọc, cam có tương phản tốt hơn, sidebar/header gọn, form/dialog/bảng/báo cáo/thông báo nhất quán; số liệu căn phải và tabular.
- Có breakpoint desktop/tablet/mobile và focus bàn phím; không tải font/CDN ngoài, không thay đổi mẫu in. Chi tiết tại docs/GIAO_DIEN.md.
- 166 test, syntax47 và build đạt, CSS parse đạt. Không có trình duyệt kết nối để review hình ảnh mới; nghiệm thu thiết kế thực tế còn chờ.

## 2026-11-16 — Audit bộ yêu cầu đầy đủ, T00/T01

- Lưu nguyên ba tài liệu và SHA256, tách13chuyên đề. Tạo matrix78REQ, gapsP0/P1/P2,28quyết định, kiểm kê36route và báo cáo93ca acceptance.
- Baseline166test đạt, syntax47/build đạt; fresh remote HEAD đọc lại khớp DEV21. Không thay Google data/ACL/trigger/deployment trong audit.
- Auth owner/code/PKCE có code/mock, gate hai Gmail/ACL vẫn BLOCKED_GOOGLE_UAT; không báo Done vì chỉ có giao diện/mock.
- Người dùng xác nhận base net revenue trước chi phí cho Food cost32,2%/SX15%, hỗ trợ thu hồi là chi phí riêng, phần điểm chịu phải trả sau chiết khấu. Task kế tiếp sửa shared formula và tests.

## 2026-11-16 — D01/D02/D03: thống nhất doanh thu thuần và trần lương SX

- Net = bán + phần điểm chịu sau chiết khấu, trước chi phí; thu hồi/chi khác hạch toán riêng một lần. Tiền thu/thu nợ cũ không đổi net; thiếu/invalid không ra0.
- Food cost32,2% và SX15% dùng chung net trên report/targets/Strategy. Dư địa labor không trừ COGS, cần đủ nguồn/kỳ và đạt kế hoạch. Giữ cột dữ liệu cũ, không migration khi chỉ đổi read-model/label.
- Thêm4test cross-model, tổng170đạt; syntax49/build đạt. Returns/kiosk/AR và Google UAT còn mở; xem matrix/gap/decisions, không bật báo cáo chính thức.

## 2026-11-16 — Checkpoint yêu cầu / DEV22

- T00commitba0ad6c; source3896256 build/test170đạt từ gitarchive. File yêu cầu byte gốc khớp hash trong archive.
- Hai link DEV22 đã đọc lại4file và đối chiếu; giữURL, không data/schema/ACL/trigger writes. Không cần chạy setup cho thay đổi công thức read-model này.
- Auth haiGmail/ACL và legacy import vẫn blocked theo gate; checkpoint, matrix và93caacceptance không được đánh dấu nghiệm thu bằng testmock.


## 2026-11-17 — Performance final local validation

- 210tests, syntax58/build và bundle/runtime hash/logo/offline preview checks đạt. Thêm benchmark client40lượt/cỡ, trạng thái lưu/ACK và cách ly8tài khoản; sửa invalidation cache khi chỉ thay workflow.
- Mock lớn: lưu vật tư59→11getValues; sửa ô trực tiếp95→3; Index3,58→1,03MB. Không coi thời gian mock là Google SLA. Báo cáo đầy đủ, rủi ro đồng bộ và hướng dẫn deploy5file tại docs/PERFORMANCE_2026-11-17.md.
- Google/browser/concurrent UAT và cài trigger mới chưa thực hiện. Theo dõi phiên bản DEV cuối tại HANDOFF.md.

## 2026-11-17 - Performance PERF01/02 (local)

Scoped mutation dependencies, request-only reads, batch effects/audit/journal, module versions and safe read guard. 190tests pass; measured mock evidence and next phases in docs/PERFORMANCE_2026-11-17.md. Not deployed.

## 2026-11-17 - Performance PERF03-05 (local)

Lazy shell, scoped cache, aggregate dashboards/strategy, windowed exports, incremental onEdit/reconciliation, RAM router/read dedupe and pending/ACK handling. Shared logo and on-demand verified public Excel runtime reduce initial HTML. 206tests pass, Google/browser UAT pending.


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

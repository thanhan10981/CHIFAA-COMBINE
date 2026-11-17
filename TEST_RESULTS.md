# Kết quả kiểm thử master session

RPC-WIRE:287/287local tests,91JSsyntax,build/server+inlineparse đạt.58tests mục tiêu bao gồm client phiên và bảo mật;2test mới kiểm tra JSON ASCII qua client→backend, nguồn tiếng Việt/emoji/CRLF/số nhỏ, chặn chữ ký sửa/phát lại/staff. Lô91bản ghi thật chỉ chạy trong GASmock:154effects,63materials,6recipes,0stock; evidence output/legacy-2026-11-17/rpc-wire-verification.json. Không có phép đo/tái hiện hosted Google; lỗi chữ ký từ ảnh chưa xác định nguyên nhân gốc bằng telemetry.

Đơn vị liveDEV33: source da46387 đã đọc lại5file và gán hai deployment hiện có; lịch sử@2 giữ nguyên.285tests/syntax90/build/compiledparse đạt. Bằng chứng mã triển khai: output/chifaa-dev/unit-system-version33-readback.json; danh sáchdeployment tương ứng. Hosted Google UAT/ACL/browser và import dữ liệu thật vẫn chưa chạy.

Hệ thống đơn vị candidate:285/285tests, syntax90, build/server/3bundle parse đạt.6test mới về package khácpricebasis, không đổi mật độ ngầm, blankmin≠0, giápending≠0, receiptprice lịch sử, Admin/RBAC/version/replay, importprovenance và guard đổi đơn vị đã liên kết, AdminUI. Full fixtures vẫnpass; scanner vẫn chỉ đọc module thay đổi. Lô91records actualsource chỉ trongmock:154effects,63materials/6recipes/63provenance/0stock. Evidence output/unit-system-tests.txt và unit-normalization-verification.json. Không phải Google UAT.

Checkpoint chuẩn bị vật tư:279/279local tests, syntax87. Thử lô57bản ghi thực tế bằng GAS mock: preview0lỗi,11stores/11dishes/33materials/2recipes, lặp lại bị chặn57ID,0stockrows. Không có Google reads/writes; DEV32 vẫn dùng source release trước. Log output/legacy-material-tests.txt; evidence output/legacy-2026-11-17/materials-verification.json. Test mới: ID tiếng Việt không gộp, nguồn #N/A và giá thiếu khác0, blankthreshold không tự gán0, chỉ nhập batch đầy đủ, đơn vị chú thích không tự coi làkg.

## Hiện tại — DEV32

273/273 local tests,0fail; syntax83/build/bundle parse đạt. Readback32 khớp5file; CLI xác nhận haiDEV@32, lịch sử@2 giữ nguyên. Chỉ xác minh mã triển khai, không xác minh vận hành Google. Kết nối browser thất bại `No browser is available`; hai Gmail/ACL/popup/Drive/trigger/concurrency chưa chạy. Case mới và evidence: docs/MASTER_RESULT_2026-11-17.md; các checkpoint bên dưới giữ kết quả tại thời điểm chạy.

Baseline17/11/2026: **224pass/0fail**, `npm test`, log output/master-baseline-tests.txt. DEV28 đã đọc lại5file ở checkpoint trước. Unit/DOM/GAS mock dùng fixture, không gọi Google OAuth/Sheets thật.

Google auth hai Gmail, ACL, trigger lag, concurrency2/5/8/10, mobile/browser visual và restore thật vẫn NOT_VERIFIED. Không gán PASS cho25tiêu chí master chỉ vì có224test local. Các nhóm mới sẽ cập nhật sau từng task; TEST_REPORT.md giữ lịch sử acceptance93ca riêng.


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


## Final32 verification

273/273pass,0fail; syntax83/build and compiled server/3inline bundles parse. Source7f3bf88; exact5file readback32 (manifest semantic), both existing DEV@32, historical@2 unchanged. New cases cover financial unknown vs explicit zero, kiosk cost pending, blank optional cost, request config batching/live stamps/auth config change, visibility poll burst protection. Evidence: output/master-m08-tests.txt; output/chifaa-dev/master-version32-readback.json; output/chifaa-dev/master-final-deployments.txt. Google/ACL/Drive/popup/concurrency/visual UAT not performed.

# Kết quả kiểm thử master session

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

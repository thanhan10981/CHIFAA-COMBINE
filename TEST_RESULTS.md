# Kết quả kiểm thử master session

Baseline17/11/2026: **224pass/0fail**, `npm test`, log output/master-baseline-tests.txt. DEV28 đã đọc lại5file ở checkpoint trước. Unit/DOM/GAS mock dùng fixture, không gọi Google OAuth/Sheets thật.

Google auth hai Gmail, ACL, trigger lag, concurrency2/5/8/10, mobile/browser visual và restore thật vẫn NOT_VERIFIED. Không gán PASS cho25tiêu chí master chỉ vì có224test local. Các nhóm mới sẽ cập nhật sau từng task; TEST_REPORT.md giữ lịch sử acceptance93ca riêng.


## MASTER M01 - 2026-11-17

Implemented persistent global OAuth-start budget (default30/minute; config10..120), short callback state locks with Google HTTP outside the global lock, optional client-declared device hints/server lastSeen, Admin security alerts and idempotent acknowledgement. Session revocation/role disable clears signing cache and device metadata; metadata never authorizes access. Files: src/server/security.js,auth.js,oauth.js; src/client/app.js; scripts/build.mjs; tests/gas-mock.mjs,security-center.test.mjs; rebuilt dist. Validation:228/228 local tests,syntax65/build pass (output/master-m01-tests.txt). Google OAuth/browser/concurrency UAT remains pending; live DEV28 unchanged. Global budget is a quota guard, not IP identification; no secret/token shown in security UI. Next M02 return/kiosk physical lifecycle.

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


## 2026-11-17 - Performance PERF01/02 (local)

Scoped mutation dependencies, request-only reads, batch effects/audit/journal, module versions and safe read guard. 190tests pass; measured mock evidence and next phases in docs/PERFORMANCE_2026-11-17.md. Not deployed.

## 2026-11-17 - Performance PERF03-05 (local)

Lazy shell, scoped cache, aggregate dashboards/strategy, windowed exports, incremental onEdit/reconciliation, RAM router/read dedupe and pending/ACK handling. Shared logo and on-demand verified public Excel runtime reduce initial HTML. 206tests pass, Google/browser UAT pending.

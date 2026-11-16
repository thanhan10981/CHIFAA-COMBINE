# 04 — KIẾN TRÚC, ĐỒNG BỘ GOOGLE SHEETS, BẢO MẬT, HIỆU NĂNG

## 1. Ràng buộc cố định

- Google Apps Script (V8) + HTML Service + Google Sheets + Drive, quy mô <10 người dùng đồng thời; chi phí thấp và không cần VPS.
- Không phụ thuộc `IMPORTRANGE` cho dữ liệu nghiệp vụ; không trộn sheet báo cáo nguồn cũ làm database.
- Người dùng muốn cả hai thao tác: sửa trong app, và **xem/sửa trực tiếp trên những cột nghiệp vụ cho phép ở Google Sheets**. Không có quyền đó nghĩa là requirement chưa đạt; cấp Editor toàn bộ bảng nhạy cảm là **không đạt bảo mật**.
- Giao diện mượt nhưng không che giấu trạng thái: không được toast “Đã lưu” trong khi request còn gửi nền, không để người đổi tab mất nội dung chưa lưu.

## 2. Cấu trúc code đích

```
src/
  client/ (App shell, router, feature pages, state, charts, animations, auth adapter)
  server/ (rpc facade, auth, RBAC, repositories, services, sync, jobs, reporting)
  shared/ (types, schema, validators, invariants, UOM, calculations)
  deploy/ (clasp, appsscript.json, migrations, trigger installers)
  tests/ (units, app-level, Google sandbox e2e, visual)
  assets/ (logo gốc, icons dùng theo design system)
  docs/ (data dictionary, mapping, runbook, task/handoff)
```

- Chia Apps Script services, không gom tất cả vào một `Code.gs` hàng nghìn dòng khó bảo trì. Frontend SPA tạo từ bundler vào HTML Service, không reload toàn trang cho chuyển menu.
- `google.script.run` gọi bất đồng bộ; wrapper Promise có requestId, cancellation UI và timeout hiển thị, success/failure handlers. Batch dữ liệu theo phân hệ/period, tránh gọi Sheets cho mỗi nút/tab.

## 3. Bảo mật OAuth và phiên

### Bài học lỗi đã gặp (PHẢI KIỂM THỬ THẬT)

Trong quá trình setup, đã có client OAuth loại Web, Script Property `GOOGLE_CLIENT_ID`, Admin trong `_Users`, nhưng popup Google trả **401 `invalid_client` / `no registered origin`**. Đây là lỗi *OAuth client/origin/flow*, KHÔNG phải `_Users` thiếu Admin. Code mẫu cũ dùng Google Identity Services trong Apps Script HTML iframe. Không cố đăng ký origin không hợp lệ, không mở authorization cho bất kỳ ai trước khi auth working.

Phương án user ưu tiên: **A — chỉ Google Apps Script + Sheets**, Admin và kế toán đăng nhập Google; backend access Sheets dưới quyền chủ sở hữu nhưng không cấp Editor toàn workbook cho mọi người. Đây là ràng buộc phải giải bằng POC thật, không được chỉ viết lời quảng cáo. Đặc biệt:

- `executeAs = USER_ACCESSING` có thể cần user quyền với từng tài nguyên Sheets; không mặc nhiên đáp ứng bảo mật nếu share workbook full.
- `executeAs = USER_DEPLOYING` giữ Sheets kín nhưng `Session.getActiveUser().getEmail()` không luôn cung cấp danh tính người truy cập trong web app; **không dùng email trống hoặc admin's email làm fallback**.
- Nếu dùng OAuth Authorization Code + redirect/Apps Script OAuth2, xác minh callback hợp lệ, state CSRF, PKCE nếu được hỗ trợ, nonce/ID token signature/audience/issuer/expiry, server-side session; cần test bằng hai Gmail độc lập và tài khoản không được cấp quyền.
- Nếu không có POC thuần Apps Script đáp ứng cả security và UX, ghi **BLOCKED: AUTH_ARCHITECTURE**, báo rõ tradeoff và quyết định cần chủ dự án chốt; không bỏ auth hoặc mở Sheets để “chạy được”.

### Yêu cầu Auth/RBAC

- Roles: `admin`, `accountant`, `staff` có thể mở rộng scopes `SX/VP/BH`, `store`, `customer`. Admin full; kế toán được Admin chọn nhóm chức năng/action. Permissions theo action `read/create/update/delete/approve/export` (có thể thêm `reverse/close`). Server **kiểm tra ở mọi RPC và mọi query**, không chỉ ẩn menu; filter ở cấp record/store khi cần.
- `User`: verified Google subject/email, enabled, permissionVersion. Session: ID bất biến, token hash, TTL, lastSeen, revocation, `deviceLabel` chỉ tham khảo, alerts. Admin chỉ 1 phiên active, login thứ hai có cảnh báo, cách thu hồi đúng quyền. Chặn reuse và login flood.
- Trước login không có dữ liệu số lương, doanh thu, khách hàng, công thức bí mật trong HTML, JSON, API hoặc localStorage; `doGet` shell nội bộ không tiết lộ embedded business dataset.
- `CacheService` và client caches theo `userId+role+permissionVersion+datasetRevision`; không đưa lương/tài chính vào cache share toàn cục. Logout/revoke user làm cache dữ liệu nhạy cảm vô hiệu.
- Không hardcode `GOOGLE_CLIENT_ID` secret (Client ID không phải secret, nhưng verifier credentials/secret là secret), spreadsheet IDs tài chính hoặc keys trong source public. Script Properties chỉ server. Audit không đưa token/Gmail đầy đủ ra log công khai.
- Rate limit cho auth/challenge/order portal, CSRF state, clickjacking/caching policy phù hợp HtmlService, input sanitization chống formula injection trong Sheet (`=`, `+`, `-`, `@`, tab), XSS, server authorization, quota, request size.

## 4. Đồng bộ hai chiều thật sự

- **Ứng dụng → Sheets:** write service kiểm tra `expectedVersion/rowHash`, LockService, write batches, audit row delta, bump revision. Client chỉ success sau server ACK. Nếu mất phản hồi, kiểm tra trạng thái theo requestId để biết có áp dụng chưa.
- **Sheets → ứng dụng:** installable `onEdit` bắt edit thủ công, `onChange` cho thêm/xóa rows/cột (nếu phù hợp), job reconciliation quét theo batches (kể cả thay đổi qua API/script không trigger). Kiểm định schema/data type/foreign key; coi edit sai là `INVALID` và cách ly khỏi report, alert owner.
- **Mọi trường hợp:** edit trực tiếp Sheets không dễ xác thực chính xác cá nhân editor từ trigger trong mọi ngữ cảnh; nếu không có verified identity, audit actor là `SHEET_EDITOR_UNVERIFIED` kèm timestamp/doc ID, không tự ghi một Gmail đoán được.
- **Conflict:** không đè record mới hơn; diff old/new, UI yêu cầu resolve. Trường hợp rename đơn vị/đổi quy cách phải tạo version/historical effect, không hồi tố báo cáo đã chốt.
- **Đặc biệt:** bảng ledger, _Users, _Audit, ID, versions, headers cấm edit trực tiếp; nếu muốn sửa phiếu chính thức dùng correction/reverse flow. “Sửa ở Sheet” áp dụng cho **vùng dữ liệu master được cho phép**, không áp dụng tùy tiện mọi vùng.

## 5. Hiệu năng Apps Script

### Thời điểm khởi động

- **Trước xác thực:** tải HTML shell, CSS, JS bundle, logo gốc, icon, chart library nếu phù hợp. Có thể tạo non-sensitive static cache. **Không preload Sheets business** trước auth vì quyền chưa được chứng minh.
- **Sau xác thực:** một `bootstrap` nạp user permissions, danh mục được phép, cài đặt UI, KPI ban đầu, revision; còn dữ liệu chi tiết theo lazy load/prefetch phụ thuộc quyền và khả năng người dùng sẽ mở.
- UI chuyển tab ngay, dùng state cache rồi refresh `stale-while-revalidate` có nhãn “đang cập nhật” nếu snapshot cũ; không hiện số cũ là số mới khi chờ sync.

### Server

- Gộp read range `getValues()` theo bảng, ghi `setValues()` theo lô, tránh `openById`/`getRange` lặp trong vòng for; request route cần data tối thiểu. `rawRows_()` hiện tại đọc toàn bộ bảng lặp trong nhiều chỗ, cần đo và tối ưu.
- Các bảng tăng theo năm dùng partition/archival, pagination, materialized read model cho dashboard, indexes/search keys trong cache/metadata. Khi vài nghìn dòng không đọc toàn bộ mọi sheet mỗi lần bootstrap.
- Mọi job quét Sheets có cursor/chunk, không chạy `scanSheets_()` toàn bộ workbook trên mỗi onEdit, dùng debounce/invalidation và reconciliation định kỳ.
- CacheService TTL/hit stats; invalidate theo revision, role/permissionVersion, logout; dữ liệu tài chính cá nhân phải xử lý riêng. Không xem cache là nguồn dữ liệu chính; Sheets là durable.
- Đặt budget sau đo (không hứa zero latency): ví dụ KPI/chuyển tab warm phản hồi gần như tức thời từ cache, server call có progress rõ, đo P50/P95 theo module, log retries/timeouts, tránh mục tiêu vô thực tế khi Apps Script quota/network thay đổi.

### Ghi dữ liệu

- Async background save có badge `Đang lưu...` / `Đã lưu` sau ACK / `Chưa lưu` khi lỗi, không mất draft nếu đổi tab. Retry chỉ request READ hoặc WRITE có idempotencyKey. UI không được resend 2 phiếu nếu người dùng click 2 lần.
- Offline: chỉ hỗ trợ xem cache phù hợp quyền nếu an toàn và **lưu nháp chưa gửi**; không tuyên bố dữ liệu đã ghi Sheets khi mạng mất. Dữ liệu nhạy cảm không lưu localStorage plain text không hạn chế.

## 6. Animation, responsive, accessibility

- Navy/cam, card border-radius, form/table/chart thẳng hàng. Sidebar dropdown mở/đóng độc lập, icon có width cố định, text `min-width:0` và không bị wrap từng từ; mobile có drawer.
- Animation nhẹ cho card number count, chart reveal, skeleton, hover, modal/dropdown, lọc thời gian, row insertion; có `prefers-reduced-motion`, tránh layout shift và blocking script.
- Biểu đồ có data source, legend, units, labels và các trạng thái no-data, partial, demo; hỗ trợ màu sắc có nghĩa và không dựa chỉ vào màu (icon/chữ).
- Không trưng bày số “V17” trong nhãn chính hoặc thông báo lỗi kỹ thuật. Lỗi form thân thiện có mã để support, không leak stack trace/người dùng khác.

## 7. Backup, recovery, deploy

- Giữ file cũ nguyên. Backup Sheets DEV hằng ngày trên Drive riêng; có retention và thao tác restore vào một bản mới, đối chiếu row counts/key totals/permissions trước khi chuyển nguồn; backup phải bao cả cấu hình schema, migration, source code (không backup secret vào public).
- Thêm `Audit` và `_Requests`; ghi nhiều bảng là **không có ACID transaction** của database: thiết kế idempotent journal, compensating reversal/reconcile, trạng thái PREPARED và recovery. Không xóa `_Requests` nếu nghi ghi một nửa.
- `clasp push` đồng bộ source; Apps Script `/dev` HEAD cho editor và `/exec` version đóng băng. Update URL `/exec` bằng `New version` trên deployment cũ (không tạo URL mới tràn lan); test smoke after deploy. Khi đổi schema chạy migrate riêng, không chạy init để xóa cũ.
- Cấu hình manifest timezone `Asia/Ho_Chi_Minh`, V8, oauthScopes tối thiểu cần dùng. `SPREADSHEET_ID` nhận **ID**, không nhận toàn URL (`Illegal spreadsheet id or key` từng xảy ra).
- **Không hứa tự cập nhật `/exec` khi code được lưu**, không yêu cầu chạy lại `khoiTaoDEV` sau mỗi lần chỉnh CSS. Nếu Codex tiếp tục trong phiên mới thì đọc HANDOFF + Git commit.

## 8. Cổng khách

- Tách deployment/rights/storage public/private. Public portal chỉ có dữ liệu món được publish, địa điểm giao và đơn của chính khách; không có shared function cho internal reports để khách lách qua `rpc`.
- Có rate limit, anti duplicate order, approve workflow. Nếu token link mời thì token có expiry/revocation và không gắn dữ liệu nhạy cảm; cách đăng nhập khách là DECISION_REQUIRED.
- Kết nối customer order approved → kế hoạch sản xuất **theo nguồn tham chiếu** tránh double count với kế hoạch tay.

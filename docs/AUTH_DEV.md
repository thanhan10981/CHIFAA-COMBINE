# OAuth thuần Apps Script và Sheets — chỉ DEV

## Trạng thái và mô hình

Mã đã được chuyển sang OAuth Authorization Code + PKCE S256, dùng URL `/exec` của deployment Apps Script làm callback. Chưa triển khai/xác nhận hai tài khoản trên Google thật trong phiên này. Xem `AUTH_TASKS.md` và `AUTH_DEV_UAT.md`.

Google chỉ xử lý đăng nhập/consent. Runtime ứng dụng là Apps Script, lưu dữ liệu ở Sheets; không có Cloud Run, Firebase, dịch vụ verifier, thư viện OAuth bên ngoài hoặc GIS trong iframe. Google Cloud chỉ cấu hình OAuth client/consent. Không đăng ký origin của `googleusercontent.com`.

1. Tab CHIFAA sinh bí mật trình duyệt bằng Web Crypto; gửi SHA-256 tới `oauthStart`.
2. Apps Script giữ state, PKCE verifier, hash bí mật trình duyệt, hạn 5 phút trong Script Cache. Trả URL Google có state và PKCE challenge, không có bí mật trình duyệt.
3. Nút mở Google ở tab riêng bằng thao tác người dùng. Google trả `code` + `state` về **đúng URL `/exec`** đã đăng ký.
4. Callback kiểm tra state và tiêu thụ một lần dưới ScriptLock; đổi code tại endpoint Google bằng Client Secret + verifier. Gọi UserInfo qua HTTPS với access token để xác minh `sub`, `email_verified`, Gmail/Workspace và `_Users`. Không đọc/giải mã JWT chưa xác minh. Không sử dụng `Session.getActiveUser()` hay `getEffectiveUser()` làm danh tính người dùng app.
5. Callback chỉ hiển thị thông báo cố định. Tab gốc poll `oauthFinish` bằng state + bí mật trong RAM; server kiểm tra ràng buộc tab rồi phát phiên. Mã callback, state, email, Google token, khóa phiên không được nhúng vào HTML hoặc gửi qua postMessage/URL trở lại tab gốc.
6. The RPC returns an opaque application session ID and signing key once. The browser imports a non-exportable HMAC CryptoKey, discards the raw signing key, and stores only {token, key, expires} in IndexedDB under a server-issued workbook/deployment scope. Google tokens, Client Secret and business records are never stored there. Reload signs a fresh bootstrap request; the server rechecks session, current user/permissions, expiry and replay protection before returning any data.
7. Mọi RPC nội bộ ký HMAC-SHA256 trên action + nội dung + ID yêu cầu + thời gian. Backend kiểm tra phiên, khóa, chữ ký, lệch giờ tối đa 60 giây, nonce một lần rồi mới đọc/ghi. `_AuthRequests` giữ nonce bền vững 120 giây: cache eviction không làm request cũ hợp lệ trở lại. Retry phiếu giữ business idempotency key, tạo chữ ký/request ID mới.
8. `_Users` được đọc lại mỗi request. `_Sessions` chỉ giữ hash session ID, metadata; khóa ký ở Script Cache tối đa 2 giờ. Cache mất → yêu cầu đăng nhập lại. Thu hồi/hết hạn/vô hiệu hóa tài khoản chặn ngay request tiếp theo. Một phiên Admin áp dụng cho tất cả tài khoản mang role admin, kế toán có thể làm việc đồng thời.

Google access token chỉ tồn tại trong biến cục bộ callback để gọi UserInfo; không giữ refresh token, không yêu cầu offline access. Client Secret chỉ trong Script Properties. Google `sub` được ràng buộc với email bằng hash trong Script Properties để phát hiện đổi danh tính. Khi cần thay tài khoản Workspace cùng email, chủ sở hữu kiểm tra danh tính rồi xử lý binding trong editor; không tự bỏ qua kiểm tra.

## 1. Kiểm tra quyền file DEV

- Dùng Google Sheets **native**, không dùng file XLSX trực tiếp. Giữ `SPREADSHEET_ID` hiện có nếu đó là DEV, không tạo/nhập lại hoặc xóa dữ liệu.
- Workbook và Apps Script project chỉ chia sẻ cho chủ sở hữu/dev đáng tin cậy. **Kế toán và nhân viên không được cấp Viewer/Editor trên workbook backend hoặc project.** Sheet Protection và ẩn tab không phải ranh giới bảo mật cho người đã có quyền đọc workbook.
- Kiểm tra Share của workbook, project, thư mục cha và link sharing. Nếu đã chia sẻ cho kế toán/nhân viên, chủ sở hữu cần gỡ quyền trực tiếp trước UAT. Web app hoạt động bằng quyền người triển khai nên không cần share workbook.
- Dùng hai Google profile/browser riêng khi thử hai tài khoản, tránh chọn nhầm Google account do nhiều phiên đăng nhập.

## 2. Cập nhật mã và schema

Chạy `npm run check`, `npm test`, `npm run build`. Chép **cùng phiên bản** `dist/Code.gs`, `dist/Index.html`, `dist/Portal.html`, `dist/appsscript.json` vào DEV Apps Script; hoặc dùng clasp với `.clasp.json` trỏ chính xác DEV (`rootDir: dist`). Không upload `src`, `source`, `node_modules` hoặc secrets.

Chạy `setup_` từ editor bằng chủ sở hữu (hoặc wrapper khởi tạo editor đã có). Hàm không xóa nghiệp vụ, kiểm tra header trước khi cập nhật và tạo thêm `_AuthRequests` nếu thiếu. Không đổi cột của `_Users`, `_Sessions` hoặc các bảng nghiệp vụ. Template XLSX cũ vẫn nhập được; setup tạo bảng hệ thống mới. Bản hiện tại gồm 17 bảng nghiệp vụ + 6 bảng hệ thống.

Chủ sở hữu chạy `recoverAdminSessions_` một lần trong editor khi chuyển auth để đóng phiên Admin cũ. Các phiên bearer cũ tự bị chặn vì không có khóa HMAC. Đóng deployment cũ còn chạy mã GIS; nếu giữ nó, mã auth cũ vẫn có thể tồn tại ở URL cũ. Không xóa audit hoặc dữ liệu nghiệp vụ.

Chỉ `doGet` và `rpc` là cửa vào dữ liệu. Không thêm wrapper public cho `data_`, `rawRows_`, `bootstrap_`, `admin_`, import, backup hoặc recovery. Hàm editor bảo trì kết thúc `_` không được gọi qua `google.script.run`.

## 3. Google Cloud / OAuth Client

1. Dùng project Google Cloud DEV do bạn quản lý. Trong Google Auth Platform cấu hình Branding, email hỗ trợ, Audience **External / Testing** cho Gmail cá nhân và thêm **hai Gmail Admin + kế toán** làm test users. Workspace có thể dùng Internal nếu phù hợp miền; không giả định Gmail dùng được Internal.
2. Data Access của OAuth đăng nhập chỉ cần `openid` và email (`https://www.googleapis.com/auth/userinfo.email`). **Không yêu cầu scope Sheets/Drive cho nhân viên.** Scope rộng trong manifest Apps Script là quyền chủ sở hữu cấp cho runtime, tách với OAuth đăng nhập người dùng.
3. Tạo OAuth Client loại **Web application**, tên `CHIFAA DEV`. Client Secret chỉ lưu trong Script Properties. Không gửi secret vào chat, repo, bảng tính, ảnh chụp hoặc frontend. Với client mới, sao chép/lưu Client Secret ngay khi tạo: sau khi đóng màn hình tạo, Google không hiển thị lại toàn bộ secret. Nếu đã mất secret, có thể tạo client DEV riêng mới và cập nhật cả Client ID lẫn Secret; không xóa client cũ đang phục vụ ứng dụng khác. Xem [quản lý OAuth clients](https://support.google.com/cloud/answer/15549257?hl=en).
4. Tạo deployment Web App DEV (mục 4) để lấy URL. Sau đó thêm URL đó vào **Authorized redirect URIs**, nguyên văn `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`. Không thêm `/dev`, URL iframe `script.googleusercontent.com`, query, fragment, dấu `/` cuối hoặc `/usercallback` vào client này. Mã hiện dùng `doGet` callback `/exec`, không dùng thư viện OAuth2 `/usercallback`.
5. Authorized JavaScript origins không cần cho luồng này. Lỗi `redirect_uri_mismatch` phải sửa redirect URI chính xác, không quay lại GIS.

## 4. Script Properties và deployment

Apps Script → Project Settings → Script Properties:

| Key | Giá trị DEV |
| --- | --- |
| `SPREADSHEET_ID` | ID Google Sheets DEV hiện tại |
| `AUTH_DEV_SPREADSHEET_ID` | Cùng ID DEV, cơ chế chặn trỏ nhầm workbook |
| `AUTH_ENV` | `DEV` |
| `APP_MODE` | `internal` |
| `ADMIN_EMAIL` | Một Gmail Admin chính, chữ thường |
| `GOOGLE_CLIENT_ID` | OAuth Web client vừa tạo |
| `GOOGLE_CLIENT_SECRET` | Secret cùng OAuth client, chỉ ở đây |
| `WEB_APP_URL` | URL `/exec` chính xác của deployment DEV |
| `WORKSPACE_DOMAIN` | Bỏ trống/xóa khi thử Gmail cá nhân; chỉ đặt khi giới hạn Workspace |

Xóa cấu hình cũ `AUTH_MODE`, `ALLOW_TEST_AUTH`, `VERIFIER_URL`, `VERIFIER_SHARED_SECRET`; mã mới không dùng chúng. Không xóa các properties nghiệp vụ, backup, portal khác.

Deploy → New deployment → Web app:

- **Execute as: Me / người triển khai (chủ sở hữu workbook)**, tương ứng `USER_DEPLOYING`.
- **Who has access: Anyone with Google account**, tương ứng `ANYONE`, để tài khoản kế toán vào được vỏ đăng nhập. Đây là quyền mở app, không phải quyền workbook hay quyền đọc dữ liệu. `_Users` + signed session mới cho phép dữ liệu.
- Manifest đã đặt `ANYONE` + `USER_DEPLOYING`. Chỉ áp dụng DEV. Không bật anonymous và không tạo production deployment trong bước này. Nếu policy Workspace không cho lựa chọn này, dừng và xử lý policy, không share workbook để lách lỗi.
- Chủ sở hữu tự cấp quyền Apps Script. Không chuyển sang Execute as user accessing: cấu hình đó buộc nhân viên có quyền dữ liệu nguồn.

Copy URL `/exec` vào `WEB_APP_URL` và Authorized redirect URIs của OAuth client. Lần tạo đầu có thể deploy trước khi auth properties hoàn chỉnh; lúc đó app chỉ hiển thị lỗi cấu hình, không cấp dữ liệu. Khi cập nhật mã tiếp, Manage deployments → Edit → **New version** trên đúng deployment DEV để giữ URL. Lưu source chưa tự cập nhật `/exec`.

Không nhầm Cloud Project Number, Apps Script Script ID, deployment ID và Spreadsheet ID. Không cần Cloud Run/billing cho verifier. Mọi chi phí/quota Apps Script vẫn theo tài khoản Google của chủ sở hữu.

## 5. Cấp tài khoản kế toán

Admin đăng nhập DEV rồi mở `Tài khoản & phiên đăng nhập`. Thêm Gmail thứ hai, role `accountant`, enabled true; permissions khởi đầu có thể là `{"sales":["read"]}` để thử ranh giới. **Role accountant không tự cấp quyền**; chỉ actions trong JSON mới được phép. Không cấp employees/attendance/cash/loans/debts/assets nếu ngoài phạm vi.

Nếu cần nhập sales thì sau kiểm thử read-only mới cấp thêm `create` và các module tham chiếu cần xem. Module thiếu read có thể làm form/report báo thiếu quyền: không tự mở rộng quyền hoặc preload dữ liệu bí mật để làm dashboard đầy đủ. Report cần nhiều nguồn phải được cấp quyền rõ ràng từng nguồn.

Không thêm Gmail thứ hai vào `ADMIN_EMAIL`. Khi nâng role thành admin hoặc khóa user, server thu hồi phiên hiện tại của user đó. Giới hạn một Admin khiến lần đăng nhập Admin mới bị từ chối cho đến khi phiên cũ đăng xuất/hết hạn/được thu hồi. Mất tab Admin thì chủ sở hữu chạy `recoverAdminSessions_` trong editor; recovery thu hồi tất cả tài khoản mang role admin cùng Gmail `ADMIN_EMAIL`.

## 6. Nghiệm thu và giới hạn

Làm từng dòng `AUTH_DEV_UAT.md` và ghi bằng chứng đã che bí mật. Không ghi PASS cho hai tài khoản Google thật chỉ vì mock pass. Cần xác nhận cả quyền file Drive và response network, không chỉ menu bị ẩn.

Không hứa chống được malware/extension độc hại/XSS chạy trong chính tab hoặc chủ sở hữu/editor đọc Script Properties. CryptoKey không export được giảm lộ khóa thụ động; XSS vẫn có thể sử dụng khóa ký. Giữ render text cho nội dung không tin cậy và không thêm script remote. HTTPS + PKCE + state/browser binding + HMAC/nonce + hạn 2 giờ + revoke xử lý các đường giả mạo/phát lại thông thường. Reload can now restore the same unexpired session from IndexedDB after fresh signed server verification; see docs/SESSION_RESTORE.md.

Apps Script/Cache/Sheets có quota và không có giao dịch ACID. `_AuthRequests` dọn nonce hết hạn khi có request đã ký; giới hạn 5.000 dòng sống, quá tải trả BUSY. Cache mất khóa có thể buộc đăng nhập lại sớm; phiên Admin vẫn giữ lock theo `_Sessions` đến khi logout/recovery/hết hạn. Chưa đo hiệu năng/quota thật.

Tài liệu Google dùng để thiết kế: [OAuth server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [OpenID/UserInfo và PKCE discovery](https://developers.google.com/identity/openid-connect/openid-connect), [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web), [Manifest access/executeAs](https://developers.google.com/apps-script/manifest/web-app-api-executable).


## Safe OAuth diagnostics (2026-11-16)

The callback and original tab expose only allowlisted diagnostic codes, never Google response descriptions, authorization codes, tokens, email or Client Secret. `OAUTH_TOKEN_INVALID_CLIENT` points to the client credentials; `OAUTH_TOKEN_INVALID_GRANT` to the code/PKCE exchange; `OAUTH_TOKEN_REDIRECT_URI_MISMATCH` to redirect configuration; `OAUTH_TOKEN_FETCH` or `OAUTH_USERINFO_FETCH` to server fetch/authorization; `OAUTH_USERINFO_REJECTED` to the authenticated identity endpoint; `OAUTH_IDENTITY`, `OAUTH_DOMAIN` and `OAUTH_USERS` to the corresponding identity/policy/allowlist stage. `OAUTH_STATE` indicates an unavailable, consumed, expired or configuration-invalid flow (or failure before an exchange-stage diagnostic). Unknown provider errors become REJECTED. These codes support diagnosis; they do not establish the root cause on their own.


## Login tab closure and missing nonce table (2026-11-16)

A normal login click synchronously requests a centered popup (520x680 maximum, constrained to available screen size), clears its opener before Google navigation and keeps a close handle only in RAM. It uses window.open with popup=yes and dimensions, rather than the old two-argument call that defaulted to a new tab. A blocked popup falls back to the noopener link. The verified callback attempts window.top.close() (HtmlService is an iframe); the original tab also attempts to close its saved handle after signed bootstrap succeeds. Browser policies, modifier-clicks or severed handles can prevent automatic closing; fixed manual-close text remains. Failures keep the callback visible with a safe diagnostic. There is no postMessage or token in HTML.

After verified identity and _Users allowlisting, session issuance checks _AuthRequests schema. Only Admin may create the missing table on the guarded DEV workbook, with owner protection. Existing malformed columns are rejected. This one-time missing-table migration revokes pre-migration active sessions (which could not bootstrap safely), logs AUTH_SCHEMA_MIGRATION and then applies the usual one-Admin-session policy. Existing business data and permissions are unchanged.


## Actual browser feedback: auto-close unavailable (2026-11-16)

The user reports the verified callback tab stays open despite both closure attempts. Treat automatic closing as best effort, not a completed real-browser feature. Callback now uses a styled CHIFAA confirmation with an explicit close button and Ctrl+W / tab-close fallback. No token is placed in links or storage, and no opener-based navigation is enabled to bypass browser policy. Sidebar and functional parity follow-up is documented in PHAT_THAO_PARITY.md.
# Đăng nhập lại sau khi đóng tab — 2026-11-16

Current reload behavior: the same unexpired session can be restored from IndexedDB without repeating OAuth or creating another Admin session. If restoration is unavailable/expired/revoked, a fresh Google-verified browser-bound OAuth flow may still replace only the same Admin identity, audit SESSION_REPLACED and revoke the prior credentials. Other Admin identities cannot take over an active session. See SESSION_RESTORE.md.

Kiểm thử hồi quy: đóng tab mà chưa logout rồi đăng nhập lại, request ký bằng khóa cũ bị chặn, chỉ một Admin active, flow chưa xác minh/sai browser proof/sai subject không thu hồi được phiên cũ, Admin khác vẫn bị chặn. Bộ kiểm thử đạt 98/98 trước khi triển khai bản sửa.


Popup API reference: https://developer.mozilla.org/en-US/docs/Web/API/Window/open . Browser policy may still select a tab, block a popup or sever its close handle across Google navigation. Modifier-click keeps normal browser behavior; repeated clicks during polling do not open duplicate windows.

## Checkbox permission editor

The Admin screen now uses sidebar-page and action checkboxes instead of JSON input. See [PHAN_QUYEN.md](PHAN_QUYEN.md). Optional permissions._routes controls explicit page selection; module/action grants still authorize all data RPCs. Report/reference read dependencies are displayed before Save. Existing _Users headers and legacy rows remain compatible. System pages require the Admin role.

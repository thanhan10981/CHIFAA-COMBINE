# OAuth thuần Apps Script và Sheets — chỉ DEV

## Trạng thái và mô hình

Mã đã được chuyển sang OAuth Authorization Code + PKCE S256, dùng URL `/exec` của deployment Apps Script làm callback. Chưa triển khai/xác nhận hai tài khoản trên Google thật trong phiên này. Xem `AUTH_TASKS.md` và `AUTH_DEV_UAT.md`.

Google chỉ xử lý đăng nhập/consent. Runtime ứng dụng là Apps Script, lưu dữ liệu ở Sheets; không có Cloud Run, Firebase, dịch vụ verifier, thư viện OAuth bên ngoài hoặc GIS trong iframe. Google Cloud chỉ cấu hình OAuth client/consent. Không đăng ký origin của `googleusercontent.com`.

1. Tab CHIFAA sinh bí mật trình duyệt bằng Web Crypto; gửi SHA-256 tới `oauthStart`.
2. Apps Script giữ state, PKCE verifier, hash bí mật trình duyệt, hạn 5 phút trong Script Cache. Trả URL Google có state và PKCE challenge, không có bí mật trình duyệt.
3. Nút mở Google ở tab riêng bằng thao tác người dùng. Google trả `code` + `state` về **đúng URL `/exec`** đã đăng ký.
4. Callback kiểm tra state và tiêu thụ một lần dưới ScriptLock; đổi code tại endpoint Google bằng Client Secret + verifier. Gọi UserInfo qua HTTPS với access token để xác minh `sub`, `email_verified`, Gmail/Workspace và `_Users`. Không đọc/giải mã JWT chưa xác minh. Không sử dụng `Session.getActiveUser()` hay `getEffectiveUser()` làm danh tính người dùng app.
5. Callback chỉ hiển thị thông báo cố định. Tab gốc poll `oauthFinish` bằng state + bí mật trong RAM; server kiểm tra ràng buộc tab rồi phát phiên. Mã callback, state, email, Google token, khóa phiên không được nhúng vào HTML hoặc gửi qua postMessage/URL trở lại tab gốc.
6. Session ID + khóa ký được trả **một lần qua RPC** cho tab gốc. Browser nhập khóa HMAC thành CryptoKey không export được, chỉ giữ RAM. Không ghi token vào HTML, localStorage, sessionStorage hoặc cookie do app quản lý. Không thể có app phiên đăng nhập mà browser hoàn toàn không giữ thông tin phiên: khóa RAM này là thông tin phiên app, không phải Google access/refresh token.
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
3. Tạo OAuth Client loại **Web application**, tên `CHIFAA DEV`. Client Secret chỉ lưu trong Script Properties. Không gửi secret vào chat, repo, bảng tính, ảnh chụp hoặc frontend.
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

Không hứa chống được malware/extension độc hại/XSS chạy trong chính tab hoặc chủ sở hữu/editor đọc Script Properties. CryptoKey không export được giảm lộ khóa thụ động; XSS vẫn có thể sử dụng khóa ký. Giữ render text cho nội dung không tin cậy và không thêm script remote. HTTPS + PKCE + state/browser binding + HMAC/nonce + hạn 2 giờ + revoke xử lý các đường giả mạo/phát lại thông thường. Reload mất phiên trong RAM, không tự phục hồi.

Apps Script/Cache/Sheets có quota và không có giao dịch ACID. `_AuthRequests` dọn nonce hết hạn khi có request đã ký; giới hạn 5.000 dòng sống, quá tải trả BUSY. Cache mất khóa có thể buộc đăng nhập lại sớm; phiên Admin vẫn giữ lock theo `_Sessions` đến khi logout/recovery/hết hạn. Chưa đo hiệu năng/quota thật.

Tài liệu Google dùng để thiết kế: [OAuth server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [OpenID/UserInfo và PKCE discovery](https://developers.google.com/identity/openid-connect/openid-connect), [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web), [Manifest access/executeAs](https://developers.google.com/apps-script/manifest/web-app-api-executable).


---

## 4. Trigger, backup và chỉnh trực tiếp Sheet

Chạy `installTriggers_()` trong editor. Trigger edit và quét 5 phút; ứng dụng poll 15 giây khi tab đang hiển thị. Không cam kết cập nhật tức thì. Dấu vân tay dòng chặn ghi đè ngay cả khi edit trigger chưa kịp chạy. Sau sửa Sheet, có thể bấm Đồng bộ để đọc ngay.

Chỉ chỉnh các cột nội dung danh mục được cho phép. Metadata/header và bảng giao dịch được bảo vệ; giao dịch sửa bằng đảo phiếu. Không thêm/xóa cột, đổi tên tab, sửa ID hoặc xóa hàng trực tiếp. Chủ sở hữu Sheet vẫn có thể vượt bảo vệ; không thể dùng UI RBAC để ngăn chủ sở hữu sửa file nguồn. Tài khoản nhân viên app không cần được chia sẻ file backend ở chế độ owner-owned.

Đặt `BACKUP_FOLDER_ID` vào một thư mục Drive riêng tư của chủ dự án, chạy `installTriggers_()` lại. Backup hằng ngày lúc 02:00 Asia/Ho_Chi_Minh. Hiện không tự xóa backup; retention 30 ngày đang chờ chủ dự án duyệt. `backup_()` tạo bản sao; `RESTORE_BACKUP_ID` + `restoreToNewWorkbook_()` tạo bản khôi phục mới để so sánh, không chuyển nguồn tự động. Kiểm tra số dòng/số dư rồi mới đổi SPREADSHEET_ID và cài lại triggers cho file mới.

`recoverPrepared_()` rollback giao dịch PREPARED; chỉ chạy sau khi kiểm tra journal và backup. `recoverAdminSessions_()` thu hồi phiên admin khi mất máy. Các hàm bảo trì kết thúc `_`, không được gọi qua `google.script.run`.

## 5. Cổng khách riêng

Tạo project Apps Script và workbook **khác** cho portal. Không cấp SPREADSHEET_ID nội bộ cho portal. Copy bundle và setup schema, đặt `APP_MODE=portal`, `PORTAL_SIGNING_SECRET` bằng bí mật riêng tối thiểu 32 ký tự; không chia sẻ secret với browser. Cổng khách không có endpoint tài chính/nhân sự.

Project nội bộ đặt `PORTAL_SPREADSHEET_ID` bằng workbook portal và cùng signing secret. `publishCatalog_()` chép món đã công bố và điểm bán sang workbook portal. `invite_(storeId,customer,days)` tạo thư mời 1–30 ngày; gắn vào fragment `#invite=TOKEN` của URL portal. Không log hay đăng công khai token. `importPortalOrders_()` nhận đơn mới vào nội bộ theo recordId, chỉ thêm một lần. Hiện đồng bộ portal là tác vụ editor; chưa tự cài lịch. Đơn duyệt mới xuất hiện trong nhu cầu đơn hàng, tách khỏi kế hoạch nhập tay để tránh cộng trùng.

Đơn gửi lại cùng key không trùng; giới hạn 30 đơn/giờ/thư mời. Chủ dự án vẫn cần kiểm tra đơn trùng ngữ nghĩa nếu khách chủ động tạo yêu cầu mới cùng nội dung. Chưa có SMS/email thông báo, chưa theo dõi trạng thái đơn phía khách.

## 6. Bàn giao từ dev sang khách

Tạo tài nguyên thuộc tài khoản khách; copy source đã tag và workbook mẫu rỗng. Tạo OAuth client, secrets, backup folder và portal riêng. Thực hiện cấp quyền bằng tài khoản khách. Không chuyển bản dev chứa phiên, audit/PII hoặc secrets. Chạy nghiệm thu, backup/restore và đo hiệu năng trên tài khoản khách trước khi mở quyền. Gmail cá nhân có chính sách OAuth/quota khác Workspace; phải kiểm tra trong tài khoản thật.

Tài liệu chính thức: [Web apps](https://developers.google.com/apps-script/guides/web), [google.script.run](https://developers.google.com/apps-script/guides/html/reference/run), [Installable triggers](https://developers.google.com/apps-script/guides/triggers/installable), [clasp](https://github.com/google/clasp).

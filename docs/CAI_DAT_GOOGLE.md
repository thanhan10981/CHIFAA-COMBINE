# Cài đặt trên Google — môi trường dev

Chưa thực hiện các bước Google trong phiên hiện tại. Không có tài khoản, Spreadsheet ID, OAuth client ID hoặc Script ID được hardcode trong source.

## 1. Tạo workbook mới

Luồng ưu tiên: nhập `output/chifaa-dev/CHIFAA_DEV.xlsx` thành Google Sheets bằng Google Drive, giữ nguyên tên tab và header. Trong ChatGPT cần cài và kết nối Google Drive trước; nếu thao tác thủ công, tải file lên Drive rồi mở bằng Google Sheets và lưu dạng Google Sheets.

Tạo project Apps Script riêng cho dev. Đặt Script Property `SPREADSHEET_ID` bằng ID workbook vừa nhập, `ADMIN_EMAIL` bằng Gmail quản trị thật, `APP_MODE=internal`. Chạy `setup_()` trong trình soạn thảo để áp dụng bảo vệ, định dạng, tài khoản admin. Lần chạy đầu cần bạn cấp quyền Google. Setup dừng nếu phát hiện header lạ; không xóa bảng cũ.

Mã cũng có `createNewDev_()` để khởi tạo workbook bằng Apps Script nếu bạn chủ động chọn luồng đó. Hàm tạo một workbook mới và dùng email chủ sở hữu làm admin; không chia sẻ file. Đây là luồng thay thế, chưa được chạy trên tài khoản của bạn.

## 2. Đưa source vào Apps Script

```powershell
npm ci
npm run check
npm test
npm run build
npm run clasp:login
```

Tạo `.clasp.json` tại gốc dự án (đã gitignore):

```json
{"scriptId":"ID_PROJECT_APPS_SCRIPT_THAT","rootDir":"dist"}
```

Sau đó `npm run clasp:push`. Hoặc copy `dist/Code.gs`, `dist/Index.html`, `dist/Portal.html`, `dist/appsscript.json` vào project bằng trình soạn thảo. Bật Apps Script API nếu clasp yêu cầu. Không copy `source/` vào deployment.

Manifest mặc định `access=MYSELF`, `executeAs=USER_DEPLOYING`: chỉ chủ sở hữu. Không tự đổi thành công khai. Mở rộng quyền truy cập chỉ sau khi nghiệm thu xác thực và chủ dự án chọn phạm vi.

## 3. Xác thực production

Tạo OAuth Web client trong Google Cloud, cấu hình OAuth consent/test users cho Gmail dev và JavaScript origins hợp lệ cho môi trường HtmlService thực tế. Không đoán origin sandbox; kiểm tra lỗi Google Identity trong deployment `/dev`. GIS có thể cần cấu hình bổ sung trong iframe và phải được kiểm thử trên thiết bị thật.

Đặt `GOOGLE_CLIENT_ID` trong Script Properties. ID này là cấu hình công khai được gửi tới nút Google; secrets không gửi ra browser.

Thư mục `verifier/` là dịch vụ Node sử dụng `google-auth-library` chính thức:

```powershell
cd verifier
npm ci
```

Đưa dịch vụ lên Cloud Run hoặc dịch vụ HTTPS do bạn quản lý. Cần billing/quota của tài khoản nếu nền tảng yêu cầu; chưa triển khai hoặc tạo chi phí. Thiết lập biến môi trường `GOOGLE_CLIENT_ID`, `VERIFIER_SHARED_SECRET` (bí mật ngẫu nhiên tối thiểu 32 ký tự, dùng Secret Manager của nền tảng), `PORT` do nền tảng cấp. Endpoint `/verify` chỉ nhận POST với header secret; không log token. Container chạy dưới user `node`.

Apps Script Properties:

| Key | Giá trị |
| --- | --- |
| AUTH_MODE | `verifier` |
| VERIFIER_URL | HTTPS URL kết thúc `/verify` |
| VERIFIER_SHARED_SECRET | Cùng secret dịch vụ verifier |
| GOOGLE_CLIENT_ID | Cùng audience OAuth |
| WORKSPACE_DOMAIN | Để trống khi dùng Gmail cá nhân |

GAS kiểm tra thêm audience, issuer, hạn token, verified email, nonce dùng một lần, domain (nếu đặt), allowlist và quyền server. Chỉ nhận Gmail hoặc Workspace mà Google là đơn vị xác thực email. Token phiên chỉ giữ trong RAM browser; Sheet lưu hash, không lưu token gốc.

Chế độ spike duy nhất: `AUTH_MODE=test-tokeninfo` **và** `ALLOW_TEST_AUTH=true`. Chỉ dùng dev riêng tư, không có dữ liệu khách hàng. Xóa `ALLOW_TEST_AUTH` trước nghiệm thu production. Google nêu tokeninfo phục vụ gỡ lỗi và có thể bị giới hạn: [Verify ID tokens](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [OpenID Connect](https://developers.google.com/identity/openid-connect).

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

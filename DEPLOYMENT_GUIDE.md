# Triển khai DEV và hoàn tác

## Standalone — hướng dẫn hiện tại

Nếu chưa có dự án Supabase DEV, làm theo [hướng dẫn tạo DEV](docs/standalone/SUPABASE_DEV_SETUP.md). Chưa có kết nối cloud nào được xác nhận trong phiên này.

Không triển khai tiếp Apps Script theo yêu cầu mới. Root ứng dụng Vercel là `web/`; database ở `supabase/`.

1. Tạo Supabase project **DEV riêng**, chọn vùng gần Việt Nam (đo latency trước kết luận). Không dùng PROD. Cất DB password trong secret manager.
2. Tạo web/.env.local từ web/.env.example; điền project URL, publishable key, APP_URL=http://localhost:3000. Không đặt service role trong NEXT_PUBLIC_*.
3. Cài Supabase CLI. Với Docker local: `supabase start`; chỉ khi đây là DB local disposable mới `supabase db reset --local`. Với cloudDEV: link đúng projectref rồi kiểm tra `supabase migration list`/`supabase db push --dry-run` trước `supabase db push`. Không chạy lệnh trước khi xác minh projectDEV.
4. Bật Google OAuth trong Supabase Auth, dùng redirect URI Supabase cung cấp ở cấu hình provider; Auth redirect allowlist chỉ `http://localhost:3000/auth/callback` và preview URL được duyệt. Web tự dựng callback từ APP_URL, không tin host tùy ý.
5. Tạo/invite user Auth từ Supabase Dashboard. Owner cấp Admin đầu tiên bằng SQL transaction sử dụng UUID Auth thực tế: insert/upsert profiles(enabled=true); insert user_roles(user_id,role_id='admin') on conflict do nothing. Không tự cấp Admin cho email đầu tiên đăng nhập. Không chạy SQL placeholder chưa thayUUID.
6. `cd web`; `npm ci`; typecheck/lint/test/build; `npm run dev`. Thử tài khoản riêng choAdmin/kếtoán/kháchA/B và RESTAPI trước nghiệm thu.
7. Edgeadmin-invite cần APP_ORIGINS allowlist và serversecret môi trường Edge. Chưa deploy/test thực tế. Storage/Realtimemigrations/chức năng còn xây tiếp; không đánh dấu xong.
8. Vercel: chưa deploy public. Khi được phép preview, chọn root web, thiết lập env đúng SupabaseDEV, callback allowlist theo domainpreviewcụthể; khôngwildcardproduction. VercelHobby không phù hợp thương mại: https://vercel.com/docs/plans/hobby .

### Rollback và backup

Supabase Free có thể pause khi ít hoạt động trong7ngày; cần theo dõi uptime/limits và lịch export riêng. Không coi góiFree là đã có backup đủ điều kiện khôi phục. Đối chiếu nguồn chính thức: https://supabase.com/docs/guides/platform/free-project-pausing và https://supabase.com/docs/guides/platform/backups . Chưa chạy backup/restore drill khi chưa có DEV.

Không có down migration DROP/CASCADE trên dữ liệu nghiệp vụ. Trước migration cloud: backupDB bằng pg_dump với credentialDEV giữlocal, kiểm checksum, restore sang DBDEV riêng rồi mới triển khai. Nếu migration lỗi transaction sẽ rollback; nếu đã commit, rollback application về bản tương thích và dùng forwardfix có kiểm thử. Rollback schema/history chỉ từ backup đã diễn tập trênDB riêng, không overwrite database đang chạy. Hiện chưa có DBcloud/pg_dump/Docker nên chưa thực hiện backup/restore drill.

### Hướng dẫn Apps Script bên dưới là lịch sử

Mới nhất: haiDEV@33, source da46387,285tests/syntax90/build/bundle và readback5file đạt; lịch sử@2 không đổi. Xem docs/UNIT_SYSTEM.md. Không thêm header hoặc bảng mới cho unitsystem; blankmin/conversion và provenance trong_Workflows. Chưa import dữ liệu thật. Sau khi dùng giá có cơ sở khác đơn vị mua, không mở ghi với code32 trở xuống vì code cũ không hiểupricebasis; dừng ghi và đối soát hoặc ưu tiên forwardfix. Đoạn DEV32 dưới đây là checkpoint lịch sử.

Hiện tại: hai deployment DEV đã ở **32**, source trước đợt khớp28/trước bản cuối khớp31; readback32 khớp đủ5file.273test local/syntax83/build đạt. Xem docs/MASTER_RESULT_2026-11-17.md. Google hai tài khoản/ACL/popup/trigger và Drive UAT chưa nghiệm thu.

Chỉ DEV đã chỉ định; không public/production, không chạm2workbook gốc. Mã local khác HEADAppsScript và khác version /exec.

1. `npm test`, `npm run check`, `npm run build`. Đọc HANDOFF và kiểm tra Git dirty; giữ thay đổi ngoài task.
2. Sao lưu source Apps Script hiện có bằng clasp pull vào output/chifaa-dev; đối chiếu version đã verified trước khi push. Không xuất Script Properties/token/secret ra Git/chat.
3. Upload đủ5file dist: Code.gs, Index.html, Portal.html, ExcelRuntime.html, appsscript.json. Tạo version mới, pull đúng version đó và đối chiếu byte (manifest semantic).
4. Cập nhật cả deployment callback/app DEV hiện có, giữURL OAuth redirect; list-deployments xác nhận. Deployment lịch sử@2 không đổi. /dev dùng HEAD cho editor; /exec cần version.
5. Không chạy setup mỗi lần đổi UI. Schema mới dùng preflight/backup/migration additive trên DEV, giữ dữ liệu. Các chức năng cần Google quyền/tài nguyên phải nghiệm thu thật.
6. Nếu chưa cài lịch incremental ở27, Admin → Nhật ký & đồng bộ → Cài lịch scan, backup và Portal. Không tự thayACL hoặc cấp Editor toàn file cho nhân viên.
7. Rollback: dừng ghi bằng cách chủ sở hữu tạm đổi AUTH_ENV sang giá trị bảo trì; gán cả2deployment về cùng version đã verified. Không mở lại ghi bằng code cũ khi đã có ledger ki-ốt/liên kết/entry mới mà chưa đối soát tương thích; ưu tiên sửa tiếp trên bản hiểu ledger mới. Không xóa lịch sử/sheet. Backup/restore vào bản kiểm tra riêng, không tự đổi SPREADSHEET_ID.

Hướng dẫn OAuth, Client Secret chỉ nhập Script Properties: docs/AUTH_DEV.md và docs/CAI_DAT_GOOGLE.md. Các tên khóa/cấu hình được kiểm tra ở src/server/oauth.js; giữ owner-execute, AUTH_ENV=DEV và DEV workbook guard. Portal dùng project/workbook riêng, không bật portalMode trên workbook nội bộ.

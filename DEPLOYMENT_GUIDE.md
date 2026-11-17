# Triển khai DEV và hoàn tác

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

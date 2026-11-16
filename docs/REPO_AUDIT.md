# T00 — Kiểm kê thực tế 16/11/2026

Đã đọc đầy đủ ba file người dùng gửi. Bản byte gốc và SHA256 ở docs/requirements/received và RECEIVED_MANIFEST.json; tách13 tài liệu chuyên đề từ consolidated, không thay source ứng dụng bằng HTML phác thảo. Yêu cầu có78REQ và93ca acceptance. Script kiểm tra không thiếu/trùng REQ: scripts/requirement-audit.mjs; 36route được liệt kê riêng trong ROUTE_INVENTORY.md.

Git baseline HEAD90f7925, lịch sử ba commit. Working tree trước audit đã có nhiều thay đổi chưa commit từ các lượt trước; verifier/ có các file bị xóa sẵn, được giữ ngoài commit T00. Log baseline local:166pass/0fail, syntax47, build đạt; kết quả thuộc working tree, không gán cho HEAD90f7925. Báo cáo audit không tuyên bố clean checkout ở HEAD có166test. Checkpoint source G02 sau đó cần lưu toàn bộ phụ thuộc source/tests/build đã kiểm thử, gồm trạng thái bỏ verifier cũ theo Apps Script-only và test source hiện có, để không tạo commit thiếu module. Không reset hoặc sửa nội dung verifier cũ.

| Vùng | Nội dung kiểm kê | Kết quả |
| --- | --- | --- |
| source/ | Một HTML phác thảo, prompt cũ, quyết định bảo mật | HTML giữ như reference; hai workbook legacy không có tại source/root |
| src/shared | schema17bảng nghiệp vụ, META, validators, domain/access/auth protocol/Strategy | Có core, còn missing decision/normalized lines/lifecycle |
| src/server | storage/auth/oauth/api/operations/workflows/financial/maintenance | Owner-owned Sheets; module/action gate; journal/recovery; chưa full sync quarantine |
| src/client | SPA, RPC, IndexedDB session, navigation/permissions/notifications/strategy/operations/import/theme | Không preload data trước login; nhiều route là generic view, chưa full chức năng chuyên biệt |
| dist/ | Code.gs, Index.html, Portal.html, manifest | Build từ source, không sửa dist thủ công |
| Google source | Fresh clasp pull read-only vào output/chifaa-dev/remote-requirements-baseline/source | HEAD khớp exact readback21 đủ4file; manifest so semantic |
| Google deployments | CLI đọc4deployments | Hai link DEV hiện có @21, một historical @2 và HEAD; không sửa deployment trong T00 |
| Manifest | V8, Asia/Ho_Chi_Minh, USER_DEPLOYING, ANYONE | ANYONE mở shell; server vẫn phải auth/RBAC; chưa Google ACL UAT |
| Script Properties/Cloud | Chỉ biết tên khóa source, không đọc values | Live config/client/project/secret state chưa xác minh; không in secret |
| Sheets DEV | Không có connected tool/browser | Chưa đọc live headers/counts/PK/FK/invalid/protection hoặc kiểm tra workbook ACL |
| Trigger/Drive | Code installer/backup đã có | Chưa đọc/cài/chạy trigger thật, chưa folder/restore verification |
| Auth POC | Code/mock có và test denial | BLOCKED_GOOGLE_UAT, xem AUTH_FEASIBILITY.md; không bypass |

READ-ONLY audit: không sửa Google Sheet/ACL/trigger, không import nguồn, không chuyển production. `/dev` chỉ được mô tả theo tài liệu Google, chưa mở authenticated browser thực tế. `/exec` deployment version được CLI xác nhận; chưa smoke login hai Gmail. Gate1 chưa đạt.

Các rule mới D01/D02/D03 đã được người dùng chốt trong phiên: doanh thu thuần trước chi phí làm base32,2%/15%; hỗ trợ thu hồi là chi phí riêng; phần điểm bán chịu vẫn trả theo giá sau chiết khấu. G02 là task triển khai kế tiếp, dùng shared model thay vì copy công thức trong từng màn. Lãi vay nhập tay tiếp tục giữ.

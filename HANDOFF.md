# Handoff 2026-11-15 (Asia/Saigon)

Người dùng yêu cầu đọc 3 prompt, làm logo đẹp hơn; sau đó chọn triển khai cả app. Xác nhận dùng Gmail cá nhân, đang là dev chưa bàn giao khách; chưa có Sheet, yêu cầu tạo mới. Chưa gửi email admin. Google Drive chưa cài/kết nối; đã đề xuất đúng plugin. Không có Codex document session hoặc browser khả dụng. Không có tài nguyên Google nào được tạo.

Đầu vào trong source/ giữ nguyên. Workspace ban đầu trống, không Git; đã init repo. Không có AGENTS/TASKS/handoff gốc, các schema/mapping/task hiện tại là bản suy ra, không giả làm tài liệu gốc.

Code: schema 17 module, 36 route (32 gốc), domain pure, backend Apps Script auth/storage/API/operations, frontend SPA + portal, build, importer, verifier Node. Logo chính navy-v3 tạo bằng image_gen; giữ bản gốc và thử nghiệm transparent.

Local checks đã qua: 66 tests (Node domain, gas mock, DOM emulator); build tạo dist/ và output/. Verifier đã khởi động với cấu hình giả local: thiếu secret trả 403, JWT giả trả 401. Chưa test ID token thật, Google/HtmlService/GIS/Drive protections/triggers. Chưa visual browser vì browser inventory rỗng. Thư viện verifier đã cài và có lock; production login fail-closed nếu không cấu hình verifier. Debug tokeninfo chỉ bật khi chủ động đặt hai properties, không dùng live.

Workbook build artifact output/chifaa-dev/CHIFAA_DEV.xlsx đã tạo với 23 tab (1 hướng dẫn, 17 nghiệp vụ, 5 hệ thống), không có dòng nghiệp vụ giả. OpenXML/header đã kiểm tra; chưa render/kiểm tra engine Excel/Google vì artifact-tool runtime và browser không khả dụng. Dùng XlsxWriter fallback (.tools ignored). Cần import native qua Google Drive khi kết nối, sau đó setup_ trên Google. createNewDev_ là luồng thay thế chỉ dùng khi user chọn rõ.

Blockers: kết nối Google Drive/OAuth/Script ID/Gmail admin, quyết định accounting/ki-ốt/bàn giao. Tasks PARTIAL không chỉ là blockers bên ngoài; cần tiếp tục triển khai fidelity so với phác thảo, tài chính và UX. Đọc TASKS.md, MAPPING_GIAO_DIEN.md và docs/NGHIEM_THU.md trước khi tiếp tục. Không tuyên bố đã làm xong T00–T19.

Resume commands: npm ci; npm run check; npm test; npm run build. Npm test dùng --test-isolation=none do worker spawn bị EPERM trong sandbox ban đầu. Source npx clasp tải từ official package registry khi có kết nối, chưa login/push/deploy. Secret/script IDs nằm Script Properties/.clasp.json ignored, không ghi repo.

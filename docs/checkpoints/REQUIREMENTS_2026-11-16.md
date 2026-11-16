# Checkpoint bộ yêu cầu — 16/11/2026

- Đã đọc đủ3file. Giữ byte gốc và SHA256;13chuyên đề ở docs/requirements. Matrix78REQ, inventory36route,93ca acceptance. Không gán DONE vì chỉ có giao diện/code/mock.
- T00 checkpoint ba0ad6c. G02 source checkpoint3896256. Đã xuất git archive3896256 vào output/checkpoint-3896256, build và170test đạt bằng mã trong commit (dùng dependency node_modules đã cài theo package-lock tại workspace, không gọi Google). Ba file yêu cầu trong commit archive khớp SHA256 nguồn.
- Baseline trước sửa166pass; sau D01/D02/D03 là170pass/0fail, syntax49/build đạt. Local/mock không là Google E2E.
- Source G02 đã push, tạo DEV22, đọc lại đúngversion22 ở output/chifaa-dev/remote-accounting-version22/source. Cả4file khớp dist; hai deployment DEV hiện có cùng@22, mỗi lệnh CLI xác nhận. Historical@2 không đổi. Không Sheets/ACL/trigger/schema/secret writes, không Production.
- D01: net trước chi phí là base32,2%food và15%SX. D02: phần điểm chịu vẫn phải trả giá sau CK. D03: hỗ trợ thu hồi là chi phí riêng; không giảm net. D28 lãi nhập tay giữ nguyên. Xem DECISIONS.md và docs/ACCOUNTING_POLICY.md.
- T01 Gate1 vẫn BLOCKED_GOOGLE_UAT: fresh cua.getState trong phiên apps/browsers rỗng; không có tài khoản browser/Sheets connector. Chưa đọcliveproperties/Cloudclient/ACL/headers/counts/triggers, chưa haiGmaildeny/export/revoke. Không kết luận auth architecture bất khả thi, không bypass/shareEditor.
- T24 blocked source: hai workbook gốc chưa có trong source/root. Không tự suy ra giá/đầu kỳ/catalog và không sửa file gốc.
- Chưa đủ G03returns→kiosk/AR, G04quarantine/cursor/onChange, normalizedRecipeLines, allowancePolicy, entry100→130→90, dashboard/CEO/targets đầy đủ, COGS/depreciation/bonus đã chi trong chi phí, delta/perfGoogle/visualUAT. Matrix vẫn1DONE/70PARTIAL/4MISSING/3BLOCKED. Không gọi production-ready.
- Câu hỏi đang chờ: có Gmail kế toán thứ hai với quyền chỉ sales chưa. Không yêu cầu gửi secret.
- Bước kế: đọc HANDOFF + matrix + docs/requirements/07_TASKS_LO_TRINH.md. Giải quyết Googlegate bằng browser đã kết nối/haiGmail và ACL, rồi G04safe sync và G03quantity ledger có migrationDEV được preview. Các rule chưa CONFIRMED giữ decisionrequired. Không chạy lại setup cho sửa HTML/readmodel.

Git còn một số tài liệu/generator thay đổi từ các lượt trước chưa được gom vào source checkpoint này; không reset hoặc hiểu nhầm tất cả working tree đã clean. Dist/output và .clasp bỏ qua Git theo cấu hình; không đẩy Git ra remote trong phiên.

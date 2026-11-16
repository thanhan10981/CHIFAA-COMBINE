# Khoảng trống theo bộ yêu cầu mới

Đối chiếu 78 REQ, baseline166 test local đạt, DEV21. Nguồn đầy đủ ở docs/requirements; matrix có tham chiếu theo từng REQ. Đọc các nhận xét audit cũ như lịch sử, không coi mô tả v14 là trạng thái mới nhất.

| Gap | Mức | Thực trạng và bước xử lý |
| --- | --- | --- |
| G01 | P0 / BLOCKED_GOOGLE | OAuth đã Code/PKCE/UserInfo, có mock Admin/kế toán/deny; chưa chạy hai Gmail thật, unknown/disabled/export/ACL. Không thể nghiệm thu auth bằng snapshot người dùng hoặc clasp. Không bypass auth/share workbook. |
| G02 | P0 / IMPLEMENTATION | D01/D02/D03 vừa được người dùng chốt. salesMetrics cũ còn trừ recoverySupport và otherCost vào net. Sửa shared model và báo cáo để chi phí riêng, cùng base net cho tỷ lệ, không trừ hai lần; regression cross-report. |
| G03 | P0 / MISSING | Giao→thu hồi có returnId→nhận kiosk→bán lại chưa có ledger/location/lifecycle. Dựng lượng trước, giữ policy tài chính/lô D16 riêng; test100/80/10/10 và nhận10 đúng một lần. |
| G04 | P0 / PARTIAL | scanSheets phát hiện hash nhưng chưa cách ly invalid rows đầy đủ; actor SHEET_EDITOR chưa ghi rõ chưa xác minh; onEdit quét toàn bộ, chưa onChange/cursor/quarantine/lag đo thật. Không coi raw #REF là nguồn đủ cho KPI. |
| G05 | P0 / BLOCKED_SOURCE | Hai workbook legacy chưa có trong source. Không import hoặc chốt số dư/catalog chính thức khi chưa backup read-only, mapping và đối chiếu. |
| G06 | P1 | Recipe lines còn JSON/ô; chưa bảng dòng chuẩn hóa/migration versioned/UOM/prices hiệu lực. Không tự ghi đè cột đang có. |
| G07 | P1 | Thiếu command NEW/BACKFILL/APPEND/CORRECT, draft riêng và modal diff; ledger hiện phải đảo/nhập mới, chưa acceptance100→130→90. |
| G08 | P1 | Phụ cấp default cộng theo ca; policy theo ngày/tháng chưa chốt. Giữ snapshot lương/bộ phận, không âm thầm sửa payroll lịch sử. |
| G09 | P1 | Targets/CEO/dashboard chưa đủ sellingDays/6KPI/6nhóm/chi phí%/alert center/amber config. Strategy có8khối nhưng không thay thế phần thiếu nguồn. |
| G10 | P1 | P&L chưa có phân bổ tồn thành phẩm/khấu hao được duyệt; latest-receipt-price chưa là chính sách kế toán chính thức; chi phí trả lại cần một nguồn chứng từ. |
| G11 | P1 / GOOGLE_PENDING | Portal/folder/trigger/restore có UI/code; chưa tài nguyên và run thực tế. Order approval tách nhu cầu, chưa merge kế hoạch có orderLineID. |
| G12 | P1 | Auth start chưa giới hạn flood độc lập; thiếu alert center/lastSeen; cần quota/concurrency10user và cache-eviction review. |
| G13 | P2 | UI mới chưa visual browser 375px/zoom/keyboard đủ màn; paging có nhưng list vẫn đọc bảng trước slice; bootstrap/scans chưa partition/cursor/materialized KPI và chưa P50/P95 Google. |
| G14 | P2 | Retention/restore đối chiếu nguồn và archive chưa chốt; chứng cứ Git/test từng task cần duy trì với matrix mới. |

Ưu tiên: T00 audit/matrix/checkpoint → T01 auth feasibility/read-only Google inventory (phần không truy cập được ghi blocker) → sửa G02 theo quyết định mới → G04/G03 và các phần không phụ thuộc policy. Không gọi production-ready; không chạy migration hoặc bật tài khoản khách trên dữ liệu nội bộ.

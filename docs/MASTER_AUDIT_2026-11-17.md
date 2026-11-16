# Master audit và lộ trình phiên dài

Yêu cầu đầy đủ lưu MASTER_REQUEST_2026-11-17.md. Inventory/hashes/headings output/master-repository-inventory.json; repository có thay đổi tài liệu/generator sẵn, không reset/gộp ngoài task. Baseline224→273tests. DEV32 đã xác minh5file và hai deployment; các số cũ là lịch sử. Bàn giao chi tiết: MASTER_RESULT_2026-11-17.md.

| Task | Ưu tiên/phụ thuộc | Phạm vi tự động hóa | Trạng thái |
| --- | --- | --- | --- |
| M00 | P0 | Audit/version, baseline,7file bàn giao, quyết định | Đã lập; cập nhật liên tục |
| M01 | P0/M00 | OAuth flood guard, bỏ lock khi gọi Google, session lastSeen/nhãn thiết bị/cảnh báo/ack UI | Local pass 228 tests; Google UAT chờ |
| M02 | P0/M01 | Thu hồi có ID→duyệt→kiosk nhận đúng1lần; bán không cộng doanh thu trước bán | Local pass 233 tests; D16 giá trị/lô/hạn chờ |
| M03 | P1/M02 | Nhập mới/bù/bổ sung/điều chỉnh, preview/diff/conflict và audit | Local pass 237 tests; sửa phạm vi một phiếu |
| M04 | P1 | Năng suất tổng vs đạt, KPI ngày/tháng, targets chưa chốt tách cấu hình | Shared KPI + hao hụt pass 240 tests; ngưỡng/UAT chờ |
| M05 | P1 | Source issue workbench, backup verify/restore inspection | Local pass 243 tests; Drive restore drill chờ |
| M06 | P1 | Portal lifecycle/order-plan links và an toàn privacy | Liên kết tường minh local247 pass; Portal Google/D22 chờ |
| M07 | P1 | Schema/migration/UOM/prices/recipe-line gaps khả thi, không chốt policy tài chính | Local250 pass: đơn vị chuẩn/schema diff; migration giá/UOM chờ nguồn và policy |
| M08 | P0 gate | Integration/E2E fixture, matrix,build/deploy readback; UAT thực tế | Local273 pass/syntax83/build; DEV32 readback khớp; Google/visual/ACL/UAT chờ |
| M09 | P0 correctness/performance | Không suy giá vốn/lợi nhuận thiếu nguồn thành0; batch cấu hình tĩnh, poll60s/focus | Local273 pass; Properties calls31→5/59→12/64→9 trong mock; Google quota/latency chờ |

Không tuyên bố toàn dự án hoàn tất từ mock. Mỗi task có code/tests/docs/commit; phần policy/Google chưa có được ghi DECISIONS_REQUIRED, tiếp tục việc độc lập.

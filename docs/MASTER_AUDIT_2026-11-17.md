# Master audit và lộ trình phiên dài

Yêu cầu đầy đủ lưu MASTER_REQUEST_2026-11-17.md. Inventory/hashes/headings output/master-repository-inventory.json; repository có thay đổi tài liệu/generator sẵn, không reset/gộp ngoài task. Baseline224tests. DEV28 latest verified; các báo cáo cũ DEV21/166test là lịch sử.

| Task | Ưu tiên/phụ thuộc | Phạm vi tự động hóa | Trạng thái |
| --- | --- | --- | --- |
| M00 | P0 | Audit/version, baseline,7file bàn giao, quyết định | Đã lập; cập nhật liên tục |
| M01 | P0/M00 | OAuth flood guard, bỏ lock khi gọi Google, session lastSeen/nhãn thiết bị/cảnh báo/ack UI | Đang làm |
| M02 | P0/M01 | Thu hồi có ID→duyệt→kiosk nhận đúng1lần; bán không cộng doanh thu trước bán | Chưa làm; D16 valuation chờ |
| M03 | P1/M02 | Nhập mới/bù/bổ sung/điều chỉnh, preview/diff/conflict và audit | Chưa làm |
| M04 | P1 | Năng suất tổng vs đạt, KPI ngày/tháng, targets chưa chốt tách cấu hình | Chưa làm |
| M05 | P1 | Source issue workbench, backup verify/restore inspection | Chưa làm |
| M06 | P1 | Portal lifecycle/order-plan links và an toàn privacy | Chưa làm; tài nguyên Google chờ |
| M07 | P1 | Schema/migration/UOM/prices/recipe-line gaps khả thi, không chốt policy tài chính | Chưa làm |
| M08 | P0 gate | Integration/E2E fixture, matrix,build/deploy readback; UAT thực tế | Local tiếp tục; Google chờ |

Không tuyên bố toàn dự án hoàn tất từ mock. Mỗi task có code/tests/docs/commit; phần policy/Google chưa có được ghi DECISIONS_REQUIRED, tiếp tục việc độc lập.

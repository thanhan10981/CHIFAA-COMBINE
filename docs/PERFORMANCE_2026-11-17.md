# Tối ưu hiệu năng — 2026-11-17

Phạm vi: Apps Script + Sheets, dưới 10 người dùng. Giữ giao diện/nghiệp vụ, RBAC backend, lịch sử, journal, idempotency, optimistic concurrency và thiếu dữ liệu ≠ 0. Chưa đo Google thật; các số dưới đây là Node/GAS mock và fixture tổng hợp, không gồm mạng/khóa/quota/OAuth thật.

## Các task

| Task | Nội dung | Trạng thái |
| --- | --- | --- |
| PERF01 | Đếm dịch vụ + benchmark 100/1.000/5.000 dòng mỗi bảng lớn | LOCAL_TESTED |
| PERF02 | Đọc theo phụ thuộc, cache trong request, ghi/audit theo lô | LOCAL_TESTED190 |
| PERF03 | Shell bootstrap, cache trang theo quyền/version, dữ liệu Dashboard riêng | Đang làm |
| PERF04 | onEdit theo bảng, sync hash chỉ ghi thay đổi, kiểm tra cấu trúc | Tiếp theo |
| PERF05 | Cache RAM khi đổi tab, dedupe, lazy/prefetch và trạng thái lưu | Tiếp theo |
| PERF06 | So sánh benchmark, trình duyệt/Google/concurrent users, rollout | Chưa nghiệm thu Google |

## Bottleneck đã xác nhận

- mutate_ gọi data_ cho cả 17 bảng, kể cả tạo một vật tư; writeRow_ lại đọc bảng để tìm ID.
- bootstrap gửi tối đa 200 dòng của từng bảng, nhưng vẫn đọc/kiểm tra toàn bộ. Payload lớn vượt cache100KB nên cache nóng không hiệu quả.
- list phân trang phản hồi nhưng vẫn đọc bảng trước slice; mỗi lần quay lại tab lại gọi server.
- scan đọc17 bảng hai lượt, mở workbook lặp ngoài RPC; tìm hash bằng find/some trong vòng lặp và viết lại toàn _Sync.
- Transaction ghi từng effect/audit; dữ liệu lớn/journal chunk làm số calls tăng theo số dòng.
- Dashboard chuyển lịch sử sang client để tính; Strategy dựng lại nhiều chuỗi tháng. Excel runtime hiện thêm948KB HTML nhưng chưa thực thi lúc login.

## PERF01/02 — Đo local trước/sau

Fixture lớn có25.004 dòng nghiệp vụ (5 bảng ×5.000 +4 dòng master). Một lần chạy mỗi kích thước: chỉ dùng để tìm bottleneck, chưa phải P50/P95.

| Thao tác, 5.000 dòng/bảng | Trước | Sau PERF02 |
| --- | ---: | ---: |
| Tạo vật tư: getValues | 59 | 11 |
| Tạo vật tư: cellsRead | 470.345 | 65.052 |
| Tạo vật tư: số bảng nghiệp vụ được chọn | 17 | 1 |
| Tạo vật tư: thời gian mock | 362,79 ms | 54,93 ms |
| Tạo vật tư: append + setValues | 6 | 5 |
| Phát hiện sửa trực tiếp: getValues | 95 | 95 (chưa tối ưu bước này) |

Batch test25 effect cùng bảng:3 setValues cho dữ liệu/audit/kết quả journal; giữ PREPARED/flush/rollback/idempotency. Reversal còn đọc đủ bảng vì linked effects động; xóa master đọc thêm những bảng tham chiếu. Không cache quyền, phiên hoặc nonce trong cache đọc request.

RPC log rpc_profile chỉ action, tên bước/module, số lần và ms, không ID/email/token/nội dung dòng. Log hữu ích để thu P50/P95 thực tế sau rollout. READ không xuất snapshot đang WRITE_IN_PROGRESS hoặc version đổi; recovery chủ sở hữu xóa cờ sau khi rollback journal. Không đánh dấu lưu trước APPLIED.

Benchmark: `node scripts/benchmark-performance.mjs before|stage2|after`. Log/JSON dưới output/performance-*. Các file output không đưa dữ liệu Google thật vào Git. Nguồn script/fixture được commit để chạy lại. 190 tests pass tại PERF02; syntax/build sẽ kiểm tra tại checkpoint cuối.

## Giới hạn và nghiệm thu còn lại

Chưa đo tải trang/auth/first Dashboard trên Apps Script, độ trễ trigger, P50/P95 Google, Chrome máy người dùng hoặc 8 phiên Google đồng thời. Không dùng Promise trên mock đồng bộ để giả lập kết quả concurrency. Mục tiêu route RAM dưới200ms cần benchmark browser; chỉ báo đạt khi có đo. Không tạo dữ liệu giả trên workbook DEV/Production để benchmark.

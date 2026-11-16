# Tối ưu hiệu năng — 2026-11-17

Phạm vi: Apps Script + Sheets, dưới 10 người dùng. Giữ giao diện/nghiệp vụ, RBAC backend, lịch sử, journal, idempotency, optimistic concurrency và thiếu dữ liệu ≠ 0. Chưa đo Google thật; các số dưới đây là Node/GAS mock và fixture tổng hợp, không gồm mạng/khóa/quota/OAuth thật.

## Các task

| Task | Nội dung | Trạng thái |
| --- | --- | --- |
| PERF01 | Đếm dịch vụ + benchmark 100/1.000/5.000 dòng mỗi bảng lớn | LOCAL_TESTED |
| PERF02 | Đọc theo phụ thuộc, cache trong request, ghi/audit theo lô | LOCAL_TESTED190 |
| PERF03 | Shell bootstrap, cache trang theo quyền/version, dữ liệu Dashboard riêng | LOCAL_TESTED206 |
| PERF04 | onEdit theo dòng/bảng, sync hash chỉ ghi thay đổi, kiểm tra cấu trúc | LOCAL_TESTED206 |
| PERF05 | Cache RAM khi đổi tab, dedupe, lazy/prefetch và trạng thái lưu | LOCAL_TESTED206; đang bổ sung benchmark |
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

## PERF03–05 checkpoint

- Bootstrap shell chỉ quyền/user/version, không đọc bảng nghiệp vụ. Cache dữ liệu chỉ sau auth + chữ ký + nonce và đọc mới _Users/_Sessions; key chứa quyền/role/email/version. Backend cache trang/aggregate20giây, optional100KB, fallback khi mất cache; force bỏ qua cache.
- Dashboard và Strategy trả mô hình tổng hợp riêng từ shared domain/strategy, giữ công thức; đối soát100dòng/trang có tổng/trang tiếp. Tải snapshot/export theo cửa sổ vật lý tối đa200dòng, không đọc lại toàn bảng trên mỗi trang. Cursor vật lý giữ cả dòng xóa/đảo và bỏ dòng trắng; report dùng effective trước lọc kỳ.
- Client giữ dữ liệu/bảng trang đã được cấp quyền trong RAM, dùng module version để giữ bảng không đổi, xóa cache khi đổi quyền/đăng xuất. Cache20giây, sync ký15giây khi visible/không bận; prefetch tối đa một danh mục công khai nội bộ sau idle. Dedupe chỉ read, không gộp mutation. Strategy quay lại dùng nguyên DOM biểu đồ trong cache còn hạn; skeleton khi chưa có dữ liệu.
- Trạng thái lưu pending chỉ ở UI; không thay số dư/lương/doanh thu trước ACK. Gửi lại giữ snapshot/key khi timeout; khi ACK rồi mà refresh lỗi, báo đã lưu/chưa đồng bộ, không báo lưu thất bại. Row pending được bỏ khi bị từ chối.
- onEdit nhỏ chỉ đọc dòng business bị sửa (tối đa200dòng), không đọc17 bảng, không ghi lại toàn _Sync. Metadata/header/bulk edit fallback đọc bảng liên quan. Hash/tombstone/audit ghi theo nhóm liên tiếp; nguyên ô nguồn được giữ. Scan đầy đủ thủ công vẫn có; scanSlice tối đa4bảng/lượt, onChange invalidates version/audit. Partial validation đánh dấu partial, không coi là đã kiểm tra mọi tham chiếu; báo cáo/ghi vẫn kiểm tra nguồn đầy đủ.
- InstallTriggers cài onEdit/onChange/scanSlice mỗi1phút, bỏ lịch scanSheets cũ. **Chưa cài lại trigger trên Google**; cần Admin bấm Cài lịch sau rollout. Trigger cũ còn chạy hàm fullscan cho tới lúc cài lại; không tuyên bố lag5phút đã đo.
- UI giữ logo gốc, chỉ dùng một payload chung thay3bản. Excel runtime chuyển sang ExcelRuntime.html, tải qua publicAsset allowlist, CacheStorage chỉ mã công khai, SHA256 kiểm tra trước chạy; cache lỗi/tắt thì tải lại. Không lưu nghiệp vụ vào CacheStorage. Index từ3.575.997 xuống~1.024.036 bytes chưa nén; không đổi giao diện. Deploy giờ gồm **5 file**, thêm ExcelRuntime.html; không setup lại schema.

Stage4 mock5000: shell~3KB/3getValues auth-only; summary~20KB thay vì rawhistory, cache nóng3getValues auth-only; direct-edit95→8getValues,200.055→19cellsWritten trước fast-row path. Log output/performance-stage4.json. Con số cuối sẽ cập nhật sau benchmark lặp. Trình duyệt inventory vừa kiểm tra lại: apps:[], browsers:[]; không dùng công cụ khác để vượt đường điều khiển UI.

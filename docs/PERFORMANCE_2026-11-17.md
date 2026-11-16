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

## Kết quả cuối local — PERF06

210/210 tests đạt; syntax58/build đạt. Kiểm tra thêm cú pháp bundle client/server/Excel, SHA256 của runtime, Excel offline preview và byte logo gốc đều đạt. Không thay số liệu nghiệp vụ để tăng tốc. Các nhóm PERF01–05 đã LOCAL_TESTED; PERF06 còn nghiệm thu Google/browser/concurrency.

`node scripts/benchmark-performance.mjs after` tạo fixture100/1.000/5.000 dòng trên mỗi bảng lớn. Kết quả cuối với25.004 dòng, một lượt mỗi cỡ; đây là thời gian CPU mock, **không phải server Google hoặc P50/P95 trước/sau**:

| Thao tác | Trước: getValues / ms | Sau: getValues / ms | Chi tiết |
| --- | ---: | ---: | --- |
| Tạo vật tư | 59 / 362,79 | 11 / 53,86 | Cells đọc470.345→65.052; append+setValues6→5; mở workbook1→1 |
| Trang vật tư lặp | 9 / 52,64 | 3 / 0,33 | 3 lượt đọc mới là xác thực/quyền/nonce; không bỏ backend auth |
| Scan đầy đủ không đổi | 94 / 1.502,55 | 47 / 589,69 | Mở workbook36→1; vẫn là đối soát toàn bộ có chủ đích |
| Một ô sửa trực tiếp | 95 / 5.140,74 | 3 / 21,30 | Cells đọc910.588→100.046; ghi200.055→19; mở39→2 gồm1 lượt mở do harness |
| Startup | 51 / 1.247,20 | 3 / 0,27 | So sánh full bootstrap cũ với shell mới: payload350.726→3.032 bytes, dữ liệu tải riêng |
| Dashboard aggregate lạnh / nóng | Chưa có API riêng | 42 / 559,09; 3 / 0,43 | Payload19.883 bytes; cache nóng vẫn xác thực |

Index3.575.997→1.031.063 bytes chưa nén (~71% giảm). ExcelRuntime948.793 bytes chỉ tải khi dùng Excel; logo gốc dùng chung một payload. Không nén/đổi logo hoặc thêm CDN.

`node scripts/benchmark-client-performance.mjs`:40 lượt chuyển mỗi loại/cỡ, Node+LinkeDOM, **không có layout/paint/network**. Với5.000 dòng: bảng cache P50=10,34ms/P95=22,78ms/max=221,43ms; Strategy dùng lại DOM P50=2,00ms/P95=2,38ms. Có outlier trên200ms; chưa xác nhận mục tiêu200ms trên máy tính/trình duyệt thật. Test8 tài khoản/24 yêu cầu xác minh cách ly quyền và nonce; không thay thế tải8 người Google đồng thời. File bằng chứng local: output/performance-before.json, performance-after.json, performance-client.json, performance-stage6-tests.txt.

## Đo trên DEV và triển khai

1. Build/test rồi cập nhật **5 file**: Code.gs, Index.html, Portal.html, appsscript.json và **ExcelRuntime.html**. Nếu dán thủ công phải tạo HTML tên ExcelRuntime, không sửa Client Secret. Không chạy setup lại hoặc ghi đè workbook.
2. Cập nhật phiên bản cho cả Web App DEV và callback DEV hiện có; giữ nguyên URL/redirect và deployment cũ riêng@2. Đọc lại đúng version để đối chiếu nguồn trước khi gán deployment.
3. Admin → Nhật ký & đồng bộ → **Cài lịch scan, backup và Portal**, một lần sau nâng cấp. Mã mới thay timer full scan bằng slice4bảng/mỗi1phút, thêm onChange và giữ backup/Portal. Trong phiên này chưa có trình duyệt Google kết nối nên **chưa cài lại trigger**. Trigger cũ sẽ còn full scan cho đến khi cài lại.
4. Mở DEV bằng Admin và kế toán riêng, không cấp quyền Editor workbook. Kiểm tra F5/restore, tải Dashboard, mở phân hệ lạnh/nóng, tạo/sửa/đảo phiếu, timeout rồi gửi lại cùng phiếu, đổi quyền/thu hồi phiên, sửa ô trực tiếp Sheets và đợi app cập nhật. Kiểm tra ngân hàng/tiền mặt/doanh thu/công nợ/lương trước/sau.
5. Trong DevTools đọc `CHIFAA_PERFORMANCE` (100 bản ghi RAM gần nhất, tên thao tác/ms/status, không token/dòng dữ liệu). Ghép log Apps Script `rpc_profile` và `scan_profile` để phân biệt auth/read/report/ghi. Đo ít nhất30 lượt mỗi thao tác, báo P50/P95, thiết bị/mạng/kích thước workbook. Đo startup/OAuth riêng bằng Performance panel. Mở2/5/8 phiên được cấp quyền để đo lock wait/lưu/xung đột; không nhân bản dữ liệu khách thật. Chỉ chốt mục tiêu server sau số đo này.

## Rủi ro còn lại

- Cache là tối ưu tùy chọn; mọi API protected vẫn kiểm tra phiên/chữ ký/nonce/quyền mới. Đổi quyền trực tiếp phát hiện ở sync hoặc request tiếp; dữ liệu đã xem trong RAM chỉ xóa khi client nhận thay đổi/đăng xuất. Không thể thu hồi kiến thức hoặc bản chụp đã tải xuống.
- Báo cáo lạnh vẫn cần lịch sử nguồn hợp lệ; tìm kiếm/lọc/sắp xếp bảng còn đọc toàn bảng được chọn. Snapshot/export dùng cửa sổ vật lý; không cam kết mọi truy vấn đều O(page). Reversal đọc nhiều module để bảo toàn linked effects.
- _Sync vẫn đọc chỉ mục hash chung; _Users/_Sessions/nonce/journal có thể tăng theo thời gian. Full scan, khóa script và aggregate lạnh còn có thể tranh chấp dưới tải; cần số đo Google trước khi đổi cấu trúc lưu trữ.
- onEdit/onChange cần trigger đúng workbook. Sửa qua API hoặc công thức không luôn có onEdit; slice/full manual reconciliation là đường dự phòng. Không cam kết độ trễ phát hiện khi chưa đo trigger/quota thực tế. Trong scan từng phần chỉ kiểm tra nguồn phạm vi; backend ghi/báo cáo vẫn kiểm tra đầy đủ.
- CacheStorage chỉ lưu mã Excel công khai, không dữ liệu nghiệp vụ. Trình duyệt không hỗ trợ/chặn cache thì tải runtime lại; HTML Apps Script vẫn cần mạng, chưa có offline app shell/service worker.
- Chưa nghiệm thu OAuth, download Excel, giao diện, thời gian Google hoặc nhiều người dùng đồng thời vì inventory CUA không có app/browser. Không đánh dấu toàn bộ task đạt chỉ dựa trên mock.

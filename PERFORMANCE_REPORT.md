# Báo cáo hiệu năng hiện tại

## Bản hiện tại DEV30 —260kiểm thử local

Đã xác minh mã trên hai deployment, chưa đo latency Google. Bỏ tra cứu lồng nhật ký, thêm cache theo quyền/phiên bản cho ki-ốt/liên kết đơn; các ghi luôn đọc lại nguồn. Dashboard trả tổng bộ phận, không gửi toàn bộ lương nhân viên. Kiểm tra backup/Google HTTP không giữ khóa ghi toàn cục trong lúc chờ dịch vụ.

Benchmark hiện tại dùng fixture nhân viên riêng biệt, hợp lệ về giao ca. Các số cũ dùng fixture lặp ca chỉ là lịch sử hiệu năng, không là bằng chứng nghiệp vụ lương và không so sánh trực tiếp với fixture mới. Số liệu cập nhật được ghi ở cuối file; nguồn `output/master-benchmark-final.json`, `output/data-loading-master-final.json`, `output/performance-client.json`.

Chuyển tab nóng trong LinkeDOM có p95 dưới200ms nhưng vẫn có một outlier241,29ms. Đây không đo layout/paint/browser/mạng/Google; mục tiêu dưới200ms trên máy thông thường chưa được nghiệm thu. Cold read còn đọc đủ nguồn cần thiết; sửa Sheets được phát hiện theo trigger/lát quét đã thiết kế, lịch và độ trễ thực tế chưa xác minh.

## Lịch sử các checkpoint trước

DEV28, baseline224tests. Chi tiết trước/sau từng API, số ô/lượt đọc, fixture100/1.000/5.000 và giới hạn: [đợt1](docs/PERFORMANCE_2026-11-17.md), [đợt2](docs/DATA_LOADING_2026-11-17.md).

Đã có shell/lazy lookup, index/version, scoped chunk cache, snapshot, read queue, DOM reuse và profiler. Mock tuần tiếp110.085→855ô; Dashboard read-cache miss còn snapshot405.241→205ô/41→5getValues. Cold summary vẫn cần đủ lịch sử giá vốn/reversal. Browser200ms có outlierlocal, chưa nghiệm thu Google.

Master session tiếp tục audit khóa OAuth lúc network, snapshot invalidation, lịch scan và bài đo thật khi có browser; không ghi đè bằng số giả hoặc cam kết SLA.


## MASTER M08 integration checkpoint - 2026-11-17

258/258 local tests;syntax80/build pass. Indexed return/order/production marker joins remove quadratic scans; new scoped20second report caches retain fresh auth, version/stamp guards, force refresh and read queue. Reproducible benchmark scripts/benchmark-master.mjs100/1000/5000:5000cold kiosk3069.21->374.87ms (28reads/275085cells unchanged),orderPlans3164.73->442.69ms (33reads/310075cells unchanged apart from nonce3cells); hot3authreads15/21cells. Node/mock single runs, NOT Google latency. Backup now short claim/final locks, Drive/hash reads outside global lock, core consistency + app-stamp verification; failed creation consistency cannot later be promoted merely by checksum equality. Quantity precision preserves .001kg stock/count adjustments, variance excludes stocktake adjustments from physical incoming. Direct Sheets duplicate allowance and overlapping overnight shifts now block payroll; fixed old benchmark employee fixture to avoid duplicate overlapping shifts (historical performance fixtures not directly comparable). Server app-session signing credentials now also owner-only Script Properties with TTL/fingerprint, bounded80index, cleanup on revoke/disable/recovery; cache eviction no longer forces re-login and signatures/durable nonce replay checks remain. Google tokens/Client Secret never copied to UI or business sheets; Script Properties credentials are NOT included in workbook backups. CUA rechecked apps:[],browsers:[]; real Google/ACL/concurrent/visual UAT blocked. Live DEV28 until verified new rollout.


## MASTER final Dashboard payload follow-up - 2026-11-17

Removed unused employee-level payroll array from Dashboard RPC; now at most three department aggregates, while payroll details stay behind paged payroll API. Backend shared report/targets/strategy calculations unchanged. Bumped read-model version.260/260tests,syntax80/build pass. Final valid distinct-employee fixtures output/data-loading-master-final.json:5000cold Dashboard42reads405246cells/8877bytes; durable snapshot5reads205cells/8879bytes. Cold payroll18reads150255cells/10875bytes,hot3reads84cells. Single Node/mock run, not Google SLA; old overlapping-worker benchmark fixture is historical and not a valid payroll-comparison baseline. Intermediate DEV29 deployed/readback verified; final small code change pending versioned rollout.


## Final measured local fixture results - DEV30

Node/GAS mock only. One run per size/API; these are not Google P50/P95 or a concurrency test. Cold workflow source reads remain complete; hot caches still recheck identity, signature, nonce and grants.

| Rows | API | Before CPU ms | Final cold CPU ms | Cold getValues before/final | Final hot CPU ms | Hot getValues / cells |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | kioskReport | 14.31 | 15.15 | 10/10 | 0.97 | 3 / 15 |
| 100 | orderPlans | 12.66 | 11.47 | 11/11 | 0.72 | 3 / 21 |
| 1000 | kioskReport | 190.33 | 83.5 | 12/12 | 0.79 | 3 / 15 |
| 1000 | orderPlans | 208.65 | 84.83 | 13/13 | 0.64 | 3 / 21 |
| 5000 | kioskReport | 3069.21 | 363.98 | 28/28 | 0.78 | 3 / 15 |
| 5000 | orderPlans | 3164.73 | 384.89 | 33/33 | 0.71 | 3 / 21 |

| Rows | Scenario | CPU ms | getValues | Cells read | Response bytes |
| --- | --- | --- | --- | --- | --- |
| 100 | dashboard:cold | 20.44 | 22 | 8346 | 3706 |
| 100 | dashboard:cache-evicted | 0.67 | 5 | 205 | 3708 |
| 100 | payroll:summary-cold | 5.77 | 10 | 3255 | 2299 |
| 100 | payroll:summary-hot | 0.43 | 3 | 84 | 2299 |
| 1000 | dashboard:cold | 120.97 | 22 | 81246 | 3707 |
| 1000 | dashboard:cache-evicted | 0.56 | 5 | 205 | 3709 |
| 1000 | payroll:summary-cold | 50.27 | 10 | 30255 | 2299 |
| 1000 | payroll:summary-hot | 0.46 | 3 | 84 | 2299 |
| 5000 | dashboard:cold | 550.74 | 42 | 405246 | 8877 |
| 5000 | dashboard:cache-evicted | 0.59 | 5 | 205 | 8879 |
| 5000 | payroll:summary-cold | 200.24 | 18 | 150255 | 10875 |
| 5000 | payroll:summary-hot | 0.69 | 3 | 84 | 10875 |

| Rows | Warm module CPU p50 / p95 / max ms | Reused Strategy DOM p95 ms | Samples |
| --- | --- | --- | --- |
| 100 | 10.52 / 18.18 / 33.13 | 2.61 | 40 |
| 1000 | 9.99 / 19.52 / 40.97 | 2.26 | 40 |
| 5000 | 10.19 / 11.52 / 241.29 | 2.6 | 40 |

No browser layout/paint, actual network, Google service load, multi-account ACL or real edit-detection latency was measured. Native backups now perform three known-table manifest passes outside the global lock, capped2.5million cells/pass; larger datasets need separate batched verification. Core source change or an app transaction during the backup marks it unverified. Configurable OAuth budget and durable app-session keys consume Properties quotas: real owner-account quota monitoring remains necessary.


## MASTER M09 checkpoint - 2026-11-17

273/273 local tests; syntax83/build pass. Financial completeness guards, request-local static configuration batching, visible-page sync60s/focus refresh and backup verification feedback. See docs/MASTER_M09_2026-11-17.md. Candidate built; verified DEV31 remains live until final source readback and rollout.

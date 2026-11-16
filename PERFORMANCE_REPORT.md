# Báo cáo hiệu năng hiện tại

DEV28, baseline224tests. Chi tiết trước/sau từng API, số ô/lượt đọc, fixture100/1.000/5.000 và giới hạn: [đợt1](docs/PERFORMANCE_2026-11-17.md), [đợt2](docs/DATA_LOADING_2026-11-17.md).

Đã có shell/lazy lookup, index/version, scoped chunk cache, snapshot, read queue, DOM reuse và profiler. Mock tuần tiếp110.085→855ô; Dashboard read-cache miss còn snapshot405.241→205ô/41→5getValues. Cold summary vẫn cần đủ lịch sử giá vốn/reversal. Browser200ms có outlierlocal, chưa nghiệm thu Google.

Master session tiếp tục audit khóa OAuth lúc network, snapshot invalidation, lịch scan và bài đo thật khi có browser; không ghi đè bằng số giả hoặc cam kết SLA.


## MASTER M08 integration checkpoint - 2026-11-17

258/258 local tests;syntax80/build pass. Indexed return/order/production marker joins remove quadratic scans; new scoped20second report caches retain fresh auth, version/stamp guards, force refresh and read queue. Reproducible benchmark scripts/benchmark-master.mjs100/1000/5000:5000cold kiosk3069.21->374.87ms (28reads/275085cells unchanged),orderPlans3164.73->442.69ms (33reads/310075cells unchanged apart from nonce3cells); hot3authreads15/21cells. Node/mock single runs, NOT Google latency. Backup now short claim/final locks, Drive/hash reads outside global lock, core consistency + app-stamp verification; failed creation consistency cannot later be promoted merely by checksum equality. Quantity precision preserves .001kg stock/count adjustments, variance excludes stocktake adjustments from physical incoming. Direct Sheets duplicate allowance and overlapping overnight shifts now block payroll; fixed old benchmark employee fixture to avoid duplicate overlapping shifts (historical performance fixtures not directly comparable). Server app-session signing credentials now also owner-only Script Properties with TTL/fingerprint, bounded80index, cleanup on revoke/disable/recovery; cache eviction no longer forces re-login and signatures/durable nonce replay checks remain. Google tokens/Client Secret never copied to UI or business sheets; Script Properties credentials are NOT included in workbook backups. CUA rechecked apps:[],browsers:[]; real Google/ACL/concurrent/visual UAT blocked. Live DEV28 until verified new rollout.

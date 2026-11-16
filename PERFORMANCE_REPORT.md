# Báo cáo hiệu năng hiện tại

DEV28, baseline224tests. Chi tiết trước/sau từng API, số ô/lượt đọc, fixture100/1.000/5.000 và giới hạn: [đợt1](docs/PERFORMANCE_2026-11-17.md), [đợt2](docs/DATA_LOADING_2026-11-17.md).

Đã có shell/lazy lookup, index/version, scoped chunk cache, snapshot, read queue, DOM reuse và profiler. Mock tuần tiếp110.085→855ô; Dashboard read-cache miss còn snapshot405.241→205ô/41→5getValues. Cold summary vẫn cần đủ lịch sử giá vốn/reversal. Browser200ms có outlierlocal, chưa nghiệm thu Google.

Master session tiếp tục audit khóa OAuth lúc network, snapshot invalidation, lịch scan và bài đo thật khi có browser; không ghi đè bằng số giả hoặc cam kết SLA.

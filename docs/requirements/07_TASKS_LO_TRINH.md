# 07 — LỘ TRÌNH CODEx THEO TASK CÓ CHECKPOINT

**Trạng thái:** `[ ]` Chưa bắt đầu, `[~]` Đang làm, `[x]` Đã qua test/nghiệm thu, `[!]` BLOCKED và phải ghi lý do. Không chỉ cập nhật checkbox, phải kèm commit/test/report.

| Task | Phụ thuộc | Công việc/Deliverables | Điều kiện nghiệm thu |
|---|---|---|---|
| T00 | — | Audit repo/HTML V17/GAS/2 workbook; tạo `REQUIREMENT_MATRIX.md` với toàn bộ REQ và gap map | Mọi menu/function mapped DONE/PARTIAL/MISSING/BLOCKED, baseline test |
| T01 | T00 | **Auth feasibility spike** Apps Script-only: 401 invalid_client/no origin, 2 Gmail, session/RBAC, domain/origin, deploy | Phải thật sự login và thử unauthorized hoặc BLOCKED rõ; không dùng fake auth |
| T02 | T00 | Repo architecture, eslint/types/scripts, clasp, build HtmlService, manifest, env validation | `npm ci`, typecheck/lint/test/build chạy được; secrets gitignored |
| T03 | T00,T02 | UI SPA modularize V17, sidebar fix, logo gốc, route/button inventory, no old localStorage production | 100% route thao tác có trạng thái thật hoặc “chưa hoàn tất” |
| T04 | T00,T01 | Quyết định auth, roles, User/session schema, admin one-session/cảnh báo | 2 Gmail POC, denied role, revoke session; no sensitive data leak |
| T05 | T02 | Schema metadata/master/ledger normalized, dữ liệu VN timezone/UOM, migration versioned, protection | Setup idempotent; không xóa source; schema tests |
| T06 | T05 | Repository read/write batch, lock, optimistic version, idempotency key, `_Audit`/`_Requests`, recoverable transactions | Retry/no duplicate; stale version conflict; recovery test |
| T07 | T05,T06 | 2-way Sheets editing, onEdit/onChange/reconcile, invalid row quarantine, revision sync | App edit→Sheet, Sheet edit→App, API update detected |
| T08 | T05,T07 | Danh mục vật tư/món/điểm/NV/discount/uom/price history, editor và search | CRUD hai chiều các vùng được phép; snapshots historical |
| T09 | T08 | Công thức nhiều cấp, recipe lines normalized, quantity/cost/gram↔kg, missing unit/price, snapshot | 100 phần=4,56kg gạo ví dụ, detect cycle/missing |
| T10 | T09 | Kế hoạch sản xuất ngày mai, các nguồn đơn/manual, nở nhu cầu nguyên liệu, báo thiếu | Không cộng đơn vào plan hai lần, planned vs actual tách |
| T11 | T08,T10 | Production main/extra/error/discard, day flows, chốt/đảo | SX thêm, lỗi, audit, tỷ lệ đúng |
| T12 | T09,T11 | Kho ledger, nhập/xuất/kiểm kê, cảnh báo min, variance theo tuần/tháng/quý | 4,5 can→5 can chênh +11,11%, no double count |
| T13 | T08,T11 | Giao hàng điểm bán, hàng bán/còn/tự chịu, phê duyệt thu hồi, kiosk received/sold | 100/80/10/10, kiosk+10 exactly once |
| T14 | T08,T13 | Chiết khấu theo điểm/món, doanh thu, tiền mặt+bank, hỗ trợ thu hồi, đối soát | Các quyết định P0 được chốt hoặc provisional; no double posting |
| T15 | T06,T10,T14 | Nhập mới/nhập bù/bổ sung/sửa/duyệt/chốt, audit cross-forms | 100→130→90 và history 3 lần |
| T16 | T08,T15 | Attendance night shifts 3 groups, rate/allowance snapshots, payroll, wage advances | 23→09=10h, 180k test, payroll per group |
| T17 | T14,T16 | Công nợ/vay/sổ quỹ/chi phí/mkt/fixed/asset depreciation; source ledger | Cash and AR do not double count; accounting rules labeled |
| T18 | T10,T12,T14,T16,T17 | Kế hoạch/mục tiêu và ngưỡng, ngân sách thưởng 15%, alert engine | No false green on missing, bonus only when data complete |
| T19 | T18 | Dashboard vận hành ngày/tuần/tháng, 6 nhóm, so cùng thứ, năng suất SX | 6 KPIs and exact sources, consistent period filters |
| T20 | T18,T19 | Tổng quan điều hành KPI/cảnh báo mua hàng/chi phí/gợi ý thưởng | Drill-down, unknown statuses, labor cap |
| T21 | T17,T19 | Chiến lược 8 biểu đồ, scenario, 12-month P&L, break-even | Dữ liệu demo isolated, chart change filters correct |
| T22 | T04,T08,T10 | Customer order portal riêng, danh mục publish, login/mời, spam, approval | Khách không truy cập internal, approved order once |
| T23 | T03,T07,T18 | Performance SPA/cache/preload/skeleton/reduced-motion/responsive | Bench P50/P95 cold/warm, no preload finance before login |
| T24 | T05,T07,T21 | Mapping/migration 2 workbook legacy, QA regression, backup/restore, dashboard source provenance | Source untouched, totals reconciled, report missing #REF |
| T25 | T01–T24 | End-to-end auth/live deployment DEV→staging→prod, documentation and release checklist | Owner authorizes explicitly, smoke passes, rollback plan |

## Sau mỗi task

1. Chạy tests/lint/build cho phạm vi tác động, regression ít nhất một luồng chéo (ví dụ returns ảnh hưởng sales+kiosk+warehouse+CEO).
2. Cập nhật `REQUIREMENT_MATRIX.md`: REQ nào đã test và bằng chứng, chưa làm/blocked.
3. Cập nhật `TASKS.md` và `HANDOFF.md` (mẫu ở AGENTS): task, source changed, commands, tested/untested, config cần user, blockers/decisions, next action.
4. Git commit source docs/fixtures (không credentials/PII). Ghi commit SHA.
5. Nếu token hết giữa task: dừng tại trạng thái có thể khôi phục, không commit mã lỗi là DONE; ghi checkpoint rồi mới kết thúc.

## Các cổng phê duyệt

- **Gate 1 (T01):** Auth chưa test thật thì tuyệt đối không cho tài khoản bên ngoài mở dữ liệu nội bộ.
- **Gate 2 (T14/T17):** Quy tắc doanh thu/hỗ trợ/công nợ P0 chưa chốt thì báo cáo tiền/thuế ở chế độ provisional.
- **Gate 3 (T24/T25):** Không migrate file cũ vào PROD khi chưa có backup, preview, đối chiếu, owner xác nhận.
- **Gate 4 (T25):** App chỉ được gọi production-ready khi toàn bộ P0 pass và có runbook.

# PROMPT TIẾP TỤC CHIFAA COMBINE KHI HẾT TOKEN / ĐỔI PHIÊN CODEX

Bạn đang tiếp tục repository CHIFAA COMBINE đã có. **Không viết lại dự án từ đầu và không suy diễn rằng task trước đã hoàn thành.**

1. Đọc `AGENTS.md`, `HANDOFF.md`, `TASKS.md`, `CHANGELOG.md`, `REQUIREMENT_MATRIX.md`, `DECISIONS.md` (nếu có), toàn bộ bộ tài liệu requirements `README_BAT_DAU.md` + `01`–`09` theo nhu cầu task đang làm.
2. Chạy `git status`, `git log -5`, test/typecheck/build liên quan. Kiểm tra source local đã push Apps Script chưa, `/exec` đã new version chưa; không assume.
3. Xác nhận task đang dở từ HANDOFF và kết quả tests. Chỉ đọc source phụ thuộc, sửa đúng phần đang thiếu, **không phá dữ liệu Sheets và giữ giao diện**.
4. Luôn kiểm tra P0: auth Google đã thật sự hoạt động, 2-way Sheets sync, returns-kiosk-daily revenue, close/adjust, labor, variance, secrets. Nếu còn decision P0 chưa chốt, làm phần an toàn và ghi blocker, không giả tài chính.
5. Sau một task: test, update `REQUIREMENT_MATRIX.md`/`TASKS.md`/`HANDOFF.md`/`CHANGELOG.md`, commit source hợp lệ rồi tiếp tục task sau.
6. Nếu lại thiếu token, checkpoint như trên. Không báo Done nếu chưa có bằng chứng.

**Bắt đầu bằng việc nêu task kế và trạng thái thật theo HANDOFF, sau đó triển khai ngay.**

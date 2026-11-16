# CHIFAA COMBINE — Hướng dẫn agent/Codex trong repo

Bạn đang tiếp tục dự án hiện có, **không bắt đầu từ trắng**. Phải đọc `README_BAT_DAU.md` và `PROMPT_GIAO_CHO_CODEX.md`, rồi từng file theo thứ tự. Không mặc nhiên coi các bản HTML phác thảo là backend thật. Tài liệu này tổng hợp toàn bộ yêu cầu đã nói, kể cả những nghiệp vụ cần xác nhận.

## Vòng lặp công việc 1 task

1. Xác định Task ID và REQ_ID từ `07_TASKS_LO_TRINH.md`/`01_DAC_TA_NGHIEP_VU.md`.
2. Đọc source liên quan và phụ thuộc, lập kế hoạch file cần sửa (không mở cả repo lên hàng trăm nghìn tokens nếu không cần).
3. Implement nhỏ, ưu tiên source hiện có; giữ UI và nghiệp vụ; chạy tests/CI.
4. Thử e2e luồng chéo tương ứng. Không dùng các số demo làm data thật.
5. Cập nhật `REQUIREMENT_MATRIX.md`, `HANDOFF.md`, `TASKS.md`, `CHANGELOG.md`, bổ sung `DECISIONS.md` cho rule được owner chốt.
6. Git commit nếu code/test hợp lệ. Nếu không có quyền môi trường/Google, ghi `BLOCKED` và hướng dẫn chi tiết thao tác người dùng cần làm; không đoán secret.

## Bắt buộc

- Bảo mật trước tính năng: nếu auth chưa hoạt động và dữ liệu nhạy cảm còn lộ, không đưa live.
- Số liệu có nguồn, kỳ, data quality và snapshot. Kế toán chưa chốt rule → không giả report đã đúng.
- Code local≠Apps Script deployment. `clasp push`≠`/exec` new version. Không đòi chạy init mỗi lần cập nhật UI.
- Google Sheets direct editing được hỗ trợ chỉ ở **business columns được duyệt**, không cho sửa headers/metadata/ledger.
- Không tự nhận đã test browser, Google Cloud, Gmail, bảo mật, Sheets nếu thực tế chưa thử và không có log/ảnh.
- Không tự dùng ảnh thay logo của người dùng hoặc style khác.
- Không xóa/đổi schema tự phát; migration/backup/preflight.
- Không ghi OAuth token, private IDs, lương thật, số khách, tài khoản vào public Git, logs hoặc đáp án.

## Mẫu HANDOFF.md sau mỗi checkpoint

```
# HANDOFF
- Thời điểm / branch / commit:
- Task ID đang làm, % theo bằng chứng:
- REQ_ID Done / Partial / Missing / Blocked:
- File đã sửa và migration:
- Lệnh đã chạy + kết quả chính xác:
- Test pass/fail/blocked, dữ liệu fixtures:
- Kiến trúc/logic đã quyết và lý do:
- Dữ liệu nguồn/DEV/Prod nào đã chạm:
- Auth/deploy URL dùng ở môi trường nào (redact secrets):
- Các lỗi và rủi ro chưa xử lý:
- DECISION_REQUIRED từ chủ dự án:
- Bước tiếp theo cụ thể + file cần mở đầu tiên:
```

Trước khi hết context/token hãy checkpoint/commit và trả lời ngắn: “Đã lưu HANDOFF. Mở `PROMPT_TIEP_TUC.md` trong phiên tiếp theo.”

# CHIFAA COMBINE — Bộ đặc tả tổng hợp để Codex nối logic

**Bản tổng hợp yêu cầu xuyên suốt cuộc trò chuyện đến 16/11/2026.** Đây là tài liệu yêu cầu, KHÔNG phải khẳng định hệ thống đã được lập trình/kiểm thử thành công.

## Bắt đầu trong 2 phút

1. Sao chép toàn bộ thư mục tài liệu này vào gốc repository CHIFAA mà Codex đang dùng, trong `docs/requirements/` hoặc giữ nguyên tên thư mục.
2. Giữ nguyên mã nguồn Codex hiện có. **Không reset repo, không thay toàn bộ ứng dụng bằng bản HTML phác thảo.** File HTML `CHIFAA_COMBINE_V17_CHIEN_LUOC_KINH_DOANH.html` là tham chiếu giao diện/ý tưởng, không phải backend chạy thật.
3. Mở `PROMPT_GIAO_CHO_CODEX.md`, sao chép toàn bộ nội dung, gửi vào Codex. Yêu cầu Codex đọc các tệp trong thứ tự chỉ định.
4. Codex phải lập `REQUIREMENT_MATRIX.md` so khớp từng mã REQ với code, test và trạng thái Done/Partial/Missing/Blocked; sau đó sửa theo lộ trình, không tự tuyên bố đã hoàn thành.
5. Khi hết phiên, dùng `PROMPT_TIEP_TUC.md`; thông tin hoàn thành, blocker và các lệnh chạy ghi trong `HANDOFF.md` tại repo.

## Các tài liệu

| Tệp | Công dụng |
|---|---|
| `PROMPT_GIAO_CHO_CODEX.md` | Prompt chính, có thể sao chép nguyên văn |
| `01_DAC_TA_NGHIEP_VU.md` | Yêu cầu từng phân hệ, người dùng, ví dụ, quy tắc xuyên suốt |
| `02_QUY_TAC_TINH_TOAN_DOI_SOAT.md` | Công thức, mẫu số, các trường hợp chống tính trùng và các điểm chưa chốt |
| `03_MO_HINH_DU_LIEU_VA_LUONG_NGHIEP_VU.md` | Mô hình Sheets, khóa liên kết, sự kiện, trạng thái và chuỗi dữ liệu |
| `04_KIEN_TRUC_DONG_BO_BAO_MAT_HIEU_NANG.md` | Apps Script/Google Sheets hai chiều, xác thực, cache, latency, recovery |
| `05_GIAO_DIEN_DASHBOARD_VA_UX.md` | Bản đồ menu, báo cáo, biểu đồ, thương hiệu, animation |
| `06_KIEM_THU_NGHIEM_THU.md` | Các ca kiểm thử nghiệp vụ, phân quyền, dữ liệu, hiệu năng |
| `07_TASKS_LO_TRINH.md` | Lộ trình theo task có điều kiện đầu vào/đầu ra và checkpoint |
| `08_NHUNG_DIEM_CAN_CHOT.md` | Danh sách vấn đề tài chính, đơn vị, OAuth, nhập liệu... không được tự suy đoán |
| `09_HIEN_TRANG_MA_NGUON_VA_CACH_GHEP.md` | Các dấu mốc bản HTML V1–V17, mã GAS đã gửi, các vấn đề đã phát hiện |
| `AGENTS.md` | Quy tắc thao tác trong repo cho agent |
| `PROMPT_TIEP_TUC.md` | Prompt khởi động lại nếu hết context/token |

## Quy ước ưu tiên khi thông tin mâu thuẫn

1. **Yêu cầu người dùng xác nhận rõ trong các lượt chat muộn hơn** ưu tiên hơn nội dung mô phỏng HTML cũ.
2. Quy tắc có ảnh hưởng doanh thu/lương/kho **chưa thống nhất** được đánh dấu `DECISION_REQUIRED`, không âm thầm chọn một cách tính.
3. Dữ liệu gốc của hai workbook là chứng cứ cần kiểm tra; mọi `#REF!`, ô trống, số giá 0 chưa xác nhận **không biến thành 0 hợp lệ**.
4. Code hiện hữu là nguồn để kiểm kê và giữ phần đã chạy; không mặc định rằng code hiện tại đã đúng mọi nghiệp vụ.
5. Dữ liệu minh họa trong HTML V17 tách khỏi dữ liệu được xác thực của Google Sheets.

## Nguồn người dùng từng gửi

- `DASHBOARD  VẬN HÀNH CHIFAA..xlsx`
- `DASHBOARD KẾ TOÁN CHIFAA.xlsx`
- File HTML từ phác thảo V1 đến V17, ưu tiên **V17 đã sửa sidebar** cho giao diện cuối cùng.
- Logo gốc `logochifaa(1).jpg` (không dùng ảnh tìm kiếm/vẽ lại).
- Mã `Code.gs` đã chia sẻ qua `Văn bản đã dán (1)(20261115-104754).txt` (734 dòng) — cần so với repo mới nhất của Codex.
- Transcript/hình ảnh yêu cầu về tồn kho, nhập bù, doanh thu, lương, trả hàng, mục tiêu, dashboard, báo cáo sếp.
- 19 file video MP4 đã gửi trước đây: **chưa có bản phiên âm được xác nhận cho tất cả**, không coi video chưa giải mã thành yêu cầu chắc chắn.

## Phạm vi

Đích đến là ứng dụng nội bộ vận hành CHIFAA (dưới 10 người đồng thời) có cổng đặt hàng khách, dữ liệu lưu Google Sheets, chỉnh được trên cả Sheets và ứng dụng ở các vùng cho phép, phân quyền thật, báo cáo chính xác, và khả năng sử dụng mượt. Không dùng `IMPORTRANGE` làm trục đồng bộ ứng dụng. Từ phác thảo đến hệ thống production là công việc cần triển khai/kiểm thử theo từng task, **không được tuyên bố hoàn thành chỉ vì có giao diện**.

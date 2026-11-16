# 08 — CÁC ĐIỂM KHÔNG ĐƯỢC TỰ CHỐT KHI NỐI LOGIC

**Dùng trạng thái `DECISION_REQUIRED` và tạo mục Settings/quyết định trong `DECISIONS.md`.** Không cần dừng việc thiết kế chung, nhưng **không phát hành tính toán tài chính dưới dạng chính thức** cho tới khi xác nhận.

| ID | Quyết định đang mở | Vì sao quan trọng | Cách xử lý trước khi chốt |
|---|---|---|---|
| D01 P0 | Định nghĩa chính thức `doanh thu thuần` cho Food cost/labor: sau chiết khấu và giảm trừ hay đúng tiền thực thu? | User mô tả cả hai cách; công nợ khiến hai số khác nhau | Hiển thị song song netRevenue và cashReceived, không gộp; Admin chọn policy sau khi đối soát |
| D02 P0 | 10 phần điểm bán “tự chịu” được ghi nhận doanh thu ngay, phải thu hay bồi hoàn khác? Giá/chiết khấu? | Bảng hiện tại có thể đếm thừa/thiếu doanh thu | Giữ quantity/liability và trạng thái `UNCLASSIFIED_SETTLEMENT` đến khi chốt |
| D03 P0 | “Giá hỗ trợ thu hồi” là chi phí, giảm giá, bù trừ công nợ hay giảm trừ doanh thu? | Không được trừ 2 lần khi kết chuyển P&L | Lưu amount riêng, hiển thị đối soát, chưa đưa tự động vào net revenue chính thức |
| D04 P0 | Công nợ ngày trước: là khách trả nợ cũ (tăng thu), hay CHIFAA cấn trừ phải trả (giảm thu)? | Sai dấu tiền và doanh thu | Tách `oldDebtCollected` và `offsetToSettlement`, có đối tượng công nợ |
| D05 P0 | Khi chốt phiếu ngày, sửa trực tiếp/chứng từ đảo có được không, ai duyệt? | Giữ audit và số lịch sử | Default: ledger chốt chỉ sửa bằng đảo/điều chỉnh; quản lý chốt quyền |
| D06 P0 | Google Auth thuần Apps Script chạy owner nhưng không cấp Sheets Editor user: cơ chế nào được chứng minh an toàn? | 401 no registered origin, danh tính trong owner-execute không bảo đảm | POC 2 Gmail, status BLOCKED nếu không đạt; không bypass |
| D07 P1 | Quy đổi mẻ gạo khô→cơm chín: 2,3 hay 2,5 kg; quy cách từng can/túi/chai | Hao hụt sai ngay từ gốc | Import và đánh dấu missingConversion; owner xác nhận theo item/batch |
| D08 P1 | Tỷ lệ lỗi dùng SX tổng hay sản lượng đạt? Năng suất dùng tổng sản xuất hay thành phẩm đạt? | %/phần giờ thay đổi | Hiển thị cả hai với nhãn tạm tính; khóa policy sau xác nhận |
| D09 P1 | Tỷ lệ trả và hủy của điểm bán tính số lượng giao hay giá trị hàng giao? | So target 2% | Mặc định biểu đồ lượng theo prototype, ghi giả định, Settings có lựa chọn |
| D10 P1 | Phụ cấp default mỗi ca, mỗi ngày hay mỗi tháng cho từng nhân viên? | 2 ca có thể đếm 2 lần | Lưu allowancePolicy từng NV; không áp một kiểu cho tất cả |
| D11 P1 | Có trừ nghỉ giữa ca đêm không? Ca bắt đầu 23h tính ngày nào? | Năng suất SX/chi phí kỳ thay đổi | Ngày bắt đầu ca; nghỉ default 0 cho test, cấu hình sau |
| D12 P1 | Kho ghi tiêu hao theo xuất vật tư thực tế hay suy từ production event? | Có thể trừ kho hai lần | Ledger chỉ theo chứng từ nhập/xuất, theoretical là report riêng; phê duyệt luồng xuất |
| D13 P1 | Hàng trả đã được duyệt nhưng chưa thực nhận kiosk: lúc nào tăng kiosk? | Tránh tồn ảo | Chỉ tăng tồn khi `RECEIVED`, không phải khi `APPROVED` |
| D14 P1 | Tỷ lệ tồn tối thiểu nhập tay hay tính từ ngày dự trữ; quy tắc xuất tự động | Gợi ý mua sai | Người dùng đặt min, công thức tham khảo riêng |
| D15 P1 | Giá vốn lịch sử: bình quân gia quyền, nhập gần nhất, FIFO hay giá định mức? | Lãi/lỗ khác nhau | Lưu snapshot + `basis`; không tự chọn một làm P&L được duyệt |
| D16 P1 | Kiosk nhận hàng thu hồi có giá trị vốn/chuyển kho như thế nào? Lô và hạn sử dụng? | Truy vết hàng & giá vốn bán lại | Có returnId/location/batch và cost snapshot; quy tắc cụ thể cần duyệt |
| D17 P1 | Ngưỡng cảnh báo màu cam trước ngưỡng đỏ (bao nhiêu %)? | Không đồng nhất dashboard | Target config mặc định `not_configured` nếu chưa chốt |
| D18 P1 | Trần thưởng SX 15% có tính phụ cấp/hỗ trợ/bonus đang duyệt? | Vượt ngân sách | Trần trên labor expense đầy đủ; khi thiếu payroll để `NOT_READY` |
| D19 P1 | Số tiền đầu kỳ cash + bank và các khoản đầu kỳ vay/nợ | Dashboard an toàn tiền mặt/P&L sai nếu thiếu | Import opening balances có biên bản kiểm tra |
| D20 P1 | Quy tắc tính số ngày bán trong kế hoạch tháng và so tuần chưa kết thúc | Mẫu số doanh thu kế hoạch | Lịch bán config, không mặc định 30/31 |
| D21 P1 | Customer portal: đăng nhập Google khách, link mời, hay form công khai? | An toàn và trải nghiệm khác nhau | Dựng schema/workflow không public live tới khi chốt |
| D22 P1 | Customer order chuyển kế hoạch: auto-add hay manager approve+merge? | Trùng sản xuất | Giữ liên kết source orderLineId và một planLine duy nhất |
| D23 P1 | Những ai được chỉnh Sheets trực tiếp? Master nào/bảng nào được edit? | Việc share workbook có thể lộ lương và cost | Tách workbook/quyền server, không share toàn bộ data nhạy cảm |
| D24 P1 | Danh sách mã vật tư, món, nhân sự, điểm bán chính thức | Phác thảo chỉ chứa dữ liệu nguồn mẫu | Import từ Excel, làm danh sách đối chiếu, owner duyệt |
| D25 P2 | Thời hạn lưu archive, số ngày giữ backup, ảnh và log | Dữ liệu năm dài hạn | Thiết lập chính sách retention, thử restore |
| D26 P2 | Đồ thị Chiến lược: chỉ tiêu lãi góp hay lãi ròng theo điểm/món | Xếp hạng phụ thuộc phân bổ fixed costs | Ghi rõ `contributionMargin` và tránh gọi là net profit nếu chưa phân bổ chi phí |
| D27 P2 | Thông báo an ninh Admin: chặn login mới hay bắt admin cũ xác nhận thu hồi? | Trải nghiệm/khôi phục khi mất máy | Mặc định deny 2nd session + admin recovery audit; owner chọn policy |

## Các quy tắc đã có thể triển khai không cần chờ

- User muốn phân hệ dùng chung dữ liệu và dưới 10 người đồng thời.
- Cây công thức nhiều cấp, đổi g→kg, cảnh báo khi thiếu quy cách.
- SX chính + SX thêm, lỗi SX tách hủy điểm bán.
- Giao 100/bán 80/thu hồi 10/khách chịu 10 và kiosk tăng 10 chỉ khi nhận; giá thu hồi khác giá bán.
- Nhập mới/nhập bù/bổ sung/sửa có audit; ca qua đêm; lương 3 nhóm; năng suất chỉ giờ SX.
- Tuần Thứ Hai–Chủ nhật, so cùng thứ; mục tiêu trần SX 15% (mốc khởi tạo), báo cáo xanh/cam/đỏ/xám.
- Không đưa dữ liệu thật trước auth, không coi #REF/blank là 0; không tự triển khai `/exec` sau chỉ sửa source.

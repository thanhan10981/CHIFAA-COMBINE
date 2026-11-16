# 05 — SƠ ĐỒ GIAO DIỆN, BẢNG BIỂU VÀ TRẢI NGHIỆM

## A. Điều hướng bắt buộc

**Logo:** ảnh gốc người dùng tải lên, tên `CHIFAA COMBINE`, navy `#17283d`/tông tối tương tự và cam làm accent. Logo phải giữ nguyên tỉ lệ, không crop, không thiết kế lại.

| Nhóm | Các màn hình/đường điều hướng | Dữ liệu chính |
|---|---|---|
| TỔNG QUAN | Tổng quan điều hành, Dashboard vận hành, Chiến lược kinh doanh | KPI, goals, cost, warnings, charts |
| DANH MỤC | Vật tư, Điểm bán, Món bán, Nhân viên, Bảng chiết khấu | master CRUD + effective versions |
| KHO & TỒN KHO | Tồn kho hiện tại, Nhập/xuất/kiểm kê, Lịch sử kho, Cảnh báo & bổ sung hàng | ledger, counts, min thresholds |
| CÔNG THỨC | Công thức món ăn, Nhân/sốt, Cơm chín, Bao bì, Tổng hợp giá vốn | recipe tree, version, costing |
| SẢN XUẤT & NGUYÊN LIỆU | Kế hoạch/chốt sản xuất, Nhu cầu nguyên liệu, Kiểm kê thực tế, Đối chiếu hao hụt, Tiêu hao & kiểm tra chênh lệch | production, recipe, warehouse |
| NHẬP LIỆU | Tổng quan nhập liệu, 01 Kiểm kho, 02 Doanh thu & thanh toán, 03 Chấm công 3 bộ phận, 04 Sản xuất thêm–Lỗi–Hủy–Thu hồi, 05 Kế hoạch & mục tiêu, 06 Khoản vay, 07 Công nợ, 08 Sổ quỹ thu-chi, 09 Bảng lương theo bộ phận | input docs / journals |
| QUẢN LÝ | Tài khoản & phân quyền, Cài đặt, Phiên hoạt động & cảnh báo bảo mật, Nhật ký đồng bộ, Sao lưu/Khôi phục | admin |
| KHÁCH HÀNG | Đặt hàng, Lịch sử đơn, Duyệt đơn (nội bộ) | customer order portal |

**Chú ý:** Một số màn HTML V17 có dữ liệu/trang chỉ là mock, chưa thực sự có CRUD; Codex phải đánh dấu MISSING và chuyển sang logic thật. `Tổng quan nhập liệu` và `Đối chiếu hao hụt` không phải hai nguồn dữ liệu khác nhau mà là nhiều view của cùng chứng từ.

## B. Tiêu chuẩn toàn bộ màn

- Mỗi màn có tên ngắn, mô tả nghiệp vụ hữu ích, breadcrumb, filters, trạng thái dữ liệu/kỳ, action chính, số bản ghi, lỗi thiếu dữ liệu nếu có.
- Table có cột ID/STT, tên/đơn vị, số lượng/tiền format VN, thao tác chi tiết, tìm kiếm, sắp xếp, phân trang, quyền `read/create/update/...`; header sticky khi bảng dài.
- Form không làm người dùng mất nội dung khi chuyển tab: draft tách theo `date+module+user`, trạng thái `Đang nhập`, `Đang lưu`, `Đã lưu`, `Lỗi`, `Xung đột`, `Đã chốt`.
- Chọn ngày hôm nay mặc định; thao tác `Nhập bù`, `Bổ sung`, `Sửa` phải là 3 action phân biệt. Chỉnh trực tiếp Sheet phải có trạng thái dữ liệu mới, không chờ reload toàn trang.
- Sidebar không co label từng chữ. Icon width cố định, text flex đủ rộng; mobile drawer; menu cha có chevron/active rõ, menu con cùng lề; không overwrite HTML content bằng JavaScript các phiên bản cũ.
- Ngôn ngữ trang trọng, không chữ nội bộ “V16”, “mình sẽ…”, “nhìn là hiểu ngay”, “bản demo v...”. Có nhãn nhỏ `Dữ liệu minh họa` khi mode preview; không che giấu người xem.

## C. Trang Tổng quan điều hành

### Hàng KPI ưu tiên cao nhất

1. Doanh thu thuần kỳ xem và so với hôm trước/kế hoạch.
2. Tiền mặt + ngân hàng thực tế và ngưỡng tối thiểu.
3. Food cost / doanh thu thuần (% và mục tiêu).
4. Chi phí nhân sự SX / doanh thu thuần (% và trần 15%).
5. Dư địa ngân sách thưởng có điều kiện (không hiện nếu thiếu kỳ/chi phí/giờ).
6. Lợi nhuận tạm tính/P&L.

### Bảng chi phí/kỳ

Food cost; SX; VP/quản lý; marketing; cố định; khấu hao; rủi ro tiền mặt; lỗi/hủy/trả; doanh thu so với target. Mỗi dòng: Actual VND, % base, Target, Chênh lệch, Status, Nguồn, Nút drilldown.

### Trung tâm cảnh báo

- Số mã vật tư đang dưới tồn tối thiểu (ví dụ “3 vật tư thiếu”), bấm tới danh sách mã/SL cần mua.
- Nhu cầu nguyên liệu ngày mai vượt tồn khả dụng; tồn kho và kiểm kê chênh lệch.
- Sản lượng thấp/cao mục tiêu, mức lỗi/hủy/trả bất thường theo target.
- Doanh thu hụt, SX labor chạm trần, cash+bank dưới mức an toàn, chỉ số thiếu dữ liệu.
- Cảnh báo có priority/status/owner/acknowledgedAt, không tự đánh dấu xanh khi dữ liệu null.

## D. Dashboard vận hành — 6 nhóm

1. **Doanh thu:** thẻ Hôm nay/Hôm qua/%; kế hoạch ngày, % hoàn thành; biểu đồ tuần trước; so Thứ Hai–CN từng cặp tuần; lọc điểm bán/món, doanh thu thuần vs thu tiền.
2. **Sản xuất:** sản lượng chính/thêm, số lỗi, tỷ lệ lỗi, 6 KPI giờ công SX và năng suất; lọc ngày/tuần/tháng và bộ phận để kiểm tra nguồn công.
3. **Kho:** tồn nguyên liệu và bao bì theo giá vốn, vật tư dưới min, nhu cầu mai, tồn và chênh theo đợt kiểm kê. **Không cộng tồn thành phẩm thu hồi vào giá trị kho nguyên liệu**.
4. **Food cost:** cost theo món/kỳ, % trên net revenue được chốt, thiếu đơn giá/recipe có cảnh báo, lịch sử giá vốn không thay đổi theo giá hôm nay.
5. **Điểm bán:** doanh thu/lợi nhuận/chất lượng theo điểm, lượng giao-bán-chịu-thu hồi-hủy, xếp hạng 11 điểm từ nguồn khi đã xác thực.
6. **P&L và dòng tiền:** thuần, COGS, SX/VP/Marketing/Fixed/Depreciation/Interest, lãi/lỗ, cash+bank, khoản vay/công nợ.

## E. Chiến lược kinh doanh — ít nhất 8 chart không trùng

| Câu hỏi | Loại hình | Trục/nguồn |
|---|---|---|
| Doanh thu thuần có đang tăng? | Line chart | Day/Week/Month net revenue, period consistency |
| Bán đủ để hòa vốn chưa? | Progress/bullet + break-even marker | sold quantity vs calculated threshold |
| Điểm nào đóng góp lãi nhiều? | Horizontal ranked bar | Contribution per store |
| Điểm nào hủy cao? | Horizontal bar/heat | % discarded per store |
| Món nào kiếm nhiều tiền? | Ranked bar | Contribution by dish, negative highlights |
| 100đ doanh thu đi đâu? | Donut/sunburst | 100% composition of agreed cost categories |
| 12 tháng lãi/lỗ đều không? | Column/area | Monthly P&L, missing periods flagged |
| Nếu thay giá/sản lượng/tỷ lệ hủy? | Scenario interactive panel | Margin, break-even, 30-day estimate, delta |

Hiển thị legend, đơn vị, nguồn, data completeness; data demo nằm trong chế độ riêng, không tự lưu sang Sheets. Có nhiều hình chart nhưng không làm UI rối hoặc chậm.

## F. Bảng nhập liệu cụ thể

- **Công thức:** editor nhiều dòng, nguyên liệu và công thức con, 1 mẻ/1 phần, giá/UOM, tình trạng thiếu quy cách và formula cycle.
- **Sản xuất:** STT, mã món, tên, SX chính, **SX thêm**, tổng, lỗi, tỷ lệ, ghi chú; phần C trả hàng: điểm bán, món, SL, giá hỗ trợ, thành tiền, duyệt, nhận kiosk.
- **Doanh thu:** ma trận ngày × điểm bán × món, số giao, số bán, số thu hồi, số khách tự chịu, đơn giá, chiết khấu, gross/net, hỗ trợ, công nợ cũ, số cần thu, tiền mặt, chuyển khoản, chênh, status chốt.
- **Chấm công:** mã, tên, nhóm SX/VP/BH, giờ vào/ra qua đêm, nghỉ, tổng giờ, lương giờ snapshot, phụ cấp mặc định/chỉnh ngày/hỗ trợ, tiền ca, note; bảng lương tháng chia 3 nhóm.
- **Kế hoạch:** tháng/ngày, doanh thu kế hoạch, ngày bán, mục tiêu tỷ lệ và chi phí, kế hoạch sản lượng tuần, cash min, ngưỡng cảnh báo.
- **Kho:** tồn đầu, nhập, xuất, tồn cuối, tối thiểu, yêu cầu mua, kỳ kiểm kê và đối chiếu chênh lệch theo định mức.

## G. Animation và chất lượng UI

- Card reveal 150–300ms, skeleton trong lúc tải; numbers animate khi có **giá trị mới thật**, không animation đè lặp khi đổi tab; charts load lazily và resize đúng.
- Tab/menu transitions non-blocking, dropdown mở/đóng độc lập, modal/tooltip/toast nhất quán; trạng thái save tách pending/success/failure.
- `prefers-reduced-motion`, tab keyboard focus, contrast, aria-label, mobile 375px không tràn ngang và không gãy chữ; không giật layout do chart height chưa định.
- Bộ lọc sticky/thời gian, trạng thái no-data rõ và link tới màn nhập liệu cần hoàn thiện.

# MASTER PROMPT – HOÀN THIỆN TOÀN BỘ CHIFAA COMBINE

## VAI TRÒ

Bạn là Principal Software Architect, Senior Full-stack Engineer, Google Apps Script Expert, chuyên gia Google Sheets Database, bảo mật ứng dụng và hệ thống quản trị sản xuất – kế toán.

Bạn đang tiếp quản dự án thực tế **CHIFAA COMBINE** đã có mã nguồn và nhiều chức năng đang được phát triển.

**NHIỆM VỤ: TIẾP TỤC PHÁT TRIỂN, TÍCH HỢP, TỐI ƯU, KIỂM THỬ VÀ HOÀN THIỆN TOÀN BỘ DỰ ÁN TRONG MỘT PHIÊN LẬP TRÌNH DÀI.**

Không chỉ phân tích, lập kế hoạch hay viết hướng dẫn. Phải thực sự tạo và sửa mã nguồn, hoàn thiện các chức năng còn thiếu.

Không được viết lại ứng dụng từ đầu nếu mã nguồn hiện tại có thể tái sử dụng.

---

# PHẦN 1. QUY TẮC LÀM VIỆC TỰ ĐỘNG

## 1.1. Chế độ làm việc liên tục

Tôi muốn bạn chủ động làm việc qua một phiên dài mà không phải liên tục ra lệnh tiếp theo.

Quy tắc:

1. Đọc và hiểu toàn bộ repository hiện tại.
2. Đọc tất cả tài liệu đặc tả, đặc biệt là các file liên quan CHIFAA, AGENTS.md, TASKS.md, HANDOFF.md, các bản yêu cầu và sơ đồ dữ liệu.
3. Kiểm tra code đã có trước khi sửa.
4. Lập danh sách công việc còn thiếu, chia thành task nhỏ.
5. Tự chọn task tiếp theo theo mức độ phụ thuộc.
6. Triển khai thực tế, không dừng ở pseudocode hoặc TODO.
7. Sau khi sửa phải chạy các kiểm thử phù hợp.
8. Nếu thành công, lưu tiến độ rồi tự động chuyển sang task kế tiếp.
9. Nếu thất bại, xác định nguyên nhân, sửa lỗi và kiểm thử lại.
10. Tiếp tục đến khi hoàn thành toàn bộ công việc khả thi trong môi trường hiện tại hoặc gặp một rào cản bên ngoài không thể tự giải quyết.

**Không hỏi tôi có muốn tiếp tục task tiếp theo hay không. Tôi đã đồng ý cho bạn thực hiện liên tục trong phạm vi repository DEV.**

Không tự tuyên bố hoàn thành khi các chức năng còn dùng dữ liệu giả hoặc chưa kết nối backend.

## 1.2. Khi gặp thiếu thông tin

Nếu thiếu một quy tắc nghiệp vụ:

- Kiểm tra tài liệu và code hiện có.
- Không tự phát minh các quy tắc tài chính.
- Tách quy tắc chưa chốt thành cấu hình hoặc trạng thái chờ xác nhận.
- Tiếp tục triển khai các phần độc lập.
- Ghi rõ vào DECISIONS_REQUIRED.md.

Chỉ yêu cầu con người can thiệp khi cần cấp quyền Google, đăng nhập tài khoản, cung cấp khóa bí mật hoặc đưa ra quyết định nghiệp vụ không thể suy ra an toàn.

Không chờ những quyết định đó để ngừng toàn bộ dự án.

## 1.3. Bảo toàn công việc

Sau mỗi task:

- Cập nhật TASKS.md.
- Cập nhật HANDOFF.md.
- Cập nhật CHANGELOG.md.
- Ghi các file đã chỉnh sửa.
- Ghi kết quả kiểm thử.
- Tạo Git commit có mô tả rõ nếu repository đã cấu hình Git và thao tác an toàn.
- Không commit mật khẩu, token, Client Secret, dữ liệu tài chính riêng tư hoặc thông tin nhạy cảm.

Khi dung lượng ngữ cảnh sắp hết, ưu tiên lưu trạng thái công việc đầy đủ.

---

# PHẦN 2. BỐI CẢNH DỰ ÁN

Tên ứng dụng: **CHIFAA COMBINE**

Công nghệ ưu tiên:

- Google Apps Script V8.
- HTML Service.
- HTML/CSS/JavaScript.
- Google Sheets làm nguồn dữ liệu chính thức.
- CacheService, PropertiesService, LockService.
- Google Drive dành cho sao lưu.
- Google OAuth với cơ chế xác thực thực sự an toàn.
- Chart.js hoặc thư viện biểu đồ phù hợp với Apps Script, kiểm tra tương thích trước khi sử dụng.

Quy mô: Dưới 10 người sử dụng đồng thời.

Múi giờ: Asia/Ho_Chi_Minh.

Ngôn ngữ giao diện: Tiếng Việt.

Mục tiêu:

- Ứng dụng quản lý vận hành hoàn chỉnh.
- Giao diện chuyên nghiệp, hiện đại.
- Chuyển tab mượt.
- Dữ liệu tải nhanh.
- Hệ thống phân quyền an toàn.
- Có thể sử dụng ứng dụng và chỉnh sửa dữ liệu trực tiếp trong Google Sheets mà không làm hỏng nhau.
- Có báo cáo kế toán, Dashboard vận hành, quản trị và phân tích chiến lược.
- Có khả năng bảo trì, mở rộng và sao lưu lâu dài.

Bắt buộc sử dụng đúng logo CHIFAA gốc có trong tài liệu dự án. Không tạo lại logo bằng AI hoặc sử dụng logo thay thế.

---

# PHẦN 3. KIẾN TRÚC BACKEND VÀ GOOGLE SHEETS

## 3.1. Nguồn dữ liệu

Google Sheets là nguồn dữ liệu chính thức.

Mỗi phân hệ phải có:

- Schema rõ ràng.
- Mã định danh bản ghi ổn định.
- Trường phiên bản.
- Thời điểm tạo và cập nhật.
- Người cập nhật.
- Trạng thái bản ghi.
- Cơ chế kiểm soát xung đột.
- Nhật ký thay đổi.

Không dựa vào vị trí dòng làm định danh lâu dài.

Không tự ý thay đổi hai workbook Dashboard CHIFAA gốc.

## 3.2. Đồng bộ hai chiều

Cần hỗ trợ hai cách thao tác:

**Ứng dụng → Google Sheets**

Người dùng thêm, sửa hoặc nhập dữ liệu trên CHIFAA thì dữ liệu phải được ghi xuống đúng bảng trong Google Sheets.

**Google Sheets → Ứng dụng**

Người có quyền chỉnh sửa trực tiếp trên Sheets thì ứng dụng phải nhận được dữ liệu mới.

Yêu cầu:

- Không ghi đè thay đổi chưa được kiểm tra.
- Phát hiện xung đột phiên bản.
- Cập nhật cache liên quan.
- Phát hiện dữ liệu không hợp lệ.
- Không xóa lịch sử.
- Không coi các trigger là bảo đảm tuyệt đối rằng mọi chỉnh sửa đều đã được đồng bộ.
- Có cơ chế quét thay đổi phù hợp và nhật ký đồng bộ.
- Sửa một bảng không bắt buộc phải tải lại tất cả các bảng.

Với các phiếu tài chính và kho đã chốt, ưu tiên thao tác đảo phiếu và lập phiếu điều chỉnh thay vì âm thầm thay đổi lịch sử.

## 3.3. Ghi dữ liệu an toàn

Triển khai:

- LockService khi cần ghi đồng thời.
- Idempotency key cho yêu cầu lưu.
- Kiểm tra dữ liệu tại backend.
- Chặn bản ghi trùng.
- Lưu nhật ký thao tác.
- Phản hồi rõ khi thất bại.
- Không hiển thị Đã lưu khi Google Sheets chưa xác nhận.
- Có quy trình xử lý giao dịch lỗi giữa chừng.

---

# PHẦN 4. TỐI ƯU HIỆU NĂNG – ƯU TIÊN RẤT CAO

Hiện tại CHIFAA tải dữ liệu từ Google Sheets rất chậm.

Đây là vấn đề cần xử lý ở giai đoạn đầu.

## 4.1. Phân tích bottleneck

Kiểm tra:

- db_()
- rawRows_()
- data_()
- bootstrap_()
- mutate_()
- report()
- compareWeeks()
- scanSheets_()
- Tất cả RPC và google.script.run.

Đo thời gian truy cập Google Sheets, xử lý dữ liệu, truyền về frontend và render.

## 4.2. Tải dữ liệu thông minh

Khi đăng nhập:

1. Xác thực người dùng.
2. Tải quyền truy cập.
3. Hiển thị giao diện và menu.
4. Tải dữ liệu Dashboard ưu tiên.
5. Tải danh mục cần thiết.
6. Tải các phân hệ khác khi cần.
7. Có thể preload dữ liệu đã được phân quyền ở mức ưu tiên thấp.

Không gọi tất cả Sheets khi mở ứng dụng.

Không đọc toàn bộ lịch sử chỉ để hiển thị số liệu hôm nay.

## 4.3. Cache

Thiết lập:

- Cache trình duyệt trong phiên.
- Cache Apps Script.
- Cache theo module.
- Cache theo phiên bản.
- Cache có xét quyền truy cập.
- Cơ chế vô hiệu hóa cache khi dữ liệu thay đổi.
- Kiểm tra phiên bản theo chu kỳ phù hợp.
- Không cache dữ liệu nhạy cảm trước xác thực.
- Không rò rỉ dữ liệu giữa người dùng.

## 4.4. Dashboard Snapshot

Xây dựng dữ liệu tổng hợp phục vụ:

- Doanh thu ngày.
- Doanh thu tuần.
- Doanh thu tháng.
- Sản lượng.
- Giờ công.
- Năng suất.
- Food cost.
- Labor cost.
- Tồn kho.
- Hao hụt.
- Công nợ.
- Dòng tiền.
- Các tỷ lệ chi phí.
- Báo cáo điều hành.
- Báo cáo chiến lược.

Không tính lại toàn bộ lịch sử mỗi lần mở Dashboard.

Snapshot phải có phiên bản dữ liệu và khả năng tái tính khi nguồn thay đổi.

## 4.5. Mục tiêu

- Chuyển tab đã có dữ liệu cache: mục tiêu dưới 200 ms.
- Chuyển tab không tải lại trang.
- Người dùng có thể thao tác trong khi server xử lý.
- Dữ liệu tải dần, không làm đứng toàn bộ giao diện.
- Hạn chế gọi API trùng.
- Biểu đồ không render lại nếu không cần.
- Đo thực tế trước và sau khi tối ưu.

Không được tuyên bố đã đạt mục tiêu tốc độ nếu chưa benchmark.

---

# PHẦN 5. ĐĂNG NHẬP VÀ BẢO MẬT

Ứng dụng có các vai trò:

**Admin:** Toàn quyền.

**Kế toán:** Quyền do Admin tùy chọn.

**Nhân viên:** Chỉ xem và sử dụng các phân hệ được cấp.

Admin có thể:

- Tạo tài khoản.
- Cấp quyền theo module.
- Phân quyền xem, thêm, sửa, xóa, duyệt, xuất báo cáo.
- Khóa tài khoản.
- Thu hồi phiên đăng nhập.
- Xem nhật ký.
- Quản lý thiết bị/phiên.
- Nhận cảnh báo đăng nhập bất thường.

Admin chỉ được có một phiên hoạt động tại một thời điểm, theo cơ chế quản lý phiên phía server.

## Vấn đề OAuth hiện tại

Dự án đã từng gặp:

`401 invalid_client – no registered origin`

Yêu cầu:

- Kiểm tra luồng đăng nhập đang tồn tại.
- Loại bỏ việc phụ thuộc vào Google Identity Services trong iframe Apps Script nếu không tương thích.
- Chọn và triển khai cơ chế đăng nhập Google an toàn, phù hợp với kiến trúc Apps Script.
- Không dùng email do frontend tự khai báo để xác thực.
- Không dùng Session.getActiveUser().getEmail() trong ngữ cảnh mà danh tính người truy cập không được Google bảo đảm trả về.
- Không cấp quyền Editor toàn bộ workbook cho nhân viên chỉ để sử dụng ứng dụng.
- Nếu chưa thể triển khai xác thực an toàn trong kiến trúc này, đánh dấu đây là blocker bắt buộc; không triển khai phương án bỏ qua xác thực.

Mỗi API phải kiểm tra phiên và quyền tại backend.

Không chỉ ẩn menu để phân quyền.

Không đặt secret trong HTML hoặc repository công khai.

---

# PHẦN 6. DANH MỤC VÀ CÔNG THỨC

Hoàn thiện:

- Danh mục vật tư.
- Danh mục điểm bán.
- Danh mục món bán.
- Danh mục nhân viên.
- Bảng chiết khấu.
- Công thức món ăn.
- Công thức nhân/sốt.
- Công thức cơm chín.
- Định mức bao bì.
- Tổng hợp giá vốn.

Nguyên liệu cần có mã, tên, đơn vị mua, đơn vị sử dụng, quy cách, giá và tồn tối thiểu.

Công thức hỗ trợ nhiều tầng:

Món bán → Nhân/sốt → Nguyên liệu.

Quy đổi gram/kg và đơn vị đóng gói chính xác.

Một món có thể sử dụng công thức khác làm thành phần.

Tính định mức theo sản lượng thực tế.

Giữ giá vốn lịch sử theo dữ liệu giá có hiệu lực ở thời điểm phát sinh.

Không tự coi nguyên liệu chưa có giá là 0 đồng.

---

# PHẦN 7. SẢN XUẤT, KHO VÀ NGUYÊN LIỆU

Hoàn thiện quy trình:

- Nhập kế hoạch sản xuất buổi tối.
- Sản xuất để giao sáng hôm sau.
- Ghi số lượng sản xuất chính.
- Ghi sản xuất thêm.
- Ghi lỗi sản xuất.
- Ghi hàng hủy.
- Ghi hàng trả về ki-ốt.
- Tính nhu cầu nguyên liệu tự động từ công thức.
- Tổng hợp nguyên liệu trùng mã.
- Theo dõi theo ngày, tuần, tháng, quý.
- Theo dõi nhập kho, xuất kho, tồn kho.
- Cảnh báo dưới tồn tối thiểu.
- Kiểm kê và đối chiếu hao hụt.

Phải phân biệt:

- Nhu cầu theo kế hoạch.
- Tiêu hao định mức theo sản lượng thực tế.
- Lượng nguyên liệu thực tế sử dụng.
- Lượng tồn thực tế.

Công thức chênh lệch:

Chênh lệch = Thực dùng - Định mức.

Tỷ lệ chênh lệch = Chênh lệch / Định mức × 100%.

Không tự kết luận chênh lệch là thất thoát do nhân viên.

---

# PHẦN 8. DOANH THU VÀ HÀNG THU HỒI

Hoàn thiện nhập doanh thu theo từng ngày, điểm bán và món.

Có:

- Số lượng giao.
- Số lượng bán.
- Số lượng thu hồi.
- Số lượng điểm bán tự chịu.
- Giá bán.
- Chiết khấu.
- Giá hỗ trợ thu hồi.
- Công nợ.
- Tiền mặt.
- Chuyển khoản.
- Điều chỉnh khác.
- Đối soát số tiền thực nhận.

Ví dụ bắt buộc kiểm thử:

Giao 100 phần, bán 80, thu hồi 10, điểm bán chịu 10.

Kết quả:

- 80 phần đã bán.
- 10 phần thu hồi chuyển sang ki-ốt.
- 10 phần được ghi nhận thuộc trách nhiệm điểm bán.
- Hàng thu hồi không mặc định là hàng hủy.
- Giá hỗ trợ thu hồi khác giá bán.
- Không cộng hàng thu hồi vào doanh thu hai lần.
- Không cộng doanh thu của ki-ốt khi ki-ốt chưa bán.

Các quy tắc hạch toán điểm bán tự chịu và giá hỗ trợ thu hồi chưa được xác nhận phải là cấu hình chờ phê duyệt, không tự suy đoán.

Phân biệt doanh thu thuần và tiền thực nhận.

Không sử dụng tiền còn lại sau mọi chi phí làm mẫu số Food Cost hay Labor Cost.

---

# PHẦN 9. NHẬP LIỆU

Có bốn chế độ:

1. Nhập mới.
2. Nhập bù ngày cũ.
3. Nhập bổ sung.
4. Sửa/điều chỉnh dữ liệu.

Ví dụ:

Nhập 100 phần.

Bổ sung thêm 30 phần → tổng 130.

Sửa lại dữ liệu thành 90 → kết quả phải đúng theo phạm vi sửa, không cộng thêm 90.

Có lịch sử và người thực hiện.

Không ghi đè phiếu cũ ngoài quy trình đã thiết kế.

Áp dụng phù hợp cho kiểm kho, doanh thu, chấm công, sản xuất và các nghiệp vụ tương ứng.

---

# PHẦN 10. NHÂN VIÊN, CHẤM CÔNG VÀ LƯƠNG

Danh mục nhân viên liên kết bảng chấm công và bảng lương.

Tách ba bộ phận:

- Sản xuất.
- Văn phòng.
- Bán hàng.

Mỗi nhân viên có mức lương riêng.

Ca làm việc hỗ trợ qua đêm:

- 23:00–07:00 = 8 giờ.
- 23:00–08:00 = 9 giờ.
- 23:00–09:00 = 10 giờ.

Có phụ cấp mặc định, phụ cấp thêm và hỗ trợ theo ngày.

Phụ cấp được cộng vào lương theo quy tắc đã cấu hình, không cộng trùng.

Giữ mức lương tại thời điểm chấm công để bảo toàn bảng lương lịch sử.

Bảng lương tổng hợp theo bộ phận, nhân viên và tháng.

Năng suất sản xuất chỉ sử dụng giờ công nhân viên thuộc bộ phận Sản xuất.

Năng suất = Tổng số phần sản xuất / Tổng giờ công sản xuất.

Không lấy chi phí tiền lương để thay thế cho số giờ công.

---

# PHẦN 11. TÀI CHÍNH VÀ KẾ TOÁN

Hoàn thiện:

- Sổ quỹ tiền mặt.
- Sổ quỹ ngân hàng.
- Công nợ.
- Khoản vay.
- Trả gốc.
- Lãi vay.
- Tài sản.
- Khấu hao.
- Các nhóm chi phí vận hành.
- Đối soát các nghiệp vụ thu chi.

Không ghi nhận doanh thu bán hàng hai lần khi tự động liên kết với Sổ quỹ.

Không trộn dòng tiền và lợi nhuận.

Có báo cáo lịch sử và xuất Excel khi phù hợp.

---

# PHẦN 12. KẾ HOẠCH VÀ MỤC TIÊU

Các chỉ tiêu cần cấu hình:

- Food Cost tối đa 32,2%.
- Chi phí nhân sự sản xuất tối đa 15%.
- Tỷ lệ lỗi sản xuất.
- Tỷ lệ hủy tại điểm bán.
- Tỷ lệ trả hàng.
- Chi phí nhân sự văn phòng/quản lý.
- Chi phí cố định.
- Chi phí khấu hao.
- Chi phí Marketing.
- Số dư tiền mặt + ngân hàng tối thiểu.
- Mục tiêu doanh thu.
- Mục tiêu sản lượng.
- Kế hoạch tháng/tuần/ngày.

Food Cost và chi phí nhân sự sản xuất được tính trên doanh thu thuần sau chiết khấu và giảm trừ doanh thu hợp lệ, trước chi phí vận hành.

Tiền thực nhận không dùng thay thế doanh thu thuần.

Có trạng thái:

- Xanh: đạt.
- Vàng: gần ngưỡng.
- Đỏ: vượt ngưỡng.
- Xám: thiếu dữ liệu.

Ngân sách thưởng sản xuất còn khả dụng chỉ là chỉ số tham khảo, không tự chi thưởng.

---

# PHẦN 13. DASHBOARD VÀ BÁO CÁO ĐIỀU HÀNH

## Dashboard vận hành

Có lọc:

- Ngày.
- Tuần.
- Tháng.
- Quý.
- Năm.

Hiển thị doanh thu ngày xem, ngày hôm trước và mức tăng giảm phần trăm.

Có kế hoạch doanh thu/ngày lấy từ kế hoạch.

So sánh cùng thứ giữa tuần này với tuần trước.

Hiển thị:

- Giờ công hôm nay.
- Năng suất hôm nay.
- Giờ công tháng.
- Năng suất tháng.
- Tỷ lệ lỗi tháng.
- Mục tiêu lỗi tối đa.

## Báo cáo điều hành

Có các KPI nổi bật, cơ cấu chi phí, chỉ tiêu đạt/chưa đạt, cảnh báo dòng tiền và nguyên liệu thiếu.

Hiển thị các khoản chi phí chiếm bao nhiêu phần trăm doanh thu thuần.

Có cảnh báo và liên kết trực tiếp đến phân hệ cần xử lý.

Không mặc định dữ liệu thiếu bằng 0.

---

# PHẦN 14. CHIẾN LƯỢC KINH DOANH

Tạo nhiều dạng biểu đồ:

- Đường: xu hướng doanh thu.
- Cột: sản lượng và kế hoạch.
- Thanh ngang: xếp hạng điểm bán.
- Donut: cơ cấu chi phí.
- Biểu đồ lãi/lỗ.
- Biểu đồ tỷ lệ hàng hủy, hàng thu hồi.
- Phân tích món có hiệu quả nhất.
- Điểm hòa vốn.
- Kịch bản thay đổi giá, lượng bán và tỷ lệ hủy.

Dữ liệu phải lấy từ backend thực tế khi có đủ căn cứ.

Không dùng dữ liệu minh họa như thể là dữ liệu kinh doanh thật.

---

# PHẦN 15. ĐẶT HÀNG KHÁCH HÀNG

Tạo cổng đặt hàng riêng.

Khách hàng có thể:

- Xem món được công bố.
- Nhập số lượng đặt.
- Chọn ngày và ca giao phù hợp.
- Gửi đơn.
- Theo dõi trạng thái nếu được cấp quyền.

Admin hoặc kế toán có thể duyệt/từ chối đơn.

Đơn đã duyệt có thể đưa vào lập kế hoạch sản xuất, nhưng không cộng trùng với kế hoạch đã nhập thủ công.

Không để khách truy cập dữ liệu lương, công thức, doanh thu nội bộ hoặc danh mục bí mật.

---

# PHẦN 16. GIAO DIỆN VÀ ANIMATION

Giữ thiết kế CHIFAA COMBINE hiện tại.

Hoàn thiện:

- Sidebar.
- Dropdown.
- Icon.
- Responsive.
- Mobile.
- Modal.
- Form.
- Bảng dữ liệu.
- Biểu đồ.
- Skeleton loading.
- Thông báo lưu.
- Hiệu ứng chuyển tab.
- Hiệu ứng mở card.
- Animation biểu đồ.

Không làm sidebar vỡ chữ hoặc lệch icon như các lỗi trước.

Không dùng animation nặng làm giảm hiệu năng.

Hỗ trợ prefers-reduced-motion.

Giữ ngôn ngữ trình bày chuyên nghiệp, không hiển thị những thông báo phát triển nội bộ như "bản V16" hay "nhìn là hiểu ngay".

---

# PHẦN 17. SAO LƯU, PHỤC HỒI VÀ TRIỂN KHAI

Yêu cầu:

- Sao lưu Google Sheets định kỳ.
- Có khả năng kiểm tra bản sao lưu.
- Có quy trình khôi phục.
- Có nhật ký hệ thống.
- Có hướng dẫn deploy.
- Có script build.
- Có cấu hình clasp nếu repository đang sử dụng clasp.
- Có môi trường DEV riêng.
- Không ghi vào dữ liệu production khi chưa được phê duyệt.

Nếu thay đổi schema, dùng migration an toàn.

Không chạy setup_() để ghi đè dữ liệu gốc.

Khi code mới được đẩy lên Apps Script, phải kiểm tra version deployment.

URL /dev dùng code mới nhất dành cho người có quyền phát triển.

URL /exec cần cập nhật phiên bản triển khai khi phát hành.

Nếu không có quyền truy cập Google Cloud/Apps Script từ môi trường hiện tại, hoàn thiện mã và hướng dẫn chính xác, ghi lại bước cần con người thực hiện. Không tuyên bố đã triển khai thành công.

---

# PHẦN 18. LỘ TRÌNH THỰC HIỆN TỰ ĐỘNG

Chia thành các giai đoạn phụ thuộc:

**GIAI ĐOẠN 1 – AUDIT**
- Đọc toàn bộ dự án.
- Đối chiếu code với đặc tả.
- Chạy các kiểm thử hiện có.
- Xác định những phần chưa hoàn thành.
- Tạo kế hoạch và baseline hiệu năng.

**GIAI ĐOẠN 2 – NỀN TẢNG**
- Sửa đăng nhập.
- Kiểm tra bảo mật.
- Phân quyền.
- Hoàn thiện schema.
- Đồng bộ hai chiều.
- Tối ưu API đọc/ghi.
- Tạo cache và lazy loading.

**GIAI ĐOẠN 3 – NGHIỆP VỤ**
- Danh mục.
- Công thức.
- Sản xuất.
- Kho.
- Nhu cầu nguyên liệu.
- Kiểm kê.
- Hao hụt.
- Doanh thu.
- Thu hồi.
- Ki-ốt.

**GIAI ĐOẠN 4 – KẾ TOÁN**
- Chấm công.
- Bảng lương.
- Công nợ.
- Sổ quỹ.
- Khoản vay.
- Tài sản và khấu hao.
- Kế hoạch và mục tiêu.

**GIAI ĐOẠN 5 – BÁO CÁO**
- Dashboard vận hành.
- Báo cáo điều hành.
- Chiến lược kinh doanh.
- Bộ lọc thời gian.
- Snapshot KPI.
- Biểu đồ.

**GIAI ĐOẠN 6 – HOÀN THIỆN**
- Đặt hàng khách hàng.
- UI/UX.
- Responsive.
- Animation.
- Kiểm thử tổng thể.
- Bảo mật.
- Hiệu năng.
- Tài liệu.
- Quy trình deploy và khôi phục.

Sau khi hoàn thành một task, tự chuyển task tiếp theo.

Không dừng chỉ vì đã hoàn thành một giai đoạn.

---

# PHẦN 19. KIỂM THỬ BẮT BUỘC

Viết và thực thi kiểm thử cho:

1. Admin đăng nhập được.
2. Kế toán không xem được phân hệ ngoài quyền.
3. Tài khoản bị khóa không truy cập được.
4. Admin bị giới hạn một phiên hoạt động.
5. Thêm vật tư trên app xuất hiện trên Sheets.
6. Sửa vật tư trên Sheets được ứng dụng nhận biết.
7. Hai người sửa cùng bản ghi có xử lý xung đột.
8. Công thức nhiều tầng tính đúng nguyên liệu.
9. Quy đổi gram/kg chính xác.
10. Sản xuất thêm cộng đúng sản lượng.
11. Hàng trả về ki-ốt không thành hàng hủy.
12. Doanh thu không tính trùng.
13. Phân biệt doanh thu thuần và thực thu.
14. Nhập bổ sung không ghi đè số cũ.
15. Ca đêm tính đúng giờ.
16. Phụ cấp không bị cộng trùng.
17. Bảng lương phân loại đúng bộ phận.
18. Năng suất chỉ lấy giờ công Sản xuất.
19. Dashboard lọc theo ngày/tuần/tháng.
20. Cảnh báo nguyên liệu thiếu chính xác.
21. Khách hàng không xem được thông tin nội bộ.
22. Cache không gây lộ dữ liệu giữa tài khoản.
23. Có thể xử lý API lỗi hoặc mất kết nối.
24. Không mất dữ liệu khi cập nhật phiên bản mới.
25. Benchmark trước/sau tối ưu.

Tạo thêm integration test và end-to-end test cho các luồng quan trọng.

Không đánh dấu hoàn thành nếu chưa kiểm thử hoặc chưa có bằng chứng tương ứng.

---

# PHẦN 20. XỬ LÝ KHI HẾT TOKEN HOẶC BỊ GIÁN ĐOẠN

Đây là yêu cầu bắt buộc.

Tạo và duy trì các file:

- TASKS.md
- HANDOFF.md
- CHANGELOG.md
- DECISIONS_REQUIRED.md
- TEST_RESULTS.md
- PERFORMANCE_REPORT.md
- DEPLOYMENT_GUIDE.md

HANDOFF.md phải ghi:

- Giai đoạn hiện tại.
- Task đang thực hiện.
- Task đã hoàn thành.
- Task chưa hoàn thành.
- File đã chỉnh sửa.
- Git commit mới nhất.
- Các kiểm thử đã chạy.
- Các lỗi còn tồn tại.
- Cấu hình cần thiết.
- Công việc tiếp theo.
- Lệnh để tiếp tục.

Không chỉ lưu trạng thái khi sắp hết token; phải cập nhật sau từng task quan trọng.

Nếu bị giới hạn thời gian hoặc ngữ cảnh:

1. Dừng ở trạng thái mã nguồn an toàn.
2. Lưu các chỉnh sửa.
3. Chạy các kiểm thử khả thi.
4. Cập nhật HANDOFF.md.
5. Ghi lại chính xác bước tiếp theo.

Ở phiên Codex mới, phải đọc HANDOFF.md và tiếp tục từ trạng thái đã lưu, không làm lại toàn bộ dự án.

---

# PHẦN 21. TIÊU CHÍ HOÀN THÀNH

Chỉ được tuyên bố dự án hoàn thành khi:

- Toàn bộ chức năng thuộc phạm vi đã chốt có triển khai thực tế.
- Các phân hệ dùng chung nguồn dữ liệu thống nhất.
- Có đọc và ghi Google Sheets.
- Đồng bộ hai chiều hoạt động theo tiêu chí đã kiểm thử.
- Đăng nhập và phân quyền được xác minh an toàn.
- Không có lỗi nghiêm trọng còn mở.
- Các phép tính nghiệp vụ đã được kiểm thử.
- Dashboard dùng dữ liệu phù hợp, không đánh tráo dữ liệu demo.
- Có benchmark hiệu năng.
- Có tài liệu triển khai.
- Có hướng dẫn vận hành và sao lưu.
- Các blocker cần con người xử lý được liệt kê rõ.
- Không có thay đổi trái phép đối với dữ liệu production.

Nếu còn blocker, báo cáo rõ trạng thái "Hoàn thành phần có thể tự động hóa – Chờ cấu hình/kiểm thử thực tế", không tuyên bố đã hoàn thiện toàn bộ.

---

# LỆNH BẮT ĐẦU

BẮT ĐẦU THỰC HIỆN NGAY.

Đọc repository và tất cả tài liệu CHIFAA hiện có.

Kiểm tra HANDOFF.md để biết tiến độ nếu đây là phiên làm việc tiếp theo.

Tạo danh sách task và xác định công việc ưu tiên cao nhất.

Ưu tiên xử lý lỗi đăng nhập, tốc độ tải dữ liệu Google Sheets và đồng bộ dữ liệu trước.

Sau đó tự động triển khai liên tục các phân hệ còn lại.

Không dừng lại để hỏi tôi có muốn tiếp tục hay không.

Tự sửa lỗi, tự kiểm thử, tự lưu tiến độ và tự chuyển sang task tiếp theo trong phạm vi quyền được cấp.

Không thay đổi dữ liệu production, không triển khai công khai và không thao tác phá hủy nếu chưa có sự phê duyệt riêng.

Mục tiêu là hoàn thành tối đa toàn bộ CHIFAA COMBINE trong phiên làm việc dài này, với mã nguồn hoạt động thực tế, bảo mật và có thể tiếp tục dễ dàng nếu bị gián đoạn.

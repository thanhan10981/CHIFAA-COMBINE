# Chiến lược kinh doanh

Cập nhật nghiệp vụ liên kết: phiếu sản xuất đã chốt dùng snapshot giá vốn, lãi vay đã có phiếu chi được trừ trong kết quả và phân bổ doanh thu. Các câu mô tả cũ “chưa có snapshot/chưa có lãi vay” bên dưới là trạng thái ban đầu; xem [NGHIEP_VU_LIEN_KET.md](NGHIEP_VU_LIEN_KET.md) cho quy tắc hiện hành và phần legacy còn cần đối chiếu.

Màn hình được làm lại theo `CHIFAA_COMBINE_PHAT_THAO.html` người dùng cung cấp. Bản gốc trong Downloads đã được đối chiếu SHA-256 với bản lưu trong `source/`; nội dung trùng nhau. Giữ tiêu đề xanh đậm, bộ lọc kỳ, 4 KPI, ưu tiên điều hành, 8 khối phân tích và bảng chi tiết điểm bán/món. Không dùng bộ số giả lập của phác thảo trong ứng dụng thật.

## Cách sử dụng

Chọn **Chiến lược kinh doanh** trên sidebar. Chọn Ngày, Tuần, Tháng, Quý hoặc Năm và ngày tham chiếu; dùng ‹ / › để đổi kỳ. Tuần bắt đầu thứ Hai. Kỳ hiện tại dừng ở ngày tham chiếu; kỳ trước lấy đủ kỳ. Nút Kế hoạch & mục tiêu chỉ hiện khi tài khoản được quyền mở trang đó.

Các khối gồm xu hướng doanh thu, hòa vốn, lãi gộp theo điểm bán, tỷ lệ trả về, lãi gộp theo món, phân bổ 100đ doanh thu, kết quả 12 tháng và mô phỏng 30 ngày. Biểu đồ có chú thích khi trỏ vào điểm/cột; kỳ chưa có dữ liệu để trống, phân biệt với phiếu đã ghi doanh thu 0. Bảng cuối chuyển giữa điểm bán và món.

Mô phỏng cho phép sửa giá thuần/phần, biến phí/phần, định phí/ngày, số bán/ngày và tỷ lệ hủy giả định; tính ngay khi nhập và có nút đặt lại. Mô phỏng không ghi Sheets.

## Cơ sở tính

- D01/D02/D03 đã được người dùng xác nhận: doanh thu thuần gồm hàng bán và phần điểm bán chịu sau chiết khấu, trước chi phí vận hành. Hỗ trợ thu hồi và chi phí khác là chi phí riêng, không giảm doanh thu. Thực thu/thu nợ cũ tách riêng. Food cost32,2% và lương SX15% cùng base net, không lấy tiền thực thu làm mẫu số.
- Số bán/ngày = (bán + điểm bán chịu) / số ngày có phiếu doanh thu.
- **Trả về không đồng nghĩa hủy**: hiện hệ thống có số trả, chưa có sổ xác nhận hủy. KPI và biểu đồ dùng trả/giao; không gắn nhãn hủy như số giả lập trong phác thảo.
- Lãi gộp điểm bán/món = doanh thu thuần − định mức nguyên liệu của số đã bán/chịu; chưa phân bổ lương, hao hụt sản xuất hoặc chi phí chung.
- Giá định mức lấy phiếu nhập đến ngày bán; thiếu lịch sử giá/công thức thì lãi gộp để trống. Công thức hiện chưa có phiên bản lịch sử nên sửa công thức có thể đổi số quá khứ.
- Kết quả tổng kỳ dùng chi phí sản xuất thực ghi nhận qua `report` hiện hành. Riêng trang này không hiện lợi nhuận nếu thiếu chấm công cho ngày có doanh thu, phiếu sản xuất tương ứng ngày/món, giá vốn hoặc nguồn sổ thu chi.
- Biến phí cơ sở = (nguyên liệu sản xuất + toàn bộ lương/phụ cấp + marketing/khác) / số bán. Định phí/ngày = chi cố định/quản lý / ngày có doanh thu. Đây là giả định quản trị hiển thị rõ để người dùng điều chỉnh, chưa phải phân loại chi phí kế toán đã nghiệm thu.
- Lãi góp mô phỏng = giá thuần − biến phí / (1 − tỷ lệ hủy giả định); hòa vốn = làm tròn lên định phí/ngày / lãi góp dương. Kết quả 30 ngày = 30 × (số bán/ngày × lãi góp − định phí/ngày). Lãi góp không dương thì không có điểm hòa vốn.
- Phân bổ 100đ chỉ hiện khi đủ nguồn chi phí và doanh thu dương; nếu lỗ, vòng biểu diễn tỷ trọng chi phí, số đ trên chú giải vẫn tính theo doanh thu và lỗ được ghi riêng.

Các kết quả chưa gồm khấu hao, lãi vay, phân bổ tồn thành phẩm hoặc xác nhận đã nhập đủ tất cả chi phí. Sổ chi không có phiếu được tính 0 theo dữ liệu đã ghi; cần đối soát trước khi chốt. Không tự thêm tỷ lệ chi phí mẫu hoặc suy diễn ngày thiếu là 0.

## Quyền và kiểm tra

Giữ nguyên 9 nguồn đọc của trang báo cáo: sales, production, attendance, cash, recipes, materials, stock, stores, dishes. Không thêm quyền Editor workbook hoặc tự cấp module mới. Chỉ dùng dữ liệu bootstrap đã qua xác thực phía server; thiếu nguồn được báo rõ. Không gọi ghi dữ liệu khi đổi bộ lọc hoặc mô phỏng.

127 kiểm thử cục bộ đạt, gồm 5 bài tính kỳ/giá vốn/thiếu nguồn/khoảng trống/kịch bản và 1 bài UI mới. Kiểm tra Chrome cục bộ với fixture riêng: 9 panel (8 phân tích + 1 bảng), biểu đồ có điểm/cột, desktop 1600px và điện thoại 390px không tràn ngang. Ảnh và kết quả nằm trong `output/strategy-*`; fixture chỉ trong output, không đóng gói lên Apps Script. Kiểm thử thực tế trên Google với hai tài khoản vẫn cần nghiệm thu.

# CHIFAA legacy → PostgreSQL — staging, chưa nhập thật

Hai workbook gốc chỉ là nguồn read-only, không runtime. Bản kê chi tiết có thông tin doanh nghiệp ở ignored output, không commit bảng giá/lương thật.

| Nguồn | Đích | Quy đổi/đối chiếu | Trạng thái |
|---|---|---|---|
| Kế toán / DANH MỤC, V:AE | materials, material_units, unit_conversions, material_prices | Mã giữ Unicode, phân biệt DV/ĐV; tách giá gốc/cơ sở giá/quy cách; lỗi và giá trống không thành0 | Mapping đã phân tích, chưa transaction import |
| DANH MỤC điểm bán | stores | Chỉ11dòng có tên; mã giữ nguồn, UUID ổn định theo import namespace | Staging |
| DANH MỤC món | products | Giá theo hiệu lực sang store_product_prices, không nhét cost vào catalog khách | Staging |
| BẢNG CHIẾT KHẤU AG:BE | store_discounts |99cặp tick; hai mã nguyên cây không tự nhận CK chung; hỗ trợ thu hồi riêng/chờ policy | Cần đối chiếu |
| Vận hành / CÔNG THỨC | recipes, recipe_versions, recipe_items, product_recipe_links |18nhóm/92dòng, định mức nấu khác vật lý; chống vòng, định lượng mẻ/phần có căn cứ |6nhóm rõ,12nhóm chờ |
| NHU CẦU NGUYÊN LIỆU | bằng chứng quy đổi, không sinh phiếu kho | TG30quả/vỉ; rong100lá/túi; DM250g/chai; DH2200g/can; DAN5l/can. Không suy cơ sở đơn giá | Có chứng cứ, giá mâu thuẫn giữ needs_review |
| DATABASE/TÍNH TOÁN/sổ kế toán | production/sales/attendance/ledger theo chứng từ | Chưa coi IMPORTRANGE/#REF! hoặc tổng cached bằng0 là lịch sử hợp lệ | Chưa nhập; cần kiểm tra transaction mapping |

Tồn tối thiểu trống→NULL. TXAY/TG/RCM/RCC/DAN/DM/DH/ĐUA có giá/quy cách chưa đủ chứng cứ; không tính cost bằng0. Không dùng lô JSON của Apps Script trực tiếp làm payload PostgreSQL vì UUID/schema khác. Import mới phải stage→review→approve→transaction, kiểm tra duplicate theo mã và nguồn, đối chiếu tổng trước áp dụng.

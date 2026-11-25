# Điểm bán, món bán, nhân viên và chiết khấu

## Quy đổi món bán sang công thức — 25/11/2026 (KH-01/KH-10/KH-11/KH-12)

Khi bảng nhu cầu báo đã tìm thấy công thức nhưng thiếu tỷ lệ, mở **Danh mục món bán → Liên kết công thức** ở đúng dòng món → **Thêm phiên bản**. Chọn công thức đã công bố, ngày hiệu lực, nhập số đơn vị đầu ra công thức cho một đơn vị bán và căn cứ đối chiếu, rồi lưu. Form hiển thị đơn vị và bản xem trước `1 đơn vị bán = số lượng đơn vị công thức`; không tự điền tỷ lệ 1 cho liên kết mới. Khi đổi phiên bản, cần nhập lại tỷ lệ để tránh mang hệ số sai sang đơn vị khác.

Tỷ lệ phải là quy cách đã xác minh; `16 lát/mẻ` không tự chứng minh `1 cây = 16 lát`. Không sửa đơn vị công thức hoặc đơn vị bán để bỏ qua cảnh báo. Ngày liên kết không được trước ngày phiên bản công thức; nhu cầu chỉ nhận liên kết đã có hiệu lực trong ngày giao. Liên kết mới không tự áp ngược vào ngày cũ. Giữ nguyên công thức/BOM, kho và snapshot đã chốt.

Luồng dùng RPC `save_commercial_terms('recipe',...)` có sẵn, quyền create/approve công thức và quyền xem món bán, kiểm tra version, idempotency và audit. Người chỉ xem được mở lịch sử nhưng không thêm liên kết. Sau lưu, làm mới catalog, lịch sử và các query nhu cầu/xem trước kế hoạch. Bản sửa khôi phục nút bị thiếu trên danh sách, không cần SQL/migration mới và không tự ghi tỷ lệ vào dữ liệu thật.

Chủ sở hữu xác nhận ở026: **không có phụ cấp mặc định**. Lương giờ và phụ cấp tháng là hai phần riêng. Trong nhân viên chọn “Phụ cấp tháng”, chọn tháng và nhập tổng phụ cấp kèm lý do; chỉnh lại tạo phiên bản mới thay thế tổng của tháng đó, không cộng dồn và không chuyển sang tháng khác. Chưa nhập là chưa xác định, số0 phải nhập rõ. Tháng đã chốt lương/khóa kỳ không được sửa. Dữ liệu cũ giữ nguyên, không tự chuyển mức mặc định cũ thành phụ cấp tháng và không tạo phiếu trả tiền. Các trường mặc định cũ chỉ còn để lưu lịch sử; ca mới không sao chép chúng.

Migration025 nối bốn màn hình với PostgreSQL. Có tìm theo mã/tên, lọc hoạt động/cần bổ sung, ngày xem và phân trang25 dòng. Thêm/sửa danh mục dùng quyền create/edit, version và khóa idempotency; ngừng sử dụng thay cho xóa lịch sử. Tất cả tiền hiển thị theo định dạng Việt Nam và đi qua API dưới dạng chuỗi.

- Điểm bán: mã, tên, địa chỉ, liên hệ, hoạt động; giá bán riêng và lịch sử CK.
- Món: đơn vị bán, công bố theo quyền approve, ngừng dùng; giá chung theo ngày, liên kết phiên bản công thức đã công bố. Đơn vị bán không đổi trực tiếp khi có giao dịch/công thức. Cost nguồn giữ riêng chỉ tham khảo và chỉ hiện với quyền vật tư.
- Nhân viên: tên, điện thoại, ghi chú, bộ phận có thể chưa xác định; trạng thái làm việc. Lương giờ theo ngày và phụ cấp theo tháng có quyền payroll riêng. Chưa phân bộ phận thì không ghi được chấm công. Không tự trả phụ cấp hoặc coi khoản chưa nhập là0.
- Chiết khấu: mức chung, chọn món được hưởng, mức riêng tùy món, bật/tắt, ngày hiệu lực, nguồn và lịch sử. Bỏ chọn =0%, không ẩn món khỏi menu. Món thêm sau chính sách chưa được chọn sẽ không tự hưởng CK. Ngày trống lưu mốc0001-01-01, hiển thị “Luôn áp dụng”.

Giá chung là giá mặc định; giá riêng điểm bán có ưu tiên. Portal dùng cùng nguồn giá/CK theo ngày giao, chụp giá vào đơn; thêm chính sách sau không viết lại đơn, ca lương hoặc doanh thu đã ghi. Giá, lương, liên kết và CK mới được thêm theo ngày; ngày đã tồn tại bị từ chối thay vì ghi đè. Lịch sử giao diện tối đa100 bản, danh sách tham chiếu tối đa1000 món/500 phiên bản công thức. Phụ cấp/chấm công/tính lương trả tiền là các workflow riêng; không coi danh mục là hoàn tất bảng lương.

## Cập nhật DEV và nhập nguồn

Hai file trong `output/` là riêng tư và không commit:

Nếu đã cài025/nhập danh mục thì **chỉ chạy `CHIFAA_PATCH_PHU_CAP_THANG_DEV.sql` để lên026**, không chạy lại hai file bên dưới và không nhập lại dữ liệu. File026 chạy một DO atomic với postgres; từ chối khi đã cài.

1. `CHIFAA_PATCH_DANH_MUC_DEV.sql`: sau024, postgres SQL Editor, một DO atomic. Dừng nếu025 đã cài; không chạy lại bootstrap toàn bộ schema.
2. `CHIFAA_DANH_MUC_KINH_DOANH_DEV.sql`: nguồn do người dùng gửi, một DO atomic, hash chống nhập trùng; giữ UUID khi mã đã có và dừng toàn bộ nếu xung đột. Giá/lương bắt đầu ngày nhập vì nguồn không cho ngày lịch sử; CK ngày trống là luôn. Món mới chưa tự công bố. Không tạo doanh thu, tồn, chấm công, trả lương hoặc sửa63 vật tư.

File nguồn có dòng để sẵn nhưng trống tên: giữ nguyên bản ở private.catalog_sources, không kích hoạt tên giả. Bộ phận, điện thoại và phụ cấp thiếu nguồn giữ chưa xác định. Chi tiết số lượng và danh sách cần bổ sung ở `output/DANH_MUC_KINH_DOANH_NHAP.md`. Dữ liệu cá nhân, lương và nguồn gốc không đưa vào source/fixture công khai. Không sửa workbook gốc.

CLI: trong web chạy `node --import tsx scripts/prepare-commercial-import.ts <đường-dẫn-file-riêng-tư> [YYYY-MM-DD]`. Có kiểm tra cột, số tiền, mã trùng và đối chiếu CK điểm bán/matrix; không thực thi cloud.

## Kiểm tra

`npm run verify`, `npm run test:design`, `npm run test:commercial`. PostgreSQL local kiểm tra RLS/live grants, replay, stale/null version, giá theo ngày, CK loại trừ món, nguồn riêng, dữ liệu lương bị che, snapshot đơn, liên kết công thức và đơn vị lịch sử. Fixture trình duyệt dùng dữ liệu tổng hợp, không có quyền bỏ qua Auth trong runtime. Nguồn thật kiểm tra riêng ở ignored output/. Chưa có authenticated cloud UAT hoặc cloud import từ công cụ.

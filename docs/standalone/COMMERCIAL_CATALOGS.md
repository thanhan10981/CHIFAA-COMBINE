# Điểm bán, món bán, nhân viên và chiết khấu

Migration025 nối bốn màn hình với PostgreSQL. Có tìm theo mã/tên, lọc hoạt động/cần bổ sung, ngày xem và phân trang25 dòng. Thêm/sửa danh mục dùng quyền create/edit, version và khóa idempotency; ngừng sử dụng thay cho xóa lịch sử. Tất cả tiền hiển thị theo định dạng Việt Nam và đi qua API dưới dạng chuỗi.

- Điểm bán: mã, tên, địa chỉ, liên hệ, hoạt động; giá bán riêng và lịch sử CK.
- Món: đơn vị bán, công bố theo quyền approve, ngừng dùng; giá chung theo ngày, liên kết phiên bản công thức đã công bố. Đơn vị bán không đổi trực tiếp khi có giao dịch/công thức. Cost nguồn giữ riêng chỉ tham khảo và chỉ hiện với quyền vật tư.
- Nhân viên: tên, điện thoại, ghi chú, bộ phận có thể chưa xác định; trạng thái làm việc. Lương/phụ cấp có quyền payroll riêng. Chưa phân bộ phận thì không ghi được chấm công. Phụ cấp thiếu nguồn chưa được xác nhận; không tự trả phụ cấp từ mức mặc định.
- Chiết khấu: mức chung, chọn món được hưởng, mức riêng tùy món, bật/tắt, ngày hiệu lực, nguồn và lịch sử. Bỏ chọn =0%, không ẩn món khỏi menu. Món thêm sau chính sách chưa được chọn sẽ không tự hưởng CK. Ngày trống lưu mốc0001-01-01, hiển thị “Luôn áp dụng”.

Giá chung là giá mặc định; giá riêng điểm bán có ưu tiên. Portal dùng cùng nguồn giá/CK theo ngày giao, chụp giá vào đơn; thêm chính sách sau không viết lại đơn, ca lương hoặc doanh thu đã ghi. Giá, lương, liên kết và CK mới được thêm theo ngày; ngày đã tồn tại bị từ chối thay vì ghi đè. Lịch sử giao diện tối đa100 bản, danh sách tham chiếu tối đa1000 món/500 phiên bản công thức. Phụ cấp/chấm công/tính lương trả tiền là các workflow riêng; không coi danh mục là hoàn tất bảng lương.

## Cập nhật DEV và nhập nguồn

Hai file trong `output/` là riêng tư và không commit:

1. `CHIFAA_PATCH_DANH_MUC_DEV.sql`: sau024, postgres SQL Editor, một DO atomic. Dừng nếu025 đã cài; không chạy lại bootstrap toàn bộ schema.
2. `CHIFAA_DANH_MUC_KINH_DOANH_DEV.sql`: nguồn do người dùng gửi, một DO atomic, hash chống nhập trùng; giữ UUID khi mã đã có và dừng toàn bộ nếu xung đột. Giá/lương bắt đầu ngày nhập vì nguồn không cho ngày lịch sử; CK ngày trống là luôn. Món mới chưa tự công bố. Không tạo doanh thu, tồn, chấm công, trả lương hoặc sửa63 vật tư.

File nguồn có dòng để sẵn nhưng trống tên: giữ nguyên bản ở private.catalog_sources, không kích hoạt tên giả. Bộ phận, điện thoại và phụ cấp thiếu nguồn giữ chưa xác định. Chi tiết số lượng và danh sách cần bổ sung ở `output/DANH_MUC_KINH_DOANH_NHAP.md`. Dữ liệu cá nhân, lương và nguồn gốc không đưa vào source/fixture công khai. Không sửa workbook gốc.

CLI: trong web chạy `node --import tsx scripts/prepare-commercial-import.ts <đường-dẫn-file-riêng-tư> [YYYY-MM-DD]`. Có kiểm tra cột, số tiền, mã trùng và đối chiếu CK điểm bán/matrix; không thực thi cloud.

## Kiểm tra

`npm run verify`, `npm run test:design`, `npm run test:commercial`. PostgreSQL local kiểm tra RLS/live grants, replay, stale/null version, giá theo ngày, CK loại trừ món, nguồn riêng, dữ liệu lương bị che, snapshot đơn, liên kết công thức và đơn vị lịch sử. Fixture trình duyệt dùng dữ liệu tổng hợp, không có quyền bỏ qua Auth trong runtime. Nguồn thật kiểm tra riêng ở ignored output/. Chưa có authenticated cloud UAT hoặc cloud import từ công cụ.

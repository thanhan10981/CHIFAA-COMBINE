# Chuẩn bị dữ liệu cũ — 17/11/2026

Trạng thái: **PREPARED_NOT_IMPORTED**. Người dùng yêu cầu nhập danh mục, công thức và dữ liệu liên quan vào DEV. Chưa ghi hoặc đọc workbook đích, chưa backup Google. DEV vẫn32; không đổi mã ứng dụng, deployment hay ACL.

Đã chuẩn bị11điểm bán và11món theo schema;18nhóm công thức/bao bì với92dòng thành phần giữ ở staging.37mã vật tư chưa có danh mục tên/quy cách/giá.99ô CK được tick đã tách riêng, chưa nhập vì thiếu giá hỗ trợ thu hồi bắt buộc trong schema. Hai món nguyên cây không được tick không áp CK chung. Không suy đoán dữ liệu lịch sử hoặc tạo tồn đầu.

Cost10/11món khác giữa nguồn bảng món và bảng công thức. Giữ nguyên cả hai, không lấy số0/trống làm giá vốn đúng. Sốt phô mai có mâu thuẫn g/phần, cơm có thông số2500g và2300g; chưa nối định lượng gây nhân sai. Mỳ trộn thiếu thành phần. Cần nhận danh mục vật tư và xác nhận các điểm này trước khi áp dụng công thức.

Mã/tool chuẩn bị: `scripts/legacy-catalog-preparation.mjs`. Đọc TSV nguồn và catalog JSON được trích từ bảng người dùng; xuất lô importer hiện có và staging có line provenance. Không gọi Google hay chứa mã/giá thật trong source Git. Dữ liệu riêng nằm dưới `output/legacy-2026-11-17/` (ignored), gồm nguồn, lô01, staging02, README đối chiếu và verification.json. Không đưa thư mục này vào public Git.

Kiểm thử:276/276local tests, syntax85. Ba test mới kiểm tra số Việt Nam/giá thiếu khác0, dòng bao bì không có STT, mappingID ổn định/import transaction/IDtrùng. Lô22bản ghi thực tế đã preview/apply **trong mock**:0lỗi,11stores/11dishes, nhập lại bị chặn22ID,0phiếu kho. Không dùng kết quả này để tuyên bố nhập Google thành công.

Rào cản: CUA không có app/browser. Google Drive được tìm thấy nhưng chưa cài/kết nối, đã gợi ý để người dùng thực hiện kết nối. Danh mục vật tư đã được hỏi qua câu hỏi bất đồng bộ, chưa có câu trả lời tại checkpoint. Không yêu cầu gửi token/mật khẩu/Client Secret.

Bước kế tiếp khi có kết nối: đọc headers và bản ghi thực tế trên DEV, backup/kiểm chứng, đối chiếu cả ID lẫn tên/mã (khácID cũng có thể cùng đối tượng), preview server lại, rồi áp dụng đúng lô đã kiểm tra bằng giao dịch importer và đối chiếu counts/giá. Cần công cụ có thể vận hành luồng ứng dụng hoặc cơ chế nhập giữ journal/metadata/version; không ghi các ô bỏ qua giao dịch. Các nguồn đã tồn tại phải được ánh xạ lại, không tạo bản sao chỉ vì ID khác.

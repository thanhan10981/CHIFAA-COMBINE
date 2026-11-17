# Chuẩn bị dữ liệu cũ — 17/11/2026

Mới nhất: đã tìm/đọc2file gốc và chuẩn hóa63vật tư theo hệ thống đơn vị dùng chung DEV33 (da46387,285tests/syntax90). Không còn chặn nhập vì ngưỡng trống. Lô05hiện91bản ghi,154effects gồm63unitprovenance;6công thức con đủ định lượng. Mã/giá thật ở output ignored, không Git. Chưa nhập/backup Google đích. Đọc docs/UNIT_SYSTEM.md và output/legacy-2026-11-17/KET_QUA_CHUAN_HOA.md; các số57/33/2 và trạng thái thiếu2file bên dưới là lịch sử đã được cập nhật.

Trạng thái: **PREPARED_NOT_IMPORTED**. Người dùng yêu cầu nhập danh mục, công thức và dữ liệu liên quan vào DEV. Chưa ghi hoặc đọc workbook đích, chưa backup Google. DEV vẫn32; không đổi mã ứng dụng, deployment hay ACL.

## Checkpoint sau khi có bảng vật tư

Đã nhận63dòng, nối đủ37/37mã dùng trong công thức. Thêm `scripts/legacy-material-preparation.mjs`: ID escapeUnicode không gộp mã khác nhau, giữ source errors, tách giá0/trống, quy đổi ngưỡng tối thiểu mua→sử dụng. Không tạo tồn từ ô lỗi hoặc tự đặt ngưỡng trống thành0. Nguồn/giá/mã thực tế và quy tắc riêng nằm trong output ignored, không đưa vào Git.

Lô gộp57bản ghi:11điểm/11món/33vật tư/2công thức con.30vật tư và16nhóm công thức còn chờ;17dòng thiếu/còn mâu thuẫn đơn vị hoặc cơ sở đơn giá,23dòng thiếu ngưỡng tối thiểu (hai nhóm có giao nhau).37mã nguyên liệu đã được định danh, việc nhận diện mã không đồng nghĩa đã đủ quy cách hoặc giá vốn cho mọi công thức. Có15chênh lệch đơn giá thành phần được giữ để đối chiếu.

GAS mock lô thực tế57: preview0lỗi, apply đúngcounts, lặp lại bị chặn57ID,0phiếu kho; evidence `output/legacy-2026-11-17/materials-verification.json`.279/279local tests, syntax87. Không thay source Apps Script chạy trên Google nên không triển khai version mới. Google Drive chưa được người dùng xác nhận kết nối; câu hỏi quy cách đã gửi qua async, chưa có câu trả lời tại checkpoint.

Tệp gộp `output/legacy-2026-11-17/05-lo-nhap-ro-rang.json` chỉ dùng sau khi kiểm tra dữ liệu đích, thay cho chọn cả01và03cùng chứa bản ghi. Không tự chạy thêm lô trùng. Khi tiếp tục đọc checkpoint mới này trước các đoạn lịch sử phía dưới.

## Checkpoint trước khi nhận vật tư

Đã chuẩn bị11điểm bán và11món theo schema;18nhóm công thức/bao bì với92dòng thành phần giữ ở staging.37mã vật tư chưa có danh mục tên/quy cách/giá.99ô CK được tick đã tách riêng, chưa nhập vì thiếu giá hỗ trợ thu hồi bắt buộc trong schema. Hai món nguyên cây không được tick không áp CK chung. Không suy đoán dữ liệu lịch sử hoặc tạo tồn đầu.

Cost10/11món khác giữa nguồn bảng món và bảng công thức. Giữ nguyên cả hai, không lấy số0/trống làm giá vốn đúng. Sốt phô mai có mâu thuẫn g/phần, cơm có thông số2500g và2300g; chưa nối định lượng gây nhân sai. Mỳ trộn thiếu thành phần. Cần nhận danh mục vật tư và xác nhận các điểm này trước khi áp dụng công thức.

Mã/tool chuẩn bị: `scripts/legacy-catalog-preparation.mjs`. Đọc TSV nguồn và catalog JSON được trích từ bảng người dùng; xuất lô importer hiện có và staging có line provenance. Không gọi Google hay chứa mã/giá thật trong source Git. Dữ liệu riêng nằm dưới `output/legacy-2026-11-17/` (ignored), gồm nguồn, lô01, staging02, README đối chiếu và verification.json. Không đưa thư mục này vào public Git.

Kiểm thử:276/276local tests, syntax85. Ba test mới kiểm tra số Việt Nam/giá thiếu khác0, dòng bao bì không có STT, mappingID ổn định/import transaction/IDtrùng. Lô22bản ghi thực tế đã preview/apply **trong mock**:0lỗi,11stores/11dishes, nhập lại bị chặn22ID,0phiếu kho. Không dùng kết quả này để tuyên bố nhập Google thành công.

Rào cản: CUA không có app/browser. Google Drive được tìm thấy nhưng chưa cài/kết nối, đã gợi ý để người dùng thực hiện kết nối. Danh mục vật tư đã được hỏi qua câu hỏi bất đồng bộ, chưa có câu trả lời tại checkpoint. Không yêu cầu gửi token/mật khẩu/Client Secret.

Bước kế tiếp khi có kết nối: đọc headers và bản ghi thực tế trên DEV, backup/kiểm chứng, đối chiếu cả ID lẫn tên/mã (khácID cũng có thể cùng đối tượng), preview server lại, rồi áp dụng đúng lô đã kiểm tra bằng giao dịch importer và đối chiếu counts/giá. Cần công cụ có thể vận hành luồng ứng dụng hoặc cơ chế nhập giữ journal/metadata/version; không ghi các ô bỏ qua giao dịch. Các nguồn đã tồn tại phải được ánh xạ lại, không tạo bản sao chỉ vì ID khác.

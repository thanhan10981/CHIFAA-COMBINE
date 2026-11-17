# Đơn vị và cơ sở giá dùng chung

285kiểm thử local, syntax90/build/bundle parse đạt tại checkpoint triển khai. Mã cập nhật vẫn phải xác minh readback và gán cả hai deployment DEV trước khi gọi là live. Không thay file nguồn hoặc dữ liệu Google trong bước chuẩn bị.

## Cấu trúc

Các cột hiện có của `materials` được giữ nguyên, không thêm/đổi thứ tự header. `conversion` và `minimum` cho phép trống. Quy đổi vật lý kg/g, lít/ml được suy ra khi thiếu hệ số; hệ số nhập rõ nhưng sai vẫn bị từ chối. Giá0 và ngưỡng0 nhập rõ vẫn là0.

Định nghĩa đơn vị có nguồn được ghi bằng journal trong `_Workflows`, kind `material-units`, referenceId là ID vật tư. Details chứa `spec`: đơn vị mua, loại đóng gói, lượng/đơn vị của quy cách, đơn vị sử dụng/chuẩn, đơn giá gốc, đơn vị tính giá gốc, trạng thái verified/pending, ghi chú/căn cứ và nguồn (giá trị nguyên bản, workbook/hash/sheet/cell/formula/note). Không lưu token/secret. Các lần sửa nối thêm provenance; không xóa dấu nguồn cũ. Backup hiện có bao gồm ledger/chunks này.

`unitFactor` và `materialUnitState` trong domain là nguồn tính chung. Quy cách vật lý độc lập cơ sở giá: chai chứa250g không chứng minh giá niêm yết là giá/chai. Giá/kg chia1000 vềđ/g; giá/chai chỉ chia250 khi đã xác minh giá/chai. Không đổi ml→g hoặc quả→g từ suy đoán mật độ/khối lượng. Đơn vị chuẩn chính là đơn vị dùng bởi công thức, sổ kho, kiểm kê và nhu cầu.

Đơn giá chưa rõ trả null và nhãn Cần xác minh đơn giá. `costRecipe` dùng chung cho Food Cost/Dashboard/Strategy/báo cáo; không dùng giá hiện tại thay giá nhập lịch sử. Phiếu nhập lịch sử có đơn giá/đơn vị chuẩn hợp lệ vẫn được dùng dù giá danh mục hiện tại chờ xác minh. Giá vốn sản xuất đã chốt giữ snapshot cũ.

Giá gốc được giữ trong spec.source/spec.originalPrice. Trong lô chuẩn bị, giá mâu thuẫn để trống cột giá dùng cũ nhằm tránh bản importer cũ tính sai nếu bỏ qua metadata. Bản importer mới kiểm tra spec và ghi vật tư+provenance cùng giao dịch. Không ghi công thức từng phần rồi tính cost thấp.

## Admin

Nhật ký & đồng bộ → **Đơn vị và đơn giá vật tư** → Tải bảng quy đổi. Có lọc cần xác minh,100dòng/trang, nguồn đối chiếu, trường quy cách và cơ sở giá tách biệt, đơn giá chuẩn tính từ backend. Trạng thái verified yêu cầu cơ sở quy đổi hợp lệ và ghi chú căn cứ. Lưu có ký yêu cầu, quyền Admin, version/hash, khóa ghi, idempotency và audit. Chỉ báo đã lưu sau ACK; retry khi chưa rõ kết quả dùng cùng yêu cầu.

Không đổi đơn vị sử dụng của vật tư đã có công thức, kho hoặc kiểm kê. Đổi đơn vị lịch sử cần migration đối soát riêng; không chỉ đổi nhãn. Sửa trực tiếp Sheet làm đơn vị khác metadata xác minh sẽ chặn đọc/chốt liên quan qua source validation. Sửa giá/quy cách mua khiến cấu hình không khớp thì giá chuẩn về trạng thái chờ; không tái dùng giá xác minh cũ. Người có quyền đọc vật tư được thấy provenance vật tư, không có quyền mở endpoint quản trị.

Mức tối thiểu trống → Chưa thiết lập/null; không tính cần bổ sung hoặc báo đủ tồn từ ngưỡng thiếu. Mức tối thiểu chỉ đổi từ đơn vị mua sang đơn vị dùng khi căn cứ đơn vị rõ. Đối với nguồn có đơn vị mâu thuẫn, giữ ngưỡng nguyên bản trong source và để ngưỡng chuẩn chưa thiết lập.

## Nguồn và bàn giao dữ liệu

Đã đọc lại hai workbook Excel gốc vận hành/kế toán tại Downloads, kiểm tra SHA256 trước/sau không đổi. Đã trích danh mục, công thức, nhu cầu và ghi chú bằng `scripts/inspect-legacy-workbook-units.mjs`; cached errors/formulas được giữ. Bản vận hành có IMPORTRANGE/#REF! ở danh mục; dùng danh mục kế toán và đối chiếu công thức/nhu cầu của cả hai, không coi lỗi là0. Không tự giải quyết nguồn Google ngoài file khi chưa có kết nối.

Evidence riêng ở output/legacy-2026-11-17: original-unit-evidence.json, material-unit-rules-with-evidence.json, KET_QUA_CHUAN_HOA.md, unit-normalization-verification.json. Lô chuẩn bị91bản ghi (11điểm/11món/63vật tư/6công thức con),154hiệu ứng gồm63provenance; preview/apply chỉ trong mock,0phiếu kho. Tám mã cơ sở giá/quy cách chưa đủ căn cứ được liệt kê ở cuối báo cáo riêng, không hỏi lại từng mã. Các công thức cha/cơm/sốt mâu thuẫn tiếp tục staging; không suy ra tham số hoặc giá nước. Chưa đọc/backup/ghi workbook Google đích, chưa có hosted Google/ACL/visual UAT.

Không chạy setup chỉ để đổi UI. Cần ledger nghiệp vụ đã có ở DEV trước khi import. Ngân sách cache vẫn theo quyền/phiên bản; read-model version tăng để loại cache toán cũ. Scan hash thô không đọc thêm provenance; cold reads nghiệp vụ vật tư cần đọc ledger liên quan, là giới hạn hiệu năng đã ghi nhận.

# Bổ sung029 — kiểm kê có chứng từ và điều chỉnh sản xuất

Phạm vi KH-01/03/09/10, tiếp nối028. Không sửa migration028 hoặc yêu cầu chạy lại file đã áp. Patch riêng: `output/CHIFAA_PATCH_DOI_SOAT_SAN_XUAT_DEV.sql`, sinh bằng `cd web; npx tsx scripts/prepare-production-reconciliation-update.ts`. Một DO nguyên tử, yêu cầu028, chặn replay. Không nhập dữ liệu kinh doanh hoặc đổi chứng từ tài chính.

## Đối chiếu từ chứng từ

Trong Kiểm kê, chọn vật tư → **Lấy kiểm kê từ chứng từ kho**:

1. Ghi số đếm thực tế bằng luồng kiểm kê kho đã có, hoặc chọn phiếu đếm hiện có. Để tính một ngày, cần số đếm cuối ngày trước và cuối ngày chọn; không suy tồn đầu từ sổ xuất định mức hoặc một lần đếm quá xa ngày.
2. Xác nhận phiếu là **kiểm kê kết thúc ngày kinh doanh**, nhập thời điểm đếm thực tế và bằng chứng. Thời điểm ở ngày kiểm kê hoặc sáng hôm sau để hỗ trợ ca đêm. Xác nhận bao gồm trách nhiệm đã ghi đủ mọi luồng thuộc ngày; hệ thống không suy giờ vật lý của các chứng từ cũ chỉ có ngày nghiệp vụ. Nếu không thể xác nhận điểm cắt, giữ thiếu dữ liệu hoặc dùng đối chiếu thủ công có bằng chứng.
3. Nhập kho `receipt` được nhận diện là luồng vật lý vào. Phiếu SX có `source_batch_id`, phiếu điều chỉnh do kiểm kê và các đảo phiếu liên quan được nhận diện riêng, không cộng vào luồng vật lý ngoài SX. Phiếu xuất tay/chuyển/điều chỉnh chưa rõ phải được người có Inventory approve phân loại, có lý do/lịch sử. “Luồng vật lý ngoài SX” lấy dấu dương vào nhập, dấu âm vào xuất khác. “Sử dụng cho SX” không trừ lần nữa ở xuất khác. “Chưa phân loại” chặn tự tính; không mặc định bằng0. Đảo phiếu lấy loại nguồn, giữ dấu của dòng đảo.
4. Hệ thống tính **tồn đầu + nhập/luồng vào − tồn cuối − xuất khác** và hiện toàn bộ ID chứng từ/loại/lượng. Người có Counts approve xác nhận lưu. Backend tự đọc lại nguồn, so token Inventory/Counts/Materials và bản đối chiếu trước, không nhận bốn số do client gửi cho luồng tự động.
5. Phiếu đối chiếu mới lưu `source_snapshot` cùng lượng ngay khi insert: hai mốc kiểm kê/xác nhận và các dòng kho/phân loại. Không sửa lại snapshot khi phân loại hoặc số đếm sau này thay đổi. Nếu cần, tạo bản thay thế có liên kết và đối chiếu lại.

Chưa có đủ hai mốc, còn luồng chưa rõ hoặc thời điểm đếm không theo thứ tự thì không mở lưu tự động. Lượng sử dụng âm cần rà soát nguồn. Số0 chỉ là kết quả có nguồn. Luồng đối chiếu thủ công028 vẫn có để xử lý nguồn ngoài hệ thống, có nhãn và bằng chứng riêng; không trộn số tự nhập vào nguồn tự động.

## Sửa sản lượng sau giao/bán

**Thay thế toàn bộ sản lượng ngày** nay lập `production_day_adjustments`, giữ trước/sau, các đợt cũ/mới và chứng từ nguồn liên quan. Đảo đúng phiếu xuất cũ rồi ghi đợt mới trong một giao dịch; thất bại phải rollback cả phần đảo.

Điều kiện đối chiếu:

- Theo từng món và ngày giao bị ảnh hưởng, tổng lượng tốt còn hiệu lực trên các kho sau sửa phải đủ lượng giao posted. Đây là đối soát chung, không tự gán một phiếu giao vào một kho khi nguồn chưa có phân bổ đó.
- Phiếu bán đã liên kết một phiếu giao không cộng lượng giao thêm lần nữa. Phiếu bán độc lập dùng lượng giao của chính phiếu bán. Nếu lượng giao trên các phiếu bán liên kết vượt lượng phiếu giao thì chặn `SOURCE_DELIVERY_SALES_MISMATCH`, yêu cầu xử lý nguồn trước.
- Nếu sau sửa không đủ lượng đã giao thì chặn `CORRECTED_PRODUCTION_BELOW_DELIVERED`. Không tự giảm món giao/bán/thu hồi, không đổi giá, chiết khấu, doanh thu, công nợ, phân bổ thanh toán, tiền mặt hoặc ngân hàng.
- Nguồn giao/bán có thay đổi từ lúc tải màn hình thì token thay đổi và yêu cầu tải lại/đối chiếu. Thao tác ghi khóa tập chứng từ nguồn trong giao dịch. Có nguồn giao/bán cần quyền xem cả Deliveries và Sales để duyệt đối chiếu.
- Giữ khóa kỳ, quyền sửa/duyệt SX và tạo phiếu Kho, audit và idempotency. Kỳ đóng không được bỏ qua chỉ vì dùng luồng điều chỉnh.

Ví dụ đã ghi130 nhưng thực tế100, giao100 và đã có đối soát bán: sửa về100 được; sửa về90 bị chặn nếu không có sản lượng hợp lệ khác đáp ứng lượng giao. Phiếu tài chính giữ nguyên.

## Hủy số nhập sai về0

Chế độ riêng **Hủy số sản lượng nhập sai về0**, có checkbox xác nhận và lý do. Đây là sửa việc ghi nhầm sản lượng, không phải khai báo hủy hàng thực tế. Hàng đã làm nhưng hỏng vẫn phải có sản lượng tiêu hao và lỗi/hủy tương ứng.

Backend chấp nhận tập thay thế rỗng hoặc toàn số0, kiểm tra nghĩa vụ giao/bán như trên, đảo định mức và lưu đợt điều chỉnh có dòng sản lượng/nguyên liệu bằng0 cùng tham chiếu cũ. Báo cáo phân biệt0 có nguồn với chưa nhập, mẫu số0 không thành0%. Không bịa giờ bắt đầu/kết thúc SX cho thao tác hủy số nhập sai. Có thể sửa lại từ bản0 sau này, không đảo kho lần nữa khi bản0 không có phiếu xuất.

## Triển khai và nghiệm thu

Môi trường đích đã có trong tài liệu dự án: DEV online `https://chifaa-combine.vercel.app`, Git branch `chifaa-next-dev`, Vercel Root Directory `web`. Remote `main` giữ nguyên. Người dùng báo đã chạy file028; cần xác nhận029 thành công trước khi đẩy giao diện mới lên nhánh deploy. Không chạy SQL cloud từ công cụ, không chạy lại bootstrap hoặc nhập lại danh mục.

UI kiểm tra capability029: khi DB mới có028, không mở thao tác hủy số nhập sai/tự ghép chứng từ và hiện hướng dẫn patch. Kiểm tra cục bộ dùng PGlite với auth stubs và Chrome fixture, không thay cho UAT Supabase thực. Cần chủ sở hữu UAT tài khoản/quyền/nguồn thật sau deploy. Bằng chứng chạy nằm ở `TEST_RESULTS.md` và ignored `output/production-design/report.json`.

Rollback ứng dụng: dùng bản giao diện trước nếu cần, giữ toàn bộ bảng/lịch sử028/029; không DROP bảng hay xóa dữ liệu. Sửa DB bằng migration tiến tiếp sau khi đối chiếu.

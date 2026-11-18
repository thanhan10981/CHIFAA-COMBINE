# Kho và nhập/xuất — checkpoint 030

Phạm vi KH-01/09/10: vật tư danh mục tự có trong bảng tồn theo từng kho; không tạo thêm bản sao vật tư hay tự gán số tồn. Các ảnh/tệp khách gửi là nguồn yêu cầu, không nhập các lượng hoặc giá minh họa vào database.

`inventory`, `stockmovements`, `entry-stock`, `stockhistory`, `reorder` dùng InventoryWorkspace, thay form nhập đơn lẻ và các màn khung. Chỉ có một kho nguyên liệu thì tự chọn; không có kho thì hướng dẫn tạo trong Danh mục kho. Kho và vật tư là hai danh mục khác nhau. Vật tư thiếu đơn vị chuẩn vẫn hiện nhưng không được ghi phiếu.

- Tồn là tổng chuyển động đến ngày nghiệp vụ, theo kho và đơn vị chuẩn. Chưa có chuyển động/kiểm kê giữ null. Kiểm kê xác nhận 0 được nhận diện kể cả khi không cần phiếu điều chỉnh. Không lấy tồn tối thiểu làm số tồn.
- Nhập là phần mua/bổ sung mới, cộng một lần; xuất trừ số phát sinh. Dùng post_inventory sẵn có, giữ kiểm tra tồn mọi ngày sau ngày nhập bù, kỳ khóa, quyền, idempotency và audit. Không nhận client cost hoặc tự đoán giá.
- Kiểm kê là tổng số thực đếm, dùng post_stock_count với inventory_version chụp lúc mở phiếu; thay đổi tồn đồng thời bị chặn. Ô trống không phải 0. Phiếu đã ghi giữ nguyên lịch sử; checkpoint này không thêm sửa/đảo riêng cho phiếu nhập/xuất.
- Lịch sử lấy chứng từ kho, nguồn đợt SX/đảo phiếu, người/ngày ghi. Phiếu kiểm kê không phát sinh điều chỉnh vẫn có dòng lịch sử khi có quyền xem Kiểm kê.
- Nhu cầu lấy snapshot kế hoạch thủ công hiện hành và đơn duyệt đã phân đúng kho cho ngày chuẩn bị; gộp đơn cùng món trước bung BOM. Cần quyền Sản xuất và Nhu cầu nguyên liệu. Chưa có kế hoạch/thiếu công thức thì nhu cầu và đề xuất chưa xác định. Không trừ kho từ kế hoạch.
- Đề xuất = max(0, tối thiểu + nhu cầu − tồn). Chỉ tính khi đủ tồn, mức tối thiểu và nhu cầu cùng đơn vị chuẩn. Không tự quy đổi đơn vị tồn cũ từ ảnh sang đơn vị mới, không cộng lít/kg. Mức tối thiểu null khác 0; trạng thái dưới tối thiểu tách khỏi đề xuất mua theo kế hoạch.
- Tìm kiếm/nhóm/trạng thái/phân trang ở SQL, 50 dòng/trang. Tạo vật tư và thay đổi kho làm mới cache liên quan. Mất xác nhận giữ nguyên key/payload và khóa nội dung phiếu đến khi kiểm tra lại.

030 chỉ thêm hai RPC đọc và helper private, sửa cách đọc tồn/worksheet kiểm kê để nhận diện số 0 có bằng chứng. Không thêm bảng/dữ liệu kinh doanh, không thay đổi chứng từ hoặc snapshot 028/029 đã chốt. 90 bảng public / 55 RPC. Rollback ứng dụng về commit trước vẫn tương thích với thay đổi đọc; không xóa dữ liệu hay các chứng từ phát sinh để rollback.

Gói DEV: `output/CHIFAA_PATCH_KHO_NHAP_XUAT_DEV.sql`, sau 029, chạy toàn bộ bằng postgres. Guard chống chạy lại, rollback giao dịch nếu lỗi, reload schema và kết quả `030_READY`. SHA256 `db4a38fabb48e3599d5cee58f7e127a8890d164625fb40abdc6665ed06a1113e`. Chủ sở hữu xác nhận 030_READY; API nhận diện RPC và từ chối anonymous 401/42501. Không chạy SQL cloud từ công cụ.

Bằng chứng: 5 regression PostgreSQL nhúng cho kho/unknown/zero/phân trang/phiếu retry/âm tồn/đề xuất/quyền/forward package; Chrome 5 màn × 5 kích thước 320/390/768/1024/1440 và nhập dấu phẩy, retry cùng payload/key, kiểm kê 0 kèm token, kho trống, tự chọn kho duy nhất. Report `output/inventory-design/report.json`. Kiểm thử fixture không phải UAT tài khoản/dữ liệu cloud. Trạng thái phát hành cuối theo `output/inventory-release-status.json`.

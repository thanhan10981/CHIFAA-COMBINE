# Kế hoạch → nhu cầu → sản xuất → kiểm kê chung (031)

Phạm vi KH-01/03/09/10, theo yêu cầu chủ dự án ngày18/11/2026.

1. Chọn ngày kinh doanh, ở bước **Lập kế hoạch** nhập tổng lượng từng món, ví dụ100 phần. Bảng nhu cầu ngay bên dưới xem trước nguyên liệu bằng `production_plan_requirements`, dùng cùng `private.planning_needs` với thao tác lưu. Công thức con được bung và cộng theo vật tư+ĐVT. Có định lượng, quy đổi đóng gói đã xác minh, tồn, tồn dự kiến và thiếu. Thiếu công thức/quy đổi/tồn giữ trạng thái chưa xác định. Không ghi kho hoặc lưu kế hoạch khi gõ.
2. Lưu kế hoạch để màn **Nhu cầu nguyên liệu** đọc cùng ngày/cùng nguồn. Chế độ thay thế nhập tổng kế hoạch thủ công; bổ sung nhập lượng thêm. Đơn khách đã duyệt/phân kho là nguồn riêng được cộng một lần; người dùng không nhập lại đơn đó vào lượng thủ công. Snapshot kế hoạch không bị tính lại âm thầm khi chỉ mở màn hình.
3. Bước **Ghi sản xuất thực tế** lưu riêng lượng chính/thêm/lỗi và thời gian. Chỉ chứng từ sản xuất đã ghi mới xuất định mức khỏi kho. Giữ các bảo vệ chỉnh sửa ngày, đóng kỳ, audit và chống ghi trùng hiện có. Kế hoạch, giao và bán không tự thay cho sản xuất.
4. **Kiểm kê chung** ghi phiếu đếm nguyên liệu duy nhất vào stock_counts, cùng nguồn với kiểm kê từng vật tư từ bảng Kho và danh mục. Đếm thực tế điều chỉnh tồn sổ trong cùng giao dịch. Không ghi lại bốn lượng riêng ở màn Sản xuất.
5. **Đối chiếu tiêu hao** dùng hai mốc đếm đã xác nhận cùng các luồng vật lý đã phân loại để suy tồn đầu + nhập − tồn cuối − xuất khác. Không tính xuất định mức hoặc điều chỉnh sổ kiểm kê lần nữa. Chưa đủ nguồn/phân loại thì không tính chênh lệch. Xác nhận nguồn và lưu đối chiếu giữ token/snapshot; thao tác này không tạo lần đếm hay điều chỉnh kho mới. Lịch sử đối chiếu nhập thủ công cũ còn nguyên.

Migration031 chỉ thêm RPC xem trước có quyền đọc hiện hành; gói DEV sau030 được owner chạy và xác nhận031_READY. Không thêm dữ liệu kinh doanh, không sửa workbook, không xóa kho/chứng từ cũ. Bằng chứng kiểm thử và giới hạn cloud UAT ở TEST_RESULTS.md. Số liệu trong ảnh tham khảo hoặc fixture không được dùng để tự công bố công thức thật.

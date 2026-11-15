# Những lựa chọn cần chủ dự án duyệt trước khi đưa live

**Ưu tiên mặc định an toàn** cho bản thử kỹ thuật: admin nội bộ Google Account allowlist; tài khoản kế toán do admin duyệt; quyền per module/action; không public app kế toán; order public deployment riêng. Các lựa chọn này cần kiểm tra tương thích môi trường Google thực tế.

1. **Xác thực nội bộ**: (Khuyên) Google Sign-In/Workspace identity đã verify server-side, admin cấp email/sub & quyền. Nếu buộc user/pass riêng, cần giải pháp Identity Provider chuẩn như Firebase Auth; không tự triển khai mật khẩu trong Sheets.
2. **Access mode**: Backend GAS owner-owned giúp user không cần quyền mở bảng. Nhưng phải xây auth+authorization server cẩn thận. `USER_ACCESSING` yêu cầu user có đủ quyền với file backend, có thể xung đột RBAC. Cần spike quyết định.
3. **Google Workspace**: Có domain công ty quản lý hay dùng Gmail cá nhân? Điều này quyết định cách chặn account ngoài domain và trải nghiệm OAuth.
4. **Admin 1 thiết bị**: Chính sách đề xuất: chỉ 1 active session; login thiết bị 2 bị từ chối, gửi alert, admin hiện tại có thể thu hồi/hủy phiên; cần phương án khôi phục khi mất máy. Không cam kết nhận dạng thiết bị vật lý tuyệt đối.
5. **Trực tiếp chỉnh Sheets**: Chỉ Admin/nhân sự được ủy quyền được chia sẻ edit Sheet nguồn. Người có edit quyền file nguồn có thể vượt permission UI; dùng protected ranges và tách sổ tài chính nếu cần.
6. **Dữ liệu nhạy cảm**: Lương, công nợ, sổ quỹ, phiếu tài chính chỉ cache trong RAM trình duyệt đúng phiên; không persist localStorage. Catalog không nhạy cảm có thể IndexedDB phiên bản hóa, wipe on logout/role change.
7. **Cổng khách**: chọn (A) khách có tài khoản Google, (B) link mời có hạn/signed token, (C) công khai không cần đăng nhập kèm bảo vệ spam. Khuyên A/B trước. Không public chung portal nội bộ.
8. **Kế toán và doanh thu**: Thỏa thuận quy tắc doanh thu thuần và giá hỗ trợ thu hồi trên phiếu; chốt phương thức ghi nhận trước khi code ledger tài chính.
9. **Sao lưu và phục hồi**: Gợi ý backup mỗi ngày (tối thiểu 30 ngày, chờ duyệt), kiểm thử restore hàng tháng; chọn tài khoản sở hữu Drive/chính sách retention.
10. **Audit**: Log sheet không bất biến tuyệt đối đối với người sở hữu sheet; nếu cần chống sửa, copy log lưu vào nơi riêng quyền hạn cao hơn, hoặc dịch vụ ngoài.

## Các giới hạn không được giấu

- Apps Script không cung cấp một hệ quản trị xác thực/password độc lập như chuyên dụng; không tự chế mã PIN admin trong JS.
- Không thể preload dữ liệu người dùng nhạy cảm trước đăng nhập.
- Không thể bảo đảm API `google.script.run` luôn nhanh trên mạng kém; dùng UI cache + async + đo p95.
- Google OAuth/Cloud config/Drive ownership và triggers không thể cấp phép tự động nếu chủ tài khoản chưa ủy quyền.
- Kích hoạt/chuyển deployment cần thử thực tế môi trường HtmlService sandbox, Google Identity UI hỗ trợ tùy cấu hình.

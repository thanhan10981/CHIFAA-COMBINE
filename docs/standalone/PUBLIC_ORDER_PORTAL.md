# Cổng đặt hàng công khai — DEV035

Yêu cầu trực tiếp18/11/2026 (KH-12, KH-01/03/05/10) thay yêu cầu đăng nhập ở cổng công khai trong MASTER_SPEC cũ. `/portal` mở không cần tài khoản; `/portal/account` giữ cổng điểm bán đã đăng nhập và giá/chiết khấu riêng. Khu vực nội bộ vẫn kiểm tra đăng nhập/quyền như trước.

## Luồng sử dụng

1. Trong Danh mục món bán, bật **Công bố trên cổng đặt hàng** và lưu. Món không ngừng sử dụng sẽ xuất hiện; bỏ công bố/ngừng sử dụng thì không còn được gửi đơn. Trang đọc lại thực đơn mỗi30 giây hoặc khi quay lại tab/tải lại.
2. Giá công khai là **giá bán chung** theo ngày giao từ product_prices. Món chưa có giá vẫn hiện “Chưa có giá”, khóa số lượng; không dùng giá0 thay giá thiếu. Không hiển thị giá vốn/công thức hoặc chính sách từng điểm bán.
3. Khách chọn số lượng, ngày/ca giao; nhập tên, điện thoại, địa chỉ và ghi chú. Tổng là tiền món, không tự bịa phí giao hàng. Gửi online trả mã đơn chờ xác nhận; khi mạng không rõ kết quả, dùng lại cùng mã chống trùng.
4. Nội bộ mở **Duyệt đơn đặt hàng**, xem thông tin khách và từng món. Liên hệ xác nhận, gán về điểm bán có sẵn rồi duyệt; cần quyền orders/approve và quyền đọc stores để chọn điểm bán trên UI. Không tự tạo điểm bán hoặc tự tin danh tính do khách nhập. Có thể từ chối với lý do.
5. Sau duyệt, customer_orders và customer_order_items đi tiếp workflow kế hoạch/giao hàng cũ theo điểm bán đã gán. Giữ snapshot giá bán chung đã gửi; không tự áp giá/CK riêng sau khi gán. Duyệt không tự ghi doanh thu/tiền/kho/kế hoạch.

## Thiết kế và giới hạn

- RPC public_order_catalog chỉ trả id/mã/tên/ĐVT/giá chung của món công bố; phân trang100. Anonymous không có quyền SELECT các bảng products/prices/stores/customer_orders/items/contact hoặc dữ liệu nội bộ.
- submit_public_order là transaction với idempotency riêng trong schema private, kiểm tra giá báo cho khách bằng giá server, tình trạng món, số lượng nguyên1..999999, tối đa100 món/đơn, tên/điện thoại/địa chỉ, ngày giao trong365 ngày, chính sách cutoff/công suất hiện có. Thay giá hoặc bỏ công bố trước gửi thì chặn, yêu cầu chọn lại.
- Giới hạn5 đơn/điện thoại/phút và60 đơn công khai/phút toàn cổng. Đây là giới hạn lưu đơn ở DB; không xác minh số điện thoại bằng OTP. Không cung cấp endpoint công khai đọc lịch sử/trạng thái đơn hoặc dữ liệu khách khác.
- Guest dùng customer_id null, store_id null lúc chờ duyệt, thêm guest_name/phone/address; chỉ người có quyền nội bộ đọc được. Giá/tên/mã/ĐVT món được snapshot ở customer_order_items. Dữ liệu và order RLS cũ vẫn giữ; review_order chỉ tạo notification cho đơn có customer_id.

## Cài đặt DEV

Sau034, owner chạy toàn bộ `output/CHIFAA_PATCH_CONG_DAT_HANG_CONG_KHAI_DEV.sql` trong SQL Editor **DEV** → `035_READY`, rồi phát hành frontend. Không chạy lại bootstrap, không chạy migration trên production. Chưa áp SQL cloud từ công cụ.

Sinh lại gói: trong web chạy `npx tsx scripts/package-public-portal-update.ts`. SHA256 gói hiện tại: `451918129bdd19f4837653046ecdd893ccc8bf818c22d14856cc9e6b97fde7e5`.

Kiểm tra local:118 tests, types94 bảng/63 RPC, typecheck/lint/build đạt. Chrome fixture6 cỡ320–1920, số lượng/tổng tiền/món thiếu giá,503/retry, giá đổi, thực đơn trống, duyệt guest gán điểm bán đạt. Ảnh desktop/mobile/duyệt đã xem; báo cáo ignored output/public-portal-design/report.json. Next production local `/portal` HTTP200 có thực đơn/form không chuyển đăng nhập; `/portal/account` trả redirect đăng nhập qua RSC, không render đơn điểm bán. Chưa UAT authenticated Supabase hoặc tải thực đơn cloud thật/chưa deploy.

Rollback frontend về126c89b nếu cần; giữ migration và đơn guest đã nhận. Nếu cần dừng nhận đơn công khai tại DB, owner có thể thu hồi EXECUTE submit_public_order khỏi anon/authenticated theo một migration riêng được duyệt; không xóa đơn/lịch sử.

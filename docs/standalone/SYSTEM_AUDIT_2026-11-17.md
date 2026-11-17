# Kiểm tra hệ thống CHIFAA — 17/11/2026

Cập nhật sau audit: migration 022 đã sửa các lỗi null/version và tổng đơn vượt kế hoạch trong source; migration 021 bổ sung workflow Ki-ốt. Chưa áp cloud từ công cụ. Xem [trạng thái chuyển dự án cũ](LEGACY_PARITY.md). Nội dung bên dưới là bằng chứng tại commit 8e0151f trước các sửa đổi này.

**Kết luận: chưa hoàn thiện tất cả chức năng và chưa đủ bằng chứng để nghiệm thu vận hành đầy đủ.** Mã nguồn đã có các workflow thật, nhưng nhiều màn hình còn tĩnh, một số RPC chưa có UI, và kiểm tra bổ sung phát hiện lỗi nghiệp vụ.

Phạm vi: source `8e0151f`; 20 migrations, 77 bảng public, 24 hàm public. Kiểm tra HTTP online lúc 15:26 ngày 17/11/2026 (Asia/Ho_Chi_Minh). Không ghi dữ liệu cloud, không nhập lịch sử, không thay quyền hoặc gửi email. Không có phiên trình duyệt/tài khoản đăng nhập trong công cụ để kiểm thử giao dịch cloud.

## Kết quả kiểm tra

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| Sinh types, TypeScript, lint, production build | Đạt | Chất lượng build không chứng minh đầy đủ nghiệp vụ |
| Bộ kiểm thử hiện có | 37/37 đạt | PostgreSQL nhúng, Auth stub; chưa bao phủ các lỗi bổ sung bên dưới |
| Chrome fixture | 32 route desktop, 5 màn mobile đạt | Dữ liệu kiểm thử cô lập; không phải đăng nhập/ghi dữ liệu Supabase cloud |
| Domain chính | `/login` 200, manifest 200; CSS có bố cục và font mới | Đã nhận giao diện mới, chưa chứng minh giao dịch |
| Bảo vệ trang | `/app`, `/portal` trả 307 về login khi anonymous | Chưa kiểm thử quyền sau đăng nhập thực |
| Callback không có OAuth code | 307 về login `reason=oauth` | Không phải kiểm thử hoàn tất Google OAuth |
| Supabase Auth settings | 200, Google enabled | Chưa xác nhận tài khoản Admin đang enabled trên cloud |
| API ẩn danh | 7 bảng thử và `my_access` đều 401/42501 | Không thay thế kiểm thử RLS đa tài khoản |
| `admin-invite` Edge Function | OPTIONS trả 404 `NOT_FOUND` | Chưa có function hoạt động ở endpoint được cấu hình |

Các bảng thử ẩn danh: profiles, materials, recipes, customer_orders, cash_ledger, employee_pay_rates, payroll_lines. Không đọc dòng dữ liệu nghiệp vụ.

## Các lỗi đã tái hiện trên PostgreSQL nhúng

Các thử nghiệm bổ sung chạy độc lập với bộ 37 tests, trên database tạm cài toàn bộ migrations. Không thử ghi lên cloud.

| Mức | Phát hiện | Kết quả thực tế | Cần xử lý |
|---|---|---|---|
| P1 | Thiếu kiểm tra phiên bản bắt buộc | `publish_recipe`, `revise_recipe`, `review_order` chấp nhận `p_expected_version = null` | Chặn null trước khi so phiên bản; bổ sung regression test |
| P1 | Duyệt đơn với lựa chọn không hợp lệ | `review_order(..., p_approve=null, p_reason='')` chuyển đơn sang rejected mà không có lý do | Bắt buộc boolean khác null và lý do khi từ chối |
| P1 | Gắn đơn vượt số lượng kế hoạch | Hai đơn mỗi đơn 40 phần đều gắn được vào một kế hoạch chỉ có 50 phần | Kiểm tra tổng các đơn đã gắn + đơn mới; giữ khóa kế hoạch và thử cạnh tranh |

Nguyên nhân lỗi phiên bản: biểu thức `current_version <> null` trả null, nên nhánh `if` không chặn. Các lỗi này vẫn cần người gọi có quyền RPC; bằng chứng trên không cho thấy bỏ qua đăng nhập hoặc nâng quyền.

Nguồn liên quan: `supabase/migrations/202611170007_recipe_publication.sql`, `202611170008_portal_orders.sql`, `202611170015_recipe_revision.sql`. Cần forward migration; không chỉnh âm thầm lịch sử migrations đã cài, không chạy lại bootstrap database.

## Mức triển khai chức năng

Trong 32 mục sidebar phác thảo, **16 mục dùng component có query/RPC thật và 16 mục chỉ có bố cục tĩnh bị khóa**. Một số mục dùng chung component. Đây là số route, không phải phần trăm hoàn thành nghiệp vụ. Toàn bộ nội bộ hiện có 43 đường dẫn: 21 dùng component tương tác và 22 còn tĩnh/chờ workflow. Cổng đặt hàng được tính riêng.

| Nhóm | Đã có trong source | Còn thiếu để vận hành đầy đủ |
|---|---|---|
| Tài khoản/quyền | Google SSR, quyền DB, cấp Admin đầu tiên, màn hình gán quyền | Xác nhận Admin cloud; invite Edge, thu hồi phiên và UAT đa tài khoản |
| Danh mục | 7 danh mục, tạo/sửa, tìm/phân trang, giá vật tư và quy đổi | Quản trị đầy đủ giá/chiết khấu theo điểm bán, liên kết user–store, pay rates, tài khoản quỹ; lookup lớn |
| Công thức | Tạo/sửa phiên bản, công bố, BOM/giá vốn | Sửa lỗi null/version; hoàn thiện nghiệp vụ bao bì và so sánh phiên bản |
| Sản xuất/kho | Ghi một dòng nhập/xuất hoặc sản xuất; xuất định mức atomic; kiểm kê có version | Plan editor, nhiều dòng, chuyển kho/đảo phiếu, kho thành phẩm, lịch sử và cảnh báo thực |
| Đặt hàng | Portal xem giá theo điểm, gửi đơn, lịch sử 50 đơn; nội bộ duyệt | UI cấu hình điểm/giá/quyền; gắn kế hoạch; sửa lỗi review/schedule; UAT trọn luồng |
| Giao hàng/thu hồi/ki-ốt | Schema | Chưa có workflow posting/RPC và UI hoàn chỉnh |
| Doanh thu/đối soát | Schema và aggregate đọc chứng từ đã posted | Chưa có sales posting/UI đầy đủ, điều chỉnh/đảo chứng từ |
| Thu nợ/quỹ/vay/chi phí | RPC `post_payment`, `pay_loan`, `post_expense` | Chưa có màn hình nghiệp vụ sử dụng các RPC; số dư đầu kỳ và hoàn tác |
| Chấm công/lương | RPC `post_attendance`, snapshot pay và schema | Chưa nối UI; chính sách phụ cấp, chốt/trả lương và quỹ |
| Khóa kỳ | RPC `set_accounting_period` | Chưa nối màn hình; chưa kiểm tra race nhiều kết nối cloud |
| Dashboard/báo cáo/chiến lược | Tổng hợp ngày; dữ liệu thiếu hiển thị null | Báo cáo kỳ, biểu đồ/drilldown thực, targets, refresh snapshots; các nguồn sales/finance còn thiếu UI |
| Tài sản/khấu hao | Schema | Workflow và giao diện chưa triển khai đầy đủ |
| Import | Chuẩn hóa/staging CLI, không tự apply | Review/apply DB, đối chiếu và rollback/replay đầy đủ; chưa nhập dữ liệu lịch sử |
| Offline | Public shell và thư viện nháp whitelist | Chưa tích hợp editor/đồng bộ/xử lý xung đột đầy đủ |
| Storage/Realtime | SQL policy, bucket/publication có điều kiện; subscription đơn | Chưa có chứng từ upload/signed URL UI hoàn chỉnh hoặc hosted UAT |

Portal có form thật nhưng chưa tự thiết lập đầy đủ qua UI: cần tài khoản enabled, liên kết `store_users`, món published và giá hiệu lực trong `store_product_prices`. Hiện các bảng cấu hình này chưa có màn hình quản trị đầy đủ. Không coi có trang Portal là đã nghiệm thu đặt hàng thực tế.

Ngoài Admin, các role được tạo tên nhưng seed mặc định chỉ gán toàn quyền cho role Admin. Cần thiết kế quyền role hoặc gán overrides rõ ràng trước khi cấp nhân viên sử dụng; chọn một role không tự bảo đảm có quyền nghiệp vụ.

## Đối chiếu 32 mục sidebar

| Mục | Route | Trạng thái source |
|---|---|---|
| Tổng quan điều hành | `/app` | Component có query/RPC thật; còn cần UAT |
| Dashboard vận hành | `/app/opsdashboard` | Bố cục tĩnh; thao tác bị khóa |
| Chiến lược kinh doanh | `/app/strategy` | Bố cục tĩnh; thao tác bị khóa |
| Danh mục vật tư | `/app/materials` | Component có query/RPC thật; còn cần UAT |
| Danh mục điểm bán | `/app/stores` | Component có query/RPC thật; còn cần UAT |
| Danh mục món bán | `/app/products` | Component có query/RPC thật; còn cần UAT |
| Danh mục nhân viên | `/app/employees` | Component có query/RPC thật; còn cần UAT |
| Bảng chiết khấu | `/app/discounts` | Bố cục tĩnh; thao tác bị khóa |
| Tồn kho hiện tại | `/app/inventory` | Component có query/RPC thật; còn cần UAT |
| Nhập / xuất / kiểm kê | `/app/stockmovements` | Component có query/RPC thật; còn cần UAT |
| Lịch sử kho | `/app/stockhistory` | Bố cục tĩnh; thao tác bị khóa |
| Cảnh báo & bổ sung hàng | `/app/reorder` | Bố cục tĩnh; thao tác bị khóa |
| Công thức món ăn | `/app/recipes` | Component có query/RPC thật; còn cần UAT |
| Công thức nhân / sốt | `/app/batches` | Component có query/RPC thật; còn cần UAT |
| Công thức cơm chín | `/app/rice` | Component có query/RPC thật; còn cần UAT |
| Định mức bao bì | `/app/packaging` | Component có query/RPC thật; còn cần UAT |
| Tổng hợp giá vốn | `/app/cost` | Component có query/RPC thật; còn cần UAT |
| Kế hoạch & chốt sản xuất | `/app/production` | Component có query/RPC thật; còn cần UAT |
| Nhu cầu nguyên liệu | `/app/requirements` | Bố cục tĩnh; thao tác bị khóa |
| Kiểm kê thực tế | `/app/counts` | Component có query/RPC thật; còn cần UAT |
| Đối chiếu hao hụt | `/app/variance` | Bố cục tĩnh; thao tác bị khóa |
| Tiêu hao & kiểm tra chênh lệch | `/app/consumption` | Bố cục tĩnh; thao tác bị khóa |
| Tổng quan nhập liệu | `/app/entry` | Bố cục tĩnh; thao tác bị khóa |
| 01 · Kiểm kho | `/app/entry-stock` | Component có query/RPC thật; còn cần UAT |
| 02 · Doanh thu & thanh toán | `/app/sales` | Bố cục tĩnh; thao tác bị khóa |
| 03 · Chấm công 3 bộ phận | `/app/attendance` | Bố cục tĩnh; thao tác bị khóa |
| 04 · Sản xuất thêm – Thu hồi | `/app/entry-production` | Component có query/RPC thật; còn cần UAT |
| 05 · Kế hoạch & mục tiêu | `/app/targets` | Bố cục tĩnh; thao tác bị khóa |
| 06 · Khoản vay | `/app/loans` | Bố cục tĩnh; thao tác bị khóa |
| 07 · Công nợ | `/app/receivables` | Bố cục tĩnh; thao tác bị khóa |
| 08 · Sổ quỹ thu – chi | `/app/cash` | Bố cục tĩnh; thao tác bị khóa |
| 09 · Bảng lương theo bộ phận | `/app/payroll` | Bố cục tĩnh; thao tác bị khóa |

Các mục thêm ngoài phác thảo: Đơn vị, Bộ phận, Danh mục kho, Đơn hàng và Tài khoản có component tương tác. Giao hàng, Thu hồi, Ki-ốt, Báo cáo, Nhập dữ liệu cũ và Nhật ký hiện là màn hình chờ workflow. Nhật ký đã được ghi trong DB nhưng chưa có UI xem nhật ký hoàn chỉnh.

## Thứ tự cần hoàn thiện

1. Sửa các lỗi null/version và tổng số lượng gắn kế hoạch bằng forward migration + regression tests.
2. Xác nhận Google login/Admin cloud; chạy UAT hai tài khoản nội bộ và hai điểm bán, kiểm tra thu hồi quyền.
3. Bổ sung UI cấu hình giá, chiết khấu, liên kết điểm bán, quỹ và pay rates để có thể thiết lập hệ thống bằng ứng dụng.
4. Hoàn thiện luồng đặt hàng → kế hoạch → sản xuất → giao/thu hồi → doanh thu → công nợ → thu tiền; kiểm tra đối soát số liệu xuyên suốt.
5. Hoàn thiện lương, báo cáo, tài sản, import/offline/chứng từ; kiểm tra concurrency, hiệu năng mạng, backup/restore.

## Bằng chứng tại workspace

- `output/system-audit-verify.txt`: bộ kiểm tra đầy đủ.
- `output/system-audit-online.json`: trạng thái HTTP online, không chứa khóa.
- `output/system-audit-inventory.json`: đối chiếu route/RPC source.
- `output/system-audit-null-probe.ts` và `.json`: cách tái hiện 5 trường hợp bổ sung trên PostgreSQL nhúng.
- `output/system-audit-design-check.txt`, `output/design-parity/report.json`: kiểm tra layout cô lập.

Kiểm tra lần này không sửa runtime, không deploy migrations và không thay dữ liệu cloud. Các lỗi phát hiện vẫn cần được sửa; báo cáo không phải xác nhận hệ thống đã hoàn tất.

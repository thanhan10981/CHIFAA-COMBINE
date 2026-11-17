# Đối chiếu dự án cũ và bản Next.js/Supabase

Nguồn chuẩn cho cấu trúc menu: `src/client/navigation.js` và `src/shared/schema.js`. Đây là dự án cũ đang có trong repository, không chỉ file phác thảo HTML. Mã Apps Script cũ được giữ nguyên làm tư liệu; Next.js không gọi Apps Script hoặc Sheets lúc chạy.

## Menu

Menu mới lấy đúng thứ tự, tên và nhóm của dự án cũ: **7 nhóm, 37 mục**. Dữ liệu tĩnh nằm trong `web/features/design/workspace-nav.json`; kiểm thử đối chiếu trực tiếp với hai file nguồn để ngăn lệch về sau.

- DANH MỤC.
- KHO & TỒN KHO, có **Thu hồi & ki-ốt** sau Lịch sử kho.
- CÔNG THỨC.
- SẢN XUẤT & NGUYÊN LIỆU.
- NHẬP LIỆU, có **Tài sản & khấu hao**.
- KHÁCH HÀNG, có **Đơn đặt hàng**.
- QUẢN TRỊ HỆ THỐNG, có **Tài khoản & phiên đăng nhập**, **Nhật ký & đồng bộ**.

Bỏ nhóm tự thêm “Quản trị & tiện ích” và danh sách icon bánh răng. Các trang cấu hình đã có vẫn truy cập được qua tab trong phân hệ: Vật tư/Đơn vị, Nhân viên/Bộ phận, Kho/Danh mục kho, Đơn hàng/Giao hàng/Thu hồi, Sổ quỹ/Tài khoản quỹ, Nhật ký/Import, Dashboard/Báo cáo. Chỉ hiện tab được cấp quyền. Giữ Cổng đặt hàng cả desktop và mobile; giữ font Be Vietnam Pro theo yêu cầu nâng cấp sau phác thảo.

## Chức năng vừa chuyển

| Dự án cũ | Bản mới | Bằng chứng và giới hạn |
|---|---|---|
| `kioskReport_`, `kioskWorkflow_` và `renderKiosk` | Migration 021, `kiosk_report`, `kiosk_action`, `features/operations/kiosk.tsx` | Duyệt → thực nhận/từ chối → bán → hoàn tác theo thứ tự; idempotency/version/period/permissions trong DB |
| Số lượng thu hồi trên phiếu bán | Lô liên kết `sales_lines` của `sales_documents.status=posted` | Giữ version nguồn, chặn phiếu nguồn đã đổi; không tự nhập dữ liệu cũ |
| Duyệt không đồng nghĩa thực nhận | Lô `approved` không vào tồn; `received` mới vào tồn | Kiểm thử 100 giao/80 bán/10 thu hồi/10 điểm bán chịu; chỉ nhận 10 một lần |
| Bán theo tồn thực nhận | Ghi số bán theo lô, chặn vượt tồn và bán hồi tố sau lần bán mới hơn | Khóa nguồn/lô và giao dịch atomic, giá vốn theo lô chưa xác định vẫn null |
| Tiền mặt/ngân hàng trên phiếu bán cũ | Phiếu bán + công nợ + phiếu thu/phân bổ + sổ quỹ cùng transaction | Tiền thu không được vượt doanh thu; chọn quỹ đúng loại; phần chưa thu giữ công nợ. Đây là cách hạch toán trong schema mới, không sao chép journal Sheets |
| Hoàn tác giữ lịch sử | Đảo phiếu thu/quỹ và doanh thu, điều chỉnh công nợ, khôi phục số lượng | Chặn hoàn tác khi có khoản thu/điều chỉnh khác; không xóa phiếu |
| Nhật ký | `ActivityLog`, đọc `audit_logs` qua RLS, phân trang 25 | Không tự gọi đây là đã chuyển backup/restore/tác vụ đồng bộ cũ |
| Thiết lập quỹ | Catalog `bank_accounts` và tab trong Sổ quỹ | RPC gán quyền cash create/edit; không đổi loại quỹ sau khi có lịch sử |

Quyền Ki-ốt: xem cần `kiosk/view`, `stores/view`, `products/view`; xử lý cần `kiosk/approve`; bán cần thêm `kiosk/create`, `sales/create`, `receivables/create`. Khi thu tiền cần `cash/create`, `payments/approve` và quyền đọc quỹ để chọn trên UI. Chọn kho nhận cần quyền xem danh mục kho. Hoàn tác cần `admin/manage`; hoàn tác bán thêm quyền sales/approve và receivables/edit. Lịch sử bán trong báo cáo hiện chỉ trả khi có audit/view. Database luôn kiểm tra lại; hiện nút không tự cấp quyền.

Các lỗi đã tái hiện ở lần audit được sửa bằng migration 022: chặn expected version null cho publish/revise/review, chặn approval null và tính tổng đơn đã gắn vào kế hoạch. Test hai đơn 40 phần/kế hoạch 50 phần giờ chặn đơn thứ hai; replay không giữ chỗ lần hai.

## Cài bản cập nhật trên DEV hiện có

Chạy `npm run db:kiosk-update` trong `web` để tạo `output/CHIFAA_PATCH_KIOSK_DEV.sql`. Gói gồm migrations 021 và 022 trong một transaction, yêu cầu nền 020 và dừng nếu đã cài. Chạy toàn bộ file bằng SQL Editor role postgres trên **DEV đang dùng**. Không chạy lại `CHIFAA_SUPABASE_DEV.sql`; không xóa project hoặc bảng. Script này không nhập JSON/workbook cũ hoặc reset quyền.

SQL Editor không tự đăng ký migration history cho CLI. Trước lần `db push` sau này cần đối chiếu/repair lịch sử theo ONLINE_DEPLOY.md. Gói cập nhật đã có kiểm thử áp lên nền 20 migrations, giữ bản ghi hiện có, từ chối replay và rollback cả bảng/cột/function khi lỗi. Công cụ chưa chạy gói này trên Supabase cloud; màn hình Ki-ốt báo rõ khi thiếu RPC.

## Phần dự án cũ còn chưa chuyển đủ

Không coi việc phục hồi menu là hoàn tất toàn bộ chức năng. Các luồng sau vẫn cần tiếp tục chuyển và nghiệm thu:

- Nhập liệu NEW/APPEND/CORRECT với preview/digest đầy đủ; sản xuất nhiều dòng và hoàn tác các chứng từ khác.
- Tạo/gỡ liên kết kế hoạch bằng UI, phân bổ nhiều món và lifecycle giao hàng.
- Màn hình posting doanh thu/đối soát đầy đủ để tạo nguồn thu hồi từ ứng dụng; giá và chiết khấu theo điểm bán, liên kết user–store.
- Chấm công, phụ cấp, bảng lương, thu nợ/trả vay, chi phí và khóa kỳ: nhiều RPC đã có nhưng UI chưa chuyển đủ.
- Tài sản/khấu hao, báo cáo, strategy, Excel/import preview–apply, backup/restore, pending journal, đồng bộ và thu hồi phiên.

Luồng Ki-ốt mới cần phiếu doanh thu đã posted có `returned>0`. Chưa có dữ liệu lịch sử được chuyển tự động và chưa có UI posting doanh thu đầy đủ; không tạo nguồn thu hồi giả để lấp bảng. Lô/hạn dùng/định giá giá vốn chưa được nghiệm thu.

## Kiểm tra

- `npm run verify`: 47 kiểm thử Next/PostgreSQL, types, TypeScript, lint và build.
- `npm run test:design`: 37 đường dẫn menu cũ + 4 trang cấu hình; 6 màn mobile; kiểm tra vị trí menu, dialog duyệt/bán Ki-ốt và tạo tài khoản quỹ. Fixture chặn mạng ngoài, không ghi cloud.
- `node --test --test-isolation=none tests/kiosk.test.mjs tests/order-planning.test.mjs tests/entry.test.mjs` từ root: 15 kiểm thử tham chiếu cũ trên mock, không phải kiểm thử backend mới/cloud.

Chưa có kiểm thử Google login/giao dịch nghiệp vụ authenticated cloud, race nhiều kết nối hoặc nghiệm thu toàn hệ thống. Không thay workbook/dữ liệu Apps Script cũ.

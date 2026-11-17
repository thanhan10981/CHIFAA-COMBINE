# CHIFAA COMBINE — MASTER PROMPT CHO CODEX
## Xây lại hoàn chỉnh bằng Vercel + Supabase; KHÔNG dùng Google Sheets / Apps Script vận hành

### 0. Vai trò, nhiệm vụ và quyền hạn

Bạn là kiến trúc sư phần mềm + senior full-stack engineer + chuyên gia PostgreSQL, Supabase, an ninh ứng dụng và quản trị sản xuất thực phẩm/kế toán quản trị. Hãy **thực sự lập trình** hệ thống CHIFAA COMBINE mới, không chỉ đưa kế hoạch hay dựng giao diện demo.

- Đọc repository, các tài liệu đặc tả/handoff, file workbook gốc nếu được cung cấp, mã nguồn Apps Script/HTML cũ nếu có, và logo CHIFAA chính thức; dùng chúng làm tư liệu phân tích, không bê nguyên các mẫu kiến trúc chậm/lỗi sang dự án mới.
- Xây **ứng dụng mới độc lập**, có thể dùng repository mới. Chỉ sửa dữ liệu DEV; không ghi hoặc xóa dữ liệu cũ/production.
- Tự chia task, triển khai tuần tự, kiểm thử, ghi tiến độ; không dừng để hỏi xác nhận sau mỗi task. Nếu thiếu quyền, bí mật hoặc quy tắc tài chính chưa được quyết định, ghi blocker trong `DECISIONS_REQUIRED.md`, làm tiếp phần độc lập; không tự bịa công thức.
- Tuyệt đối không tuyên bố đã deploy, đã chạy E2E hoặc đã kết nối Supabase nếu môi trường không cho phép thực hiện/kiểm chứng.
- Không tự động kích hoạt thanh toán, mở public production, chuyển dữ liệu thật hoặc phá hủy database. Những bước này phải được chủ sở hữu cho phép riêng.

### 1. Kiến trúc và công nghệ BẮT BUỘC

- **Frontend:** Next.js App Router + React + TypeScript + Tailwind CSS; triển khai **Vercel**. Dùng chính logo CHIFAA được cung cấp; tên ứng dụng `CHIFAA COMBINE`.
- **Backend:** Supabase Edge Functions (TypeScript/Deno) cho workflow đặc quyền, webhook và orchestration; PostgreSQL functions/RPC cho giao dịch cần atomic; Supabase Data API + RLS cho CRUD/query phù hợp. Không đẩy mọi truy vấn thường sang Edge Functions.
- **Database:** Supabase PostgreSQL, **nguồn dữ liệu chuẩn duy nhất**. Schema chuẩn hóa, migrations SQL, foreign keys, unique/check constraints, index, transaction, audit và version.
- **Identity:** Supabase Auth (Google OAuth cho nội bộ; tùy chọn email OTP/password theo vai trò khách hàng); RLS + RBAC theo module/action ở server và database.
- **Đồng bộ:** Supabase Realtime có kiểm soát cho đơn hàng và những phần cần realtime; TanStack Query cho query caching/invalidation; Zustand/React Context cho UI state.
- **Lưu file:** Supabase Storage private bucket + signed URL có thời hạn + policy cho chứng từ/ảnh; không lưu ảnh trong PostgreSQL.
- **Offline:** PWA caching app shell; IndexedDB cho dữ liệu danh mục đã cho phép và nháp nhập liệu phù hợp; không khẳng định đơn được đặt thành công hoặc phiếu tài chính đã chốt khi chỉ nằm offline.
- **KHÔNG dùng** Google Apps Script, Google Sheets, Spreadsheet API, IMPORTRANGE, AppSheet hoặc Google Drive làm backend hay database lúc chạy. Google Sheets/XLSX được phép làm **nguồn nhập một lần, file xuất, đối chiếu hoặc bản backup ngoại tuyến**, không có đồng bộ phụ thuộc Sheets trong runtime.
- Sử dụng VND bằng `bigint` (đơn vị đồng) hoặc `numeric` có quy tắc làm tròn rõ; số lượng và định mức dùng `numeric`, **không dùng float cho tiền**. Lưu timestamp UTC, hiển thị và báo cáo theo `Asia/Ho_Chi_Minh`.
- Cấu hình vùng Supabase gần Việt Nam (ví dụ Singapore nếu có), nhưng đo latency thực tế trước khi kết luận.

### 2. Cấu trúc ứng dụng, giao diện, quyền

Tách 2 vùng độc lập trong cùng sản phẩm, có thể chung repository nhưng layout/router và quyền khác nhau:

**/app/** nội bộ: Admin, kế toán, quản lý, sản xuất, kho, bán hàng; dashboard, báo cáo, nghiệp vụ, phân quyền, nhật ký.

**/portal/** điểm bán/khách hàng: đăng nhập riêng, xem catalog được công bố, đặt hàng theo ngày giao, xem lịch sử/trạng thái/đối soát được cấp; KHÔNG thấy dữ liệu lương, giá vốn, công thức bí mật, công nợ khách khác.

Giữ phong cách giao diện CHIFAA: sidebar dark navy, điểm nhấn cam, card bo tròn, icon SVG, dropdown gọn, đủ không gian, chuyên nghiệp; responsive mobile/tablet/desktop; bảng có tìm kiếm/lọc/phân trang; chuyển tab mượt, skeleton loading nhẹ, biểu đồ dễ hiểu. Không dùng nội dung demo giả làm dữ liệu thực, không có nhãn v16/v17 hoặc lời quảng cáo dư thừa. Nếu tài sản logo gốc chưa có, dùng placeholder được dán nhãn rõ và ghi blocker, không tự vẽ lại.

RBAC server-side: Admin quản lý user/role/permission; kế toán theo module; giám sát sản xuất/kho; điểm bán chỉ thấy dữ liệu của mình. Hỗ trợ quyền `view/create/edit/approve/export/manage`. Admin có thể thu hồi phiên và kiểm tra nhật ký. Mong muốn một phiên Admin duy nhất: chỉ bật nếu cơ chế server-side thu hồi phiên đã hoàn thiện; phải thử các tình huống đăng nhập song song. Không có hard-coded email Admin trong source; dùng biến cấu hình để mời/tạo admin ban đầu.

### 3. Thiết kế Database có thể triển khai thực tế

Tạo migrations trong `supabase/migrations/`, sinh kiểu TypeScript từ schema. Đặt tên nhất quán, mở rộng theo nhu cầu thực, tối thiểu bao gồm:

- **Hệ thống:** `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `sessions_or_devices` (nếu cần), `audit_logs`, `app_settings`, `idempotency_keys`, `import_jobs`, `import_errors`, `data_versions`.
- **Danh mục:** `materials`, `material_units`, `unit_conversions`, `suppliers`, `products`, `stores`, `store_users`, `store_product_prices`, `store_discounts`, `employees`, `departments`, `price_histories`.
- **Công thức:** `recipes`, `recipe_versions`, `recipe_items` (item có thể là nguyên liệu hoặc một công thức con), `production_yields`, `product_recipe_links`, `packaging_rules`; phát hiện vòng lặp công thức.
- **Sản xuất:** `production_plans`, `production_plan_lines`, `production_batches`, `production_batch_lines`, `production_defects`, `production_waste`, `ingredient_requirement_snapshots`.
- **Kho:** `warehouses`, `inventory_movements`, `inventory_movement_lines`, `stock_counts`, `stock_count_lines`, `stock_reservations` nếu cần; sổ chuyển động kho là nguồn chuẩn, tồn là số dẫn xuất/snapshot kiểm tra được.
- **Đơn hàng:** `customer_orders`, `customer_order_items`, `order_status_history`, `deliveries`, `delivery_items`, `store_returns`, `store_return_items`, `kiosk_sales`, `kiosk_sale_items`.
- **Doanh thu/kế toán quản trị:** `sales_documents`, `sales_lines`, `payment_receipts`, `cash_ledger`, `bank_accounts`, `receivables`, `debt_adjustments`, `loans`, `loan_payments`, `expenses`, `fixed_assets`, `depreciation_entries`, `accounting_periods`.
- **Nhân sự:** `attendance_shifts`, `attendance_allowances`, `payroll_periods`, `payroll_lines`, `employee_pay_rates`.
- **Kế hoạch/điều hành:** `targets`, `target_periods`, `daily_kpi_snapshots`, `monthly_kpi_snapshots`, `report_refresh_jobs`, `notifications`.

Đây là cấu trúc định hướng: trước khi migration, kiểm tra yêu cầu và tách/gộp bảng hợp lý nhưng phải thể hiện bằng sơ đồ ERD và tài liệu. Mỗi bảng nghiệp vụ có `id UUID`, liên kết FK, thời gian tạo/cập nhật, người thao tác, trạng thái, số phiên bản nếu là bản ghi được chỉnh sửa. Dùng UNIQUE thích hợp để chặn trùng và CHECK cho số lượng/tiền; tránh cascading delete gây mất lịch sử. Không dùng JSONB làm nơi đổ toàn bộ quan hệ dữ liệu có thể chuẩn hóa. Với dữ liệu đã chốt dùng chứng từ điều chỉnh/hủy có tham chiếu, không `DELETE` âm thầm.

Migrations phải chạy được từ DB trống; có seed dữ liệu minh họa riêng DEV, idempotent, dễ reset; không bao giờ tự động seed dữ liệu demo vào production. Khóa ngoại, index (ngày+điểm bán, mã nguyên liệu, order status, employee+shift date, các trường tra cứu), partition chỉ khi benchmark cần.

### 4. Bảo mật Supabase: bất khả nhượng

- Enable RLS trên **mọi bảng được API expose**; policy phân biệt admin/kế toán/nhân viên/khách và phân quyền theo `store_id`, `user_id`, module/action; dùng `auth.uid()`, grants tối thiểu; deny-by-default.
- Viết SQL test RLS cho `anon`, `authenticated` và từng vai trò; kiểm tra đặc biệt không thể truy cập lương, giá vốn hoặc đơn của khách khác.
- **Service role/secret key chỉ ở Edge Functions/server**, không bao giờ trong `NEXT_PUBLIC_*` hoặc bundle client. Client chỉ dùng publishable/anon key + session hợp lệ.
- Tránh `SECURITY DEFINER` lạm dụng; mọi hàm đặc quyền cần kiểm tra người gọi/role, `search_path` cố định, khóa phạm vi và thử privilege escalation. Không tin vào userId, role hoặc giá/chiết khấu do client tự gửi.
- Xác thực server-side đúng chuẩn Supabase/Next SSR hiện hành; bảo vệ session/cookie, redirect OAuth, CSRF khi cần, CORS allowlist, input validation (Zod), rate limit login/order, chống spam, bảo vệ export/Storage, audit hành động nhạy cảm.
- Tách môi trường DEV và PROD bằng hai dự án Supabase; không dùng DB PROD cho test.

### 5. Quy tắc nghiệp vụ CHIFAA cần triển khai

**5.1 Danh mục & giá**: Mã SP, tên món, nhóm, đơn vị, giá bán theo điểm bán, chiết khấu riêng, điều kiện hiệu lực; vật tư có mã/tên/quy cách/đơn vị mua/đơn vị sử dụng/giá mua/nhóm/tồn tối thiểu. Quy đổi GR→KG, vỉ→quả, túi→lá, chai/can→gram hoặc lít khi quy cách và **cơ sở đơn giá được xác thực**. Không suy đoán 1 lít = 1kg. Dữ liệu không đủ phải `needs_verification`, không coi thiếu đơn giá là 0. Các quy cách đã nêu trong tài liệu trước: trứng 30 quả/vỉ; rong biển 100 lá/túi; dầu mè 250 g/chai; dầu hào 2,2 kg/can; dầu ăn 5 lít/can; đũa chưa rõ số đôi/túi. Đây là đầu mối để kiểm tra workbook, không là lý do suy ra đơn giá.

**5.2 Công thức đa tầng**: Mỗi món một công thức, có nhân/sốt/phần chuẩn bị riêng (nhân gà teriyaki, sốt gà phô mai…), định lượng mỗi mẻ và mỗi phần, hệ số thành phẩm (ví dụ tham chiếu 1 kg gạo sống → 2,5 kg cơm chín, cấu hình được), bao bì, quản lý phiên bản và ngày hiệu lực. Chạy tính BOM đệ quy không chu kỳ, giá vốn nguyên liệu theo giá hiệu lực; tạo nhu cầu nguyên liệu theo sản lượng của nhiều món, cộng theo mã; không đánh đồng định mức với tiêu hao thực tế.

**5.3 Sản xuất & kế hoạch**: Sản xuất đêm, giao sáng hôm sau; kế hoạch theo ngày giao khác ngày sản xuất; `số chính + sản xuất thêm = tổng SX thực tế`; lỗi sản xuất, hủy, số đạt. Cho nhập theo ngày, tuần, tháng, quý; lỗi % có mẫu số rõ. Đơn khách được duyệt có thể tạo/điều chỉnh kế hoạch nhưng chống cộng trùng khi kế hoạch đã nhập tay.

**5.4 Nhu cầu & kho**: Nhu cầu định mức từ công thức và kế hoạch; phiếu nhập, xuất, chuyển, trả, kiểm kê; tồn đầu + nhập − xuất ± điều chỉnh = tồn cuối (có kiểm tra). Hao hụt = lượng thực dùng − lượng định mức; % trên lượng định mức khi khác 0. Cảnh báo tồn tối thiểu; ô chưa thiết lập không coi 0. Khi thay đổi công thức/giá phải bảo toàn giá vốn/định mức của các chứng từ lịch sử bằng snapshot/version.

**5.5 Đặt hàng online & điểm bán**: Portal khách đăng nhập, chỉ xem catalog và giá được công bố cho mình; chọn món, số lượng, ngày giao, ghi chú; kiểm tra cutoff/công suất khi đã có cấu hình; tránh đơn trùng do bấm nhiều lần, có trạng thái `draft → submitted → approved/rejected → scheduled → fulfilled/cancelled` và lịch sử. Kế toán/Admin nhận đơn mới realtime, duyệt/từ chối. Không tự ghi nhận doanh thu khi chỉ mới nhận đơn.

**5.6 Giao hàng – trả hàng – ki-ốt**: Ví dụ giao 100, bán 80, nhận thu hồi 10, điểm bán chịu 10: không ép 10 còn lại thành `đã bán` nếu chưa có quy định hạch toán; theo dõi rõ các loại số lượng, trách nhiệm và đối soát. Hàng thu hồi chuyển sang tồn ki-ốt theo chứng từ nhập; chỉ tạo doanh thu ki-ốt khi bán thực tế. Giá hỗ trợ thu hồi **khác** giá bán. Không tính trả hàng/thu hồi và doanh thu hai lần. Những quy tắc doanh thu của phần `điểm bán tự chịu` và giảm trừ theo giá hỗ trợ chưa chốt, phải tạo `DECISIONS_REQUIRED.md`, để workflow khác chạy được nhưng không tự ghi sổ theo giả định.

**5.7 Doanh thu – chiết khấu – thanh toán**: Đơn vị mỗi ngày/điểm bán/món: giao, bán, trả, tự chịu, giá bán, chiết khấu, hỗ trợ thu hồi, công nợ, tiền mặt/chuyển khoản. Doanh thu thuần = doanh thu bán hàng sau chiết khấu và các khoản giảm trừ **hợp lệ**, trước chi phí; không đồng nhất doanh thu thuần với thực thu hoặc lợi nhuận. Thu nợ cũ không làm tăng doanh thu kỳ hiện tại. Có điều chỉnh/đối soát riêng, audit. Ví dụ 100 cái × 15.000 đ, giảm 15% → gross 1.500.000, chiết khấu 225.000, doanh thu sau chiết khấu 1.275.000 (chưa xét giảm trừ khác).

**5.8 Nhập liệu 4 chế độ**: Mới, nhập bù ngày cũ, nhập bổ sung, sửa/điều chỉnh. Ví dụ ban đầu 100 → bổ sung +30 = 130; sửa thành 90 phải ra 90 theo phạm vi chỉnh sửa, **không** cộng thêm 90. Giao dịch đã khóa kỳ thì lập phiếu điều chỉnh có audit; không cập nhật âm thầm. Hỗ trợ dữ liệu nửa ngày hoặc nhiều ca, không tạo trùng.

**5.9 Chấm công/lương**: Nhân viên 3 nhóm SX/VP/BH, giờ vào/ra qua ngày: 23:00→07:00 = 8 h, tới 08:00 = 9 h, tới 09:00 = 10 h. Lương giờ theo hiệu lực và snapshot; phụ cấp mặc định, phụ cấp phát sinh/ngày, hỗ trợ, tạm ứng, khấu trừ, tổng theo kỳ; ngăn cộng phụ cấp 2 lần. Năng suất chỉ lấy giờ công nhân viên **Sản xuất** = số phần sản xuất / giờ công SX.

**5.10 Tài chính**: Công nợ theo điểm bán, đối soát thu tiền, sổ tiền mặt/ngân hàng, khoản vay/gốc/lãi, chi phí VP/marketing/cố định, tài sản/khấu hao; không ghi trùng giữa doanh thu và tiền thu, không nhầm cashflow với P&L; bất kỳ số dư tài chính nào cũng truy nguyên được từ chứng từ.

**5.11 Kế hoạch & ngưỡng**: Mục tiêu cấu hình theo kỳ và có ngày hiệu lực. Food Cost tối đa **32,2% doanh thu thuần**; lao động SX tối đa **15% doanh thu thuần**; chỉ tiêu lỗi SX tham chiếu 1%, hủy điểm bán 2%, tiền mặt+ngân hàng tối thiểu 15 triệu VND (các ngưỡng còn lại theo cấu hình/đối chiếu tài liệu). Xanh/vàng/đỏ/xám, thiếu dữ liệu là `N/A` không mặc định 0. Phần chênh ngân sách lao động chỉ là **khả năng thưởng tham khảo**, không tự quyết định thưởng. Giá trị ví dụ của tháng cũ chỉ là dữ liệu lịch sử/DEV, không hardcode thành KPI hiện tại.

**5.12 Dashboard vận hành**: Tổng quan doanh thu hôm nay/hôm qua, cùng thứ tuần trước, tuần trước/tuần này (thứ hai–chủ nhật), mục tiêu doanh thu ngày, giờ công SX hôm nay/tháng, năng suất SX hôm nay/tháng, lỗi tháng & trần mục tiêu, tồn tối thiểu, hàng thu hồi, công nợ, food cost, labor cost. Lọc ngày/tuần/tháng/quý/năm; mọi KPI và chart có drill-down tới chứng từ nguồn. Không tạo số giả thay dữ liệu thật.

**5.13 Báo cáo sếp & chiến lược**: KPI doanh thu thuần, dòng tiền, food cost, lương SX, chi phí VP, lợi nhuận, chênh KPI, top điểm bán/món, tỷ lệ trả hàng/hủy, danh sách cảnh báo, hòa vốn, P&L 12 tháng, cơ cấu chi phí/100đ doanh thu, giả lập kịch bản tăng giá/sản lượng/giảm hủy. Phải làm rõ dữ liệu lịch sử hay dự báo, công thức tính và thời điểm cập nhật.

### 6. Truy vấn nhanh & hiệu năng mục tiêu

- Không có một `bootstrap` tải tất cả dữ liệu. Tải session/permissions và Dashboard trước; module còn lại tải theo nhu cầu.
- TanStack Query cache/prefetch, cursor/page pagination, tìm kiếm có index, server-side filters/sort; select đúng cột; tránh N+1; dùng SQL VIEW/materialized summary hoặc bảng snapshot có invalidation chính xác cho KPI nặng.
- Những bản ghi nhỏ chuyển tab đã cache: mục tiêu UI dưới 200 ms. Dashboard có dữ liệu ưu tiên trong 1–2 s ở điều kiện mạng thông thường là **mục tiêu đo thử, không hứa chắc**.
- Realtime chỉ theo dõi bảng/event cần thiết và lọc đúng điểm bán/nhân viên; cleanup subscriptions. Tránh realtime toàn bộ transaction/cash ledger.
- Không để chuyển tab bị khóa do API; skeleton, lỗi/retry/cancel, optimistic UI có rollback khi phù hợp. Chỉ thông báo `Đã lưu` sau khi DB xác nhận.
- Benchmark màn hình Dashboard, CRUD vật tư, 10 người nội bộ và nhiều khách đặt hàng; đo query plan/index, API p50/p95, số request, bundle sizes và mức dùng gói Free.

### 7. UX offline vừa đủ, không phá tính đúng đắn

PWA cache app shell và danh mục được cấp quyền; IndexedDB cho draft kiểm kho/nhập sản lượng/chấm công phù hợp. Queue sync có idempotency + kiểm tra conflict + trạng thái `Chưa gửi / Đang đồng bộ / Đã đồng bộ / Xung đột`. Không tự động offline-commit đơn đặt hàng, duyệt đơn, công nợ, thu tiền, khóa sổ, lương; những phần này phải nhận xác nhận online. Xóa dữ liệu nhạy cảm trên thiết bị khi logout theo chính sách; không giữ token nhạy cảm không được bảo vệ trong cache.

### 8. Nhập dữ liệu từ hai workbook cũ (CHỈ 1 LẦN)

Nguồn đầu vào nếu file được cung cấp:
- `DASHBOARD  VẬN HÀNH CHIFAA..xlsx`
- `DASHBOARD KẾ TOÁN CHIFAA.xlsx`

Đây là **nguồn tham khảo và nhập lịch sử**, không phải database runtime.

- Đọc sheet, header, quy cách, công thức, đơn vị, số liệu, tham chiếu lỗi; tạo `DATA_MAPPING.md` liệt kê sheet→table→field, kiểu, phép chuyển, mức tin cậy.
- Không tự coi ô `#REF!`, lỗi công thức hoặc ô trống là số 0; không dùng giá trị demo thay cho dữ liệu thật.
- Tạo công cụ import XLSX/CSV riêng trên DEV: validate → preview → báo lỗi/chênh lệch → staging → duyệt → transaction import. Có idempotency để import lại không sinh trùng.
- Giữ original file bất biến; không nối Google Sheets realtime.
- Đối chiếu tổng doanh thu, tồn, công nợ, mã nguyên liệu, đơn vị, nhân viên và tỷ lệ tính; với hàng không thể xác minh, đánh cờ `needs_review` và báo danh sách.
- Chỉ chuyển dữ liệu thật vào PROD khi chủ sở hữu xác nhận mapping và báo cáo đối chiếu.

### 9. Cách chia việc và thứ tự bắt buộc

**P0 Audit:** đọc code/tài liệu, map yêu cầu, kiểm tra logo, báo missing assets, lập ERD, backlog và tiêu chí nghiệm thu.

**P1 Foundation:** Next.js App Router, UI shell, cấu hình Supabase dev, Auth, RLS, migrations, role permissions, layout admin + portal, `.env.example`, CI/lint/typecheck.

**P2 Danh mục & công thức:** vật tư, đơn vị, quy cách, món, điểm bán, giá/chiết khấu, nhân viên, phiên bản công thức, BOM và giá vốn.

**P3 Nghiệp vụ vận hành:** kế hoạch đơn hàng, nhu cầu nguyên liệu, SX chính/thêm/lỗi/hủy, kho, kiểm kê, thu hồi/ki-ốt.

**P4 Khách đặt hàng:** catalog, giá theo điểm bán, order status, duyệt đơn, notification realtime, chống trùng và phân quyền isolation.

**P5 Doanh thu/kế toán/nhân sự:** sales, payments, AR, tiền mặt/ngân hàng, chi phí, khoản vay, tài sản, ca công, phụ cấp, payroll.

**P6 Dashboard:** snapshot, mục tiêu, dashboard vận hành, báo cáo điều hành, chiến lược, biểu đồ, lọc kỳ.

**P7 Migration + offline:** import/đối chiếu workbook, PWA nháp offline, kiểm tra sync, export Excel/CSV.

**P8 Hardening + deploy:** RLS tests, SQL integration tests, E2E, benchmark, backup, restore drill, tài liệu vận hành, deploy preview. Production deploy chỉ khi được cho phép.

Sau mỗi hạng mục thực thi check type, lint, test, build; đánh dấu task done chỉ khi mã chạy và có chứng cứ. Không ngừng ở wireframe/demo. Nếu chưa có Supabase credentials, vẫn tạo migration/seed, local setup scripts, test harness và UI mock riêng DEV nhưng gắn rõ `Not connected` và không tuyên bố tích hợp xong.

### 10. Kiểm thử chấp nhận bắt buộc

1. Đăng nhập Google nội bộ đúng quyền và đăng xuất sạch.
2. Kế toán không đọc được payroll hoặc modules chưa cấp quyền.
3. Khách A không đọc được đơn, giá, công nợ của khách B, kể cả bằng REST API sửa ID.
4. Không truy cập được service role hay hidden secret từ trình duyệt.
5. Danh mục vật tư đơn vị/quy đổi nhập đúng, trường thiếu giá cảnh báo.
6. Recipe nhiều tầng tính BOM chuẩn và ngăn vòng lặp.
7. Gạo sống/cơm chín dùng conversion được cấu hình, không hardcode sai.
8. Sản xuất chính + thêm đúng tổng; lỗi có mẫu số đúng.
9. Đơn khách duyệt chỉ đưa vào kế hoạch 1 lần.
10. Giao 100 bán 80 thu hồi 10 tự chịu 10: số lượng và tồn ki-ốt chính xác, không tự kết luận doanh thu phần tự chịu.
11. Thu hồi không tự thành doanh thu ki-ốt khi chưa bán.
12. Gross 1.500.000 trừ chiết khấu 225.000 = 1.275.000 trước giảm trừ khác.
13. Thu nợ cũ không tăng doanh thu bán hàng kỳ hiện tại.
14. Nhập 100, bổ sung 30, sửa thành 90 ra kết quả đúng, có audit.
15. Chấm công 23:00–07:00 / 08:00 / 09:00 ra 8/9/10 giờ; phụ cấp không trùng.
16. Năng suất chỉ chia giờ nhân viên sản xuất.
17. Food Cost 32,2% và labor SX 15% tính trên doanh thu thuần; không dùng thực thu.
18. Dashboard lọc ngày/tuần/tháng/quý/năm và so sánh cùng thứ.
19. RLS deny-by-default kiểm thử trực tiếp ở PostgreSQL.
20. Idempotency bảo vệ khi người dùng gửi lại request do mạng chậm.
21. Kiểm kê điều chỉnh kho và đối soát không làm mất lịch sử.
22. Chỉ xác nhận `Đã lưu` sau commit; lỗi có xử lý retry an toàn.
23. PWA offline báo rõ là bản nháp, không tự chốt đơn/tiền.
24. Import thử XLSX rồi import lại không sinh duplicate.
25. Benchmark cold load/warm load, truy vấn, 10 user, khách đặt hàng, p95.
26. Backup và diễn tập restore lên DB DEV thành công.

### 11. Repo deliverables & handoff

Tối thiểu có cấu trúc thư mục rõ ràng:

```text
chifaa-combine/
  app/                 # Next.js routes: auth/app/portal
  components/          # UI + design system
  features/            # domain modules
  lib/                 # supabase clients, API, validation
  supabase/
    migrations/        # PostgreSQL SQL schema/RLS/views/RPC
    functions/         # Edge Functions
    tests/             # db/RLS tests
    seed.sql           # DEV only
  scripts/             # import & backup helpers
  tests/               # unit/integration/e2e
  docs/                # ERD, API, mapping, deployment
  .env.example
  README.md
  AGENTS.md
  TASKS.md
  HANDOFF.md
  CHANGELOG.md
  DECISIONS_REQUIRED.md
  TEST_RESULTS.md
  PERFORMANCE_REPORT.md
  DATA_MAPPING.md
  DEPLOYMENT_GUIDE.md
```

Cập nhật `TASKS.md` và `HANDOFF.md` sau mỗi task; ghi commit nếu có git, không chứa secrets. Ghi file sửa, lệnh chạy, kết quả test thật, blockers, bước tiếp theo. Bổ sung kịch bản rollback và versioned database migrations. Nếu bị giới hạn phiên, dừng ở trạng thái có thể tiếp tục, không hứa tự khởi động lại ngoài môi trường.

### 12. Cấu hình và cách chạy

Cung cấp `.env.example` với `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, và các biến server-only khi thật sự cần. Không commit secrets. Nếu cần `SUPABASE_SERVICE_ROLE_KEY`, chỉ dùng ở server/Edge, không bao giờ public. Hướng dẫn `supabase start` (nếu CLI/containers có sẵn), chạy migrations/seed, `npm install`, `npm run dev`, typecheck/lint/test/build, tạo Supabase DEV & PROD, cấu hình Auth redirect, cấu hình Vercel env và deploy preview. Tạo checklist phát hành production.

**CẢNH BÁO NỀN TẢNG:** Vercel Hobby hiện chỉ dành cho cá nhân/phi thương mại. CHIFAA vận hành thương mại cho doanh nghiệp/khách hàng cần gói Vercel phù hợp hoặc chuyển static frontend sang hosting cho phép sử dụng thương mại miễn phí. Supabase Free có giới hạn và có thể pause nếu ít hoạt động; chưa có automatic backups. Phải giải thích rõ các rủi ro, theo dõi dung lượng/limits, có lịch backup DB riêng và thử restore.

### 13. Lệnh bắt đầu ngay

BẮT ĐẦU CODE.

1. Audit repository, các file và tài liệu được cung cấp; nếu chưa có repo thì khởi tạo repo mới.
2. Viết `docs/ARCHITECTURE.md`, ERD, ma trận tính năng, `TASKS.md` với mức ưu tiên và dependency.
3. Triển khai P1 chạy được: Next.js + Supabase Auth + migration PostgreSQL + RLS + layout Admin/Portal + API demo truy cập DB thật trên DEV.
4. Sau khi P1 test thành công, tự tiếp tục P2→P8, không hỏi có tiếp tục không.
5. Tuyệt đối không dùng Google Sheets như DB và không ghi vào dữ liệu production cũ.
6. Nếu cần secrets hoặc triển khai live, ghi thao tác chính xác chủ dự án cần thực hiện và chuyển qua task độc lập khác.
7. Chỉ báo hoàn thành toàn bộ khi đã có code hoạt động, test, đối chiếu, tài liệu và các blocker được giải quyết. Không biến số liệu giả thành số liệu báo cáo thật.

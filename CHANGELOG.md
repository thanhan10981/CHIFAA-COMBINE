## 2026-11-22 — Giữ đơn vị kho khi khai báo quy cách bằng gam (KH-01/KH-10)

- Vật tư có lịch sử kho hoặc công thức giữ nguyên đơn vị chuẩn; biểu mẫu hiện lý do và vẫn cho khai báo quy cách như `1 túi = 100 g`.
- Migration `202611220052_material_unit_lock_status.sql` bổ sung trạng thái lịch sử có phạm vi quyền vào cơ sở giá. Quy đổi bao bì tiếp tục chuyển về đơn vị kho chuẩn; không sửa chứng từ cũ.
- Đạt typecheck, lint, 143/143 test, build và fixture Chromium `--materials`. Chưa áp migration lên Supabase/DEV, chưa deploy hoặc UAT cloud.

## 2026-11-21 — Căn chỉnh nút cài ngưỡng trên Dashboard (KH-06/07/10)

- Chuyển nút “Cài ngưỡng mục tiêu” vào hàng tiêu đề bảng đối chiếu; thêm icon điều chỉnh, mũi tên, hover/focus rõ ràng và bố cục co giãn cho màn nhỏ.
- Chỉ thay giao diện; nguồn dữ liệu, kỳ và quy tắc ngưỡng giữ nguyên. Typecheck, lint, 138/138 tests, build và fixture riêng desktop/mobile tại 320/390/768/1440px đạt; đã xem ảnh fixture. Bộ responsive tổng hợp còn lỗi tràn ngang ở Strategy 320px; không thuộc phạm vi nút Dashboard.

## 2026-11-20 — Excel tồn kho (KH-01/09/10)

- Bảng kho hiển thị giá nhập trung bình; xuất Excel toàn bộ tồn kèm mẫu cột nhập thêm.
- Nhập `.xlsx` xem trước, cập nhật vật tư theo mã và chỉ cộng cột số lượng nhập thêm qua phiếu kho bất biến, idempotent; lịch sử hiển thị từng mặt hàng/tệp.
- Xác minh local: db:types 95 bảng/73 RPC, typecheck, lint, 137/137 tests, build, inventory fixture 25 trang/kích thước và `git diff --check` đạt. Migration 049 chưa áp cloud/DEV.

## 2026-11-20 — Hiển thị điểm bán trong danh sách duyệt đơn (KH-05/10/12)

- Thêm cột Điểm bán để thấy mã/tên điểm bán đã gắn; đơn từ cổng chung chưa gán hiện “Chưa gắn điểm bán”. Chi tiết đơn cũng hiện thông tin này.
- Thêm RPC đọc hàng duyệt có kiểm tra `orders/view`; RPC chỉ kèm tên điểm bán theo từng đơn và không yêu cầu quyền xem toàn bộ danh bạ điểm bán.
- Kiểm tra local: db:types 95 bảng/71 RPC, typecheck, lint, 133/133 tests, build, fixture UI đơn điểm bán/cổng chung và `git diff --check` đạt. Chưa áp migration 048 lên cloud/DEV hoặc deploy.

## 2026-11-20 — Receipt-level inventory pricing and correction (KH-01/09/10)

- Receipt entry now stores its own unit price and quantity; unit cost is normalized to the standard inventory unit when a verified conversion is used. The material catalog displays the quantity-weighted average of priced receipts separately from the verified recipe/reference price. Inventory history shows each receipt's date, quantity, unit price and line value.
- Users with inventory edit/create rights can correct a posted receipt from history with a reason. A linked reversal and replacement preserve the original ledger row, with audit, optimistic version checks and idempotent retry.
- Local validation passed: 95 migrated tables/70 RPCs generated; typecheck, lint, build, 131 tests, inventory UI fixture at 320/390/768/1024/1440px, and `git diff --check`. Migration 046 was not applied to Supabase/DEV; no deploy or authenticated cloud UAT.

## 2026-11-19 — Công thức cha nháp theo phiên bản con mới nhất (KH-01/10/11)

Đã tìm nguyên nhân cảnh báo kéo dài: `recipe_items.child_version_id` cố định vào bản con cũ dù bản sửa mới đã đủ dữ liệu. Migration `202611190038_recipe_child_links_follow_latest_draft.sql` chuyển liên kết của công thức cha còn nháp sang phiên bản con vừa lưu nếu đơn vị đầu ra còn khớp, đồng thời ghi audit `recipe:link-refresh`. Công thức đã công bố và snapshot sản xuất giữ nguyên tham chiếu. Giao diện bỏ bộ chọn phiên bản cũ để luôn mở bản hiệu lực mới nhất.

Bằng chứng local: typecheck, lint, 122/122 tests, build và `git diff --check` đạt. Ca kiểm thử xác nhận sửa công thức con lỗi thành đủ dữ liệu làm mới liên kết cha nháp và cost tính lại; bản con cũ giữ nguyên dữ liệu chưa rõ. Chưa áp migration lên cloud DEV/production và chưa xác nhận UAT.

## 2026-11-19 — Sửa phản hồi sau khi lưu công thức (KH-01/10)

- Sau khi lưu, workspace chọn đúng `version_id` RPC vừa tạo thay vì giữ phiên bản cũ trong cache.
- Kiểm tra: typecheck, lint, 121/121 tests và build đạt. Chưa chạy authenticated cloud UAT.

## 2026-11-18 — Cải thiện form công thức (KH-01/03/10/11)

- Chọn công thức con cùng nhóm; bỏ chữ nháp/trạng thái trùng lặp tại bộ chọn và chi tiết phiên bản.
- Gỡ ô nhập chứng thực; RPC giữ nhật ký thao tác mà không giả lập chứng từ xác minh.
- Kiểm tra: typecheck, lint, 121/121 tests, build đạt. Chưa ghi dữ liệu thật lên Supabase DEV do không có phiên đăng nhập để xác thực đúng project; còn chờ nhập và xác minh công thức nguồn.
## 2026-11-18 — Gỡ tab “Nhập dữ liệu cũ” khỏi điều hướng (KH-10)

- Gỡ tab trang cũ khỏi nhóm điều hướng, giữ tab “Nhật ký hoạt động” trên trang nhật ký; giữ module, URL, quyền và dữ liệu/lịch sử hiện có.
- Kiểm tra cấu hình điều hướng, typecheck, lint và build đạt. Bộ test đạt 116/118; hai file không chạy do sandbox chặn tiến trình con esbuild (`spawn EPERM`), không phải assertion thất bại.

## 2026-11-18 — Thiết kế lại tài khoản & phân quyền (KH-10)

- Thay trang chọn tài khoản đơn lẻ bằng danh sách Auth có tìm kiếm/trạng thái; chọn nhân viên để xem quyền vai trò và ghi đè, rồi lưu bằng RPC Admin hiện có.
- Thêm popup mời nhân viên bằng tên/email. Link mời hoàn tất đăng ký qua Supabase Auth; tài khoản mới mặc định chưa kích hoạt/cấp quyền. Giao diện responsive, riêng ma trận quyền cuộn ngang bên trong.
- 120/120 tests; typecheck/lint/build và Chrome fixture tài khoản + portal đạt. Edge Function chưa được UAT/deploy DEV; chưa có liên kết hồ sơ nhân viên nghiệp vụ và không đổi schema/SQL.

## 2026-11-18 — Tự chọn ca giao ẩn cho cổng đặt hàng (KH-12/01/03/05/10)

- Bỏ ô “Ca giao”; trường ẩn tự gửi `AM` trước 12:00 và `PM` từ 12:00 theo `Asia/Ho_Chi_Minh`. Khi thử gửi lại, payload tiếp tục dùng cùng ca đã chốt.
- 120 tests, typecheck/lint/build và Chrome fixture 6 cỡ màn hình đạt. Không đổi SQL/schema; fixture chỉ mock, chưa UAT cloud/deploy. Chi tiết `docs/standalone/PUBLIC_ORDER_PORTAL.md`.

## 2026-11-18 — Link đặt hàng theo điểm bán (036, KH-12/01/03/04/05/10)

- Nút “Cổng đặt hàng” mở popup chọn điểm bán và tạo link; token bí mật gửi trong fragment URL, DB giữ digest, có quyền, audit, idempotency và thu hồi.
- Đơn gửi từ link được gắn sẵn điểm bán và xuất hiện ở “Đơn đặt hàng” chờ duyệt. Đơn `/portal` chung vẫn cần chọn điểm bán khi duyệt. Không phát sinh doanh thu, thu tiền, sản xuất hay xuất kho khi mới nhận/duyệt.
- Gỡ “Đơn điểm bán” khỏi cổng công khai; URL cũ `/portal/account` chuyển về `/portal`. Bỏ hai tab “Giao hàng” và “Thu hồi” khỏi màn đơn đặt hàng, giữ nguyên phân hệ và lịch sử.
- 119 tests, types94 bảng/66 RPC, typecheck/lint/build và Chrome fixture public portal/link/review đạt. Gói `output/CHIFAA_PATCH_LINK_DIEM_BAN_DEV.sql` sau035 đã tạo, chưa áp DEV/cloud hoặc deploy.

## 2026-11-18 — Cổng đặt hàng công khai035 (KH-12/01/03/05/10)

- Mở `/portal` không đăng nhập, hiển thị món công bố và giá chung, chọn số lượng/tổng tiền, liên hệ/giao hàng và gửi đơn. Cổng điểm bán đã đăng nhập ở `/portal/account`.
- Anonymous chỉ catalog/submit RPC, không đọc bảng/đơn/dữ liệu nội bộ. Server kiểm tra giá/món/cutoff/công suất, chống trùng và giới hạn gửi. Nhân viên xem chi tiết và gán điểm bán khi duyệt guest; không tự tạo doanh thu/tiền/kho.
- 118 tests, types/lint/build và Chrome6 cỡ +retry/giá đổi/empty/duyệt đạt; local `/portal` không redirect login. Gói SQL035 đã chuẩn bị, chưa áp cloud/phát hành. Chi tiết docs/standalone/PUBLIC_ORDER_PORTAL.md.

## 2026-11-18 — Danh mục vật tư gọn (034, KH-01/10/11)

- Theo làm rõ mới nhất: bỏ phần hiển thị dữ liệu gốc/lịch sử khỏi giao diện vật tư, chỉ tải bản gần nhất để điền form; lịch sử DB giữ nguyên. Typecheck/lint/build,113 tests và Chrome fixture xác nhận không có khối lịch sử đạt. Việc ẩn lịch sử không cần thêm SQL.

- Mỗi dòng chỉ còn Sửa; form chỉ dữ liệu bảng, bỏ chứng từ/ngày hiệu lực/checkbox xác minh. Cảnh báo ô trống, giữ số0; tồn chỉ đọc từ Kho, bỏ số tham chiếu và kiểm kê nhanh.
- Lưu metadata/giá nguyên tử qua RPC034; giữ lịch sử, đơn vị và quy đổi, chặn quyền/stale/replay. Giá thay đổi chưa tự thành giá đã xác minh; metadata-only giữ trạng thái cũ.
- 113 tests, types/lint/build đạt; Chrome fixture6 cỡ màn hình và gửi lại sau503 đạt, ảnh đã xem. Gói DEV034 đã chuẩn bị ở output/CHIFAA_PATCH_DANH_MUC_VAT_TU_GON_DEV.sql, chưa áp cloud hoặc phát hành.

## 2026-11-18 — Thu gọn/mở lại sidebar (KH-10)

- Thêm nút mũi tên SVG sát cạnh sidebar desktop, navy/hover cam, tooltip và hỗ trợ bàn phím. Ẩn menu mở rộng nội dung; nút ở mép trái để mở lại. Mobile/tablet giữ drawer.
- Typecheck/lint/build và109 tests đạt; Chrome fixture kiểm tra8 cỡ màn hình320–1920px, đóng/mở/resize/focus/ARIA/không tràn ngang đạt. Bằng chứng ignored output/sidebar-design/report.json và ảnh đã xem. Chưa deploy hoặc cloud UAT.

## 2026-11-18 — Nhập liệu liên thông032 và nguồn HTML

Phát hành033: owner xác nhận cả033_READY và033_DATA_READY trong chat. Candidate6a5744d đã đạt109 tests/types/lint/build,50 bố cục +14 popup Nhập liệu và30 bố cục SX. Đẩy riêng chifaa-next-dev; bằng chứng commit/Vercel/HTTP ghi tại ignored output/entry-compact-release-status.json. Chưa UAT authenticated. Không áp SQL cloud từ công cụ.

## 18/11/2026 — Checkpoint033: nhập liệu gọn và điều chỉnh liên thông

KH-02/05/09/10 và yêu cầu trực tiếp mới nhất: bỏ hàng điều hướng1–9 trùng sidebar, bảng nguồn phát thảo, trường nhập bằng chứng, nút tải lại/CSV trong phạm vi Kho/SX/Nhập liệu và trang Tài sản & khấu hao khỏi điều hướng (URL cũ chuyển về Nhập liệu). Bảng gọn, SVG, lọc ngày/tháng/bộ phận, nút + mở popup một nút Lưu. Sản xuất cũng mở popup, giữ preview kế hoạch và định mức server.

Lương tháng lấy ca công thực tế SX/VP/BH và phụ cấp hiện có. Sửa/xóa từ bảng lương mở các ca nguồn; chỉnh ca đảo bảng lương chưa chi và cho chốt phiên bản mới. Phiếu thu/chi, khoản vay, công nợ, mục tiêu có sửa/xóa bằng hoàn tác và tham chiếu; không xóa lịch sử. Phiếu đã có hàng thu hồi hoặc lương đã chi yêu cầu hoàn tác liên kết trước, kỳ khóa/quyền/idempotency vẫn được kiểm tra.

SQL033 chuyển các dòng quỹ đã lưu từ HTML thành cash_ledger và entry_journal thật, đúng ngày/số tiền/tài khoản nguồn. Chạy lại không nhân đôi và không khôi phục dòng đã xóa. Không bịa doanh thu phân bổ, số dư đầu kỳ, ca công hoặc tồn kho cho những phần nguồn không có giao dịch.

Bằng chứng: npm run verify109/109,94 tables/59 RPCs, typecheck/lint/build đạt. Chrome Nhập liệu50 bố cục +14 popup; Sản xuất30 bố cục, preview/điều chỉnh/hủy/kiểm kê/retry đạt, không JS error/tràn trang. Đã xem ảnh desktop chấm công và popup mobile. Nhập HTML thật hai lần và promote hai lần:132 dòng nguồn,2 vay,29 mục tiêu,33 quỹ; không tạo sales/attendance/stock. Báo cáo ignored output/entry-design/report.json, output/production-design/report.json và output/nhap-lieu-real-data-validation.json. Đây là PostgreSQL nhúng/fixture, chưa phải authenticated cloud UAT.

Còn lại: owner chạy output/CHIFAA_PATCH_NHAP_LIEU_GON_DEV.sql →033_READY, rồi output/CHIFAA_AP_DUNG_DU_LIEU_THAT_DEV.sql →033_DATA_READY. Chưa áp SQL cloud từ công cụ; chỉ phát hành chifaa-next-dev sau xác nhận033, giữ production/main. Dữ liệu có ngày gốc nên cần chọn đúng tháng để xem. Chưa xác nhận toàn bộ báo cáo ngoài phạm vi Nhập liệu.

Owner xác nhận hai gói SQL032 và nguồn đều READY; RPC DEV đã nhận diện và chặn anonymous. Phát hành nhánh DEV với cùng candidate đã kiểm thử, bằng chứng commit/Vercel/HTTP tại output/entry-release-status.json; UAT authenticated vẫn còn.

KH-01..10 trong phạm vi Nhập liệu: thay các màn khung bằng biểu mẫu và chứng từ PostgreSQL; nối bán–phải thu–thu tiền–quỹ, vay/trả vay và phải trả NCC, ca/phụ cấp–lương–chi quỹ; dùng lại Kho/SX/thu hồi hiện có. Thêm journal, quyền nguồn/lương, snapshot/token/chống trùng và khóa kỳ. Tạo gói DEV riêng từ HTML literal:132 dòng nguồn,2 khoản vay,29 mục tiêu,33 dòng quỹ lịch sử chỉ đọc; không bịa giao dịch từ bảng trống, không nhập chồng danh mục.104 tests +50 tổ hợp Chrome; chưa áp SQL cloud. Giới hạn điều chỉnh tài chính sau thu/chi và chi tiết trong docs/standalone/CONNECTED_ENTRY.md/HANDOFF.

## 2026-11-18 — Kế hoạch nối nhu cầu và kiểm kê chung031

KH-01/03/09/10: nhập kế hoạch xem ngay nguyên liệu từ BOM PostgreSQL, tổng theo vật tư/ĐVT, quy đổi đã xác minh và thiếu so tồn. Tách kế hoạch khỏi ghi sản xuất thực tế; kế hoạch không trừ kho. Kiểm kê Kho/Sản xuất dùng chung phiếu đếm, đối chiếu lấy lại chứng từ thay vì nhập lại tồn đầu/cuối. Giữ snapshot, quyền, token và retry. Owner xác nhận031_READY; verify97 tests, Chrome30 tổ hợp, types/lint/build đạt. Chi tiết và giới hạn tại docs/standalone/PLANNING_COUNT_FLOW.md, TEST_RESULTS.md.

## 2026-11-18 — Mặc định một kho nguyên liệu

KH-01/09/10: bỏ Danh mục kho khỏi UI, chuyển URL cũ sang Tồn kho. Tự dùng kho nguyên liệu hiện có cho Kho, Sản xuất và Kiểm kê, không cần chọn. Giữ nguyên ID/chứng từ/lịch sử; không gộp hoặc xóa kho cũ. Không cần SQL; trạng thái thiếu/nhiều kho nguyên liệu được báo rõ. Kiểm thử và phát hành theo TEST_RESULTS.md/`output/default-ingredient-release-status.json`.

## 2026-11-18 — Thu gọn bộ lọc và thao tác Kho

KH-01/09/10: bỏ điều hướng lặp, gom bộ lọc, dải thống kê nhỏ, dòng bảng gọn và số căn phải. Nút Nhập/Xuất/Kiểm kê bằng icon có tên truy cập, tooltip và chú giải; dialog vừa màn hình, focus lượng khi mở. Giữ luồng nghiệp vụ và bảo vệ ghi hiện có. Không cần SQL; bằng chứng kiểm tra và phát hành theo TEST_RESULTS.md/`output/inventory-compact-release-status.json`.

## 2026-11-18 — Gỡ mục Thu hồi & ki-ốt khỏi Kho và sửa lưu loại kho

Theo yêu cầu mới nhất: bỏ liên kết Thu hồi & ki-ốt trong menu Kho; giữ chứng từ/lịch sử nghiệp vụ. KH-04/10. Sửa select danh mục thiếu value làm gửi nhãn tiếng Việt thay mã enum, gây lỗi lưu kho thành phẩm/ki-ốt. Không đổi schema hoặc cần chạy SQL. Kiểm thử theo TEST_RESULTS.md; theo dõi deploy DEV tại `output/warehouse-menu-release-status.json`.

## 2026-11-18 — Bảng tồn kho và nhập/xuất030

KH-01/09/10: nối toàn bộ danh mục vật tư vào bảng tồn theo kho, nhập/xuất/kiểm kê từng dòng, lịch sử và đề xuất mua theo kế hoạch cùng ĐVT. Giữ unknown khác số0 đã kiểm kê; không tạo dữ liệu giả. Tự chọn kho duy nhất/hướng dẫn kho trống, làm mới cache liên thông, token kiểm kê và retry giữ payload/key. Regression kho5 trường hợp và Chrome25 tổ hợp đạt. Owner xác nhận SQL030_READY; RPC live chặn anonymous. Chi tiết `docs/standalone/INVENTORY_WORKSPACE.md`; phát hành DEV và kiểm thử cuối theo `output/inventory-release-status.json`/TEST_RESULTS.md. Chưa UAT authenticated hoặc thêm sửa/đảo riêng phiếu nhập/xuất.

## 2026-11-18 — Hoàn thiện đối soát sản xuất029

KH-01/03/09/10: ghép kiểm kê từ phiếu đếm cuối ngày và các luồng kho đã phân loại, lưu token/snapshot nguồn; giữ đường nhập thủ công có bằng chứng. Điều chỉnh SX sau giao/bán bằng journal và đảo định mức, giữ nguyên tài chính, đối chiếu lượng tốt đủ lượng giao và không đếm đôi phiếu bán liên kết giao. Hủy số lượng nhập sai về0 có xác nhận, lịch sử và số0 rõ nguồn. Sửa tuần qua tháng/năm/ngày trống.87 tests + types/lint/build,30 tổ hợp Chrome đạt. Patch029 tiến tiếp sau028, chủ sở hữu báo SQL Success; không nhập lại dữ liệu hoặc áp SQL cloud từ công cụ. Chuẩn bị phát hành nhánh DEV hiện có; bằng chứng deploy/API ở `output/production-release-status.json`.

## 2026-11-18 — Sản xuất và nguyên liệu028

KH-01/03/09/10: thay các màn khung bằng kế hoạch/SX, nhu cầu, kiểm kê và báo cáo thật. Phân kho đơn duyệt; kế hoạch bổ sung/thay thế có lịch sử; chính/thêm/lỗi và giờ SX/ngày giao/ngày nhập riêng; thay ngày bằng đảo phiếu và đợt mới. Gộp BOM, hiển thị thiếu/quy đổi, chỉ đối chiếu ngày đủ kiểm kê và giữ snapshot kỳ. Thêm quyền/token/idempotency/audit, CSV, khóa retry chưa xác nhận và responsive.81 tests + types/lint/build,30 tổ hợp giao diện đạt. Giao patch DEV028 sau027; chưa chạy cloud/deploy. Chứng từ vật lý đang nhập/dẫn chứng thủ công; điều chỉnh ngày có giao/bán posted và hủy cả ngày về0 còn chặn. Chi tiết `docs/standalone/PRODUCTION_MATERIALS.md`.

## 2026-11-17 — Danh mục công thức theo ảnh chuẩn và nhập sheet nguồn

Hoàn thiện năm mục công thức món, nhân/sốt, cơm chín, bao bì và tổng giá vốn: tìm/lọc/ngày xem, số liệu thật, chi tiết trực tiếp, mở công thức con, tạo/sao chép/sửa thành phiên bản mới, lịch sử, công bố/liên kết món bán và đơn vị riêng mỗi dòng. 027 giữ dòng nguồn chưa rõ, chặn BOM chính thức khi thiếu định lượng/quy đổi và bảo vệ nguồn/giá theo quyền. Chuẩn bị SQL riêng cho21 công thức nháp từ sheet được gửi, giữ dữ liệu gốc/cost tham khảo, không tạo bản sao thử nghiệm trong ảnh, không tự đổi giá danh mục hoặc ghi kho. Đã đối chiếu nguyên tử/replay nguồn cục bộ và kiểm tra responsive5 mục ×5 kích thước. KH-01/03/10/11; chi tiết docs/standalone/RECIPE_CATALOG.md. Chưa chạy SQL cloud; báo cáo nhu cầu/hao hụt theo kỳ vẫn là hạng mục riêng.

## 2026-11-17 — Lưu yêu cầu khách hàng và bắt buộc đọc trước khi code

Tổng hợp chat và ba ảnh vào `docs/standalone/CUSTOMER_REQUIREMENTS_2026-11-17.md` với mã KH-01..KH-10, tiêu chí nghiệm thu và ưu tiên nhu cầu nguyên liệu/đối chiếu kho. Ghi rõ phụ cấp ngày/ca bổ sung phụ cấp tháng; khác biệt doanh thu/thực thu và quy tắc hỗ trợ thu hồi cần đối chiếu quyết định cũ. Thêm AGENTS.md ở gốc và dẫn chiếu trong web/AGENTS.md để mỗi task phải đọc, chọn yêu cầu liên quan và kiểm chứng. Chỉ cập nhật tài liệu, không thay code nghiệp vụ, SQL hoặc dữ liệu cloud.

## 2026-11-17 — Phụ cấp riêng từng tháng, bỏ phụ cấp mặc định

Theo xác nhận chủ sở hữu: lương giờ không chứa phụ cấp; phụ cấp nhập tổng tiền riêng cho nhân viên/tháng, không kế thừa tháng trước. 026 thêm lịch sử điều chỉnh bất biến, quyền payroll riêng, chống gửi trùng/ghi đè và khóa tháng đã chốt. Bỏ trường/cột phụ cấp mặc định, ngừng sao chép mức cũ vào ca mới; dữ liệu ca/lương cũ giữ nguyên. Thu gọn thanh tìm/lọc/ngày xem trên bốn danh mục, tránh ép chữ trong bảng nhân viên. File cập nhật riêng CHIFAA_PATCH_PHU_CAP_THANG_DEV.sql, không nhập lại danh mục, chưa áp cloud.

## 2026-11-17 — Bốn danh mục kinh doanh và nhập nguồn

Điểm bán, món bán, nhân viên và CK có UI/RPC thật: thêm/sửa/ngừng dùng, tìm/lọc/phân trang/ngày xem, giá chung/giá riêng, lương/phụ cấp, liên kết công thức và ma trận CK theo món/ngày. Thêm025 với giá chung và chính sách CK, lịch sử/bằng chứng, khóa version/idempotency, RLS và quyền duyệt. Portal dùng giá/CK cùng nguồn và giữ snapshot đơn cũ. Cost nguồn chỉ tham khảo; thiếu bộ phận/phụ cấp không tự điền giả. Chuẩn bị SQL riêng cho11 điểm bán/11 món/5 nhân viên/121 ô CK;44 dòng trống tên giữ nguồn riêng. Không nhập cloud hoặc ghi phiếu kinh doanh; không sửa63 vật tư/workbook. Chi tiết docs/standalone/COMMERCIAL_CATALOGS.md.

## 2026-11-17 — Responsive điện thoại, tablet và desktop

Thêm bố cục chung cho màn hình nhỏ: tablet dùng menu trượt, khóa cuộn nền và giữ focus bàn phím; desktop 1024px thu gọn sidebar. Form chuyển một cột trên điện thoại, bảng cuộn trong vùng riêng, hộp thoại giới hạn theo chiều cao màn hình và vùng an toàn. Giữ cổng đặt hàng, vai trò và nút SVG trên mobile; bảng đơn hàng portal có vùng cuộn riêng. Không đổi SQL, quyền hoặc dữ liệu.

## 2026-11-17 — Căn giữa icon thẻ thống kê

Sửa CSS chung: kiểu span mô tả đã ghi đè display grid và thêm margin vào ô icon vật tư. Khôi phục grid, bỏ margin/padding và dùng SVG20px ở giữa ô nền. Kiểm tra trình duyệt đo tâm icon trên desktop và bốn thẻ vật tư mobile. Không đổi SQL hoặc dữ liệu.

## 2026-11-17 — Xác minh cơ sở giá, đơn vị và quy cách theo phiên bản

Tách đơn vị tính giá khỏi đơn vị mua/tiêu hao. Thêm phiên bản xác minh bất biến, nguồn gốc, bằng chứng, ngày hiệu lực/ghi nhận và form Admin xem quy đổi đã lưu/lịch sử. Giá suy luận/mâu thuẫn không vào tổng giá vốn; BOM/sản xuất/kho dùng nguồn xác minh theo ngày. Giữ nguyên giá cũ và số liệu đã ghi; chặn relabel đơn vị có lịch sử, đánh dấu cần chuyển đổi/đối chiếu. SQL điều chỉnh 63 dòng giữ ID, không tạo tồn và chạy lại không trùng; 23 mã cần xác minh được tổng hợp trong output/VAT_TU_CHO_XAC_MINH.md. DM/DH sửa về cơ sở giá/kg; TG/RCM/RCC/DAN chờ xác minh. Migration024: 79 bảng,30 RPC. Chưa chạy SQL cloud hoặc thay workbook gốc.

## 2026-11-17 — Việt hóa nhóm và trạng thái danh mục

Biểu mẫu danh mục chung dùng dropdown nhóm với nhãn tiếng Việt, giữ mã nội bộ cho API; trạng thái giá/loại đơn vị/kho/quỹ cũng dùng nhãn tiếng Việt. Bảng gốc 63 dòng mới được người dùng cung cấp có ghi chú Kg khác cơ sở giá đã chuẩn hóa trước đó ở sáu mã. Đang chờ xác nhận giá theo quả/vỉ, kg/túi/chai/can/lít trước khi tạo SQL sửa nguồn; chưa nhập lại hoặc sửa giá/đơn vị cloud.

## 2026-11-17 — Sửa SQL nhập vật tư trên SQL Editor

Người dùng gặp 42P01: bảng tạm chifaa_material_source không tồn tại. Bỏ phụ thuộc bảng tạm/phiên kết nối: JSON nguồn và toàn bộ thao tác nhập nằm trong một DO atomic, giữ hash replay và các guard cũ. Sinh lại CHIFAA_63_VAT_TU_DEV.sql; kiểm tra DO chạy độc lập, nhập đủ 63/41/2/19 và không tạo phiếu kho. Không đổi schema/UI, chưa chạy SQL cloud.

## 2026-11-17 — Danh mục 63 vật tư, quy đổi và tiền Việt

Thay màn vật tư bằng bốn chỉ số, tìm/lọc/phân trang, bảng giá/tồn/quy cách và hộp thoại sửa theo ảnh tham chiếu. Thêm cài đặt quy đổi theo vật tư và kiểm kê thật qua snapshot/version hiện có. Migration 023 bổ sung metadata nguồn, material_catalog và save_material; lưu vật tư/giá atomic, kiểm tra quyền hiện tại, chống gửi trùng, giữ lịch sử giá và chặn đổi đơn vị khi đã có lịch sử. Định dạng tiền Việt cho ô nhập giá/thu tiền, bảng vật tư và giá vốn công thức, giữ chính xác bigint/decimal.

Đã chuẩn bị hai SQL trong output ignored: CHIFAA_PATCH_MATERIALS_DEV.sql rồi CHIFAA_63_VAT_TU_DEV.sql. Nguồn 63 mã được giữ riêng; kiểm tra PostgreSQL cục bộ cho đúng 63/41/2/19, phân biệt giá 0 và NULL, không tạo phiếu kho từ tồn tham chiếu, ba tỷ lệ chưa xác nhận vẫn unverified và chạy lại không ghi trùng. Chưa thực thi SQL trên Supabase cloud. Không dùng bootstrap cài mới cho DEV hiện có.

## 2026-11-17 — Cấp Admin đầu tiên có kiểm soát

Sidebar refinement: aligned rows, softer group styling, readable section labels, fixed transparent branding/account area and independently scrolling navigation. Preserves menu order, SVG icons, permissions, portal and route targets.

Shared UI feedback: skeleton/orbit loaders and request activity, top-right deduplicated toasts, custom CHIFAA SVG icons, neutral stat tiles and consistent action dialogs. Removed redundant banners; preserved important field guidance, permissions, financial guards and all SQL workflows. Local verification passed; cloud authenticated UAT remains separate.

Login: replaced the previous compact design with the supplied navy/light split, official CHIFAA branding, capability list, white outlined Google sign-in card, security note and responsive mobile header. Added pending submit feedback while retaining OAuth action, errors and portal routing. Production build and 47 tests passed; actual Next login browser checks passed seven widths. No schema/data changes or authenticated cloud sign-in test.

Đối chiếu dự án cũ theo yêu cầu mới: runtime menu đúng src/client/navigation.js + src/shared/schema.js (7 nhóm/37 mục), bỏ nhóm tự thêm Quản trị & tiện ích, Ki-ốt trong Kho, Orders trong Khách hàng, Admin/Nhật ký trong Quản trị hệ thống, tài sản trong Nhập liệu. Cấu hình phụ chuyển thành context tabs; giữ Portal/font. Thêm ActivityLog đọc audit_logs qua RLS/phân trang. Port Ki-ốt migration021: lô từ sales_lines posted, approve/receive/reject/sell/undo, source/version/period guards, quantity locks, ghi sales/debt/receipt/allocation/cash atomic, hoàn tác chặn linked payments, COGS null. 022 sửa 5 probe audit (3 null version, null approval, aggregate plan capacity) và thêm save_catalog bank_accounts với khóa kind khi có lịch sử. 22 migrations/78 bảng/26 RPC. 47 tests + types/TS/lint/build đạt; Chrome fixture 37 menu + 4 configuration routes và 6 mobile/dialog Ki-ốt/quỹ đạt; 15 test tham chiếu legacy trên mock đạt. Không gọi Apps Script/Sheets runtime, không nhập dữ liệu lịch sử, KHÔNG áp SQL cloud từ công cụ. Chạy web npm run db:kiosk-update sinh output/CHIFAA_PATCH_KIOSK_DEV.sql (021+022, SHA256 aef329d3803ccbe5661d5c30b1e3617dd4f482618a759ac7fc660d1829aab3c8). Owner chạy file này trên DEV hiện có, không chạy lại bootstrap. Đã test giữ record hiện có, guard replay và rollback toàn bộ patch. Chưa UAT authenticated/concurrency cloud. Toàn bộ chức năng cũ CHƯA chuyển đủ, đặc biệt NEW/APPEND/CORRECT, nguồn sales UI, tài sản/lương/report/backup/session. Chi tiết docs/standalone/LEGACY_PARITY.md; bằng chứng output/legacy-kiosk-verify.txt, legacy-kiosk-design-check.txt, legacy-reference-workflows-tests.txt.


Nâng cấp trình bày theo yêu cầu mới: Be Vietnam Pro tự phục vụ (400/600/700, dấu tiếng Việt), navy–cam rõ hơn, thang chữ/khoảng cách/card/bảng/form đồng nhất, focus bàn phím, input mobile 16px. Giữ Cổng đặt hàng trên desktop và mobile. 37/37 tests + types/TS/lint/build đạt; Chrome fixture 32 route và 5 màn mobile đạt, xác nhận font thực sự tải. Đây là kiểm tra giao diện cô lập, không phải UAT cloud hoặc chứng nhận chất lượng. Không thay nghiệp vụ, schema hoặc dữ liệu. Chi tiết docs/standalone/UI_REFERENCE.md; log output/ui-polish-verify.txt và ui-polish-build-final.txt.


Giao diện phác thảo: đã áp style gốc có scope, sidebar 5 nhóm/32 mục, bố cục danh mục/tổng quan/công thức và bố cục chờ backend. 37/37 tests, types/TS/lint/build đạt; Chrome fixture kiểm tra 32 route desktop và 5 drawer mobile, không lỗi JavaScript/tràn ngang. Chưa nghiệm thu pixel 100%, chưa UAT authenticated cloud. Các editor kho/sản xuất/kiểm kê vẫn còn khác cấu trúc phác thảo; phân hệ chờ backend khóa thao tác. Chi tiết docs/standalone/UI_REFERENCE.md. Không đổi migration hoặc nhập dữ liệu thật.


Thêm công cụ tạo SQL cấp Admin theo email chủ sở hữu đã xác nhận; kiểm tra Auth duy nhất/đã xác minh, chỉ owner SQL Editor, giữ deny overrides, chặn khi đã có quản trị và ghi audit một lần. Không tạo endpoint tự nâng quyền. 35 tests + TypeScript/lint/build đạt; file SQL chưa chạy trên cloud. Xác minh Google đã bật, callback online không còn thiếu APP_URL.

## 2026-11-17 — Kiểm tra bản DEV online

Người dùng báo SQL khởi tạo thành công và Vercel Ready. Kiểm tra domain chính chifaa-combine.vercel.app mở trang login, chặn app/portal anonymous bằng redirect. Xác định APP_URL còn thiếu (callback503) và Google provider chưa bật; chưa xác nhận đăng nhập hoặc nghiệp vụ cloud. Không sửa runtime, chạy lại bootstrap hay nhập dữ liệu thật.

## 2026-11-17 — Chuẩn bị triển khai DEV online

Thêm cấu hình Vercel cho Next.js, loại file env khỏi CLI upload và công cụ đóng gói 20 migrations thành một SQL transaction cho Supabase SQL Editor. Test cài mới, chống chạy lại và rollback khi lỗi; 33 tests, TypeScript/lint/build đạt. Đã kiểm tra Auth Supabase DEV phản hồi 200, schema chưa có; chưa chạy migrations cloud hoặc deploy Vercel. Có hướng dẫn online không yêu cầu người dùng chạy localhost.

## 2026-11-17 — Kiểm kê có kiểm tra xung đột

Thêm bảng nhập kiểm kê theo trang, snapshot tồn/version và lưu điều chỉnh kho cùng giao dịch. Bắt buộc token phiên bản, từ chối số đếm không hữu hạn, kho không hợp lệ; giữ số 0 và chống ghi trùng khi thử lại. 31 tests, TypeScript/lint/build đạt. Thêm hướng dẫn Supabase DEV; chưa kết nối cloud.

## 2026-11-17 — Standalone P2 editor/version/giá

Thêm form giá/quy đổi, 7 danh mục và editor công thức với tạo phiên bản sửa, công bố và xem giá vốn. 23 RPC, 19 migrations, 30 tests; TypeScript/lint/build đạt. Quyền xác minh độc lập quyền tạo; chặn công bố món không phép và công thức con chưa có hiệu lực. Giữ giá/BOM lịch sử, giá chưa biết trả null, hiển thị VND bằng BigInt. Chưa deploy cloud hoặc nhập dữ liệu thật; phần còn thiếu ở FEATURE_MATRIX.

## 2026-11-17 — Standalone checkpoint bảo mật/hiệu năng/UX

13migrations/77tables/21RPC,22tests. Thêm UI sản xuất/nhập-xuất, dropdown tham chiếu, kiểm tra quyền khi focus, invalidation cache theo module, public-shell PWA/nháp whitelist và UUID staging CLI. Chặn lộ lương qua audit, ghi đè verified prices/quy đổi lịch sử. RLS InitPlan giảm p95 local10.000rows từ370,72 xuống13,47ms; chưa đo cloud/concurrent. Root scripts mặc định chạy Next. Chưa deploy/import thật; các workflow chưa xong được ghi riêng trong FEATURE_MATRIX.

## 2026-11-17 — Standalone workflows PostgreSQL

Thêm RPC/test BOM/yield/publish/cycle, sản xuất+snapshot+xuất kho, kiểm kêđiềuchỉnh, kỳclose/reopen với advisorylock, Portal scope/serversideprice/orderstatus/idempotency/linkplan không cộngtrùng. Thu nợcũ→allocation/cashkhôngrevenue; lãi nhập tay; chấm công qua ngày và pay snapshots riêng RLS payroll.16tests PostgreSQL đạt;77publictables,11migrations. UI Portal/duyệtđơn/Admincheckbox hoạt động quaRPC khi cấu hìnhDEV. Chưa có cloud, màn hình sản xuất/tài chính/công thức còn xây tiếp, không chốt completion.

## 2026-11-17 — Standalone P0/P1

Theo yêu cầu mới, tạo ứng dụng độc lập web/ (Next App Router/React/TypeScript/Tailwind/Supabase/TanStack Query), không thay runtime cũ hoặc ghi Google. PostgreSQL migrations từ DB trống:76bảng, RLS, permissions, idempotency/version/audit, catalog+recipe/BOM+admin RPC; official logo, /app /portal, catalogUI và Dashboard aggregate.6tests PGlite/TypeScript/lint/build đạt. Chưa có Supabase DEV nên cloudAuth/Storage/Realtime và nghiệp vụ còn lại chưa nghiệm thu. Không deploy/nhập dữ liệu thật.

## 2026-11-17 — Chuẩn hóa thông điệp ký RPC-v2

Đã lên haiDEV@36, readback5file khớp, giữ quyền/URL/schema; chờ người dùng xác nhận preview. Không nhập dữ liệu Google.

Sau khi người dùng xác nhận lỗi chữ ký còn trên35, chuẩn hóa nội dung HMAC thành ASCII với phiên bản có prefix, chọn UTF-8 rõ ràng ở backend. Bản34 chỉ bảo toàn wire JSON nên chưa chứng minh giải quyết lỗi. Thêm thông báo phân biệt checksum nội dung khớp/thay đổi, không tiết lộ dữ liệu/khóa và không thay thế HMAC.290localtests/syntax91/build; chưa nghiệm thu hosted, không nhập dữ liệu.

## 2026-11-17 — Tải thư viện Excel nguyên văn

Đã lên haiDEV@35; readback5file khớp, manifest/quyền không đổi. Không nhập hay sửa dữ liệu Google.

Sửa lỗi “HTML không đúng định dạng” khi tải mẫu/xuất/nhập Excel: publicAsset_ dùng HtmlTemplate.getRawContent thay vì HtmlOutput.getContent cho raw JavaScript. Không thay ExcelJS, nội dung thư viện, hash kiểm tra hoặc dữ liệu nghiệp vụ.288tests/syntax91/build đạt; kiểm thử thư viện thật qua endpoint tới tạo sheet mẫu, chưa xác nhận download Google browser.

## 2026-11-17 — Bảo toàn nội dung RPC đã ký

Đã triển khai hai DEV@34 và đọc lại đủ5file khớp. Chưa nhập dữ liệu Google và chưa nghiệm thu sửa lỗi trên trình duyệt thật.

Gửi yêu cầu có chữ ký dưới dạng JSON ASCII, tránh cầu nối RPC tuần tự hóa lại từng trường trước khi backend kiểm tra. Server nhận cả JSON và đối tượng client cũ, từ chối JSON sai cấu trúc/quá lớn. HMAC, phiên, nonce và phân quyền giữ nguyên. Thêm kiểm thử Unicode/CRLF/số thập phân/tamper/replay/RBAC;287tests/syntax91. Lô91bản ghi chỉ thử trong mock, chưa ghi Google; cần xác nhận lại lỗi thực tế sau rollout.

## 2026-11-17 — Hệ thống đơn vị và cơ sở giá

Đã lên haiDEV@33, source da46387, readback5file khớp;285tests/syntax90. Không import dữ liệu hoặc thay file gốc/quyền Google. Bàn giao docs/UNIT_SYSTEM.md.

Tách package, purchase unit, usage/standard unit, original price and price basis trong provenance journal. Dùng chung cho cost/demand/inventory/counts/reports, không giả định mật độ hoặc giá bao gói; min/conversion trống được giữ. Admin có màn hình xác minh và source; guard đổi đơn vị đã có lịch sử. Import ghi provenance cùng transaction. Đã đọc2Excel gốc hashkhôngđổi;285tests/syntax90/build đạt; candidate chuẩn bị rollout DEV, không import dữ liệu thật.

## 2026-11-17 — Chuẩn bị dữ liệu cũ, chưa ghi Google

Nhận thêm bảng vật tư: parser và mapping giữ mã Unicode phân biệt, min theo đơn vị mua đổi sang đơn vị dùng, giá trống khác0, ô lỗi tồn chỉ lưu nguồn. Chuẩn bị lô gộp57bản ghi;279tests/syntax87;30vật tư/16nhóm công thức chưa đủ thông tin giữ staging. Chưa đọc/ghi Google hoặc đổi DEV32.

Thêm công cụ chuẩn hóa TSV công thức/catalog JSON, ánh xạ mã importer và giữ riêng dữ liệu thiếu/mâu thuẫn. Không tự điền giá0, gộp mã vật tư hoặc sinh giao dịch lịch sử.276tests/syntax85 đạt; lô22bản ghi đã qua preview/apply mock, chưa đọc/ghi đích thật. Dữ liệu nguồn riêng nằm trong output ignored. DEV32 không đổi.

## 2026-11-17 — Master DEV32,273kiểm thử local

M09 bổ sung: giữ trạng thái Chưa đủ dữ liệu cho giá vốn/lợi nhuận thiếu nguồn hoặc giá vốn ki-ốt chưa chốt; đơn giá nhập tùy chọn để trống. Batch cấu hình theo RPC, poll60s/focus, giữ fresh phiên/nonce/version; Properties calls mẫu31→5/59→12/64→9 trong mock. Backup hiện rõ trạng thái kiểm chứng. Source7f3bf88, chưa Google UAT.

Thêm chuỗi thu hồi→thực nhận→bán/hoàn tác ki-ốt; nhập mới/bù/bổ sung/điều chỉnh có preview/diff và giao dịch nguyên tử; liên kết đơn duyệt với kế hoạch hiện có. Bổ sung bảo mật phiên bền qua cache eviction, cảnh báo/quản lý phiên, ngân sách OAuth, bỏ lock lúc Google HTTP; kiểm tra nguồn/schema và backup có dấu kiểm tra. Sửa năng suất tổng/đạt, cột báo cáo, tỷ lệ hao hụt, chính xác tồn nhỏ và phụ cấp/ca trùng từ Sheets. Tối ưu index/cache API mới và tổng hợp lương Dashboard. Hai deployment DEV32/readback5file khớp; Google/ACL/visual/concurrency UAT còn chờ. Chi tiết docs/MASTER_RESULT_2026-11-17.md; không thay workbook gốc hoặc dữ liệu nghiệp vụ.

## 2026-11-16 — Styled Excel downloads

- Replace CSV output with real .xlsx, Vietnamese headers, CHIFAA title/source, frozen headers, filters and typed dates/numbers.
- Excel import template + instructions, read-back through existing preview/validation; retain legacy CSV/JSON input.
- Local embedded ExcelJS4.4.0, loading feedback, no CDN/data upload; 185tests/syntax52/build pass. Hosted/desktop visual UAT pending.

## 2026-11-16 ? Close verified login popup sooner

- Main window attempts popup.close immediately when oauthFinish issues a verified session, before session persistence and Sheets bootstrap.
- 177tests pass; popup test verifies close-before-bootstrap order. Browser sandbox/COOP may still block closing; hosted result not yet verified.

## 2026-11-16 ? G04 source validation

- Detect invalid permitted source rows beyond bootstrap page200; block reports and selected linked financial/stock writes without replacing raw errors with0.
- Validate checkbox/deletion cells before coercion; repeated scans retain invalid findings and record an unverified Sheet editor.
- 177 local/mock tests, syntax50/build pass; no schema change, Google UAT still pending. See docs/SOURCE_QUALITY.md.

## 2026-11-16 - Logic audit (no deployment)

- Reviewed current DEV14 logic; documented four locally reproduced data/payroll/report issues and a financial-page permission/display wiring issue.
- Added local-only audit reproducer and detailed completeness report; corrected outdated task/UAT/parity status.
- Existing121 tests still pass, syntax34 passes; these gaps are not proof of completed business acceptance. Live DEV remains14; no business rules or Google data changed.

## 2026-11-16 - DEV version 14

- Replace JSON account permissions with grouped sidebar-page/action checkboxes, group selection, existing-user editing and readable summaries.
- Add optional _routes metadata for explicit page visibility, source-read dependency disclosure and strict server validation; retain module/action authorization and legacy account compatibility.
- 121 tests pass and desktop/narrow layouts reviewed; both active DEV URLs updated to verified version14. No live account/workbook changes performed.

## 2026-11-16 - DEV version 13

- Polished responsive navy/orange login card and branding.
- Initial HTML now shows a dedicated branded loading screen; hide login during session restoration and bootstrap, with connection errors/Retry on the loading screen.
- 115 tests pass and local desktop/narrow Chrome layouts reviewed; both active DEV URLs updated to verified version13.

## 2026-11-16 - DEV version 12

- Request centered 520x680 Google OAuth popup on normal login click instead of default new tab.
- Preserve opener detachment, blocked-popup fallback, duplicate-click guard and best-effort close after signed bootstrap.
- 113 tests pass; both active DEV URLs updated to verified version12. Browser-controlled Google popup closure remains to confirm.

## 2026-11-16 - DEV version 11

- Restore unexpired signed application sessions after page reload using IndexedDB and non-exportable CryptoKey; keep business records in RAM.
- Recheck server session and current permissions before restoring workspace; clear on logout/revocation/expiry and preserve retry on network failure.
- 112 tests and real local Chrome reload/key persistence test passed; both active DEV URLs updated to version11. Hosted Google iframe reload confirmation remains pending.

## 2026-11-16 - DEV version 10

- Added 30-second per-user/permission bootstrap cache with forced fresh refresh and fail-safe Sheets fallback.
- Added contextual spinners and admin/audit skeletons; preserve displayed data during sync and reject stale route responses.
- Prevented overlapping sync; batch expired replay nonce cleanup and optimize duplicate-ID checks.
- 107 tests passed; both active DEV URLs updated to verified version10. Real Google latency/UAT remains pending.

# Changelog

## 0.2.0-dev — 2026-11-15

Thay GIS iframe + verifier Node bằng OAuth code/PKCE, callback `/exec`, back-channel Google UserInfo trong Apps Script. Giữ `_Users`, RBAC, audit, phiên Admin đơn; bổ sung HMAC với khóa RAM không export được và nonce ledger `_AuthRequests`, DEV workbook guard, thu hồi phiên khi đổi role/khóa tài khoản. Không đổi schema nghiệp vụ hoặc các route. Xóa service verifier khỏi source/package. Thêm hướng dẫn Cloud/OAuth/deploy và biên bản UAT hai tài khoản. Kiểm thử local không thay thế nghiệm thu Google DEV thật.

## 0.1.1-dev — 2026-11-15

Sửa cú pháp logical assignment `||=` trong payroll mà Apps Script editor của người dùng từ chối ở dòng 162. Thay bằng biểu thức tương đương, thêm kiểm thử chống tái xuất hiện trong backend. Cần chép lại dist/Code.gs và bật manifest V8 trong project Google; chưa kiểm thử trực tiếp runtime Google.

## 0.1.0-dev — 2026-11-15

Khởi tạo từ đầu vào được cung cấp, giữ phác thảo và logo gốc. Thêm logo navy chỉnh nét, nền tảng Apps Script/SPA, schemas, nghiệp vụ cơ bản, phân quyền/phiên, giao dịch/đồng bộ, portal riêng, importer, verifier, checks/tests và tài liệu. Chưa triển khai lên Google, chưa hoàn tất nghiệm thu nghiệp vụ hay tương đương toàn bộ phác thảo.
# DEV update — 2026-11-16

- Sidebar khôi phục nhóm đóng/mở, SVG, nhánh con, badge vật tư và trạng thái chọn theo phác thảo; vẫn lọc theo quyền.
- Phiếu mới tự điền snapshot giá/chiết khấu, lương/bộ phận/phụ cấp từ danh mục; loại công thức theo trang đang mở. Không sửa snapshot bản ghi cũ.
- Callback Google có giao diện xác nhận, nút đóng và hướng dẫn đóng thủ công; bỏ lời khẳng định chắc chắn auto-close sau phản hồi thực tế của người dùng.
- 95 kiểm thử đạt; đã kiểm tra ảnh local desktop/mobile. Đã triển khai version 6 lên hai URL DEV đang dùng; chưa nghiệm thu đầy đủ chức năng phác thảo hoặc hai tài khoản Google thật.

# DEV session fix — 2026-11-16

- Version 7: Admin xác minh Google lại có thể thay phiên cũ của chính tài khoản đó sau khi đóng tab; khóa ký cũ bị xóa và phiên cũ bị thu hồi. Không cho Admin khác chiếm phiên.
- Mở lại/tải lại vẫn cần xác minh Google vì khóa phiên chỉ lưu trong RAM. Không lưu token vào browser storage.
- 98 kiểm thử đạt; đã triển khai lên hai URL DEV hiện dùng. Kiểm thử đăng nhập lại trên trình duyệt thật đang chờ người dùng xác nhận.

# DEV logo update — 2026-11-16

- Version 8: dùng logo gốc mới do người dùng cung cấp, tách nền thành PNG trong suốt; bỏ logo bạc/nền navy cũ khỏi build.
- Thay tại đăng nhập, sidebar, Portal và bản xem trước; generator workbook dùng asset mới cho template tạo về sau. Không thay dữ liệu Sheets đang dùng.
- Đã kiểm tra alpha, ảnh trên nền xanh/trắng, build và 28 file JavaScript; triển khai hai URL DEV hiện dùng.

## 2026-11-16 — Chiến lược kinh doanh theo phác thảo (DEV v15)

- Làm lại màn hình riêng: tiêu đề xanh đậm, chọn ngày/tuần/tháng/quý/năm, 4 KPI, ưu tiên điều hành, 8 khối phân tích và bảng điểm bán/món.
- Dùng dữ liệu Sheets đã cấp quyền; biểu đồ xu hướng, hòa vốn, xếp hạng, phân bổ doanh thu, 12 tháng và kịch bản 30 ngày. Không dùng số mẫu hoặc coi hàng trả là hàng hủy.
- 127 test đạt; kiểm tra desktop/điện thoại 390px. Đã cập nhật hai URL DEV hiện có lên v15, không đổi dữ liệu hoặc backend. Hướng dẫn và giới hạn tại docs/CHIEN_LUOC.md; Google UAT còn chờ.

## 2026-11-16 — Rà soát kết nối và toast góc phải (DEV v16)

- Thêm toast thành công/lỗi/cảnh báo/thông tin, nút đóng, gộp trùng, tối đa 4 thông báo; tự ẩn và tạm dừng khi hover/focus. Hiển thị và tương tác được trên dialog bằng popover.
- Nối vào lưu/đảo/duyệt/xóa, cập nhật quyền/thu hồi phiên, đồng bộ, CSV, đăng nhập/đăng xuất, mất/kết nối lại và đơn Portal. Giữ lỗi tại chỗ; TIMEOUT/NETWORK là cảnh báo. Không spam thành công khi sync nền.
- Rà soát 36 route/RPC/hàm bảo trì; thêm docs/KET_NOI_CHUC_NANG.md. Chạy lại audit tái hiện các lỗi nghiệp vụ còn mở, không thay quy tắc kế toán hoặc dữ liệu.
- 132 test đạt, syntax39 và build đạt; Chrome desktop/390px xác nhận toast trên dialog có thể tương tác, không tràn ngang.

## 2026-11-16 — Nối 7 nhóm nghiệp vụ — DEV phiên bản 19

- Hai link DEV hiện có cùng chạy phiên bản 19; đã đọc lại bốn file từ Google và đối chiếu với bản build đã kiểm thử. Chưa khởi tạo bảng mới/chạy UAT Google thay người dùng.

- Sản xuất tự xuất nguyên liệu và snapshot giá vốn, kiểm kê tự điều chỉnh tồn; đảo nguồn hoàn tác theo lô, chặn hồi tố qua kiểm kê. Khóa/mở kỳ có lý do và kiểm tra backend.
- Portal có lịch publish/import/trả trạng thái, tạo workbook/thư mời và khách tra cứu đúng thư mời; dự án/URL Portal và lịch Google thật cần cấu hình.
- Phân bổ thanh toán theo nợ và thu nợ cũ không cộng quỹ hai lần; chặn trả vượt. Lãi vay tự nhập số tiền theo kỳ theo yêu cầu người dùng, xem trước/lập chi/chống trùng kỳ; không tự tính theo lãi suất. Lương–thưởng chốt tạo chi, snapshot/in lại/hoàn tác, chặn sửa chấm công đã chi.
- Màn hình Admin backup riêng tư/restore bản mới/CSV–JSON import có mẫu/xem trước/recovery; journal chunk có hash cho lô lớn. Phân trang server, lazy chunk cho báo cáo và CSV đầy đủ, mẫu in phiếu/lương/báo cáo.
- Ô Phiếu liên kết cấp ghi-only, không tự mở sổ quỹ/kho; backend chặn ghi trực tiếp sổ không được chọn. Giữ OAuth/RBAC/chữ ký/replay và DEV-only, không đổi cột nghiệp vụ hoặc ACL workbook.
- 164 test đạt; thử 5.101 dòng, Portal hai workbook mock, lương snapshot lớn/chunk và Chrome desktop/390px/mẫu in. Lãi nhập tay kiểm tra bằng DOM/API. Google UAT hai tài khoản, kích hoạt thực tế và dữ liệu legacy còn chờ. Hướng dẫn: docs/NGHIEP_VU_LIEN_KET.md.

## 2026-11-16 — Sửa timeout khi khởi động

- Tách thông báo tải/xác thực khỏi trạng thái ghi chưa rõ; giữ khóa phiên khi lỗi mạng để thử lại, không tự ghi lại phiếu.
- Bootstrap chờ tối đa 90 giây thay vì 25 giây; xác thực/kết nối thông thường 60 giây, thao tác bảo trì 180 giây. Spinner vẫn hiển thị khi chờ.
- Backend dùng lại một handle workbook trong từng RPC, giải phóng ở cả nhánh thành công/lỗi; không cache danh tính hay bỏ kiểm tra quyền.
- 166 kiểm thử đạt, syntax47 và build đạt. Chưa đo độ trễ trên Google bằng trình duyệt thật.

## 2026-11-16 — Giao diện quản trị đồng bộ — DEV phiên bản 21

- Hai link DEV hiện có đã cập nhật phiên bản 21; bốn file đọc lại từ Google khớp bản build đã kiểm thử.

- Thiết kế lại đăng nhập với nhận diện gọn, ô tài khoản rõ, nút Google nền trắng và biểu tượng bốn màu. Giữ nguyên xác thực và lưu phiên.
- Thêm theme dùng chung cho ứng dụng và Portal: chữ dễ đọc, cam có tương phản tốt hơn, sidebar/header gọn, form/dialog/bảng/báo cáo/thông báo nhất quán; số liệu căn phải và tabular.
- Có breakpoint desktop/tablet/mobile và focus bàn phím; không tải font/CDN ngoài, không thay đổi mẫu in. Chi tiết tại docs/GIAO_DIEN.md.
- 166 test, syntax47 và build đạt, CSS parse đạt. Không có trình duyệt kết nối để review hình ảnh mới; nghiệm thu thiết kế thực tế còn chờ.

## 2026-11-16 — Audit bộ yêu cầu đầy đủ, T00/T01

- Lưu nguyên ba tài liệu và SHA256, tách13chuyên đề. Tạo matrix78REQ, gapsP0/P1/P2,28quyết định, kiểm kê36route và báo cáo93ca acceptance.
- Baseline166test đạt, syntax47/build đạt; fresh remote HEAD đọc lại khớp DEV21. Không thay Google data/ACL/trigger/deployment trong audit.
- Auth owner/code/PKCE có code/mock, gate hai Gmail/ACL vẫn BLOCKED_GOOGLE_UAT; không báo Done vì chỉ có giao diện/mock.
- Người dùng xác nhận base net revenue trước chi phí cho Food cost32,2%/SX15%, hỗ trợ thu hồi là chi phí riêng, phần điểm chịu phải trả sau chiết khấu. Task kế tiếp sửa shared formula và tests.

## 2026-11-16 — D01/D02/D03: thống nhất doanh thu thuần và trần lương SX

- Net = bán + phần điểm chịu sau chiết khấu, trước chi phí; thu hồi/chi khác hạch toán riêng một lần. Tiền thu/thu nợ cũ không đổi net; thiếu/invalid không ra0.
- Food cost32,2% và SX15% dùng chung net trên report/targets/Strategy. Dư địa labor không trừ COGS, cần đủ nguồn/kỳ và đạt kế hoạch. Giữ cột dữ liệu cũ, không migration khi chỉ đổi read-model/label.
- Thêm4test cross-model, tổng170đạt; syntax49/build đạt. Returns/kiosk/AR và Google UAT còn mở; xem matrix/gap/decisions, không bật báo cáo chính thức.

## 2026-11-16 — Checkpoint yêu cầu / DEV22

- T00commitba0ad6c; source3896256 build/test170đạt từ gitarchive. File yêu cầu byte gốc khớp hash trong archive.
- Hai link DEV22 đã đọc lại4file và đối chiếu; giữURL, không data/schema/ACL/trigger writes. Không cần chạy setup cho thay đổi công thức read-model này.
- Auth haiGmail/ACL và legacy import vẫn blocked theo gate; checkpoint, matrix và93caacceptance không được đánh dấu nghiệm thu bằng testmock.


## 2026-11-17 — Performance final local validation

- 210tests, syntax58/build và bundle/runtime hash/logo/offline preview checks đạt. Thêm benchmark client40lượt/cỡ, trạng thái lưu/ACK và cách ly8tài khoản; sửa invalidation cache khi chỉ thay workflow.
- Mock lớn: lưu vật tư59→11getValues; sửa ô trực tiếp95→3; Index3,58→1,03MB. Không coi thời gian mock là Google SLA. Báo cáo đầy đủ, rủi ro đồng bộ và hướng dẫn deploy5file tại docs/PERFORMANCE_2026-11-17.md.
- Google/browser/concurrent UAT và cài trigger mới chưa thực hiện. Theo dõi phiên bản DEV cuối tại HANDOFF.md.

## 2026-11-17 - Performance PERF01/02 (local)

Scoped mutation dependencies, request-only reads, batch effects/audit/journal, module versions and safe read guard. 190tests pass; measured mock evidence and next phases in docs/PERFORMANCE_2026-11-17.md. Not deployed.

## 2026-11-17 - Performance PERF03-05 (local)

Lazy shell, scoped cache, aggregate dashboards/strategy, windowed exports, incremental onEdit/reconciliation, RAM router/read dedupe and pending/ACK handling. Shared logo and on-demand verified public Excel runtime reduce initial HTML. 206tests pass, Google/browser UAT pending.


## Performance DEV27 verified rollout - 2026-11-17

Source checkpoints7e93fa9/662ec7d/d3e45e8/7cff3c6. Fresh remote-before-performance backup matched26. Google initially rejected shared Strategy logical assignment; changed to equivalent conditional, added Apps Script syntax guard and reran210tests/syntax58/build successfully. Push5files succeeded; exact version27 readback matches Code/Index/Portal/ExcelRuntime bytes and manifest semantics. BOTH existing DEV app/callback deployments confirmed@27, historical@2 unchanged. No schema/setup/business data/ACL/trigger writes. Admin still needs to click "Cai lich scan, backup va Portal" in Nhat ky & dong bo to install incremental schedule. Real Google/browser/OAuth/concurrent-user latency unverified because no connected browser; do not mark PERF06 fully accepted. Full before/after metrics, changed files, risks and UAT steps: docs/PERFORMANCE_2026-11-17.md. Preserve unrelated pre-existing dirty files.


## Data loading follow-up Task1/2 - 2026-11-17

New pasted user task read fully. Baseline per-module and three-year period fixtures captured output/data-loading-before.json. Implemented chunked module index and bounded period/page reads, lookup/record APIs, optional versioned protected DEV-only report snapshots;216tests pass. Details docs/DATA_LOADING_2026-11-17.md. No Google/browser measurements (CUA inventory empty), no deployment yet (DEV27 remains live). Next frontend lazy lookups/recipe details, payroll/stock aggregates, queue/SWR, final benchmarks and DEV readback. No original workbooks edited.


## Data loading follow-up Task3-8 local checkpoint - 2026-11-17

223tests/syntax63/build/bundle/runtime hash/offline preview pass. Connected compact lookup + deferred recipe details, monthly/department payroll and paged inventory summaries, explicit RAM SWR/as-of status, read queue2 total/1 background with foreground priority and writes bypass. Task3/5 intermediate216tests passed; task7 regression222 and final index5000 test223 pass. Versioned report snapshots are owner-protected, optional DEV-only auto-create,128slots; no business history changes. Index uses compact tuples, Unicode-safe chunks, same-request cells reuse and fresh selected rows. PERFDIAGNOSTICS opt-in separates open/getValues/decode/JSON/server/transport-queue timings. Mock week-next read110085->855cells; Dashboard cache-eviction405241->205cells/41->5getValues. Cold source reads remain; exact limits and all-module evidence docs/DATA_LOADING_2026-11-17.md. Google/browser/2-5-8 concurrent accounts UAT still unavailable, not accepted. Fresh remote-before-data-loading backup matches verified27; deployment pending this entry. Preserve unrelated dirty files.


## Data loading report coverage completion - 2026-11-17

Added aggregate/snapshot/pagination for cost, demand and variance too, using shared domain functions and preserving source gates; no history download to browser to render these reports. Added parity regression;224tests/syntax63/build and final bundle syntax pass. Final metrics refreshed in docs/DATA_LOADING_2026-11-17.md with all five period-summary endpoints. Cold source dependencies remain complete for accuracy. Source HEAD uploaded once as candidate only, deployments still27 until final readback.


## Data loading DEV28 verified rollout - 2026-11-17

Source28604a7/ef30f54. Fresh backup matched27; exact28 readback matches5files (manifest semantic). BOTH existing DEV callback/app deployments confirmed@28; historical@2 unchanged.224local tests,syntax63/build/bundle/runtime hash/offline preview pass. No original workbook/business data/ACL/trigger/setup writes. DEV-only _ReportSnapshots may auto-create as a protected disposable cache after first authorized Admin report; no setup rerun. Rollback both IDs to27 if needed. Real Google/browser/2-5-8user UAT still pending (empty CUA inventory), not accepted from mocks. See docs/DATA_LOADING_2026-11-17.md for actual bottlenecks, per-module before/after, cold-read limits and next tests. Preserve pre-existing unrelated files.


## MASTER M00 audit checkpoint - 2026-11-17

Full new master request preserved docs/MASTER_REQUEST_2026-11-17.md. Baseline224tests pass; repository document inventory/hashes output/master-repository-inventory.json. Existing auth/performance DEV28 not restarted. Created required DECISIONS_REQUIRED.md, TEST_RESULTS.md, PERFORMANCE_REPORT.md, DEPLOYMENT_GUIDE.md and docs/MASTER_AUDIT_2026-11-17.md, with M01-08 backlog. M01 next: OAuth rate guard/no network under global lock, session metadata and alert UI. Google/legacy/policy blockers remain explicit. Existing unrelated dirty files retained; no source workbook/ACL/Google data writes.


## MASTER M01 - 2026-11-17

Implemented persistent global OAuth-start budget (default30/minute; config10..120), short callback state locks with Google HTTP outside the global lock, optional client-declared device hints/server lastSeen, Admin security alerts and idempotent acknowledgement. Session revocation/role disable clears signing cache and device metadata; metadata never authorizes access. Files: src/server/security.js,auth.js,oauth.js; src/client/app.js; scripts/build.mjs; tests/gas-mock.mjs,security-center.test.mjs; rebuilt dist. Validation:228/228 local tests,syntax65/build pass (output/master-m01-tests.txt). Google OAuth/browser/concurrency UAT remains pending; live DEV28 unchanged. Global budget is a quota guard, not IP identification; no secret/token shown in security UI. Next M02 return/kiosk physical lifecycle.


## MASTER M02 - 2026-11-17

Added authenticated Thu hoi & ki-ot screen/API using existing _Workflows journal (no business-schema rewrite). Approval -> physical receipt -> bounded sale from remaining lot quantity; rejected returns never enter stock. Sale creates one sales voucher and one linked consumption marker atomically; Admin undo reverses linked sale before receipt/approval, preserves original history. Source hashes/direct-edit checks, closed periods, scoped grants, durable idempotency, rollback and unknown-outcome retry retained. No return approval/receipt creates revenue or treats returned goods as spoilage. Store-borne revenue/D03 expense remain in original sales calculation.233/233 local tests pass including100/80/10/10, replay, overdraw, rollback, undo and UI double-click;syntax68/build passed before final UI test. New src/server/kiosk.js,src/client/kiosk-view.js; integrations schema/access/navigation/app/api/storage/workflows/build/test loaders. Quantity only: valuation/batch/expiry D16 not decided, explicitly pending. Source reads are scoped sales/stores/dishes plus workflow ledger; cold scan of these remains, response pages100. No Google deployment or source workbook edits. Next M03 entry commands and M04 productivity.


## MASTER M03 - 2026-11-17

Added entry API and Nhap co kiem tra UI for immutable operational vouchers: NEW/BACKFILL/APPEND/CORRECT. Mandatory server preview digest includes relevant source hashes and workflow state. Correction prepares reversal+replacement+linked stock effects in one existing journal transaction; no intermediate committed reversal. Scope is explicitly one selected voucher:100base+30append,correct base to90 ->120; correcting that replacement to60 ->90 total. Existing append remains intact. Preview diff, reason, closed periods, grants, stale-source refusal, rollback, retry same request and logout/permission-change private-dialog cleanup covered. Extracted mutationEffects_/mutationAccess_ without changing ordinary mutate behavior.237/237 local tests;syntax71/build pass before final UI regression. Files: src/server/entry.js,api.js,workflows.js; src/client/entry-view.js,app.js,kiosk-view.js; build/test loaders; tests/entry.test.mjs. Existing simple create remains for compatibility; checked flow is additional. Cold correction intentionally validates all dependencies; no claim of Google latency. No Google deployment/data writes. Next M04 shared productivity and variance percentage.


## MASTER M04 shared KPI correction - 2026-11-17

Primary productivity now total produced+extra / SX hours; achieved output/hour remains goodProductivity, separate total/rejected/good fields. Missing SX attendance on any production date returns unknown, not inflated ratio. Shared report drives targets and strategy. Variance adds signed difference/theoretical percentage (100actual/90norm=11.11%; denominator0 ->null). Fixed remote cost/demand/variance headers incorrectly inherited from inventory and repaired mangled price labels. Bumped READ_MODEL_VERSION to invalidate old report snapshots.240/240 local tests,syntax72/build pass. Files shared/domain.js,strategy.js,server/read-model.js,client/app.js and KPI/domain tests. Configurable thresholds/bonus policies and Google daily/monthly UAT remain pending; no invented defaults. DEV28 unchanged.


## MASTER M05 inspection/backup - 2026-11-17

Added Admin read-only source issue workbench (module filter,100issues/page, row/ID/reason, route link). Native private backups now compare canonical hashes/row/column counts for known business/system tables before copy, copied workbook, and source after copy. Manifest stored in main audit; LAST_BACKUP updated only after successful comparison. Registered-copy verification UI; modified or legacy-manifestless backup is refused by restore API. Restore still creates a review workbook and never switches SPREADSHEET_ID. Scope explicitly excludes disposable cache, unknown schema tabs and Script Properties; native copy preserves other workbook content but does not claim independent verification of it. Verification bounded2.5million cells/pass; large data needs separate batch verification.243/243 local tests,syntax74/build pass; Google Drive ACL/restore-drill remains external UAT. Files server/inspection.js,operations.js,maintenance.js; client/operations-view.js; build/mock loader;tests/inspection.test.mjs. No original workbook edits/Google deployment.


## MASTER M06 explicit order-plan link - 2026-11-17

Added authenticated orderPlans/linkOrderPlan API and approved-order row dialog. Authorized orders+production approver explicitly maps one approved order into an existing same-dish plan with remaining planned capacity; quantity is not added to planned/stock/revenue/demand. Duplicate/replay/over-allocation/stale source/closed-day controls; unlink reason and append-only audit. Linked plan reversal/correction blocked until unlink. Source edits flag stale links instead of silently recomputing; private contact/customer omitted from planning response. New read endpoints use global read/write stamp guards.247/247 local tests;syntax77/build passed before final read-guard/UI regressions. Files server/order-planning.js,api.js,workflows.js,storage.js,inspection.js; client/order-planning-view.js,app.js; loaders;tests/order-planning.test.mjs. Existing Portal separate-workbook lifecycle remains; actual Portal project/ACL/invites/status UAT blocked by Google resources, no automatic merge D22 chosen. No Google data or deployment changes.


## MASTER M07 safe units/schema checkpoint - 2026-11-17

Added shared mass/volume unit ratio validation and editor hints:kg->g1000,l/lit->ml1000; incompatible mass/volume refuses implicit density. Custom bags/cans/bottles retain explicit user-supplied conversion; cooking yield remains separate recipe yield. Exact fixture114g cooked x100 /2.5 =4.56kg raw and91200 at20000/kg tested;2.5 is never a default. Centralized unchanged schema definitions; read-only Admin schema diff, and initialize still preflights every table before writing any header. No columns added/reordered or source data auto-converted.250/250 local tests,syntax78/build pass. Files domain.js,inspection.js,maintenance.js,operations.js,client/app.js,operations-view.js;tests/units-schema.test.mjs. Normalized recipe-line database migration/effective price schema remains blocked by source/UOM/policy approval; existing JSON recipe and dated receipts/snapshots preserved. Google UAT still pending. Next M08 cross-feature performance/index review, matrix refresh, DEV-only readback rollout if authorized environment permits.


## MASTER M08 integration checkpoint - 2026-11-17

258/258 local tests;syntax80/build pass. Indexed return/order/production marker joins remove quadratic scans; new scoped20second report caches retain fresh auth, version/stamp guards, force refresh and read queue. Reproducible benchmark scripts/benchmark-master.mjs100/1000/5000:5000cold kiosk3069.21->374.87ms (28reads/275085cells unchanged),orderPlans3164.73->442.69ms (33reads/310075cells unchanged apart from nonce3cells); hot3authreads15/21cells. Node/mock single runs, NOT Google latency. Backup now short claim/final locks, Drive/hash reads outside global lock, core consistency + app-stamp verification; failed creation consistency cannot later be promoted merely by checksum equality. Quantity precision preserves .001kg stock/count adjustments, variance excludes stocktake adjustments from physical incoming. Direct Sheets duplicate allowance and overlapping overnight shifts now block payroll; fixed old benchmark employee fixture to avoid duplicate overlapping shifts (historical performance fixtures not directly comparable). Server app-session signing credentials now also owner-only Script Properties with TTL/fingerprint, bounded80index, cleanup on revoke/disable/recovery; cache eviction no longer forces re-login and signatures/durable nonce replay checks remain. Google tokens/Client Secret never copied to UI or business sheets; Script Properties credentials are NOT included in workbook backups. CUA rechecked apps:[],browsers:[]; real Google/ACL/concurrent/visual UAT blocked. Live DEV28 until verified new rollout.


## MASTER final Dashboard payload follow-up - 2026-11-17

Removed unused employee-level payroll array from Dashboard RPC; now at most three department aggregates, while payroll details stay behind paged payroll API. Backend shared report/targets/strategy calculations unchanged. Bumped read-model version.260/260tests,syntax80/build pass. Final valid distinct-employee fixtures output/data-loading-master-final.json:5000cold Dashboard42reads405246cells/8877bytes; durable snapshot5reads205cells/8879bytes. Cold payroll18reads150255cells/10875bytes,hot3reads84cells. Single Node/mock run, not Google SLA; old overlapping-worker benchmark fixture is historical and not a valid payroll-comparison baseline. Intermediate DEV29 deployed/readback verified; final small code change pending versioned rollout.


## MASTER recovery QA follow-up - 2026-11-17

Added authenticated owner-scoped requestStatus returning only journal state (no effects/records). Unknown kiosk key now survives SPA navigation; retries keep same operation/key. Entry/kiosk/order-link and legacy editor only unlock a replacement after confirmed ROLLED_BACK, never from NOT_FOUND/PREPARED/timeout. Late responses fenced by session/grant scope; logout/permission change clears private pending dialogs. Pending state is RAM, not a durable business outbox: hard reload/closing an unconfirmed write still requires checking source/journal before starting a new voucher.267/267 tests,syntax81/build pass, including cross-account/grant-change callback races. Live DEV30 until verified rollout of this source.


## MASTER M09 checkpoint - 2026-11-17

273/273 local tests; syntax83/build pass. Financial completeness guards, request-local static configuration batching, visible-page sync60s/focus refresh and backup verification feedback. See docs/MASTER_M09_2026-11-17.md. Candidate built; verified DEV31 remains live until final source readback and rollout.

## 20/11/2026 — Giá vốn món bán theo công thức thực tế (KH-01/KH-11)

Danh mục món bán bỏ cost lấy từ dữ liệu nguồn cũ; hiển thị giá vốn tính từ công thức liên kết và giá vật tư đã xác minh theo ngày chọn. Chưa liên kết công thức hoặc thiếu giá thì không thay bằng số cũ. Bỏ hai nút thao tác công thức/công bố liên kết theo yêu cầu; RPC backend giữ nguyên.

Đã xác nhận bằng 132/132 test, typecheck, lint, build, kiểm tra responsive danh mục thương mại và công thức ở 320–1440px. Migration 047 chưa áp dụng DEV/Supabase; chưa deploy.

## 20/11/2026 — Danh sách chấm công theo nhân viên (KH-02/KH-09/KH-10)

Bỏ nút “Thêm mới” ở trang chấm công. Trang hiển thị danh sách nhân viên theo ngày; chọn giờ vào/ra và nghỉ giữa ca, sau đó tích “Đã làm” để ghi ca. Giờ kết thúc sớm hơn giờ bắt đầu được lưu sang ngày kế tiếp. Có thể chọn ngày cũ để sửa giờ; sửa và bỏ chấm công đều đi qua RPC chứng từ hiện có để giữ liên kết kiểm toán. Mức lương và phụ cấp tiếp tục chỉ hiển thị theo quyền lương. Điện thoại dùng thẻ nhân viên, desktop dùng bảng.

Đã kiểm tra bằng 132/132 test, typecheck, lint, build và fixture responsive 50 bố cục ở 320–1440px; fixture kiểm tra sửa ca, giữ nguyên idempotency khi retry và ca qua đêm. Không sửa schema, không áp SQL lên Supabase/DEV và chưa deploy.

## 20/11/2026 — Định dạng số file Excel tồn kho (KH-01/KH-09)

Các cột tồn hiện tại, tối thiểu và giá trung bình trong workbook được ghi thành ô số, áp dụng định dạng `#,##0.######`. Excel hiển thị số nguyên không có sáu số 0 dư, vẫn giữ phần thập phân khi có; mã vật tư vẫn là văn bản để bảo toàn số 0 đầu mã.

Đã xác nhận bằng 137/137 test, typecheck, lint và build. Lần chạy test đầu bị Windows chặn tiến trình esbuild trong sandbox; chạy lại với quyền khởi chạy tiến trình và toàn bộ test đạt. Không thay đổi dữ liệu/schema, không áp migration lên Supabase/DEV và chưa deploy.

## 21/11/2026 — Hoàn thiện xem trước và xác nhận nhập Excel kho (KH-01/KH-09/KH-10)

Làm lại hộp thoại rà soát file với tổng mã vật tư, số dòng cộng tồn, dòng chỉ cập nhật danh mục, dòng chưa có giá và tổng lượng theo từng ĐVT. Bảng cuộn xem đủ các dòng, phân biệt dòng cộng tồn với dòng danh mục; cảnh báo rõ giá trống không phải 0đ. Nút xác nhận nêu đúng tác động của file; bố cục hỗ trợ mobile và desktop.

Đã xác nhận bằng 137/137 test, typecheck, lint, build và fixture Chromium kho tại 320–1440px; modal kiểm thử ở 320px/1440px, không tràn trang, payload giữ riêng giá 0, giá chưa rõ và dòng không nhập thêm. Không thay đổi schema/dữ liệu, không áp migration lên Supabase/DEV và chưa deploy.

## 21/11/2026 — Nhập số lẻ tồn kho bằng Excel (KH-01/KH-09/KH-10)

Chỉnh định dạng số trong workbook để số nguyên không hiện dấu chấm dư; hướng dẫn cột nhập tồn nêu rõ số lẻ tối đa 6 chữ số (ví dụ `1.2`, `3.32`). Kiểm tra parser, preview và RPC giữ đúng lượng nhập lẻ, cộng tồn và ghi lịch sử.

Đã đạt 138/138 test, typecheck, lint, build, kiểm tra kho riêng và fixture giao diện responsive. Không đổi schema/dữ liệu, không áp migration Supabase/DEV và chưa deploy.

## 21/11/2026 — Phân quyền tài khoản lấy trực tiếp từ database (KH-10)

Bỏ phụ thuộc vào việc liệt kê Supabase Auth khi mở trang Tài khoản & phân quyền. Danh sách, số liệu bật/tắt, role và quyền lấy từ database; thao tác lưu role/quyền tiếp tục qua RPC `admin_assign_user`. Chức năng gửi lời mời email vẫn dùng Edge Function.

Đã đạt 138/138 test, typecheck, lint, build và fixture Chromium `--accounts`, gồm trường hợp Auth list lỗi nhưng trang vẫn tải, xem và lưu role/quyền được. Không đổi schema, chưa áp dụng cloud hay deploy.

## 2026-11-22 — Nhập xuất Excel danh mục vật tư (KH-01/KH-09/KH-10)

- Thêm nút xuất/nhập Excel ở Danh mục vật tư. File xuất có 10 dòng trống để thêm mã; nhập có xem trước, nhận diện bản ghi bằng ID/phiên bản ẩn, và không chứa tồn kho hay thao tác xóa vật tư.
- Migration `202611220050_material_catalog_excel.sql` thêm export theo quyền và import 200 dòng/giao dịch, có kiểm tra phiên bản, audit, idempotency; giá sửa chuyển sang chờ xác minh, không tạo phiếu kho.
- Typecheck, lint, 141/141 test, build và fixture Chromium tại 320/390/1440px đạt. Chưa áp SQL lên Supabase/DEV, chưa deploy hoặc UAT cloud.

## 2026-11-22 — Sắp xếp danh mục vật tư (KH-01/KH-10)

- Bổ sung bộ chọn thứ tự mặc định, tên A–Z, tên Z–A, mới nhất và cũ nhất. Truy vấn PostgreSQL sắp xếp trước phân trang; đổi thứ tự sẽ quay về trang đầu. “Mới nhất/cũ nhất” dùng thời điểm tạo vật tư, với mã và ID làm tiêu chí ổn định khi trùng.
- Migration `202611220051_material_catalog_sort.sql` giữ RPC cũ cho client hiện tại và tạo `material_catalog_sorted` với cùng quyền, bộ lọc và dữ liệu danh mục. Không thay đổi giá, tồn hoặc lịch sử nghiệp vụ.
- Typecheck, lint, 142/142 test, build và fixture Chromium danh mục tại 320–1920px đạt; fixture xác nhận 4 lựa chọn gửi đúng tham số RPC. Chưa áp SQL lên Supabase/DEV, chưa deploy hoặc UAT cloud.

## 2026-11-22 — Chấm công luân phiên bộ phận, lương theo vị trí (KH-02/KH-07/KH-10)

- Thêm chọn bộ phận thực tế theo từng ca và mức lương hiệu lực riêng theo nhân viên/bộ phận. Chặn lưu khi bộ phận đó chưa có mức lương.
- Giữ snapshot bộ phận chính, bộ phận thực tế và lương đã áp dụng trên ca; bảng lương hiển thị bộ phận, mức lương theo ca, và nhãn “Đổi vị trí trong ca” cùng vị trí chính trong chi tiết.
- Kiểm tra local: 144/144 test, typecheck, lint, production build và browser fixture attendance/payroll. Migration 053 chưa áp cloud/DEV; chưa deploy.

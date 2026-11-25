## 2026-11-25 — Thứ tự món trong bảng tổng hợp khách đặt hàng (KH-01/KH-10/KH-12)

- Sắp cơm nắm theo ảnh mẫu, tiếp đến cơm cuộn/cơm cuộn chiên, mì trộn rồi hai món nguyên cây; cùng thứ tự trên màn hình, bản in và Excel. Theo mã món ổn định, giữ tên thực tế, món ngoài danh sách ở cuối và không thay số lượng/tổng.
- 219/219 full tests, typecheck, lint, build và browser orders320/390/1280px đạt, gồm kiểm tra bảng/Excel giữ thứ tự và số lượng. Chi tiết phát hành trong `HANDOFF.md`. Không cần SQL hoặc thay dữ liệu nghiệp vụ.
- Đã push `c302c3b`; Vercel xác nhận triển khai hoàn tất. Chưa UAT trong phiên đăng nhập với dữ liệu thật.

## 2026-11-25 — Xác minh quy đổi bán có hiệu lực cho ngày tương lai (KH-01/KH-10/KH-11/KH-12)

- Bổ sung hồi quy cho liên kết lưu một lần tiếp tục dùng ngày hôm sau/tháng sau/năm sau; sửa/công bố nguyên liệu theo ngày mới giữ quy cách bán và không đổi kết quả ngày cũ/snapshot.
- 4/4 tests tập trung, typecheck, lint và build đạt; không đổi runtime/schema hoặc áp SQL cloud. JSON/evidence là dữ liệu khai báo và căn cứ audit; ngày25/11 là ngày bắt đầu hiệu lực.

## 2026-11-25 — Gói sửa liên kết món bán đã được xác nhận (KH-01/KH-10/KH-11/KH-12)

- Chuẩn bị SQL owner cho các tỷ lệ/ngày do người dùng xác nhận, với kiểm tra công thức published, đơn vị, kỳ mở, xung đột và replay; lưu audit/provenance, tăng version món bán như luồng commercial hiện có. Config và SQL chứa dữ liệu thật chỉ nằm trong ignored `output/`.
- 217/217 tests, typecheck, lint và build đạt. Ba hồi quy PostgreSQL xác minh một đơn vị bán dùng đủ một mẻ, hai tỷ lệ độc lập, giữ lịch sử sản xuất/kho và rollback toàn bộ khi dữ liệu mâu thuẫn. Chưa chạy cloud; cần áp file dữ liệu và UAT báo cáo đúng ngày. Chi tiết xác nhận và kiểm chứng cuối trong `HANDOFF.md`.

## 2026-11-25 — Khôi phục nút liên kết công thức trong món bán (KH-01/KH-10/KH-11/KH-12)

- Danh mục món bán có lại **Liên kết công thức**, cho lưu tỷ lệ đã xác minh từ đơn vị bán sang đơn vị đầu ra và ngày áp dụng qua RPC hiện có.
- Form nêu rõ hướng quy đổi, không tự mặc định tỷ lệ 1, lọc phiên bản theo ngày đang nhập và làm mới nhu cầu/kế hoạch sau lưu. Không cần SQL mới, không tự nhập quy cách kinh doanh.
- 214/214 tests và kiểm tra trình duyệt 20 tổ hợp danh mục/kích thước đạt; quyền xem, payload và gửi lại được xác minh. Chi tiết phát hành/UAT trong `HANDOFF.md`.
- Đã push `5da32e9`; Vercel báo triển khai hoàn tất. Còn xác nhận tỷ lệ kinh doanh và lưu liên kết/UAT thật; không tự ghi 14/16 vào dữ liệu cloud.

## 2026-11-25 — Xác nhận SQL công thức sẵn sàng phát hành (KH-01/KH-10/KH-11/KH-12)

- Owner đã chạy gói SQL 087–090 và gửi cả hai cờ sẵn sàng bằng `true`; cho phép push frontend tương ứng lên nhánh Vercel. Chưa xác nhận UAT công bố dữ liệu thật.
- Đã push `041d416` lên `chifaa-next-dev`, gồm bản sửa 089/090; GitHub status xác nhận Vercel triển khai hoàn tất. Chưa có phiên đăng nhập được kết nối để UAT công bố/nhu cầu thật; không ghi dữ liệu nghiệp vụ.

## 2026-11-25 — Kiểm chứng đơn vị kho cũ và chuẩn bị gói công bố công thức (KH-01/KH-10/KH-11/KH-12)

- Xác nhận hồi quy khi snapshot cũ dùng túi nhưng quy đổi công thức mới dùng bì/cái: công bố theo ngày mới giữ đúng tỷ lệ đã xác minh, không sửa lịch sử.
- Gói cập nhật087–090 và SQL kiểm tra chỉ đọc giúp phát hành đủ backend trước frontend; hỗ trợ cài nối tiếp, replay và rollback toàn bộ nếu lỗi. Không tự áp cloud hoặc công bố công thức thật.
- Nhánh local vẫn có hai commit 089/090 chưa có trên remote tracking; ảnh đang gọi luồng frontend cũ. 213/213 tests, typecheck, lint và build đạt. Chi tiết bằng chứng và phần phát hành/UAT còn lại ở `HANDOFF.md`.

## 2026-11-25 — Công bố bản nháp theo ngày đang chọn và nhận đúng công thức đã sửa (KH-01/KH-10/KH-11/KH-12)

- Migration 090 thêm `publish_recipe_at`: tạo phiên bản mới cho cây công thức con/topping còn nháp từ ngày cũ rồi kiểm tra/công bố trong một transaction theo ngày đã chọn. Giữ định lượng, đơn vị, tỷ lệ bán có nguồn, cờ miễn giá, dòng chưa xác định và tham chiếu bản đã công bố; thiếu quy đổi vẫn chặn toàn bộ lần công bố.
- Cho công bố chỉnh sửa nhiều lần cùng ngày, giữ các phiên bản cũ và audit liên kết món bán. Tỷ lệ bán được giữ đúng cho từng liên kết đang dùng; thay đơn vị đầu ra phải xác minh lại tỷ lệ.
- Form tự kiểm tra/công bố mọi nhóm công thức khi đủ quyền; dùng đúng phiên bản/ngày được server trả về, giữ đúng tên công thức con vừa sửa và khóa nội dung/khóa gửi lại khi phản hồi chưa chắc chắn. Giao diện báo rõ nếu máy chủ chưa cài 090.
- Bằng chứng kiểm tra và bước phát hành được ghi ở checkpoint tương ứng trong `HANDOFF.md`.

# 2026-11-24 — Đồng bộ công thức cùng mã với nhu cầu đơn đã duyệt (KH-01/KH-10/KH-12)
- `planning_needs` nay dùng công thức sản phẩm cùng mã đã công bố khi chưa có liên kết tường minh; chỉ dùng hệ số 1 nếu đơn vị đầu ra trùng đơn vị bán, còn quy đổi khác đơn vị phải có tỷ lệ nguồn/lưu đã xác minh.
- Cảnh báo nhu cầu phân biệt thiếu công thức với thiếu tỷ lệ và được dùng chung trong Excel.
- Migration `202611240086_use_same_code_recipe_for_order_demand.sql`; cần áp dụng theo quy trình phát hành trước khi backend cloud sử dụng thay đổi.

## 2026-11-24 — Cảnh báo nhu cầu nguyên liệu nêu rõ món thiếu cấu hình (KH-01/KH-10/KH-12)
- Đơn đã duyệt có thể còn ở trạng thái chưa lập kế hoạch theo migration 084. Nhu cầu vẫn chỉ tính cho món có liên kết công thức đã công bố và tỷ lệ quy đổi hiệu lực trong ngày giao.
- Thay mã `PUBLISHED_PRODUCT_RECIPE_REQUIRED` lặp lại bằng hướng dẫn tiếng Việt, nêu tên/mã món từ ma trận và chỉ nơi cần thiết lập. Không suy đoán tỷ lệ hoặc bung BOM mới hơn vào nhu cầu chứng từ cũ.
- Xác minh: test helper cảnh báo đạt; `npm test` 187/187, typecheck, lint và build đạt. `npm run test:orders` vẫn lỗi fixture cũ tại nút “Chi tiết món đơn …”, trước phần tổng hợp.
- Còn lại: cần liên kết công thức và tỷ lệ có hiệu lực cho món báo lỗi để tính được vật tư thực tế. Chưa truy cập/đổi dữ liệu Supabase; không áp SQL hoặc deploy.

## 2026-11-24 — Điền sẵn thông tin điểm bán cho link order (KH-10/KH-12)
- RPC catalog qua link hợp lệ trả tên, địa chỉ và liên hệ của đúng điểm bán liên kết; link thường vẫn chỉ nhận catalog chung. Không mở quyền đọc danh sách/bảng điểm bán.
- Form tên người nhận, số điện thoại và địa chỉ tự điền từ danh mục, vẫn cho khách sửa. Chỉ điền một lần theo link, không ghi đè khi catalog tự tải lại. Trường `Liên hệ` của danh mục được map vào số điện thoại vì schema chưa có điện thoại riêng.
- Kiểm tra: 186/186 tests, typecheck, lint và fixture trình duyệt 6 kích thước đạt; migration có test link hợp lệ và từ chối token không hợp lệ.
- Cần áp migration `202611240085_prefill_public_order_contact_from_store.sql` lên Supabase trước khi phát hành frontend. Chưa chạy SQL cloud hoặc deploy.

## 2026-11-24 — Cho duyệt đơn dù chưa đủ dữ liệu lập kế hoạch; sửa số lượng nguyên (KH-01/KH-10/KH-12)
- Migration 084 tách quyết định duyệt đơn khỏi điều kiện tự lập kế hoạch: thiếu công thức/quy đổi hoặc công thức topping thì đơn vẫn được duyệt, còn ở trạng thái `approved` và không có kế hoạch cho đến khi thiết lập đủ. Khi dữ liệu đủ, tự lập kế hoạch vẫn chạy nguyên luồng.
- Form sửa/thêm món dùng bước 1, làm gọn `10.000000` thành `10` và kiểm tra số nguyên dương; RPC từ chối số lượng lẻ trước khi thay đổi đơn/lịch sử.
- 186/186 tests, typecheck, lint và build đạt. Migration cloud chưa được áp dụng; cần chạy `supabase/migrations/202611240084_allow_order_review_without_production_setup.sql` trên Supabase để lỗi trong ảnh hết.

## 2026-11-24 — Gọn thẻ món và topping trên cổng đặt hàng (KH-10/KH-12)
- Đưa số lượng món ngay dưới giá, bỏ kéo giãn thẻ không có topping và cho số cột thích ứng theo chiều rộng thực đơn.
- Rút ngắn tiêu đề, bỏ đơn vị lặp trên nhãn hiển thị, làm gọn trạng thái phân bổ và tách bộ chỉnh số phần topping khỏi dòng tên. Checkbox vẫn có nhãn truy cập đầy đủ.
- 184/184 tests, typecheck, lint, build và fixture trình duyệt ở 6 chiều rộng đạt; đã xem ảnh mobile/desktop có topping được chọn. Tiêu chí chọn đủ topping, giỏ hàng, payload và retry tiếp tục đạt.
- Đã push và xác minh giao diện live trên Vercel với dữ liệu Supabase hiện tại; desktop/mobile hiển thị gọn, không tràn ngang, chọn topping bắt buộc hoạt động. Không gửi đơn thật khi kiểm tra.

## 2026-11-24 — Xác nhận kết nối topping trên Supabase thật (KH-01/KH-10/KH-11/KH-12)
- Owner đã áp gói SQL 081–083. Kiểm tra RPC công khai xác nhận API v2 sẵn sàng và ba món CC/CCC/CCC-NC có STO/STC, bắt buộc chọn và không có lựa chọn chưa sẵn sàng.
- Kiểm tra live `check-public-toppings.mjs --expect=CCC-NC` đạt; đã push frontend và kiểm tra sau khi Vercel triển khai. Trên trang thật, CCC-NC hiện hai topping; số lượng 2 phải phân bổ đủ (có thể chia 1+1), còn thiếu thì khóa gửi; CC-NC chưa cấu hình không hiện topping. Màn 390 px không tràn ngang. Không tạo đơn hoặc thay đổi dữ liệu thật trong bước xác minh.

## 2026-11-24 — Lấy topping từ cấu hình món đã lưu và bắt buộc chọn khi đặt (KH-01/KH-10/KH-11/KH-12)
- Xác nhận qua RPC Supabase thật: 10 món công khai nhưng catalog topping rỗng; số lượng món không phải nguyên nhân. Catalog mới đọc cấu hình đã lưu có hiệu lực mới nhất, không bị bản công thức liên kết cũ che lựa chọn mới.
- Lưu món bằng tài khoản có quyền duyệt tự công bố riêng các topping đã tích. Giữ đúng phiên bản topping bất biến cho đơn; không buộc công bố toàn bộ BOM món để hiện lựa chọn, không tự suy quy đổi hoặc phụ thu.
- Khách phải chọn đủ một phần topping cho mỗi món có cấu hình; có thể chia nhiều loại. Kiểm tra ở cả UI/PostgreSQL, chặn đường RPC cũ bỏ qua và giữ nguyên snapshot/retry lịch sử. Sửa kiểm tra JSON và tính cost theo số phần topping thực sự phân bổ.
- API topping có phiên bản để nhận biết database chưa cập nhật; lỗi tải, cấu hình chưa sẵn sàng hoặc lựa chọn đã thay đổi đều báo rõ và khóa gửi đơn.
- 184/184 tests, db types, typecheck, lint, build, 21 ca PostgreSQL tập trung và browser fixture phần khách đặt hàng đạt. Gói SQL một giao dịch 081–083 được thử từ các trạng thái 080/081/082 và chạy lại an toàn; có script kiểm tra API live chỉ đọc.
- Chưa áp SQL cloud; cần người quản trị chạy `output/CHIFAA_TOPPINGS_081_083.sql` trước khi phát hành frontend mới và UAT dữ liệu thật. Các topping nháp được chọn từ trước cần lưu lại món bằng tài khoản có quyền duyệt.

# 2026-11-24 - Show configured toppings before entering dish quantity (KH-10/KH-12)
- Fixed the public ordering card hiding configured topping options until the dish had a nonzero quantity.
- Topping choices now appear on their configured dish card immediately. Checkboxes remain disabled at zero quantity with a short instruction, become selectable after adding the dish, and selections stay on that dish's basket line without changing its sale price.
- Verified typecheck, lint, production build, and the public portal browser fixture at six viewport widths. The fixture confirms toppings show at zero, unlock after increasing quantity, and can be selected into the basket.
- The browser fixture uses mocked API data. Migration 082 and the frontend have not been applied/deployed to Supabase/live portal.

## 2026-11-24 - Tự công bố công thức món và hiển thị topping theo mã món (KH-01/KH-10/KH-11/KH-12)
- Gỡ nút công bố phiên bản riêng. Lưu công thức món bằng tài khoản có quyền duyệt sẽ tự công bố; phiên bản vẫn ở nháp nếu thiếu quyền hoặc lỗi kiểm tra.
- Công bố topping đã tích và các công thức con từ dưới lên trong một giao dịch; kiểm tra chu kỳ, ngày hiệu lực và BOM. Nếu món đã có quy đổi hiệu lực theo đúng mã thì giữ tỷ lệ; không tự tạo quy đổi khi chưa có.
- Cổng trả topping theo công thức liên kết hiệu lực, hoặc theo mã công thức khớp chính xác với món đã công bố khi chưa có liên kết. Đơn hàng tiếp tục hiển thị checkbox chọn topping theo từng món và giữ phân bổ tách khỏi giá bán.
- Xác minh local: 176/176 tests, typecheck, lint, production build, fixture công thức (25 route/kích thước) và PGlite migration/rollback đạt. Fixture portal qua các ca topping nhưng dừng ở bước admin chờ “Xem đơn”; fixture order review dừng trước chi tiết đơn. Chưa có UAT Supabase.
- Chưa áp migration cloud hoặc deploy frontend.

## 2026-11-23 - Derive stock transitions from verified package ratios (KH-01/KH-09/KH-10/KH-11)
- Fixed SQL Editor compatibility: migration 068 now locates the resolver insertion point with a whitespace/case-tolerant pattern and reports a clear missing-067 prerequisite instead of a false patch mismatch. Full migration chain passed again on PGlite.

- The system now derives a stock-unit transition from the old verified package ratio and the new verified package ratio when their inner units are physically compatible. For example, 200 pieces in each package gives a 1:1 transition without asking the operator to re-enter the old ratio. Different counts yield the corresponding factor.
- The separate stock-factor input is optional when the server has enough verified package history; incompatible dimensions and missing proof remain rejected. Posted stock documents keep their original units and quantities.
- Validation: migration chain and 200-to-200 transition passed on PGlite; typecheck and lint passed. 150 tests passed; the material-verification test file could not start because esbuild worker creation was denied (`spawn EPERM`).
- No cloud migration or frontend deployment performed.

## 2026-11-23 — Đồng bộ chuẩn vật tư với tồn kho bằng tỷ lệ chuyển đổi riêng (KH-01/KH-09/KH-10/KH-11)

- Tách tỷ lệ đổi chuẩn tồn kho khỏi quy cách đóng gói/công thức. Khi chọn đơn vị chuẩn mới, xác minh và sửa danh mục đều cho nhập rõ `1 đơn vị cũ = N đơn vị mới`; lưu một resolution có hiệu lực để danh mục, tồn tất cả kho, mức tối thiểu và kiểm kê dùng chung chuẩn mới.
- Tồn lịch sử chuyển qua chuỗi tỷ lệ đã xác minh; phiếu kho đã ghi và snapshot công thức/giá không bị ghi lại. Khối lượng ↔ thể tích bị từ chối; bao bì ↔ lít cần quy cách đóng gói đã đối chiếu.
- Xác minh local: `npm run db:types` (99 bảng/88 RPC), typecheck, lint, `npm test` (163/163), production build và `node scripts/design-check.mjs --materials` đạt. Browser fixture không dùng Supabase thật.
- Không áp migration cloud hoặc deploy frontend. Cần xác nhận trạng thái migration trên Supabase rồi phát hành migration 067 sau 066 cùng frontend tương thích và UAT.

## 2026-11-23 — Cho đổi đơn vị kho qua quy cách đã xác minh (KH-01/KH-09/KH-10/KH-11)

- Sửa migration kiểm tra đổi đơn vị để quy cách bao bì mới có thể nối đơn vị kho cũ/mới qua cùng đại lượng vật lý (ví dụ 1 bì = 1.000 g để đổi kg → bì). Không nhận lít làm cầu nối sang kg khi thiếu quy tắc vật lý; không tự sửa lịch sử phiếu kho.
- Khi lỗi thiếu quy đổi, biểu mẫu chỉ rõ hai đơn vị đang chuyển và vị trí nhập tỷ lệ: “Quy cách đóng gói” hoặc “Quy đổi nhập/kho”.
- Xác minh: typecheck, lint, diff check và PGlite trực tiếp cho ba luồng lưu/chuyển/chặn đạt. `npm test` có 150 test đạt, một file test không khởi tạo do `spawn EPERM` của esbuild; production build bị cùng lỗi worker `spawn EPERM`.
- Chưa áp migration `202611230066_material_unit_package_bridge.sql` lên Supabase/DEV hoặc deploy; cần đối chiếu và phát hành sau 055/057/064/065, rồi UAT bằng tài khoản thật.

## 2026-11-23 — Đưa ma trận khách đặt hàng lên đầu popup, Excel và bản in (KH-12/KH-01/KH-10)

- Popup tổng hợp, sheet Excel đầu tiên và bản in dùng chung ma trận món theo điểm bán, hàng tổng số lượng và phần nhu cầu nguyên liệu phía dưới. Ngày hiển thị theo định dạng ngày/tháng/năm.
- File Excel giữ tab phụ “Chi tiết đơn” để tra lại số liệu từng đơn. Danh sách duyệt đơn bên ngoài không đổi.
- Giữ nguyên phạm vi nghiệp vụ từ RPC: ma trận tính đơn đã duyệt/lên kế hoạch/giao xong; nhu cầu nguyên liệu theo đơn đã duyệt/lên kế hoạch chưa gắn kế hoạch sản xuất. Đơn chờ duyệt không bị tính thành nhu cầu chuẩn bị.
- Kiểm tra đạt: `npm run verify` (99 bảng/87 RPC, typecheck, lint, 158/158 tests, production build); `npm run test:orders` (fixture xác nhận popup/Excel/in, nguyên liệu, cột tổng trên desktop, cuộn ngang trên mobile và không tràn ở 320/390/1280px); `git diff --check`.
- Không sửa schema, dữ liệu cloud hay triển khai frontend. Chưa UAT bằng tài khoản Supabase thật.

## 2026-11-23 — Giá vốn danh mục món và hộp nhập giá bán (KH-01/KH-11/KH-10)

- Thêm nút mở liên kết công thức ngay tại từng món; hộp chọn chỉ đưa ra công thức đã công bố có hiệu lực vào ngày xem, và giữ số lượng đầu ra đang liên kết khi mở lại.
- Phân biệt món chưa liên kết công thức; với giá vốn chưa đầy đủ, gợi ý kiểm tra định mức, giá vật tư đã xác minh và quy đổi. Vẫn để trống giá vốn thiếu dữ liệu, không thay bằng 0.
- Nút “Giá bán” mở thẳng hộp thêm phiên bản, bỏ lịch sử giá khỏi giao diện và bỏ ô nguồn/lý do. Backend vẫn lưu lịch sử bất biến và dấu ghi nhận trung tính “Cập nhật trong danh mục món bán”.
- Xác minh local: `npm run verify` đạt (99 bảng/87 RPC, TypeScript, lint, 158/158 tests, build); `npm run test:commercial` đạt 20 màn hình ở 5 kích thước, gồm mở giá trực tiếp không lý do/lịch sử, mở liên kết công thức, gửi lại idempotent; `git diff --check` đạt.
- Giới hạn: chưa truy cập dữ liệu Supabase đang chạy để tự liên kết công thức hoặc kiểm tra giá vốn thật của từng món; không áp SQL, sửa dữ liệu cloud hay deploy.

## 2026-11-23 — Hiển thị rõ nguyên nhân lỗi tải ảnh món (KH-12/KH-10)

- Thay thông báo chung khi tải/lưu ảnh bằng hướng dẫn theo lỗi Supabase Storage: thiếu bucket `product-images`, bị policy/RLS hoặc thiếu quyền `products.edit`, lỗi mạng, giới hạn kích thước/định dạng, thiếu RPC `save_product_image`; lỗi khác hiển thị mã HTTP và thông điệp đã rút gọn.
- Xác minh local: `npm run verify` đạt (99 bảng/87 RPC, typecheck, lint, 158/158 tests, production build).
- Chưa kiểm tra được bucket/quyền trên Supabase đang chạy và chưa deploy frontend; không áp migration hay SQL cloud.

## 2026-11-23 — Đổi bảng ngoài trang đơn hàng theo mẫu tổng hợp (KH-04/KH-05/KH-12)

- Bảng danh sách hiển thị mã/trạng thái, điểm bán và số điện thoại, ngày giao, tổng số lượng, chiết khấu, món, khoản cấn đơn trước, hủy/lỗ, tổng thanh toán, cách thu và ghi chú.
- Lấy các số liệu theo đơn từ RPC tổng hợp hiện có theo ngày giao; nút chi tiết mở luồng đơn hiện có, còn duyệt/từ chối được giữ trong ô chi tiết. Không thêm migration hoặc thay đổi dữ liệu chứng từ.
- Xác nhận: typecheck, lint, build, `npm test` (156/156) và `npm run test:orders` đạt; fixture xác nhận cột mới, giao/hoàn, Excel/in, không tràn trang điện thoại. Fixture không kiểm tra đăng nhập hay Supabase cloud.
- Chưa triển khai frontend; không áp SQL cloud.

## 2026-11-23 — Sửa gói SQL đơn hàng phụ thuộc nền Ki-ốt (KH-04/KH-05)

- Kiểm tra ảnh Supabase: đơn hàng đã có, còn thiếu bảng lô Ki-ốt và RPC bán/đối soát. Gói migration 061 riêng không thể chạy trước khi cài nền Ki-ốt.
- Thêm `npm --prefix web run db:order-kiosk-update`, sinh một gói transaction gồm 021, 022 và 061 với preflight schema, phát hiện chạy lại/dở dang và rollback nguyên gói.
- PGlite 11/11, typecheck và lint đạt. Chủ dự án xác nhận đã chạy gói; ảnh SQL Editor cho thấy bảng `kiosk_return_lots` và hai RPC Ki-ốt đã có. Nếu chạy trọn file, 061 đã commit trong cùng transaction. Còn xác minh RPC settlement và UAT giao/hoàn trên ứng dụng; không chạy lại gói. Xem `docs/standalone/ONLINE_DEPLOY.md`.

## 2026-11-22 — Sửa kiểm tra định dạng tiền (KH-01/KH-10/KH-11)

- Cập nhật kỳ vọng của test định dạng tiền theo quy tắc mới: `16.000,125` hiển thị thành `16.000,13`; độ chính xác bigint và giá trị nhập vẫn được kiểm tra riêng.
- `npm run verify` đạt: sinh kiểu database không đổi, typecheck, lint, 150/150 test và production build.

## 2026-11-22 — Hoàn thiện tổng hợp giá vốn (KH-01/KH-10/KH-11)

- Bảng tổng hợp tính và hiển thị giá vốn theo mẻ, theo đơn vị bán; giá bán lẻ theo định lượng được làm tròn đến đồng. Có phân trang và trạng thái kèm lý do thiếu dữ liệu.
- Bỏ danh sách món và chi tiết công thức bên dưới trang tổng hợp. Giá nguồn tiếp tục được ghi rõ là tham khảo; không lấy thay cost BOM.
- Typecheck, lint, production build và `git diff --check` đạt. Không chạy test/fixture; không đổi database/migration hoặc deploy.
- Công thức Mì trộn chưa thể có cost chính thức vì nguồn chưa có định lượng thành phần được đối chiếu. Không tự tạo giá hoặc lượng.

## 2026-11-22 — Làm tròn định lượng thành phần công thức (KH-01/KH-10/KH-11)

- Trình sửa công thức chỉ hiển thị/lưu tối đa 2 chữ số thập phân ở số lượng thành phần; làm tròn nửa lên (ví dụ `1.125` → `1.13`). Sản lượng/mẻ và các phiên bản công thức cũ giữ nguyên.
- Typecheck, lint và production build đạt. Không đổi schema, chưa chạy test/fixture, không deploy.

## 2026-11-22 — Xóa và khôi phục vật tư (KH-01/KH-10)

Thêm thao tác đưa vật tư ra khỏi danh mục đang dùng và khôi phục từ danh sách đã xóa. Lưu trữ mềm giữ công thức/chứng từ/audit; máy chủ chặn khi tồn còn khác 0, lịch sử tồn chưa quy đổi được hoặc có chứng từ kho tương lai. Migration 058 chưa áp lên Supabase/DEV.

## 2026-11-22 — Sửa popup vật tư và nhập quy cách bằng đơn vị/tỷ lệ (KH-01/KH-09/KH-10/KH-11)

- Lỗi lưu bị từ chối như database chưa có RPC/bản vá không còn khóa form: người dùng có thể sửa và đóng popup. Lỗi chưa rõ kết quả vẫn giữ nguyên lần gửi để retry an toàn.
- Form thêm/sửa dùng cấu hình quy cách có cấu trúc: đơn vị mua, số lượng, đơn vị nhận, trạng thái đối chiếu và preview; tỷ lệ đã xác minh nối vào quy đổi vật tư dùng trong công thức. Quy đổi cũ vẫn hiện và không bị mất khi chỉ sửa thông tin khác.
- Thêm migration `202611220057_material_structured_packaging.sql`; chưa áp Supabase/DEV hoặc deploy. Xác minh local: 149/149 test, 7/7 test vật tư sau cập nhật cuối, typecheck, lint, build, fixture `--materials` và `git diff --check` đạt.

## 2026-11-22 — Tự động hoàn tất giao đơn và ghi nhận giá hỗ trợ hàng hoàn

- Thêm xác nhận giao đủ dựa trên tồn thành phẩm từ lô sản xuất, chứng từ giao và bán; đơn chuyển hoàn tất cùng lúc với chứng từ giao, chống ghi trùng.
- Giữ xuất nguyên liệu tại bước sản xuất. Giá hỗ trợ hàng hoàn được nhập riêng, có giới hạn số lượng và audit; hàng hoàn không nhập lại tồn, không tự thu/chi hoặc bù trừ công nợ.
- Migration 056; xác minh local: typecheck, lint, 147 tests, build và fixture Playwright `test:orders` (giao, giá hỗ trợ, mobile). Chưa áp cloud/DEV hoặc deploy.
## 2026-11-22 — Cho sửa đơn vị vật tư, bảo toàn chứng từ và quy đổi công thức (KH-01/09/10/11)

- Cho đổi đơn vị mua, đơn vị kho và quy cách đã xác minh; chỉ số tồn vẫn do phiếu kho/kiểm kê quyết định. Đổi đơn vị kho cần có tỷ lệ xác minh, tồn được tính lại theo đơn vị mới mà không sửa các dòng kho đã chốt.
- Migration `202611220055_material_units_editable.sql` lưu lịch sử tỷ lệ quy đổi theo ngày; công thức mới kiểm tra đơn vị có đường quy đổi hợp lệ. Màn công thức tự hiển thị 0,1 kg thành 100 g và 1 kg thành 1 kg.
- Kiểm tra local: 146/146 PostgreSQL tests, db:types 95 bảng/76 RPC, typecheck, lint, production build; fixture vật tư 320–1920px và công thức 5 tuyến × 5 cỡ đạt. Chưa áp migration cloud/DEV, chưa deploy hoặc authenticated UAT.

## 2026-11-22 — Nhập mã bộ phận tùy chỉnh (KH-02/KH-10)

- Danh mục Bộ phận cho nhập mã tự do, viết hoa và hỗ trợ nhiều mã; nhân viên, cài lương, chấm công, lọc và bảng lương cùng tham chiếu danh mục này, hiển thị mã và tên.
- Migration `202611220054_dynamic_department_codes.sql` mở rộng mã hợp lệ cho bộ phận và snapshot ca; giữ nguyên KPI sản xuất theo mã `SX` như hiện tại.
- Xác minh local: db:types 95 bảng/76 RPC, typecheck, lint, 145/145 tests, build; entry fixture 50 bố cục/5 kích thước gửi mã `KHO`; commercial fixture 4 danh mục/5 kích thước xác nhận ô mã dạng text, chuẩn hóa chữ hoa và nối mã/tên tới hồ sơ, lương; `git diff --check` đạt. Fixture dùng dữ liệu giả. Chưa áp migration lên Supabase/DEV, deploy hoặc authenticated UAT.

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
## 2026-11-22 — Gọn bảng tổng hợp giá vốn (KH-01/KH-10/KH-11)

- Bỏ cột cost nguồn tham khảo và nhãn trạng thái bản nháp khỏi bảng `/app/cost`; giữ giá vốn tính từ BOM, trạng thái đủ/thiếu cost và lý do thiếu.
- Chỉ đổi cách trình bày. Không đổi trạng thái phiên bản, dữ liệu nguồn, lịch sử hay database. `npm run check`, `npm run lint`, `npm run build` và `git diff --check` đạt; không chạy test/fixture.
## 2026-11-22 — Điều chỉnh cột cost nguồn theo xác nhận (KH-01/KH-10/KH-11)

- Giữ lại cột cost nguồn và giá trị tương ứng; tiêu đề chỉ là `Cost nguồn`, không còn chữ `tham khảo`. Nhãn `Bản nháp` vẫn được ẩn khỏi bảng.
- Không đổi trạng thái phiên bản hay dữ liệu nguồn. `npm run check`, `npm run lint`, `npm run build` và `git diff --check` đạt; không chạy test/fixture.

## 2026-11-22 — Hiển thị số tối đa hai chữ số thập phân (KH-01/KH-09/KH-10/KH-11)

- Dùng một formatter dựa trên Decimal để làm tròn hiển thị theo quy tắc half-up, tối đa hai chữ số thập phân, bỏ số 0 cuối và dùng dấu phân cách tiếng Việt. Đã áp dụng cho tồn/kiểm kê, nhập xuất kho, sản xuất, quy đổi, công thức, cost, chấm công, payroll, ki-ốt, danh mục số thập phân và dashboard.
- Không sửa phiên bản công thức hay chứng từ đã lưu. Khi lưu phiên bản công thức mới, sản lượng/mẻ được làm tròn tối đa 2 chữ số như định lượng thành phần. Các phép tính khác tiếp tục dùng dữ liệu chính xác đã lưu; formatter chỉ đổi cách hiển thị. Tiền VND dùng formatter nguyên đồng khi phù hợp; phần tiền đơn vị lẻ hiển thị tối đa hai chữ số.
- Bằng chứng local: `npm run typecheck`, `npm run lint`, `npm run build` và `git diff --check` đạt. Không chạy test suite theo phạm vi checkpoint. Không sửa schema, áp SQL cloud, deploy hay UAT thật.


## 2026-11-23 ? T?ng h?p ??n h?ng v? n?i giao h?ng (KH-12/01/03/04/05/10)

- Th?m b?ng t?ng h?p ??t h?ng theo ng?y/?i?m b?n, xem chi ti?t m?n, t?i Excel hai sheet v? in ngang c? logo.
- Th?m ?nh m?n v?o danh m?c v? c?ng ??t h?ng; th?m d? b?o nhu c?u nguy?n li?u t? ??n ?? duy?t/?ang giao c?ng c?nh b?o t?n.
- Giao th?nh c?ng ghi m?t ch?ng t? b?n h?ng v? kho?n ph?i thu; kh?ng t? ??nh d?u ti?n ?? thu. Nguy?n li?u kh?ng b? tr? l?n hai khi giao.
- H?ng h?y, h? tr?, h?ng nh?n l?i v?o kiosk v? b? tr? kho?n n? c? v?n ch? ch?t D04/D16; ch?a t? s?a t?n/ti?n cho c?c t?nh hu?ng ??. Migrations ch?a ?p cloud/deploy.


## 2026-11-23 — Chốt giao, cấn trả hàng và ghi nhận hủy/lỗ (KH-12/01/03/04/05/10)

- Giao đơn kiểm tra đủ thành phẩm, ghi chứng từ bán + công nợ; chọn thu tiền mặt/chuyển khoản theo khoản thực nhận hoặc để công nợ. Nguyên liệu chỉ trừ ở sản xuất.
- Hàng trả đã nhận được vào kho kiosk, lưu giá mua lại/chiết khấu làm giá vốn và tự cấn đơn kế tiếp cùng điểm bán. Hàng hủy giảm doanh thu/công nợ, được thể hiện thành khoản lỗ riêng và không nhập tồn/cấn đơn sau.
- Bảng tổng hợp đơn có chi tiết món, ma trận theo điểm bán, Excel hai sheet có logo và bản in ngang; kèm dự báo nhu cầu nguyên liệu từ đơn đã duyệt, BOM và tồn. Báo cáo kiosk có doanh thu, giá vốn và lãi gộp; thiếu giá vốn cũ tiếp tục để trống.
- Local verification: `npm run verify` (153/153 tests, DB types 99 tables/87 RPCs, TypeScript, lint, production build), `npm run test:orders` (fixture responsive UI), `git diff --check` passed. Supabase migration and live UAT are not run.

## 2026-11-23 — Chỉnh giao diện popup bảng tổng hợp khách đặt hàng (KH-12/KH-10)

- Làm popup rộng và gọn hơn trên desktop, sắp xếp lại bộ lọc ngày/Excel/in, thêm số đếm và chia nội dung thành các khối dễ đọc.
- Rút ngắn trạng thái rỗng, báo cuộn ngang cho bảng nhiều cột, giữ popup gọn ở màn 320px/390px. Logo được giữ cho bản in và ẩn khỏi nội dung trên màn hình.
- Chỉ đổi giao diện; dữ liệu và phép tính đơn hàng không đổi. `npm run verify` đạt (156/156 tests, typecheck, lint, build); `npm run test:orders` đạt tại 320px/390px/1280px và kiểm tra phần đầu trang khi in. Không áp SQL cloud hoặc deploy.

## 2026-11-23 — POS-style ordering catalog (KH-12/KH-10)

- Changed the public order menu from full-width product rows to compact product tiles with four columns on wide screens and responsive three/two/one-column layouts. Quantity controls, published prices/images, cart totals, and submit behavior remain connected to the existing order flow.
- Production build and `npm run test:orders` passed. Isolated public catalog fixture passed grid-column assertions, quantity/cart behavior, and no horizontal overflow from 320px to 1920px. No schema or live data was changed.

## 2026-11-23 - Fix public guest order rejection (KH-12/KH-10)

- Added migration 062 to restore the customer_id guard around notification creation after the order-kiosk repair bundle reapplies legacy migration 022. Public orders can now be reviewed without violating notifications.user_id NOT NULL.
- Added migration 062 to the generated order-kiosk update package. Current Supabase still needs the standalone migration 062 run in SQL Editor; no cloud SQL or deployment performed here.

## 2026-11-23 — Fix product image Storage RLS (KH-12/KH-10)

- Added migration `202611230063_product_image_storage_rls_fix.sql`. It moves product-ID existence validation into a narrowly scoped `SECURITY DEFINER` helper, avoiding the nested `public.products` RLS check from the Storage insert policy while retaining `products.edit`, path validation, and product existence checks.
- Updated the upload error message to identify the exact migration needed when the Storage policy rejects the insert.
- No production SQL or frontend deployment performed. Apply migration 063 to the connected Supabase project and deploy the frontend before retrying upload.

## 2026-11-23 — Material package conversions for recipes (KH-01/KH-11/KH-10)

- The material verification form now always exposes package contents, including when the purchase and stock units are the same. It explains that inventory may stay in bags while recipes use pieces.
- Migration `202611230064_material_formula_unit_conversion.sql` lets a newly verified package ratio validate a same-transaction stock-unit change. Recipe quantities continue to convert to the material stock unit using the effective verified ratio.
- Updated recipe and material error guidance. Existing posted stock and saved recipe revisions remain intact.
- `npm run typecheck`, `npm run lint`, and `git diff --check` passed. The `npm run test:recipes` fixture could not start because the environment blocked the esbuild child process (`spawn EPERM`). Migration 064 has not been applied to Supabase and the frontend has not been deployed. UAT is still needed for `1 bì = 100 cái` with stock kept in bì and a recipe using cái.

## 2026-11-23 — Separate formula-unit conversion from stock conversion (KH-01/KH-10/KH-11)

- Clarified the 064 checkpoint: its package ratio did not cover the case where both purchasing and inventory stay in `bì` while a recipe uses `cái`. Added a dedicated formula conversion field to material verification and corrected the material-entry guidance.
- Migration `202611230065_material_formula_specific_unit_conversion.sql` stores the formula ratio as a dated immutable resolution and applies it only to recipe validation, BOM quantities, recipe detail, demand, and costing. Stock receipts, counts, and balances continue to use the stock unit. A catalog/price update preserves the formula ratio; changing the stock unit requires a new verification.
- Verification: the local PGlite case `1 bì = 100 cái` passed, including 100 recipe pieces → 1 stock bag, 12,000 VND cost, and a balance of 2 bags remaining 2 bags. All 159 tests passed. The recipe UI fixture passed at 320–1440px; the material fixture passed at 320–1920px and captured a payload that keeps stock in bags while sending 100 pieces to formula conversion. Typecheck, lint, production build, and `git diff --check` passed.
- Migration 065 has not been applied to Supabase; frontend has not been deployed. Apply 065 after 064 in the intended project, then UAT the chopsticks recipe. Historical documents and snapshots were not rewritten.

## 2026-11-23 — Show stock migration ratio when existing and new stock units differ (KH-01/KH-10/KH-11)

- The material review form now detects when the persisted stock unit differs from the selected one. It keeps the inventory conversion visible even when purchase and new stock units are both `bì`, defaults the other side to the old stock unit (`cái`), and requires the stock ratio before saving. Formula conversion remains separate.
- Added regression coverage for 100 old pieces migrating to 1 bag while the recipe ratio is independently saved as 1 bag = 100 pieces. Verified old inventory balance and recipe quantity conversion.
- Verification: 160/160 tests passed, material UI fixture passed at 320–1920px, typecheck/lint and `git diff --check` passed. Production SQL and frontend are not updated yet.

## 2026-11-23 — Fix formula conversion quantity input width (KH-01/KH-10/KH-11)

- Fixed the formula conversion input: its four controls were using the five-column package grid, placing the quantity input in the 20px separator column. The formula row now has a dedicated responsive grid.
- Added a browser-fixture regression check for a usable input width. `npm run typecheck`, `npm run lint`, `npm run build`, all 162 tests, the material UI fixture at 320–1920px, and `git diff --check` passed. No cloud writes or deployment.


## 2026-11-23 - Calculate revenue after all recorded costs (KH-05/KH-06/KH-07/KH-08/KH-09/KH-10)

- Added `202611230072_dashboard_revenue_after_costs.sql`: net sales less production material issues, estimated wages for posted SX/VP/BH shifts, posted expense categories including recovery support, loan interest actually paid, and recorded depreciation. Loan principal and cash receipts are excluded. Missing or unauthorized source coverage keeps the after-cost amount unavailable.
- Updated the executive, operations, and strategy dashboards to show sales after reductions separately from revenue after all recorded costs. Period and history totals use server-side SQL results.
- Verification: dashboard PGlite tests 2/2; full web suite 173/173; typecheck, lint, build, and `git diff --check` passed.
- Migration is not applied to Supabase and the frontend is not deployed. Wages are estimated from posted shifts; interest uses payment date. Live DEV UAT remains.

## 2026-11-24 ? Optional topping recipes and order snapshots (KH-01/KH-10/KH-12)

- Added an independently costed Topping recipe category and per-dish topping options. Base recipe cost remains the dish-only cost; topping costs are visible by output unit and batch.
- Public ordering now offers configured, published toppings and snapshots selected topping identity/version, quantity and internal cost on each order. Order review displays selected toppings separately. No topping surcharge is applied to customer payment because no sale-price rule was specified.
- Migration and frontend are not applied/deployed. Checks have not been run yet.

## 2026-11-24 — Khắc phục lỗi chi tiết công thức topping

Sửa lỗi SQLSTATE 42702 do bí danh truy vấn topping trùng biến trong `recipe_detail`; bổ sung migration sửa cho môi trường đã chạy 073, thông báo lỗi cụ thể trên màn công thức và sửa các nhãn tiếng Việt của topping. Cần áp migration 074 và cập nhật frontend để mục Topping xuất hiện trên ứng dụng đang dùng.

## 2026-11-24 - Automatic order-to-production planning (KH-01/KH-05/KH-10/KH-12)

- Added migration `202611240080_auto_order_production_plan.sql`. Approving a customer order now validates published product recipes and sale-unit ratios, creates or reuses the matching delivery-date/shift production plan, adds the ordered quantities, assigns the sole active ingredient warehouse, and marks the order scheduled. Topping BOM requirements follow the assigned plan warehouse.
- Approval creates planning demand only. It does not post production, inventory movements, delivery, sales, cash or receivables. Actual production and delivery RPCs remain the posting points. Orders without an effective recipe/ratio fail atomically. Multiple active ingredient warehouses without an already assigned matching plan also fail clearly; no arbitrary warehouse is chosen.
- Planning date assumption: when creating a new plan, production_date equals the order delivery_date because the app has no separate portal production-date rule. Existing matching plans retain their configured production date.
- Evidence: all migrations loaded in local PGlite; an end-to-end PGlite check approved a seven-unit order, created/linked a plan to the single active ingredient warehouse, reserved quantity 7, and confirmed zero inventory movements. `npm run typecheck` and `npm run lint` passed. Targeted TypeScript test execution was blocked by Windows `spawn EPERM` from esbuild; full tests/build were not verified.
- Remaining: resolve the production-date policy if production must precede delivery; configure a default or plan assignment rule if multiple ingredient warehouses are active; run the full web test/build suite in an environment that permits child process spawning; apply migration to intended DEV and perform live UAT. No cloud SQL or deployment performed.
## 2026-11-24 — Tự công bố topping cùng công thức món (KH-01/KH-10/KH-11/KH-12)

- Công thức món lưu phiên bản topping đã chọn; topping nháp được kiểm tra và công bố cùng giao dịch khi công bố công thức món. Bỏ nút công bố topping riêng và hướng dẫn rõ ngay tại nơi chọn topping.
- Catalog khách chỉ nhận phiên bản topping đã công bố gắn với phiên bản công thức món đang bán; giữ ngày hiệu lực và không trả giá vốn ra portal.
- Kiểm chứng: PGlite `recipe-catalog.test.ts` 12/12, gồm rollback khi topping lỗi; `npm run typecheck`, `npm run lint` và `git diff --check` chạy cho checkpoint này. Chưa áp migration lên Supabase hoặc deploy frontend.
## 2026-11-24 — Đồng bộ database types cho CI topping

- Cập nhật `web/lib/database/generated.ts` từ migrations sau khi migration 081 thêm `recipe_topping_options.topping_version_id`; CI trước đó thất bại ở bước kiểm tra diff của file types được sinh tự động.
- Cập nhật fixture/test duyệt đơn để kiểm tra việc tự tạo kế hoạch sản xuất, không ghi doanh thu/kho; chuẩn hóa ngày đọc từ PGlite.
- Kiểm tra: full suite 175/175, `db:types`, typecheck, lint, production build và `git diff --check` đạt. Chưa xác minh GitHub Actions sau khi push.

## 2026-11-25
- Added exact material/unit details to recipe publication conversion errors and a Vietnamese editor message to guide the verified fix.
- Added migration `202611250088_order_demand_uses_formula_units.sql`: approved-order material demand now uses each material's saved, verified formula unit (e.g. `cái`) and compares stock/minimum after conversion to that same unit. Recipe costing and inventory posting continue to use stock units. Added a regression for 1 bag = 100 pieces.
- KH-01/KH-10/KH-11/KH-12: added migration 089 and connected recipe detail/form units to the saved formula specification; verified formula conversion now supports compatible physical units and price bases. Added explicit draft validation/publication, date-specific dependency errors, and refresh of dependent reports. Fixed scheduled/cancelled order scope, formula-unit stock/minimum comparison and isolation of incomplete topping/recipe data. Existing inventory postings and production snapshots retain their history. All 196 local tests (including six new PostgreSQL integration cases), typecheck, lint, build and 5-route/5-width browser fixtures pass; cloud migration/frontend release remains pending.

# Danh mục công thức — checkpoint027

## Cập nhật công bố ngày 25/11/2026 (KH-01/KH-10/KH-11/KH-12)

Các quy tắc checkpoint027 bên dưới là lịch sử. Từ migration090, có thể công bố nhiều lần cùng ngày; mỗi lần giữ phiên bản riêng, truy vấn hiệu lực chọn revision mới nhất, chứng từ đã chốt giữ version/snapshot cũ.

Ảnh lỗi `date=2026-11-17|formula_from=2026-11-25` là công bố nháp cũ theo ngày cũ, trong khi quy đổi công thức mới bắt đầu từ25/11. Đích “túi” có thể là đơn vị kho trong bản xác minh ngày cũ; không được tự đồng nhất túi với bì hay áp quy đổi mới ngược về quá khứ. `publish_recipe_at` chuẩn bị cây nháp theo ngày người dùng chọn, giữ bản published đã ghim và kiểm tra quy đổi đúng ngày đó. Frontend phải gọi RPC mới; chỉ cài SQL không thay đổi payload từ frontend cũ.

Chuẩn bị bản phát hành bằng `npm --prefix web run db:recipe-publication-update`:

1. Chạy file chỉ đọc `output/CHIFAA_RECIPE_PUBLICATION_CHECK.sql` trên đúng dự án để biết các bước088/089/090 và ngày/đơn vị đã xác minh.
2. Sau khi được phép cập nhật cloud, áp `output/CHIFAA_RECIPE_PUBLICATION_087_090.sql` qua SQL Editor bằng tài khoản owner. Gói yêu cầu nền086, tự bỏ qua bước đã có; phát hiện cài dở hoặc lỗi bất kỳ thì rollback toàn bộ. Kết quả cuối cần `recipe_publication_ready=true` và `formula_units_ready=true`. SQL Editor không cập nhật lịch sử migrations của CLI.
3. Phát hành frontend chứa commit`1dd7bba` và bản sửa089 đi kèm. Không push nhánh tự deploy trước khi database sẵn sàng. Tải lại ứng dụng, chọn ngày xem/công bố từ ngày quy đổi đã xác minh, bấm “Kiểm tra & công bố” hoặc lưu công thức. Network phải gọi`publish_recipe_at` với`p_effective_from` đúng ngày đang chọn; nhận version trả về có trạng thái published. Không cần nhập lại tỷ lệ đúng sẵn trong danh mục.
4. Kiểm tra nhu cầu vật tư trên đơn đã duyệt cùng ngày có hiệu lực. Nhu cầu là dữ liệu dự kiến, thao tác đọc/công bố không tự ghi xuất kho hay sản lượng. Đơn lịch sử trước ngày công bố vẫn có thể thiếu công thức hiệu lực; không tự backdate để che thiếu dữ liệu.

Nếu UAT không đạt, giữ schema/lịch sử, rollback frontend về bản tương thích rồi sửa bằng migration tiếp theo. Không xóa phiên bản hoặc snapshot để đảo cập nhật. Gói SQL chỉ thay schema/hàm; không tự xác minh tỷ lệ hoặc công bố dữ liệu thật. Local tests không thay thế UAT Supabase.

## Phạm vi và ảnh chuẩn

### Cảnh báo thiếu tỷ lệ bán sau khi công thức đã công bố

`PRODUCT_RECIPE_RATIO_REQUIRED` nghĩa là chưa có hệ số có nguồn giữa đơn vị bán và đầu ra công thức tại ngày giao. Sản lượng/mẻ không tự xác nhận số đầu ra của một đơn vị bán. Khi quy cách đã được owner xác nhận, vào **Danh mục món bán → Liên kết công thức**, chọn bản published, nhập số đầu ra cho một đơn vị bán, ngày hiệu lực và bằng chứng rồi lưu. Tải lại báo cáo đúng ngày sau khi lưu.

Ngày hiệu lực là ngày bắt đầu, không phải ngày hết hạn: liên kết lưu một lần tiếp tục áp dụng cho các ngày giao sau đến khi có liên kết mới hiệu lực. JSON trong SQL là dữ liệu đầu vào; `evidence` chỉ ghi nguồn/căn cứ xác nhận. Sau khi lưu, báo cáo đọc liên kết trong PostgreSQL. Sửa nguyên liệu rồi công bố bằng `publish_recipe_at` giữ tỷ lệ đã thiết lập khi quy cách bán không đổi; nếu đổi số lát mỗi cây, đơn vị hoặc công thức dùng cho món bán thì khai báo liên kết/tỷ lệ mới đúng ngày. Món mới cũng khai báo qua giao diện này, không cần viết SQL riêng mỗi ngày.

Trường hợp cần gói sửa dữ liệu qua SQL Editor owner, chạy từ `web/`: `npx tsx scripts/prepare-recipe-sale-link-correction.ts --config=../output/confirmed-links.json --date=YYYY-MM-DD`. Config riêng là mảng `{productCode,recipeCode,saleUnit,outputUnit,quantity,evidence}`; chỉ dùng tỷ lệ/ngày đã được xác nhận. Bỏ `--date` chỉ sinh chẩn đoán, không suy ngày hôm nay. Script không kết nối cloud. File `output/CHIFAA_FIX_CONFIRMED_RECIPE_SALE_LINKS.sql` kiểm tra đúng sản lượng một mẻ/một đơn vị bán, từ chối liên kết khác công thức/xung đột cùng ngày/kỳ khóa, lưu provenance/audit và không sửa chứng từ đã chốt. Đã có liên kết đúng thì giữ phiên bản đang ghim; không âm thầm chuyển sang bản công thức khác. Kiểm tra ngày, `output_per_sale` và `one_sale_demand` trong kết quả trước khi xác nhận UAT.

Áp dụng KH-01, KH-03, KH-10 trong `CUSTOMER_REQUIREMENTS_2026-11-17.md`: định lượng đa tầng, cộng đúng vật tư, giữ phiên bản và giá đã xác minh làm nền cho nhu cầu nguyên liệu. Checkpoint này hoàn thiện danh mục công thức; chưa triển khai toàn bộ báo cáo tiêu hao/đối chiếu kho theo kỳ của KH-01.

Bảy ảnh người dùng gửi là chuẩn bố cục và thao tác: thẻ số liệu, danh sách/chọn công thức bên trái, chi tiết bên phải, sửa/sao chép, cơm chín, bao bì và bảng tổng giá vốn. Những điểm của bản mô phỏng không được bê vào nghiệp vụ thật: không lưu tạm trong phiên, không thay giá thiếu bằng0, không coi tổng một phần là giá vốn chính thức, không tạo bản sao thử nghiệm không có trong dữ liệu nguồn.

## Giao diện và liên kết

- Năm route: `/app/recipes`, `/app/batches`, `/app/rice`, `/app/packaging`, `/app/cost` dùng chung `RecipeWorkspace`, dữ liệu PostgreSQL thật, tìm mã/tên, phân trang25 và ngày tính giá.
- Chi tiết giữ từng thành phần trực tiếp, đơn vị nhập, số lượng mẻ, lượng trên một đơn vị đầu ra, lượng quy đổi về kho và giá/thành tiền. Công thức con bấm mở đúng phiên bản; vật tư/món bán có liên kết sang danh mục.
- Nhân/sốt, cơm, bao bì có cùng editor: tạo, sao chép, thêm/bỏ thành phần, chọn vật tư hoặc công thức con, đơn vị riêng mỗi dòng, sản lượng mẻ, tên/nhóm và ngày hiệu lực. Không ép mọi định lượng về đơn vị kho ngay khi nhập.
- Sửa luôn tạo phiên bản mới, giữ lịch sử cũ và nguồn/bằng chứng; nháp cùng ngày được phép, chỉ một phiên bản được công bố cho mỗi công thức/ngày. Không sửa đè công thức đã công bố. Nếu muốn thay bản đã công bố cùng ngày, cần chọn ngày hiệu lực tiếp theo theo lịch sử hiện hành.
- Công bố cần quyền duyệt, công thức con đã công bố/hiệu lực và quy đổi xác định. Có thể chọn món bán, ưu tiên đề xuất mã từ nguồn, và hệ số đầu ra/món; việc liên kết dùng chung với danh mục món bán và sản xuất. Công bố công thức không tự công bố món ra portal hoặc ghi phiếu kho.
- Giá vốn hiện theo ngày xem, tách cost nguồn tham khảo; thiếu giá/quy đổi/định lượng thì tổng chính thức NULL. Định lượng có thể đọc với quyền công thức; giá và nguồn tài chính cần thêm quyền vật tư. Danh mục vật tư thay giá/quy cách sẽ làm mới cache công thức.
- Tiền dùng chuỗi thập phân/SQL numeric, hiển thị VND; bảng cuộn trong vùng riêng và form đáp ứng màn hình nhỏ.

## Schema và API

Migration `202611170027_recipe_catalog.sql` nâng hệ thống lên84 bảng public /40 RPC public.

- `recipe_versions.review_issue`: lỗi nguồn cần xử lý trước công bố/BOM.
- `recipe_items.sort_order`: thứ tự thành phần, tự cấp khi ghi bằng RPC cũ.
- `recipe_unresolved_items`: giữ các dòng nguồn chưa liên kết hoặc mâu thuẫn; RLS, audit, cấm sửa khi phiên bản đã công bố. Không bỏ dòng mất mã ra khỏi tổng một cách im lặng.
- `private.catalog_sources`: raw nguồn, cost tham khảo, đề xuất món/hệ số và bằng chứng chỉnh sửa; không cấp đọc trực tiếp cho client.
- `recipe_catalog`: danh sách/thống kê và cost theo ngày; bán nguyên cây dùng hệ số đầu ra/món, không nhầm giá một lát thành giá một cây.
- `recipe_detail`: dòng trực tiếp và phiên bản con, cost BOM gộp vật tư, nguồn được phân quyền, các món đã liên kết.
- `save_recipe_revision`: tạo/sửa nháp nguyên tử, quyền trực tiếp, phiên bản kỳ vọng, idempotency, audit và bằng chứng. `publish_recipe` kiểm tra quyền liên kết món rồi dùng luồng công bố hiện có.
- BOM strict tiếp tục phục vụ sản xuất, chặn định lượng chưa rõ. Preview trả trạng thái thiếu dữ liệu cho các lỗi xác minh đã biết; không nuốt lỗi database khác.

Root cost được tính sau gộp vật tư và làm tròn từng dòng vật tư tại database. Dòng công thức con là chi tiết tham khảo; cộng các dòng đã làm tròn ở từng tầng có thể lệch so với tổng BOM gộp, vì vậy tổng chính thức luôn lấy từ cùng RPC `recipe_cost`.

Với dòng thành phần được chủ động đánh dấu `cost_exempt`, chỉ cost của dòng đó (hoặc toàn bộ nhánh công thức con) được tính là 0 trong phiên bản công thức tương ứng. Định lượng và đơn vị vẫn được giữ khi bung BOM, tính nhu cầu và ghi snapshot sản xuất; giá dùng chung của vật tư không bị sửa hoặc xác minh. Mặc định dòng vẫn tính giá như trước. Khi cùng vật tư xuất hiện ở cả dòng miễn cost và dòng tính cost, đơn giá gộp là trung bình gia quyền theo định lượng để tổng cost không bị đội lên.

## Nhập nguồn riêng tư

Nguồn trong lượt này là `Pasted text.txt` sao chép sheet Excel, không phải workbook XLSX mới. Không sửa hai workbook gốc. Parser giữ toàn bộ hàng/cột thô, số tham khảo và các dòng mâu thuẫn trong vùng riêng tư.

Chạy từ `web/`: `npx tsx scripts/prepare-recipe-import.ts <đường-dẫn-TXT-riêng> [YYYY-MM-DD]`. Cần `output/commercial-source.json` đã chuẩn bị từ danh mục kinh doanh để khớp tên/mã món chính xác.

Kết quả nguồn được kiểm tra:21 công thức =11 món +7 nhân/sốt +1 cơm chín +2 bao bì. Không hard-code số liệu này vào UI; số thẻ lấy từ database. Không tạo bản sao trong ảnh vì không nằm trong nguồn. Công thức nguyên cây giữ số lát nguyên làm đầu ra; công thức hộp tiêu thụ số lát theo sheet, tránh làm tròn sớm tỷ lệ cây/hộp.

File sinh trong `output/` (không commit dữ liệu riêng):

1. `CHIFAA_PATCH_CONG_THUC_DEV.sql`: schema027, chạy sau026 trên DEV hiện có; một DO nguyên tử, guard quyền owner/phụ thuộc/đã cài.
2. `CHIFAA_CONG_THUC_DEV.sql`: dữ liệu nguồn nháp, chạy sau patch027 và các danh mục vật tư/kinh doanh; một DO, replay theo hash, dừng toàn bộ nếu mã công thức đã có từ nguồn khác cần đối chiếu.
3. `CONG_THUC_DOI_CHIEU.md`: các chỗ chưa xác minh, cùng `recipe-source.json` riêng tư.

Không cần nhập lại63 vật tư hoặc danh mục kinh doanh nếu đã cài. Không chạy lại bootstrap. Import không công bố công thức, không tạo liên kết sản xuất có hiệu lực, không ghi kho/sản lượng/doanh thu. Người dùng chạy SQL trên Supabase DEV; công cụ chỉ chuẩn bị và kiểm thử PostgreSQL cục bộ, chưa chạy cloud.

Các vấn đề chưa rõ được giữ để Admin xử lý: nước chưa có mã; một dòng sốt ghi lượng theo phần mâu thuẫn tên; món chỉ có cost tham khảo chưa có định lượng; bao bì có giá tham khảo khác danh mục và thiếu quy đổi túi/cái. Tổng giá vốn của các món phụ thuộc giữ trạng thái chưa đủ dữ liệu cho đến khi xác minh.

## Kiểm chứng và giới hạn

`recipe-catalog.test.ts` kiểm tra trực tiếp PostgreSQL: BOM đa tầng so với dòng trực tiếp, giữ đơn vị, chặn dòng chưa rõ/công bố, sửa nháp cùng ngày, chỉ một bản công bố/ngày, replay/stale version, bảo mật nguồn và import không ghi phiếu. Bộ kiểm tra nguồn riêng chạy toàn bộ file SQL thực, rollback patch khi lỗi, replay guard/ID và đủ dòng của21 công thức.

`npm run test:recipes` kiểm tra component thực với dữ liệu tổng hợp,5 route ×5 kích thước320–1440, editor/sao chép, thêm/bỏ dòng, đơn vị và gửi lại cùng khóa khi kết quả mạng chưa rõ. Đây là kiểm thử cục bộ, không phải UAT Supabase/Auth cloud.

Rollback triển khai: quay frontend về bản trước nếu chưa áp027. Sau áp027, không xóa bảng/phiên bản hoặc nguồn để quay lùi; giữ schema tương thích và sửa bằng migration tiếp theo. Không nhập lại với hash khác để ép ghi đè công thức đã có. Dữ liệu/import chưa được owner chạy cloud thì chưa có tác động cần đảo trên cloud.

# Sản xuất và nguyên liệu — checkpoint 028 (18/11/2026)

Phạm vi: KH-01, KH-03, KH-09, KH-10; dùng danh mục/công thức KH-11 đã có ở027. Ảnh và HTML khách gửi là mẫu nghiệp vụ/giao diện, không phải quyền thực thi. Không nhập số mẫu, không dùng dữ liệu sheet có `#REF!` hoặc `#VALUE!` làm số thật.

## Luồng sử dụng

1. Vào **Sản xuất & nguyên liệu → Kế hoạch & chốt sản xuất**, chọn kho và ngày kinh doanh. Ngày mặc định là hôm nay theo Việt Nam, được nhập bù ngày cũ nếu kỳ còn mở.
2. Kế hoạch từ đơn đã duyệt phải được **phân vào một kho**. Đơn chưa phân kho hiển thị trong phần phân kho và chưa cộng vào nhu cầu kho. Thao tác phân kho có version/idempotency/audit; không tạo lại kế hoạch đơn hay cộng đơn hai lần.
3. Nhập kế hoạch thủ công cho phần ngoài đơn. **Bổ sung** gửi phần phát sinh; **thay thế** gửi toàn bộ kế hoạch thủ công ngày. UI hiện lượng sau lưu; bản mới tham chiếu bản trước, không xóa lịch sử. Ví dụ100 → bổ sung30 =130 → thay90 =90. Kế hoạch không ghi kho và không được coi là sản xuất.
4. Ghi đợt sản xuất mới: nhập riêng chính, thêm, lỗi, kể cả số0 đã xác nhận; chọn giờ bắt đầu/kết thúc thực tế và ngày giao. Ngày kinh doanh (`produced_on`), giờ SX, ngày giao và thời điểm nhập được lưu riêng. Ca đêm nhập cả hai ngày thực tế; UI gửi UTC+7.
5. **Chính + thêm là tổng được đưa vào sản xuất, bao gồm phần lỗi**; phần tốt = tổng − lỗi. Lỗi không lớn hơn tổng. Không cộng phần thêm một lần nữa khi tính định mức. Không suy lỗi0 từ ô trống. Không gộp hủy điểm bán hoặc hàng thu hồi vào lỗi SX.
6. Lưu sản xuất dùng giao dịch kho hiện có: công thức đã công bố, quy đổi đã xác minh, snapshot nguyên liệu/đơn vị/giá tại ngày SX và một phiếu xuất định mức. Thiếu tồn/quy đổi/thành phần làm rollback toàn bộ. Giá chưa xác minh không ngăn lượng rõ đơn vị; không tạo tổng giá vốn một phần trên màn này.
7. **Thay thế toàn bộ sản lượng ngày**: nhập toàn bộ món còn SX, xem trước cũ → mới. Món không nhập sẽ bỏ khỏi sản lượng hiệu lực. Backend kiểm tra token tập đợt hiện tại, đảo xuất kho cũ, ghi đợt mới và liên kết `replaced_by_id` trong một giao dịch. Giữ nguyên dòng lượng và snapshot cũ. Hiện cần ít nhất một dòng có tổng dương; chưa có luồng hủy toàn bộ ngày về0. Có giao/bán posted ở ngày liên quan thì chặn và yêu cầu luồng điều chỉnh chứng từ giao/bán; không sửa ngầm chứng từ đã chốt.

## Nhu cầu và nguồn số

- **Dự kiến** = snapshot kế hoạch thủ công hiệu lực + định mức kế hoạch đơn đã phân kho, đúng ngày và phiên bản công thức có hiệu lực. Bung công thức con/cơm/bao bì bằng BOM dùng chung; cộng theo mã vật tư **và đơn vị**. Hiển thị từng món đóng góp và ID công thức/đợt nguồn.
- Kế hoạch thủ công giữ snapshot lúc lưu. Nếu muốn tính lại theo công thức/quy đổi vừa chỉnh, lưu bản thay thế với lý do; không âm thầm đổi bản cũ.
- **Thực tế** = tổng `ingredient_requirement_snapshots` của các đợt posted trong kho/kỳ. Không lấy đơn/giao/bán làm SX. Đợt reversed không tham gia số hiệu lực.
- Giao/bán/trả/điểm tự chịu chỉ đọc từ phiếu bán posted khi có quyền Sales. Đây là số cùng kỳ trên toàn hệ thống, chưa phân bổ theo kho nguyên liệu. Không nhập lại số bán trên phiếu SX và không tự nhận hàng trả vào kiosk.
- Số lượng và đơn vị là chuỗi decimal từ PostgreSQL. Quy đổi mua → sử dụng hiển thị theo ngày đã chọn; chưa xác minh hiện rõ, không suy mật độ lít/kg. Đợt mới lưu context gồm dòng nguồn, các phiên bản công thức con, quy đổi và resolution IDs/số lượng, không chứa nguồn riêng hoặc tiền ẩn. Đợt cũ trước028 giữ context trống; không chế lại bằng danh mục hiện tại.
- Tồn theo sổ lấy chuyển động kho có nguồn; không chuyển null thành0. Còn sau dự kiến = tồn theo sổ tại ngày chọn − **toàn bộ** nhu cầu dự kiến, là giả lập nếu làm toàn bộ kế hoạch từ số tồn đó, không phải tồn đã ghi sổ hoặc tự động trừ kho. Tồn tối thiểu trống khác0, chỉ phục vụ cảnh báo mua thêm.
- Nếu món thiếu công thức đã công bố hoặc BOM/quy đổi cần xác minh, hiện danh sách thiếu. Tổng lượng các món còn lại không được xem là toàn bộ nhu cầu đã đủ.

## Kiểm kê và công thức đối chiếu

Mỗi phiếu theo **kho + ngày kinh doanh + vật tư + đơn vị sử dụng**. Điền đủ tồn đầu, nhập/luồng vào, tồn cuối, xuất khác và bằng chứng. Bằng chứng là số/nguồn chứng từ, thời điểm đếm và lý do thay thế do người dùng nhập; không tự suy số thực dùng từ phiếu xuất định mức.

`Thực dùng = tồn đầu + nhập/luồng vào − tồn cuối − xuất ngoài SX`

Nhập/luồng vào bao gồm mua, chuyển vào, trả về và điều chỉnh tăng ngoài sản xuất. Xuất khác bao gồm chuyển ra, trả nhà cung cấp, hủy và điều chỉnh giảm ngoài sản xuất. Người nhập phải đối soát đủ mọi luồng, mỗi luồng một lần; không đưa xuất định mức SX vào xuất khác. Điều chỉnh kiểm kê theo sổ không phải một lượt nhập vật lý mới. Số thực dùng âm bị chặn. Ô trống chưa đủ dữ liệu, số0 là số đã xác nhận.

`Chênh lượng = thực dùng − định mức của các ngày có kiểm kê`

`Chênh % = chênh lượng / định mức của các ngày có kiểm kê × 100`

Dương là dùng nhiều hơn định mức, âm là ít hơn. Mẫu số0 hoặc thiếu dữ liệu hiện chưa tính được. Khi kỳ có hai ngày SX nhưng chỉ kiểm kê một ngày, chỉ đối chiếu định mức của ngày đó, đồng thời hiện `1/2 ngày có SX`; định mức cả kỳ vẫn hiển thị riêng. Tỷ lệ không tự kết luận gian lận.

Phiếu kiểm kê đối chiếu lưu riêng, **không tự chỉnh tồn sổ**. Luồng đếm và điều chỉnh tồn sổ hiện có nằm trong phần mở rộng cùng màn Kiểm kê. Mỗi lần thay kiểm kê đối chiếu tạo bản tham chiếu bản cũ, kiểm tra version/idempotency/kỳ khóa và audit. UI xem lịch sử/bằng chứng; đối chiếu hiện tại lấy đúng một bản hiệu lực.

## Báo cáo và quyền

Ngày, tuần thứ hai–chủ nhật,7 ngày trượt, tháng, quý hoặc khoảng ngày tối đa367 ngày. Ngưỡng cảnh báo chọn trên UI, dùng trị tuyệt đối chênh%, không hard-code số liệu kinh doanh.

**Lưu snapshot kỳ** giữ payload gồm sản lượng, lượng theo vật tư, nguồn công thức/đợt, context quy đổi, kiểm kê/bằng chứng và người/thời điểm ghi. Snapshot bất biến; điều chỉnh vật tư/công thức/SX/kiểm kê sau đó không ghi lại snapshot cũ. Có thể lưu một snapshot mới để đối chiếu các lần. CSV xuất dữ liệu đang xem; snapshot đọc lại vẫn kiểm tra quyền hiện hành và ẩn cột Sales nếu quyền bị thu hồi.

Đọc màn liên thông cần view Production + Requirements + Inventory. Ghi kế hoạch cần Production create; ghi SX cần Production approve + Inventory create; thay ngày cần thêm Production edit. Kiểm kê đối chiếu cần Counts approve/view + Inventory view. Đếm điều chỉnh tồn sổ còn cần Inventory create (backend kiểm tra riêng). Lưu báo cáo cần Reports approve/view + Counts view và các quyền đọc liên thông. Ba bảng mới bật RLS, không cấp API role quyền đọc/ghi trực tiếp; chỉ scoped RPC. Chưa xác nhận mạng thì khóa đầu vào và gửi lại đúng key/payload; chỉ báo đã lưu sau database trả thành công.

## Cập nhật DEV và giới hạn nghiệm thu

Sinh file: `cd web` rồi `npx tsx scripts/prepare-production-materials-update.ts`.

File giao: `output/CHIFAA_PATCH_SAN_XUAT_NGUYEN_LIEU_DEV.sql`, một DO nguyên tử, chạy **sau027** trên DEV. Không chạy lại bootstrap/import danh mục. Guard chặn replay. Chưa áp SQL cloud, chưa deploy. Không sửa hai workbook gốc.

Kiểm thử cục bộ dùng PGlite với auth stubs và Chrome fixture có dữ liệu tổng hợp; không phải Supabase authenticated/concurrency UAT. Phân kho mới chưa gán tự động cho kế hoạch cũ. Chưa tự động đọc/ghép các chứng từ vật lý để điền bốn lượng kiểm kê; người dùng nhập và dẫn chứng. Điều chỉnh ngày có giao/bán posted và hủy toàn bộ SX về0 còn là luồng riêng, đang bị chặn an toàn. Không mở rộng sang phụ cấp, doanh thu/tiền thu, kiosk hay Dashboard trong checkpoint này.

Rollback vận hành: nếu chưa áp DB, bỏ file cập nhật. Nếu đã áp, có thể quay UI về bản trước, giữ toàn bộ bảng/snapshot/lịch sử028; sửa DB bằng migration tiến tiếp có kiểm thử, không xóa bảng đã có nghiệp vụ.

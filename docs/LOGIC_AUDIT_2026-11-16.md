# Rà soát logic CHIFAA COMBINE — 16/11/2026

Cập nhật nghiệp vụ liên kết: L01 đã chặn giao ca qua đêm; L02 báo cáo chung không ra kết quả khi thiếu ngày chấm công; L04 chặn thanh toán vượt dư; L05 có summary theo quyền nguồn, không cần đọc toàn sổ quỹ. L03 đã có snapshot cho sản xuất mới/liên kết qua ứng dụng; phiếu cũ chưa snapshot vẫn cần đối chiếu, không tự suy ra lịch sử. Đã thêm kiểm thử chống tái phát và các luồng 7 nhóm ở [NGHIEP_VU_LIEN_KET.md](NGHIEP_VU_LIEN_KET.md). Những mô tả v14/v15 dưới đây được giữ làm bằng chứng lịch sử; chưa phải nghiệm thu Google thực tế.

Cập nhật sau DEV v15: Chiến lược đã có màn hình riêng theo phác thảo và chặn kết quả thiếu một số nguồn; nhận xét bên dưới về Strategy dùng báo cáo chung là trạng thái v14. Các lỗi `report` chung/ca chồng giờ/lịch sử công thức/thu trả vượt vẫn tái hiện. Rà soát kết nối mới nhất và toast tại [KET_NOI_CHUC_NANG.md](KET_NOI_CHUC_NANG.md).

Phạm vi: mã đang tương ứng DEV phiên bản 14, 36 mục sidebar, 17 bảng nghiệp vụ, đối chiếu phác thảo gốc. Đây là rà soát tại workspace và chạy ví dụ bằng mock Apps Script; không đọc/sửa dữ liệu Google thật, không sửa nghiệp vụ và không triển khai phiên bản mới trong lượt rà soát.

## Kết luận

Hệ thống có xử lý thật: đọc/ghi Sheets, CRUD danh mục, sổ bất biến và đảo phiếu, công thức nhiều cấp, báo cáo, xác thực Google, phân quyền, nhật ký và phục hồi phiên. Tuy nhiên **chưa đầy đủ để coi là hệ thống vận hành/kế toán đã nghiệm thu**. Có 4 vấn đề đã tái hiện bằng dữ liệu nhỏ, 1 lỗi nối giao diện/quyền đọc xác nhận bằng mã, và nhiều luồng mới có một phần nghiệp vụ.

121 kiểm thử hiện có vẫn đạt; các trường hợp dưới đây cho thấy bộ kiểm thử đó chưa bao phủ hết nghiệp vụ. Không dùng số kiểm thử đạt để kết luận mọi chức năng hoàn chỉnh.

## A. Vấn đề cần sửa trước

| Mã | Ưu tiên | Phát hiện | Bằng chứng và ảnh hưởng |
| --- | --- | --- | --- |
| L01 | Cao | Chưa chặn ca chấm công chồng giờ | Cùng nhân viên/ngày, ca 07:00–12:00 và 08:00–13:00 đều lưu thành công. Lương cộng 10 giờ dù hợp khoảng thời gian chỉ 6 giờ. Backend chỉ kiểm tra trùng **giờ bắt đầu**, chưa kiểm tra giao nhau, gồm cả ca qua đêm. |
| L02 | Cao | Báo cáo thiếu chấm công vẫn có thể báo đủ đầu vào | Ví dụ có doanh thu/sản xuất/giá vốn nhưng 0 dòng chấm công: `completeness=complete-inputs`, lợi nhuận vẫn ra số, giờ SX là null. Chi phí lương rỗng đang được cộng như 0; cần phân biệt “chưa nhập” với “đã xác nhận không phát sinh”. |
| L03 | Cao | Sửa công thức hiện tại làm đổi giá vốn kỳ cũ | Cùng ngày sản xuất cũ, giá vốn đổi từ 2 thành 4 khi sửa định lượng công thức hiện tại từ 1 thành 2. Giá nhập có lọc theo ngày nhưng công thức không có phiên bản hiệu lực/snapshot gắn với phiếu sản xuất. Báo cáo lịch sử vì vậy không được cố định. |
| L04 | Vừa | Chưa kiểm soát trả/thu vượt số dư | Vay gốc 100, nhập phiếu trả vay 150 vẫn được chấp nhận; dư nợ ra -50. Chưa có quy tắc chặn hoặc tách phần trả trước/dư trả; tương tự cần kiểm tra luồng thu/trả công nợ. Đây là khoảng trống quy tắc, không tự chọn cách xử lý kế toán trong lượt rà soát. |
| L05 | Vừa | Một số bảng tài chính mất phần tổng hợp khi chỉ cấp đúng mục | `renderRecords` chỉ hiện tổng hợp khoản vay/công nợ/khấu hao khi có `state.data.cash`. Nhưng ô tick Tài sản/Khoản vay/Công nợ hiện chỉ cấp bảng tương ứng, không cấp cash. Người dùng có thể thấy bảng gốc nhưng không thấy dư nợ/khấu hao. Riêng khấu hao không cần sổ quỹ nên điều kiện này không phù hợp. Không nên sửa bằng cách tự cấp sổ quỹ rộng cho mọi người. |

Nguồn mã:

- L01: [kiểm tra ca](../src/server/api.js#L99), [cộng lương](../src/shared/domain.js#L94).
- L02: [tính lợi nhuận và độ đầy đủ](../src/shared/domain.js#L133).
- L03: [giá vốn dùng công thức hiện tại](../src/shared/domain.js#L147); bảng công thức được sửa qua luồng `mutate_`.
- L04: [kiểm tra liên kết sổ quỹ](../src/server/api.js#L101), [dư nợ](../src/shared/domain.js#L181).
- L05: [điều kiện hiển thị tổng hợp](../src/client/app.js#L137), [nguồn quyền đọc theo trang](../src/shared/access.js#L4).

Chạy lại ví dụ: `node scripts/audit-logic.mjs`. Kết quả được ghi tại `output/logic-audit-evidence.json`. Script chỉ dùng mock trong RAM, không gọi Google.

## B. Những luồng còn thiếu hoặc chưa nối đủ

| Nhóm/mục sidebar | Logic đang có | Phần còn thiếu |
| --- | --- | --- |
| Kế hoạch & chốt sản xuất; tổng quan nhập liệu | Lưu phiếu kế hoạch, sản xuất chính/thêm/lỗi/hủy; tính sản lượng đạt | Chưa có trạng thái và quy trình chốt ngày/mở lại, kiểm tra đầu vào trước chốt, khóa sửa kỳ đã chốt. Nhãn “chốt” hiện không tương đương một workflow chốt. |
| Kho, sản xuất, kiểm kê | Sổ nhập/xuất/điều chỉnh, tồn tính từ sổ kho; đối chiếu dùng thực tế/lý thuyết | Phiếu sản xuất chỉ tạo hiệu ứng trên bảng production, không tự sinh phiếu xuất nguyên liệu. Kiểm kê cũng chưa tạo bút toán điều chỉnh tồn tự động. Muốn tồn sổ thay đổi phải có phiếu kho riêng. Nếu bổ sung tự động cần chống ghi trùng khi đảo/chốt lại. |
| Hàng trả về ki-ốt | Doanh thu có số lượng trả và hỗ trợ thu hồi | Chưa có phiếu luân chuyển giữa điểm bán–ki-ốt, ghi nhận nhận hàng/tái bán và kiểm soát đếm trùng. |
| Khoản vay | Lưu gốc, lãi suất, hạn trả; tính gốc còn lại từ sổ quỹ liên kết | **Chưa có tính lãi vay**: đổi lãi suất từ 0% lên 30% cho cùng khoản vay không làm đổi kết quả `finance`. Chưa có lịch trả/kỳ lãi/phân bổ gốc–lãi. Nội dung cũ nói “đã tính lãi riêng” là chưa chính xác. |
| Tài sản; lợi nhuận | Có tính khấu hao đường thẳng và giá trị sổ riêng | Chưa đưa chi phí khấu hao/lãi vay vào lợi nhuận báo cáo, chưa có bút toán phân bổ/chốt khấu hao. Quy tắc đang được ghi rõ là tạm tính. |
| Doanh thu; công nợ | Thu nợ cũ không bị tính thành doanh thu; công nợ có phiếu thu/trả liên kết riêng | Trường `oldDebtPaid` trên doanh thu không phân bổ vào từng khoản công nợ. Chưa tự đối chiếu khoản đã thu đó với số dư để tránh ghi thiếu hoặc ghi thu hai lần khi nhập thêm phiếu quỹ. |
| Dashboard điều hành/vận hành/chiến lược | Báo cáo chung, biểu đồ doanh thu, cùng thứ hai tuần, kịch bản hòa vốn, trần thưởng | Nhiều cảnh báo/chỉ số/biểu đồ riêng trong phác thảo chưa chuyển đủ. Chiến lược chủ yếu là kịch bản nhập tay, chưa phải kế hoạch lưu và đối chiếu tự động. Trường `plans.fixedCost` được lưu nhưng chưa dùng trong `targets`/báo cáo tự động. |
| Chấm công/lương | Ca qua đêm, tiền giờ, phụ cấp, tạm ứng, khấu trừ; cộng theo nhân viên/bộ phận | Chưa đủ workflow lương tháng/chốt bảng lương, bộ lọc nhóm riêng, phiếu lương/in biểu, chi lương gắn sổ quỹ. Trần thưởng được tính nhưng không tự tạo phiếu chi/thưởng. |
| Đơn đặt hàng/Portal | Thư mời ký, giới hạn điểm giao, tạo pending, duyệt/từ chối nội bộ; nhu cầu đơn duyệt tách khỏi kế hoạch | Chưa có tra cứu trạng thái đơn cho khách. Publish catalog/import đơn là hàm bảo trì riêng, không được cài tự động bởi `installTriggers_`; cần vận hành thủ công hoặc nối lịch/UI. Đơn đã duyệt nội bộ chưa được đẩy trạng thái ngược về workbook Portal. |
| Bảng dữ liệu/in biểu | Tìm kiếm, lọc ngày, xuất CSV ở bảng được cấp quyền; CSS in cơ bản | Chưa có phân trang phía server và mẫu in từng nghiệp vụ. Bảng vượt 5.000 dòng hiện bị chặn bằng lỗi LIMIT; một bảng lớn có thể làm bootstrap/Admin hoặc thao tác đọc toàn bộ dữ liệu thất bại. |
| Nhập dữ liệu cũ, backup/restore, đồng bộ | Có preview/apply import, journal rollback, scan thay đổi, backup và tạo bản restore để duyệt | Các hàm bảo trì có backend nhưng chưa có màn hình vận hành đầy đủ; chưa xác nhận trigger/backup/restore thật trên Google và chính sách retention. Đây là “có hàm, chưa nối/nghiệm thu đủ”, không phải hoàn toàn chưa có logic. |

Nguồn: `src/server/api.js` (mutation chỉ ghi một module), `src/shared/domain.js`, `src/server/operations.js`, `src/client/portal.js`, `src/client/app.js`. Hàm `installTriggers_` hiện cài edit/scan/backup, không cài publish/import Portal. Giới hạn 5.000 dòng nằm tại `src/server/storage.js:18`.

## C. Những phần đã có logic, không nên gọi là “chỉ có giao diện”

- Danh mục vật tư/điểm bán/món/nhân viên/chiết khấu có đọc, lưu, sửa/xóa theo quyền và kiểm tra tham chiếu.
- Công thức nhiều cấp có tính yield, mở rộng thành phần, phát hiện vòng lặp và tính giá theo phiếu nhập trước ngày báo cáo; còn thiếu lịch sử phiên bản công thức như L03.
- Sổ giao dịch bất biến có đảo phiếu, version/hash phát hiện xung đột, idempotency/journal/rollback.
- OAuth, phiên có chữ ký, chống phát lại, một Admin, thu hồi, khôi phục phiên; ô tick quyền sidebar/module/action, cache theo quyền và các màn hình loading đều có mã và kiểm thử.
- Nhật ký và thông tin đồng bộ có endpoint thật; hình chụp trước của người dùng đã xác nhận Admin mở được dữ liệu audit. Chưa thay cho kiểm thử hai tài khoản Google riêng/ACL workbook.

## D. Thứ tự xử lý đề nghị

1. Sửa L01–L03 trước vì có thể làm sai lương và báo cáo lịch sử; bổ sung ca kiểm thử chống tái phát.
2. Xác định quy tắc trả vượt/thu dư và sửa L04; sửa điều kiện tổng hợp/quyền nguồn L05 bằng quyền tối thiểu.
3. Hoàn thiện chốt ngày/sản xuất, liên kết kho, hàng trả và phân bổ thu nợ với journal đa bảng/idempotency.
4. Hoàn thiện lãi vay/khấu hao/lợi nhuận sau khi chốt quy tắc tính; sau đó Portal và các biểu mẫu, phân trang, dashboard chi tiết.
5. Chạy UAT Google DEV bằng Admin và kế toán thật, kiểm tra quyền đọc/ghi và ACL trực tiếp; không đánh dấu sẵn sàng vận hành chỉ dựa trên kiểm thử mock.

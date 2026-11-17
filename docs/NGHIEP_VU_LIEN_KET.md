# Vận hành các nghiệp vụ liên kết trên DEV

Thay đổi này nối 7 nhóm chức năng đã được yêu cầu. Không đổi workbook nội bộ sang công khai, không cấp Editor cho nhân viên/kế toán, không đổi các cột nghiệp vụ đang có. Có thêm các bảng hệ thống được bảo vệ: `_Workflows`, `_Periods`, `_JournalChunks`.

## Khởi tạo sau cập nhật

1. Tải lại Web App DEV, đăng nhập Admin và mở **Nhật ký & đồng bộ**.
2. Bấm **Khởi tạo / kiểm tra cấu trúc** một lần. Hàm kiểm tra toàn bộ header trước khi thêm bảng, giữ các dòng hiện có. Nếu phát hiện cột khác dự kiến, dừng để đối chiếu; không ghi đè.
3. Nếu chưa có backup, bấm **Tạo thư mục backup riêng tư**, sau đó **Tạo backup ngay**. Có thể nhập ID thư mục đã có nhưng backend sẽ từ chối thư mục chia sẻ công khai hoặc có người khác được cấp xem/sửa. Cần kiểm tra ACL thực tế trước nghiệm thu.
4. Nếu đã có Portal riêng, điền ID workbook và URL `/exec` Portal rồi lưu. Nếu chưa có, nút **Tạo workbook Portal DEV riêng** tạo workbook mới chỉ có dữ liệu công bố và sổ đơn, không chép bảng nhân viên/tài chính nội bộ.
5. Bấm **Cài lịch scan, backup và Portal** sau khi đã cấu hình. Lịch gồm scan 5 phút, Portal 5 phút khi có cả ID workbook và URL Web App riêng, backup mỗi ngày lúc 02:00 Việt Nam khi có thư mục. Cài lại không nhân đôi handler. Tình trạng cài/chạy thật trên tài khoản Google vẫn phải xác nhận.

Trước khi khởi tạo, ghi sản xuất/kiểm kê sẽ báo CONFIG để tránh lưu phiếu rời không có liên kết. Các phiếu cũ không tự bị xuất kho/điều chỉnh hồi tố.

## 1. Sản xuất và kiểm kê tự cập nhật kho

Lưu phiếu sản xuất mới qua ứng dụng sẽ mở công thức theo sản lượng chính + thêm, kể cả phần lỗi đã sử dụng nguyên liệu. Backend kiểm tra tồn theo ngày, giá nhập lịch sử, rồi ghi chung một giao dịch: phiếu sản xuất, các phiếu xuất nguyên liệu và snapshot định lượng/giá vốn. Thiếu công thức/giá hoặc không đủ tồn thì không ghi cả lô.

Lưu kiểm kê tạo điều chỉnh tăng/giảm bằng **tồn thực tế cuối ngày − tồn sổ đến ngày kiểm kê**. Không xuất nguyên liệu lần hai theo chênh lệch tiêu hao. Chỉ một kiểm kê/vật tư/ngày; không thêm phiếu kho/sản xuất hồi tố qua một lần kiểm kê đã hoàn tất, tránh làm sai số tồn đã xác nhận.

Đảo phiếu nguồn sẽ đảo cả các phiếu tự động đi kèm. Không được đảo riêng phiếu kho tự động. Muốn sửa trước một lần kiểm kê sau đó, hoàn tác từ lần kiểm kê mới nhất trước. Các hiệu ứng ghi chung vào journal, retry dùng cùng khóa không tạo thêm; lỗi giữa lô được rollback, giao dịch PREPARED chưa phục hồi sẽ chặn ghi mới.

Snapshot cố định giá vốn **phiếu đã liên kết** khi sửa công thức sau này. Phiếu lịch sử chưa liên kết vẫn dùng công thức hiện tại: không thể tự suy ra công thức cũ nếu trước đây không lưu. Nút **Liên kết kho** cho phiếu cũ chỉ dùng sau khi đối chiếu, tránh xuất kho lần nữa cho phiếu đã được nhập thủ công. Không tự chuyển toàn bộ dữ liệu cũ.

## 2. Khóa / mở lại ngày hoặc kỳ

Admin chọn khoảng ngày và ghi lý do đối soát ở **Nhật ký & đồng bộ**, bấm **Khóa kỳ đã đối soát**. Backend chặn tạo, sửa, xóa và đảo các phiếu có ngày trong kỳ, cả qua API hoặc import; không chỉ ẩn nút trên giao diện. Kỳ lương giao với khoảng khóa cũng bị chặn. Không khóa hai khoảng giao nhau.

Muốn sửa, Admin nhập lý do tối thiểu 5 ký tự và chọn **Mở lại** đúng kỳ. Lịch sử khóa/mở được giữ và audit. Đây là quyền ứng dụng; chủ sở hữu có toàn quyền Google vẫn có thể sửa trực tiếp Sheet, nên cần kiểm tra đồng bộ/hash và không cấp quyền sửa workbook cho tài khoản app.

## 3. Portal tự đồng bộ và tra cứu trạng thái

Portal vẫn dùng **dự án Apps Script và workbook riêng**. Triển khai cùng gói mã ở dự án Portal, đặt `APP_MODE=portal`, `SPREADSHEET_ID` là workbook Portal, và `PORTAL_SIGNING_SECRET` giống dự án nội bộ. Chủ sở hữu lấy/nhập khóa trực tiếp trong Script Properties, không đưa vào HTML/chat. Nếu tạo workbook bằng nút mới, khóa nội bộ được tạo nếu chưa có, nhưng không trả về trình duyệt.

Sau khi cấu hình ID/URL và cài lịch, job công bố danh mục, nhập tối đa 50 đơn mới mỗi lượt và cập nhật trạng thái đã duyệt/từ chối ngược về Portal. Đơn nhập dùng ID/journal để không nhập trùng. Sửa nội dung nguồn sau nhập bị báo xung đột; đơn Portal giữ nguyên nội dung, muốn thay đổi thì từ chối và lập đơn thay thế. Trạng thái khách có thể trễ đến lượt đồng bộ tiếp theo.

Admin tạo thư mời theo điểm bán/khách, hiệu lực 1–30 ngày. Sau khi gửi đơn, khách nhận mã và có mục **Tra cứu trạng thái đơn**. Chỉ đúng thư mời đã tạo đơn mới xem được mã đó; thư mời khác cùng điểm bán cũng không xem được. Cổng này không có quyền gọi API nội bộ hoặc đọc workbook nội bộ.

Chưa có URL/Script ID dự án Portal được xác nhận trong phiên làm việc này. Tạo workbook không đồng nghĩa đã triển khai Web App Portal. Phần kết nối Google thật cần hoàn tất sau khi có cấu hình; không coi kiểm thử mock là nghiệm thu tích hợp Google.

## 4. Công nợ và lãi vay

**Công nợ:** tại mục Công nợ, chọn ngày, sổ tiền và các khoản cần phân bổ. Phiếu mới tạo thu/chi theo từng khoản. Chọn nguồn thu nợ cũ từ phiếu doanh thu thì tổng phân bổ phải bằng `oldDebtPaid`, chỉ giảm dư nợ, không ghi tiền vào sổ quỹ lần hai. Cần quyền đọc doanh thu để chọn phiếu cũ. Phiếu doanh thu mới không nhập gộp thu nợ cũ; dùng nghiệp vụ phân bổ riêng.

Không thu/trả quá dư nợ hoặc trả gốc vượt gốc còn lại. Phần dư trả không tự đổi thành ứng trước. Khoản đã có thanh toán không sửa/xóa gốc hoặc hợp đồng; hoàn tác trước hoặc lập hồ sơ thay thế theo đối soát.

**Lãi vay:** người dùng **tự nhập số tiền lãi** theo thỏa thuận cho từng khoản vay/kỳ. Chọn khoản vay, từ ngày, đến ngày/ngày ghi chi, sổ tiền và số tiền lãi lớn hơn 0. Không tự tính theo lãi suất, số ngày hoặc dư nợ, không cộng lãi vào gốc. Lãi suất trong hồ sơ vay chỉ là thông tin tham khảo.

Bấm **Xem trước** để đối chiếu tiền lãi nhập, rồi **Xác nhận lập phiếu**. Đây là chứng từ thu–chi trong hệ thống, không tự chuyển tiền qua ngân hàng. Không lập hai kỳ lãi giao nhau; ngày kết thúc là mốc bắt đầu kỳ kế tiếp. Lưu snapshot để xem/in lại. Muốn sửa kỳ đã ghi hoặc điều chỉnh trả gốc hồi tố qua kỳ đã chi, Admin hoàn tác lô lãi với lý do trước rồi nhập lại.

Báo cáo kết quả trừ lãi vay **đã có phiếu chi** vào ngày ghi chi. Không tự hạch toán lãi dồn tích chưa trả. Chưa đưa khấu hao vào kết quả hoặc phân bổ tồn thành phẩm; cần nghiệm thu quy tắc kế toán trước khi sử dụng chính thức.

## 5. Lương / thưởng và phiếu chi

Ở **Bảng lương tháng**, chọn từ/đến ngày, sổ tiền và thưởng theo nhân viên. Quy tắc giờ/phụ cấp/ứng/trừ giữ nguyên; đã chặn ca chồng nhau kể cả qua đêm. Thưởng cần quyền đọc kế hoạch và không vượt ngân sách trần hiện có. Thưởng theo nhân viên chỉ tính một lần nếu người đó có nhiều bộ phận.

Xem trước bảng thực lĩnh, sau đó xác nhận lập phiếu chi từng nhân viên/bộ phận trong cùng một giao dịch. Không chốt hai kỳ lương giao nhau. Chấm công trong kỳ đã lập chi không được nhập/sửa/đảo hoặc import thêm cho đến khi Admin hoàn tác lô. Tạm ứng trên chấm công được trừ khỏi thực lĩnh; cần đối chiếu khoản ứng đã chi trước đó, hệ thống không tự suy ra phiếu ứng quá khứ.

Bảng đã chốt lưu snapshot số tiền và tên nhân viên. Mục **Các lần đã chốt** cho xem và in lại theo quyền nguồn, không phải nhập lại để lấy phiếu in. Phiếu lương in từ preview ghi rõ bản xem trước; phiếu đã chốt lấy snapshot. Chi lương không bị cộng lần hai vào chi phí báo cáo vì lương đã được tính từ chấm công.

Admin có thể hoàn tác cả lô lương/lãi/phân bổ ở Nhật ký & đồng bộ, với lý do; không đảo riêng một phiếu tự động. Khóa kỳ vẫn được áp dụng khi hoàn tác.

## 6. Backup / restore / import

Màn hình Admin có nút backup, tạo bản phục hồi mới, phục hồi giao dịch dở dang và nhập CSV/JSON có xem trước. Phục hồi backup chỉ nhận ID đã được ghi trong nhật ký BACKUP của hệ thống, tạo workbook mới để kiểm tra, **không đổi `SPREADSHEET_ID` đang chạy**. Không tự xóa backup cũ; chính sách lưu trữ cần thống nhất riêng.

CSV: chọn phân hệ, tải mẫu tiêu đề, giữ `recordId` duy nhất. Có thể dùng CSV xuất từ app; cột metadata khác được bỏ qua khi nhập, dữ liệu phải hợp lệ theo schema. Số dùng dạng `12000.5`, không phân cách hàng nghìn; boolean `TRUE/FALSE`; ngày `YYYY-MM-DD`. Mảng công thức dùng JSON trong ô CSV đã quote. JSON nhiều phân hệ theo `{records:[{module,recordId,record}]}`. Tối đa 500 bản ghi hoặc 1 MB/tệp.

Nhập theo thứ tự danh mục → công thức con → công thức cha → phiếu theo ngày tăng dần. Với sản xuất/kiểm kê phải tick liên kết kho và đối chiếu các phiếu tự động trong preview; không nhập lại xuất kho đã có. Không ghi đè ID. Preview không ghi dữ liệu; thay đổi nguồn/giá/khóa kỳ sau preview sẽ buộc xem lại. Lô lớn được journal theo các chunk có hash; giới hạn 1,5 triệu ký tự hiệu ứng và 45.000 ký tự/ô, cần chia lô khi vượt. Các chunk là nhật ký phục hồi, không cấp cho tài khoản thường.

## 7. Dữ liệu lớn và mẫu in

Bootstrap lấy tối đa 200 dòng đầu mỗi bảng, báo rõ bảng còn phần chưa tải. Bảng nghiệp vụ tải 50 dòng/trang, tìm kiếm/lọc ở server. Báo cáo và danh mục tham chiếu cần đủ dữ liệu được tải tiếp theo chunk 200, có spinner, kiểm tra stamp; không tính báo cáo trên 200 dòng đầu rồi coi là tổng đầy đủ. Xuất CSV tải hết các trang; kiểm thử đã đối chiếu 5.101 dòng. Đã bỏ chặn cứng 5.000 dòng, nhưng vẫn chịu quota/thời gian và giới hạn ô của Apps Script/Sheets, không phải cơ sở dữ liệu không giới hạn.

Có **In phiếu**, **In báo cáo**, **Phiếu lương**. Mẫu có logo, mã/phiên bản, thông tin nghiệp vụ và chỗ ký; công thức in thành phần, sản xuất in giá vốn/định lượng đã chốt. Bản in chỉ nằm trong DOM và được dọn khi kết thúc in; không tự gửi email hoặc đưa lên dịch vụ ngoài.

## Phân quyền cho phiếu liên kết

Trong ô tick quyền theo sidebar có thêm **Phiếu liên kết** cho sản xuất/kiểm kê/lương/khoản vay/công nợ. Quyền này cấp ghi vào bảng đích cần thiết, **không tự cấp đọc toàn bộ kho/sổ quỹ**. Backend chặn ghi trực tiếp sổ không được chọn, chỉ cho nghiệp vụ nguồn đã kiểm tra tạo phiếu liên kết. Ví dụ: kế toán được mở Khoản vay + Phiếu liên kết có thể chi lãi nhưng API đọc sổ quỹ và ghi thẳng vốn đầu kỳ vẫn bị từ chối. Không cần Editor workbook.

Nếu vẫn dùng phân quyền cũ không có `_routes`, chính sách module/action cũ giữ tương thích; nên lưu lại bằng giao diện tick mới để được giới hạn ghi theo mục cụ thể. Admin có toàn quyền ứng dụng, nhân viên không có quyền bảo trì/khóa kỳ/hoàn tác lô tài chính.

## Kiểm thử và nghiệm thu

Các ca local gồm: ghi và rollback nhiều bảng, đảo nguồn/khóa kỳ, chống retry trùng, giá vốn snapshot, nhập giá đổi sau preview, ca qua đêm chồng nhau, trả vượt, lãi nhập tay không tự tính và chặn kỳ trùng, lương không chốt trùng và in lại snapshot lớn, journal chunk/recovery, Portal hai workbook và hai thư mời, CSV, đọc/ghi theo quyền tối thiểu, phân trang/CSV 5.101 dòng. Đã kiểm tra Chrome desktop và điện thoại 390px với fixture cục bộ, cùng mẫu in chứng từ; thay đổi cuối về lãi nhập tay được kiểm tra bằng test DOM/API.

Các ca trên không thay cho Google UAT: cần Admin và kế toán Google riêng, kiểm tra ACL workbook/thư mục, chạy trigger/backup/restore trên Google, triển khai Portal riêng và đối chiếu số liệu thật. Không tự đánh dấu `ACCOUNTING_APPROVED=true` hoặc triển khai Production.

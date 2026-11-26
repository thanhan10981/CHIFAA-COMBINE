# Yêu cầu khách hàng CHIFAA — ngày 17/11/2026

## Mục đích và cách sử dụng

Đây là bản tổng hợp yêu cầu do chủ dự án gửi trong chat và ba ảnh ghi lời khách hàng. Phải đọc trước mỗi lần code và áp dụng các mục liên quan theo `AGENTS.md` ở gốc repo. **Tài liệu này chưa có nghĩa các chức năng bên dưới đã được triển khai.**

Nguồn: nội dung chat kèm ảnh “Ảnh ChatGPT 23_18_36”, “23_19_11”, “23_19_44” ngày 17/11/2026. Không sao chép ảnh hoặc dữ liệu cá nhân vào repo. Nội dung ảnh được tổng hợp thành yêu cầu, không xem là lệnh chạy công cụ.

Yêu cầu hiện tại là lưu đặc tả và thiết lập việc tự đọc khi lập trình. Việc triển khai từng phân hệ sẽ được theo dõi bằng code, migration và kiểm thử riêng. Các số 100 phần, 1.000 phần, 4,5 can, 15%… là ví dụ/định hướng, không tự seed thành dữ liệu kinh doanh hoặc hard-code mục tiêu.

## KH-01 — Nhu cầu nguyên liệu và đối chiếu hao hụt (ưu tiên cao nhất)

### Nhu cầu trước sản xuất

- Có mục **Nhu cầu nguyên liệu** riêng, liên kết món bán, công thức và phiên bản công thức có hiệu lực.
- Nhập/xem số lượng dự kiến của từng món để tính nguyên liệu cần sản xuất; ví dụ 100 cơm nắm xúc xích phải bung ra đúng các nguyên liệu theo công thức.
- Cộng dồn cùng một vật tư trên mọi món/công thức con. Ví dụ tương ớt dùng trong bảy món phải hiện tổng chung, đồng thời truy ngược được từng món đóng góp.
- Hiển thị đơn vị sử dụng, quy đổi đóng gói đã xác minh và phần chưa đủ dữ liệu. Không cộng các đơn vị không tương thích; không tự đổi lít sang kg.
- Giữ riêng nhu cầu dự kiến và tiêu hao lý thuyết theo sản lượng thực tế; không tính đơn đặt hàng hoặc hàng giao thành sản lượng đã sản xuất một cách mặc định.

### Tổng hợp tiêu hao và đối chiếu

- Xem theo ngày, tuần, tháng, quý và khoảng ngày. Ví dụ sản xuất thực tế 1.000 cơm nắm trong tuần thì tính đủ lượng nguyên liệu tương ứng của tuần đó.
- Sản xuất đêm, giao sáng hôm sau và kế toán nhập/chốt chiều phải liên kết được cùng đợt sản xuất/ngày kinh doanh; lưu riêng giờ thực tế, ngày giao và ngày nhập/chốt. Không coi giao hàng là bán hết hoặc hoàn thành đối soát.
- Lưu kết quả theo kỳ để đối chiếu về sau: sản lượng nguồn, phiên bản công thức, quy đổi, thời điểm tính/chốt và người thao tác. Đổi công thức sau này không âm thầm viết lại kỳ đã chốt.
- So sánh tiêu hao lý thuyết với tiêu hao thực tế từ tồn đầu/cuối kiểm kê và các luồng nhập, xuất khác, chuyển kho, trả lại, hủy/điều chỉnh có chứng từ. Không suy mức sử dụng chỉ bằng tồn cuối hoặc chênh lệch hai lần đếm thiếu các luồng ở giữa.
- Hiện lượng chênh lệch, tỷ lệ hao hụt/chênh lệch và nguồn số liệu; cho phép truy xuống vật tư, món, kỳ và chứng từ. Không tự kết luận gian lận chỉ từ một chênh lệch.
- Khi triển khai phải công khai công thức tỷ lệ và dấu tăng/giảm. Đề xuất đối chiếu: `(tiêu hao thực tế - tiêu hao lý thuyết) / tiêu hao lý thuyết × 100%`; đây là công thức cần ghi rõ trong đặc tả tính toán trước nghiệm thu. Mẫu số 0 hoặc thiếu dữ liệu phải hiện chưa tính được, không hiện 0% giả.
- Tính lượng vẫn có thể hiển thị nếu công thức/đơn vị đã rõ mà giá chưa xác minh; giá vốn chính thức phải chờ cơ sở giá xác minh. Không che giấu thiếu sót bằng tổng giá vốn một phần.

### Tách khỏi cảnh báo tồn tối thiểu

- Cảnh báo thiếu vật tư lấy mức tồn tối thiểu được cài trong danh mục và tồn kho có nguồn.
- Tồn tối thiểu và nhu cầu nguyên liệu cộng dồn là hai góc nhìn khác nhau; báo cáo phải hỗ trợ cả hai.
- Chưa kiểm kê/tồn không rõ là chưa có dữ liệu, không mặc định tồn bằng 0; mức tối thiểu trống khác mức 0.

Nghiệm thu: cùng vật tư dùng nhiều món được cộng đúng; truy được công thức nguồn; xem được tuần/tháng/quý; đổi công thức không đổi snapshot cũ; thiếu quy đổi/kiểm kê được chỉ rõ; đối chiếu có lượng và % với mẫu số rõ ràng.

## KH-02 — Chấm công, lương và phụ cấp

- Nhân viên lấy từ danh mục chung, không nhập lại danh sách riêng hoặc liên kết bằng tên tự do.
- Bảng có STT, mã nhân viên, tên, giờ vào, giờ kết ca, nghỉ giữa ca (nếu có), số giờ công, mức lương giờ và tiền lương.
- Hỗ trợ ca qua nửa đêm: 23:00 hôm trước đến 07:00, 08:00 hoặc 09:00 hôm sau. Phải lưu cả ngày lẫn giờ, không trừ hai giờ đồng hồ mà bỏ ngày.
- Phân biệt ngày bắt đầu ca, ngày kết thúc và ngày kinh doanh/kỳ lương; quy ước phân bổ qua kỳ phải rõ trước khi tính/chốt.
- Có cột nhập **phụ cấp/hỗ trợ riêng ngày hoặc ca**, số tiền tùy thực tế; cộng vào phiếu chấm công và tổng lương liên quan. Không có mức phụ cấp mặc định.
- Yêu cầu này bổ sung cho phụ cấp tháng đã làm ở026: phụ cấp ngày/ca và phụ cấp tháng là các khoản riêng, chỉ cộng mỗi khoản một lần; không tự chia phụ cấp tháng vào ca hoặc chuyển phụ cấp ngày thành mức mặc định.
- Nếu cần tách phụ cấp và hỗ trợ thành hai loại, phải thể hiện loại khoản và lý do; tránh tạo hai cột cùng cộng một khoản tiền.
- Tách ba nhóm **Sản xuất / Văn phòng / Bán hàng**. Có thể nhập trên một bảng nhưng bảng lương và báo cáo phải lọc/tách được từng nhóm.
- Mức lương từng nhân viên/nhóm có thể khác nhau và theo ngày hiệu lực; giữ mức lương và nhóm tại thời điểm ca để sửa danh mục không làm thay đổi ca đã chốt.
- Nhân viên chưa phân bộ phận phải được cảnh báo; không tự gán vào sản xuất.

Nghiệm thu: ca 23:00–07:00 ngày sau là 8 giờ trước trừ nghỉ; ba nhóm tách được; phụ cấp ca cộng đúng một lần; tháng không có phụ cấp không lấy tháng trước; lương/nhóm cũ giữ nguyên sau đổi danh mục.

## KH-03 — Sản lượng, sản xuất thêm và lỗi

- Bổ sung cột **Sản xuất thêm** trong phần sản lượng và lỗi sản xuất.
- Lưu riêng kế hoạch/sản lượng ban đầu, sản xuất thêm, sản lượng thực tế tốt và lỗi/hủy sản xuất; chỉ cộng sản xuất thêm một lần.
- Nhu cầu nguyên liệu, năng suất và giao hàng phải truy được đợt sản xuất gốc/thêm; không vừa lấy tổng đã gồm phần thêm vừa cộng cột thêm lần nữa.
- Tách lỗi sản xuất khỏi hủy ở điểm bán và hàng được chấp thuận thu hồi. Hiện tại khách gần như không có lỗi sản xuất không có nghĩa hệ thống được tự điền 0 khi chưa có báo cáo.

Nghiệm thu: nhập thêm một đợt làm tăng tổng đúng một lần; lỗi/hủy/thu hồi không bị gộp chung thành một tỷ lệ.

## KH-04 — Trả hàng, hỗ trợ thu hồi và kiosk

- Chỉ hàng khách báo và chủ chấp thuận thu hồi mới tạo phiếu thu hồi, theo điểm bán/ngày/món/số lượng.
- Ví dụ giao 100, khách bán 80, chấp thuận thu hồi 10, 10 còn lại khách tự chịu: chỉ 10 được thu hồi; không tự giảm nghĩa vụ thanh toán cho toàn bộ 20 chưa bán.
- Có **đơn giá hỗ trợ thu hồi riêng** giá bán; giữ giá bán gốc, chiết khấu và giá hỗ trợ tại thời điểm xử lý.
- Thể hiện số lượng, đơn giá, thành tiền hỗ trợ và tham chiếu giao/đơn nguồn; chống thu hồi vượt lượng còn được phép hoặc gửi trùng.
- Khi xác nhận nhận lại hàng, chuyển đúng lượng hàng/món được thu hồi vào điểm **kiosk chung**. Hai đầu phải có liên kết, không tự cộng lượng kiosk ngay lúc mới lập nháp.
- Hàng nhận về chưa phải doanh thu kiosk; chỉ ghi bán khi có giao dịch bán. Tránh đếm cả thu hồi lẫn sản xuất mới làm tăng sản lượng sản xuất.
- Phản ánh khoản thu hồi/hỗ trợ trong đối soát điểm bán và số còn phải thu/thực thu. Không mặc định tiền đã chi hoặc đã bù trừ chỉ vì phiếu thu hồi được tạo.
- Theo dõi riêng hàng điểm tự chịu, hàng thu hồi, hàng hủy tại điểm và hàng kiosk xử lý; có điều chỉnh/đảo phiếu thay vì xóa lịch sử.

Nghiệm thu: ví dụ 100/80/10/10 giữ đủ bốn lượng; kiosk chỉ tăng 10 sau xác nhận; giá hỗ trợ khác giá bán; chạy lại không cộng đôi; truy được chứng từ giảm/bù trừ và tiền thanh toán.

## KH-05 — Doanh thu ngày, tiền thu và công nợ

- Nhập/xem theo điểm bán, món, ngày: lượng giao/bán, giá, chiết khấu, hàng thu hồi được chấp thuận, khoản hỗ trợ, nghĩa vụ thanh toán và tiền còn thiếu.
- Bổ sung hai cột **Tiền mặt** và **Chuyển khoản**; giữ liên kết tới khoản thu thực tế. Khách thường thanh toán trong ngày nhưng không được giả định mọi đơn đã thanh toán.
- Khách gọi “doanh thu thuần” là tiền thực nhận từ đơn trong ngày sau xử lý chiết khấu, khoản thu hồi và công nợ. Dashboard cần cho thấy đúng dòng tiền chủ muốn theo dõi, đồng thời tách doanh thu sau giảm trừ, thực thu đơn trong ngày, thu nợ cũ và công nợ còn lại.
- Thu nợ cũ không thành doanh thu bán hàng hôm nay; không lấy công nợ ngày trước trừ doanh thu ngày hiện tại một cách mù quáng. Mỗi bù trừ phải có phân bổ/chứng từ.
- Dữ liệu này liên thông Dashboard, tổng quan báo cáo và tỷ lệ mục tiêu, với cùng kỳ và cùng định nghĩa chỉ tiêu.

**Điểm phải làm rõ khi triển khai tài chính:** `DECISIONS.md` D01 trước đây định nghĩa doanh thu thuần là doanh thu sau giảm trừ (khác thực thu); D03 coi hỗ trợ thu hồi là chi phí riêng, không giảm doanh thu. Lời khách trong đợt này muốn thấy số thực nhận sau hỗ trợ. Phải lưu cả yêu cầu mới và quy tắc cũ, đối chiếu luồng tiền/đối soát, không âm thầm chọn một mẫu số hoặc trừ khoản hỗ trợ hai lần. Có thể trình bày hai chỉ tiêu với tên rõ ràng; việc đổi cách ghi nhận và mẫu số chính thức cần được quyết định khi xây phân hệ liên quan. Không cản triển khai phần độc lập.

## KH-06 — Kế hoạch và mục tiêu

Cho Admin cài theo kỳ/ngày hiệu lực, không hard-code từ ví dụ:

| Mục tiêu | Yêu cầu |
| --- | --- |
| Doanh thu ngày | Là nguồn kế hoạch hiển thị trên Dashboard |
| Food cost | Tỷ lệ trên mẫu số doanh thu được chốt ở KH-05; không chia cho giá bán lẻ khách tự bán khi đó không phải doanh thu CHIFAA |
| Nhân sự sản xuất | Tỷ lệ riêng; ví dụ trần 15%, theo mục tiêu thực tế đã cài |
| Hủy tại điểm bán | Tỷ lệ riêng, có mẫu số và kỳ rõ ràng |
| Trả hàng của điểm bán | Tỷ lệ riêng, tách hủy/lỗi sản xuất |
| Lỗi sản xuất | Giữ riêng mục tiêu tối đa; không đồng nhất với trả/hủy điểm bán |
| Chi phí cố định | Tỷ lệ chi phí trên doanh thu cùng kỳ |
| Quản lý / nhân sự văn phòng | Tỷ lệ riêng, không gộp vào nhân sự sản xuất |
| Khấu hao | Tỷ lệ riêng có nguồn dữ liệu |
| Marketing | Tỷ lệ riêng có nguồn dữ liệu |
| Số dư tối thiểu | Tổng tiền mặt và tiền ngân hàng/chuyển khoản có số dư thực, không lấy tổng lượt chuyển tiền làm số dư |

- Chủ động nhập/chỉnh mục tiêu từng khoản. Lưu lịch sử để báo cáo cũ so với mục tiêu đúng kỳ.
- Các tỷ lệ số lượng trả/hủy/lỗi phải công khai mẫu số trước khi dùng; không tự suy mẫu số từ tỷ lệ chi phí.
- Nếu đạt/vượt kế hoạch sản lượng và chi phí nhân sự sản xuất còn dưới trần, hiển thị khoảng ngân sách còn có thể cân nhắc thưởng, có công thức và nguồn. Đây là gợi ý, không tự tạo thưởng, phụ cấp hay thanh toán.

## KH-07 — Dashboard và năng suất

- Giữ xem ngày, bổ sung xem tuần/khoảng ngày và đối chiếu theo kỳ.
- Hiện doanh thu hôm nay, hôm qua, chênh lệch tiền và %; hiện kế hoạch doanh thu ngày từ KH-06. Mẫu so sánh bằng 0/thiếu phải có trạng thái phù hợp, không tạo % giả.
- Đổi khối “Doanh thu thuần 7 ngày gần nhất” thành **Doanh thu tuần trước**; cung cấp bộ lọc để so sánh cùng thứ tuần này với tuần trước (ví dụ thứ Năm với thứ Năm), không mặc định 7 ngày trượt tương đương một tuần lịch.
- Ghi rõ ngày bắt đầu/kết thúc tuần, múi giờ và chỉ tiêu doanh thu dùng; kỳ đang dở phải được nhận diện để tránh so sánh gây hiểu nhầm.
- Hiện các chỉ tiêu: **Giờ công hôm nay**, **Năng suất hôm nay (phần/giờ công)**, **Giờ công tháng này**, **Năng suất tháng (phần/giờ công)**, **Tỷ lệ lỗi tháng**, **Mục tiêu lỗi tối đa**.
- Giờ công và năng suất sản xuất chỉ lấy nhân sự **Sản xuất**. Không cộng giờ văn phòng/bán hàng; không suy giờ công từ tổng tiền lương chia một mức lương giờ giả định.
- Năng suất = sản lượng sản xuất được định nghĩa rõ / giờ công sản xuất thực tế cùng kỳ. Phải thống nhất phần tốt/tổng sản lượng, có tính thêm và cách quy đổi đơn vị món trước nghiệm thu; không cộng hộp/cây/phần tùy tiện.
- Chưa có giờ hoặc sản lượng hiện “Chưa có dữ liệu/Chưa đủ dữ liệu”, khác với giá trị 0 có nguồn.

## KH-08 — Tổng quan báo cáo điều hành

- Xem nhanh hàng ngày và tổng tuần/tháng/quý theo dữ liệu nguồn liên thông.
- Đưa những chỉ tiêu chủ cần hằng ngày vào thẻ/cột nổi bật phía trên: doanh thu/thực thu, mục tiêu, tỷ lệ chi phí sản xuất, văn phòng/quản lý, marketing, cố định, khấu hao; trả/hủy/lỗi và số dư tiền theo KH-06.
- So từng tỷ lệ với mục tiêu đúng kỳ để hiện đạt, gần trần, vượt trần; ngưỡng cảnh báo phải có quy tắc/cấu hình, không tự xem thiếu dữ liệu là màu xanh.
- Hiện khả năng cân nhắc thưởng khi sản lượng đạt/vượt và nhân sự sản xuất còn ngân sách; không tự duyệt chi.
- Phần rủi ro lấy từ số liệu ở trên, chỉ rõ nguyên nhân và cho truy nguồn; có cảnh báo vật tư dưới mức tối thiểu để quản lý kiểm lại kho và bổ sung.
- Liên kết tới nhu cầu nguyên liệu/đối chiếu để phân biệt tồn thiếu với tiêu hao chênh lệch.

## KH-09 — Nhập bù, bổ sung và sửa số liệu ngày

Từ ảnh “23_19_11”:

- Mặc định nhập ngày hôm nay nhưng cho chọn ngày nghiệp vụ cũ để nhập bù khi kế toán quên/nghỉ. Lưu thời điểm ghi nhận thực tế riêng ngày nghiệp vụ.
- Cho nhập bổ sung nhiều lần trong ngày: ví dụ nhập sáng và mua thêm chiều. **Bổ sung** chỉ cộng phần phát sinh mới, không gửi lại toàn bộ ngày làm tăng gấp đôi.
- Có luồng **Sửa/thay thế toàn bộ số liệu ngày** khi sáng nhập sai và chiều nhập lại đúng. Phân biệt rõ bổ sung với thay thế trong UI, có xem trước tác động và lý do.
- Mong muốn của khách là số liệu hiệu lực cuối ngày thay thế bản nhập sai; không thực hiện bằng xóa vật lý chứng từ đã chốt. Dùng phiên bản/đảo/điều chỉnh có liên kết, giữ lịch sử và chỉ đưa số hiệu lực vào tổng.
- Tôn trọng khóa kỳ, quyền, đồng thời nhiều người sửa và chống gửi trùng; dữ liệu đã thanh toán/ghi sổ cần workflow điều chỉnh phù hợp.

Nghiệm thu: nhập sáng + bổ sung chiều cộng đúng; thay thế toàn ngày không cộng chồng bản cũ; xem được lịch sử, người sửa và ngày nhập bù; kỳ khóa không bị vượt qua.

## KH-10 — Nguyên tắc xuyên suốt và thứ tự triển khai

- PostgreSQL/Supabase là nguồn chuẩn; hai workbook gốc chỉ là nguồn tham chiếu được giữ nguyên.
- Nhãn nghiệp vụ tiếng Việt, số tiền format VND, responsive điện thoại/tablet/desktop. Không dùng số demo làm số thật.
- Mọi số liệu báo cáo phải có kỳ, nguồn, mức đầy đủ và đường truy chứng từ. Tiền, sản lượng, luồng kho và công nợ không được tính trùng khi liên thông.
- Giá, công thức, quy đổi và lương dùng phiên bản có hiệu lực; nguồn thiếu/chưa xác minh không được đưa thành số chính thức giả.
- Lưu quyền, lịch sử, audit và chống gửi trùng cho các thao tác ghi; không sửa ngầm chứng từ đã chốt.
- Thứ tự ưu tiên khách nhấn mạnh: **KH-01 nhu cầu nguyên liệu/đối chiếu kho trước**, rồi các luồng nguồn liên quan sản lượng/công thức/kho; nhân sự, thu hồi/đối soát, mục tiêu và Dashboard theo phạm vi task tiếp theo.
- Trước mỗi task, chọn mã KH liên quan, kiểm tra phần đã có/chưa có và bổ sung tiêu chí nghiệm thu vào kiểm thử. Không tuyên bố hoàn tất toàn bộ yêu cầu từ việc chỉ lưu tài liệu này.

## KH-11 — Danh mục công thức theo mẫu chuẩn (bổ sung từ lượt gửi sheet)

- Đọc dữ liệu sheet công thức được gửi và phân tích kỹ các ảnh làm mẫu chuẩn cho công thức món, nhân/sốt, cơm chín, bao bì và tổng hợp giá vốn.
- Thực hiện chức năng tạo/sửa/sao chép, thành phần đa tầng, sản lượng mẻ, đơn vị, lịch sử/ngày hiệu lực và liên kết các danh mục liên quan để thao tác thuận tiện.
- Dữ liệu nguồn thiếu/mâu thuẫn phải giữ để đối chiếu, không tự dùng giá0 hoặc tổng mô phỏng làm giá vốn chính thức. Tôn trọng KH-01/KH-10 và xác minh giá vật tư dùng chung.
- Theo dõi triển khai và hướng dẫn SQL ở `RECIPE_CATALOG.md`; việc có tài liệu không tự xác nhận đã nhập dữ liệu cloud.

## KH-12 — Cổng đặt hàng công khai (bổ sung18/11/2026)

- Theo chỉ dẫn trực tiếp mới nhất của owner: ai có liên kết `/portal` cũng truy cập và gửi đơn được, không cần đăng nhập. Yêu cầu này thay phần bắt đăng nhập cho cổng công khai trong đặc tả cũ.
- Món được công bố trong Danh mục món bán và còn sử dụng phải hiển thị ở cổng; khách chọn số lượng. Dùng giá bán chung có hiệu lực, không công bố giá vốn, công thức, giá/chiết khấu riêng hoặc danh sách khách/điểm bán.
- Đơn gửi từ cổng công khai cần chờ nhân viên duyệt; không tự thành doanh thu, tiền thu, sản xuất hoặc xuất kho. Thông tin người đặt tự cung cấp không phải tài khoản/điểm bán đã xác thực.
- Tiếp tục KH-01/03/05/10: giữ snapshot giá/đơn vị, kiểm tra món công bố và giá ở server, chống gửi trùng, phân quyền duyệt và bảo vệ dữ liệu nội bộ. Kênh điểm bán có tài khoản có thể giữ riêng quyền xem đơn/giá của mình.

### Bổ sung 26/11/2026 — Chiết khấu theo số lượng từng món (KH-05/KH-10/KH-12)

- Owner chốt: chỉ món đang bật chiết khấu mới áp dụng; dưới50 là15%, từ50 trở lên là17% cho **toàn bộ số lượng của riêng món đó** trong đơn. Không cộng các món khác nhau hoặc các phần topping để vượt mốc; không quy đổi ngầm cây/hộp/phần sang cái.
- Món không bật hoặc chính sách chiết khấu bị tắt giữ0%. Server tính lại khi nhận đơn và khi sửa số lượng của đơn còn chờ duyệt; giao diện hiển thị cùng quy tắc. Hóa đơn/công nợ lấy snapshot của đơn, không tự sửa chứng từ đã chốt hoặc các đơn cũ chỉ vì đổi chính sách.

### Trạng thái checkpoint tài liệu ban đầu

Đã ghi nhận toàn bộ nhóm yêu cầu và đặt quy tắc đọc tự động tại `AGENTS.md`. Chưa triển khai thêm schema, RPC hay giao diện cho các yêu cầu mới trong checkpoint tài liệu này. 026 đã có phụ cấp tháng; không xem đó là đã có phụ cấp ngày/ca. Kết quả các checkpoint code trước nằm ở `HANDOFF.md` và `TEST_RESULTS.md`.

# 01 — ĐẶC TẢ NGHIỆP VỤ CHIFAA COMBINE

> Đây là tập hợp các yêu cầu người dùng đã nêu trong cuộc trò chuyện. ID `REQ-...` phải được Codex dùng cho traceability. Các số ví dụ là **ví dụ nghiệp vụ hoặc dữ liệu minh họa**, không mặc định là doanh thu/chi phí thực tế.

## A. Bối cảnh & mục tiêu vận hành

**REQ-CORE-01.** CHIFAA sản xuất nhiều món cơm nắm/cơm cuộn/mỳ trộn và bán qua nhiều điểm bán/ki-ốt. Tối lập kế hoạch sản xuất cho sáng hôm sau, sáng giao hàng, chiều kế toán chốt tình hình bán/thu hồi/thu tiền. Chủ cơ sở cần xem báo cáo điều hành hằng ngày, theo tuần và phát hiện chênh lệch nguyên liệu so với sản xuất.

**REQ-CORE-02.** Giữ dữ liệu quan trọng từ hai workbook Dashboard vận hành và kế toán, nhưng thay toàn bộ giao diện và nghiệp vụ bằng CHIFAA COMBINE chạy Apps Script/Google Sheets. File cũ có các ô `#REF!`/công thức đứt; **giữ dữ liệu gốc, không sao chép lỗi và không bịa giá trị thiếu**.

**REQ-CORE-03.** Dưới 10 người đồng thời; chi phí thấp, phản hồi nhanh, vẫn chỉnh được dữ liệu trên Google Sheets. Phân quyền ít nhất Admin, kế toán và nhân viên được Admin cấp chức năng. Có portal đặt hàng dành cho khách; không xem dữ liệu nội bộ.

**REQ-CORE-04.** Bản HTML trước đây là phác thảo; V17 là mốc có thêm Chiến lược; giao diện đối ngoại chuyên nghiệp và nhất quán. Phải nối nghiệp vụ thật với Sheets chứ không dừng ở localStorage/demo.

**REQ-CORE-05.** Mỗi dữ liệu có ngày nghiệp vụ (`business_date`, giờ Việt Nam), thời điểm tạo/sửa, người sửa, nguồn nhập (APP/SHEET/IMPORT), trạng thái tạm/chốt/điều chỉnh và phiên bản. Xem ngày/tuần/tháng/quý/năm khi phù hợp. Ca đêm dùng ngày nghiệp vụ được định nghĩa rõ.

## B. Danh mục – một nguồn chuẩn

**REQ-CAT-01. Danh mục vật tư:** Mã SP/vật tư, tên vật tư đầy đủ, đơn vị mua và đơn vị sử dụng, nhóm, quy cách, đơn giá, tồn tối thiểu, ghi chú/trạng thái. Danh mục mẫu có khoảng 63 mã vật tư trong phác thảo, phải đọc nguồn trước khi khẳng định số chính thức. Tìm theo mã hoặc tên, chọn một vật tư thì công thức tự hiển thị đầy đủ thông tin.

**REQ-CAT-02. Quy đổi:** Công thức sử dụng gram nhưng vật tư mua/lưu kho theo kg: 1kg=1.000g; cột quy đổi và giá phải có đơn vị. Với lá/cái/phần/chai/can/túi/thùng, phải có quy cách của từng vật tư (ví dụ 1 can chứa bao nhiêu g/kg), không tự đoán. Mỗi quy cách có hiệu lực theo thời gian nếu thay đổi.

**REQ-CAT-03. Danh mục món:** Mã món ổn định, tên, nhóm, giá, đơn vị bán, trạng thái; các món từng thấy: `CN-XXPM`, `CN-XXMY`, `CN-TERI`, `CN-GPM`, `CN-BV`, `CN-CNM`, `CC`, `CCC`, `CC-NC`, `CCC-NC`, `CN-MY` (11 mã từ giao diện, đối chiếu nguồn thật).

**REQ-CAT-04. Điểm bán:** Mã điểm, tên, địa chỉ/liên hệ, loại điểm bán hoặc kiosk, trạng thái, chính sách bán; kiosk là điểm tập trung hàng thu hồi, ví dụ mã `ĐB09` từ prototype (cần kiểm tra mã chính thức). Điểm bán có thể nhận giao hàng, trả hàng, doanh thu, chiết khấu, công nợ và phương thức thanh toán.

**REQ-CAT-05. Danh mục nhân viên:** Mã NV, STT, họ tên, nhóm `Sản xuất / Văn phòng (quản lý) / Bán hàng`, mức lương giờ theo cá nhân/bộ phận, phụ cấp mặc định, quy tắc phụ cấp (theo ca/theo ngày/theo tháng/không tự cộng), trạng thái. Khi thay đổi lương/danh mục, không tính lại sai lương tháng đã chốt.

**REQ-CAT-06. Bảng chiết khấu:** Theo cặp **điểm bán × món** (và thời điểm hiệu lực); không nhất thiết cùng % cho mọi điểm/món. Giá hỗ trợ thu hồi khác giá bán và có thể cấu hình theo điểm/món hoặc nhập vào từng phiếu.

**REQ-CAT-07. Nhóm menu:** Danh mục gồm `Danh mục vật tư`, `Danh mục điểm bán`, `Danh mục món bán`, `Danh mục nhân viên`, `Bảng chiết khấu`; nhóm Công thức gồm món, nhân/sốt, cơm, bao bì, tổng hợp giá vốn. Không rải các mục này lệch cấu trúc menu.

## C. Công thức món ăn và định mức nhiều cấp

**REQ-REC-01.** Mỗi món có công thức riêng; có thể thêm vô hạn theo nhu cầu các công thức món, nhân gà Teriyaki, nhân xúc xích, sốt gà phô mai, cơm chín, bao bì, tem... Công thức có: mã, tên, loại, số phần/mẻ, đơn vị đầu ra, từng dòng nguyên liệu hoặc công thức con, số lượng, đơn vị, hao hụt định mức, giá và hiệu lực.

**REQ-REC-02.** Cho phép một món tham chiếu công thức con nhiều tầng; ví dụ cơm nắm xúc xích gọi công thức cơm chín + nhân xúc xích + gia vị + chà bông + phô mai + rong biển + tem. Thuật toán nở công thức phải chống vòng lặp và thiếu tham chiếu; cùng mã nguyên liệu ở nhiều công thức con được cộng gộp.

**REQ-REC-03.** Người dùng nhập tên vật tư/công thức và kết quả chọn tự điền mã, đơn vị, đơn giá, quy đổi; hiển thị số lượng theo 1 mẻ và 1 phần, thành tiền từng dòng, tổng giá vốn/đơn vị. Chỉnh giá vật tư làm cập nhật giá vốn dự kiến, nhưng **báo cáo lịch sử phải dùng snapshot/rule giá tại thời điểm**, không hồi tố vô lý.

**REQ-REC-04.** Giá chưa biết/ô nguồn bằng 0 chưa được xác nhận không coi là miễn phí. Báo `chưa đủ giá`, không cộng thành giá vốn 0. Thông số gạo/cơm từ các sheet cũ không thống nhất phải được đối chiếu và chọn có hiệu lực.

**REQ-REC-05. Ví dụ:** 1 cơm nắm có 114g cơm chín (57g × 2). Nếu quy ước 1kg gạo khô → 2,5kg cơm chín được xác nhận, 100 phần dùng 11,4kg cơm chín = 4,56kg gạo khô. Không áp dụng hệ số này cho công thức khác khi chưa có bằng chứng.

## D. Kế hoạch đêm, sản xuất, nhu cầu nguyên liệu

**REQ-PROD-01.** Buổi tối nhập kế hoạch mỗi món cho **ngày giao sáng hôm sau**, tách `ngày lập` và `ngày giao/ngày sản xuất`. Hệ thống cộng nhu cầu nguyên liệu theo **kế hoạch** và dự báo thiếu dựa vào tồn khả dụng.

**REQ-PROD-02.** Sau khi sản xuất xong, nhập số lượng `sản xuất chính`, **`sản xuất thêm`**, số lỗi, số hủy, ghi chú; tổng sản xuất = chính + thêm. Tỷ lệ lỗi phải xác định rõ mẫu số và đơn vị, tách hàng lỗi tại sản xuất khỏi hủy/thu hồi ở điểm bán.

**REQ-PROD-03.** Có thể nhập nhiều lần trong ngày, sửa/bổ sung với audit. Lưu `sản lượng thực tế` làm cơ sở tính **tiêu hao lý thuyết thực tế**. Lượng giao không nhất thiết bằng lượng sản xuất; số đã sản xuất mà chưa giao cần trạng thái vị trí/tồn lưu chuyển rõ ràng.

**REQ-PROD-04.** Nhu cầu nguyên liệu: từ số lượng từng món dự kiến nhân qua cây công thức để ra từng vật tư và tổng tất cả món; lọc ngày, tuần, tháng, quý. Ví dụ 100 phần một món → bao nhiêu kg gạo, thịt/nhân, gia vị, lá, tem; 1.000 phần trong tuần → tổng mức dùng từng vật tư. Được lưu để đối chiếu thực tế, snapshot thời điểm lập để biết định mức lúc đó.

**REQ-PROD-05.** Phân biệt rõ: nhu cầu kế hoạch, nhu cầu theo đơn hàng được duyệt, nguyên liệu xuất kho, tiêu hao định mức dựa vào sản xuất thực, kiểm kê thực tế. **Không tự cộng đơn hàng đã duyệt vào kế hoạch nhập tay nếu đơn ấy đã được tính**, dùng ID liên kết/dedupe.

## E. Kho, tồn tối thiểu, kiểm kê và hao hụt

**REQ-WH-01.** Kho & tồn kho có: Tồn kho hiện tại, Nhập/Xuất/Kiểm kê, Lịch sử kho, Cảnh báo & bổ sung hàng. Tồn đầu + phát sinh nhập − phát sinh xuất ± điều chỉnh = tồn cuối theo sổ; vật tư có đơn vị, quy cách, địa điểm và thời điểm kiểm kê. Có nhật ký phiếu và lịch sử sửa/đảo.

**REQ-WH-02.** Tồn tối thiểu được cài **trong Danh mục vật tư**. Khi tồn thực tế thấp hơn tối thiểu hoặc nhu cầu sản xuất tới vượt khả dụng, báo số lượng cần bổ sung. Có thể tính gợi ý tồn tối thiểu theo sản lượng thường ngày nếu người dùng tự thiết lập số ngày dự phòng; không tự thay mức người dùng đã đặt.

**REQ-WH-03.** Đối chiếu hao hụt là yêu cầu quan trọng nhất: theo nguyên liệu và kỳ ngày/tuần/tháng/quý, tổng định mức nguyên liệu của tất cả món đã thực sự sản xuất, so sánh với lượng đã dùng thực tế từ tồn/nhập/xuất/kiểm kê đã xác nhận. Ví dụ tương ớt dùng trong 7 món: phải cộng dồn tương ớt từ tất cả 7 công thức để ra mức dùng tuần. Nhập kho thực tế 4,5 can, 5 can... sau khi có quy cách chuyển đổi. Hiển thị chênh lệch tuyệt đối/%.

**REQ-WH-04.** Không tự kết luận chênh lệch là nhân viên lấy bớt hàng. Có thể do rơi vãi, hư hỏng, sản xuất sai định mức, sai số cân/đếm, nhập nhầm, định mức cũ, điều chuyển chưa ghi, mất mát; hiển thị trạng thái cần kiểm tra và lý do được quản lý xác nhận.

**REQ-WH-05.** Hàng thu hồi là **thành phẩm tại kiosk**, không phải nguyên liệu vật tư. Mỗi địa điểm và loại hàng phải có sổ riêng, không cộng cơm nắm vào lượng gạo nguyên liệu. Theo yêu cầu gốc, bỏ chỉ số tồn thành phẩm khỏi **tổng hợp giá trị tồn nguyên liệu và bao bì** của báo cáo kho; vẫn lưu ledger hàng thu hồi/ki-ốt để kiểm soát.

## F. Doanh thu điểm bán, thanh toán và thu hồi hàng

**REQ-SALES-01.** Phân hệ `Doanh thu & thanh toán` theo ngày, điểm bán, món; có số giao, số bán, số còn, số khách tự chịu, số được chấp thuận thu hồi, doanh thu giá bán, chiết khấu, các khoản khấu trừ, công nợ kỳ trước, giá hỗ trợ thu hồi, tiền mặt, chuyển khoản, chênh lệch; kế toán nhập chủ yếu buổi chiều.

**REQ-SALES-02.** Giao hàng buổi sáng 100 phần, điểm bán bán 80 phần, CHIFAA đồng ý **thu hồi 10 phần**, **10 phần khác điểm bán tự chịu**. Phải hạch toán đủ bốn luồng số lượng, tránh coi `100 - 80 = 20` là hoàn toàn trả về hoặc hoàn toàn hủy.

**REQ-SALES-03.** Trả hàng về ki-ốt theo ngày × điểm bán × món: có nút + dòng, danh sách hàng trả chi tiết, số lượng, giá hỗ trợ thu hồi khác với giá bán, người duyệt, lý do, thời điểm nhận thực tế; chi tiết thu hồi này tự hiển thị ở doanh thu đúng điểm/món để cấn trừ theo **quy tắc giá cần chốt**. Kiosk được ghi nhận nhập hàng +10 **một lần**, chưa phải doanh thu; khi ki-ốt bán mới ghi doanh thu và giảm tồn kiosk.

**REQ-SALES-04.** Không có chuyện thu hồi = hủy. Hàng hủy tại điểm bán là chỉ tiêu khác, có sự kiện/lý do/quyền duyệt khác. Không được lấy một dòng trả hàng ở cả màn Sản xuất C và Doanh thu rồi ghi 2 lần. Một `returnId` làm nguồn chuẩn duy nhất.

**REQ-SALES-05.** Doanh thu của ngày, doanh thu sau chiết khấu, số tiền cần thu, tiền mặt + chuyển khoản thực nhận và nợ phải thu là các chỉ tiêu KHÁC nhau. Phải cho từng điểm bán thấy các thành phần và đối soát, không tự gán số chưa thu bằng 0. Sổ quỹ không được cộng hai lần khoản tiền mặt/chuyển khoản từ doanh thu.

**REQ-SALES-06.** Giá chiết khấu phụ thuộc điểm bán × món. Giá hỗ trợ thu hồi riêng theo món/điểm/lần thu hồi; số tiền hỗ trợ được trình bày rõ bản chất kế toán. Quy tắc có cho 10 phần điểm bán tự chịu tạo doanh thu/phải thu như thế nào phải được xác nhận trước khi chốt P&L.

**REQ-SALES-07.** Báo cáo có doanh thu hôm nay, hôm qua, % tăng/giảm, doanh thu tuần trước, so sánh cùng thứ tuần trước/tuần này, kế hoạch ngày, tỷ lệ đạt; doanh thu kỳ chưa có chứng từ = **chưa có dữ liệu**, không tự biến thành 0.

## G. Nhập liệu nhiều lần, nhập bù, sửa lịch sử

**REQ-ENTRY-01.** Nhập liệu mặc định **ngày hôm nay**, có thể chọn ngày khác. Có ít nhất bốn chế độ: `Nhập mới`, `Nhập bù` cho ngày đã bỏ sót, `Bổ sung` vào phiếu đã lưu và `Sửa/nhập lại` để điều chỉnh số cuối cùng.

**REQ-ENTRY-02.** Ví dụ sáng lưu sản xuất 100, chiều **bổ sung +30** → tổng 130; sau khi xác nhận ghi sai thì **sửa số cuối cùng thành 90**, không cộng 90 thành 220. Giữ lịch sử ghi 100, +30, sửa về 90, ai nhập/lúc nào/ghi chú.

**REQ-ENTRY-03.** Khi một người nhập sáng và người khác nhập chiều, ứng dụng mở lại dữ liệu của đúng ngày/phiếu, không ghi đè im lặng và không tạo bản trùng. Với ledger tài chính đã chốt, sửa bằng chứng từ đảo/điều chỉnh được liên kết, không sửa phá dấu vết. Phiếu mở/chốt/duyệt phải có quyền.

**REQ-ENTRY-04.** Danh sách phần nhập liệu trước đây có 8 màn hình: Kiểm kho, Doanh thu, Chấm công, Sản xuất/Lỗi/Hủy, Kế hoạch/Mục tiêu, Khoản vay, Công nợ, Sổ quỹ; thêm màn hình Bảng lương theo bộ phận (thứ 9). Từng màn có chức năng lưu, tìm kiếm, lọc ngày, lịch sử và chỉnh được theo quyền.

## H. Nhân sự, chấm công ca đêm, bảng lương

**REQ-HR-01.** Danh mục nhân viên là nguồn duy nhất về mã/họ tên/bộ phận/mức lương; phiếu chấm công có STT, mã NV, tên, giờ vào, giờ kết ca, số giờ, đơn giá lương/giờ, tiền lương, phụ cấp, hỗ trợ và tổng tiền; mức lương theo nhân viên, không lấy tổng chi phí nhân sự chia giờ để tính.

**REQ-HR-02.** Ca bắt đầu 23:00 và ra 07:00/08:00/09:00 hôm sau tương ứng 8/9/10 giờ trước khi trừ thời gian nghỉ nếu có; không được ra số âm vì qua ngày. `Ngày công` cần rõ là ngày bắt đầu ca hoặc ngày sản xuất, nhất quán toàn hệ thống.

**REQ-HR-03.** Có `phụ cấp/hỗ trợ ngày` do kế toán nhập bổ sung riêng cho ngày/ca, cộng vào phiếu và bảng lương. Phụ cấp mặc định trong danh mục có policy theo ngày/ca/tháng; chống cộng hai lần nếu một người có 2 ca trong ngày. Có thể có ứng lương và khấu trừ; bảng lương có tổng tiền thực nhận.

**REQ-HR-04.** Chấm công có thể chung một màn hình nhưng chia rõ 3 nhóm **Sản xuất (SX), Văn phòng/quản lý (VP), Bán hàng (BH)**. Bảng lương tháng phải tách 3 bảng và một tổng hợp; khi chuyển bộ phận trong tháng cần snapshot bộ phận tại thời điểm công. Không tự gán nhân viên thiếu bộ phận.

**REQ-HR-05.** Dashboard năng suất sản xuất = số phần sản xuất thực tế / tổng giờ công **chỉ của nhân sự SX**. Giờ công VP, BH và số chi phí lương không nằm trong mẫu số. `Giờ công ngày`, `năng suất ngày`, `giờ công tháng`, `năng suất tháng`, `tỷ lệ lỗi tháng`, `mục tiêu lỗi tối đa` đều có nguồn rõ.

## I. Kế hoạch & mục tiêu / ngân sách

**REQ-PLAN-01.** Có tham số chỉ tiêu gốc: Food cost tối đa **32,2%**, chi phí nhân sự SX tối đa **15%**, lỗi SX tối đa **1%**, hủy tại điểm bán tối đa **2%**, số dư tối thiểu tiền mặt + ngân hàng **15.000.000đ**. Đây là **giá trị khởi tạo tham khảo** từ phác thảo, Admin có thể thay đổi và lưu hiệu lực theo kỳ; không hardcode thành bất biến.

**REQ-PLAN-02.** Bổ sung chỉ tiêu do Admin tự nhập: tỷ lệ **trả hàng điểm bán**, **chi phí cố định**, **nhân sự quản lý/văn phòng**, **khấu hao**, **marketing** trên cơ sở doanh thu được xác nhận. Chưa có % mục tiêu thì để trống (`null`, trạng thái Chưa thiết lập) không tự gán 0.

**REQ-PLAN-03.** Food cost là % trên **doanh thu thuần**, không phải tổng giá bán lẻ của khách trước chiết khấu. Người dùng mô tả doanh thu thuần là số doanh thu CHIFAA được hưởng/thực tiền về; **cần chuẩn hóa giữa thuần kế toán và thực thu** để công thức không sai. Chi phí SX cũng tỷ lệ trên cơ sở doanh thu cùng chính sách đã chốt.

**REQ-PLAN-04.** Mục tiêu tháng: doanh thu tháng, số ngày bán, doanh thu kế hoạch ngày = kế hoạch tháng/số ngày bán; chi phí cố định dự kiến, lợi nhuận mục tiêu. Ví dụ phác thảo tháng 11/2026 kế hoạch doanh thu 260 triệu, chi phí cố định 18 triệu, lợi nhuận mục tiêu 22 triệu; không mặc định chính thức nếu không được xác minh.

**REQ-PLAN-05.** Kế hoạch sản lượng tuần và năng lực thưởng: chỉ khi **sản lượng đạt/vượt mục tiêu**, đủ doanh thu lương SX và tỷ lệ lương SX dưới trần 15% mới tính dư địa ngân sách thưởng. Dư địa chỉ gợi ý; không tự tạo phiếu chi hoặc tự thưởng. Nếu thiếu dữ liệu, không hiện “còn X tiền thưởng” như số chắc chắn.

**REQ-PLAN-06.** Các target có trạng thái xanh/cam/đỏ/xám; cam gần chạm trần là ngưỡng configurable, không hardcode nếu chưa chốt. Đưa trạng thái tới dashboard và báo cáo sếp.

## J. Tổng quan Báo cáo điều hành (cho sếp)

**REQ-CEO-01.** Trang mở đầu, phục vụ người quản lý xem mỗi ngày; ngoài dữ liệu ngày có lựa chọn tuần/tháng/kỳ. Trên cùng là KPI đập vào mắt: doanh thu thuần, tiền mặt+ngân hàng, food cost, nhân sự SX %, dư địa thưởng, lãi/lỗ tạm tính và các chi phí quan trọng. Không dùng ngôn ngữ nội bộ như “V16”, “demo nội bộ” ở tiêu đề; dữ liệu minh họa nếu có phải gắn nhãn đúng.

**REQ-CEO-02.** Hiển thị phần trăm trên doanh thu của từng khoản: SX, VP/quản lý, marketing, cố định, khấu hao và những khoản cần cài target; xanh khi trong khung, cam gần ngưỡng, đỏ khi vượt, xám khi thiếu dữ liệu. Cho xem chi tiết nguồn/kỳ, chuyển nhanh sang màn liên quan.

**REQ-CEO-03.** Cảnh báo rủi ro tổng hợp dựa trên cùng dữ liệu với dashboard: doanh thu hụt kế hoạch, food cost cao, SX vượt trần, hàng lỗi/hủy/trả cao, thiếu nguyên liệu dưới mức tồn tối thiểu, tiền mặt+ngân hàng thấp. Có **số mã vật tư đang thiếu** để sếp điều kho/mua hàng kịp. Không phát cảnh báo sai do dữ liệu `#REF!`/null.

**REQ-CEO-04.** Sếp thấy nếu SX tuần qua vượt sản lượng mục tiêu nhưng chi phí SX dưới 15%, số tiền dư trần có thể cân nhắc thưởng; nếu vượt ngưỡng phải có cảnh báo đỏ và link phân tích. Cảnh báo phải dựa trên chứng từ thực tế và dữ liệu hoàn chỉnh.

## K. Dashboard vận hành

**REQ-DASH-01.** Có bộ lọc ngày/tuần/tháng, tuần **thứ Hai đến Chủ nhật**; ưu tiên so sánh tuần. Cho chọn ngày tham chiếu, xem doanh thu hôm nay/hôm qua và % tăng/giảm; tổng tuần hiện tại/tuần trước, tỷ lệ đạt kế hoạch ngày từ kế hoạch tháng/số ngày bán.

**REQ-DASH-02.** Thay biểu đồ “Doanh thu thuần 7 ngày gần nhất” bằng **Doanh thu tuần trước** và so sánh cùng thứ tuần này/tuần trước, ví dụ thứ Năm với thứ Năm. Nếu kỳ chỉ có vài ngày đủ số liệu thì hiển thị phạm vi đủ dữ liệu, không giả trọn tuần.

**REQ-DASH-03.** Sáu nhóm vận hành: `Doanh thu`, `Sản xuất`, `Kho`, `Food cost`, `Điểm bán`, `P&L/dòng tiền`. Có biểu đồ ngày/tuần, sản lượng/lỗi/giờ công SX/năng suất, giá trị nguyên liệu/bao bì, lợi nhuận theo món/điểm bán, khoản thu chi. Tồn thành phẩm không nhập vào giá trị kho NVL/bao bì.

**REQ-DASH-04.** Đúng sáu KPI người dùng nêu: Giờ công hôm nay; Năng suất hôm nay (phần/giờ SX); Giờ công tháng; Năng suất tháng; Tỷ lệ lỗi tháng; Mục tiêu lỗi tối đa. Nếu chưa phân nhóm nhân sự, không lấy số 316,5 giờ công lịch sử làm SX mà không có bằng chứng.

## L. Chiến lược kinh doanh – nhiều chart

**REQ-STRAT-01.** Trang Chiến lược riêng với nhiều biểu đồ, dù file Sheets chiến lược đang lỗi `#REF!`. Có bộ lọc ngày/tuần/tháng/quý/năm, dữ liệu minh họa tách hoàn toàn thực tế.

**REQ-STRAT-02.** Tối thiểu 8 góc nhìn: doanh thu thuần có tăng (line); bán đủ hòa vốn (break-even); điểm bán nào góp lãi nhiều (bar); điểm nào hủy nhiều (bar); món nào có lãi góp/lợi nhuận cao (bar); 100đ doanh thu đi đâu (donut); 12 tháng lãi/lỗ (bar); thử kịch bản điều chỉnh giá bán, số phần/ngày, % hủy (interactive). Có bảng xếp hạng và ưu tiên điều hành.

**REQ-STRAT-03.** Khi chưa có đủ giá vốn hoặc doanh thu, biểu đồ lợi nhuận/hòa vốn phải hiển thị thiếu dữ liệu, không tính giả. Giữ riêng chế độ `Minh họa` và `Dữ liệu thực tế`.

## M. Khoản vay, công nợ, sổ quỹ, tài sản

**REQ-FIN-01.** Theo dõi khoản vay (tiền gốc, lãi suất, ngày vay, hạn, trả gốc/lãi và dư nợ), công nợ phải thu/phải trả, lịch thanh toán, quá hạn, có ID tham chiếu.

**REQ-FIN-02.** Sổ quỹ ngày và kỳ: thu/chi, `Tiền mặt`/`Ngân hàng`, nhóm chi cố định, SX, VP/quản lý, marketing, vay/trả vay, thu/trả nợ, ghi chú và người nhập. Hai cột tiền mặt/chuyển khoản tại phiếu doanh thu; không cộng trùng với sổ quỹ. Có số dư đầu kỳ và kiểm chứng đối chiếu tiền thực tế.

**REQ-FIN-03.** Có tài sản/khấu hao và khoản chi cố định/marketing/văn phòng phục vụ mục tiêu tỷ lệ và P&L; quy tắc ghi nhận chi phí vs dòng tiền vs khấu hao phải tách rõ. Trước đây một số dòng bảng lương có `#REF!`, ví dụ khoản ứng/trừ 700.000đ chưa biết nhân viên; giữ ở nguồn chờ đối chiếu, không gán đại.

**REQ-FIN-04.** Báo cáo P&L theo ngày/tuần/tháng và dòng tiền; cần rõ giá vốn, chi phí SX, VP, marketing, cố định, khấu hao, chi phí tài chính, lợi nhuận; hiển thị độ đầy đủ dữ liệu, không tính P&L chính thức khi còn missing source.

## N. Đăng nhập, tài khoản và quyền

**REQ-AUTH-01.** Admin có toàn quyền, có thể thêm/tắt tài khoản, gán vai trò kế toán/nhân viên và cấp quyền theo danh mục và hành động xem/thêm/sửa/xóa/duyệt/xuất. Xác thực người thực trước kiểm tra `_Users`/APP_USERS; không phải cứ có Gmail là được vào.

**REQ-AUTH-02.** Admin chỉ có **một phiên hoạt động**. Nếu thiết bị khác cố đăng nhập, chặn/cho luồng xử lý được phê duyệt, ghi cảnh báo trong phần Cài đặt/Thông báo; có xem và thu hồi phiên, sự kiện login/logout. Không dựa chỉ trên userAgent hay localStorage để chứng minh thiết bị.

**REQ-AUTH-03.** Người dùng đã tạo OAuth Client/`GOOGLE_CLIENT_ID` và Web App, có Admin trong `_Users` với `enabled=true`, nhưng gặp **401 invalid_client/no registered origin** khi GIS được gọi trong iframe Apps Script. Việc thêm Gmail Admin trong `_Users` không sửa lỗi OAuth. Ưu tiên phương án chạy toàn bộ Apps Script/Sheets, không Vercel; bảo mật không đòi nhân viên quyền sửa toàn bộ workbook. Phải kiểm thử auth end-to-end trước.

**REQ-AUTH-04.** Chỉ Admin/quản lý được xem lương, công nợ, bí mật công thức tùy chính sách. Server kiểm tra mọi RPC; quyền sửa Sheets trực tiếp là một vấn đề độc lập với RBAC của UI. Có audit, lock, session TTL, rate limit, secret trong Script Properties.

## O. Cổng đặt hàng khách (Order)

**REQ-ORDER-01.** Thêm trang đặt hàng khách, tách khỏi nội bộ; khách thấy danh mục món được công bố, giá/đơn vị nếu được phép, ngày/ca giao, điểm nhận, số lượng, liên hệ, ghi chú và mã đơn/trạng thái.

**REQ-ORDER-02.** Đơn trạng thái chờ/đã duyệt/từ chối/đang xử lý/hoàn thành hoặc phù hợp với luồng được duyệt; chỉ đơn được chấp thuận mới đưa vào nhu cầu sản xuất đúng **một lần**, có truy vết đến kế hoạch/chứng từ. Có thông báo, chống duplicate/spam, khách chỉ xem đơn của mình.

**REQ-ORDER-03.** Cách cấp tài khoản/đặt hàng công khai/mã mời cho khách **chưa được người dùng chốt**. Không mở public RPC có thể đọc giá vốn, bảng lương, công nợ hay danh sách nhân viên.

## P. Giao diện, hiệu năng, lưu bền và triển khai

**REQ-UX-01.** Tên, logo phải là `CHIFAA COMBINE`, giữ chính xác ảnh lửa/màu cam do người dùng gửi; logo ở sidebar, đăng nhập, portal không được thay bằng ảnh tìm kiếm, `object-fit:contain`, không cắt.

**REQ-UX-02.** Sidebar navy, menu cha/con thẳng hàng, icon và label ổn định, dropdown không lệch hoặc co chữ từng từ; nút mở/đóng độc lập, active màu cam, desktop/mobile responsive, không lỗi ba mục Doanh thu/Chấm công/Sản xuất bị script cũ overwrite DOM.

**REQ-UX-03.** Nhãn và thông báo chuyên nghiệp để trình khách, không nêu “bản v16”, “xem ví dụ rồi nhìn hiểu ngay”, thông báo lập trình thô. Vẫn minh bạch khi chế độ phác thảo/dữ liệu demo.

**REQ-UX-04.** SPA đổi tab mượt, vẽ chart nhanh, skeleton, hover, animation card/chart/table/dropdown, giảm chuyển động theo lựa chọn OS, tránh việc phải chờ đầy trang. Preload **shell/CSS/ảnh trước login**, nhưng dữ liệu chỉ sau auth; cache & batch/delta theo quyền.

**REQ-OPS-01.** Google Sheets dữ liệu lưu lâu dài, không tự biến mất theo ngày/tháng; có sao lưu hằng ngày, restore thử, lịch sử phiếu. Không chạy `setup` tùy tiện mỗi lần build, không dùng `IMPORTRANGE` làm đồng bộ cốt lõi.

**REQ-OPS-02.** Khi Codex sửa: code local cần `clasp push`/upload, `/dev` dùng phiên bản HEAD cho editor, `/exec` cần tạo version mới trên **lượt triển khai cũ**; giữ URL ổn định. Schema thay đổi phải migration, trigger thay đổi mới cài lại; đừng nhầm việc lưu code với deploy production.

**REQ-OPS-03.** Công việc dài chia task và có `HANDOFF.md` khi hết token, trạng thái theo từng module, test, file, quyết định còn mở; tự tiếp tục mà không bỏ mất lịch sử.

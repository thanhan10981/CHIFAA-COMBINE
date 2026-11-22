# Quyết định nghiệp vụ và bảo mật

Xác nhận thêm17/11/2026: quy cách đóng gói độc lập cơ sở giá; tự áp dụng quy cách có chứng cứ, không suy giá/kg thành giá/chai/can, không giả định mật độ dầu. Giá mâu thuẫn phải Cần xác minh đơn giá/null; tồn tối thiểu trống là Chưa thiết lập,0nhập rõ mới là0. Giữ nguồn, có Admin cập nhật; không ghi đè hai workbook gốc. Thiết kế và kiểm thử: docs/UNIT_SYSTEM.md. Đây không là xác nhận cơ sở giá từng vật tư.

Yêu cầu chat mới nhất ưu tiên hơn bản tổng hợp. Xác nhận ngày 16/11/2026. CONFIRMED nghĩa đã chốt quy tắc, **không tự suy ra đã lập trình/triển khai/nghiệm thu**.

| ID | Trạng thái | Quy tắc / việc còn chờ |
| --- | --- | --- |
| D01 | CONFIRMED | Food cost tối đa 32,2% và nhân sự SX tối đa 15% cùng chia cho doanh thu thuần: doanh thu bán hàng sau chiết khấu và giảm trừ doanh thu hợp lệ, trước chi phí vận hành. Cash+bank thực thu, thu nợ cũ, lợi nhuận riêng. Áp dụng mọi báo cáo, kế hoạch, Strategy. Thiếu nguồn → Chưa đủ dữ liệu. |
| D02 | CONFIRMED | Giao100/bán80/thu hồi10/điểm tự chịu10: điểm bán phải thanh toán10 phần chịu theo giá bán sau chiết khấu. Giữ lượng này riêng lượng bán cho khách và thu hồi. |
| D03 | CONFIRMED | Hỗ trợ thu hồi là **chi phí thu hồi riêng**; không giảm doanh thu hoặc trừ vào P&L hai lần. Giá hỗ trợ riêng giá bán, cần chứng từ nguồn; thời điểm ghi nhận/chi tiền vẫn phải phân biệt. |
| D04 | PARTIAL | Thu nợ cũ không là doanh thu. Có phân bổ theo khoản trong mã; cách xử lý bù trừ phải trả khác chưa chốt. |
| D05 | IMPLEMENTED_POLICY / UAT_PENDING | Kỳ đóng chặn ghi, Admin mở lại có lý do; ledger đảo/điều chỉnh, chưa nghiệm thu nghiệp vụ thực tế. |
| D06 | IMPLEMENTED_ARCHITECTURE / GOOGLE_GATE_BLOCKED | Owner-execute + OAuth Code/PKCE + UserInfo + browser-bound signed session; không dùng active-user email để đăng nhập, không cấp Editor cho tài khoản app. Chưa test hai Gmail/ACL thật. |
| D07 | DECISION_REQUIRED | Hệ số gạo→cơm và từng can/túi/chai cần nguồn/phê duyệt; ví dụ2,5 chỉ là fixture giả định. |
| D08 | DECISION_REQUIRED | Năng suất dùng tổng sản xuất hay sản lượng đạt; tỷ lệ lỗi theo mẫu số được duyệt. |
| D09 | DECISION_REQUIRED | Hủy/trả theo lượng hay giá trị, kỳ và mẫu số. |
| D10 | DECISION_REQUIRED | Phụ cấp từng nhân viên theo ca/ngày/tháng; hiện code cộng theo ca, chưa có policy đầy đủ. |
| D11 | DECISION_REQUIRED | Ngày công bắt đầu ca/ngày sản xuất, nghỉ giữa ca thực tế; code hiện ngày bắt đầu, nghỉ nhập tay. |
| D12 | USER_AUTHORIZED_IMPLEMENTATION / UAT_PENDING | Phiếu sản xuất mới liên kết tự xuất kho theo recipe snapshot; không tự backfill cũ. Đã làm theo yêu cầu nối sản xuất→kho, cần đối soát xuất thủ công để tránh trùng. |
| D13 | SPECIFIED_NOT_IMPLEMENTED | Kiosk chỉ tăng tồn khi nhận thực tế, không tăng lúc duyệt; chưa có ledger kiosk. |
| D14 | SPECIFIED_PARTIAL | Minimum do người dùng nhập, gợi ý dự trữ không tự sửa minimum. |
| D15 | DECISION_REQUIRED | Code tạm dùng last-receipt-price + snapshot; chưa được chốt làm chính sách giá vốn kế toán. |
| D16 | DECISION_REQUIRED | Giá vốn/lô/hạn sử dụng của thành phẩm thu hồi tại kiosk. |
| D17 | DECISION_REQUIRED | Ngưỡng màu cam trước đỏ; chưa có cấu hình thống nhất. |
| D18 | PARTIAL | Đã chốt base15% trên net D01; phạm vi allowance/support/bonus cam kết cần đầy đủ trước thưởng. |
| D19 | DECISION_REQUIRED | Số đầu kỳ tiền/vay/nợ/kho chưa đối chiếu tài liệu gốc. |
| D20 | DECISION_REQUIRED | Lịch/ngày bán và so tuần chưa kết thúc; không mặc định30 ngày. |
| D21 | DECISION_REQUIRED | Portal hiện dùng link mời có hạn; người dùng nói chưa có workbook/Web App riêng, chưa chốt mô hình tài khoản khách cuối. |
| D22 | PARTIAL | Approved orders đang tách riêng nhu cầu kế hoạch tay, chưa có merge orderLine→planLine; không tự cộng. |
| D23 | DECISION_REQUIRED | Ai sửa trực tiếp master, workbook giao tiếp riêng và ACL; tuyệt đối không Editor cả file cho quyền app hẹp. |
| D24 | BLOCKED_SOURCE | Chưa có hai workbook gốc trong source; chưa xác nhận mã vật tư/món/điểm/nhân viên chính thức. |
| D25 | DECISION_REQUIRED | Retention backup/archive/log; hiện không tự xóa bản cũ. |
| D26 | DECISION_REQUIRED | Xếp hạng lãi góp hay lợi nhuận sau phân bổ theo món/điểm; không gọi lãi ròng nếu chưa phân bổ. |
| D27 | IMPLEMENTED_POLICY / UAT_PENDING | Một Admin; login Google mới của cùng chủ có thể thay phiên cũ có audit, Admin khác bị chặn; chưa nghiệm thu thiết bị/cảnh báo UI. |
| D28 | CONFIRMED / IMPLEMENTED_DEV | Lãi vay **tự nhập tiền lãi**, xem trước và xác nhận phiếu; không tự tính theo lãi suất. Quyết định chat trước vẫn giữ. |

Về “tiền về túi”: giữ là chỉ tiêu sau chi phí riêng; lợi nhuận kế toán không tự bằng tiền mặt vì có công nợ, vay và chi đầu tư. Không đổi định nghĩa D01 theo cách gọi này. Không tự duyệt thuế/báo cáo chính thức hoặc ACCOUNTING_APPROVED khi còn thiếu chính sách/nguồn.


## Ghi ch? tri?n khai 2026-11-23 ? KH-12/KH-05/D04/D16

Giao ??n ???c ghi th?nh doanh thu b?n h?ng v? kho?n ph?i thu m?t l?n theo gi?, chi?t kh?u ?? ch?p tr?n ??n; kh?ng gi? ??nh ti?n ?? v?. Ch? ch?ng t? thu th?t c?p nh?t ti?n m?t/ng?n h?ng v? gi?m c?ng n?. Tr??ng ?tr? ti?n ??n c?? gi? ch?a x?c ??nh khi ch?a c? ?i?u ch?nh ngu?n; kh?ng t? c?n tr?. H? tr?/h?y v? nh?n l?i h?ng v?t l? ph?i l? c?c lu?ng ri?ng; checkpoint n?y ch?a ??a h?ng v? t?n kiosk v? ch?a ghi chi/gi?m c?ng n? cho kho?n h? tr?. D04/D16 v?n c?n ch? h? th?ng ch?t c?ch c?n tr?, gi? nh?n l?i v? ch?ng t? ??i ?ng tr??c khi t? ??ng h?a.

# Nhập liệu033

## 18/11/2026 — Checkpoint033: nhập liệu gọn và điều chỉnh liên thông

KH-02/05/09/10 và yêu cầu trực tiếp mới nhất: bỏ hàng điều hướng1–9 trùng sidebar, bảng nguồn phát thảo, trường nhập bằng chứng, nút tải lại/CSV trong phạm vi Kho/SX/Nhập liệu và trang Tài sản & khấu hao khỏi điều hướng (URL cũ chuyển về Nhập liệu). Bảng gọn, SVG, lọc ngày/tháng/bộ phận, nút + mở popup một nút Lưu. Sản xuất cũng mở popup, giữ preview kế hoạch và định mức server.

Lương tháng lấy ca công thực tế SX/VP/BH và phụ cấp hiện có. Sửa/xóa từ bảng lương mở các ca nguồn; chỉnh ca đảo bảng lương chưa chi và cho chốt phiên bản mới. Phiếu thu/chi, khoản vay, công nợ, mục tiêu có sửa/xóa bằng hoàn tác và tham chiếu; không xóa lịch sử. Phiếu đã có hàng thu hồi hoặc lương đã chi yêu cầu hoàn tác liên kết trước, kỳ khóa/quyền/idempotency vẫn được kiểm tra.

SQL033 chuyển các dòng quỹ đã lưu từ HTML thành cash_ledger và entry_journal thật, đúng ngày/số tiền/tài khoản nguồn. Chạy lại không nhân đôi và không khôi phục dòng đã xóa. Không bịa doanh thu phân bổ, số dư đầu kỳ, ca công hoặc tồn kho cho những phần nguồn không có giao dịch.

Bằng chứng: npm run verify109/109,94 tables/59 RPCs, typecheck/lint/build đạt. Chrome Nhập liệu50 bố cục +14 popup; Sản xuất30 bố cục, preview/điều chỉnh/hủy/kiểm kê/retry đạt, không JS error/tràn trang. Đã xem ảnh desktop chấm công và popup mobile. Nhập HTML thật hai lần và promote hai lần:132 dòng nguồn,2 vay,29 mục tiêu,33 quỹ; không tạo sales/attendance/stock. Báo cáo ignored output/entry-design/report.json, output/production-design/report.json và output/nhap-lieu-real-data-validation.json. Đây là PostgreSQL nhúng/fixture, chưa phải authenticated cloud UAT.

Còn lại: owner chạy output/CHIFAA_PATCH_NHAP_LIEU_GON_DEV.sql →033_READY, rồi output/CHIFAA_AP_DUNG_DU_LIEU_THAT_DEV.sql →033_DATA_READY. Chưa áp SQL cloud từ công cụ; chỉ phát hành chifaa-next-dev sau xác nhận033, giữ production/main. Dữ liệu có ngày gốc nên cần chọn đúng tháng để xem. Chưa xác nhận toàn bộ báo cáo ngoài phạm vi Nhập liệu.


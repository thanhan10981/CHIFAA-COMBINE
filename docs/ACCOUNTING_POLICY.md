# D01/D02/D03 — Công thức dùng chung

Người dùng xác nhận ngày16/11/2026; policy `net-sales-2026-11-16` nằm trong src/shared/domain.js, dùng chung frontend/server. Không thay cột/ghi lại dữ liệu Sheets để áp dụng công thức read-model.

- Doanh thu thuần đang hỗ trợ = `(số bán + số điểm bán chịu) × giá bán × (1 − chiết khấu)`. Các giảm trừ doanh thu hợp lệ khác cần chứng từ/phân loại mới; không tự dùng trường chi phí khác như giảm trừ.
- Tiền thực thu = cash+bank; thu nợ cũ không là doanh thu kỳ mới. Số cần đối soát kỳ = doanh thu thuần; chênh = thực thu − thu nợ cũ − số cần đối soát. Chênh không tự hạch toán thành lợi nhuận.
- Chi phí thu hồi = returned×recoveryPrice; chi phí khác trên phiếu bán là chi phí riêng. report trừ mỗi khoản một lần ở chi phí; không trừ từ net rồi trừ lần nữa. Ghi chi tiền là luồng dòng tiền khác, chưa tự lập phiếu chi hỗ trợ. Không ghi thêm một phiếu khac cho cùng chi phí vì chưa có source-link ledger tự dedupe khoản đó; đây là gap cần hoàn thiện trước vận hành thật.
- Food cost% = COGS hiện có / net×100. Trần32,2%. Nhân sự SX% = lương giờ+phụ cấp/hỗ trợ SX / net×100. Trần15%. Chưa có net dương/giá vốn/ca SX hợp lệ → Chưa đủ dữ liệu, không0.
- Dư địa thưởng tham khảo = min(trần thưởng nhập, max(0,15%net − chi phí lương/phụ cấp SX)), chỉ khi đủ nguồn/kỳ và đạt sản lượng mục tiêu. **Không trừ food cost vào trần lương.** productionCostCap giữ dữ liệu cũ nhưng là ngân sách sản xuất, không thay base15%net.
- Report, targets, các trang Tổng quan/Dashboard và Strategy gọi cùng các hàm trên. Strategy donut tách chi phí thu hồi; lãi góp điểm/món trừ chi phí thu hồi/khác quy được cho phiếu. Chưa gọi là lợi nhuận ròng sau phân bổ.

Ví dụ fixture T070/T075: giao100, bán80, thu hồi10, điểm chịu10, giá15.000, CK15%, hỗ trợ5.000/phần → net1.147.500, chi phí thu hồi50.000. Với chi khác7.000, nguyên liệu300.000, lương SX150.000, marketing10.000 → kết quả tạm630.500. Thực thu510.000+510.000 với thu nợ cũ20.000 → chênh đối soát−147.500. Không ghi các số ví dụ vào Sheets thật.

Tử số COGS còn dựa production/material snapshot, chưa phân bổ tồn thành phẩm; chi phí lương/bonus cam kết, khấu hao, policy phụ cấp và phương pháp giá vốn chưa nghiệm thu đầy đủ. Không dùng kết quả này như báo cáo kế toán/thuế chính thức. Không tự bật ACCOUNTING_APPROVED.

Tests/accounting-policy.test.mjs kiểm tra4nhóm cross-model, đổi cash/oldDebt/food cost không đổi base/trần labor, invalid/#REF/null không ra0 hoặc bonus. Bộ acceptance93ca vẫn có phần Google/legacy/kiosk chưa chạy.

# PROMPT GIAO CHO CODEX — NỐI LOGIC HOÀN CHỈNH CHIFAA COMBINE

Bạn đóng vai Principal Engineer (Google Apps Script + Sheets), BA, Kế toán quản trị, Data Architect, Security Engineer và QA Lead, tiếp tục **repository CHIFAA hiện tại**. Người dùng đã phác thảo rất nhiều phiên bản HTML; nhu cầu bây giờ là **kết nối dữ liệu và nghiệp vụ thật, đúng số, có thể sử dụng lâu dài**.

## 0. NGUYÊN TẮC KHÔNG ĐƯỢC VI PHẠM

- ĐỌC hết tài liệu trong thư mục này theo thứ tự: `README_BAT_DAU.md`, `01_DAC_TA_NGHIEP_VU.md`, `02_QUY_TAC_TINH_TOAN_DOI_SOAT.md`, `03_MO_HINH_DU_LIEU_VA_LUONG_NGHIEP_VU.md`, `04_KIEN_TRUC_DONG_BO_BAO_MAT_HIEU_NANG.md`, `05_GIAO_DIEN_DASHBOARD_VA_UX.md`, `08_NHUNG_DIEM_CAN_CHOT.md`, `09_HIEN_TRANG_MA_NGUON_VA_CACH_GHEP.md`, `06_KIEM_THU_NGHIEM_THU.md`, `07_TASKS_LO_TRINH.md`, `AGENTS.md`.
- Sau khi đọc, kiểm kê thực tế repo, file HTML nguồn, `Code.gs`, `appsscript.json`, Script Properties (chỉ tên khóa, không in giá trị bí mật), Google Sheets DEV, trigger, deployment, cấu hình OAuth. **Tạo `REQUIREMENT_MATRIX.md`: mỗi REQ có status DONE/PARTIAL/MISSING/BLOCKED, đường dẫn source, test, bằng chứng.** Không được tự nhận Done vì có code chưa test.
- Giữ UI navy/cam, tên CHIFAA COMBINE và logo đúng ảnh gốc; bỏ chữ “V16/V17/bản demo nội bộ/nhìn là hiểu ngay” ở giao diện khách, nhưng vẫn cho biết là dữ liệu mô phỏng ở chế độ xem trước. Sidebar dropdown, icon, label không vỡ chữ khi thay tab.
- Không phá dữ liệu! **Chỉ chạy migration trên Sheets DEV**; hai workbook gốc read-only và sao lưu trước import; không xóa/ghi đè file gốc. Tạo schema chuẩn, mapping, preview import, báo cáo lỗi, đối chiếu count/tổng, rollback. `#REF!` khác 0.
- Không tự chốt các công thức còn tranh luận: doanh thu hàng trả, giá hỗ trợ, 10 phần điểm bán chịu, food cost theo doanh thu nào, công thức khấu hao, giá trị 0, định mức mẻ... Ghi `DECISION_REQUIRED`, triển khai chế độ hiển thị provisional/đủ dữ liệu thay vì sai im lặng.
- Nguồn dữ liệu chính là Google Sheets; HTML demo/localStorage không phải sổ sách. Chỉ nói “Lưu thành công” sau xác nhận server. Thêm idempotency/lock/version/audit/recovery, không tin dữ liệu gửi từ UI, không tin quyền chỉ vì menu ẩn.
- Kiểm soát OAuth: đã gặp lỗi `401 invalid_client — no registered origin` khi dùng Google Identity Services trong Apps Script iframe. Không yêu cầu người dùng cứ thêm Gmail vào `_Users` để sửa lỗi này. Làm security feasibility spike **đầu tiên**, kiểm thử truy cập thật với 2 Gmail; nếu chưa có giải pháp an toàn chỉ Apps Script thì BLOCKED, nêu rủi ro và phương án rõ ràng; **không mở dữ liệu nội bộ public** hoặc vô hiệu hóa auth để chạy thử.
- Không thay bất ngờ mô hình `executeAs`. Người dùng muốn Apps Script + Sheets, Admin/kế toán dùng Gmail, các tài khoản KHÔNG cần được Editor trên toàn bộ file tài chính. Nếu `USER_ACCESSING` buộc cấp quyền Sheets toàn bộ thì không đạt yêu cầu bảo mật. Nếu `USER_DEPLOYING` thì `Session.getActiveUser().getEmail()` không đáng tin trong mọi ngữ cảnh; cần xác thực danh tính có bằng chứng thực tế. Không nhầm Apps Script OAuth cấp quyền chạy script với đăng nhập ứng dụng.
- Phải cập nhật `HANDOFF.md`, `TASKS.md`, `CHANGELOG.md`, test và commit sau mỗi task. Khi gần hết token, checkpoint trước: không bỏ trạng thái dở dang, không tự tuyên bố hoàn thành.

## 1. ĐÍCH ĐẾN

Ứng dụng CHIFAA COMBINE chạy trên Google Apps Script + Google Sheets (dưới 10 người dùng đồng thời), chi phí thấp, SPA không reload tab, đủ phân hệ danh mục – công thức đa tầng – kế hoạch sản xuất – kho, tồn, kiểm kê, hao hụt – doanh thu/điểm bán/ki-ốt – chấm công 3 bộ phận – lương – công nợ/sổ quỹ/khoản vay – mục tiêu – dashboard điều hành/vận hành – chiến lược/biểu đồ – đơn khách. Có đăng nhập Google, Admin toàn quyền, quản lý users/RBAC, một phiên Admin đang hoạt động, thông báo phiên mới, logs/backup. **Sửa được dữ liệu từ cả UI và các cột được phép trong Sheet; đồng bộ có version/xung đột.**

## 2. QUY TRÌNH BẮT BUỘC

### Giai đoạn 1 — Khảo sát và khóa rủi ro
1. Xuất sơ đồ thật của repo, chức năng mỗi trang/nút/biểu mẫu; map toàn bộ menu V17 và những phân hệ có trong các bản cũ nhưng V17 thiếu.
2. Chạy tests/ build hiện có, lưu baseline; kiểm tra thật đường `/dev`, `/exec`, phiên bản deployment và `clasp push`, không tin rằng `/exec` tự cập nhật.
3. Làm POC Google authentication/identity/role + session, xử lý 401 origin; bắt buộc chứng minh `admin1` có quyền, `accountant1` chỉ phần được cấp, email không nằm `_Users` bị từ chối; người ngoài không thể đọc endpoint nhạy cảm.
4. Lập bảng nguồn và chốt/đánh dấu các quyết định tài chính `08_NHUNG_DIEM_CAN_CHOT.md`.

### Giai đoạn 2 — Nền dữ liệu
5. Định nghĩa schema Sheets + data dictionary + stable `recordId`, timestamps, businessDate, version, user, source, trạng thái chốt và lịch sử; khóa master/child/ledger theo `03_...`.
6. Tạo `setup` idempotent, migration có version, validators, protected headers và metadata; không xóa rows đã có.
7. Batch read/write, delta read, cache có phân quyền, retry idempotent, nhật ký, lock, conflict 409, recovery journal. `onEdit`/`onChange`/periodic reconciliation cho sửa trực tiếp Sheets; hiệu lực trong giới hạn trễ được đo và thể hiện.

### Giai đoạn 3 — Nối nghiệp vụ theo luồng, không theo màn hình độc lập
8. Danh mục vật tư/đơn vị/giá/nhóm/tồn tối thiểu, món, điểm bán (kiosk ĐB09 từ phác thảo), nhân viên, bảng chiết khấu.
9. Công thức nhân/sốt/cơm/bao bì/món, nở cây công thức, quy đổi, định mức, snapshot giá vốn; tính nhu cầu ngày/tuần/tháng/quý.
10. Phiếu kế hoạch tối nay → sản xuất chính/thêm/lỗi/hủy → xuất nguyên liệu → kiểm kê → chênh lệch; cảnh báo tồn/tồn tối thiểu.
11. Giao cho điểm bán → bán/ế/điểm bán chịu/thu hồi có phê duyệt → kiosk nhập → kiosk bán riêng → đối soát doanh thu/chiết khấu/hỗ trợ thu hồi/tiền mặt/chuyển khoản; không đếm trùng.
12. Nhập hôm nay/nhập bù/bổ sung/sửa và audit; ca đêm 23–07/08/09; phụ cấp mặc định/theo ngày/hỗ trợ; lương theo 3 bộ phận và snapshot.
13. Công nợ, vay, sổ quỹ, marketing/cố định/văn phòng/khấu hao, đối chiếu thu chi, doanh thu thuần khác dòng tiền.
14. Kế hoạch/mục tiêu (food cost, 15% nhân sự SX, lỗi, hủy, trả hàng, cố định, VP, marketing, khấu hao, cash+bank). Dashboard ngày/tuần/tháng, so sánh thứ tương ứng và cảnh báo đầy đủ nguồn. Chiến lược nhiều biểu đồ và kịch bản.
15. Cổng đặt hàng khách riêng, chỉ cho khách xem món công bố/đơn mình; đơn phải duyệt trước khi tăng kế hoạch, không đếm trùng đơn kế hoạch.

### Giai đoạn 4 — UX/performance/release
16. Preload shell/ảnh/CSS trước login **không preload dữ liệu nhạy cảm**; sau auth nạp danh mục đủ quyền và KPI ban đầu; SPA/caching theo revision, tối ưu batch/trạng thái pending/skeleton, animation `prefers-reduced-motion`.
17. Test đầy đủ từng ca trong `06_...`, 2 người sửa đồng thời, edit trực tiếp Sheets, mất mạng/timeouts, retry 2 lần không ghi trùng, backup/restore và bảo mật.
18. Deploy DEV và ghi chính xác thao tác Google người dùng phải cấp quyền. `/dev` dùng HEAD cho editor; `/exec` muốn cập nhật phải push code, tạo **new version trên deployment cũ**. Không nhắc người dùng chạy `setup` sau mỗi sửa HTML, chỉ migration khi schema thay đổi.

## 3. TIÊU CHÍ BÀN GIAO

- Source build được, tests chạy thật và danh sách failed tests; không chấp nhận mock được gọi là production.
- Sheet DEV có schema, identity/roles/backup và ví dụ nghiệp vụ không dùng tài chính thật.
- `REQUIREMENT_MATRIX.md` đầy đủ tất cả REQ; `GAP_REPORT.md` các yêu cầu chưa hoàn tất, P0/P1/P2; `DECISIONS.md` các quy tắc đã được người dùng xác nhận.
- Tài liệu: setup Google Cloud, OAuth/redirect, Script Properties (tên khóa, không secret), clasp, trigger, migrations, deploy, backup/recovery, quyền Sheets, quy trình khi có xung đột.
- Kết quả kiểm thử bắt buộc: giao 100, bán 80, thu hồi 10, điểm bán chịu 10, nhập kiosk một lần; 100→bổ sung 30→sửa 90; ca 23:00–09:00; tuần so thứ Năm; đối chiếu 4,5 can; auth invalid origin đã thực sự sửa hoặc BLOCKED giải thích.
- Không đòi hỏi chạy một nút duy nhất có thể vượt OAuth/authorization; giải thích cụ thể các bước cấp quyền cần user thực hiện.

**Thực hiện ngay task đầu tiên là audit repo + `REQUIREMENT_MATRIX.md` + auth POC.** Sau mỗi task tiếp tục task kế theo phụ thuộc, trừ khi gặp blocker không thể tự giải quyết. Khi không đủ context, tạo checkpoint bền vững, hướng dẫn dùng `PROMPT_TIEP_TUC.md`.

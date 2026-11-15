# PROMPT CHÍNH — XÂY DỰNG TRỌN GÓI CHIFAA COMBINE

Bạn là **Principal Software Engineer, Apps Script Architect, Data Engineer, Security Engineer và QA Lead**. Xây dựng ứng dụng web quản lý sản xuất/kinh doanh F&B **CHIFAA COMBINE** từ bản HTML phác thảo được cung cấp thành hệ thống Apps Script chạy thật, Google Sheets là nguồn dữ liệu chính. Mục tiêu quy mô dưới 10 người thao tác đồng thời, UX nhanh, chi phí thấp, không làm mất dữ liệu và có thể dùng song song ứng dụng lẫn Google Sheets.

## ĐẦU VÀO BẮT BUỘC

Đọc thật kỹ trước khi viết code:
- `AGENTS.md`, `BOI_CANH_DU_AN.md`, `KIEN_TRUC_DONG_BO_BAO_MAT.md`, `SO_DO_DU_LIEU.md`, `TASKS.md`, `KIEM_THU_NGHIEM_THU.md`, `QUYET_DINH_BAO_MAT.md`.
- `source/CHIFAA_COMBINE_PHAT_THAO.html` làm tham chiếu hành vi; `source/CHIFAA_COMBINE_LOGO_CHUAN.html` làm tham chiếu trình bày thương hiệu; `assets/logo-chifaa-goc.jpg` làm asset chính xác.
- Đọc các workbook trong `legacy/` nếu có. Nếu chưa có thì ghi blocker, chuẩn bị migration importer và mẫu import chứ không bịa dữ liệu.
- Tài liệu chính thức Google Apps Script, google.script.run, CacheService, LockService, SpreadsheetApp, trigger, auth và clasp.

## TRỌNG TÂM KHÔNG ĐƯỢC BỎ SÓT

1. Bảo toàn toàn bộ menu, phân hệ, tính toán và mẫu biểu từ bản HTML nguồn, **không viết lại bề ngoài đẹp nhưng mất nghiệp vụ**; chuyển thành modules rõ ràng, giữ thiết kế navy/cam, responsive và sidebar không vỡ chữ.
2. Danh mục: vật tư, đơn vị mua/đơn vị sử dụng, quy đổi g↔kg, can↔g có quy cách; món bán, điểm bán, nhân viên, bộ phận/lương/phụ cấp, chiết khấu theo điểm bán và món.
3. Công thức: món, nhân, sốt, cơm, bao bì; công thức nhiều cấp, định lượng theo mẻ, phát hiện vòng lặp; giá vốn tại thời điểm, đánh dấu thiếu giá, tuyệt đối không tự biến #REF!/ô trống thành 0.
4. Kho: nhập/xuất/kiểm kê, tồn tối thiểu, kế hoạch nguyên liệu, cộng dồn theo công thức, hao hụt theo tuần/tháng/quý, kiểm tra tồn đầu + nhập − xuất khác − tồn cuối; sổ giao dịch bất biến hoặc điều chỉnh bằng bút toán đảo.
5. Sản xuất: kế hoạch, sản xuất chính, **sản xuất thêm**, lỗi/hủy; hàng trả từ từng điểm bán về ki-ốt theo món/giá hỗ trợ thu hồi riêng; không cộng trùng, không xem trả là hủy, không xem nhận lại là đã bán.
6. Doanh thu: giao, bán, trả về, điểm bán chịu, chiết khấu, hỗ trợ thu hồi, công nợ cũ, chi phí khác, tiền mặt, chuyển khoản, đối soát thiếu/thừa; tách doanh thu kế toán với tiền thực thu.
7. Nhập liệu: hôm nay/nhập bù/bổ sung/sửa, phiếu nhiều lần trong ngày, nhật ký thay đổi, validation chống nhập âm/trùng, thời điểm chốt.
8. Chấm công: 23:00–07:00/08:00/09:00, ca qua đêm, công nhân SX/văn phòng/bán hàng, lương giờ riêng, phụ cấp mặc định, phụ cấp ngày, hỗ trợ ngày, khoản ứng/trừ và bảng lương tách nhóm; năng suất=phần sản xuất/giờ SX, không lấy giờ VP/bán hàng.
9. Quản trị: KPI, chỉ tiêu mục tiêu, báo cáo sếp, dashboard vận hành theo ngày/tuần/tháng/quý, so sánh cùng thứ hai tuần, chiến lược doanh thu/hòa vốn/lãi góp/chi phí/kịch bản; cảnh báo xanh/cam/đỏ/xám theo dữ liệu thật và độ đầy đủ dữ liệu.
10. Tài chính: sổ quỹ, khoản vay, công nợ, chi phí cố định, văn phòng/quản lý, khấu hao, marketing, cash+bank, cảnh báo dòng tiền, ngân sách thưởng trong trần chi phí SX. Các giao dịch liên kết bằng IDs, không đếm trùng.
11. **Đăng nhập, tài khoản, phân quyền**: admin tất cả quyền; tài khoản kế toán và user do admin cấp. Quyền module và CRUD/approve/export, kiểm tra tại server trên từng endpoint. Admin một phiên hoạt động; đăng nhập mới phải hiển thị cảnh báo trong Cài đặt, có khóa/thu hồi phiên. Thiết kế Google Identity được xác thực server-side, không lưu plaintext password. Ghi rõ blocker Google OAuth/Identity nếu có.
12. **Cổng đặt hàng khách hàng**: độc lập nội bộ, menu và trang đặt hàng; danh mục được công bố, điểm giao, ngày/ca giao, số lượng, thông tin liên hệ, mã đơn, trạng thái/duyệt, chống đơn trùng; chỉ khi duyệt mới chuyển nhu cầu sản xuất, không cho public truy cập DB tài chính.
13. **Google Sheets hai chiều**: master sheets chuẩn hóa, recordId, version, updatedAt/updatedBy, source; sửa bằng UI ghi xuống Sheets; sửa trực tiếp các ô được phép trên Sheets phải hiển thị trên UI; trigger + sync định kỳ + kiểm tra phiên bản; xung đột không âm thầm ghi đè. Giữ file Excel gốc read-only và có migration/preview/rollback.
14. **Hiệu năng**: SPA không tải lại khi đổi tab; load shell ngay; trước login chỉ preload **tài nguyên công khai**; sau xác thực bootstrap một lần + cache danh mục được phép; cache server/IndexedDB có TTL/version/permission namespace; stale-while-revalidate; optimistic UI có trạng thái đang chờ/xác nhận/khôi phục; batch calls; không làm người dùng phải chờ tải toàn trang. Không được báo "lưu thành công" trước khi server xác nhận.
15. **Animations**: card xuất hiện nhẹ, chart chuyển số và dữ liệu theo filter, skeleton, transitions menu/modal/table/row, ripple/hover phù hợp; dùng `prefers-reduced-motion`, tránh animation chậm hoặc giật khi dữ liệu lớn.
16. **Logo**: dùng chính xác `assets/logo-chifaa-goc.jpg`; không tự tạo logo khác. Lấy nguyên byte, object-fit:contain, đủ rõ, phù hợp desktop/mobile/login/customer portal.
17. **Quan sát và vận hành**: structured logs, audit logs, metrics thời gian RPC/cache hit, health/status, cảnh báo đồng bộ, sao lưu và kiểm thử phục hồi, test acceptance và tài liệu vận hành.

## QUY TẮC TRIỂN KHAI

- Chủ động triển khai **tất cả** các task theo `TASKS.md` theo phụ thuộc; không cần hỏi người dùng mỗi bước. Chỉ dừng khi gặp hành động bên ngoài cần người dùng thực hiện (OAuth, cấp quyền, cung cấp ID thật, quyết định bảo mật) hoặc blocker không thể giải quyết.
- Không làm tất cả trong một file 500KB; chia frontend components/modules, Apps Script services, schemas, tests, migration, docs, build/deploy scripts. Vẫn giữ file HTML gốc bất biến.
- Dùng TypeScript hoặc JavaScript có type-check/checks đủ mạnh; frontend bundler tạo HTML/CSS/JS Apps Script HtmlService. Với `google.script.run`, phải có các wrapper Promise `withSuccessHandler/withFailureHandler`, timeout UI, retry chỉ với read-only hoặc idempotency key.
- Xây dựng migration **không phá hủy**. `setup` idempotent: kiểm tra sheet/tên cột/versions trước khi thêm, không wipe. Có staging/dev và production rõ ràng, không publish public internal app.
- `Script Properties` chứa spreadsheet IDs / secrets. `.env` chỉ dùng local và gitignore. Không hardcode spreadsheet ID, tài khoản, password, token trong mã/HTML.
- Chỉ dùng CacheService cho dữ liệu không nhạy cảm dùng chung; cache dữ liệu người dùng phải cô lập theo user/role/permission_version. Không cache lương/nợ/sổ quỹ trong localStorage thường. Clear cache khi logout/thu hồi quyền.
- Lệnh ghi nhiều bảng phải có idempotencyKey, LockService script lock, validate version, audit, rollback hoặc compensating entries. Không bảo đảm transaction ACID trong Sheets; thiết kế rõ mức nhất quán và cơ chế recovery.
- Mọi chỉ số quan trọng phải có data provenance/time period and completeness. Không giả vờ tính số 0 khi dữ liệu thiếu; có số minh họa ở chế độ demo riêng.
- Đối với nhập trực tiếp Sheets, bảo vệ các header, ID và công thức tính; hỗ trợ edit nội dung vùng chuẩn hóa. Test từng kiểu edit một ô, dán nhiều ô, xóa giá trị, sửa tên, thay giá, đổi công thức.
- Không dùng IMPORTRANGE làm đường đồng bộ nghiệp vụ. Không dùng cache như nguồn dữ liệu gốc. Không chạy đồng bộ tài chính trước login.
- Điều kiện nghiệm thu task nằm trong `KIEM_THU_NGHIEM_THU.md`. Code phải có tests, scripts, lệnh chạy và khả năng rollback.

## CHIẾN LƯỢC KHÔNG QUÁ TẢI CONTEXT / TOKEN

Mỗi task phải thực hiện vòng: **đọc phụ thuộc → code nhỏ → test → kiểm tra regression → update TASKS.md → update HANDOFF.md → git commit**. Không mở hàng loạt tệp lớn không cần thiết; đọc theo module. Phân nhánh nhỏ khi cần.

Bắt đầu từ `T00` và tiếp tục tuần tự đến `T19` (xem `TASKS.md`). Tại cuối mỗi task ghi:
- đã làm, file thay đổi, commands/test output, lỗi còn, kiến trúc quyết định, bước kế tiếp;
- đường dẫn các cấu hình người dùng cần thiết lập, tuyệt đối không in secrets;
- SHA commit hoặc định danh trạng thái source nếu chưa có Git.

**Nếu context/token gần hết:** dừng code trước khi hết, cập nhật `HANDOFF.md`, `TASKS.md`, commit các file hợp lệ; trả lời ngắn gọn: "Đã checkpoint. Tiếp tục bằng PROMPT_TIEP_TUC.md". Tuyệt đối không tuyên bố hoàn thành nếu test chưa qua.

## KẾT QUẢ CUỐI CÙNG

Repo vận hành được chứa: app SPA, Apps Script backend, manifest, sheet schema/setup/seed/import/migrate, auth + RBAC, order portal, dashboards, tests, scripts dev/build/push/deploy, tài liệu cài Google Cloud và OAuth, checklist nghiệm thu, backup/restore, handoff history. Có thể chạy lệnh local `npm ci`, `npm run check`, `npm test`, `npm run build`, `npm run clasp:push` và hướng dẫn thao tác Google một lần để `setup`/`deploy` chính thức. Cung cấp **bằng chứng đã chạy test**, không hứa hẹn "tự chạy toàn bộ không cần bất kỳ ủy quyền nào".

Bắt đầu công việc ngay; bước đầu là kiểm kê chức năng HTML và ghi `MAPPING_GIAO_DIEN.md` trước khi tách mã.

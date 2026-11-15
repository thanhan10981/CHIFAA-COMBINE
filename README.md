# CHIFAA COMBINE — bản dev

Ứng dụng quản lý F&B dùng Apps Script và Google Sheets. Chủ dự án hiện là dev dùng Gmail cá nhân, chưa bàn giao khách hàng. Chưa tạo tài nguyên trên Google và chưa có deployment live. Workbook mẫu build sẵn: `output/chifaa-dev/CHIFAA_DEV.xlsx`, gồm 23 tab, chưa kiểm tra hiển thị trên Google/Excel.

## Xem trên máy

Yêu cầu Node.js 24 trở lên.

```powershell
npm ci
npm run check
npm test
npm run build
npm run dev
```

Mở `http://127.0.0.1:4173/` cho màn hình đăng nhập hoặc `http://127.0.0.1:4173/?demo=1` để xem ứng dụng và nhập thử trong RAM. Dữ liệu xem thử mất khi tải lại. `output/CHIFAA_PHAT_THAO_LOGO_MOI.html` giữ nguyên toàn bộ JavaScript của phác thảo, chỉ thay logo/CSS thương hiệu. `output/CHIFAA_APP.html` là giao diện mới kết nối backend khi chạy trong Apps Script.

## Đã có

- 32 tuyến menu từ phác thảo, thêm tài sản, đơn hàng, quản trị và nhật ký.
- 17 bảng nghiệp vụ và 5 bảng hệ thống; CRUD danh mục, phiếu bất biến + phiếu đảo, audit, khóa ghi, version + fingerprint, journal idempotency + rollback.
- Công thức nhiều cấp, phát hiện vòng lặp, giá nhập theo thời điểm; tồn kho, nhu cầu, hao hụt; sản xuất chính/thêm/hủy; doanh thu/thu tiền/trả hàng; ca qua đêm và bảng lương theo bộ phận; công nợ, vay, tài sản, mục tiêu và kịch bản hòa vốn.
- Google Identity được kiểm tra phía server, allowlist, quyền từng module/action, phiên admin đơn; cổng đơn hàng triển khai riêng với workbook riêng và thư mời có hạn.
- Setup không xóa dữ liệu, quét đồng bộ, backup, khôi phục thành bản sao, import preview rồi apply theo lô.

## Chưa nghiệm thu

Đây là nền tảng dev có kiểm thử local, **chưa phải sản phẩm đã hoàn thành toàn bộ yêu cầu trong prompt**. Bản mới còn cần đối chiếu biểu mẫu và thao tác với toàn bộ phác thảo; một số màn hình dùng bảng/form chung. Chưa có p95 mạng thật, kiểm thử 10 người, Google OAuth trong HtmlService, trigger/quyền bảo vệ trên Google, restore thật hoặc dữ liệu Excel cũ. Xem `TASKS.md` và `MAPPING_GIAO_DIEN.md` để biết phạm vi chính xác.

Quy tắc doanh thu và chi hỗ trợ thu hồi hiện là giả định được hiển thị rõ trong UI. Chưa chốt cách ghi nhận hàng điểm bán chịu, lãi vay, chi phí phân bổ, khấu hao và chính sách thưởng với khách hàng. Báo cáo kết quả hiện tạm tính trước khấu hao/lãi vay. Không dùng cho sổ kế toán chính thức trước nghiệm thu.

## Triển khai Google và bàn giao

Làm theo [docs/CAI_DAT_GOOGLE.md](docs/CAI_DAT_GOOGLE.md), sau đó [docs/NGHIEM_THU.md](docs/NGHIEM_THU.md). Dùng workbook dev mới; khách hàng nhận một project/workbook riêng, cấu hình và quyền sở hữu riêng. Không giao secrets hay phiên đăng nhập dev. Google Drive chưa được cài/kết nối trong phiên thực hiện này; không có Google Sheet URL để bàn giao lúc này.

Logo chính: `assets/logo-chifaa-navy-v3.png`; ảnh gốc được giữ ở `assets/logo-chifaa-goc.jpg`. Các PNG nền trong suốt là phương án thử, không dùng làm logo mặc định do viền nhiễu. Prompt và công cụ ghi trong `docs/LOGO.md`.

# Sơ đồ dữ liệu — bản dev

Các bảng nguồn dùng header máy ở hàng 1 để backend kiểm tra chính xác; mô tả người dùng nằm trong UI và bảng dưới. Metadata chung: recordId, version, updatedAt, updatedBy, source, deleted, reverses. Giá trị tiền: VND; tỷ lệ dạng 0–1; ngày yyyy-mm-dd theo Asia/Ho_Chi_Minh.

## materials — Danh mục vật tư

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| name | Tên vật tư | text | Có |
| purchaseUnit | Đơn vị mua | text | Có |
| unit | Đơn vị sử dụng | text | Có |
| conversion | Số đơn vị sử dụng / đơn vị mua | number | Có |
| purchasePrice | Giá mua | number | Không |
| minimum | Tồn tối thiểu | number | Có |

## dishes — Danh mục món bán

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| name | Tên món | text | Có |
| price | Giá bán | number | Có |
| published | Công bố cho khách | boolean | Không |

## stores — Danh mục điểm bán

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| name | Tên điểm bán | text | Có |
| address | Địa chỉ | text | Không |
| contact | Liên hệ | text | Không |

## employees — Danh mục nhân viên

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| name | Họ tên | text | Có |
| department | Bộ phận | select | Có |
| hourlyRate | Lương giờ | number | Có |
| allowance | Phụ cấp mặc định / ngày | number | Có |

## discounts — Bảng chiết khấu

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| storeId | Điểm bán | ref → stores | Có |
| dishId | Món bán | ref → dishes | Có |
| rate | Tỷ lệ chiết khấu (0–1) | number | Có |
| recoveryPrice | Hỗ trợ thu hồi / phần | number | Có |

## recipes — Công thức nhiều cấp

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| name | Tên công thức | text | Có |
| kind | Loại | select | Có |
| dishId | Món liên kết | ref → dishes | Không |
| yield | Sản lượng / mẻ | number | Có |
| lines | Thành phần | lines | Có |

## stock — Nhập / xuất / kiểm kê

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| date | Ngày | date | Có |
| materialId | Vật tư | ref → materials | Có |
| type | Loại phiếu | select | Có |
| quantity | Số lượng (đơn vị sử dụng) | number | Có |
| unitCost | Giá / đơn vị sử dụng | number | Không |
| note | Ghi chú | text | Không |

## counts — Kiểm kê thực tế

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| date | Ngày | date | Có |
| materialId | Vật tư | ref → materials | Có |
| opening | Tồn đầu | number | Có |
| closing | Tồn cuối | number | Có |
| otherOut | Xuất khác | number | Có |
| note | Ghi chú | text | Không |

## production — Kế hoạch & chốt sản xuất

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| date | Ngày | date | Có |
| dishId | Món bán | ref → dishes | Có |
| planned | Kế hoạch | number | Có |
| produced | Sản xuất chính | number | Có |
| extra | Sản xuất thêm | number | Có |
| rejected | Lỗi / hủy | number | Có |
| note | Ghi chú | text | Không |

## sales — Doanh thu hằng ngày

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| date | Ngày | date | Có |
| storeId | Điểm bán | ref → stores | Có |
| dishId | Món bán | ref → dishes | Có |
| delivered | Đã giao | number | Có |
| sold | Đã bán | number | Có |
| returned | Trả về ki-ốt | number | Có |
| creditQty | Điểm bán chịu (phần) | number | Có |
| price | Đơn giá bán tại thời điểm | number | Có |
| discount | Chiết khấu (0–1) | number | Có |
| recoveryPrice | Hỗ trợ thu hồi / phần | number | Có |
| cash | Thực thu tiền mặt | number | Có |
| bank | Thực thu chuyển khoản | number | Có |
| oldDebtPaid | Thu công nợ cũ | number | Có |
| otherCost | Chi phí khác | number | Có |
| note | Ghi chú | text | Không |

## attendance — Chấm công

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| date | Ngày | date | Có |
| employeeId | Nhân viên | ref → employees | Có |
| start | Bắt đầu (HH:mm) | time | Có |
| end | Kết thúc (HH:mm) | time | Có |
| breakMinutes | Nghỉ (phút) | number | Có |
| hourlyRate | Lương giờ tại thời điểm | number | Có |
| department | Bộ phận tại thời điểm | select | Có |
| defaultAllowance | Phụ cấp mặc định | number | Có |
| dailyAllowance | Phụ cấp thêm | number | Có |
| support | Hỗ trợ ngày | number | Có |
| advance | Tạm ứng | number | Có |
| deduction | Khấu trừ | number | Có |

## plans — Kế hoạch & mục tiêu

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| date | Ngày | date | Có |
| revenue | Doanh thu mục tiêu | number | Có |
| production | Sản lượng mục tiêu | number | Có |
| fixedCost | Chi phí cố định | number | Có |
| productionCostCap | Trần chi phí SX | number | Có |
| bonusCap | Trần thưởng | number | Có |

## loans — Khoản vay

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| name | Bên cho vay | text | Có |
| principal | Tiền gốc | number | Có |
| annualRate | Lãi suất năm (0–1) | number | Có |
| date | Ngày | date | Có |
| dueDate | Ngày đến hạn | date | Có |
| note | Ghi chú | text | Không |

## debts — Công nợ

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| name | Đối tác | text | Có |
| type | Loại | select | Có |
| amount | Giá trị gốc | number | Có |
| date | Ngày | date | Có |
| dueDate | Ngày đến hạn | date | Có |
| note | Ghi chú | text | Không |

## cash — Sổ quỹ thu – chi

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| date | Ngày | date | Có |
| direction | Thu / chi | select | Có |
| account | Tài khoản | select | Có |
| amount | Số tiền | number | Có |
| category | Nhóm | select | Có |
| linkedId | ID công nợ / khoản vay liên kết | text | Không |
| note | Ghi chú | text | Không |

## assets — Tài sản & khấu hao

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| name | Tên tài sản | text | Có |
| date | Ngày | date | Có |
| cost | Nguyên giá | number | Có |
| salvage | Giá trị còn lại | number | Có |
| months | Thời gian khấu hao (tháng) | number | Có |

## orders — Đơn đặt hàng

| Cột | Ý nghĩa | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| date | Ngày | date | Có |
| shift | Ca giao | text | Có |
| storeId | Điểm giao | ref → stores | Có |
| dishId | Món bán | ref → dishes | Có |
| quantity | Số lượng | number | Có |
| contact | Liên hệ | text | Có |
| customer | Tên khách | text | Có |
| status | Trạng thái | select | Có |

## Hệ thống

- _Users: recordId, email, role, permissions, enabled, permissionVersion
- _Sessions: recordId, email, tokenHash, expires, status, createdAt
- _Audit: recordId, at, user, action, module, subjectId, before, after
- _Requests: key, actor, fingerprint, state, effects, result, createdAt
- _Sync: module, recordId, hash, seenAt
- _AuthRequests: sessionHash, requestId, expires
- _Workflows: recordId, version, updatedAt, updatedBy, source, deleted, reverses, date, kind, referenceId, details
- _Periods: recordId, version, updatedAt, updatedBy, source, deleted, reverses, from, to, status, note
- _JournalChunks: recordId, version, updatedAt, updatedBy, source, deleted, reverses, requestKey, part, details

# 02 — QUY TẮC TÍNH TOÁN, CHỨNG TỪ VÀ ĐỐI SOÁT

**Phân loại:** `CONFIRMED` = đã có yêu cầu rõ; `PROVISIONAL` = công thức gợi ý cần xác nhận trước live; `DECISION_REQUIRED` = cấm tự chốt. Mọi số đo có `business_date`, kỳ, đơn vị, nguồn, `dataCompleteness` và nếu cần `metricDefinitionVersion`.

## 1. Nguyên tắc số liệu chung

- **Số 0 là giá trị có ý nghĩa** nếu người có quyền đã nhập/đánh dấu xác nhận. Không có phiếu, ô trống, `#REF!`, lỗi nối dữ liệu, chưa kiểm kê, chưa có định mức, chưa có giá mua = `null`/`UNAVAILABLE`/`UNVERIFIED`; tuyệt đối không điền 0 cho đẹp chart.
- Không tự bù các ngày thiếu doanh thu bằng 0. Mỗi báo cáo có chỉ báo độ phủ, ví dụ `5/7 ngày đủ phiếu`, và ngày thiếu phải hiện màu xám.
- Mọi số tiền lưu theo VND nguyên (hoặc decimal chính xác), không cộng tiền bằng số thực mất độ chính xác; số lượng/định lượng decimal với quy tắc làm tròn theo UOM; không làm tròn quá sớm từng nguyên liệu trước khi cộng.
- Thời gian hiển thị Asia/Ho_Chi_Minh; timestamps hệ thống UTC ISO + businessDate; tuần Thứ Hai–Chủ nhật, tháng lịch VN. Xác định ca 23h thuộc ngày bắt đầu ca/đơn sản xuất.

## 2. Danh mục vật tư và chuyển đơn vị

`qty_base = qty_input × conversion_factor(input_uom → base_uom)`.

- Nếu nguyên liệu sử dụng `g` và kho lưu `kg`, 100g = 0,1kg; 1kg=1.000g.
- Nếu nhập 4,5 can tương ớt, cần `netContentPerCan` đã xác nhận (`kg/can` hoặc `g/can`) trước khi so với công thức sử dụng g. Thiếu quy cách → `MISSING_CONVERSION`, không dùng giả định 1 can = 1kg.
- Giá mua theo kg và định lượng theo g: `cost_gram = purchase_price_per_kg / 1000`; nếu bán theo can có giá/can phải chia đúng lượng thực can trước khi định giá mỗi gram. Mỗi giá và quy cách có ngày hiệu lực để số lịch sử không đổi ngược.
- Khác biệt định mức gạo khô/cơm chín phải có tỷ lệ thành phẩm (`yield`) của công thức cơm được phê duyệt.

## 3. Công thức nhiều tầng

Cho công thức R tạo ra `yield_qty` phần/mẻ, dòng i có `line_qty_i`, `line_type = MATERIAL|RECIPE`. Với Q đơn vị đầu ra cần: `need_i = Q / yield_qty × line_qty_i` (đổi đúng UOM). Nếu i là công thức con, nở đệ quy theo sản lượng đầu ra của công thức con; nếu nguyên liệu thì cộng vào lượng dùng của `materialId`. Phát hiện vòng lặp, công thức thiếu, unit không thể đổi và công thức chưa có hiệu lực. Bắt lỗi trước chốt.

`totalRaw(material, period) = Σ [quantityMade(product, event) × requiredMaterialPerProduct(recipeVersion)]` với người dùng chọn **kế hoạch** hoặc **thực sản xuất**.

**Ví dụ CONFIRMED:** 114g cơm chín/phần; 100 phần = 11.400g cơm chín; nếu 2,5kg cơm chín/kg gạo khô thì gạo cần = 11,4/2,5=4,56kg. Không tự sử dụng ví dụ này cho mẻ có yield khác.

**Snapshot:** productionEvent và cost snapshot giữ `recipe_version`, `conversion_version`, `price_basis` để báo cáo tuần trước được tái lập theo nguyên tắc tại thời điểm đó, không đổi vì hôm nay sửa recipe/giá. Cho báo cáo “giá vốn tính lại theo giá hiện tại” ở mode riêng, không thay số đã chốt.

## 4. Sản xuất, lỗi và năng suất

- `totalProduced = mainProduced + extraProduced`.
- `goodProduced = totalProduced - productionRejected` nếu `rejected` là số món không đạt phải loại bỏ; phải ghi `rework`, `waste`, `discard` riêng nếu có.
- `productionErrorRate = productionRejected / totalProduced × 100%` khi totalProduced > 0. Tỷ lệ lỗi SX tháng lấy số lỗi/SX tháng, không gộp hàng trả ở điểm bán.
- `productionHours = Σ duration(shift)` với `departmentSnapshot='SX'` và ca có hiệu lực. `duration` ca qua đêm: end ngày sau nếu end clock < start clock, trừ nghỉ (nếu có). 23:00→07:00=8h; →08:00=9h; →09:00=10h.
- `productivity = producedQty / productionHours` (phần/giờ công SX). **DECISION_REQUIRED:** báo cáo dùng totalProduced hay goodProduced; hiển thị cả hai tạm thời để chủ chọn, không trộn với số giờ công văn phòng/bán hàng.
- `productionLaborCost = Σ (hours × hourlyRateSnapshot + applicableDefaultAllowance + dailyAllowance + dailySupport + other approved production compensation)`; khoản ứng lương là dòng tiền ứng trước, không nhất thiết là chi phí kỳ. `expenseBasis` cần chốt.

## 5. Nhu cầu NVL, tồn kho, kiểm kê, hao hụt

`stockBookEnd = openingBook + receipts + inboundTransfers + positiveAdjustments - issues - outboundTransfers - negativeAdjustments`.

`actualUsed = openingPhysical + receiptsDuringPeriod + transfersIn - closingPhysical - transfersOut - otherNonProductionOut ± approvedAdjustments` (**PROVISIONAL**: định nghĩa chiều và loại điều chỉnh phải đối soát chứng từ, không được dùng thu hồi thành phẩm làm nguồn nhập nguyên liệu).

`varianceQty = actualUsed - theoreticalUsed`. `variancePct = 100 × varianceQty / theoreticalUsed` nếu theoreticalUsed > 0. Nếu theoreticalUsed = 0 và actualUsed > 0, hiển thị `Phát sinh ngoài định mức` thay vì phần trăm vô hạn; cả hai bằng 0 có thể coi 0% khi số liệu hoàn chỉnh.

**Ví dụ:** Theo định mức 4,5 can tương ớt, thực tế 5 can → +0,5 can = +11,11%. Cần quy cách đổi nếu so công thức ở g/kg. Ví dụ gạo định mức 45,6kg, thực dùng 48kg → +2,4kg = +5,26%.

Tồn tối thiểu: `shortage = max(0, minStock - availableStock)`; nhu cầu sản xuất thêm có thể tạo dự báo `plannedShortage = max(0, needQtyForTomorrow + safetyQty - availableStock - confirmedIncomingQty)`; không tự khấu trừ tồn trong khi mới dự kiến, mà khi xác nhận chứng từ xuất hoặc sự kiện sử dụng theo thiết kế đã chốt.

**Chú ý:** Không dùng cùng một phiếu kiểm kê vừa `ghi xuất` vừa `tính tiêu hao` lần nữa (double count). Phiếu kiểm kê tính tồn/chênh lệch, bút toán điều chỉnh chỉ phát sinh nếu người có quyền phê duyệt; ledger giữ nguồn tham chiếu.

## 6. Giao hàng điểm bán – bán – ế – thu hồi – khách chịu

Ví dụ quan trọng phải có unit/e2e test:

| Dòng | SL | Ý nghĩa |
|---|---:|---|
| Giao điểm bán A | 100 | Thành phẩm đã chuyển tới điểm bán |
| Khách bán được | 80 | Bán thực tế theo báo cáo điểm |
| CHIFAA chấp thuận thu hồi | 10 | Trả về kiosk, có giá hỗ trợ riêng và phiếu nhận |
| Khách tự chịu | 10 | Không thu hồi, không tự biến thành hàng hủy |

Bất biến lượng: `delivered = sold + approvedReturned + customerBears + remainingAtStore ± approvedCorrections`. Trường hợp chưa chốt còn ế chưa xử lý, `remainingAtStore` phải là số riêng; không ép tổng bằng 100 nếu thiếu chứng từ.

- `approvedReturned` đi qua một `returnId` duy nhất, có nhận về tại kiosk; giao dịch `RETURN_APPROVED` / `KIOSK_RECEIVED`. Chưa nhận thực tế → không tăng tồn vật lý kiosk.
- Giá hỗ trợ thu hồi `recoveryUnitPriceSnapshot` **khác** `sellingUnitPriceSnapshot`; tiền hỗ trợ `approvedReturned × recoveryUnitPriceSnapshot`. Phải lưu rõ tiền hỗ trợ này là **giảm phải thu từ điểm bán**, hay **chi phí thu hồi**, hay **giảm trừ doanh thu** theo quy tắc kế toán người dùng chốt. Không trừ lặp.
- Kiosk chỉ có inbound +10 sau khi nhận, `kioskSold` 0 cho tới khi ghi phiếu bán lại. Chống bán vượt tồn kiosk, truy vết hàng từ điểm và lô thu hồi nếu cần.
- `customerBears` 10 phần có thể làm phát sinh doanh thu/phải thu với giá riêng theo hợp đồng, không mặc định bằng đã bán 10 phần. **DECISION_REQUIRED**: đây là nghĩa vụ thanh toán cho hàng ế, mức giá/chiết khấu và cách ghi nhận doanh thu/phải thu do kế toán xác nhận.

## 7. Doanh thu thuần vs tiền thu và nợ

Cần duy trì **độc lập** các phép tính dưới đây và chính sách kế toán sau khi chốt:

- `grossSalesBasis` = tổng tiền giá bán theo `sold` (và có thể hàng điểm tự chịu nếu chính sách yêu cầu) × giá snapshot.
- `tradeDiscount` = Σ tiền chiết khấu theo điểm bán × món × thời điểm (không tính chiết khấu cho phần không thuộc cơ sở tính).
- `netRevenueAccounting` = doanh thu được ghi nhận − chiết khấu − giảm trừ doanh thu được chấp thuận. `recoverySupport`, công nợ cũ, thu hộ khác và chi phí khác **không tự động trừ ở dòng này** khi chưa phân loại kế toán.
- `amountDueCurrent = recognizedSettlementAmount - offsetOldDebts/allowances/otherOffsets +/− adjustments`. Cần xác nhận chiều dấu công nợ cũ (nợ cũ khách phải trả thường tăng số cần thu chứ không giảm).
- `receivedCash`, `receivedBank` là tiền thực nhận; `receivedTotal = cash + bank`.
- `collectionVariance = receivedTotal - amountExpectedForThisCollection` sau khi loại/ghi đúng các khoản thu nợ kỳ trước. Khoản chênh = 0 chỉ khi đủ ghi nhận; không đưa tất cả sai lệch vào P&L.
- `accountsReceivableClosing = openingAR + salesOnCredit + newReceivable - receiptsAppliedToAR - approvedOffsets`.

**DECISION_REQUIRED cấp P0:** Người dùng gọi “doanh thu thuần” vừa là số CHIFAA thực được hưởng sau chiết khấu vừa là tiền thu thực tế. Hệ thống phải tách `doanh thu thuần (accrual)` và `thực thu (cash)` ở UI, đặt tooltip/công thức minh bạch, rồi người dùng chọn **mẫu số chính sách** cho Food cost & labor %; không trộn số hai cột.

## 8. Chấm công và lương

- `shiftHours = (endAt - startAt - breakMinutes)/60` (ngày đầy đủ, không chỉ so clock HH:mm).
- `basePay = shiftHours × hourlyRateSnapshot`.
- `dayTotal = basePay + defaultAllowanceApplicable + dailyAllowance + support`.
- `monthlyNetPay = Σ dayTotal + bonusesApproved − advancesApplied − deductionsApproved`.
- Một ngày có thể nhiều ca. Default allowance theo ngày ghi tối đa một lần/người/ngày (nếu policy theo ngày), theo ca ghi từng ca (nếu policy theo ca), theo tháng ghi một lần trong payroll. Không tự nhân mọi loại phụ cấp theo số ca.
- Khi trả lương/ứng lương phải liên kết payroll/sổ quỹ, không tính trùng ứng vào chi phí nhân sự. Lương SX/VP/BH tách theo bộ phận tại thời điểm chấm công, không dùng bộ phận hiện tại cho lịch sử.

Ví dụ 23:00→09:00, 10h × 15.000 = 150.000, phụ cấp ca 10.000, phụ cấp ngày 15.000, hỗ trợ 5.000 ⇒ 180.000đ. Đây chỉ là **tình huống thử**, không khẳng định mức lương/chi trả của nhân viên cụ thể.

## 9. Chỉ tiêu tỷ lệ trên doanh thu & trần ngân sách thưởng

- `FoodCostPct = 100 × foodCostOfSales / selectedNetRevenueBasis` (không lấy giá bán lẻ trước chiết khấu làm mẫu số). Nếu cost chưa đầy đủ → null.
- `ProdLaborPct = 100 × productionLaborCost / selectedNetRevenueBasis`.
- `OfficeCostPct`, `FixedCostPct`, `MarketingCostPct`, `DepreciationPct` tương tự, mỗi tử số phải có định nghĩa chi phí và kỳ khớp.
- `ReturnRate = returnedUnits / deliveredUnits × 100%` theo phiếu được duyệt và cùng phạm vi ngày/điểm/món; `StoreDiscardRate = storeDiscardedUnits / deliveredUnits × 100%`; `ProductionErrorRate` khác hai cái trên. **DECISION_REQUIRED:** tính hủy/trả theo giá trị tiền hay số lượng; prototype dùng tỷ lệ lượng.
- `cashSafety = cashOnHand + bankBalance`, so với minCashBalance đã cài (15.000.000đ demo).
- `monthlyRevenuePlanPerSellingDay = monthlyRevenueTarget / sellingDays` khi >0; không chia cho ngày dương lịch nếu không bán đủ mọi ngày, trừ khi target theo lịch.
- `bonusHeadroom = max(0, 0.15 × selectedNetRevenueBasis - productionLaborCostCommitted)` nếu có trần 15%, số liệu đủ và **sản lượng tuần đạt kế hoạch**; có thể giới hạn tiếp bởi bonusBudget được chủ cài; không tự phê duyệt/chi. **Lưu ý lỗi logic:** Không trừ food cost thêm trong công thức ngân sách trần *riêng chi phí nhân sự*, vì 15% là labor cap chứ không phải tổng ngân sách thực phẩm + nhân sự (trừ khi chính sách riêng được xác nhận).
- Ngưỡng màu `GREEN` dưới trần, `AMBER` gần trần theo threshold Admin đặt, `RED` vượt, `GRAY` thiếu dữ liệu. Với chỉ tiêu có mục tiêu tối thiểu (doanh thu, cash), chiều so sánh đảo ngược (thấp hơn mục tiêu là cảnh báo).

## 10. Tăng trưởng theo ngày/tuần, độ phủ

- `growthPct = 100 × (new-old)/old` khi old >0 và cả hai ngày có dữ liệu đủ; old=0,new>0 => `newly_positive` không hiện ∞%; old=null => “không so sánh được”.
- So tuần từ Thứ Hai–Chủ nhật. So sánh cùng thứ: Thu 12/11/2026 vs Thu 05/11/2026, không lấy Thu với Wed hay tổng tháng.
- “Doanh thu tuần trước” là toàn bộ kỳ tuần trước, nhưng nếu thiếu ngày ghi rõ `chưa đầy đủ`. Khi người dùng lọc giữa tuần chưa kết thúc, có thể so lũy kế cùng số ngày, nhãn rõ `tuần này đến thứ N` vs `tuần trước đến thứ N`.
- Năng suất tháng phải sử dụng cùng `businessDate` cho sản lượng và giờ công; xử lý ca xuyên đêm rõ và tránh double count.

## 11. P&L, hòa vốn và chi phí

- Lãi góp đơn vị = giá bán thực thuộc CHIFAA − biến phí/đơn vị (theo snapshot, loại các khoản đã tính nơi khác).
- Hòa vốn: `ceil(fixedCosts / unitContributionMargin)` khi `margin > 0`; biên <=0 không có điểm hòa vốn theo mô hình, cần cảnh báo.
- P&L kỳ: netRevenueAccounting − COGS recognized − SX payroll expense − VP expense − Marketing − Fixed − Depreciation − Interest − Other. Dòng tiền = tiền thực thu − tiền thực chi ± vay/thu hồi nợ khác, không thay thế P&L.
- Kịch bản đổi giá/SL/hủy là **giả định**, không được lưu thành số thực tế hoặc thay bảng doanh thu đã chốt. Hiển thị rõ tham số đầu vào, assumptions và phiên bản.

## 12. Kiểm soát chốt ngày và sửa lịch sử

- `DRAFT → SUBMITTED → APPROVED/CLOSED`, trạng thái phụ `REOPENED/REVERSED` nếu có quyền; từ `CLOSED` không cho ghi đè giá trị trực tiếp, bắt buộc chứng từ điều chỉnh/đảo, tham chiếu nguồn cũ.
- `NEW`: tạo phiếu đầu ngày nếu chưa có; `BACKFILL`: thêm ngày cũ với chứng thực, lý do; `APPEND`: cộng delta/bổ sung ca/dòng; `REPLACE/CORRECT`: thay giá trị cuối cùng có log before/after.
- Cùng khóa ngày-điểm-món hoặc ngày-nhân viên-ca, thao tác không tự tạo trùng. Dùng unique business key phù hợp từng bảng, idempotency request, version optimistic; conflict có UI xem khác biệt chứ không silently overwrite.

## 13. Điều kiện chặn công bố KPI

Không công bố là số chính thức nếu: có #REF trong nguồn, thiếu giá thành/công thức, thiếu phiếu trong phạm vi mong đợi, thiếu tồn đầu/kiểm kê, thiếu ca SX hoặc phân bộ phận, công nợ không đối chiếu, hoặc đang ở mode demo. Hiển thị số đã biết kèm nhãn `tạm tính` nếu phù hợp, `INVALID_SOURCE`, `INCOMPLETE`, `READY`, `CLOSED` rõ ràng.

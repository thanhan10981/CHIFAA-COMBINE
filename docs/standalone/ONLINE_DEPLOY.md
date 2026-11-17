# CHIFAA DEV online — Vercel + Supabase

Người dùng đã yêu cầu triển khai DEV bằng URL online. Không cần chạy ứng dụng bằng localhost. Việc build và kiểm thử trên máy chỉ chuẩn bị bản triển khai; không phải địa chỉ dùng cuối cùng.

## Trạng thái đã kiểm tra

**Cập nhật sau deploy:** người dùng chạy SQL thấy Success và Vercel Ready. Domain `https://chifaa-combine-web.vercel.app` thực tế chuyển hướng sang `https://chifaa-combine.vercel.app`; dùng domain chính này cho APP_URL và OAuth. `/login` trả200, callback trả503 vì chưa đặt APP_URL. Supabase Google provider còn disabled. Thiết lập Vercel `NEXT_PUBLIC_APP_URL=https://chifaa-combine.vercel.app` cho Production rồi redeploy; Supabase Site URL cùngdomain, Redirect URL `https://chifaa-combine.vercel.app/auth/callback`. Sau đó bật Google và cấp Admin. Không chạy lại gói SQL. Những kiểm tra PGRST205 phía dưới là trước khi người dùng chạy SQL; probe mới anonymous materials trả401/42501.

- Project Supabase DEV do người dùng vừa tạo: dịch vụ Auth trả HTTP 200 bằng cấu hình hiện có. Không in key vào log.
- REST `materials` trả PGRST205: chưa có schema CHIFAA tại thời điểm kiểm tra, không coi là đã kết nối nghiệp vụ.
- Đã push mã Next.js và cấu hình triển khai lên nhánh `chifaa-next-dev` của `thanhan10981/CHIFAA-COMBINE` (commit abcdf91). Nhánh main remote giữ nguyên; import đúng nhánh DEV này vào Vercel.
- Chưa có phiên CLI Vercel/Supabase trong môi trường công cụ; trình duyệt không có phiên có thể điều khiển. Người dùng thực hiện các bước đăng nhập trên Dashboard.

## 1. Tạo database CHIFAA trên Supabase DEV mới

Tạo gói SQL từ migrations bằng `npm --prefix web run db:package`. File đầu ra là `output/CHIFAA_SUPABASE_DEV.sql`; không chứa key, mật khẩu hoặc dữ liệu lịch sử. Chỉ dùng cho DEV mới chưa cài CHIFAA.

Trên đúng project DEV: mở **SQL Editor → New query**, dán toàn bộ nội dung file SQL rồi **Run**. Gói chạy trong một transaction và dừng nếu đã có schema CHIFAA. Nếu báo lỗi, giữ nguyên thông báo, không xóa bảng và không chạy sửa tay theo phỏng đoán. Nếu thành công, kiểm tra Table Editor có các bảng `profiles`, `materials`, `products`, `stores` và những bảng nghiệp vụ liên quan.

**Lịch sử migrations:** chạy SQL Editor không tự đăng ký phiên bản vào lịch sử Supabase CLI. Không chạy `db push` thẳng sau bootstrap. Khi đã có CLI và quyền DEV, kiểm tra đầy đủ schema, đối chiếu từng migration trong gói rồi dùng `supabase migration repair --status applied VERSION` cho đúng các phiên bản đã áp dụng, kiểm tra `migration list` và `db push --dry-run` trước các nâng cấp sau. Không sửa lịch sử nếu schema không khớp. [Tài liệu migrations](https://supabase.com/docs/guides/local-development/database-migrations).

## 2. Deploy Vercel từ GitHub

Mở Vercel → **Add New → Project**, chọn repository `thanhan10981/CHIFAA-COMBINE` và nhánh chứa mã Next.js DEV. Import đúng commit đã kiểm thử; nhánh `main` cũ trên GitHub có thể chưa chứa `web/`.

- Framework: **Next.js**.
- Root Directory: **web**. Không chọn `output`, không deploy file `CHIFAA_APP.html`.
- Install: `npm ci`.
- Build: `npm run build`.
- Output directory: giữ mặc định của Next.js.
- Environment Variables: nhập `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` theo file `.env.local` trên máy. Không đưa `.env.local` vào GitHub, không nhập secret/service role vào biến public.

Deploy lần đầu để nhận URL thật. Sau đó đặt `NEXT_PUBLIC_APP_URL=https://URL_VERCEL_THUC_TE` trong Settings → Environment Variables và redeploy. Không giữ `localhost` trong biến của bản online. Khi chưa có APP_URL đúng và OAuth chưa cấu hình, đăng nhập chưa được coi là hoạt động.

[Hướng dẫn import Git repository](https://vercel.com/docs/git), [Root Directory/build](https://vercel.com/docs/builds/configure-a-build), [biến môi trường Vercel](https://vercel.com/docs/environment-variables).

## 3. Google OAuth cho URL online

Trong Supabase Authentication → URL Configuration, đặt Site URL là URL Vercel chính xác, thêm `https://URL_VERCEL_THUC_TE/auth/callback` vào Redirect URLs. Trong Google provider, cấu hình OAuth client và secret tại Supabase; Google Cloud Authorized redirect URI dùng callback Supabase hiển thị, không dùng URL Apps Script cũ. Thêm origin ứng dụng online vào OAuth Web Client nếu yêu cầu. Không gửi secret qua chat.

[Hướng dẫn Google OAuth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

## 4. Admin và nghiệm thu

Tạo/invite đúng chủ hệ thống trong Supabase Auth. Chủ dự án cấp profile enabled và role admin theo UUID tài khoản thực, theo DEPLOYMENT_GUIDE.md. Sau đó kiểm tra tài khoản nội bộ, hai khách hàng thuộc hai điểm bán khác nhau, RPC/RLS, đăng xuất và ghi trùng trên DEV thật.

Đây là bản DEV còn các phân hệ đang hoàn thiện trong FEATURE_MATRIX.md. Không nhập JSON cũ hoặc công bố là bản doanh nghiệp hoàn chỉnh chỉ vì Vercel báo Ready. Chưa có dữ liệu thật được nhập trong quá trình đóng gói này.

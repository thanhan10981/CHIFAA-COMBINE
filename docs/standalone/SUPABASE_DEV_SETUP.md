# Tạo và kết nối Supabase DEV

Hiện chưa có Supabase DEV. Mã ứng dụng và kiểm thử PostgreSQL cục bộ không có nghĩa là đã kết nối cloud. Không cần đưa Client Secret, database password hoặc service key vào chat.

## 1. Tạo dự án riêng

Mở [Supabase Dashboard](https://supabase.com/dashboard), đăng nhập tài khoản sở hữu hệ thống, chọn New project. Đặt tên dễ phân biệt, ví dụ `chifaa-combine-dev`. Chọn tổ chức, vùng phù hợp và lưu database password riêng trên máy hoặc trình quản lý mật khẩu. Chờ database khởi tạo xong.

Không chọn project đang chứa dữ liệu thật. Tài liệu chính thức: [Next.js quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs).

## 2. Cấu hình ứng dụng trên máy

Trong màn hình Connect của project, lấy Project URL và publishable key. Tạo `web/.env.local` theo `web/.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Chỉ dùng publishable key ở frontend; tuyệt đối không thay bằng secret key hoặc service role. File `.env.local` đã được Git bỏ qua. Khởi động lại Next.js sau khi thay cấu hình. Không đưa file này vào commit hoặc ảnh chụp.

## 3. Áp dụng cấu trúc database

Sau khi cài Supabase CLI, thực hiện từ thư mục repository. Xem [hướng dẫn migrations](https://supabase.com/docs/guides/local-development/database-migrations). Kiểm tra cú pháp bằng `supabase --help` và `supabase db push --help` của phiên bản đã cài trước khi thực hiện.

```powershell
supabase login
supabase link --project-ref YOUR_DEV_PROJECT_REF
supabase migration list
supabase db push --dry-run
```

Đối chiếu project ref với DEV vừa tạo và danh sách migrations trong `supabase/migrations`. Chỉ khi đúng project DEV mới chạy `supabase db push`. Không dùng `db reset` với project cloud hoặc database có dữ liệu. Các bước này chưa được thực hiện trong phiên hiện tại vì chưa có project DEV.

## 4. Thiết lập đăng nhập Google

Trong Supabase Authentication → Providers, bật Google và nhập OAuth client dành riêng cho DEV. Dùng callback URL do Supabase hiển thị để đăng ký Authorized redirect URI trong Google Cloud. Đây là callback của Supabase, khác callback của ứng dụng Next.js.

Trong Authentication → URL Configuration, đặt Site URL là `http://localhost:3000`, cho phép redirect về `http://localhost:3000/auth/callback`. Khi được phép triển khai preview, thêm domain preview cụ thể sau. Hướng dẫn chính thức: [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google).

## 5. Cấp Admin đầu tiên

Tạo hoặc mời tài khoản Auth của chủ hệ thống trên Dashboard. Lấy UUID của tài khoản đã xác minh; chủ dự án dùng SQL Editor cấp profile enabled và role admin theo DEPLOYMENT_GUIDE.md. Không tự cấp quyền cho tài khoản đăng nhập đầu tiên và không dùng email thay UUID.

## 6. Chạy thử và kiểm chứng

Từ repository chạy `npm run verify`, sau đó `npm run dev`. Mở `http://localhost:3000` và kiểm tra bằng các tài khoản riêng: Admin, kế toán và hai khách hàng thuộc hai điểm bán khác nhau. Cần kiểm thử REST API/RLS, đăng xuất, hết hạn phiên, ghi trùng và rollback trên DEV thật trước nghiệm thu. Chưa đưa dữ liệu lịch sử vào ở bước này.

Đây là hướng dẫn chuẩn bị DEV, không phải xác nhận hệ thống đã sẵn sàng vận hành hoặc đã deploy public.

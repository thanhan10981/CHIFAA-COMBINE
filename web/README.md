# CHIFAA COMBINE — ứng dụng độc lập

Runtime mới: Next.js App Router/React/TypeScript/Tailwind; Supabase PostgreSQL/Auth/Data API/Edge Functions. Không dùng Apps Script, Sheets hoặc Drive trong runtime.

```powershell
cd web
npm ci
Copy-Item .env.example .env.local
# Điền URL + publishable key của Supabase DEV, không dùng PROD.
npm run dev
```

Migrations: `../supabase/migrations`. Từ root repository chạy Supabase CLI sau khi đã cài Docker: `supabase start`, rồi `supabase db reset --local` **chỉ trên DB local dùng thử**. Không chạy reset trên cloud/production. Seed nghiệp vụ mặc định tắt.

Kiểm tra: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Sinh types từ migrations đã áp dụng trong PostgreSQL nhúng: `npm run db:types`. Khi có cloud DEV, đối chiếu bằng `supabase gen types typescript --project-id <DEV>`; không tự dùng credential PROD.

Hiện chưa có Supabase DEV do người dùng xác nhận. `/login` và `/app` hiển thị trạng thái chưa kết nối. Không có fixture giả làm dữ liệu thật. Các route nghiệp vụ chưa triển khai được ghi rõ và chưa mở ghi.

Xem `../docs/standalone/ARCHITECTURE.md`, `../DEPLOYMENT_GUIDE.md` và checkpoint mới nhất trong `../HANDOFF.md`.

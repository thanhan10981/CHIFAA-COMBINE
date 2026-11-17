# CHIFAA standalone — kiến trúc và audit P0/P1

Đặc tả chính đọc đầy đủ từ file người dùng cung cấp, lưu nguyên bản tại `web/MASTER_SPEC.md`. Mục tiêu mới thay thế runtime cũ; các checkpoint Apps Script trong tài liệu gốc chỉ là lịch sử, không phải kế hoạch phát triển mới.

## Ranh giới

- `web/`: Next16 App Router, React19, TypeScript6 (ghim vì ESLint chưa hỗ trợ TS7), Tailwind4, TanStack Query. Root Vercel là `web`.
- `supabase/migrations`: PostgreSQL là nguồn chuẩn duy nhất. CRUD danh mục qua Data API/RLS để đọc, RPC để ghi; Edge dùng cho invite và đặc quyền Auth.
- `private` schema không expose Data API; mọi SECURITY DEFINER có search_path rỗng và kiểm tra quyền người gọi ở entrypoint. API role không được ghi trực tiếp bảng nghiệp vụ/quyền.
- `profiles.enabled` và quyền được đọc tại DB mỗi lần, không tin role/user ID từ client. Người mới có profile disabled. Admin đầu tiên được cấp từ CLI/SQL owner riêng, không hardcode email.
- RPC idempotency row khóa theo (actor,key), fingerprint payload và operation; replay cùng nội dung trả ACK cũ, đổi payload từ chối. Audit và data_versions cùng transaction. Lỗi rollback cả dữ liệu/audit/idempotency.
- `/app` và `/portal` có layout riêng. Chưa bật một phiên Admin vì cơ chế revoke Supabase session và test song song chưa hoàn tất.
- Query cache RAM gắn user ID, module và tham số; logout signOut rồi xóa cache, điều hướng toàn trang để bỏ cây giao diện riêng tư. Không cache business data trước xác thực.

## Audit nguồn

Đã rà schema/domain/workflows cũ và các quyết định tài chính. Hai Excel gốc được đọc lại ở chế độ read-only, SHA256 không đổi; evidence trong `output/legacy-2026-11-17/postgres-source-audit.json` (ignored). Nguồn vận hành có IMPORTRANGE/#REF!, giá/quy cách mâu thuẫn; không dùng cached0 làm dữ liệu chuẩn.

Các quyết định mới trong đặc tả về phần điểm bán tự chịu/hỗ trợ thu hồi đang ghi chưa chốt, trong khi hội thoại cũ có quyết định. Không tự mang quyền hạch toán cũ sang hệ thống mới: chặn posting doanh thu những phần này tới khi policy mới được xác nhận. Mẫu số Food32,2% và labor15% vẫn là doanh thu thuần, không phải dòng tiền. Lãi vay chỉ nhập tay.

## Kiểm thử và giới hạn

PGlite chạy PostgreSQL thực qua WASM, apply migration từ DB trống và SET ROLE/auth.uid stub. Nó kiểm chứng SQL/RLS/rollback của migrations, không kiểm chứng hosted Supabase JWT, Google OAuth, Realtime, Storage, Edge, pooler hoặc nhiều kết nối đồng thời.

Chưa có Supabase cloud DEV, Docker/psql/Supabase CLI trên máy. Không gọi trạng thái này là kết nối DB cloud thành công. Những schema tài chính chưa có RPC/UI vẫn chưa phải chức năng hoàn chỉnh.

Nguồn kỹ thuật đã đối chiếu: https://supabase.com/docs/guides/auth/server-side/creating-a-client ; https://supabase.com/docs/guides/database/postgres/row-level-security ; https://nextjs.org/docs/app/getting-started/proxy .

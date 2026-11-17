# CHIFAA standalone application

Read MASTER_SPEC.md and ../HANDOFF.md before changes. The new runtime is Next.js/Supabase only. Never import ../src/server, call Apps Script, or read workbooks during web requests.

Business writes require scoped PostgreSQL RPC, transactions, live permission checks, idempotency and audit. Unknown price/minimum stays null. Use exact SQL numeric/bigint for financial calculations; API financial results must be decimal strings.

Run typecheck, lint, tests and build for each checkpoint. Database tests use real embedded PostgreSQL (PGlite) with local auth stubs; this is not Supabase cloud/Auth/Storage/Realtime UAT. Do not claim cloud connection or all modules complete.

Do not deploy public, connect PROD, seed business samples, or migrate real historical data without the required authorization. No service key in frontend. Keep workbook inputs unchanged and private data under ignored output/.

# DEV caching and loading feedback

Implemented 2026-11-16, deployed version 10.

- Normal report/record navigation uses the authorized dataset already in RAM. It does not reload Sheets for each sidebar click.
- Bootstrap can reuse a server snapshot for up to 30 seconds. Its key includes workbook ID, sync stamp, accounting approval, email, role, permissions and permission version. Every request still checks the current session, signature, durable replay ledger and current `_Users` row before consulting this cache.
- Snapshots conservatively bounded to under 90 KB (using the UTF-8 worst-case bound) are cached. Larger snapshots, expired/evicted/corrupt entries and cache service failures fall back to Sheets. No Google tokens or session signing keys are included in snapshot entries.
- Writes change the sync stamp. A snapshot assembled across a concurrent write is not cached. Manual **Dong bo** bypasses the snapshot cache; direct Sheet edits without a stamp update can otherwise remain cached for up to 30 seconds.
- Business records remain in browser RAM only. Subsequent session-restoration work persists only an opaque application session ID, non-exportable CryptoKey and expiry in IndexedDB; reload revalidates signed authentication on the server. See SESSION_RESTORE.md.
- The app shows contextual spinners for login preparation, bootstrap, saving, administration, audit, export and Portal requests. Administration/audit screens show a skeleton while awaiting data. Existing records remain visible during refresh. Failures/timeouts clear the loading indicator and retain error handling.
- Background sync skips hidden pages, overlapping sync and active foreground requests. Expired replay nonces are removed in contiguous batches under the existing lock. Duplicate record ID checks now use a per-table frequency map rather than rescanning the table for every row.

Validation: 107 automated tests, syntax check and build pass. Tests cover cache isolation, permission changes without a version bump, disabled/revoked users, replay rejection, expiration/corruption/eviction, oversized snapshots, concurrent writes, nonce preservation, concurrent loading indicators, failure cleanup, stale page responses and sync overlap. A mocked cache hit avoided all 17 business table reads; this is not an end-to-end Google latency measurement. Local headless Chrome screenshot: `output/performance-loading.png`.

First loads, Google authorization and Apps Script cold starts still require network time. Large workbooks may need pagination or incremental module loading later. Live Admin/accountant latency and two-Google-account permission UAT remain pending; no production deployment or workbook ACL changes were made.
## Startup timeout correction (2026-11-16)

The client previously stopped waiting after 25 seconds for every RPC, including cold startup. Bootstrap now allows 90 seconds, normal reads/OAuth preparation60 seconds, business writes90 seconds and maintenance180 seconds. Timeout is not a latency target. Read/auth timeouts explain connection retry; only writes retain the uncertain-result warning. Saved-session restoration is preserved on network/timeout errors, and no mutation is retried automatically. Spinner remains active until completion or timeout.

Within each RPC, db_ reuses one workbook handle per spreadsheet ID and clears it in finally. This avoids opening the same workbook repeatedly without caching identity, grants or rows across requests. Mock tests verify one open for a forced full bootstrap and fresh opens on subsequent RPCs/error cleanup. Real hosted startup timing remains unmeasured.


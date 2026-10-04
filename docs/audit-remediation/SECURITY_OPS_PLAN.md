# Security and operations plan (Lane F)

Evidence class: SOURCE and LOCAL BUILD only. Nothing here was applied to a remote project, sent, or configured at a provider.

## 1. CSP (Report-Only, applied locally)

- `next.config.ts` now sends `Content-Security-Policy-Report-Only` on every route. Verified on the local production build: the header is present on `/`.
- Policy: `default-src 'self'`; `script-src 'self' 'unsafe-inline' 'unsafe-eval'`; `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`; `font-src 'self' https://fonts.gstatic.com data:`; `img-src 'self' data: blob: https:`; `connect-src 'self' https://*.supabase.co wss://*.supabase.co`; `frame-src 'self'`; `frame-ancestors 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`.
- Browser check on the landing page: no Report-Only violation was logged in the console. The read covered the landing page only, not the authenticated surfaces.
- `script-src` keeps `'unsafe-inline'` and `'unsafe-eval'`. The Next.js runtime needs them today. Removing them requires a nonce set in middleware, which is a separate change.
- Report endpoint: none created. A `report-uri` or `report-to` target would be a public, unauthenticated write endpoint. Before one is added it needs a size cap, a rate limit, and a decision on where reports go. Browsers send `application/csp-report` or `application/reports+json`.
- Enforcement (`Content-Security-Policy`) is not enabled. It needs reports from production first.

## 2. Monitoring

- No error-monitoring or analytics provider is configured in this repo. `package.json` has no Sentry, Datadog, or similar dependency. The only telemetry is `console.error` in server code.
- An adapter needs an owner decision on a provider, and a new dependency, before any code. Not built here.
- Candidate events for that adapter, all already logged or returned as status codes: rate-limit 429s (`/api/auth/*`, `/api/tv/connect`, `/api/ai/*`), cue-sheet import rejections (400 and 500 from `/api/cue-sheet/upload` and `/api/ai/cue-sheet-import/commit`), `provisionDisplayTypeRows` failures, hold readback mismatches, reset requests (generic, counts only), and CSP Report-Only violations once an endpoint exists.

## 3. Runbook (draft, for the operations owner)

1. Hold or timer action returns 500 with "Something went wrong": check the server log for `[hold] readback mismatch` or `[hold] provisioning failed`. Confirm the event has four `display_type_state` rows (`select display_type from display_type_state where event_id = '<id>'`). Read-only; do not write.
2. Import returns "Import failed. Nothing was changed.": the server log has `[cue-sheet import] rpc failed` with the Postgres error message. Nothing is partially written; the transaction rolled back.
3. Users report reset links that do not arrive: check the Supabase auth log for the reset request and the Resend delivery log. Confirm the Supabase Site URL and redirect allowlist (see CANONICAL_ORIGIN_PLAN.md).
4. Locked out after repeated logins: the rate limiter is per IP. Wait for the lockout (30 s, doubling, capped at 5 min) or run the recorded reset path.

## 4. RLS, advisors, backups (external; not run here)

- Supabase security and performance advisors: run from the Supabase dashboard against the target project, read-only. Not run in this lane (no remote operations were authorised).
- RLS: policies live in `supabase/migrations`. The service-role client bypasses RLS, so the route-level checks (`requireEventAccess`, `verifySessionAccess`) are the real boundary. Verify both on the target project.
- Backups and point-in-time recovery: confirm the plan tier and retention in the dashboard. Restore testing is a separate, owner-approved exercise. No restore was performed.

## 5. Email and DNS (external; not run here)

- Resend is used by `lib/server/email.ts`. The sender in `.env.example` is on the `kramflow.me` domain.
- Plan (not executed): verify the sending domain's SPF, DKIM, and DMARC records at the DNS provider, confirm the reset and invite templates in Resend, and send a test only to an owner-controlled address after approval.
- No DNS record, template, or mail was changed or sent.

## 6. SheetJS parser limits (implemented locally)

- Version pinned in `package.json` from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Advisories GHSA-4r6h-8v6p-xvw6 (CVE-2023-30533, below 0.19.3) and GHSA-5pgg-2g8v-p4x9 (CVE-2024-22363, below 0.20.2) do not apply to 0.20.3.
- Limits, all enforced: 10 MB file (`app/api/cue-sheet/upload/route.ts`, `lib/server/document-text.ts`), 50 sheets, 5000 rows per sheet.
- Added: `XLSX.read(..., { sheetRows: MAX_ROWS_PER_SHEET + 1 })` in both readers, so decoding stops one row past the cap. Tests in `lib/parse-cuesheet-limits.test.ts` use real workbooks written by SheetJS: one row over the cap is rejected, the cap itself is accepted, and 51 sheets are rejected.
- Residual risk: a small compressed file that expands far beyond 10 MB is not bounded by these checks. SheetJS does not expose an uncompressed-size limit. The mitigation is a size check on the decompressed archive before `XLSX.read`, which is not built here.

## 7. Items that stay external

- Supabase migration apply for `20260930000000_import_cue_sheet_atomic.sql` and `20260909091740` provisioning (see `docs/audit-remediation/migrations`).
- Provider choices: monitoring, CSP report endpoint, DNS and Resend changes.
- Legal review of anything in `docs/legal/`.

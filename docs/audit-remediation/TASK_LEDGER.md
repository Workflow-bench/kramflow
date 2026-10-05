# Task Ledger

Canonical, readable ledger for the KramFlow audit remediation project. See `TASK_LEDGER.json` for the machine-readable mirror (now the primary source of truth — all 42 parent rows have complete master-required fields, with totals and cross-references to `SOURCE_COVERAGE.json` machine-verified by `validate_ledger.mjs`), `SOURCE_COVERAGE.md`/`SOURCE_COVERAGE.json` for the full source-report-to-ledger mapping (B003), `BASELINE.md` for environment/reconciliation, `DECISIONS.md` for reasoned bounded choices, `REVIEWS/` for verbatim independent reviews, and `batches/` for per-batch review artifacts.

**B003 update:** `KF-022`/`KF-033` moved from `NOT_APPLICABLE` to a new `PRESERVE_PENDING_REVIEW` state (they are passing behavior to re-verify on touch, not inapplicable items). `KF-032`/`KF-035`/`KF-036` were split into independently checkable child criteria (parent ids preserved, see `TASK_LEDGER.json`). Six new rows were added — `KF-037` (repository/engineering quality-gate preserve-passing baseline), `KF-038` (structured-data/schema, optional), `KF-039` (AI-bot business-policy decision), `KF-040` (PRD completeness), `KF-041` (operator-tool inventory), `KF-042` (a 9-child roll-up of checklist rows the original audit already marked N/A but that had no ledger row before B003). Corrected totals below are machine-derived; run `node validate_ledger.mjs` to reproduce.

**Status vocabulary** — Evidence class: `LIVE` / `SOURCE` / `TEST` / `STANDARD` / `INFERENCE`. Observation: `PASS` / `FAIL` / `PARTIAL` / `UNVERIFIED` / `N/A`. Implementation state: `OPEN` / `INVESTIGATING` / `IN_PROGRESS` / `READY_FOR_CODEX` / `NEEDS_REWORK` / `BLOCKED_EXTERNAL` / `CODEX_VERIFIED` / `NOT_APPLICABLE`. Only an actual returned independent review sets `CODEX_VERIFIED` — nothing in this ledger is self-set to that state.

---

## B002 — this batch (Phase 1 security rework)

### KF-001 — Viewer/editor can mutate operational display state (source: SEC-02; addendum; master prompt item 10)

- **Category:** B (Security)
- **Priority:** P1
- **Evidence class:** LIVE + SOURCE + TEST
- **Observation:** was FAIL (B001 PARTIAL — hold/timer fixed, speaker-ready and broadcast-dismiss not); now PASS for hold/timer/speaker-ready/broadcast-dismiss authorization; UNVERIFIED for the pre-existing hold/timer *persistence* defect (see KF-031)
- **Desired behavior:** owner operates the live show (hold, timer, speaker-ready, broadcast dismiss — all shared operational/display state); editor edits permitted cue data only; viewer reads only. No named exception without an explicit, separately-approved product requirement.
- **Affected files:** `lib/server/verify-display-access.ts`, `lib/server/require-broadcast-display-access.ts`, `app/api/display-engine/hold/route.ts`, `app/api/display-engine/timer/route.ts`, `app/api/display-engine/speaker-ready/route.ts`, `app/api/display-engine/broadcasts/[id]/dismiss/route.ts`, `app/e/[eventId]/remote/page.tsx`, `components/display-engine/broadcast-overlay.tsx`
- **Implementation (B002):**
  - `verifySessionAccess(eventId, minRole = "viewer")` — added in B001, unchanged in B002.
  - `speaker-ready` now passes `"owner"` (was left at default `"viewer"` in B001 — reversed, see `DECISIONS.md`).
  - `requireBroadcastSessionAccess(broadcastId, eventId, minRole = "viewer")` — new optional param in B002; `dismiss` passes `"owner"`.
  - Remote page: `OWNER_ONLY_NOTE` copy corrected (no longer claims speaker-ready is an exception); the Speaker Ready button now wrapped in the same `MaybeTooltip`/`disabled={!isOwner}` pattern every other owner-only control on that page already uses. A denied (non-owner) user still sees the current ready/not-ready state via the button's own text — read access preserved.
  - `broadcast-overlay.tsx`'s Dismiss button deliberately **not** made role-aware (see `DECISIONS.md` — `EventRoleContext` defaults to `"owner"` outside `<EventRoleProvider>`, which these public display pages never provide; a naive fix would be silently wrong). Server-side `"owner"` requirement is the real boundary; documented in the component's own comment.
- **Tests:**
  - `app/api/display-engine/token-authority.test.ts` — updated: all four cases (`timer`, `hold`, `speaker-ready`, `broadcast dismiss`) now assert `minRole: "owner"`; wiring-level proof only (requireEventAccess mocked), documented as such in the file's own comment.
  - `app/api/display-engine/owner-floor-matrix.test.ts` (**new**, B002) — real, unmocked `verifySessionAccess`/`requireEventAccess` logic against a controlled DB fixture, driving the real hold/timer/speaker-ready route handlers. 5 identities (owner/editor/viewer/unrelated-authenticated/anonymous) × 3 routes = 15 tests. Denied identities assert zero writes; owner asserts exactly one write to the correct table.
- **Live evidence (LIVE, B002):** using disposable `.test`-TLD fixtures in the already-authorized dev Supabase project (see `DECISIONS.md`):
  - Real viewer session → `hold`/`timer`/`speaker-ready` all `403 {ok:false,error:"Unauthorized"}`.
  - Real editor session → same three all `403`; `dismiss` (against a non-existent broadcast id) → `404 {error:"Broadcast not found"}` (the route's existing anti-enumeration shape, unchanged); `GET /api/display-view` → `200` (denied-role read access preserved, live-confirmed).
  - Real owner session → `speaker-ready` PATCH `200`, and **persistence independently confirmed**: a probe value (`owner-persist-probe`) was absent from a `GET /api/display-view` read before the write and present after — not just a `200` status assumption. Cleaned up afterward.
- **Remaining risk:** the hold/timer **persistence** defect (missing `display_type_state` row → `500 PGRST116` on deactivate, silent no-op-that-reports-success on activate) is real, pre-existing, and unrelated to authorization — see `KF-031`. This criterion's *authorization* boundary is PASS; its *persistence* guarantee for hold/timer specifically is UNVERIFIED/PARTIAL, not folded into a blanket PASS, per the review's explicit instruction.
- **Implementation state:** READY_FOR_CODEX
- **Independent review:** the R1 finding above is B002's response to the review in `REVIEWS/2026-09-30_KRAMFLOW_CODEX_PHASE1_REVIEW.md`. Not yet re-reviewed.
- **History:** B001 (hold/timer fixed, speaker-ready/dismiss not) → Codex review (NEEDS_REWORK) → B002 (speaker-ready + dismiss fixed, real-guard integration tests added, live matrix evidence gathered).

### KF-002 — `must_change_password` not enforced on all authenticated-user API paths (source: SEC-03; addendum; master prompt item 11)

- **Category:** B (Security)
- **Priority:** P1
- **Evidence class:** SOURCE + TEST (live-runtime UNVERIFIED for the specific fix in this batch — see below)
- **Observation:** was FAIL (B001 PARTIAL — shared guards fixed, invite-accept not); now PASS at the code/unit-test layer for all three surfaces (`requireAuthUser`, `requireEventAccess`, invite-accept)
- **Desired behavior:** a flagged session can only log in, log out, or replace its password. Every other authenticated-user operation — event reads, invite acceptance, cue edits, exports, live/stage writes — fails until the flag clears.
- **Affected files:** `lib/server/require-auth.ts`, `lib/server/require-event-access.ts` (both B001, unchanged in B002 beyond a corrected comment), `app/api/invites/[token]/accept/route.ts` (B002)
- **Implementation (B002):** `requirePasswordCurrent()` (B001) now also called from the invite-accept route, positioned after authentication but before `resolveInvite()` runs (so a flagged caller learns nothing about token validity either). Corrected the B001 comment in `require-auth.ts` that had wrongly asserted invite-accept was an intentional exception (Standards finding in the review) — `set-password` remains the one real exception.
- **Full raw-`getUser()` audit (not import-count inference — every call site individually reasoned through):**
  | File | Classification |
  |---|---|
  | `app/api/auth/set-password/route.ts` | Correctly exempt — *is* the replace-password action |
  | `app/api/invites/[token]/accept/route.ts` | Was a bypass, **fixed in B002** |
  | `app/invite/[token]/page.tsx` | Read-only Server Component render; unreachable by a flagged session anyway (`proxy.ts` redirects every non-`/api/` path for a flagged user, and this page isn't exempted) |
  | `app/(operator)/dashboard/page.tsx`, `app/e/[eventId]/layout.tsx` | Same — protected pages, already unreachable by a flagged session via `proxy.ts` |
  | `lib/use-operator-presence.ts` | Client-side, browser Supabase client, cosmetic presence-name resolution only — not an API route, not a privileged action |
- **Tests:** `lib/server/require-auth.test.ts`, `lib/server/require-event-access.test.ts` (both B001, unchanged), `app/api/invites/[token]/accept/route.test.ts` (**new, B002**, 6 tests) — flagged-denial leaves `resolveInvite`/`update` uncalled (proves no membership mutation); unflagged correct-email acceptance succeeds; anonymous/wrong-email/expired/already-accepted behavior all unchanged.
- **Continuation UX verified (SOURCE, read not changed):** `proxy.ts` sets `next` to the original pathname (e.g. `/invite/<token>`) when redirecting a flagged user to `/set-password`; `lib/safe-redirect.ts`'s `safeNext()`/`isSafeRedirect()` already guards against open-redirect (`//`, `/\`) and falls back to `/dashboard`; `app/set-password/page.tsx` hard-navigates to that validated `next` after a successful password change. This was already correct before B002 — verified, not modified.
- **Stale-session handling:** both shared guards use `supabase.auth.getUser()` (re-validates against Supabase), not `getSession()` (would only decode the existing JWT) — already true before B002, re-confirmed applicable here: a stale cookie is checked against current server-side state, not trusted metadata baked into an old token.
- **Remaining risk / honestly UNVERIFIED:** a live-runtime proof of "a real flagged account's accept call is denied end-to-end" was **not obtained** in B002. An attempt to provision a disposable flagged test account + pending invite in the already-authorized dev project was blocked by this session's own permission classifier; per that tool's instruction it was not retried through another path. See `DECISIONS.md`. This criterion rests on direct unit tests against the real, unmocked route logic — solid evidence of the code's correctness, not equivalent to an observed live HTTP round-trip.
- **Implementation state:** READY_FOR_CODEX (code + unit evidence); the live-runtime sub-criterion is explicitly UNVERIFIED, not claimed.
- **History:** B001 (shared guards fixed, invite-accept wrongly treated as exception) → Codex review (NEEDS_REWORK, standards + spec finding) → B002 (invite-accept fixed, comment corrected, full raw-getUser audit completed).

### KF-003 — External API retains live-control paths despite Coming Soon (source: DEV-06; addendum; master prompt item 12)

- **Category:** B (Security / feature correctness)
- **Priority:** P1
- **Evidence class:** LIVE + SOURCE + TEST
- **Observation:** was FAIL (B001 PARTIAL — creation disabled, actions route untouched, "unconditional 423" claim was an overclaim); now PASS
- **Desired behavior:** credential creation disabled; every control action on an existing credential deterministically unavailable regardless of lease/no-op state; `GET /state` and owner list/revoke unaffected; no lease bypass, no deleted tokens to force a passing test.
- **Affected files:** `app/api/events/[eventId]/integrations/route.ts` (B001, unchanged in B002), `app/api/v1/events/[eventId]/actions/[action]/route.ts` (**rewritten, B002**), `components/forms/integration-credentials-panel.tsx` (stale comment corrected, B002), `docs/EXTERNAL_API.md` (rewritten, B002)
- **Root cause of the B001 overclaim (verified independently, not trusted from the review text alone):** `app/api/live/route.ts`'s `clientId` is `typeof body.clientId === "string" ? body.clientId : null` — read directly from the request body, unvalidated. An owner-authorized `claimControl` call can set `clientId` to the literal string `integration:<credentialId>` (the id is visible in `GET /integrations`'s JSON response, not secret), which then satisfies the lease check for that credential's *old* forwarded action. Confirmed by reading the code directly, line by line, not by trusting the review's assertion.
- **Implementation (B002):** the v1 actions route now returns `403 {code:"coming_soon"}` immediately after credential authentication (`requireIntegrationCredential`) succeeds — before any `live_state` read, no-op branch, or `runLiveAction` call. Deterministic for all four actions (`start`/`hold`/`resume`/`next`) regardless of lease, no-op, or clientId-collision state, because none of that code exists in this route anymore. Credential authentication itself (401 for missing/revoked/malformed/wrong-event/wrong-scope) is unchanged, checked first, so an invalid credential never learns whether the action would otherwise have been available.
- **Tests:** `app/api/v1/events/[eventId]/actions/[action]/route.test.ts` (**new, B002**, 17 tests) — all 4 actions × {plain valid credential, simulated no-op state, simulated matching-lease state} all resolve `403 coming_soon` with zero calls to `runLiveAction` or the DB; invalid credential still gets the original `401`, not `coming_soon`; unknown action still `404` before credential check.
- **Live evidence (LIVE, B002):** inserted a real, valid, non-revoked `integration_credentials` row directly (bypassing the disabled creation endpoint, exactly the scenario the review demanded be tested), then from a real owner session called all four actions with a real `Authorization: Bearer` header:
  - `start`/`hold`/`resume`/`next` → all `403 {code:"coming_soon"}`.
  - `GET /state` → `200`, unaffected.
  - An invalid token → `401`, unchanged.
  - `live_state.version`, `.paused_at`, and `.active_session_id` read before and after all four calls — **byte-identical**, direct proof of zero live-state mutation, not an inference from the HTTP status alone.
  - Revoked the test credential via the real `DELETE /api/events/[eventId]/integrations/[id]` endpoint afterward — `200`, confirming revoke is unaffected and exercising that path for real.
- **Remaining risk:** none identified for this narrow scope.
- **Implementation state:** READY_FOR_CODEX
- **History:** B001 (creation disabled, actions route unchanged, "unconditional 423" claim) → Codex review (NEEDS_REWORK, clientId-collision + no-op-200 findings) → B002 (actions route gated unconditionally, live-verified against a real credential including the no-op and lease-collision scenarios).

### KF-031 — Hold/timer missing-row false-success / deactivation failure (new in B002, per review's explicit instruction to track it)

- **Category:** B (Correctness)
- **Priority:** P2
- **Evidence class:** LIVE (B001) + SOURCE (review's own confirmation this is pre-existing)
- **Observation:** FAIL (reproduced), classified OPEN — not fixed, not folded into KF-001's PASS
- **Desired behavior:** to be defined in a future batch — either deterministic `display_type_state` row initialization at event creation, or both activate/deactivate fail loudly (not `200`) when no row exists, verified via a post-write database readback rather than trusting the write call's own success.
- **Affected files:** `app/api/display-engine/hold/route.ts`
- **Dependency:** none blocking. Should land before Hold/Timer ever gets real UI (currently zero call sites, confirmed by grep in both B001 and B002).
- **Implementation state:** OPEN
- **History:** discovered live in B001 while verifying the owner-success path for KF-001; independent review confirmed it is consistent with pre-existing source behavior, not introduced by either batch, and instructed it be tracked as a stable open item rather than silently folded in or fixed inline. See `BASELINE.md` for full detail.

---

## Not started — carried forward from the original enumeration (unchanged by B002; every row from the source reports remains accounted for, none dropped)

Status `OPEN` unless noted. Full source citations are in the seven original reports; only the summary + master-prompt item number is repeated here to keep this ledger from re-deriving the entire audit.

### A. Visual / UI / UX

| ID | Title | Source | Priority |
|---|---|---|---|
| KF-004 | Rehearsal completion unreachable at final cue | UX-01 | P1 |
| KF-005 | Rehearsal exit UX (unnecessary confirm / no summary) | UX-02 | P2 |
| KF-006 | Import-to-start UX / atomic import | UX-04 / DEV-07 | P1 |
| KF-015 | Logout icon (Lock → LogOut) | UX-03 | P2 |
| KF-016 | Logout destination (`/login` → `/`) | UX-03 | P2 |
| KF-017 | Login/recovery UX (forgot password, show/hide) | UX-05 | P2 |
| KF-018 | Navigation/first-run clarity (Event→Session→Console) | UX-06 | P2 |
| KF-019 | Landing contrast — **27 desktop entries, not 10** (see `BASELINE.md`) | UX-07 | P2 |
| KF-020 | Skip-to-content + full accessibility sweep | master item 8 | P2 |
| KF-021 | Duplicate responsive headings in the DOM | UX-08 | P3 |
| KF-032 | Footer copyright year + full loading/error/success/empty-state, hover/touch, destructive-confirm, copy-control, broken-link, cue-sheet print/report, mobile-overflow sweep | UX-08 (master prompt item 9 — explicitly named by the review as missing its own row) | P3 |
| KF-022 | Homepage `/#one-cue` fragment navigation | master §4 | — | **PASS, `PRESERVE_PENDING_REVIEW` (B003; was `NOT_APPLICABLE`).** Standard, accessible, shareable in-page navigation; explicitly not a defect. `applicability` stays `applicable`; this state is not an independent-review approval. |
| KF-033 | Preserve-passing regression set: Lucide icon consistency, custom brand-mark exceptions, labeled responsive menu, clear primary CTA, reduced-motion support, desktop Lighthouse 100/LCP 0.6s, HTTPS/HSTS/security headers, canonical/robots/sitemap/favicon/title baseline, branded 404 | master §4 | — | **PASS, `PRESERVE_PENDING_REVIEW` (B003; was `NOT_APPLICABLE`).** No batch has touched these; re-verify on every future batch that could plausibly affect them. |
| KF-037 | Repository & engineering quality-gate baseline (DEV-05 + project/engineering-setup checklist) — new in B003 | DEV-05 | P3 | `PRESERVE_PENDING_REVIEW`, PASS. |
| KF-038 | Structured data / JSON-LD schema (Organization/SoftwareApplication) — new in B003 | FA checklist | P3 | `OPEN`, optional/truthful-only enhancement. |
| KF-039 | AI search-bot business policy decision — new in B003 | FA checklist | P3 | `OPEN`, conditional, needs a product/legal decision. |
| KF-040 | PRD/value-prop/ICP/non-goals completeness audit — new in B003 | FA checklist | P3 | `OPEN`, documentation task. |
| KF-041 | Operator tool/plugin inventory for release — new in B003 | FA checklist | P3 | `OPEN`, documentation task. |
| KF-042 | 9-child roll-up: FAQ schema, llms.txt, author bylines, dark-mode toggle, site search, back-to-top, scroll progress, last-updated date, floating contact — new in B003 | FA checklist (multiple rows) | — | `NOT_APPLICABLE` (each child independently and explicitly N/A per the original audit). |

### B. Development / Function / Security / Performance

| ID | Title | Source | Priority |
|---|---|---|---|
| KF-007 | Live-action API session/event invariant validation | DEV-03 | P1 |
| KF-008 | Canonical production origin (`app.kramflow.me`) | DEV-01 | P1 |
| KF-009 | Content-Security-Policy (report-only → enforced) | SEC-01 | P1 |
| KF-010 | Production error monitoring | DEV-04 | P1 |
| KF-011 | `/privacy` and `/terms` | LEG-01 | P1 |
| KF-012 | Email authentication (SPF/DKIM/DMARC, delivered-header verification) | EMAIL-01 | P1 |
| KF-013 | RLS/role/revocation production release gate | SEC-04 | P1 gate — BLOCKED_EXTERNAL (needs 2+ real accounts + prod/Supabase dashboard access) |
| KF-014 | Backups/recovery drill | master item 21 | P1 gate — BLOCKED_EXTERNAL (needs Supabase dashboard access) |
| KF-023 | Mobile landing LCP (median ≤2.5s target; two cold runs + two desktop, real LCP element/request) | master item 23 | P2 |
| KF-024 | Social preview (OG/Twitter) image | master item 26 | P2 |
| KF-025 | `/dev/components` public exposure | master item 25 | P2 |
| KF-026 | Route metadata/canonical/OG/indexing/sitemap per-route intent | master item 25 | P2 |
| KF-027 | Analytics/UTM acquisition measurement | master §4 | — | N/A unless a measurement/consent plan is separately approved. |
| KF-028 | Cookie banner / Consent Mode / GPC | master §4 | — | N/A — no non-essential tracking exists. |
| KF-029 | One-click unsubscribe on transactional invite mail | master item 19 | — | N/A — transactional only; revisit only if bulk/marketing mail is added. |
| KF-030 | Phone/SMS consent | master §4 | — | N/A — no phone/SMS flow exists. |
| KF-034 | Dependency/SheetJS direct-version audit (zero `npm audit` findings does not clear this — distinct from general dependency scanning) | master item 22 (SEC-08) — review's R4 finding named this as a missing row | P2 |
| KF-035 | Rate-limit/secrets/build-artifact verification in controlled staging (429/backoff, generic errors, trusted-proxy-IP, fail-open monitoring, built-artifact secret scan) | master item 22 (SEC-05/06) — review's R4 finding | P1/P2 mixed, mostly gated on controlled staging access |
| KF-036 | Authenticated app performance/reliability gates: dashboard/cue-sheet/session-start/rehearsal/import/realtime-display profiling on representative data; offline/reconnect; controller competition/expiry/takeover; burst; documented-duration soak; staging parity/rollback readiness | master item 24 — review's R4 finding named this whole cluster as missing | P2, gated on defining dataset/device/network budgets first |

---

## Totals (B003 end-of-batch snapshot — machine-derived, see `validate_ledger.mjs`)

- READY_FOR_CODEX: 3 (KF-001, KF-002, KF-003)
- OPEN: 29 parent rows
- PRESERVE_PENDING_REVIEW (passing behavior, re-verify on touch, not independently verified by this state): 3 rows (KF-022, KF-033, KF-037)
- NOT_APPLICABLE: 5 rows (KF-027, KF-028, KF-029, KF-030, KF-042)
- BLOCKED_EXTERNAL: 2 (KF-013, KF-014)
- CODEX_VERIFIED: 0 — no row has ever received an independent approval yet.

Total parent rows: 42 (36 carried forward from B002 + 6 new: KF-037..KF-042). Separately, 28 child criteria exist under the 3 split composite parents (KF-032: 8, KF-035: 3, KF-036: 8) plus KF-042's 9-child roll-up: 18 `OPEN`, 10 `NOT_APPLICABLE` at the child level — see `TASK_LEDGER.json#child_criteria_breakdown`.

No row has been deleted, had its priority reduced, or had its acceptance criteria redefined to reach this count. "Everything complete" is not being claimed — see `batches/B003/BATCH_REPORT.md`'s Verdict/Pause section.

## B009 reconciliation (2026-10-04, integration branch `integrate/ui-revamp-landing`)

The JSON ledger (`TASK_LEDGER.json`) is the primary source. The totals snapshot above stays at B003 and is not rewritten. Machine totals in the JSON were recomputed and `validate_ledger.mjs` passes.

State changes recorded in the JSON `history` field, with evidence links:
- READY_FOR_CODEX (awaiting independent review, not verified): KF-001 (owner floor), KF-026 (metadata and robots).
- IN_PROGRESS (partial, local evidence only): KF-004, KF-005 (synthetic harness), KF-006 (local Postgres races), KF-007 (traversal and session selection), KF-010 (local reporting), KF-017 (set-password tests, toggle, expired link), KF-019 (contrast inventory reconciliation), KF-020 (skip link, reflow, login landmark), KF-021 (AX tree headings), KF-023 (performance, both series reported separately, target not met on simulated), KF-034 (archive and reporting tests).
- Unchanged: BLOCKED_EXTERNAL, PRESERVE_PENDING_REVIEW, NOT_APPLICABLE rows.

No item is CODEX_VERIFIED. `independent_review` fields are unchanged. Review decisions belong to Codex.

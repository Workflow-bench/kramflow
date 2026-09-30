# KramFlow Audit Remediation Tracker

Canonical state file for the `KRAMFLOW_AUDIT_PACKAGE.zip` remediation project. Every applicable audit finding is a row below. Never delete a row — if Codex (or anyone) rejects a fix, move it back to `CODEX REJECTED` and record why; don't remove history.

Source audit window: 2026-09-27–28, against local checkout HEAD `02669143dcd7677efb7c6ed83bc7b23d056780a6`. This tracker's own work started from `e39cc830c83f6bf4e2a5afe499bf32e009721260` (current `main` at the time — 24 commits ahead of the audited HEAD; none of those 24 touched the files this batch changes, confirmed by `git log --oneline 0266914..e39cc83` before any edit).

Status values: `NOT STARTED` · `IN PROGRESS` · `IMPLEMENTED - NEEDS VERIFICATION` · `CLAUDE VERIFIED - NEEDS CODEX` · `CODEX APPROVED` · `CODEX REJECTED` · `BLOCKED - EXTERNAL` · `N/A` · `ALREADY FIXED - VERIFIED`.

---

## Phase 1 — Authorization & Auth Boundaries (this batch)

### KF-001 — Viewer/editor role can mutate operational display state (audit SEC-02)

- **Audit priority:** P1
- **Audit status:** FAIL
- **Current status:** CLAUDE VERIFIED - NEEDS CODEX
- **Category:** Authorization
- **Affected route/component:** `app/api/display-engine/hold/route.ts`, `app/api/display-engine/timer/route.ts`, `app/api/display-engine/speaker-ready/route.ts`, `lib/server/verify-display-access.ts`
- **Audit evidence:** `lib/server/require-event-access.ts:5-15` (role contract), `components/forms/event-settings-panel.tsx` ("Editors can edit the cue sheet but can't run the live show. Viewers can only look."); hold/timer/speaker-ready PATCH routes all called `verifySessionAccess()`, which hard-coded `requireEventAccess(eventId, "viewer")` with no way to ask for more.
- **Implementation notes:**
  - Investigated before changing anything, per the "inspect before modify" instruction. Confirmed live in current source (not fixed since the audit; the 24 intervening commits never touched these files):
    - `app/api/live/route.ts` (Console/Remote's Next/Previous/Hold/Start/etc.) already requires `"owner"` — this bug was isolated to the three Display Engine PATCH routes, not the main live-action path.
    - `grep`-confirmed **zero** call sites anywhere in `app/`/`components/` for `activateHold`, `deactivateHold`, `pauseTimer`, `resumeTimer`, `startManualTimer`, `adjustTimer`, or `resetTimer` (the client functions `lib/display-engine/store.tsx` exports for hold/timer). These are currently unreachable from any UI — the vulnerability was real (a hand-crafted authenticated request from a viewer/editor collaborator could still hit it) but had no visible "disabled button" to fix; server enforcement was the entire fix surface.
    - `setSpeakerReady` **is** wired to real UI (`app/e/[eventId]/remote/page.tsx`), and that page's own `OWNER_ONLY_NOTE` explicitly documents the split the audit missed: *"Only the event owner can control the show from here. You can still watch and mark the speaker ready."* The `speaker-ready` route's own comment says the same ("Any role with access to the event may toggle it, as the Remote page documents"). This is first-party evidence of deliberate product intent, not an oversight — restricting it to owner would be a real product regression for backstage editor/viewer collaborators, and the audit's own Fix Guide explicitly allows for this ("Speaker-ready documentation calls this deliberate...").
  - **Decision:** `hold` and `timer` → require `"owner"` (matches the Remote page's own promise and `/api/live`'s existing precedent). `speaker-ready` → **left unchanged at `"viewer"`**, deliberately, with the reasoning recorded in the route file's own comment so the next person doesn't "fix" it again.
  - Added an optional `minRole: EventRole = "viewer"` parameter to `verifySessionAccess()` rather than inventing a parallel function — the default preserves every existing caller's behavior (`speaker-ready`, `require-broadcast-display-access.ts`'s two callers) with zero changes needed there.
- **Files changed:**
  - `lib/server/verify-display-access.ts` — `verifySessionAccess(requestedEventId, minRole = "viewer")`
  - `app/api/display-engine/hold/route.ts` — passes `"owner"`
  - `app/api/display-engine/timer/route.ts` — passes `"owner"`
  - `app/api/display-engine/speaker-ready/route.ts` — unchanged call, comment expanded to record the review and decision
  - `app/api/display-engine/token-authority.test.ts` — extended (see below)
- **Tests added/changed:**
  - `app/api/display-engine/token-authority.test.ts`: each `MutationCase` now carries `minRole`; the existing "still works for an authorized operator session" test now asserts `requireEventAccess` is called with the *correct* role per route (`"owner"` for hold/timer, `"viewer"` for speaker-ready/dismiss) instead of a blanket `"viewer"` that would have hidden this exact bug.
  - `lib/server/require-event-access.test.ts` (new): exercises the **real**, unmocked `requireEventAccess()` role-ranking logic (only the Supabase client is mocked) — proves a `viewer` role is rejected against an `"owner"` `minRole`, proves `owner`/`editor`/`viewer` resolve correctly, proves the anti-enumeration 404 and 401 paths are unchanged. This is the layer that actually proves enforcement; the route-level test above only proves correct wiring (what role each route *asks* for), since `requireEventAccess` is mocked there per this repo's existing test convention (see `app/api/programs/bulk/route.test.ts`, `app/api/live/route.test.ts`).
- **Verification performed:**
  - `npx vitest run` — 262/262 pass (was 149 at audit time; net growth includes Phase 1 QA work from `#53` plus this batch's new tests).
  - `npx tsc --noEmit` — clean.
  - `npm run lint` — 0 errors, 6 warnings (identical set the audit already recorded as pre-existing; none introduced).
  - `npm run build` — succeeds, all routes compile.
  - **Live browser** (real dev server, real Supabase project, demo1 account logged in as the real owner of its own event): `PATCH /api/display-engine/hold` with `active: true` → `200 {"ok":true}`, confirming the owner-allowed path still works end to end, not just in mocks.
- **Results:** Server-side enforcement confirmed for hold/timer (owner-only) and speaker-ready (viewer floor, unchanged, reasoned).
- **Remaining risks / incidental finding (out of Phase 1 scope):** While live-testing the owner-success path, a **second** `PATCH /api/display-engine/hold` call with `active: false` (deactivate) returned `500` with Postgres error `PGRST116 — The result contains 0 rows`. Root cause: no `display_type_state` row exists for `(event=0fe1ce24-5cae-4365-9489-540cf385a87b, display_type=presenter)` in this dev Supabase project — the deactivate branch does a `.single()` pre-fetch that requires an existing row; the activate branch doesn't, so it silently "succeeded" without necessarily writing anything either. This is a **pre-existing data-provisioning gap**, not something this fix introduced (the authorization check passed correctly in both calls — the failure is purely downstream, in the write). Not in the audit package. Given Hold/Timer have zero UI wiring today (see above), this has no current user-facing impact, but should be tracked separately before either is ever wired to a UI. **Not fixed in this batch — flagging only.**
- **Codex review status:** NEEDS CODEX
- **Codex should specifically inspect:** Whether restricting `hold`/`timer` to owner-only, while leaving `speaker-ready` at viewer, is the correct reading of product intent — re-verify the Remote page's `OWNER_ONLY_NOTE` copy and the speaker-ready route comment yourself rather than trusting this summary. Also verify the `PGRST116` finding above is genuinely pre-existing (e.g., via `git blame`/migration history on `display_type_state`) rather than something this batch caused.

### KF-002 — `must_change_password` is not enforced on operator APIs (audit SEC-03)

- **Audit priority:** P1
- **Audit status:** FAIL
- **Current status:** CLAUDE VERIFIED - NEEDS CODEX
- **Category:** Authentication / Authorization
- **Affected route/component:** `lib/server/require-auth.ts`, `lib/server/require-event-access.ts`, `proxy.ts` (read, unchanged)
- **Audit evidence:** `proxy.ts:79-90` (now ~86-91) explicitly excludes every `/api/` path from the forced-password-change redirect; `lib/server/require-auth.ts:29-37` and `require-event-access.ts:25-66` (pre-fix) did not inspect `user.app_metadata.must_change_password` at all.
- **Root cause confirmed:** Both shared guards call `supabase.auth.getUser()` independently (they don't share one code path) and neither checked the flag. Investigated blast radius before changing anything:
  - `requireAuthUser()` (in `require-auth.ts`) has exactly **one** importer: `app/api/events/route.ts` (list/create events, 2 call sites). The `requireAuth()` boolean wrapper the file's own doc comment describes as used by "every mutating API route" turned out to have **zero** current callers anywhere — that comment is stale; the codebase evolved to have every event-scoped route call `requireEventAccess()` directly instead. Noted here rather than silently rewritten, since fixing stale comments wasn't asked for.
  - `requireEventAccess()` has **29** importers across `app/api/` — every event-scoped mutation and read (programs, sessions, cue-sheet upload, collaborators, live actions, display-engine hold/timer/speaker-ready, share-links, integrations, etc.). This is the real "shared API authorization boundary" the audit meant.
  - `app/api/auth/set-password/route.ts` and `app/api/invites/[token]/accept/route.ts` both do their own raw `supabase.auth.getUser()` — neither imports `require-auth.ts` or `require-event-access.ts` at all, so neither is affected by this change, intentionally: they're exactly the "authenticate / replace password / log out (+ accept an invite addressed to this exact email)" carve-out the Fix Guide describes, and were already structurally independent of the two guards being fixed, not something this batch had to special-case.
  - `app/api/display-engine/registry/route.ts`'s `POST` (display register/heartbeat) calls neither guard — it's an intentionally public, token-free route (per its own comment) and is unaffected.
- **Implementation:** Added one shared helper, `requirePasswordCurrent(user)`, in `lib/server/require-auth.ts` (returns a `403 {code: "must_change_password"}` `NextResponse` or `null`). Called from both `requireAuthUser()` and `requireEventAccess()`, right after each resolves a real `user` and before any role/event logic runs. `requireAuth()` inherits the fix for free since it delegates to `requireAuthUser()`.
- **Files changed:**
  - `lib/server/require-auth.ts` — `requirePasswordCurrent()` + call from `requireAuthUser()`
  - `lib/server/require-event-access.ts` — imports and calls `requirePasswordCurrent()`
- **Tests added/changed:**
  - `lib/server/require-auth.test.ts` (new) — `requireAuthUser()`/`requireAuth()`/`requirePasswordCurrent()` directly, against a mocked `supabaseServer()`. Covers: no session (401), flagged session (403 + exact body), normal session (passes through), and a user with no `must_change_password` key at all (treated as false, not a crash).
  - `lib/server/require-event-access.test.ts` (new) — flagged owner rejected *before* the role check runs; flagged collaborator rejected the same way; unflagged owner succeeds. Also re-covers the pre-existing role matrix (owner/editor/viewer resolution, anti-enumeration 404, 401) so a future change to this file can't silently break either concern without a test catching it.
- **Verification performed:** Same full suite/typecheck/lint/build run as KF-001 (shared commands, see that section) — all green, 262/262 tests pass including the 2 new files above (8 tests each — see file contents for the full list).
- **Results:** A `must_change_password` session now gets `403 {ok:false, error:"Set a new password before continuing.", code:"must_change_password"}` from **every** route that goes through `requireAuthUser()` or `requireEventAccess()` (31 route files total), while `login`/`logout`/`set-password`/invite-accept remain reachable because they never went through either guard.
- **Remaining risks:** Not live-verified end-to-end against a real flagged account in this session (would require provisioning a real invited collaborator and waiting on/reading a real invite email, which this session doesn't have inbox access for) — verification here is direct unit-level testing against the real (unmocked) guard functions, which is a legitimate proof of the logic but not a full production round-trip. Flagging honestly rather than claiming a browser test that didn't happen.
- **Codex review status:** NEEDS CODEX
- **Codex should specifically inspect:** That `requirePasswordCurrent()`'s placement (after `getUser()`, before the event/role lookup in `requireEventAccess()`) can't be bypassed by any of the 29 call sites; that the `set-password`/invite-accept carve-out is still correct product behavior and not an oversight; ideally, provision one real invited (temp-password) account and confirm the 403 live if Supabase dashboard/email access is available to you.

### KF-003 — External API control cannot acquire its required lease (audit DEV-06)

- **Audit priority:** P1
- **Audit status:** FAIL
- **Current status:** CLAUDE VERIFIED - NEEDS CODEX
- **Category:** Product/Security — feature correctness
- **Affected route/component:** `app/api/events/[eventId]/integrations/route.ts`, `components/forms/integration-credentials-panel.tsx`, `docs/EXTERNAL_API.md`
- **Audit evidence:** `app/api/v1/events/[eventId]/actions/[action]/route.ts:6-24` forwards every action to `runLiveAction` with `clientId: integration:<credentialId>`; `app/api/live/route.ts`'s `LOCKED_ACTIONS`/`isControllerActive()` require that exact `clientId` to already hold an active claim.
- **Root cause confirmed (code-verified, not just re-stated from the audit):**
  - `grep`-confirmed the `ACTIONS` set in the v1 actions route is exactly `{"start","hold","resume","next"}` — no `claimControl`, no renew, no release, anywhere reachable from an integration credential.
  - A synthetic `integration:<uuid>` clientId can only ever satisfy `current.controller_id === clientId` if something had previously called `claimControl` with that literal string — nothing does, and nothing *can*, since the v1 adapter doesn't expose that action. Every one of the four advertised actions (`start`/`hold`/`resume`/`next` — all in `LOCKED_ACTIONS`) therefore returns `423 Locked` **unconditionally**, not just when a human happens to be in control. This matches the audit's claim exactly, independently re-derived from the code rather than trusted at face value.
  - Considered the audit's own instruction to "prove [a complete lease design] before choosing the more complex implementation" — there is none; confirmed by the same grep above plus reading `app/api/live/route.ts` in full. No half-complete lease protocol was invented to keep the feature superficially visible.
- **Fix direction chosen:** The audit's explicitly named "safest pre-launch choice" — disable credential creation, mark the feature Coming Soon — rather than building a lease lifecycle (out of scope for Phase 1, and the audit itself frames a real lease as a separate, larger design task with its own acceptance criteria).
- **Implementation:**
  - `POST /api/events/[eventId]/integrations` now always returns `403 {ok:false, error:"External API control credentials are not available yet. Coming soon.", code:"coming_soon"}` for an authorized owner, and still short-circuits on `requireEventAccess`'s own denial for anyone else (unchanged ordering — auth failure is checked first). The old working creation logic was **deleted**, not left as unreachable dead code behind the 403 — an unused private function would have failed `npm run lint`'s unused-vars rule and is exactly the kind of leftover the audit's own discipline argues against; the removed logic is fully recoverable from git history when a real lease lifecycle is built.
  - `GET` (list) and `DELETE` (revoke) are **unchanged and still work** — an owner can see and clean up credentials created before this shipped. (Confirmed live: this dev project already has one, labeled "deep streamdeck", already revoked from earlier session activity — proves the list/revoke path still functions against real data, not just a mock.)
  - `GET /api/v1/events/[eventId]/state` (read-only) is untouched — it never touched the controller lease and still works for any existing credential.
  - `components/forms/integration-credentials-panel.tsx`: removed the create form entirely (not just disabled it) — a disabled-looking button that still 403s on click is the exact "UI copy doesn't match server behavior" pattern the audit flagged elsewhere in the product; replaced with a plain "Coming soon" notice. List + revoke UI unchanged.
  - `docs/EXTERNAL_API.md`: rewritten to state plainly that control actions don't work yet and why, instead of documenting `423` as if it only meant "a competing controller is active" (true of the mechanism, misleading as the *only* real-world outcome for every integration credential).
- **Files changed:** `app/api/events/[eventId]/integrations/route.ts`, `components/forms/integration-credentials-panel.tsx`, `docs/EXTERNAL_API.md`
- **Tests added/changed:** `app/api/events/[eventId]/integrations/route.test.ts` (new) — owner's `POST` still gets the `coming_soon` 403 (proves it's not just a UI-layer removal); a `requireEventAccess` denial still short-circuits before reaching the coming-soon body; `GET` still lists.
- **Verification performed:**
  - Full suite/typecheck/lint/build — green (see KF-001).
  - **Live browser**, real dev server + real Supabase project, logged in as demo1 (real owner): navigated to Settings → External API, confirmed the rendered page shows "Coming soon" with no create form, and the existing revoked "deep streamdeck" credential still lists correctly. Then, from the same authenticated tab's console, called `fetch("/api/events/.../integrations", {method:"POST", ...})` directly — got back exactly `403 {"ok":false,"error":"External API control credentials are not available yet. Coming soon.","code":"coming_soon"}`, confirming the server enforces this independently of the UI, not just that the form is hidden.
- **Results:** No new credential can be created by anyone, including the owner. Existing credentials remain listable/revocable. `GET /state` unaffected.
- **Remaining risks:** None identified for this narrow scope. A real lease lifecycle (claim/renew/release/takeover/idempotency/audit) remains a distinct, larger future task — not attempted here, consistent with the audit's own framing and this run's Phase-1-only scope.
- **Codex review status:** NEEDS CODEX
- **Codex should specifically inspect:** Confirm the deleted creation logic is fully recoverable from git history (it is, in this same branch's history) if/when a lease design exists; confirm no other route or script depends on `POST /api/events/[eventId]/integrations` succeeding (grepped; none found, but worth a second look).

---

## Phase 2 — Core Show Workflows (not started this batch)

| ID | Title | Audit priority | Audit evidence | Status |
|---|---|---|---|---|
| KF-004 | Rehearsal completion unreachable at the final cue | P1 | `app/e/[eventId]/rehearsal/page.tsx:282-307` — `disabled={isFinished \|\| currentOrder >= max}` | NOT STARTED |
| KF-005 | Rehearsal exit UX (unnecessary discard warning / no summary) | P2 | Fix Guide, "Rehearsal exit/summary — FAIL" | NOT STARTED |
| KF-006 | Excel import not fully atomic; imported session doesn't hand off to a runnable Console state | P1 | `app/api/cue-sheet/upload/route.ts:94-113`; `app/e/[eventId]/operator/cue-sheet/page.tsx:781-786`; `app/e/[eventId]/operator/page.tsx:129-145` | NOT STARTED |
| KF-007 | Live-action API doesn't fully validate the active session/event relationship | P1/PARTIAL | Fix Summary, "Require a valid event session in the live-action API" | NOT STARTED |

## Phase 3 — Origin / Security / Platform Release Work (not started)

| ID | Title | Audit priority | Status |
|---|---|---|---|
| KF-008 | Canonical production origin not enforced (`app.kramflow.me` doesn't redirect) | P1 | NOT STARTED |
| KF-009 | No Content-Security-Policy | P1 | NOT STARTED |
| KF-010 | No production error monitoring | P1 | NOT STARTED |
| KF-011 | `/privacy` and `/terms` return 404 | P1 | NOT STARTED |
| KF-012 | Email authentication incomplete (SPF/DKIM/DMARC) | P1/PARTIAL | NOT STARTED (partially BLOCKED - EXTERNAL: DNS/Resend dashboard access) |
| KF-013 | RLS / role / revocation release gate unverified in production | P1 gate | NOT STARTED (BLOCKED - EXTERNAL: needs 2+ real accounts + prod/Supabase dashboard access) |
| KF-014 | Backups/restore unverified | P1 gate | NOT STARTED (BLOCKED - EXTERNAL: needs Supabase dashboard access) |

## Phase 4 — UI / UX / Accessibility (not started)

| ID | Title | Audit priority | Status |
|---|---|---|---|
| KF-015 | Event-shell logout uses a Lock icon/label instead of Lucide `LogOut` | P2 | NOT STARTED |
| KF-016 | Logout redirects to `/login`, not public home | P2 | NOT STARTED |
| KF-017 | Login UX: no forgot-password flow, no show/hide password | P2 | NOT STARTED |
| KF-018 | First-run clarity: Event → Session → Console handoff is confusing | P2/PARTIAL | NOT STARTED |
| KF-019 | Landing micro-label contrast (~10 labels at 2.29–2.51:1) | P2 | NOT STARTED |
| KF-020 | No skip-to-content link; authenticated keyboard/focus sweep unverified | P2 | NOT STARTED |
| KF-021 | Responsive landing variants duplicate semantic headings in the DOM | P3 | NOT STARTED |
| KF-022 | Homepage `/#one-cue` fragment navigation | — | **PASS — N/A, no action.** Standard, accessible in-page navigation; audit explicitly says this is not a defect. |

## Phase 5 — Public Web / SEO / Performance (not started)

| ID | Title | Audit priority | Status |
|---|---|---|---|
| KF-023 | Mobile landing LCP 3.6s (target ≤2.5s) | P2 | NOT STARTED |
| KF-024 | Missing social preview (OG/Twitter) image | P2 | NOT STARTED |
| KF-025 | `/dev/components` publicly served in production, labeled internal | P2 | NOT STARTED |
| KF-026 | Non-home routes inherit homepage canonical/OG metadata; login/signup wrongly in sitemap | P2 | NOT STARTED |

## Phase 6 — Optional / Conditional (no defect confirmed; product decisions, not bugs)

| ID | Title | Status |
|---|---|---|
| KF-027 | Analytics/UTM acquisition measurement | N/A — absent is not a defect; add only with a defined measurement/consent plan if ever needed. |
| KF-028 | Cookie banner / Consent Mode v2 / GPC | N/A — no non-essential tracking exists to disclose. |
| KF-029 | One-click unsubscribe on transactional invite email | N/A — not required for transactional mail; revisit only if bulk/marketing mail is ever added. |
| KF-030 | Phone/SMS consent | N/A — no phone/SMS flow exists. |

---

## Reverification checklist (run after every future batch, per the audit's own reverification pack)

- [ ] `npx vitest run`
- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Role/permission negative tests for anything touching authorization
- [ ] Live browser check of any changed end-user flow, at desktop + mobile widths where visual
- [ ] Re-confirm every row in "Items that passed must stay passing" style checks aren't silently broken (see audit's own list — Lucide consistency, `#one-cue`, HTTPS/HSTS, headers, desktop performance, etc.)

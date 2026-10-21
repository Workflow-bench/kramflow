# KramFlow Audit Evidence Index

## Produced artifacts

- `KRAMFLOW_FULL_AUDIT.md` — complete findings, methods, image checklist, and verification gates.
- `KRAMFLOW_FIX_SUMMARY.md` — simple two-section action list.
- `KRAMFLOW_FIX_GUIDE.md` — implementation-oriented fixes and acceptance criteria.
- `KRAMFLOW_TEST_MATRIX.md` — surface-by-surface status and coverage boundaries.
- `KRAMFLOW_AUDIT_CHECKLIST.md` — execution checklist.
- `kramflow-lighthouse-mobile.report.html/.json` — reproducible mobile lab record.
- `kramflow-lighthouse-mobile-rerun.report.html/.json` — independent second mobile lab record.
- `kramflow-lighthouse-desktop.report.html/.json` — reproducible desktop lab record.

## Evidence classes

| Label | Meaning |
|---|---|
| LIVE | Directly observed on a production response or browser surface. |
| SOURCE | Local checkout inspection. It supports root-cause analysis but does not prove the deployed revision. |
| TEST | Local automated check against the inspected checkout. |
| STANDARD | Primary specification or first-party platform guidance. |
| INFERENCE | Reasoned implication, explicitly not represented as a reproduced fact. |

## Key evidence map

| Finding | Evidence |
|---|---|
| Rehearsal cannot finish | SOURCE: `app/e/[eventId]/rehearsal/page.tsx:282-307`; “Finish” is disabled at `currentOrder >= max`, while “Jump to Finish” is hidden at that point. |
| Event header lock is logout | LIVE: authorized event Settings header displayed “Lock.” SOURCE: `components/operator/event-shell-header.tsx:95-98`, `components/auth/auth-context.tsx:59-68`; dashboard contrast at `components/dashboard/lock-button.tsx:7-13`. |
| Logout routes to login | SOURCE: `components/auth/auth-context.tsx:66-68`. |
| Import/session-start dead end | SOURCE: cue-sheet import callback `app/e/[eventId]/operator/cue-sheet/page.tsx:781-786`; console empty state `app/e/[eventId]/operator/page.tsx:129-145`; live state starts with empty active session in `lib/store.tsx`. |
| Import transaction gap | SOURCE: `app/api/cue-sheet/upload/route.ts:94-113`; session upsert and replacement RPC are separate operations, with replacement IDs derived from programs. |
| External API control is locked | LIVE: Settings exposes External API. SOURCE: action adapter `app/api/v1/events/[eventId]/actions/[action]/route.ts:6-24`; lease enforcement `app/api/live/route.ts:47-58,169-181`; no integration claim action exists. |
| Viewer can mutate display state | SOURCE: role contract `lib/server/require-event-access.ts:5-15` and UI copy `components/forms/event-settings-panel.tsx:435-448`; mutation guards in hold/timer/speaker-ready routes call viewer-level `verifySessionAccess`. |
| Temporary-password API bypass | SOURCE: `proxy.ts:79-90` explicitly excludes `/api/`; `lib/server/require-auth.ts:29-37` and `require-event-access.ts:25-66` do not check the flag. |
| Alias split | LIVE HTTP: root 308 to `www`; `app` returns 200 same content. SOURCE: Supabase SSR cookie setup has no shared cookie `Domain`. Session fragmentation is INFERENCE until login is tested across aliases. |
| CSP absent / HSTS present | LIVE HTTP response headers from `www.kramflow.me`. |
| Mobile speed and contrast | LIVE Lighthouse artifacts in this folder. Two mobile runs independently measured LCP 3.6 s and found the same ten contrast failures. |
| Public internal catalog | LIVE HTTP: `/dev/components` returns 200 with public caching. SOURCE/LIVE content labels it “Kramflow · internal.” |
| Incorrect route metadata | LIVE HTML: login, signup, set-password, screens, TV, custom, and dev catalog all emit canonical/OG URL `https://www.kramflow.me/`. |
| Legal pages absent | LIVE: `/privacy` and `/terms` returned 404; public footer has no legal links. |
| Email authentication incomplete | LIVE DNS: no root SPF TXT, `_dmarc.kramflow.me` has `v=DMARC1; p=none`, Resend DKIM TXT exists. No delivered headers were available. |
| Local quality checks | TEST: Vitest 149/149 pass; `tsc --noEmit` pass; ESLint 0 errors/6 warnings; production dependency audit 0 reported vulnerabilities. |

## Reproduction recipes

### Rehearsal finish

1. Open an event with at least one session and cue.
2. Enter Rehearsal Mode and start.
3. Advance to the final cue.
4. Observe that the primary button says **Finish** but is disabled; **Jump to Finish** is no longer rendered.
5. Expected: a working Finish action moves to a clear completion/summary state.

### Canonical aliases

1. Request `/` on `kramflow.me`, `www.kramflow.me`, and `app.kramflow.me`.
2. Observe root → `www` but `app` remains on `app` with the same public content.
3. Expected: every public/auth alias redirects to one chosen origin before login.

### Legal surface

1. Open the public footer; observe no privacy/terms links.
2. Request `/privacy` and `/terms`; both return branded 404 pages.
3. Expected: published, accurate policies linked from public and account-creation surfaces.

### Mobile landing performance

Run Lighthouse in navigation mode against `https://www.kramflow.me/` using mobile throttling. The preserved run recorded LCP 3.6 s. The LCP hero image used an oversized mobile `sizes` declaration and lacked a high-priority hint; image delivery audit estimated 176 KiB savings.

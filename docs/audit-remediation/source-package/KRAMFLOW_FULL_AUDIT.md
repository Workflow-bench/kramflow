# KramFlow Production Pre-Launch Audit

Audit window: 2026-09-27–28 (America/Phoenix)  
Decision: **HOLD for targeted P1 remediation and release-gate verification. No P0 data-loss or remote-compromise defect was confirmed.**

## Executive Summary

KramFlow’s public site is polished, its desktop landing performance is excellent, its core repository checks pass, and the inspected architecture contains thoughtful authorization, RLS, rate-limit, rehearsal-isolation, and live-control patterns. It is not yet ready for an evidence-backed public launch.

The second-pass route and authorization review found additional P1 issues. The complete P1 set should be fixed before launch:

1. **Rehearsal cannot reach completion through its normal controls.** At the last cue, the button changes to “Finish” while becoming disabled; the alternative finish action is hidden.
2. **The documented role boundary is not enforced consistently.** Viewers are described as read-only, yet the hold, timer, and speaker-ready mutation endpoints authorize the minimum `viewer` role.
3. **The forced temporary-password rule is page-only.** Proxy redirects force the set-password screen for pages but explicitly exempt every `/api/` path; shared API guards do not reject `must_change_password` sessions.
4. **External API control is exposed but structurally cannot obtain the controller lease.** Settings can create credentials, but every advertised control action reaches a locked live action and the API offers no claim-control action.
5. **Excel import is not one atomic operation.** Session upserts commit before the separate program-replacement RPC; a later failure leaves partial state.
6. **Production has multiple live origins.** `app.kramflow.me` serves the product instead of redirecting to `www`; local auth cookies are host-scoped. The resulting login/session split is a strong risk, though cross-host authentication was not destructively tested.
7. **Required trust/operations foundations are incomplete.** Privacy and terms pages are absent, and no production error-monitoring integration was found—material for an account-based live-event system.
8. **Security and email release gates need closure.** No CSP is deployed. Email DNS has DKIM and monitoring-only DMARC, but no root SPF record was returned and delivered-message alignment was unavailable.

Additional P2 work includes the confusing Lock/logout control, logout destination, the Excel-import-to-session-selection dead end, 3.6 s mobile lab LCP, low-contrast micro-labels, missing social-share image, and rehearsal exit/summary UX.

## Scope & Method

This was a non-destructive audit. No production record, account, credential, event, deployment, migration, or source file was changed.

Evidence combined:

- live browser testing of landing, mobile navigation, anchors, login, 404, and a limited existing authenticated Settings surface;
- direct HTTP/header/robots/sitemap/API and DNS inspection;
- Lighthouse mobile and desktop runs preserved beside this report;
- local source inspection of the React/Next/Supabase application;
- local tests, TypeScript, ESLint, and production dependency audit;
- WCAG 2.2, web.dev Core Web Vitals, OWASP, Supabase, Google Search, RFC, regulator, Apple HIG, and Nielsen-style interaction heuristics.

Source evidence is labeled as such and is not assumed to be the deployed revision. A current production deployment SHA was not available.

### Priority taxonomy

| Priority | Meaning |
|---|---|
| P0 Blocker | Active loss, corruption, severe security compromise, or unusable core product. |
| P1 Critical before launch | High-impact workflow, trust, security, legal, or operational readiness failure. |
| P2 Should fix before launch | Material usability, accessibility, performance, or discoverability defect with a workaround. |
| P3 Post-launch polish | Useful improvement without launch-critical impact. |

## Test Environment

- Production: `https://kramflow.me`, `https://www.kramflow.me`, `https://app.kramflow.me`
- Browser: Codex in-app Chromium plus limited read-only inspection of an existing authorized Chrome session
- Narrow viewport observed: 325 × 703 CSS px inside a 390 × 844 browser surface
- Local checkout: `/Users/deeppatel/Documents/AI/Shibir/stageflow`
- Branch: `docs/finalize-project-documentation...canonical/docs/finalize-project-documentation`
- HEAD: `02669143dcd7677efb7c6ed83bc7b23d056780a6`
- Stack detected: Next.js 16.3.3, React 19.3, TypeScript, Supabase SSR/Realtime, Vercel, Resend, Lucide, GSAP/Framer Motion, SheetJS
- Local tree already contained unrelated untracked files; they were not touched.

## The 11 Requested Checks

| # | Requested issue | Status | Priority | Evidence / conclusion |
|---:|---|---|---|---|
| 1 | UI inconsistent; navigation complicated | PARTIAL | P2 | Event navigation is now a consistent four-destination shell with a labeled mobile menu. However, operational modes are split across nav, Remote in a new tab, a separate rehearsal action, session popover, and dashboard; the event-to-session transition lacks a clear inline next action. The design system is more consistent than the hypothesis suggests, but first-run navigation still imposes product-model learning. |
| 2 | Login is boring/weak | PARTIAL | P2 | The page is visually minimal but readable and correctly labeled. Material issues: no password recovery link, no password visibility toggle, little reassurance/context, and weak continuation/help hierarchy. “Boring” alone is not a defect; recovery and trust gaps are. |
| 3 | Logout shows a lock icon | FAIL | P2 | Live event Settings showed “Lock.” Source `event-shell-header.tsx:95-98` uses Lock and aria-label “Lock,” but `auth-context.tsx:59-68` calls logout. Dashboard correctly uses LogOut + “Log Out,” proving inconsistency. |
| 4 | Logout goes to login rather than home | FAIL | P2 | `auth-context.tsx:66-68` hard-navigates to `/login` after POST logout. Live logout was not performed because it would disrupt the authorized session. |
| 5 | Homepage anchors create `/#one-cue` | PASS | — | Clicking the mobile “One cue” link scrolled correctly, closed the menu, and produced `https://www.kramflow.me/#one-cue`. A fragment is standard, accessible, shareable, and history-aware. Removing it is optional product taste, not a launch defect. Keep section IDs stable and avoid duplicate history entries. |
| 6 | Everything feels slow | PARTIAL | P2 | Desktop landing is fast (Lighthouse 100, LCP 0.6 s). Two independent mobile runs both measured LCP 3.6 s (scores 85 and 90); oversized imagery is the main measured opportunity. TBT 10–20 ms and CLS 0 are good. Authenticated routes and field INP were not measurable. |
| 7 | Rehearsal ending UX is poor | FAIL | P1 | At final cue, `currentOrder >= max` both labels the button Finish and disables it. The alternative “Jump to Finish” renders only while `< max`. Completion is unreachable. Exit also discards local progress with no confirmation or summary. Isolation from live displays is well designed. |
| 8 | New event + Excel import cannot start session | PARTIAL | P1 | Source confirms a discoverability/state gap: import refreshes sessions but does not set the live `activeSessionId`; Console shows “Select a session to get started” without an inline selection action. It may be recoverable through the header session popover, so “impossible” was not fully reproduced. Safe production creation/import was not authorized. |
| 9 | Icons should use one library | PASS | — | UI icon imports are overwhelmingly `lucide-react`; custom wordmark/brand graphics are appropriate exceptions. The Lock issue is incorrect semantics, not library fragmentation. |
| 10 | Settings “Extended API” should be Coming Soon | FAIL | P1 | Production/source label it **External API** and expose credential creation, but the control adapter calls owner-locked live actions with client ID `integration:<id>` and has no claim-control endpoint. `start`, `hold`, `resume`, and `next` therefore reach the controller-lease rejection unless an impossible/pre-existing matching lease exists. Hide/mark unavailable until repaired, or implement and test lease semantics. |
| 11 | Broader UX issues | FAIL | P1–P3 | Confirmed: unreachable rehearsal completion, weak import-to-start recovery, missing reset path, no skip link, low-contrast labels, missing legal links, mixed logout language, and missing monitoring. Positive: responsive menu, reduced motion, empty/loading states, destructive confirmations, and a consistent visual system exist. |

## UI/UX & Visual Design Findings

### UX-01 — Rehearsal completion is unreachable — P1

**Evidence:** `app/e/[eventId]/rehearsal/page.tsx:282-307`. On the last cue the main control is textually “Finish” but disabled. “Jump to Finish” is hidden at the same boundary. This violates feedback, match-to-task, and peak-end expectations.

**Fix direction:** keep Finish enabled at the final cue and call the completion transition; show a compact summary (session, cues completed, holds/alerts, elapsed/overrun) with clear Exit and Run again actions. Add unit/browser tests for 0, 1, and many cues.

**Verify:** keyboard and pointer can reach a single enabled Finish control; activation reaches the completion view exactly once without touching live state.

### UX-02 — Rehearsal exit discards context silently — P2

**Evidence:** the header’s Exit Rehearsal is a direct link (`rehearsal/page.tsx:145-148`). State is intentionally local/unpersisted. There is no confirmation during an active run and no end summary.

**Fix direction:** confirm only when an active rehearsal has meaningful progress; avoid confirmation before start or after clean completion. State that live screens were never changed.

### UX-03 — Event-shell logout is mislabeled as Lock — P2

**Evidence:** live Settings and source. Dashboard uses the correct LogOut icon/label, while every event shell uses Lock and “Lock” for the same logout action.

**Fix direction:** use one user-facing term and Lucide `LogOut`. If a true screen-lock feature is desired later, make it a separate behavior that preserves the session.

### UX-04 — Import does not bridge to starting the show — P1

**Evidence:** the import callback refreshes sessions; it does not choose/activate one. Console has no inline action when sessions exist but none is active. This is a Zeigarnik/closure and visibility-of-system-status problem, not merely an aesthetic complaint.

**Fix direction:** after successful import, select the imported/default session in the cue sheet and provide a clear “Open Console with [session]” action. The live start action must explicitly choose/validate a session; do not silently start one if multiple sessions make that unsafe.

### UX-05 — Authentication recovery and trust are underdeveloped — P2

**Evidence:** live login has email/password, login, and signup only. No forgot/reset link or password visibility affordance was found. Native required validation works; labels and autocomplete are present.

**Fix direction:** add a real recovery path, visibility toggle with accessible state, concise product/trust context, and consistent error/support language. Keep the page simple.

### UX-06 — Navigation is coherent but the product model remains dense — P2

The top event shell consistently exposes Console, Cue Sheet, Displays, Settings, and Remote; mobile uses a labeled popover. That is a significant pass. Cognitive load remains in the separate Event → Session → mode concepts and in placing Rehearsal beside logout rather than clearly within operating-mode context. Use progressive disclosure, session-aware empty-state actions, and stable terminology rather than adding more navigation.

### UX-07 — Tiny landing labels fail contrast — P2

Lighthouse found ten 10–11 px labels at approximately 2.29–2.51:1 (sequence numbers and spatial-distance annotations). WCAG normal-text minimum is 4.5:1. Even if some are decorative, the measurements communicate sequence/distance and should remain legible.

### UX-08 — Duplicate responsive headings create semantic noise — P3

The landing DOM exposes duplicate section headings/content for responsive variants. Visual CSS hiding can still produce unnecessary semantic duplication depending on implementation and assistive technology. Keep one heading/content source where feasible or ensure inactive variants are removed from the accessibility tree.

### UX heuristics applied

- **Hick/Miller:** keep event destinations grouped; do not add top-level tabs for every mode.
- **Fitts/target distance:** high-frequency live controls should remain large and spatially stable. The public 44 px menu control passed; authenticated targets need manual coverage.
- **Jakob/consistency/similarity:** “Lock” must not mean “Sign out”; icon and label must match web conventions.
- **Proximity/connectedness:** imported session confirmation should be immediately connected to the next action.
- **Doherty threshold:** loading states exist, but mobile media delays the first meaningful visual.
- **Von Restorff/serial position:** use one unmistakable primary Start/Next/Finish action; keep destructive exit secondary.
- **Peak-end:** rehearsal currently fails at the end, the most memorable point.
- **Zeigarnik:** imported-but-not-active sessions leave an unfinished task without a clear bridge.
- **Prägnanz/Occam/Pareto:** preserve the four-destination shell and fix the few high-impact discontinuities instead of redesigning the product.
- **Tesler/Postel:** keep live-state complexity in validated server actions; accept safe input variance but never ambiguous session identity.
- **Parkinson:** confirmation should be targeted, not added to every action.

## Functional / Development Findings

### DEV-01 — Multiple production origins are not normalized — P1

`kramflow.me` redirects to `www`, but `app.kramflow.me` returns 200 with the same public content. Canonical metadata still points to `www`. The inspected Supabase SSR cookie configuration does not set a shared cookie domain, so cross-host session fragmentation is likely. That consequence is an **inference**, not a destructive live auth result.

**Fix:** select one application origin and permanent-redirect every alias before authentication. Align Supabase redirect allowlists, email links, sitemap, OG URL, API CORS, and environment base URLs. Verify fresh login, refresh, logout, invites, and password links from each alias.

### DEV-02 — Logout destination conflicts with requested behavior — P2

The handler always assigns `/login`. Change to `/` only after confirming product intent and test both dashboard and event-shell paths, including failed logout requests and back-button cache behavior.

### DEV-03 — Live action should reject an empty session server-side — P1

The UI generally blocks starting without a session, but the live action path should independently require a valid event-owned session. UI affordances are not authorization or invariant enforcement.

### DEV-04 — Production observability is absent — P1

No Sentry or equivalent application error-tracking integration/configuration was found. Console logging exists, but live-event failures need protected exception capture, route/action context, release identifier, and alerting. Avoid recording cue content, tokens, emails, or passwords.

### DEV-05 — Repository quality gates mostly pass — PASS/P3

- 149/149 tests passed across 14 files.
- TypeScript passed with no emit.
- ESLint: 0 errors, 6 warnings; five concern `window.location.href` navigation patterns, one is in unrelated untracked material.
- `npm audit --omit=dev`: zero reported production vulnerabilities across the resolved graph.

These do not prove the deployed commit or replace browser/end-to-end testing.

### DEV-06 — External API live control cannot acquire its required lease — P1

The `/api/v1/events/[eventId]/actions/[action]` adapter advertises `start`, `hold`, `resume`, and `next`. It forwards them to `runLiveAction` with `clientId: integration:<credentialId>`. Every one maps to a locked action, but the public integration action set has no `claimControl`, renew, release, or takeover operation. The live handler therefore returns 423 unless the row already contains that otherwise-unobtainable integration client ID.

**Fix direction:** until ownership, expiry, takeover, idempotency, and audit behavior are designed and tested, mark the UI unavailable/Coming Soon and prevent credential creation. If shipping now, add an explicit integration lease lifecycle rather than bypassing the lease.

### DEV-07 — Cue-sheet import is only partly atomic — P1

The upload route first upserts sessions, which commits as one database request, then invokes `replace_session_programs` as a separate transaction. If the RPC fails, imported/changed session rows remain while programs were not replaced. An empty imported sheet is also omitted from `p_session_ids` because that list is derived from parsed programs, so an existing session’s old programs may survive an intended empty replacement. Database error messages are returned verbatim on both failure paths.

**Fix direction:** move session upsert and all affected-session replacement into one event-scoped RPC/transaction; derive affected session IDs from parsed sessions, not programs; return generic errors while logging protected detail.

## Security

### SEC-01 — No Content Security Policy — P1

Live `www` responses include HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy, but neither enforced nor report-only CSP. For an authenticated operations application, deploy a tested nonce/hash-based policy, beginning in report-only mode.

### SEC-02 — Viewer role can mutate stage/display state — P1

The product states: owner runs the live show, editor edits the cue sheet, viewer is read-only. `verifySessionAccess()` nevertheless calls `requireEventAccess(..., "viewer")`, and is the guard for three PATCH routes: display hold, timer, and speaker-ready. These use the service-role client to write state. Speaker-ready documentation calls this deliberate, but it contradicts the visible role promise; hold and timer are operational mutations as well.

**Fix direction:** define the permission matrix explicitly. If viewers truly “can only look,” require owner (or a new narrowly named backstage role) for every mutation. Add direct API tests per role; UI disabling is not sufficient.

### SEC-03 — `must_change_password` is not enforced on operator APIs — P1

The invitation flow creates an immediately confirmed account with a temporary password and `app_metadata.must_change_password=true`. Proxy forces normal pages to `/set-password` but explicitly skips all paths beginning `/api/`. Neither `requireAuthUser()` nor `requireEventAccess()` checks the flag. A temporary-password session can therefore call authenticated APIs directly before choosing a permanent password, contrary to source comments and UI promises.

**Fix direction:** reject flagged users in the shared authenticated/operator API guards, with a narrow allowlist for login/logout/set-password and intentionally public token APIs. Add tests that flagged sessions cannot accept invitations, read event data, edit cue sheets, or mutate stage state before password replacement.

### SEC-04 — Authorization/RLS design is promising; production denial tests remain a launch gate — UNVERIFIED/P1 gate

Source uses `getUser()`, event-scoped access checks, generic 404 anti-enumeration behavior, server-only service-role access, and migrations that remove earlier broad policies. One unauthenticated `/api/events` request returned generic 401. This is not proof of production RLS.

Before launch, use two unrelated users plus viewer/editor/owner roles to prove denial for event rows, sessions, programs, live state, displays, collaborators, share links, integrations, and revoked access. Verify applied migrations and Supabase Security Advisor.

### SEC-05 — Rate limiting exists but was not attacked — PARTIAL

Login/signup/resend source implements persistent identity/IP throttling with exponential delay. Production brute-force testing was intentionally avoided. Verify 429 behavior, generic responses, proxy IP parsing, cleanup, fail-open monitoring, and Supabase Auth’s own limits.

### SEC-06 — Keys are appropriately separated in inspected source — PASS

The browser uses publishable Supabase configuration; service-role access is confined to server modules/scripts. No secret value was printed or searched from live environment files. Repeat a deployment-bundle/secret scan in CI.

### SEC-07 — HTTPS/HSTS pass; CORS hypothesis not reproduced — PASS/PARTIAL

All checked aliases use HTTPS and `www` sends two-year HSTS with subdomains/preload. Public HTML permits `Access-Control-Allow-Origin: *`; the unauthenticated API response did not. The previously reported cross-origin failure was not reproduced on public or unauthenticated checks. Authenticated cross-alias CORS remains unverified and should disappear after canonical-host enforcement.

### SEC-08 — Dependency result has a SheetJS caveat — PARTIAL

The production dependency audit reported zero vulnerabilities, but SheetJS is pulled from a direct URL and the source itself documents known advisories. Track the exact version/advisories and migration path separately; do not assume the npm result fully covers it.

## Performance

### Lab results

| Metric | Mobile | Desktop | Interpretation |
|---|---:|---:|---|
| Lighthouse Performance | 85, then 90 | 100 | Mobile needs improvement; desktop passes. |
| FCP | 2.2 s, then 0.9 s | 0.3 s | Variable; second run improved. |
| LCP | 3.6 s in both runs | 0.6 s | Reproduced mobile miss of ≤2.5 s “good”; below >4 s “poor.” |
| Speed Index | 4.8 s, then 1.9 s | 0.6 s | Variable; first mobile run visually slow. |
| TBT | 10 ms, then 20 ms | 0 ms | Main-thread blocking is not the main landing issue. |
| CLS | 0 | 0 | Stable. |

The mobile hero declares a very large mobile `sizes` value, renders far wider than the viewport, and lacks a high-priority hint. Lighthouse estimated roughly 176 KiB image-delivery savings and 62 KiB unused JavaScript savings. Optimize the LCP asset/responsive source selection before adding speculative caching or virtualization.

**Not measured:** field p75 LCP/INP/CLS, authenticated app launch, long cue sheets, realtime burst behavior, N+1 database queries, cache hit ratios, or Excel parse responsiveness on lower-end devices. Do not claim failures for checklist remedies such as pagination, virtualization, batching, or worker parsing without profiles.

## Accessibility

- **PARTIAL:** Lighthouse accessibility 96 on mobile and desktop.
- **FAIL:** ten small gray labels were below the 4.5:1 normal-text threshold.
- **PASS:** automated link/button names, target-size audit, heading-order audit, and document language.
- **PASS:** reduced motion is globally handled in CSS/Framer Motion; landing GSAP explicitly checks the preference.
- **PARTIAL:** public keyboard controls and focus styles worked in sampled navigation; no skip-to-content link exists.
- **UNVERIFIED:** full authenticated keyboard order, focus traps/return, 200% zoom, 320 CSS px reflow across cue tables/modals, screen-reader announcements, error recovery, and complete target measurements.

WCAG 2.2 AA uses 24 × 24 CSS px with exceptions for target-size minimum; 44 × 44 is a strong enhanced/Apple-style touch target, not automatically an AA failure.

## SEO / Discoverability

**Passes:** canonical home URL, accurate title/description, `robots.txt`, sitemap containing canonical public URLs, favicon, HTTPS, custom noindexed 404, no false `<lastmod>` values.

**Failures/gaps:**

- no Open Graph/Twitter preview image (P2);
- `app` alias duplicates public content instead of redirecting (P1);
- no Organization/SoftwareApplication structured data (P3 optional, only if truthful);
- duplicate responsive heading content (P3 semantics);
- no public privacy/terms pages and no footer links (P1 trust/legal).
- every sampled non-home route inherited the homepage canonical and `og:url`, including `/login`, `/signup`, `/set-password`, `/screens`, `/tv`, `/custom`, and `/dev/components` (P2). Login/signup are also listed in the sitemap, creating conflicting index signals;
- `/dev/components` is publicly reachable, cached as public, and visibly labels itself “Kramflow · internal.” `robots.txt` disallows `/dev/`, but robots rules are not access control (P2).

FAQ schema is not warranted without a visible FAQ and generally provides no Google rich-result benefit for this product category. Author bylines are not relevant without editorial articles. `llms.txt` is optional and not a launch requirement. Wildcard robots permits ordinary/AI crawling of public pages; adopt named AI-bot rules only after a business policy decision.

## Legal / Consent / Email

This is a technical readiness assessment, not legal advice.

### LEG-01 — Privacy and terms are absent — P1

`/privacy` and `/terms` return 404, and the footer/account entry surfaces do not link policies. KramFlow creates accounts, stores event/collaborator data, and sends invites; publish accurate policies and place links near signup and in the footer.

### LEG-02 — Cookie banner is not currently triggered by detected tracking — N/A now

No analytics/ad pixels were detected in source or public markup. Do not add a decorative banner for essential authentication alone. Inventory again before enabling analytics, Meta CAPI, enhanced conversions, embedded media, or other non-essential storage. Consent Mode v2 is conditional on Google advertising/analytics usage and applicable consent choices. GPC handling is conditional on sale/sharing and legal coverage.

### EMAIL-01 — Domain authentication is incomplete — P1

- SPF: no root-domain TXT record returned.
- DKIM: `resend._domainkey.kramflow.me` exists; the published RSA material appears legacy-sized and should be confirmed/upgraded with Resend.
- DMARC: `v=DMARC1; p=none;` exists, which monitors but does not quarantine/reject.
- MX: none returned; that is not automatically a sending defect but means reply/bounce handling must use configured provider domains/routes.
- Delivered headers: unavailable, so SPF/DKIM alignment and actual From `notifications@kramflow.me` remain unverified.

Invites are transactional. One-click unsubscribe is not required for those messages; it becomes relevant for bulk marketing/subscription mail. Test a real invite into Gmail/Outlook and inspect Authentication-Results, aligned domains, DKIM algorithm/key, From, Reply-To, and link origin.

## Mobile / Responsive

At the sampled narrow viewport, the document width equaled the body width and the menu was usable; no page-level horizontal scroll was observed. The menu trigger measured 44 px and labels remained explicit. The hero intentionally clips oversized art, which contributes to mobile image waste. Authenticated mobile/tablet layouts—especially cue tables, settings panels, broadcast composition, and dialogs—were not stable enough to test in production and remain a release gate at 320/375/768/1024/1440 widths.

## Reliability / Error Handling

Loading and empty states are intentionally separated in the console, and the component library includes toasts, error states, confirmations, and connection indicators. Destructive event/session actions use confirmation patterns in source. Gaps:

- no centralized production error monitoring (P1);
- rehearsal completion dead-end (P1);
- no field telemetry for slow/failing live operations (P1 verification gate);
- production backups/PITR, restore drill, RPO/RTO are unverified;
- authenticated offline/reconnect/concurrent-controller behavior was not safely exercised;
- some fetch paths suppress errors or rely on console logs, which can leave users without actionable recovery.
- cue-sheet import can partially commit session rows before its program-replacement transaction fails;
- empty imported sessions are not included in the replacement ID list, so stale programs can survive;
- the active External API control surface cannot acquire the required controller lease.

## Image-Derived Checklist

The nine supplied captures were read and duplicates were consolidated. “Applies” means useful for this product; a checklist idea is not automatically a defect.

### Security, SEO, legal, and launch basics

| Item / meaning | Applies | Status | Priority / evidence |
|---|---:|---|---|
| RLS: tenant/event row isolation | Yes | UNVERIFIED | P1 gate; source policies exist, production negative tests unavailable. |
| Keep privileged keys server-side | Yes | PASS | Service role only in server modules/scripts. |
| Lock admin routes | Yes | FAIL/PARTIAL | Anonymous representative APIs returned 401, but flagged temp-password sessions bypass the page-only force-change rule and viewer-level guards authorize three state mutations. P1. |
| Rate-limit login/signup | Yes | PARTIAL | Persistent source implementation; live abusive test avoided. |
| Turnstile/forms spam control | Conditional | N/A/PARTIAL | No public lead form; auth is rate-limited. Add challenge only if abuse warrants it. |
| CSP + HSTS | Yes | FAIL/PASS | CSP missing; HSTS present. P1. |
| Dependency audit | Yes | PASS/PARTIAL | npm reports zero; direct SheetJS URL needs separate review. |
| Force HTTPS | Yes | PASS | HTTPS and permanent root redirect. |
| Error tracking | Yes | FAIL | None detected. P1. |
| Daily DB backups | Yes | UNVERIFIED | Supabase dashboard/restore evidence unavailable. P1 gate. |
| Honest sitemap `lastmod` | Yes | PASS | No lastmod is published, avoiding false freshness. |
| Canonical tags | Yes | PARTIAL | Tag correct; app alias not redirected. |
| Remove accidental noindex | Yes | PASS | Home indexable; 404 correctly noindexed. |
| Applicable schema | Optional | PARTIAL | No JSON-LD; Organization/SoftwareApplication could be added truthfully. LocalBusiness is not applicable. |
| Author bylines | No current articles | N/A | Not a generic product-page requirement. |
| No orphan public pages | Yes | PARTIAL | Public inventory is tiny; legal pages are missing rather than orphaned. |
| AI search bot policy | Conditional | PARTIAL | Wildcard allow; explicit business policy absent. |
| INP <200 ms | Yes | UNVERIFIED | Field interaction data unavailable; TBT is not INP. |
| `llms.txt` | Optional | N/A | Not a launch requirement. |
| FAQ schema | No FAQ | N/A | Do not add invisible/irrelevant markup. |
| SPF/DKIM/DMARC | Yes | FAIL/PARTIAL | SPF absent, DKIM present but needs key/header verification, DMARC monitor-only. |
| One-click unsubscribe | Marketing only | N/A for invites | Required only for covered bulk subscription mail. |
| Phone consent | No phone flow | N/A | No phone/SMS collection detected. |
| GPC | Conditional | N/A now | Reassess if data is sold/shared or law applies. |
| Consent-first / Consent Mode v2 | Conditional | N/A now | No ad/analytics stack detected. |
| WCAG 2.2 AA | Yes | PARTIAL | Contrast failure plus manual coverage gaps. |
| Meta CAPI / enhanced conversions | No ads detected | N/A | Do not add without a measurement strategy and consent analysis. |
| UTM capture | Useful | FAIL/P3 | No acquisition attribution detected. |
| Privacy policy / terms | Yes | FAIL | Both routes 404. P1. |
| Secrets off frontend | Yes | PASS | Static separation passes. |
| Cookie consent | Conditional | N/A now | No non-essential tracking found. |
| Meta titles/descriptions | Yes | PASS | Home/login are titled; home description present. |
| Social preview image | Yes | FAIL/P2 | OG/Twitter text exists; image missing. |
| Favicon | Yes | PASS | Served in production. |
| Sitemap + robots | Yes | PASS | Both served; private routes disallowed. |
| Alt text | Yes | PARTIAL | Sampled marketing images named; full authenticated inventory unverified. |
| Image compression | Yes | FAIL/P2 | Lighthouse estimates 176 KiB savings. |
| Color contrast | Yes | FAIL/P2 | Ten tiny labels at 2.29–2.51:1. |
| Mobile friendliness / horizontal overflow | Yes | PARTIAL | Landing narrow-width pass; app surfaces unverified. |
| Custom 404 | Yes | PASS | Correct 404/noindex/recovery actions. |
| Broken links/buttons | Yes | PARTIAL | Sampled public links pass; legal targets absent; authenticated sweep incomplete. |
| Form validation | Yes | PARTIAL | Login native validation and source schemas; full error/success sweep incomplete. |
| Spam protection | Conditional | PARTIAL | Auth throttling; no public form. |
| Analytics | Product decision | FAIL/P3 | None detected; privacy-friendly but no acquisition/field reliability data. |
| Clear CTA | Yes | PASS | “Start for free” and Login are clear. |

### Project and engineering setup

| Item | Status | Evidence / interpretation |
|---|---|---|
| PRD; value/pain/ICP; non-goals; task breakdown | PARTIAL | Product/design docs and phase notes exist; completeness against current launch scope was not audited line-by-line. |
| Markdown docs / README / CLAUDE.md | PASS | README, design and agent documentation present. |
| Plugins/tools documented | PARTIAL | Tooling/config exists; no release operator inventory verified. |
| GitHub / `.gitignore` / small commits | PASS/PARTIAL | Git remotes and ignore file present; commit-size discipline not exhaustively reviewed. |
| Brand doc / design system | PASS | DESIGN docs, tokens, and shared components exist. |
| Locked tech stack | PASS | Package lock and detected stack. |
| DB/auth setup | PARTIAL | Supabase migrations and auth code exist; production state unverified. |
| Environment variables | PASS/PARTIAL | `.env.example` documents variables; deployed completeness not inspected. |
| Staging vs production | UNVERIFIED | No staging environment was tested. P2 operational gate. |
| Folder structure | PASS | Clear app/components/lib/supabase separation. |
| Error tracking | FAIL | None detected. |

Second-pass additions: the production `/dev/components` catalog is publicly accessible despite being labeled internal; non-home routes inherit incorrect home canonical/OG URLs; the temporary-password API bypass and viewer-write endpoints make “lock admin routes” a confirmed P1 authorization concern rather than only an unverified matrix item.

### UI polish inventory

| Item | Status | Priority / evidence |
|---|---|---|
| Horizontal scroll / mobile overflow | PARTIAL | Landing pass at 325 px; app unverified. |
| Mobile menu | PASS | Labeled, opens/closes, section link works. |
| Page titles/descriptions | PARTIAL | Public/auth sampled; app-wide uniqueness unverified. |
| Footer links/copyright year | FAIL/P3 | Footer only brand/login; legal links and copyright absent. Legal links P1, year P3. |
| Success/error/loading states | PARTIAL | Component patterns exist; full flow coverage incomplete. |
| Placeholder text / unused nav | FAIL/PARTIAL | No fake placeholder content seen publicly; External API is visible but its control actions cannot acquire the required lease. |
| Clickable logo/phone/email | PARTIAL/N/A | Logo navigation present; no public phone/email. |
| Dark-mode toggle | N/A | Dark visual theme is the product; no alternate theme requirement established. |
| Cookie banner | N/A now | No non-essential trackers detected. |
| Site search | N/A | Small marketing site; app uses scoped selection/search where needed. |
| Back-to-top | N/A/P3 | Not needed for the current short page. |
| Loading animation/skeletons | PARTIAL | Loading states/skeletons exist in app source; full timing unverified. |
| Hover states | PASS/PARTIAL | Shared controls define them; touch/keyboard equivalents require full sweep. |
| Scroll progress | N/A | No long-form reading surface. |
| Copy button | PASS where relevant | Integration/share/broadcast copy controls exist in source. |
| Print stylesheet | PASS/PARTIAL | Dedicated cue-sheet print/report routes exist; actual print output not tested. |
| Sticky headers | PARTIAL | Used on operational surfaces; obstruction at zoom unverified. |
| Skip-to-content | FAIL/P2 | None found. |
| Password visibility | FAIL/P2 | Not present on login. |
| UTM tracking | FAIL/P3 | Not detected. |
| Confirmation modals | PASS/PARTIAL | Destructive confirmations exist; rehearsal exit lacks one while active. |
| Last-updated date | N/A | No documentation/news pages. |
| Expandable FAQ | N/A | No FAQ content. |
| Floating contact | N/A/P3 | No support model established; avoid clutter. |

### Performance remedy checklist

| Item | Status | Evidence-based conclusion |
|---|---|---|
| Compress/downsample images; correct responsive sizes | FAIL | Direct Lighthouse opportunity; do before launch. |
| Lazy-load off-screen media/defer non-critical work | PARTIAL | Framework image behavior present; audit still found media/unused-JS opportunity. |
| Preload critical data/media | PARTIAL | LCP image lacks explicit high priority; validate after responsive fix. |
| Reduce main-thread work/move parsing off-thread | PASS public / UNVERIFIED import | Landing TBT 10 ms; large Excel parsing on low-end devices unprofiled. |
| Remove unused dependencies/JS | PARTIAL | Lighthouse estimates 62 KiB unused JS; route-level source needed before removal. |
| Cache API responses | UNVERIFIED | Realtime operational truth makes blanket caching risky. Profile first. |
| Paginate long lists/recycle list cells | UNVERIFIED | No representative large event dataset profile. |
| Debounce search/cancel in-flight requests | UNVERIFIED | No measured request storm. |
| Loading skeletons | PARTIAL/PASS | App has explicit loading/skeleton states. |
| N+1 queries / DB indexes | UNVERIFIED | Requires production-like query plans and slow-query evidence. |
| Batch requests/compress payloads | UNVERIFIED | No representative authenticated waterfall captured. |
| Profile browser/app launch | PARTIAL | Public Lighthouse complete; authenticated field/lab profile pending. |

## Recommended Launch Sequence

1. Fix rehearsal Finish and add its regression tests.
2. Enforce the role matrix on every mutation and block `must_change_password` sessions at shared API guards.
3. Hide External API as Coming Soon or implement a safe, tested integration lease lifecycle.
4. Make import transactional; close the import → select → console → start path and enforce session validity server-side.
5. Canonicalize every host; remove/protect the internal catalog; correct route metadata/index controls.
6. Publish reviewed privacy/terms; complete SPF/DKIM/DMARC delivered-message verification.
7. Add error monitoring and verify backup/restore/RPO/RTO.
8. Roll out CSP report-only, resolve violations, then enforce.
9. Fix landing contrast and responsive/LCP images; the second Lighthouse run reproduced 3.6 s LCP.
10. Execute two-user production/staging RLS and role-denial tests plus authenticated responsive/keyboard/performance sweeps.

## Not Verified / Needs Access

- exact deployed commit and environment-variable values;
- complete signed-in dashboard/events/cue-sheet/display/broadcast/remote/profile flow;
- safe production creation/import/session start (would mutate data);
- actual logout result and back-button behavior (would terminate the user’s session);
- two-user cross-tenant RLS/role/revocation tests;
- collaborator invite receipt and delivered email headers;
- Supabase Security Advisor, backup retention/PITR, restore drill;
- staging parity and deployment rollback;
- field p75 Core Web Vitals and authenticated-route performance;
- offline/reconnect, competing controller lease, realtime burst, and long-duration soak tests;
- comprehensive 320/375/768/1024/1440 app reflow, 200% zoom, screen reader, and keyboard audit;
- analytics/ad/marketing intent, legal jurisdictions, and whether External API is contractually launch-ready.

## Primary Standards

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google sender requirements](https://support.google.com/mail/answer/81126)
- [RFC 9989 DMARC](https://www.rfc-editor.org/rfc/rfc9989)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Nielsen’s usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)

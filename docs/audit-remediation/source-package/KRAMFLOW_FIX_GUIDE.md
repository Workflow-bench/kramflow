# KramFlow Pre-Launch Fix Guide

This guide covers confirmed issues and evidence-supported release gaps. It avoids redesigning KramFlow’s product model. Resolve P1 items first, then rerun the stated acceptance checks.

## P1 — Rehearsal Finish is disabled

**Wrong:** At the final cue, the primary control reads **Finish** but is disabled. The alternate finish action is hidden.

**Why it matters:** The core rehearsal cannot complete and has no trustworthy ending—the highest-impact point in the workflow.

**Likely root cause:** One condition is used for both “already finished” and “currently at the final cue”: `disabled={isFinished || currentOrder >= max}`. The state transition expects an order beyond `max`, but no control can produce it.

**Fix:** Enable Finish when `currentOrder === max`; call a dedicated completion action. Render a concise completion summary. Preserve the current architectural guarantee that rehearsal never writes live state.

**Acceptance criteria:**

- zero-cue, one-cue, and multi-cue sessions have defined behavior;
- Finish is pointer- and keyboard-operable at the last cue;
- completion appears once and provides Exit / Run again;
- no `/api/live` request or live display update occurs;
- automated regression tests cover boundary states.

## P1 — Excel import does not lead clearly to a runnable session

**Wrong:** Import refreshes session data but does not set the live active session. Console can show “Select a session to get started” without an inline choice/action.

**Why it matters:** A successful onboarding action appears to strand the operator immediately before the product’s main job.

**Root cause supported by source:** imported sessions and live active session are separate state. The cue sheet defaults its local view to the first session, while live state remains empty. The server also upserts sessions before a separate replacement RPC, so the operation is not fully atomic; it derives affected IDs from programs, omitting empty imported sessions.

**Fix:** Move session upsert and affected-session program replacement into one transaction. Derive affected IDs from parsed sessions and return generic client errors. On success, identify the imported/default session, show it in the success state, and offer **Open Console with [session]**. On activation, validate that the session belongs to the event. If multiple sessions exist, require an explicit choice rather than guessing.

**Acceptance criteria:** New event → valid XLSX → confirmation → session selection → Console → Start works without a hidden header action. Refresh preserves a coherent choice. Invalid/empty/duplicate/oversized files show actionable errors and do not partially mutate data.

## P1 — Viewer/editor role promises are bypassed by stage-state APIs

**Wrong:** KramFlow says viewers are read-only and only owners run the live show. The shared `verifySessionAccess` guard accepts `viewer`, and the hold, timer, and speaker-ready PATCH routes use it before service-role writes.

**Why it matters:** A viewer can bypass disabled UI and change operational state through direct authenticated requests. Hold and timer changes can affect live displays.

**Fix:** Write the intended permission matrix first. Require owner for live/display mutations unless a specifically named backstage role is introduced. Keep read-only display-token behavior separate. Do not rely on hidden/disabled controls.

**Acceptance criteria:** Direct endpoint tests prove viewer and editor receive 403 for every owner-only mutation; owner succeeds; unrelated and anonymous users fail generically; UI text matches server truth.

## P1 — Forced password replacement is only a page redirect

**Wrong:** invited users with `must_change_password=true` are forced to `/set-password` for pages, but proxy exempts `/api/` and shared API guards ignore the flag.

**Why it matters:** Anyone holding the temporary emailed password can create a session and use authenticated APIs without completing the promised credential replacement.

**Fix:** Add the flag check to shared user/event API authorization. Narrowly allow auth login/logout/set-password and endpoints whose authorization is intentionally a display/integration token rather than a user session.

**Acceptance criteria:** A flagged user can log in, set a password, or log out—and nothing else. Event reads, invitation acceptance, cue edits, exports, live actions, and stage-state writes all fail until the flag is cleared.

## P1 — External API control cannot obtain the controller lease

**Wrong:** Settings creates credentials and documents control actions, but the adapter forwards a synthetic integration client ID to owner-locked actions without exposing claim/renew/release/takeover. Normal calls therefore hit 423 Locked.

**Why it matters:** A visible integration feature promises control that cannot work reliably, exactly the concern behind marking it Coming Soon.

**Fix:** Safest pre-launch choice: disable credential creation and label the control feature Coming Soon. To ship it, define lease acquisition, renewal, expiry, takeover, idempotency, replay/rate limits, and human-operator precedence; never bypass the existing lease silently.

**Acceptance criteria:** A documented integration can acquire and renew control, perform each allowed action, release/expire safely, and receive deterministic 401/403/409/423 behavior. Human takeover and audit logs are verified under concurrency.

## P1 — Production aliases are not canonicalized

**Wrong:** `kramflow.me` redirects to `www`, while `app.kramflow.me` independently serves the same application.

**Why it matters:** duplicate origins complicate cookies, OAuth/email redirects, CORS, cache, SEO, support, and logout. The source does not configure a cross-subdomain auth cookie.

**Fix:** Choose the single canonical app origin and issue permanent redirects for every other public alias before auth middleware. Update allowed redirect URLs, public base URL, Resend links, sitemap, canonical/OG metadata, and docs.

**Acceptance criteria:** All HTTP/HTTPS and root/www/app variants settle in one hop on the chosen origin. Login, refresh, invite acceptance, recovery, logout, and Back behavior work from every starting alias. No authenticated API request is cross-origin.

## P1 — Privacy and terms are missing

**Wrong:** `/privacy` and `/terms` return 404 and are not linked.

**Why it matters:** The service creates accounts, processes collaborator/event data, and sends email. Users lack required trust and disclosure surfaces.

**Fix:** Have counsel/product owners approve accurate policies; publish stable routes and link them from footer and signup/account surfaces. Include effective/last-updated dates on the policies themselves.

**Acceptance criteria:** Routes return 200, are readable at mobile/zoom, appear in footer/signup, and match actual subprocessors/data retention/contact practices. Do not copy generic policy text blindly.

## P1 — No production error monitoring

**Wrong:** No central error-tracking integration was found.

**Why it matters:** Live-event incidents are time-sensitive; console logs and user reports cannot support rapid diagnosis or regression correlation.

**Fix:** Add server/client exception monitoring with release IDs, environment tags, health alerts, and carefully redacted context. Define alert ownership and runbook links.

**Acceptance criteria:** A controlled test error is captured in staging from client and server; alerts reach an owner; tokens, passwords, emails, cue remarks, and tenant data are absent; source maps and release SHA resolve correctly.

## P1 — CSP is absent

**Wrong:** Production has useful security headers but no CSP.

**Why it matters:** CSP is defense-in-depth against script/content injection and restricts the blast radius of an XSS defect.

**Fix:** Inventory required origins and inline behavior. Deploy `Content-Security-Policy-Report-Only` with nonces/hashes, collect violations, remove unsafe allowances, then enforce. Include `frame-ancestors` even though X-Frame-Options exists.

**Acceptance criteria:** landing, auth, app, Supabase, Resend-linked routes, fonts/images, realtime, and downloads work under enforcement; injected inline script is blocked; reports contain no sensitive URLs/data.

## P1 — Email authentication is incomplete

**Wrong:** No root SPF TXT was returned; DMARC is `p=none`; DKIM exists but appears legacy-sized. Actual aligned delivery was not verified.

**Why it matters:** invite delivery, spoof resistance, and provider reputation depend on correct authentication and alignment.

**Fix:** Follow Resend’s verified-domain configuration. Publish the exact provider SPF/return-path records without creating multiple SPF records. Confirm a modern DKIM key. Send test invites, inspect `Authentication-Results`, then move DMARC gradually from monitoring to enforcement after aggregate reports are clean.

**Acceptance criteria:** representative Gmail and Outlook messages show aligned SPF or DKIM and DMARC pass; DKIM uses current recommended algorithms/key length; DMARC reporting is monitored; reply/bounce path is defined. One-click unsubscribe is required only if KramFlow later sends covered bulk marketing mail.

## P1 release gate — Prove RLS, permissions, and revocation

**Wrong:** The design looks sound, but production policy state and denial paths were not testable with one account.

**Why it matters:** multi-tenant live-event data and controls need server-enforced isolation, not UI hiding.

**Fix:** Run a release matrix with unrelated users and owner/editor/viewer roles across every event-owned table and API. Include guessed IDs, direct REST calls, stale sessions, removed collaborators, share tokens, integration credentials, and live actions.

**Acceptance criteria:** allowed paths succeed; every cross-event and over-privileged read/write returns a generic denial/404; revoked access fails after refresh and direct request; Supabase Security Advisor is clean; applied migration IDs are recorded.

## P1 release gate — Backups and recovery are unproven

**Wrong:** No Supabase plan/retention/PITR or restore evidence was available.

**Fix:** Document RPO/RTO, automated backup retention, PITR status, owner, restore procedure, and a staged restore drill. Include deleted event/live-state and credentials in recovery scope.

**Acceptance criteria:** a dated restore drill succeeds within RTO, data is consistent, secrets are rotated where needed, and the runbook is accessible during an incident.

## P2 — Lock icon performs logout

**Wrong:** Event pages label sign-out as Lock; dashboard labels the same action Log Out.

**Fix:** use Lucide `LogOut`, visible “Log out” when space permits, and `aria-label="Log out"`. Reserve Lock for a future action that preserves the session.

**Acceptance criteria:** dashboard and every event surface use the same icon, label, tooltip, accessible name, confirmation policy, and redirect.

## P2 — Logout lands on login

**Wrong:** the handler navigates to `/login`; the requested behavior is public home.

**Fix:** after the server confirms/attempts cookie clearing, replace location with `/` if product intent is confirmed. Ensure failure does not leave a misleading authenticated UI.

**Acceptance criteria:** both logout entry points clear the session, land on home, Back cannot reveal a usable authenticated surface, and direct app URLs return to auth safely.

## P2 — Mobile landing LCP needs improvement

**Wrong:** Lighthouse mobile LCP is 3.6 s; desktop is 0.6 s. The hero requests/renders an image far wider than the viewport and image audit estimates roughly 176 KiB savings.

**Fix:** correct responsive `sizes`/source widths, downsample/compress hero/product images, and test `fetchpriority="high"` only for the actual LCP image. Defer non-critical media. Address the measured 62 KiB unused JS only after bundle attribution.

**Acceptance criteria:** two cold mobile Lighthouse runs have median LCP ≤2.5 s with no regression in CLS/TBT; the LCP request matches display size/DPR; field p75 is monitored after traffic exists.

## P2 — Landing micro-label contrast

**Wrong:** ten 10–11 px labels measure about 2.29–2.51:1.

**Fix:** raise text contrast to ≥4.5:1 or remove text semantics if genuinely decorative. Do not merely increase weight without remeasurement.

**Acceptance criteria:** automated computed-color audit passes and labels remain readable in high-contrast/zoom conditions.

## P2 — Login recovery and password usability

**Wrong:** no forgot-password route/link or visibility toggle was found.

**Fix:** add a rate-limited recovery flow using generic responses and safe redirect allowlists. Add an accessible show/hide control that does not clear input or block password managers/paste.

**Acceptance criteria:** recovery works for existing/non-existing addresses without enumeration; expired/used links fail clearly; visibility state is announced; keyboard, paste, and managers work.

## P2 — Missing social-share image

**Wrong:** OG/Twitter title and description exist; image is missing.

**Fix:** publish a correctly sized branded image with absolute secure URL and useful alt where supported.

**Acceptance criteria:** major social/link debuggers retrieve the image from the canonical URL; it remains legible in common crops.

## P2 — Internal component catalog is public

**Wrong:** `/dev/components` returns 200 in production, is publicly cached, and labels itself internal. `robots.txt` disallows it but does not prevent access.

**Fix:** exclude the route from production builds or require real authorization. Add `noindex` as defense in depth, not as the access control.

**Acceptance criteria:** an anonymous production request returns 404 or authenticated denial; no catalog chunks or links are publicly discoverable.

## P2 — Global homepage canonical leaks onto every route

**Wrong:** sampled login, signup, set-password, screen picker, TV, custom display, and dev catalog pages all emit canonical and OG URL for the homepage. Login/signup are simultaneously listed in the sitemap.

**Fix:** decide which public routes should index. Give indexable pages self-canonicals and unique metadata. Give auth, token/display, internal, and private surfaces `noindex` and keep them out of the sitemap. Remember robots disallow can prevent crawlers from seeing `noindex`.

**Acceptance criteria:** every route has intentional title, description, canonical, OG URL, robots directive, and sitemap status with no conflicting signals.

## P2 — Skip link and authenticated accessibility sweep

**Wrong:** no skip-to-content link; full app keyboard/zoom behavior remains unverified.

**Fix:** add a focus-visible skip link targeting the main landmark. Test focus order/return, modals, menus, cue controls, sticky headers, 200% zoom, and 320 CSS px reflow.

**Acceptance criteria:** every workflow is keyboard-complete, focus is visible/not obscured, no trap occurs, and meaningful content is available without two-dimensional page scrolling (data-table exceptions handled locally).

## P3 — Acquisition measurement is absent

No analytics or UTM capture was detected. This is not inherently broken. If acquisition measurement is needed, define a minimal first-party event/UTM model, retention, consent basis, GPC response, and privacy disclosure before adding tags. Avoid adding Meta/Google tooling merely because it appears in a launch checklist.

## Reverification pack

After fixes, run:

1. unit/browser tests for rehearsal boundaries and imported session activation;
2. alias/auth/invite/recovery/logout matrix;
3. two-user RLS/API role matrix and revocation;
4. mobile/desktop Lighthouse twice plus authenticated route traces;
5. keyboard, focus, screen-reader sampling, 200% zoom, and breakpoint sweep;
6. CSP report-only review then enforcement smoke test;
7. delivered invite header authentication review;
8. backup restore drill and monitored test exception.

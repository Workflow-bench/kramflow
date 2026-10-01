# KramFlow Pre-Launch Fix Summary

Launch verdict: **hold for the P1 items below.** No P0 issue was confirmed. Status reflects what was actually tested: PASS, FAIL, PARTIAL, or UNVERIFIED.

## A) Visual / UI / UX

### Fix before launch

| Priority | Status | Action |
|---|---|---|
| P1 | FAIL | **Make Rehearsal Finish work.** On the last cue, the button says Finish but is disabled. Show a clear completion summary and keep rehearsal isolated from live screens. |
| P1 | FAIL/PARTIAL | **Make Excel import atomic and connect it to the next action.** Session upserts currently commit before the program-replacement RPC. Move both into one transaction, include empty imported sessions, then make the selected/default session and “Open Console” action obvious. |
| P2 | FAIL | **Replace Lock with Log out.** The event header currently uses a lock icon/label to sign the user out, while the dashboard correctly says Log Out. Use the same Lucide LogOut icon and words everywhere. |
| P2 | FAIL | **Improve rehearsal exit.** Warn only when an active rehearsal has progress that will be discarded; after Finish, show results and obvious Exit / Run again choices. |
| P2 | PARTIAL | **Strengthen login without overdesigning it.** Add Forgot password, a show/hide password control, helpful error/recovery text, and a small amount of product/trust context. |
| P2 | FAIL | **Fix low-contrast micro-labels.** Ten small landing labels measured about 2.29–2.51:1; normal text needs 4.5:1. |
| P2 | FAIL | **Add skip-to-content.** Keep visible focus and ensure sticky app headers never hide the focused element. |
| P2 | PARTIAL | **Simplify the first-run path, not the whole nav.** The four event destinations and labeled mobile menu are consistent. The confusing part is Event → Session → Console/Mode. Improve empty-state actions and terminology instead of adding more tabs. |
| P3 | PARTIAL | **Remove duplicate semantic headings.** Responsive landing variants currently duplicate headings/content in the DOM. |

### Requested items that are already okay or need a product decision

- **Homepage `#one-cue` URL — PASS.** A fragment URL is standard in-page navigation: it is shareable, accessible, and supports browser history. It is not a launch defect.
- **Icon library — PASS.** The UI consistently uses Lucide. Brand marks are valid custom exceptions. The logout problem is the wrong icon meaning, not mixed libraries.
- **External API — FAIL/P1.** Credentials and routes exist, but control actions require a controller lease and the integration API exposes no way to claim one. Mark it Coming Soon/unavailable until the lease lifecycle works and is tested.
- **Dark-mode toggle, site search, back-to-top, scroll progress, floating contact, FAQ — N/A.** These are not automatically useful for this product and should not be added as checklist decoration.
- **Mobile landing — PARTIAL.** The sampled narrow page had no document-level horizontal scroll and its menu worked; authenticated mobile/tablet surfaces still need a full release sweep.

## B) Development / Function / Security / Performance

### Fix before launch

| Priority | Status | Action |
|---|---|---|
| P1 | FAIL | **Make one canonical production origin.** Root redirects to `www`, but `app.kramflow.me` serves the same product. Redirect all aliases before login and verify login, invite, refresh, logout, and reset links across them. |
| P1 | FAIL | **Enforce viewer/editor/owner permissions on every write.** Viewer is advertised as read-only, but hold, timer, and speaker-ready PATCH routes currently accept viewer access and write through the service role. |
| P1 | FAIL | **Enforce temporary-password replacement in API guards.** The page proxy redirects flagged users, but explicitly exempts all `/api/` paths. Block flagged sessions in shared operator API guards except login/logout/set-password and intentionally public token endpoints. |
| P1 | FAIL | **Fix or hide External API control.** The credential UI is active, but start/hold/resume/next cannot claim the controller lease and therefore reach a 423 lock. |
| P1 | FAIL | **Publish privacy and terms.** Both `/privacy` and `/terms` return 404; link reviewed policies from footer and signup/account surfaces. |
| P1 | FAIL | **Add application error monitoring.** Capture protected exceptions, release version, and route/action context without sensitive event or credential data. Add alerts appropriate for live shows. |
| P1 | FAIL | **Deploy a tested CSP.** Begin with report-only, resolve violations, then enforce a nonce/hash-based policy. HSTS and other basic headers already pass. |
| P1 | PARTIAL | **Require a valid event session in the live-action API.** The UI cannot be the only guard against starting with an empty/wrong session. |
| P1 | FAIL/PARTIAL | **Finish email authentication.** No root SPF TXT was returned; DKIM exists but needs current key/header confirmation; DMARC is monitor-only (`p=none`). Test a real delivered invite for alignment before tightening policy. |
| P1 gate | UNVERIFIED | **Prove production RLS and permissions.** Use separate owner/editor/viewer/unrelated accounts to test every event object and revoked access. Confirm migrations and Supabase Security Advisor. |
| P1 gate | UNVERIFIED | **Verify backups and recovery.** Record retention/PITR, restore procedure, RPO/RTO, and a restore drill. |
| P2 | FAIL | **Redirect logout to the public home page** if that remains the intended product behavior; test both dashboard and event shell plus the browser Back button. |
| P2 | PARTIAL | **Improve mobile landing LCP.** Current lab LCP is 3.6 s versus the ≤2.5 s good target. Correct hero responsive sizing, downsample/compress media, and then test any preload/high-priority hint. |
| P2 | FAIL | **Add a social preview image.** OG/Twitter text is present but the image is missing. |
| P2 | FAIL | **Remove or protect `/dev/components`.** Production publicly serves a page labeled internal. A robots disallow is not access control. |
| P2 | FAIL | **Correct route metadata.** Login, signup, set-password, screens, TV, custom display, and the internal catalog all inherit the homepage canonical and OG URL. Add intentional per-route canonical/noindex behavior; remove conflicting login/signup sitemap signals if those pages should not rank. |
| P2 gate | UNVERIFIED | **Profile authenticated app routes.** Measure dashboard, cue sheet, start, rehearsal, and import on realistic data; do not add pagination/caching/virtualization without evidence. |

### What passed

- Desktop landing: Lighthouse 100, LCP 0.6 s, TBT 0, CLS 0.
- Mobile landing stability/main thread: TBT 10 ms and CLS 0.
- HTTPS/HSTS, X-Content-Type-Options, framing, referrer, and permissions headers.
- Canonical tag, robots, sitemap, favicon, meta title/description, custom 404.
- Public mobile menu, in-page anchors, clear primary CTA, reduced-motion support.
- Representative unauthenticated event, collaborator, share, export, and integration APIs returned generic 401; display-view without a token returned 403.
- Static code keeps the service role server-side and implements auth throttling/event access checks.
- Local quality checks: 149 tests passed, TypeScript passed, lint had 0 errors, and npm reported 0 known production vulnerabilities. SheetJS still needs separate direct-dependency review.

### Conditional checklist items

- **Cookie banner, GPC, Consent Mode v2, Meta CAPI, enhanced conversions:** not currently triggered because no analytics/ad stack was detected. Reassess before enabling one.
- **One-click unsubscribe:** not required for transactional collaborator invites; required for covered bulk marketing/subscription mail.
- **Phone consent:** no phone/SMS flow was found.
- **FAQ schema, LocalBusiness schema, author bylines, `llms.txt`:** not launch requirements for the current site.
- **Analytics and UTM capture:** absent. That is privacy-friendly but leaves acquisition attribution and field performance evidence missing; add only with a clear measurement/consent plan.

# KramFlow Production Test Matrix

Audit window: 2026-09-27–28 (America/Phoenix)  
Production target: `https://kramflow.me`, `https://www.kramflow.me`, `https://app.kramflow.me`  
Local comparison checkout: `/Users/deeppatel/Documents/AI/Shibir/stageflow`, HEAD `02669143dcd7677efb7c6ed83bc7b23d056780a6`

Status meanings: **PASS** directly verified; **FAIL** defect directly reproduced or proven in the executing path; **PARTIAL** mixed result or source-confirmed risk without a safe production reproduction; **UNVERIFIED** needed access or data was unavailable; **N/A** not applicable to the detected product.

| Surface/test | Status | Evidence and boundary |
|---|---|---|
| Root/canonical redirect | PASS | `kramflow.me/` returned 308 to `www.kramflow.me/`; page canonical and OG URL use `www`. |
| `app` alias canonicalization | FAIL | `app.kramflow.me/` returned 200 instead of redirecting. It serves the same page while auth cookies are host-scoped in source. Cross-host session impact is a source-based inference, not a live logout/login test. |
| Landing desktop | PASS | Browser inspection and Lighthouse; primary CTA, nav, hero, sections, and footer rendered. |
| Landing narrow mobile | PARTIAL | 325 CSS-pixel browser viewport had no document-level horizontal overflow and the menu worked; hero art deliberately overflowed/clipped. Full device matrix was not available. |
| Anchor navigation | PASS | “One cue” changed URL to `/#one-cue`, scrolled to the section, closed mobile menu, and preserved a shareable/history-aware fragment. This is expected web behavior. |
| Footer/legal links | FAIL | Footer exposes only logo/tagline/login; `/privacy` and `/terms` each returned 404. |
| Login | PARTIAL | Required-field validation, labels, autocomplete, signup link, and correct page title pass. No password reset or show-password control; visual/trust hierarchy is unusually sparse. |
| Signup/reset | PARTIAL | Signup route/code present and rate limited. No user-facing password-reset path was found. No new production account was created. |
| Authenticated settings | PARTIAL | Existing authorized Chrome session showed event Settings, collaborators, External API, and Danger Zone. User activity in the browser prevented stable end-to-end coverage. |
| Logout icon/label | FAIL | Live event header exposed “Lock”; executing source calls the logout endpoint. Dashboard separately uses `LogOut` and “Log Out.” |
| Logout destination | FAIL | Executing handler redirects to `/login`; requested product behavior is public home. Live logout was intentionally not performed. |
| Rehearsal completion | FAIL | Source renders “Finish” when at the last cue while the same condition disables the button; the alternative finish action is hidden. The completion state is unreachable through normal controls. |
| Rehearsal isolation | PASS | Source keeps rehearsal progress local and never calls live-state APIs/realtime displays. Production multi-user isolation was not independently exercised. |
| Rehearsal exit/summary | FAIL | Exit is a direct link with no unsaved-progress warning or summary; progress is disposable. |
| New event + Excel import + start | FAIL/PARTIAL | Import refreshes sessions, but no active live session is assigned. Session upsert and program replacement are separate commits, and empty imported sessions are omitted from replacement IDs. No production data was created, so the end-to-end live reproduction is unverified. |
| Icons | PASS | Product UI overwhelmingly imports Lucide icons; custom wordmark/brand graphics are appropriate exceptions. The lock glyph is semantically wrong, not a mixed-library issue. |
| “Extended API” / future feature | FAIL | Live UI/source say **External API** and expose credentials, but control actions require a controller lease while the integration API has no claim/renew/release operation. Calls are structurally locked. |
| Public console errors | PASS | No errors/warnings observed on representative public landing/login navigation. Authenticated console logging was not comprehensively captured. |
| Unauthorized API | PASS/PARTIAL | Representative event, detail, collaborator, share, export, and integration endpoints returned generic 401; display-view without a token returned 403. This is still not proof of complete authorization. |
| Viewer mutation boundary | FAIL | Product defines viewer as read-only, but hold/timer/speaker-ready PATCH routes authorize through `verifySessionAccess` at minimum viewer and then write using the service role. |
| Temporary-password API gate | FAIL | Page proxy forces `/set-password` but exempts every `/api/` path; shared authenticated/event guards do not inspect `must_change_password`. |
| RLS/cross-tenant denial | UNVERIFIED | Migrations include scoped RLS and later removal of broad policies, but production migration state and two-account negative tests were unavailable. |
| Login throttling | PARTIAL | Persistent per-identity/per-IP exponential throttling is present in source; abusive production testing was not performed. |
| Client secret exposure | PASS | Static search found service-role use only in server modules/scripts; browser uses publishable credentials. Production bundle secret scanning was limited. |
| HTTPS/HSTS | PASS | All checked aliases used HTTPS; `www` returned HSTS with `includeSubDomains; preload`. |
| CSP | FAIL | Live HTML response lacked `Content-Security-Policy` and report-only CSP. |
| Dependency audit | PASS | `npm audit --omit=dev` returned zero known production vulnerabilities. Direct URL SheetJS risk requires separate tracking and is not conclusively covered by this result. |
| Automated tests/types/lint | PARTIAL | 149/149 tests passed; TypeScript passed; lint had 0 errors and 6 warnings. This is local checkout evidence, not deployment provenance. |
| Landing performance, mobile lab | PARTIAL | Two runs: Performance 85/90; LCP 3.6 s in both; TBT 10/20 ms; CLS 0. The LCP miss is reproduced, while FCP/Speed Index varied. |
| Landing performance, desktop lab | PASS | Lighthouse: Performance 100, FCP 0.3 s, LCP 0.6 s, TBT 0, CLS 0. |
| Authenticated performance/INP field data | UNVERIFIED | No stable authenticated browser control, CrUX, Search Console, or production RUM access. |
| WCAG automated landing | PARTIAL | Lighthouse accessibility 96; ten tiny gray labels measured 2.29–2.51:1. Other automated name/target/heading checks passed. |
| Keyboard/focus/skip link | PARTIAL | Public controls were keyboard-addressable and shared focus styles exist; no skip-to-content link was found. Authenticated keyboard sweep was unavailable. |
| Reduced motion | PASS | Global CSS and Framer Motion preference handling are implemented; landing GSAP checks `prefers-reduced-motion`. |
| SEO basics | PARTIAL | Canonical, robots, sitemap, title/description, favicon pass. Social preview image and structured organization data are missing; duplicate hidden headings create semantic noise. |
| Route metadata | FAIL | `/login`, `/signup`, `/set-password`, `/screens`, `/tv`, `/custom`, and `/dev/components` all emitted the homepage canonical and OG URL. Login/signup also appear in sitemap. |
| Internal production catalog | FAIL | `/dev/components` returns 200, is publicly cached, and visibly labels itself internal. Robots disallow is not access control. |
| 404 | PASS | Unknown route returned HTTP 404, `noindex`, branded recovery UI, and home/dashboard choices. |
| Analytics/UTM | PARTIAL | No marketing analytics/ad stack or UTM capture detected. This avoids consent debt but leaves acquisition attribution absent. |
| Consent banner/GPC/Consent Mode | N/A | No non-essential tracking was detected. Reassess before enabling analytics/ads; authentication cookies still need disclosure. |
| Email DNS | FAIL | `_dmarc` is `p=none`; no root SPF TXT was returned; Resend DKIM record exists but appears legacy-sized. Delivered-message headers were unavailable. |
| Backups/error tracking | UNVERIFIED / FAIL | Supabase backup/PITR settings unavailable. No application error-tracking SDK or configuration was found. |

# KramFlow Pre-Launch Audit Checklist

Audit date: 2026-09-27 (America/Phoenix)  
Mode: Read-only production audit; no fixes, deploys, migrations, destructive actions, or production data mutation.

## Evidence rules

- `PASS`: directly verified and no defect observed within the stated test.
- `FAIL`: defect reproduced with concrete evidence.
- `PARTIAL`: some requirements pass, others fail, or coverage is incomplete.
- `UNVERIFIED`: access, credentials, production data, or tooling prevented a reliable test.
- Source-code evidence is not treated as proof of current production behavior unless corroborated.

## Execution checklist

- [x] Recover the referenced conversation and inspect all 9 attachments.
- [x] Identify and de-duplicate image-derived checklist items.
- [x] Locate the actual repository and record branch, commit, remotes, and dirty state.
- [x] Map production domains, redirects, routes, headers, robots, sitemap, metadata, and public links.
- [x] Test public landing/navigation/footer/CTA/404/auth surfaces where available; record responsive coverage limits.
- [x] Test sampled keyboard/focus behavior, skip link, labels, touch targets, reduced motion, and contrast; mark authenticated coverage gaps.
- [x] Capture live performance evidence and Core Web Vitals-oriented diagnostics.
- [x] Inspect console and network failures on representative public routes; mark authenticated capture limits.
- [x] Use an existing authorized session if available; never create credentials or alter production data.
- [x] Inspect authenticated Settings and trace dashboard/events/cue sheet/displays/broadcast/remote/rehearsal/account code; record browser-access limits.
- [x] Test all 11 user-reported issues explicitly with PASS/FAIL/PARTIAL/UNVERIFIED.
- [x] Inspect code paths for logout, anchors, Excel import/session activation, rehearsal exit, icons, External API, auth/RLS, and error handling.
- [x] Run non-mutating repository checks: tests, lint, typecheck, and dependency/security audit.
- [x] Review RLS policies, server-only secrets, admin-route protection, throttling, CSP/HSTS/HTTPS, error tracking, and backup evidence.
- [x] Review SEO/discoverability, legal/consent/email, analytics/UTM, marketing forms, and applicability.
- [x] Review every image-derived item and classify applicability/status/priority/evidence.
- [x] Re-test launch-critical findings through a second evidence path when feasible.
- [x] Produce full report, two-section fix summary, fix guide, test matrix, and evidence index.
- [x] Second-pass route inventory: all page/API routes, public internal surfaces, metadata/index signals, and representative unauthenticated API denials.
- [x] Second-pass authorization review: viewer/editor/owner mutations, temporary-password enforcement, integration lease behavior, and invitation flow.
- [x] Second-pass import integrity review: transaction boundary, empty-session replacement, error disclosure, and parser limits.
- [x] Repeat mobile Lighthouse measurement and reconcile variable metrics.

## Coverage note

An existing authorized Chrome session permitted a limited Settings/header inspection. Active user interaction made stable end-to-end automation unsafe, so no production data was created and no live logout, import, credential creation, collaborator invite, rehearsal run, or destructive action was performed. Those boundaries are marked explicitly in the reports.

## Initial environment record

- Live request: `https://kramflow.me` redirected to canonical `https://www.kramflow.me/` in the browser.
- Local checkout: `/Users/deeppatel/Documents/AI/Shibir/stageflow`.
- Local branch: `docs/finalize-project-documentation...canonical/docs/finalize-project-documentation`.
- Local HEAD: `02669143dcd7677efb7c6ed83bc7b23d056780a6`.
- Local tree contains unrelated untracked directories; audit will not modify them.

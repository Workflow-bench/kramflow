# KramFlow Audit — Second-Pass Addendum

Date: 2026-09-27–28  
Mode: read-only; no production or source changes

This pass deliberately looked for blind spots rather than repeating the original browser tour. It inventoried every app/API route, traced permission and temporary-password guards, followed External API actions through the controller lease, reviewed import transaction boundaries, sampled public metadata on non-home routes, repeated representative anonymous API checks, and ran Lighthouse a second time.

## Newly confirmed findings

### P1 — Viewer role can mutate operational display state

KramFlow’s source and UI define viewers as read-only and editors as cue-sheet editors who cannot run the live show. Three PATCH endpoints—hold, timer, and speaker-ready—guard with `verifySessionAccess`, which accepts the minimum `viewer` role, then write through the service-role client. This is a server-side permission mismatch, not merely an enabled button.

### P1 — Temporary-password replacement is not an API boundary

New invited users receive a temporary password and `must_change_password=true`. The page proxy redirects them to set a permanent password, but it expressly excludes all `/api/` routes. Shared API guards validate the session but not the flag. A flagged session can therefore use authenticated APIs before completing the forced-change flow.

### P1 — External API control cannot claim its required lease

Settings exposes credential creation, and the adapter lists start/hold/resume/next. Each maps to a locked live action with client ID `integration:<credentialId>`, but no integration claim/renew/release/takeover action exists. The normal result is 423 Locked. This validates the user’s concern: hide/mark the feature Coming Soon until repaired, or implement a complete lease lifecycle.

### P1 — Excel import is not fully atomic

The route commits session upserts before calling a separate transaction for partitions/programs. If that second call fails, partial session state remains. It also derives replacement session IDs from programs, so an empty imported session does not clear old programs. Raw database messages are returned on these failure paths.

### P2 — Internal component catalog is public

`https://www.kramflow.me/dev/components` returns 200, is publicly cached, and labels itself “Kramflow · internal.” `robots.txt` disallows `/dev/`, but that neither protects the page nor guarantees de-indexing. Exclude it from production or authenticate it.

### P2 — Non-home metadata is incorrect

Live HTML for login, signup, set-password, screens, TV, custom display, and the internal catalog all uses the homepage canonical and OG URL. Login/signup are also in the sitemap, creating conflicting search signals. Add intentional self-canonicals for genuinely indexable pages and `noindex`/sitemap exclusion for private, token, auth, and internal surfaces.

## Reverification results

- Second mobile Lighthouse: Performance 90, FCP 0.9 s, LCP 3.6 s, Speed Index 1.9 s, TBT 20 ms, CLS 0.
- First mobile Lighthouse: Performance 85, FCP 2.2 s, LCP 3.6 s, Speed Index 4.8 s, TBT 10 ms, CLS 0.
- The important result is stable: **mobile LCP was 3.6 s twice**. Both runs also found the same ten contrast failures.
- Representative anonymous APIs for events, event detail, collaborators, share links, cue export, and integration state returned generic 401. Display-view without a token returned 403 `no_token`.
- HTTPS redirect behavior was reconfirmed for root, www, and app. The app alias still remains on its own HTTPS origin rather than redirecting to www.

## Effect on launch verdict

The verdict remains **HOLD**, but the authorization and External API findings move ahead of cosmetic/performance polish. Recommended immediate order:

1. enforce the viewer/editor/owner write matrix;
2. enforce `must_change_password` in shared operator API guards;
3. hide External API or implement/test integration lease ownership;
4. fix rehearsal completion;
5. make import transactional and repair the imported-session handoff;
6. then complete canonical-host, legal, CSP, monitoring, email, accessibility, and mobile-performance gates.


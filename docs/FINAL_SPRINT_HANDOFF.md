# Kramflow — Final Sprint Handoff

This document is for whoever has GitHub and Supabase access and is picking this up fresh — it assumes no prior context on this sprint.

- **Branch:** `pilot-readiness-hardening`
  (Note: the branch was originally going to be named `deep/pilot-readiness-hardening`, but git can't create that alongside an existing branch literally named `deep` — a slash makes `deep` a folder in git's ref storage, and it's already a file. `deep` itself was left untouched; this branch was cut from its current HEAD instead.)
- **Base:** `deep` at commit `f6f92c8` (this branch is that commit, exactly — nothing added or removed on top of it)
- **Supabase production project:**
  - ref: `ledtrtpxvmcpwupafehk`
  - URL: `https://ledtrtpxvmcpwupafehk.supabase.co`

## Purpose of this sprint

Kramflow started this sprint in an inconsistent, partially-verified state — a real UI/UX pass had happened, but several release-blocking correctness issues (a security-relevant one, a broken collaborator feature, a confusing same-tab UI bug, and three permission-truth bugs where the UI let people attempt things the server would reject) hadn't been found or fixed yet. This sprint's job was to find those systematically, fix the real ones, verify each fix against the actual running app (not just "it compiles"), and leave the codebase and the live database migration path in a state a professional live-event operations product needs to actually run pilots and, eventually, paid events.

In plain terms: **this sprint is what turns Kramflow from "looks done" into "is actually trustworthy under a live show."**

---

## What's already complete (no Supabase needed)

Everything below is finished, verified against the running app, and safe as-is on this branch. None of it requires the pending database migrations.

### A. UI / UX / Design System

- One canonical component library (buttons, inputs, dialogs, tooltips, badges, form fields) replacing several one-off, independently-styled versions of the same control.
- `EventShellHeader` — one shared two-tier header (event identity + navigation) used across every in-event screen instead of each page inventing its own.
- A real Console/Stage design separation: operator-facing screens (dense, functional, dark) are visually and structurally distinct from audience-facing display output (calm, legible, TV-safe) — enforced by an actual lint rule, not just convention.
- Responsive passes across Operator, Rehearsal, Cue Sheet, Dashboard, Displays, and Remote — including fixing genuine horizontal-overflow bugs, not just narrowing breakpoints.
- Operator mobile hierarchy re-ordered so the controls and current-item state a stage manager needs mid-show come before the full cue list, matching how the desktop layout already prioritized it.
- Rehearsal's mobile layout brought in line with Operator's, so practicing on a phone builds the same muscle memory as running the real show on one.
- Dashboard redesigned from an expand/collapse card list to a scannable event grid, with real per-event readiness data instead of decoration.
- Displays turned into a real fleet-management surface (health status, filtering, bulk actions) instead of a flat list.
- Broadcast Center redesigned around risk: recipient health is visible before you send, and destructive/emergency actions are visually distinct from routine ones.
- Cue Sheet: sticky-header layout fixed, canonical form components throughout, and import's real replace-only behavior surfaced honestly instead of implied to be a merge.
- Settings given a real top-level route and section hierarchy instead of living as a modal.
- Public display output (General/AV/Green Room/Presenter) given real event/room identity and legible typography, with fabricated placeholder copy removed.
- Touch targets brought to a consistent ~44px minimum on touch devices without affecting desktop/mouse sizing.
- `EventNav`'s icon-only mobile state fixed so it has a real accessible name at every width, not just above the breakpoint where the text label is visible.
- Login/Signup brought into the product's actual visual system instead of a generic auth template.
- Remote (the one-handed mobile control surface) constrained to a sensible width on desktop instead of stretching edge-to-edge like an unscaled phone screen.

### B. Operational Reliability

- A named, visible control-lease system: exactly one operator can drive the live show at a time, with a clear "who has control" indicator and an explicit "Take Over" action instead of silent last-write-wins.
- Verified multi-operator behavior directly (two real browser sessions, not one shared tab): a locked-out operator's action is rejected server-side and shown honestly, never silently swallowed or shown as if it succeeded.
- Fixed a Realtime authentication race where a channel could join anonymously before the signed-in session attached, silently missing updates.
- **Same-tab authoritative acknowledgement:** pressing Next (or any live action) used to wait for the server's own Realtime echo of your own write before showing the result — a real, measurable delay. The write was already correct; the only gap was the response discarded the computed result. Fixed by returning it and applying it immediately, without weakening the version-checked concurrency control underneath it.
- Reconnect/resync behavior verified: a dropped connection re-hydrates fully on reconnect rather than only catching the next incremental change.
- Activity log coverage expanded from "live-show actions only" to also cover cue-sheet edits, collaborator changes, and display registry changes — previously silent.
- `item_actuals` (real recorded start/end time per cue item) established as the one source of truth for "what actually happened," with a documented, deliberate limitation (only the most recent pass through an item is kept, not full history).
- Current-item drift ("Xm behind/ahead of schedule") plus a new **whole-rundown projection**: a live "projected finish" time on the Operator Console, and a "expected ~Xm late" annotation on the Next item — all derived from one shared, unit-tested timing engine, not recalculated differently in different places.
- A new **post-event timing report** (Cue Sheet → overflow menu → Timing Report): planned vs. actual, per-item variance, notable exceptions, reusing the same timing engine and the same print-to-PDF pattern Cue Sheet already had.
- **Session readiness check** on the Operator Console: before pressing Start, a real check for an empty cue sheet, missing item durations, and offline displays — previously no such check existed anywhere.
- **Session-specific reset:** an operator can now reset one session's progress (un-start it) without wiping every other session's progress, which is what the only previous "reset" action did. Scoped carefully — see the product decisions section below for exactly what it does and doesn't touch.

### C. Display System

- Real display fleet health (online/stale/offline), derived from actual heartbeat timing, not invented.
- Fixed a runaway display-registration loop that was creating duplicate registry rows.
- Broadcast Center's own "who will actually receive this" target-health check before sending.
- Public display pages given real event/room identity instead of generic placeholders.
- Presenter's countdown font now scales with the string length instead of clipping on longer values.
- **Display Profiles UI removed.** This looked like a real display-configuration feature (fonts, layout, widgets, colors) but the data it edited never reached any real display's rendering — it lived only in the editing browser's local storage. Rather than leave a professional-looking control that silently did nothing, it was removed; the underlying data model is untouched in case it's built out for real later.
- **Display-type-specific timer/hold state architecture** — see migration 0009 below; this is the one piece of C that needs Supabase to take effect.

### D. Permissions / Security Truth

- **Remote role gating:** Remote (the one-handed remote-control page) previously showed every control to every role, relying entirely on the server to reject non-owners after the fact. Every owner-only control (Start/Next/Previous/Hold/Finish/Jump/session-switch/Alert/Notes/Broadcast) now shows correctly disabled with an explanation for non-owners, matching exactly what the server already enforces. Speaker Ready (which is genuinely open to any role) was correctly left untouched.
- **Displays role gating:** same fix, same pattern, for the fleet-management page (rename, type/room, commands, remove, bulk actions).
- **Editor preview fix:** an editor previewing a display used to land on a "this link isn't recognized" gate instead of the actual preview. Root cause was a server-side check that only recognized the event's owner, never an accepted collaborator — fixed by reusing the same access check every other route in the app already uses. Verified this doesn't weaken anything: invalid tokens, unauthenticated access, and access to events you genuinely don't belong to all still correctly fail closed.
- **Server authorization remains the actual boundary throughout** — every UI fix above is a truthfulness/courtesy layer on top of server checks that were already correct (with the one exception above, which was a genuine server-side bug, fixed narrowly).
- Collaborator permission UI (Settings) was already correctly gated before this sprint — verified, not changed.
- Broadcast Center's own permission gating was already correct — verified, and its pattern is what Remote and Displays were brought in line with.

### E. Product Correctness

- Cue Sheet import's replace-only behavior (re-importing always replaces a session's content, never merges) is now honestly surfaced with a warning before you commit to it, instead of being implied to be smarter than it is.
- Activity log coverage expanded (see B above).
- The "Screenshot" button on Displays never actually captured the remote display — it opened the operator's own local screen-share picker. Relabeled "Capture Screen" with an honest tooltip instead of claiming a capability that didn't exist.
- Session-specific reset (see B above).
- `SessionSummary` (Console's post-show summary card) used to derive "actual runtime" by string-matching activity-log entries — a real, documented fragility. Migrated to the same canonical `item_actuals`-based timing engine the new report uses, removing a second, independently-arrived-at definition of the same number.
- Several other false or duplicate UI claims removed as they were found (see the commit history for specifics — this document summarizes, it doesn't enumerate every one).

---

## Important product decisions — please don't "fix" these back

A few things in this codebase look like they might be bugs but are deliberate. Please read this before changing any of them:

1. **Event-wide display-link viewing is intentional**, not a bug. One share link can open any of the four display types (General/AV/Green Room/Presenter) — this is documented directly in `app/screens/page.tsx`'s own comment as a deliberate product choice, not an oversight.
2. **The real bug was cross-display timer/hold *mutation*, not the viewing model above.** Presenter's own local timer/Hold controls used to silently affect what General/AV/Green Room displayed too, because the underlying state was one shared row per event. That's what migration 0009 fixes — it does not change who can view what.
3. **Presenter-local timer/hold state is now designed to be display-type scoped** (once migration 0009 is applied) — each of the four display types gets its own row, so a Presenter-local adjustment can only ever reach Presenter's own output.
4. **Activity log is an audit trail, not the canonical timing database.** It records who did what and when for human review. It is deliberately not used for calculating drift, variance, or "actual runtime" anymore — see the next point.
5. **`item_actuals` is the canonical source for actual cue timing** (when did an item really start/end). One engine (`lib/timing.ts`) computes everything derived from it — current drift, projected finish, and the post-event report — so there's exactly one definition of these numbers, not several that can quietly disagree.
6. **Rehearsal must remain isolated from `live_state`.** Rehearsal is a solo practice mode with its own local, disposable state — it never calls the real live-show API and can never leak a rehearsal cue to a real display or a real operator's screen. This is deliberate and load-bearing; don't wire it up to real state to "simplify" it.
7. **Display Profiles UI was removed because it wasn't actually wired to rendering**, not because the concept is bad. The underlying data (`DisplayProfile`, the assignment field on a display) is untouched — a future implementation could pick it back up.
8. **Cue Sheet import is intentionally Replace-only**, and the UI warns about this before you commit. It is not a bug that it doesn't merge — building real merge semantics is a separate, deferred piece of work (see the roadmap section).
9. **Remote's Speaker Ready toggle intentionally has a different, more open permission model** than every other Remote control. Every other action on Remote requires the event owner; Speaker Ready requires no role at all — confirmed directly against the server route (`app/api/display-engine/speaker-ready/route.ts`), which has no auth check by design ("Green Room's own unauthenticated toggle"). This was true before this sprint and is unchanged by it.

---

# REQUIRED SUPABASE ACTION BEFORE DEPLOYMENT

**The application code on this branch is complete and ready. Two database migrations must be applied to the correct live project before this branch can be deployed.**

**Correct project — apply these to exactly this one:**

```
ref: ledtrtpxvmcpwupafehk
URL: https://ledtrtpxvmcpwupafehk.supabase.co
```

**Do NOT run these against `kramflow-capture-temp` or any other project you might see listed** — that name showed up during this sprint's own testing and is not the production project. If you're ever unsure which project you're connected to, stop and check the dashboard URL before running anything.

The full, exact, copy-pasteable procedure — preflight queries, exact SQL, expected results, postflight verification — already exists and is kept in one place so there's never two versions of the same instructions to accidentally drift apart:

**→ See [`docs/BLOCKER_REMEDIATION_RUNBOOK.md`](./BLOCKER_REMEDIATION_RUNBOOK.md) for the complete procedure.**

This document gives you the summary and the ordered checklist; the runbook has the actual SQL.

## Migration 0009 — display-type state isolation

File: `supabase/migrations/0009_display_type_state.sql`

**What it fixes:** Presenter's own local timer/Hold controls could previously affect what General/AV/Green Room displayed, because that state (`display_state.hold`/`.timer`) was one shared row per *event*, not per *display type*. This migration creates a new table, `display_type_state`, with one row per `(event, display_type)` — so a Presenter-local adjustment can only ever reach Presenter's own row.

**What it does not change:** event-wide *viewing* through one share link remains exactly as intentional and unchanged as described above.

**Backfill:** every existing event gets 4 new rows (one per real display type), seeded from that event's current shared values — so nothing changes visibly the moment this migration runs; it only changes what future writes reach.

**What NOT to touch:** don't drop or alter `display_state.hold`/`.timer`/`.timer_version` as part of this — they intentionally become unused, harmless dead columns; removing them is a deliberately separate, later cleanup migration, not bundled with this one. Don't touch `display_state.speaker_ready` — it's genuinely event-wide by design and this migration doesn't affect it.

**Deployment ordering:** apply this migration *before* the application code that reads/writes the new table is deployed (that code is already on this branch, just not live yet). The runbook's §1.5 explains precisely and specifically what happens if the order is reversed (a narrow, self-announcing degradation, not an outage) — but there's no reason to risk even that.

Full preflight query, exact SQL, and postflight verification with expected row counts: **runbook §1.**

## Migration 0010 — collaborator invite columns

File: `supabase/migrations/0010_collaborator_invite_columns.sql`

**What it fixes:** the live `event_collaborators` table is missing three columns (`invited_by`, `invite_expires_at`, `accepted_at`) that the already-deployed application code assumes exist. This is what's currently causing the collaborator list and invite flow to fail with a 500 error in production.

**What it adds:** three **nullable** columns, no data rewrite, no existing row touched, no backfill for any existing row.

**Explicitly do not backfill `accepted_at`** (or the other two) for existing rows — `NULL` is the honest, correct value for "this row predates the feature that populates this column." Inventing a value would be fabricated history the app doesn't need and shouldn't have.

**Existing collaborator rows must remain intact** — their `role`, `status`, `user_id`, and `invited_email` are completely untouched by this migration. The postflight check confirms the row count is identical before and after.

Full preflight query, exact SQL, and postflight verification: **runbook §2.**

---

## Exact procedure

1. Open the Supabase Dashboard.
2. Confirm the URL contains `/project/ledtrtpxvmcpwupafehk` — if it doesn't, stop and find the right project first.
3. Open the SQL Editor.
4. Run migration 0009's preflight queries (runbook §1.2). Confirm the expected result before proceeding.
5. Run migration 0009 (runbook §1.9 has the exact SQL, or run the file directly).
6. Run migration 0009's postflight verification queries (runbook §1.6). Confirm every expected result.
7. Run migration 0010's preflight queries (runbook §2.2). Confirm the expected result.
8. Run migration 0010 (runbook §2.8 has the exact SQL, or run the file directly).
9. Run migration 0010's postflight verification queries (runbook §2.6), including confirming the existing collaborator row count is unchanged.
10. Send the results back before anything gets deployed.

**Stop at any step if a result doesn't match what the runbook says to expect.** Don't improvise SQL to "fix" an unexpected result — report it instead. Every statement in both migrations is idempotent, so if something goes wrong partway through, it's safe to re-run from the top once the underlying issue is understood.

---

## After the migrations are applied

Once you confirm both migrations are applied and verified, the next step is a full round of testing against the now-migrated live database — this needs to happen before deployment, and should be done by whoever has access to actually exercise the running app against production data:

- Display-type isolation: Presenter's local Hold/Timer adjustments don't affect General, AV, or Green Room.
- Collaborator list loads without error; a throwaway invite can be created, verified, and revoked cleanly (runbook §4).
- Same-tab acknowledgement, session-specific reset, and the post-event report all behave correctly against the live schema (runbook §5–§8).
- A full regression pass across Operator, Displays, Broadcast, Cue Sheet, Settings, Remote, and the public display pages.

---

## Known roadmap — not part of this release

These are real, deliberately deferred product decisions, not incomplete sprint work or bugs:

**THEN (next priority tier):**
- Schedule conflict detection (needs new database schema — sessions currently have no start/end timestamps to check against)
- Offline action queue/outbox (an operator's action taken while disconnected currently fails visibly rather than queuing — intentionally, since a naive queue risks replaying a stale action against changed state; a real implementation needs careful design, not a quick patch)

**LATER:**
- ICS/calendar export
- Webhooks / external API integration

**Also explicitly deferred, not forgotten:**
- Richer Cue Sheet import semantics (Merge / New Session, beyond today's Replace-only) — a real feature build, not a bug fix.

---

## Known test artifacts

Two harmless leftovers from this sprint's own live verification testing, disclosed rather than hidden:

- **A stray, empty "Untitled Event"** with no sessions, likely created incidentally during UI testing. Don't delete it as a side effect of anything above — if you can confirm it's test-created (check its owner/creation time) and want it gone, remove it through the app's own normal delete-event flow at your convenience, not urgently.
- **Do not casually delete any other demo or event data** — the demo accounts (`demo1@kramflow.test`, `demo2@kramflow.test`) and their events are used for ongoing verification and should be treated as real, not scratch data.

---

## GitHub / PR summary

**Title:** Pilot readiness, UX, operational integrity, and release hardening

**Summary:** This branch takes Kramflow from a partially-verified UI/UX pass to a release-candidate state: every release-blocking correctness issue found this sprint (a security-relevant display-state isolation bug, a broken collaborator feature, a same-tab UI delay, and three permission-truth bugs in Remote/Displays) has been root-caused, fixed, and verified against the running app with two genuinely separate user roles — not assumed from code inspection alone. Two database migrations are prepared and fully documented but intentionally not yet applied to production; see the required-action section above.

**Major changes**, grouped:
- **UX/design system** — canonical components, Console/Stage separation, responsive fixes across every major surface (§A above)
- **Live operations** — control lease, same-tab acknowledgement, reconnect/resync, activity log coverage (§B above)
- **Timing/reporting** — drift, whole-rundown projection, post-event report, session readiness, session-specific reset (§B above)
- **Displays** — fleet health, registration-loop fix, display-type state isolation architecture, Display Profiles removal (§C above)
- **Permissions** — Remote/Displays role-truth gating, the editor-preview fix, consolidated permission helpers (§D above)
- **Reliability & accessibility** — touch targets, EventNav accessible names, horizontal-overflow fixes
- **Release/database work** — migrations 0009 and 0010, fully documented and pending application

**Testing:**
- TypeScript: clean
- ESLint: 0 errors (3 pre-existing warnings, unrelated to this sprint, in `components/auth/*`)
- Production build (`npm run build`): succeeds
- Unit tests: 55 passing (23 covering the new timing engine specifically)
- Responsive QA at 1440×900, 1024×1366, and 390×844 across Operator, Remote, Displays, Cue Sheet, and the report page
- Owner/editor role verification: two genuinely separate authenticated accounts/browser sessions (not one shared login), confirming both what each role can do and what it correctly cannot
- Multi-operator checks: control-lease contention, locked-out actions, concurrent takeover
- Display checks: invalid/expired/fabricated tokens still fail closed; display-type isolation logic unit-verified (live confirmation needs the applied migration)

**Database requirements:** migrations `0009_display_type_state.sql` and `0010_collaborator_invite_columns.sql` must be applied to `ledtrtpxvmcpwupafehk` before this branch is deployed — see the required-action section above.

**Known deferred items:** schedule conflict detection, offline action queue, ICS export, webhooks, richer cue-sheet import semantics — all real roadmap, none of it a defect in this release.

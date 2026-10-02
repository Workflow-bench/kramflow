# Kramflow UI/UX audit (pre-revamp reference)

Audited 2026-09-24 against production (https://www.kramflow.me) as `demo1@kramflow.test`, plus the codebase on branch `ui-revamp`.

**How this was gathered.** Every behaviour marked *observed* was exercised in a real browser on production. A throwaway event ("AUDIT-TEST") was created, edited and deleted; the seeded events (Northwind Summit 2026 and the two "Untitled Event" rows) were only read. The account is back to its original 3 events (19 / 244 / 0 items). Anything marked *source* was read from code and not exercised. Anything marked *not tested* is listed in section 8.

**Scale of the app:** 23 pages, 48 API route handlers. One operator-facing shell (dashboard, then 9 pages per event), 7 no-login display surfaces, 4 auth pages, 1 marketing page, 1 dev page.

---

## Status of fixes (branch `ui-revamp`)

Typechecked, linted (0 errors), 241 unit tests pass, production build passes. **None of the post-login changes were exercised in a browser against Supabase** (the local sandbox cannot reach it). Run the checklist in `docs/UI-VERIFY.md` on a preview before releasing.

Corrections to the audit above: **B6 was mostly wrong** (the session and item forms do show validation errors; my check looked for `role=alert`, which the session form lacked, now added). **B4's cause** is that sections are only created by the Excel import; hand-built sessions had no section, so items never received scheduled times.

| Bug | Change |
|---|---|
| B1 | `useSelectSession` claims control first, then selects; empty Console offers one button per session (start-show-prompt.tsx). |
| B2 | "Already started" prompt only when the active session has progress. |
| B4 | New `POST /api/partitions`. New/Edit Session has a "Start time" field that creates or updates the session's section and moves existing items into it. New items default into a session's only section. |
| B5 | Add Item shows name, type, session, section, presenter and timing; everything else is under "More details" (opens itself when editing an item that uses it). |
| B6 | Session form error now `role="alert"`; Broadcast Save Draft / Save as Template toast "Add a title first" and a hint explains the disabled Send. |
| B7 | Auditoriums can be renamed and deleted (`/api/auditoriums/[id]`, confirm on delete; items just lose the link). |
| B8 | Broadcast send/schedule/cancel/dismiss re-read the list; dashboard refreshes its server count after create/delete. |
| B9, B10 | `/dev/*` 404s in production; logged-out `/set-password` redirects to login. |
| B11 | Revoking an API credential now confirms. Policy: reversible deletes (cue-sheet item) use Undo; irreversible ones confirm. |
| B12 | Lock is now "Log out" everywhere. |
| B14 | Tabs are Plan, Run, Displays, Settings; Screens and Broadcast share the Displays tab; the duplicate Broadcast card is removed. |
| B15 | A single share link opens expanded. |
| B21 | Getting-started checklist says "session" like the rest of the UI. |

Deliberately not changed: B13 (two Add item buttons in an empty session is the standard empty-state pattern), the Console / Remote / Rehearsal overlap (three surfaces for three contexts; merging is a product decision), B3 (needs the timing logic reviewed with real show data), B16-B18, B20.

---

## 1. Navigation map

```
/                       marketing (redirects to /dashboard if signed in)
/login  /signup         auth. signup -> /dashboard (or back to /invite/[token])
/set-password           forced for invited collaborators on a temp password
/invite/[token]         accept a collaborator invite

/dashboard              event list. Header: Help (Getting started, Keyboard shortcuts, Glossary) + Log Out
  Row: Open Console | Cue Sheet | Remote | Displays | overflow (Share Display Link, Delete Event)
  |
  /e/[id]/...           EVENT SHELL: identity, connection badge, clock, 4 tabs, Remote, Lock, Cmd-K
     TABS ->  Console  /operator
              Cue Sheet /operator/cue-sheet
                   menu: Export Excel | Export PDF (= /print) | Timing Report (= /report)
                         New session | Edit session | Reset session progress | Delete session
              Displays /displays        (Broadcast is highlighted under this tab)
                   panels: Preview a display, Share Display Link, Broadcast Center,
                           Display Profiles, Display Fleet
              Settings /settings        Event Details | Auditoriums | Collaborators |
                                         External API | Danger Zone (owner only)
     NO TAB ->  /broadcast   (from Displays, and a Console panel, and Cmd-K)
                /rehearsal   (Console button, Cmd-K)
                /remote      (opens in new tab; own header "Back to Console")
                /cue-sheet/print, /cue-sheet/report  (Cue Sheet menu only)

No-login surfaces (need a share token or a session):
/screens?token=  picker -> /general  /av  /green-room  /presenter  /custom?profileId=
/tv              6-digit code -> /screens?token=
/dev/components  internal component catalog (PUBLIC in production, see bug B9)
```

Cmd-K (event pages only) mirrors this: All events, Console, Cue Sheet, Displays, Settings, four display types, Remote, Broadcast Center, Rehearsal Mode, one command per session, Lock.

---

## 2. Feature inventory

**Events (dashboard).** Create (name optional), list (owned and collaborated), LIVE badge, session and item counts, delete (typed-name confirm), first-run checklist, help menu.

**Cue sheet.** Sessions (day + session + display title), items (about 30 fields), inline edit, per-item delete with Undo toast, select-all and bulk edit (colour tag only, observed), drag reorder, search, Excel import (template or "Any document (AI)"), Excel export, print/PDF, timing report with AI summary, reset session progress.

**Console.** Session switcher, program list, Live Now with countdown, +/-10s and +/-30s adjust, notes, control lease (Take Control / Take Over), Next / Previous / Hold / Resume, jump to item, raise alert (Info / Warning / Critical, AI draft), activity log, layout presets (Balanced, Rundown focus, Control focus), keyboard shortcuts, operator presence badge.

**Remote.** One-handed mobile control: session chips, live item, countdown, adjust, Mark Speaker Ready, Next/Prev/Resume, Jump, Alert, Notes, Broadcast.

**Rehearsal.** Client-side practice run with no network calls (observed: 0 API calls across start, next, hold, resume, reset). Own alert box.

**Displays.** Preview four display types plus Custom; share link (7-day expiry, QR, download, TV code, per-screen copy and QR, revoke with confirm); display profiles (3 layouts, widget zones, viewing distance, accent colour; create/edit/delete with confirm); fleet with online/stale/offline states, reload/remove offline.

**Broadcast.** Five emergency one-clicks (Evacuate, Medical, Power, Fire, Lost Child, *not tested by choice*), compose (target, type, priority, icon, expiry, duration, acknowledge, persistent, schedule), Send Now, Save Draft, Save as Template, History / Scheduled / Templates / Drafts tabs, dismiss, duplicate, template use/favourite/delete, AI draft.

**Settings.** Event details (name, date, timezone, venue), auditoriums (create only, see B7), collaborators (invite by email with role, pending state, resend, copy link, revoke), external API credentials (scoped token shown once, revoke), delete event.

**No-login displays.** General, AV, Green Room, Presenter, Custom, picker, TV code entry.

**Other.** Roles: owner / editor / viewer. Plan tiers: free 3 events, pro 25. AI features gated on `ANTHROPIC_API_KEY` (enabled in production, observed). Public API `/api/v1/events/[id]/state|actions`.

---

## 3. Page-by-page reference

Format: purpose | contents | data | in | out. *(o)* = observed, *(s)* = source only.

**/dashboard** *(o)*: event home. Contents: "Operator Dashboard" strip with email and clock, Help, Log Out, Create Event field, checklist (only with zero events), event rows. Data live. In: login, Cmd-K, "All events" link, 404 page. Out: any event page.

**/e/[id]/operator (Console)** *(o)*: run the show. Empty state on a fresh event is a single "Select a session to get started" card. Data live (realtime). In: dashboard row, tab, Cmd-K, back link from Remote/Rehearsal. Out: tabs, Rehearsal, Remote, dashboard.

**/operator/cue-sheet** *(o)*: build the rundown. Empty state offers New session and Import Excel; Add item is disabled until a session exists. In: tab, Cmd-K, dashboard row, first-ever create. Out: Print, Report, Console.

**/displays** *(o)*: hub for everything display-related (preview, share, broadcast link, profiles, fleet). Share links and profiles are inline drawers, not pages.

**/broadcast** *(o)*: compose and manage venue messages. Reached only from Displays or the Console panel.

**/settings** *(o)*: left rail on desktop, popover on mobile; one section visible at a time.

**/remote** *(o)*: shell-less mobile control surface. Own connection badge, own Lock.

**/rehearsal** *(o)*: practice run. Banner "REHEARSAL MODE: NOT LIVE".

**/cue-sheet/print** *(o)*: printable table of all sessions. **/cue-sheet/report** *(o)*: planned vs actual per session, AI summary button.

**/screens, /general, /av, /green-room, /presenter, /custom, /tv** *(o for screens, general, presenter, tv; s for the rest)*: the audience-facing surfaces. Read-only, no controls. Opening a display route registers it in the fleet automatically (observed: my anonymous visit created a "Presenter Display" row).

**/login, /signup, /set-password, /invite/[token]** *(o for the first three states, s for accept flow)*.

**/dev/components** *(o)*: internal design-system catalog. Not linked from anywhere.

---

## 4. Key user flows

**A. New operator, first show (as coded and observed)**
```
/signup -> /dashboard (checklist: create event, add section, add item)
  Create Event -> auto-redirect to Cue Sheet (first event only)
  Cue Sheet: New session -> Add item (30-field form) x N
  Set start time: NOT possible in Edit session. Only by unticking
    "Auto-schedule" on an item (see B4)
  Console: Select session -> 423 locked (silent) -> DEAD END (B1)
  Rehearsal works. Live run does not, on a fresh event.
```

**B. Getting a screen on a wall (works end to end, observed)**
```
Displays -> Manage Links -> Generate Link (7 days)
   -> link + QR + TV code 354 499 (shown right after creating)
   -> TV: kramflow.me/tv -> code -> /screens -> pick a display
   -> Revoke (confirm) -> old link shows "no longer valid"
```

**C. Run the live show (works on the seeded Northwind event, observed)**
```
Console (session already active) -> Take Control -> Next / Hold / Resume / adjust
   -> displays follow. Alerts via Raise Alert or Broadcast Center.
```

**D. Invite a collaborator** *(observed)*
```
Settings -> Collaborators -> Add by email + role -> PENDING
   -> email sent / Copy invite link / Resend / Revoke (confirm)
   -> invitee: /invite/[token] -> signup or login -> /set-password (temp) -> event
```

---

## 5. Bug and inconsistency log

Severity: P0 blocks a core job, P1 confusing or wrong, P2 polish. *(o)* observed, *(s)* source.

| # | Sev | Where | Issue |
|---|---|---|---|
| B1 | **P0** | Console, fresh event *(o, s)* | Picking a session returns `423 locked` with no message. Selecting a session needs an active control claim, but "Take Control" only renders after a session is selected. A new event cannot go live from the Console. No other route to claim control was found (Remote also shows "Select a session"). |
| B2 | P1 | Console session switch dialog *(o)* | Says "The current session has already started" when nothing has started. |
| B3 | P1 | Northwind console *(o)* | Shows "25m ahead of schedule" and "Replaying an earlier item, projection paused" together. Timing report says "Ran 6/7 completed items" while five rows show 0m / "-40m under". Stale progress is presented as fact. |
| B4 | P1 | Cue sheet start times *(o)* | Start time is disabled ("Computed on save") while auto-schedule is on, and Edit session has no start field, so a session has no obvious way to get a start time. Untick auto-schedule on item 1 and set 9:00 AM: items 2 and 3 stayed "—" even after reload (they only recompute when saved). The landing page claims start times cascade. |
| B5 | P1 | Add Item form *(o)* | About 30 fields in one modal (Basics, Presenter, Timing, Production, Remarks). Empty submit stays open with no visible message. |
| B6 | P1 | Silent validation *(o)* | Empty submit on New Session, Add Item, and New Profile keeps the dialog open with no error text. Send Now is disabled with no explanation. |
| B7 | P1 | Settings > Auditoriums *(o, s)* | Create only. No edit, no delete anywhere in the UI. |
| B8 | P1 | Stale lists *(o)* | Broadcast History says "No broadcasts sent yet" after "Broadcast sent"; a dismissed broadcast still shows ACTIVE. Both correct after reload. Dashboard header says "3 events" while the list says "Events 4" after creating. |
| B9 | P1 | `/dev/components` *(o)* | Publicly reachable in production (noindex only). |
| B10 | P1 | `/set-password` *(o)* | Loads while logged out and says "You're logged in with a temporary password". |
| B11 | P1 | Destructive patterns *(o)* | Delete item: no confirm, Undo toast. Delete session, profile, event, invite revoke: confirm dialogs (event needs typed name). Revoke API credential: immediate, no confirm. Revoke share link: confirm. Five different treatments. |
| B12 | P2 | "Lock" *(o, s)* | Padlock button on every event page actually signs you out (`/api/auth/logout`). Cmd-K describes it as "Sign out of the operator PIN". Dashboard calls the same action "Log Out". |
| B13 | P2 | Cue sheet empty session *(o)* | Two "Add item" buttons (header and empty state). |
| B14 | P2 | Nav *(o)* | 4 tabs cover 9 event pages; Broadcast is highlighted as "Displays"; Rehearsal, Remote, Print, Report have no nav home. |
| B15 | P2 | Share link row *(o)* | After reload the link is collapsed; URL, QR and TV code are only visible after clicking the row. |
| B16 | P2 | Remote *(o)* | No shared event shell; own header and Lock. |
| B17 | P2 | Timezone picker *(o)* | Flat list of 418 options. |
| B18 | P2 | Bulk edit *(o)* | Only offers colour tag as a field. |
| B19 | P2 | Docs *(s)* | `DEMO_CREDENTIALS.md` is stale (says collaborated events are not listed on the dashboard; they are). Live and local differ on the dashboard "Log Out" vs "Lock". |
| B20 | P2 | Keyboard reorder *(o)* | Space + Arrow on the drag handle did not reorder (may be my method; mouse drag not tested). |
| B21 | P2 | Naming *(o)* | Session, section, partition, day, program, item, cue all mean overlapping things. |

---

## 6. Revamp observations

**Why it feels like too much.**
- The Displays page is five products in one: preview, sharing, broadcasting, profile builder, fleet. Two of them (Broadcast, Profiles) are entire tools hidden behind cards.
- Three separate "control the show" surfaces (Console, Remote, Rehearsal) duplicate controls; each has its own layout, header and alert box.
- Console has hidden layers (More Tools, Layout menu, shortcuts, Cmd-K) on top of a dense screen.
- The Add Item form and Settings rail expose everything at once.

**Patterns worth unifying.** One destructive-action policy (B11). One empty-state pattern (they exist and are good; the silent-validation cases do not use them). One header (Remote is the outlier). One naming scheme for the show hierarchy (B21). One place to claim control.

**Information architecture vs how people move.** The real journey is Plan (cue sheet) -> Rehearse -> Run (console) -> Show (displays, broadcast) -> Review (report). The nav is Console / Cue Sheet / Displays / Settings, which mixes verbs and nouns and hides Rehearse and Review.

**Dead weight or low value.** `/dev/components` on production; Cmd-K duplicating the nav plus per-session commands; the Glossary and Getting-started modals; separate print and export entries for the same data; "Untitled Event" rows from empty-name creates.

**What works well and should survive.** Share-link flow (B, above); rehearsal being fully client-side; typed-name event delete; confirm on profile/session delete; collaborator invite states; realtime sync; the timing report.

---

## 7. Landing-page implications

**Real and demo-able today:** live countdown with adjust; control lease; Excel import and export; share link, QR and TV code with no login on the wall; four display types; broadcast alerts; rehearsal; activity log; timing report; multi-operator presence.

**Under-sold (exists, not on the page):** the no-login TV code (`/tv`); the External API for Companion and Stream Deck; the custom display builder; collaborator roles (owner / editor / viewer); AI import and AI-drafted alerts (enabled in production); the printable cue sheet and timing report; layout presets in Console.

**Over-sold or contradicted:**
- "Run the show from one screen" and the whole hero: a brand-new event cannot go live (B1). The seeded Northwind event only works because a session was pre-selected.
- "Drag an item and the downstream start times cascade" (call sheet copy): observed that start times do not recompute for later items after an edit (B4); drag-reorder itself was not verified.
- "Import the rundown you already have from Excel": import was not run (dialog only); the AI variant exists.
- The landing screenshots come from Northwind. That event has drifted (stale progress, B3), so the screenshots on the live site may not match what a new user sees.

**Alignment suggestion.** Lead with Plan -> Rehearse -> Run -> Show, and fix B1 before promoting "run live" anywhere.

---

## 8. Not tested, and why

- **Emergency broadcast buttons** (Evacuate, Medical, Power, Fire, Lost Child): skipped on purpose.
- **Import** (Excel or AI): dialog opened only; nothing uploaded.
- **AI features** (Draft with AI, Write summary with AI): not clicked; they call a paid model.
- **Live control on a fresh event, Remote controls, jump/notes/alert in Console**: blocked by B1; Northwind is the marketing show and was left untouched.
- **Mouse drag reorder**, **schedule-for-later broadcasts**, **display registering by a real device**, **viewer and editor roles**, **invite accept flow**, **mobile widths**, **light-mode** (dark-only by design).
- **Signup and password reset**: not exercised (would create a real account).

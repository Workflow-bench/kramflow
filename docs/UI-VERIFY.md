# Manual verification for the UI revamp

Run on a preview deployment (or locally with a real Supabase project) signed in as an owner. Use a **new** event so nothing seeded is touched. About 15 minutes.

## Post-login (none of this was browser-tested)

1. **First show, end to end.** Dashboard, Create Event, lands on Plan (Cue Sheet). New session with Day, Session and Start time `9:00 AM`. Expect: session appears, a section header reading "Starts 9:00 AM".
2. **Add items.** Add three items with durations. Expect the form to show only name, type, session, section, presenter and timing, with "More details" collapsed. Start times should read 9:00, then each after the previous item's duration. Section should default to the session's section.
3. **Edit session start time.** Edit session, change to `10:00 AM`. Expect all item times to shift. Enter `banana`; expect "Start time should look like 9:00 AM." with role alert.
4. **More details.** Edit an item that has a description: "More details" opens itself. An item with none: it stays closed.
5. **Run (the P0).** Open Run (Console) on the fresh event. Expect "Choose a session to run" with a button per session. Click one: control is taken and the session opens. Press Next; the countdown starts. Try it as an editor collaborator: expect the toast "Only the event owner can run the show."
6. **Switch session** while one is running: the confirm dialog appears. On an event where nothing has started, it must not appear.
7. **Displays tab.** Tabs read Plan, Run, Displays, Settings. Inside Displays, the Screens / Broadcast switch works both ways and the Broadcast card no longer appears on Screens.
8. **Broadcast.** Send a broadcast: it shows in History immediately (no reload). Dismiss it: it stops showing ACTIVE. With an empty title, Save Draft toasts "Add a title first" and a hint shows under the buttons.
9. **Settings, Auditoriums.** Add, rename, delete (confirm). Add an item using it first, delete the auditorium, reopen the item: it has no auditorium and nothing else changed.
10. **External API.** Create a credential, revoke: a confirm appears.
11. **Share link.** Generate one, close and reopen Manage Links: the single link is already expanded. Click it: it collapses and stays collapsed.
12. **Dashboard.** Create then delete an event: the "N events" header and the list agree without reloading.
13. **Log out.** The button in every event header, the Remote page, and Cmd-K all say "Log out" and sign you out.
14. **Logged out.** `/set-password` redirects to `/login`. `/dev/components` is a 404 in production.

## Landing page
15. Load `/`: the STANDBY / GO cover lifts after about 1.4s. Scroll: the cue rail on the right and the pill at the bottom track the section. Press Next in "Now you call the cue". Check at 390px wide and with "reduce motion" enabled (cover skipped, no animation, values shown).

Clean up: delete the test event.

# Rehearsal navigation evidence (B009, KF-005)

Synthetic harness route `/dev/rehearsal` (dev only, 404 in production). Real `RehearsalView` with the real `usePersistedRun` store. Capture: `rehearsal-navigation.cjs` against a dev server (port 3000, pre-existing; this session did not start it).

Results (`rehearsal-navigation.json`):
- A. No progress, reload: no prompt.
- B. Progress, reload: browser `beforeunload` prompt raised; dismissing it keeps the page and progress.
- C. Progress, in-app Next `Link` navigation: no confirmation shown. The route changes.
- D. Browser Back after C: progress RESTORED ("SYNTHETIC cue 1", still rehearsing). Previously (before this pass) Back returned a fresh state and progress was lost.
- F. Reset rehearsal (the in-progress control) after Back: resets to "Not started". This is the explicit discard.
- E. Exit with progress, Cancel: progress kept.
- G. Exit with progress, confirmed: stored run removed from sessionStorage.

What changed in this pass:
1. `components/rehearsal/persisted-run.ts`: run (session, progress, interacted) kept per viewer in sessionStorage, keyed by event id, read through `useSyncExternalStore`. Cleared only by a confirmed Exit. Reset rehearsal is the explicit in-place discard.
2. `beforeunload` guard while progress is discardable (same rule as the Exit confirmation).

Limits and open decision:
- Leaving by an in-app Link or Back with progress shows NO confirmation. Progress is not lost (D), but the operator is not asked. Whether a confirmation is required for in-app navigation is a product decision for Codex; it would need an app-wide navigation guard, which this batch does not add.
- The Exit button with progress does confirm (E).
- Per-viewer sessionStorage only. Nothing is sent to the server or a display.

# Rehearsal harness evidence (B009, KF-004 / KF-005)

Label: SYNTHETIC. Fixture sessions use "SYNTHETIC" titles and a synthetic session id. The harness mounts the real `RehearsalView` (`components/rehearsal/rehearsal-view.tsx`) and is not event data.

Harness route: `app/(catalog)/dev/rehearsal/` (`page.tsx`, `harness.tsx`).
- Production gate: server component calls `notFound()` when `NODE_ENV === "production"`. Verified on a production webpack build: `GET /dev/rehearsal?fixture=multi` returns **404** (`curl` status recorded in the batch handoff).
- Development capture: `next dev` on port 3947, `NODE_ENV=development`. Capture runs against dev mode only; production-mode behaviour of the view is the same code, verified by the production build.
- No auth bypass, no database access, no `/api/live` calls. The capture counts every non-GET request and every `/api/live` request: 0 in every state.

Reproduce: start `npx next dev -p 3947`, then `NODE_PATH=$PWD/node_modules node harness-capture.cjs > results.json`.

Limits:
- Exit without progress is a plain link (`href=/e/synthetic-harness/operator`). The harness does not intercept navigation on that path, so clicking it leaves the harness. Only the dialog path is intercepted (`onExit`).
- The capture uses Chromium headless; no screen reader.
- Accessibility-tree data is from `Accessibility.getFullAXTree` (CDP), filtered to non-ignored nodes.

Captured results: `results.json`. Summary:
- none (no sessions): empty state "No session to rehearse yet. Add one in the Cue Sheet first."
- zero cues: Start Rehearsal disabled (AX tree `disabled: true`); no Finish; no completion.
- one cue: Start, Finish enabled at cue 1, Finish via keyboard shows "Rehearsal complete" exactly once, summary "1 of 1 cues completed", "Run again" and "Exit Rehearsal" present.
- four cues: Finish absent at cue 1; Next x3 reaches last cue; Finish enabled; completion once; "4 of 4 cues completed"; Run again returns to "Not started".
- Jump to Finish (ghost control, cue < max): reaches completion once.
- Exit with progress: alertdialog "Leave rehearsal?" in the AX tree; focus inside on open (initially on the confirm button); Escape closes; focus returns to "Exit Rehearsal"; confirm calls `onExit`.
- Exit without progress: plain link to the operator page (no dialog).
- Mutating requests and `/api/live` requests: 0 in every state.

Findings for review (not changed in this pass):
1. ConfirmDialog opens with initial focus on the destructive confirm ("Leave rehearsal"). Pressing Enter immediately leaves the rehearsal. Intended by `useDialogFocus`; Codex to decide.
2. While the alertdialog is open, the page behind it has no `aria-hidden` / `inert` (`backgroundAriaHidden: null`). `aria-modal="true"` is set on the dialog. Behaviour depends on the assistive technology.
3. The rehearsal title and state labels are not AX headings (`headings: []` in every state).

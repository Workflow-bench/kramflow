# Import / Open Console harness evidence (B009, KF-006)

SYNTHETIC. Route `app/(catalog)/dev/import/` (page + harness). Production gate `notFound()` (verified 404 on a production build in the rehearsal pass; same pattern). Dev-mode capture on port 3947.

Mounts the real components: `components/cue-sheet/upload-panel.tsx` (UploadPanel, with an injected request seam), `components/cue-sheet/import-complete.tsx` (ImportCompleteStep) and the pure `lib/cue-sheet-open.ts` (planOpenConsole, the same decision the cue-sheet page now calls). No request leaves the page: `apiRequests` is empty in every case.

Results (`import-results2.json`):
- A. Happy path, nothing live: preview shown; after Confirm, the completion step lists 2 sessions by server-stored id mapping (second session stored as `sat-pm~harness`). No selectSession call before any click. Explicit click on "Open console" for PM calls selectSession once for that session only. The completion step says "Nothing goes live until you choose." No alertdialog.
- B. Parse error: message shown with `role="alert"` (previously no role; fixed in this pass). Confirm button not offered; completion step not shown; no request.
- C. Commit error: message shown with `role="alert"`; preview still on screen; completion step not shown. Server-side "nothing was written" text is the synthetic message (the real route's transactional guarantee is covered in the SQL and race tests).
- D. Another session running: Open console on AM does not switch the running session; the message says so; selectSession calls: none. The console navigation still happens in the real page, as before.
- E. Control held by another operator: refused with the toast path; selectSession calls: none.

Not covered by this harness:
- Refresh coherence on the real route: a browser reload of the real cue-sheet page after import (needs an authenticated event and a real database). The mapping rule (server stored ids drive the choices, not file ids) is covered by `lib/cue-sheet-import-result.test.ts`.
- Real Open Console navigation and the real store (`selectSession`, toasts) are not run; the harness records the decision and the call.

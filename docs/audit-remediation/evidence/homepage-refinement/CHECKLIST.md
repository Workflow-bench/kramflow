# HOME-R01…R10 refinement checklist

Base: `a29ebf21685115c04de4f88150866219e9af7411`, branch `integrate/ui-revamp-landing`, tracked tree clean, nine pre-existing untracked paths preserved. Written before implementation.

Lanes: none. No agent tools were used; built sequentially by one implementer.

| ID | Completion criteria | Files |
|---|---|---|
| R01 | Headline hierarchy increased inside a height-aware first-view budget; explanation + actions grouped tighter; warm light shaped to meet the real console edge instead of a broad field; cue/timer/controls still visible and unfaded at 720/900/1080/600. | `hero-section.tsx`, `console-aperture.tsx`, `globals.css` |
| R02 | Signature scene shows an unaltered crop containing active cue + timer + Next/control cluster at readable scale, one selected real output, intact full-view expansion, and cause/consequence labels outside the images. Not a timer-only crop. | `call-the-show.tsx`, `recorded-view.tsx`, new crop component |
| R03 | Each adaptation row maps to the correct genuine region/state and caption; Broadcast Center only for notices; one concise real scenario per row; honest editorial fallback where no safe capture exists. | `when-plans-change.tsx` |
| R04 | Dev badge removed from published imagery by crop (recapture blocked); route/state/revision/date/dimensions/SHA-256 recorded for every published asset, originals retained; icon/name drift still disclosed. | `public/product/*`, `PROVENANCE.md` |
| R05 | One dominant cue stage; preparation compacted; adaptation ruled with relevant imagery; connection a short practical strip; whole-page thumbnail shows distinct chapter emphasis. | `before-doors.tsx`, `the-room.tsx`, `call-the-show.tsx` |
| R06 | After advancing, primary action becomes Replay cue change; displayed cue announced; previous decoded capture retained under the reveal; stale selection requests ignored; cue preserved across view change; large captures not all fetched on first load. | `call-the-show.tsx`, `recorded-view.tsx` |
| R07 | Selected tab unmistakable at rest/focus/reduced motion; indicator stacking inspected in the browser; Before Doors panel encompasses copy + image + caption; static panels keyboard reachable; hover never overrides selection. | `segmented-selector.tsx`, `before-doors.tsx`, `call-the-show.tsx` |
| R08 | Pause scope resolved and honest: global Pause stops nonessential presentation motion as well as the ambient field, interactions still work; OS reduced motion authoritative across engines at runtime; measured in-browser, not asserted from source. | `motion-state.tsx`, `motion-control.tsx`, `recorded-view.tsx`, `segmented-selector.tsx` |
| R09 | Escape closes the mobile disclosure and returns focus to the toggle; activating a chapter link closes it and leaves native scrolling and sensible destination focus; exiting hidden links are not focusable. | `navbar.tsx` |
| R10 | Operator named once; each chapter has a distinct job/outcome; "lease" replaced with operation/permission wording; link/QR/code explained by the receiving device; "TV with no keyboard" replaced with the verified TV flow; 2–3 source-supported practical answers. | `hero-section.tsx`, `when-plans-change.tsx`, `the-room.tsx`, `before-doors.tsx` |

## Evidence to produce

Desktop first + whole page at 1280×720, 1440×900, 1920×1080; compact 1280×600; mobile 375 — recording requested size, actual CSS viewport and zoom. Cue before/after/replay, every output, persistence, readable crop, full-view close and focus return, plus the unchanged complete source image. Adaptation selection mapping. Light visibility and pause/reduced/runtime/static fallback. Cold-image and rapid-selection handoff. Mobile Escape and keyboard. Tests, typecheck, full lint, production build. Controlled performance comparison with raw reports retained.

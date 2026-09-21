# Changelog

Format loosely follows [Keep a Changelog](https://keepachangelog.com/). Dates are when the work landed, not calendar-accurate release dates (this project doesn't tag releases yet).

## [Unreleased]

### Added
- A shared-PIN access gate for the operator surfaces, checked server-side. This was later replaced by per-operator accounts on Supabase Auth (see `docs/DEPLOYMENT.md`), and no PIN gate exists in the current code
- `/docs` expanded with `BRAND_GUIDELINES.md`, `COMPONENT_GUIDE.md`, `DEPLOYMENT.md`, `CONTRIBUTING.md`, this changelog
- Production-grade `README.md`

### Changed
- Renamed the product from StageFlow to **KramFlow** across all UI text, metadata, and docs (visual identity — logo, favicons — intentionally deferred; see `docs/BRAND_GUIDELINES.md`)
- `ProgramList` rows now collapse to a two-line stacked layout below the `sm` breakpoint instead of squeezing the title to nothing
- Operator dashboard's three-column layout now activates at `xl` (1280px) instead of `lg` (1024px), with narrower column widths at `xl` widening to full size at `2xl` — the fixed-width center/right columns were leaving too little room for the program list between 1024–1279px
- `--color-muted-2` lightened from `#6b7280` to `#828a9c` to meet WCAG AA contrast (was 3.91:1 against the background, needed 4.5:1)
- Added `focus-visible` rings to every custom interactive element; `ProgramList` rows are now real `<button>`s (keyboard/screen-reader accessible, were `<div onClick>`)
- Green Room/AV displays and the mobile remote now show "Session Finished" instead of the misleading "Not Started" once the last item is completed, and progress counters are clamped so they can no longer read something like "25 / 24"

### Removed
- Unused default `create-next-app` SVG assets, empty `supabase/` directory, unused `date-fns` dependency

### Fixed
- Live state failed to re-sync from `localStorage` after mount — hydration lived in `useSyncExternalStore`'s `getSnapshot()`, which depends on a React hydration-recheck that wasn't reliably firing. Moved hydration into `subscribe()`, which React guarantees to call post-commit.
- That fix exposed a second bug: `AnimatePresence mode="wait"` around the Live/Next/On-Deck swap could get stuck on stale content when state flipped from null to populated immediately after mount. Replaced with a plain keyed `motion.div`.

## Rebuilt as four device-specific experiences

- Replaced the centered, `max-width`-constrained desktop layout with full-bleed layouts purpose-built per surface: TV displays go edge-to-edge with only a fixed safe-area margin, the operator dashboard became a full-width three-column control room, and a dedicated one-handed mobile remote (`/remote`) was built from scratch rather than shrinking the desktop view
- Type scale increased across TV surfaces for 5–15ft legibility (hero 84px / title 36px / subtitle 28px / body 20px)
- AV display split into a two-column layout showing per-cue Audio/Video/Mic requirements instead of a single combined summary
- Added a visible progress bar to the TV footer alongside the day/session label and item count

## Built around the real Satsang Shibir 2026 cue sheet

- Replaced mock program data with a build-time parser (`scripts/build-cuesheet.mjs`) that reads the actual event's `.xlsx` cue sheet — 6 sessions, ~244 cues across 3 days — into typed, normalized JSON, regenerated automatically before every `dev`/`build`
- Added session switching to the operator dashboard (the event spans multiple days/sessions, each with independently-remembered progress) and a Pause/Hold control that freezes the shared countdown in lockstep across every display
- Reworked Green Room/AV displays around what the real data actually contains: fixed technical requirements per cue (not a live-toggleable readiness status), break/meal items in the natural sequence, section grouping in the operator's rundown
- Dropped the generic `.xlsx` import UI and its unused dependencies — out of scope until a second cue sheet format exists

## Initial commit

- `create-next-app` scaffold (Next.js 16, React 19, TypeScript, Tailwind CSS v4)

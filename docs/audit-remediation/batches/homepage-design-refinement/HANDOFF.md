# Homepage design and motion refinement: handoff for independent review

**Status: for review. Not self-approved, not deployed, not pushed, not merged.**

| | |
|---|---|
| Checkout | `/Users/deeppatel/Documents/AI/Shibir/stageflow`, branch `integrate/ui-revamp-landing` |
| BASE_SHA | `cb91464a29284abd52c182ca18d5d6d86466d48d` (prior motion-correction handoff) |
| FINAL_SHA | `6c600856483f4a75991a060a280e3ee2220cd4ac` (code `3f322c7` + evidence `6c60085`) |
| Server used for verification | A synced working copy of the tree, `next dev --webpack -p 3975`, never the live checkout's own dev server on port 3000 (its lock, PID confirmed live, was left untouched) |

## 0. A real scope correction, made before any edit

The brief describes a percentage loader, a preview/live toggle and a yellow decorative
animation. None of those exist in this checkout: the arrival is already a CSS
class-driven entrance (warm band, wordmark settle, heading light sweep), there is no
percentage counter or preview/live toggle anywhere in `components/site`, and no token in
`app/globals.css` is yellow (the palette is cream `#f4efe5`, brass `#d9b77a`, graphite,
ember). This matches the most recent motion-correction batch on this same branch
(`docs/audit-remediation/batches/homepage-motion-correction/`), which replaced exactly
these things. I asked before editing; the user confirmed: proceed against this
checkout's current state, treat the brief's descriptions as design goals, not claims
about what exists, and do not assume brass/gold tokens need replacing. Section 2 below
records that exchange's effect on scope for items 3, 5 and 7.

## 1. Baseline audit (this checkout, as found)

Six sections render on the live page (`app/page.tsx`): Hero, Before doors, Room scene
(pinned scroll scrub), When plans change (accordion), The room (3-route grid), Closing.
Each already uses a different grammar (split hero, asymmetric tabs, pinned scrub,
accordion + stable proof pane, 3-up grid, centered close) — genuinely not six repeats of
one layout.

Four files exist in `components/site` (`call-sheet.tsx`, `playable-show.tsx`,
`cta-section.tsx`, and `room-scene.tsx` is live but the first two are not) that are
**not imported by `app/page.tsx`** — dead code from an earlier design iteration, carrying
their own `Reveal` component (`framer-motion`, `whileInView`). I left them alone except
for the divider removal carried over from the prior request (section 6 below); I did not
build the new reveal system on top of them, since they render nowhere.

Measured, not assumed: section-top-to-heading padding across all six live sections is
98–150px (`py-16` to `py-20` plus the grid's own margin) — within normal range, not an
outlier. What read as a large empty gap in an early manual screenshot was the hero's own
`overflow-hidden` ambient glow still partially in the viewport mid-scroll, not a layout
defect or a leak past the section boundary.

One thing worth a second look, not fixed here: at 390×844 the console screenshot inside
the hero aperture is a full desktop capture scaled down to fit a narrow frame, so little
detail reads at a glance (see `evidence/hero-390x844.png`). The image itself loads and
decodes correctly (confirmed via `naturalWidth`, `complete`, network status); this is a
genuine product screenshot, not a missing image, and retuning its mobile crop is a
separate, careful task against the source capture, not attempted in this pass.

## 2. Source ledger

| Pattern | Author / source | Access | License | Used for | Files |
|---|---|---|---|---|---|
| ScrollTrigger (`trigger`, `start`, `once`, `onEnter`) | GreenSock / Webflow, official `gsap` npm package v3.15.0 (installed; all plugins free for every user since GSAP 3.13, April 2025) | Full source, installed in `node_modules/gsap` | GreenSock Standard "No Charge" License, bundled with the package | The scroll-reveal system | `components/site/reveal.ts` |
| GSAP context / cleanup lifecycle | Project's own `useGsap` (`components/site/use-gsap.ts`), unchanged this batch | — | — | Reused, not reinvented, by every new call site | `before-doors.tsx`, `when-plans-change.tsx`, `the-room.tsx`, `closing-section.tsx` |
| Masked word-switch (CSS keyframe steps over a fixed-height overflow:hidden window) | Standard CSS technique; same family as GSAP's own text-cycling pattern at gsap.com/text/ and Osmo's "Welcoming Words Loader" collection entry | Osmo's own source is membership-gated; not inspected or copied. Built directly in CSS against the existing `.hero-eyebrow` typography, with no dependency on either | N/A — original CSS, no third-party code included | The entrance | `app/globals.css` (`.entrance-words`, `@keyframes entrance-words-cycle`), `components/site/hero-section.tsx` |

**What was not done, and why:** `SplitText`, `Flip` and `DrawSVGPlugin` all ship in the
installed `gsap` package (confirmed: `node_modules/gsap/{SplitText,Flip,DrawSVGPlugin}.js`
exist) and were available for this batch. None were used. The headline/copy/media
reveals in this batch are plain opacity + translateY, which the brief itself prefers
over SplitText for ordinary paragraphs ("do not split ordinary paragraphs
unnecessarily"); there was no line-wrap or per-character case that needed `SplitText`'s
masking. `DrawSVGPlugin` was evaluated for item 5 and not used — see section 2a.
Osmo's gated resources (Masked Text Reveal, Queued Scroll Reveal, Step-by-step Timeline,
Underline Link Animation) were not fetched or inspected this session (no live web access
was used in this pass); the patterns implemented are standard GSAP/CSS idioms
functionally in the same family, built from first principles against this page's own
typography, not copied from an inaccessible source.

### 2a. Item 5 (yellow decorative animation) — evaluated, not replaced

The two candidates in this codebase are the hero's brass gradient sweep
(`.hero-title`, arrival-only, already settled to ordinary CSS in the prior
motion-correction batch) and the ambient light wash (`components/site/ambient-light.tsx`,
explicitly documented there as a deliberate, restrained choice — graphite/brown/ember/
cream only, "never a status light," tuned to be visible without being a spectacle).
Per the user's explicit instruction not to assume warm brand colors need replacing, and
finding no actual distracting or ungoverned effect to replace, I made no change here.
This is a "retain, and explain why" outcome, not a skipped task.

### 2b. Item 7 (signature creative moment) — evaluated, not replaced

`RoomScene` (the pinned scroll-scrub scene, "One cue. The room responds.") already is
the page's signature moment: console → four synchronized display views, driven by
ScrollTrigger pin + scrub with captions derived from painted timeline opacity. The
brief's own instruction is to refine pacing rather than add a new spectacle when one
already exists. I found no new, measured defect in its pacing this session (the prior
motion-correction batch's own forward/backward caption-agreement evidence — 25/25 —
stands and was not invalidated by anything changed here), so I left its `scrub` value
unchanged rather than retune it without a measured reason.

## 3. Implementation summary

**Entrance** (`components/site/hero-section.tsx`, `app/globals.css`): a masked
word-switch directly over the existing hero eyebrow label. Sequence: Plan → Preview →
Rehearse → "Live event operations" (the real, pre-existing label text), 1.3s total,
16px vertical steps, eased. It is a CSS overlay on the real, always-rendered label —
not a second component with its own storage or eligibility logic. It inherits
`Arrival`'s entire lifecycle unchanged: once per session (`kf-arrival-v1`), skipped for
back/forward and reload, skipped when a hash is present (deep links are never
intercepted), ends immediately on any scroll/key/pointer/touch input, and never runs
under `prefers-reduced-motion` or without JavaScript — in both of those last two cases
the real label is simply what was always server-rendered, nothing to undo. A real
defect was found and fixed during verification: the overlay initially had no opaque
background, so the real label showed through its letter gaps, reading as garbled
overlapping text. Fixed with a background-color matching the page token.

**Reveals** (`components/site/reveal.ts`, wired into `before-doors.tsx`,
`when-plans-change.tsx`, `the-room.tsx`, `closing-section.tsx`): opacity + 10–16px
rise, 350–500ms, applied via `data-reveal="heading|copy|media|stagger"` attributes.
Only elements not yet visible at mount are ever hidden, which avoids the hydration
flash that a blanket "hide everything, then reveal" approach would have produced given
`useGsap`'s one-frame-deferred scene build. Reveals fire once (`ScrollTrigger`
`once:true`) and are never re-hidden on scrolling back. A `focusin` listener on every
still-hidden target reveals it immediately, so keyboard users are never left tabbed
into an invisible control. `RoomScene` and the Hero were deliberately left alone — the
former has its own choreography, the latter is handled by the entrance.

**Yellow effect**: evaluated, retained. See 2a.

**Monotony**: evaluated; the six live sections already have distinct compositions and
normal section padding. See section 1. No forced change.

**Signature moment**: evaluated, retained. See 2b.

## 4. Before/after evidence

- `evidence/hero-entrance-mid-1440x900.png` — entrance mid-cycle ("Plan"), after the
  background-color fix.
- `evidence/hero-entrance-settled-1440x900.png` — identical to the pre-existing baseline
  once settled ("Live event operations").
- `evidence/hero-390x844.png`, `evidence/full-768x1024.png` — mobile and tablet.
- `evidence/video-fresh-entrance/`, `evidence/video-reveal-scroll/` — Playwright
  recordings (local only; `evidence/.gitignore` excludes `*.webm` from the commit,
  regenerate with the scripts in `evidence/scripts/`).

## 5. PASS/FAIL table

| Check | Viewport | Steps | Evidence | Result |
|---|---|---|---|---|
| Fresh entrance runs, settles, writes storage | 1440×900 | Fresh context, sample overlay opacity/transform every 100ms | `results/entrance-results.json` #1 (5 checks) | PASS |
| Repeat visit: no entrance | 1440×900 | Same tab, navigate twice | `results/entrance-results.json` #2 | PASS |
| Deep link: no entrance, lands at target | 1440×900 | `goto(/#features)` | `results/entrance-results.json` #3 | PASS |
| Interruption: overlay releases early, label intact | 1440×900 | Wheel 300ms in | `results/entrance-results.json` #4 | PASS |
| Reduced motion: settled immediately | 1440×900, `reducedMotion: reduce` | Fresh load | `results/entrance-results.json` #5 | PASS |
| No console errors across all of the above | — | — | same file | PASS |
| Above-fold content never fades (no flash) | 1440×900 | Sample hero `h1` opacity every 25ms for 500ms | `results/reveal-results.json` #1 | PASS |
| Below-fold heading hidden, then reveals once, never re-hides | 1440×900 | Scroll down, up, down | `results/reveal-results.json` #2 | PASS |
| Stagger group reveals together | 1440×900 | Scroll into `#room` route list | `results/reveal-results.json` #3 | PASS |
| Reduced motion: reveals already visible | 1440×900, reduced | Fresh load | `results/reveal-results.json` #4 | PASS |
| Keyboard focus reveals a hidden target early | 1440×900 | Tab into `#prepare` | `results/reveal-results.json` #5 | PASS |
| Room scene still advances phases with the new reveals registered | 1440×900 | Scroll through, read captions | `results/smoke-results.json` | PASS |
| All reveal targets end visible after a full scroll-through | 1440×900 | Scroll to bottom | `results/smoke-results.json` | PASS |
| Full-view dialog still opens/closes | 1440×900 | Click, Escape | `results/smoke-results.json` | PASS |
| Deep link still lands at the header offset | 1440×900 | `goto(/#features)` | `results/smoke-results.json` | PASS |
| 768×1024, 390×844 full-page render | tablet, mobile | Screenshot | `evidence/full-768x1024.png`, `evidence/hero-390x844.png` | PASS (visual) |
| 1280×800 | — | — | — | **NOT TESTED** this pass |
| Safari / Firefox | — | — | — | **NOT TESTED** (Chromium only) |
| Font-loading delay, animation-init failure (controlled local simulation) | — | — | — | **NOT TESTED** this pass |
| Route exit/re-entry, resize-during-animation for the *new* entrance/reveal code specifically | — | — | GM-02's equivalent checks from the prior batch cover `SmoothScroll`'s own navigation, not this batch's new overlay/reveal code directly | **NOT TESTED** this pass |
| Osmo reference inspection (live, source-level) | — | — | No live web access used this session | **NOT ATTEMPTED** |
| Complete line-by-line copy/spelling sweep | — | — | Re-read all six live sections' copy during the audit; nothing misspelled or misleading found | PASS (bounded: not a dictionary-level pass) |

## 6. Changed files and checks

| File | Change |
|---|---|
| `components/site/hero-section.tsx` | Entrance word-switch overlay over the eyebrow |
| `components/site/reveal.ts` | New: shared ScrollTrigger reveal helper |
| `components/site/before-doors.tsx` | Reveal wiring (heading/copy/media); divider removed |
| `components/site/when-plans-change.tsx` | Reveal wiring (heading/media); divider removed |
| `components/site/the-room.tsx` | Reveal wiring (heading/copy/stagger); divider removed |
| `components/site/closing-section.tsx` | Reveal wiring (heading/copy); `"use client"` added (now uses `useRef`); divider removed |
| `app/globals.css` | `.entrance-words` + `@keyframes entrance-words-cycle`; `.hero-eyebrow` line-height |
| `components/site/call-sheet.tsx`, `playable-show.tsx`, `room-scene.tsx`, `cta-section.tsx` | Divider removed (carried over from the prior request; first two files are unused by the live page) |
| `.claude/launch.json` | Added a `stageflow-review` dev-server entry on port 3975 |

Existing vs. task changes: everything above is new to this batch except the divider
removal, carried over unstaged from the prior turn's explicit request and committed
here for the first time.

Test/build output:
- `npx tsc --noEmit`: pass.
- `npx vitest run`: 652 passed, 60 files (unchanged from the prior batch; this batch
  added no new unit tests, since its correctness is behavioral/visual and is covered
  by the Playwright evidence above).
- `npx eslint .`: 0 errors. 8 warnings total, 0 introduced by this batch (3 are
  unused-var lint in the prior batch's own evidence scripts, 5 pre-existing elsewhere).
- `npx next build --webpack`: pass (the project's standard Turbopack build remains
  environment-blocked, as recorded in the prior motion-correction handoff; not
  re-investigated this batch).

**Remaining risks:**
- The entrance and reveal system have not been exercised on Safari or Firefox.
- 1280×800 was not explicitly verified (390×844, 768×1024 and 1440×900 were).
- The mobile hero console crop (section 1) may be worth a dedicated pass.
- `call-sheet.tsx`, `playable-show.tsx` and `cta-section.tsx` are dead code with their
  own `Reveal`/framer-motion pattern; they were not removed (out of scope for this
  batch) and could confuse a future reader into thinking they're live.

## 7. Regression checklist

- [ ] Fresh visit: entrance plays once, ends on the real eyebrow label, no stuck overlay.
- [ ] Repeat visit / reload / Back: no entrance replay.
- [ ] Deep link (`/#features`, `/#product`): no entrance, lands at the header offset.
- [ ] Reduced motion: hero and all reveal targets visible immediately, nothing to click through.
- [ ] Scroll down through the whole page: every `data-reveal` target ends at opacity 1.
- [ ] Scroll back up then down again: nothing re-hides.
- [ ] Tab through the page with a screen reader or keyboard only: no invisible focus targets.
- [ ] Room scene (pinned) still advances/retreats through its four phases.
- [ ] Full-view dialog (both callers) still opens, traps focus, and closes on Escape/backdrop.
- [ ] No new console errors on load, scroll, resize or route change.

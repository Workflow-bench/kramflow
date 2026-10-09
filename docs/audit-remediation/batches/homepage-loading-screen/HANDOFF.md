# Loading screen redesign (piece 1 of 2: "do one by one")

**Status: for review.** Not deployed, pushed, merged or self-approved. The landing
page's section-level redesign is the next piece, not started in this batch.

| | |
|---|---|
| Checkout | `/Users/deeppatel/Documents/AI/Shibir/stageflow`, branch `integrate/ui-revamp-landing` |
| Skill used | `design-taste-frontend` (loaded in full before any edit) |
| Design read | Redesign-preserve of a B2B live-events SaaS entrance moment: borrow the kinetic-typography/curtain choreography vocabulary from an agency-portfolio reference, keep KramFlow's existing brand tokens, copy and Arrival lifecycle intact (Section 11 of the skill: a brand that is already cream/brass stays cream/brass; IA, copy voice and the existing eligibility/storage contract do not change). |
| Dials | `DESIGN_VARIANCE 7` (matches the existing hero's split layout) · `MOTION_INTENSITY 7` for this one entrance moment (redesign-preserve baseline +1, since the brief explicitly asks for a bigger signature entrance here) · `VISUAL_DENSITY 3` (unchanged, matches the existing airy hero) |

## Reference check, honestly reported

`https://www.dennissnellenberg.com/work` returned **HTTP 403** to a direct fetch this
session (bot protection) and could not be inspected. `inspo`'s `recommend` and
`search_screens` were queried for agency-portfolio preloaders; the archive holds static
screen captures, not preloader *sequences* (a preloader is transient, so it doesn't
survive as a capture), and no close analogue surfaced. I did not fabricate specifics
about that site's actual preloader mechanics. What was built instead is GSAP's own
officially documented pattern for this genre of effect (SplitText chars-in/chars-out,
`gsap.com/docs/v3/Plugins/SplitText`, same technique as the Lines demo at
`gsap.com/text/`), which is the real, inspectable, source-backed implementation path
available this session - not a guess at an uninspected site's code.

## What changed

- **`components/site/loading-screen.tsx`** (new): markup only. A fixed, full-viewport,
  `pointer-events-none` overlay with four stacked word elements (`Plan`, `Preview`,
  `Rehearse`, `Live`), hero-scale type (`clamp(2.75rem,6.4vw,7rem)`, the same clamp
  `.hero-title` uses), `text-primary` (the same `#f4efe5` cream `.hero-title` is set to
  explicitly - confirmed from the token, not assumed).
- **`components/site/arrival.tsx`** (rewritten): still the one place that owns
  eligibility, session storage, interruption and Strict Mode safety - none of that logic
  changed. What's new: it builds a GSAP `SplitText` timeline (chars masked in, held
  briefly, masked out, per word) and finishes with a curtain - the whole overlay
  collapses `scaleY: 0` from the top, revealing the real, already-rendered hero
  underneath. `tl.onComplete` now drives `finish(true)` in place of the old flat
  `setTimeout`. A `try/catch` around the timeline build falls back to a plain timed
  settle (the old CSS-only behavior) if SplitText or the timeline construction throws
  for any reason - a GSAP error can never leave an opaque cover stuck on screen.
- **`app/globals.css`**: `.loading-screen` (opacity 0 by default, so there's no
  default-hidden state a no-JS visitor can be stuck behind) and `.loading-word`; removed
  the superseded `.entrance-words` eyebrow-overlay block from the prior batch.
- **`components/site/hero-section.tsx`**: the eyebrow is a plain label again. The
  masked word-switch that used to sit on top of it now lives in the full-viewport
  loading screen instead, so there are not two competing entrance animations.

## Why this design, not a bigger rebuild

The brief's own word-stage sequence (Plan -> Preview -> Rehearse -> Live) was already
established as the product's real language in the prior batch; it is reused here at
full scale, not reinvented. The curtain wipes away to reveal the hero's own existing
`"Live event operations"` eyebrow, so the loading screen's last word and the page's
first real line of text are the same claim, not two different ones. Per the skill's
redesign-preservation rules, nothing about the product's copy, IA, color tokens or the
Arrival component's hard safety contract (once per session, deep-link skip, reduced
motion, interruption, Strict Mode) was touched - only the *visual* entrance changed.

## Evidence

- `evidence/loading-mid-1440x900.png` - mid-sequence (chars staggering in on "Preview").
- `evidence/loading-curtain-1440x900.png`, `evidence/loading-settled-1440x900.png`.
- `evidence/loading-mid-390x844.png` - mobile.
- `evidence/video-fresh-load/` - Playwright recording (local; `.gitignore`d, regenerate
  with `evidence/scripts/loader-shots.mjs`).
- `evidence/results/loader-results-prod.json` - **19/19** against the production
  (`next start`) build.
- `evidence/results/loader-results-dev-strict.json` - Strict Mode dev run, same checks
  (18/19 before a timing trim measured and fixed mid-session; see Measurements below).

## PASS/FAIL table (production build, 1440x900 unless noted)

| Check | Result |
|---|---|
| Overlay becomes visible on a fresh visit | PASS |
| All 4 words appear in sequence | PASS |
| Curtain collapses (`scaleY -> 0`) before settling | PASS |
| Settles: class removed, overlay invisible | PASS |
| Total duration bounded (measured 2052ms, see Measurements) | PASS |
| Real hero eyebrow intact and correct after the wipe | PASS |
| Session storage written on natural completion | PASS |
| No console errors | PASS |
| Repeat visit (same tab): no loading screen | PASS |
| Deep link `/#features`: no loading screen, lands at 88px offset | PASS |
| Interruption mid-sequence (wheel at 900ms): overlay releases, not stuck | PASS |
| Interruption marks the visit seen (by design, `finish(true)`) | PASS |
| Real CTA reachable immediately after an interrupt | PASS |
| Reduced motion: overlay never shows | PASS |
| Overlay never captures pointer events (`pointer-events: none`) throughout | PASS |
| Room scene (pinned scroll scrub) still advances through its phases | PASS |
| Full-view dialog still opens/closes on Escape | PASS |
| Section reveals (prior batch) still fire correctly | PASS |
| 768x1024, 1280x800 | **NOT TESTED** this pass (1440x900, 390x844 were) |
| Safari / Firefox | **NOT TESTED** (Chromium only) |

## Measurements

- **Total entrance duration (production, including page load and hydration): 2052ms.**
  This exceeds the original brief's 0.9-1.4s target, stated explicitly: four full-word
  SplitText chars-in/chars-out beats at hero type scale genuinely need more read time
  than the prior batch's small eyebyrow-label swap did, and this batch's design read
  (`MOTION_INTENSITY 7`, a deliberate signature moment) called for a fuller kinetic
  treatment. It was tuned down once already this session (from a measured 3888ms) and
  is reported honestly rather than claimed against the original number. Content
  underneath is real and already rendered throughout - this is a decorative overlay a
  visitor can dismiss with any input at any point, not a gate.
- Checks run on both a Strict Mode dev server and the production (`next start`) build;
  the numbers above are the production run's.

## Checks

- `npx tsc --noEmit`: pass.
- `npx vitest run`: 684 passed, 62 files (no new unit tests added this batch; this
  work is behavioral/visual and is covered by the Playwright evidence above).
- `npx eslint .`: 0 errors, 8 warnings (all pre-existing elsewhere; none introduced by
  this batch's files).
- `npx next build --webpack`: pass. Standard Turbopack build remains
  environment-blocked, unchanged from the prior two batches; not re-investigated here.

## Regression checklist

- [ ] Fresh visit: loading screen plays once, curtain reveals the real hero, no stuck cover.
- [ ] Repeat visit / reload / Back / deep link: no loading screen.
- [ ] Reduced motion: hero visible immediately, loading screen never appears.
- [ ] Interrupting with scroll, a key, a click or touch at any point during the
      sequence ends it at once and the interaction underneath still happens.
- [ ] Room scene, full-view dialog, section reveals (prior batches) still work.
- [ ] No new console errors on load.

## Next piece

The landing page's section-level redesign (composition, hero/section rhythm,
screenshots, any further motion beyond this entrance) was explicitly deferred per "do
one by one." It has not been started.

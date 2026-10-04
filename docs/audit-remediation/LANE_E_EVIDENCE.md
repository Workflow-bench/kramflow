# Lane E evidence: accessibility, reflow, contrast, LCP

Evidence class: LOCAL PRODUCTION BUILD (`npm run build`, `next start`, localhost). Not a remote or deployed measurement. Lighthouse runs use Chrome headless on this machine with Lighthouse's default simulated throttling.

## 1. Contrast

Method: in the production page, every element with direct, rendered text was measured. Effective colour was composited over the real background stack and checked with the WCAG 2.x ratio (4.5:1 normal text, 3:1 large text).

| Measurement | Result |
| --- | --- |
| Before the fix (page scrolled, reveals settled) | 11 failing rows, lowest ratio 2.28:1 |
| After the fix | 68 rows measured, 0 failing, lowest ratio 4.72:1 |
| Excluded from measurement | 5 rows at effective opacity 0: inactive frames of the cross-fading product demo. None is visible at rest. The visible frame of each is measured. |

Cause and fix: the room section's depth effect put `opacity` on the whole `<figure>`, so the screen caption faded with the screen. The farthest caption dropped to 2.28:1. Opacity now sits on the screen image only (`components/site/room-section.tsx`). The caption keeps its token colour.

Lighthouse, desktop: colour-contrast items 27 in the baseline, 0 after the fix. The accessibility category scores 1.0 in all runs.

Not verified here: hover, focus, and disabled states; the hero overlay (noted in the audit as unconfirmed).

## 2. Headings and landmarks

- The audit's "duplicate accessibility-tree headings" comes from DOM twins: the landing page renders a desktop and a mobile copy of two sections, and one copy is `display:none` at any width. Checked with computed style at 925 px and 1440 px: each heading is rendered once. The accessibility tree read by the browser tool still lists both copies, so that tool does not filter `display:none` nodes. Lighthouse `heading-order` and `landmark-one-main` both pass.
- Removing the hidden twins would be a larger component refactor. Not done; it does not affect what a visitor or screen reader gets.

## 3. Skip link

- Added on the landing page (`app/page.tsx`): a "Skip to content" link, the first focusable element, visible on keyboard focus, targeting a focusable `#main-content` wrapper after the navigation.
- Verified in the browser: the link is the first Tab stop, it is visible at the top-left with a 2px `#f4efe5` focus ring, and Enter moves focus to `#main-content`.
- Other routes have no skip link yet. They are authenticated surfaces or small forms; that is a follow-up, not claimed here.

## 4. Keyboard and focus

- Password show/hide (`components/auth/password-input.tsx`): verified with the pointer (the input's type flips to `text` and `aria-pressed` becomes `true`) and by keyboard (focus the control, Enter toggles it back). The control has `type="button"`, so it never submits the form.

## 5. Reflow

Horizontal overflow measured on the production landing page at each width. Overflow means `scrollWidth - innerWidth`, plus any visible element extending past the viewport edge outside a clipping ancestor.

| Width | Route | Document overflow | Elements past edge |
| --- | --- | --- | --- |
| 320 | `/` | 0 | 0 |
| 320 | `/reset` | 0 | not run (document check only) |
| 375 | `/` | 0 | 0 |
| 768 | `/` | 0 | 0 |
| 1024 | `/` | 0 | 0 |
| 1440 | `/` | 0 | 0 |
| 1440 | `/login` | 0 | 0 |

Not checked: the 1280 and 1920 widths; the authenticated console and cue-sheet pages at any width (they need a session); true 200% browser zoom (320 CSS px is the reflow test WCAG uses).

## 6. Lighthouse and LCP

Production build, Chrome headless, Lighthouse 13.5.0, `performance` and `accessibility` categories.

Desktop (4 runs, after the contrast and skip-link changes):

| Run | Performance | Accessibility | LCP (ms) | CLS |
| --- | --- | --- | --- | --- |
| 1 | 0.99 | 1 | 979 | 0 |
| 2 | 1 | 1 | 696 | 0 |
| 3 | 1 | 1 | 522 | 0 |

Desktop LCP varies from 522 to 979 ms across runs. The audit's recorded desktop value was 644 ms. Desktop performance is not a problem here, and single runs are not enough to say more.

Mobile LCP, quality setting compared (3 runs each, same build otherwise):

| Product-shot quality | Runs (ms) | Median (ms) | Console image transfer |
| --- | --- | --- | --- |
| 90 (before) | 4609, 4590, 3926 | 4590 | 157 KB |
| 80 (after) | 2418, 3318, 4676 (run set 1); 2737, 2797, 3860 (run set 2) | 2797 to 3318 across sets | 104 KB |

The change is `quality={90}` to `quality={80}` in `components/site/product-shot.tsx`, which is one encode setting for the interface screenshots. The console image is 34% smaller. LCP improves in the lab, but the spread is wide, so the size of the gain is not settled.

LCP profile (mobile trace): the LCP candidate is the hero console image (type `image`). Its transfer is the largest single resource, the mobile crop renders the image at 320% of the container width (`CONSOLE_SIZES`), and the `lcp-discovery` audit reports `priorityHinted: false`. Lighthouse's `lcp-breakdown` subparts add up to about 160 ms, while the LCP itself is measured at several seconds, so the simulated-throttle timeline is not fully explained by the subparts. That is a gap in this profile, not an answer.

Mobile run before the quality change: performance 0.85, accessibility 1, FCP 910 ms. The three quality-80 runs recorded LCP only; their performance scores were not kept.

Next steps, not done:

- A pre-cropped mobile asset for the hero console (the crop covers about a third of the image, so it could shrink more than quality alone).
- Investigate the `priorityHinted: false` result: the hero image has `priority`, but the hidden desktop copy also downloads.
- Trace-level profile of the remaining LCP gap.

## 7. Not verified

- Screen-reader announcements for the toast and the reset confirmation (markup only).
- Authenticated surfaces (console, cue sheet, rehearsal, remote): they need a real session, which this lane did not create.
- Real-device touch targets.

# Desktop hero and navigation design pass

5 October 2026. Scope: desktop header, hero, hero framing, gradient, hero motion, minimal anchor integration. Lower sections, auth, APIs and backend are untouched. Not self-approved; pending user visual judgment and independent Codex review.

## Baseline identity

| Item | Value |
|---|---|
| Branch | `integrate/ui-revamp-landing` |
| HEAD at start | `83704a60eb3b621c3a753b9850ec6bb9e3cc122d` |
| Restored landing source | `origin/ui-revamp` `6d69834ea36f5e9d728daf050be5b7eae7d57e7e` |
| Working tree at start | Restored `ui-revamp` landing (12 modified, `hero-scene.tsx` deleted, `go-link.tsx` + `standby-overlay.tsx` untracked) |
| Before captures | Built from the restored files exactly as they stood (verified by md5 against `6d69834`) |

Pre-existing untracked paths (`.agents/`, `.claude/`, `.impeccable/`, `brag-output*/`, `data/skills/`, `skills-lock.json`, two `REVIEWS` files) were preserved and excluded from the commit.

## Reference to decision

| Reference | Principle taken | Applied here |
|---|---|---|
| Linear | Heading and nearby explanation precede a recognisably detailed product surface on one dark material | Headline, explanation and both actions form one left cluster; the real console runs full width beneath them on the same graphite ground |
| Raycast | Bounded header reads as a single navigation object; atmospheric depth behind the product | 1440px header grid shared with the hero, 77px tall, one restrained surface; a quiet warm light field behind the capture's top edge, far below Raycast's intensity |
| ChronoTask | Message, explanation and action belong in one reading group with intentional whitespace | The far-right disconnected paragraph and its separate signup button were folded into the headline cluster |
| DeFi | Soft atmospheric light creates depth without competing with the message | One masked charcoal/amber/cream field, kept out of the reading column and behind (never over) the screenshot |

Excluded deliberately: their branding, claims, interfaces, light themes, floating cards, logos and decorative nodes.

## Screenshot provenance

| Field | Value |
|---|---|
| File | `public/product/console.png` |
| Route captured | `/e/<event>/operator` (Operator Console) |
| Subject | Seeded "Northwind Summit 2026", Day 1 Morning Session, Rehearsal Mode |
| Dimensions | 3360 × 2100, 531 KB |
| Class | **Real app capture through an authenticated session** (produced by `scripts/capture-product.mjs`), not a local fixture and not a recreation |
| Captured | 20 September 2026 16:59 local |
| Presentation | Intact. Cropped by nothing, recoloured by nothing, no pixel retouching. Only the external frame changed. |

**Known drift, disclosed:** exactly one visible element has changed in the app since this capture. Commit `856ff4a` ("fix(auth): one confirmed sign-out contract across every logout entry point") replaced the header's trailing padlock (`Lock`) with a `LogOut` icon in `components/operator/event-shell-header.tsx`. The capture still shows the padlock. Verified by diffing every file the console composes since the capture timestamp: `event-shell-header.tsx` (this icon) and `controls-panel.tsx` (logic only, no visible change) are the only ones touched.

**Why it was not re-captured — exact blocker:** refreshing the capture requires `npm run capture:product`, whose first step (`scripts/seed-marketing-demo.ts`) writes rows to the hosted Supabase project (`NEXT_PUBLIC_SUPABASE_URL` is a remote `*.supabase.co` instance), and whose capture step PATCHes `display_registry`. Both are shared-resource mutations, which this assignment forbids. A read-only re-capture is also unavailable: `scripts/capture-product.mjs` authenticates with `DEMO1_PASSWORD`, which is not present in `.env.local`, and no local Supabase stack is running (port 54321 closed; 54329 is an unrelated local Postgres). The old capture is therefore **not claimed to match the current app**; the drift above is stated instead. Resolving this needs either `DEMO1_PASSWORD` for a read-only session or authorisation to seed.

## Checks

| Check | Result | How |
|---|---|---|
| Matched before/after at measured 1280×800, 1440×900, 1920×1080, 1280×600 | PASS | `capture.cjs`, same script both states; `innerWidth`/`innerHeight` recorded in `report.json` |
| 375px mobile regression | PASS | Captured; no overflow, header 77px, h1 44px |
| Header height 72–80px | PASS | Measured 77px at every width (before: 86px) |
| Headline ~80–104px desktop | PASS | 79.4px @1280, 89.3px @1440, 104px @1920 |
| Nav labels map to existing anchors | PASS | `#one-cue`, `#product`, `#features` verified present in source and resolved in-page |
| No obscured targets under fixed header | PASS (fixed) | Was broken in **both** states (section top 0 vs header bottom 69). `scroll-margin-top: 96px` added; now top 96 |
| Keyboard order and visible focus | PASS | Tab order: 3 nav links → Log in → Start free (44px each) → hero Start free → See it in action (52px each); every stop reports an outline/ring |
| No horizontal overflow | PASS | `scrollWidth == innerWidth` at all five widths |
| Lower-page sequence intact | PASS | Section order Standby → one-cue → product → features → Guarantees → Go; one-cue pin height 2881px; demo "Next" present |
| Auth pages unchanged | PASS | No auth file in the diff |
| Hydration/image/shader/console errors | PASS | Zero console errors and zero page errors across all captures |
| Text contrast over gradient's brightest state | PASS | `contrast.cjs`: text hidden, composited background screenshotted with shader live, brightest pixel per text box sampled. Min 4.81:1 (13px label), h1 11.18:1, support 6.46:1, caption 5.06:1, nav 7.3:1 |
| Reduced motion | PASS | No shader, no entrance animation, standby accent `display:none`, h1 visible |
| WebGL unavailable | PASS | `--disable-3d-apis`: no canvas, static field composes, h1 visible, zero errors |
| GPU released on unmount | PASS | Canvas present, then absent after reduced-motion emulation (library `dispose()` path) |
| Product image clarity at display size | PASS | Program list, timer, controls and activity log legible at 1440 |
| Typecheck / lint / production build | PASS | `tsc --noEmit` clean; ESLint 0 errors, 5 pre-existing warnings; `next build` succeeds |
| Full test suite | PASS | 638/638 across 58 files |
| Lighthouse a11y 1.00 | **PARTIAL — pre-existing** | 0.96 in **both** before and after. Failures are `text-muted-2/60` spans in one-cue and call-sheet (restored `ui-revamp` content), outside this scope |
| Capture matches current app | **PARTIAL** | One drifted icon, disclosed above |
| The user's enumerated "18 screenshot findings" | **UNVERIFIED mapping** | No document in the repo or the Codex outputs folder enumerates them; mapping below is derived from the baseline capture and the brief's own problem statements |

## Desktop performance (production build, same settings, 3 runs each)

Lighthouse 13.5.0, `--preset=desktop`, `--only-categories=performance,accessibility`, headless Chrome, own server on port 3961, no concurrent build.

| Series | LCP runs (ms) | LCP median | CLS | Perf | A11y |
|---|---|---|---|---|---|
| Before | 696, 676, 673 | **676** | 0 | 0.99 | 0.96 |
| After | 794, 794, 793 | **794** | 0 | 1.00 | 0.96 |
| After, gradient removed (control) | 843, 791, 722 | 791 | 0 | — | — |

- Target desktop LCP ≤ 2.5s: **met** (794ms). CLS ≤ 0.1: **met** (0).
- The +118ms is **not** gradient cost. The gradient-removed control measures 791ms against 794ms with it — a 3ms difference inside a series whose own spread is 722–843ms.
- The cause is the LCP element changing: before it was a headline `<span>`; after it is the console `<img>`, because the new composition brings the real product into the initial desktop viewport. The page's largest contentful paint is now the product itself.

## Findings addressed

The user's enumerated list was not available (see above). Derived from the baseline capture and the brief's stated problems:

| # | Baseline problem | Resolved | How checked |
|---|---|---|---|
| 1 | Nav links tiny uppercase console-label type | Yes | 15px sentence case, measured |
| 2 | Nav labels used internal vocabulary ("One cue", "Product") | Yes | "How it works", "Try the demo", "Features" |
| 3 | Header 86px and on a different grid (1600) from the hero | Yes | 77px, shared 1440 grid |
| 4 | No cohesive header surface | Yes | One restrained surface, compacts on scroll, captured scrolled |
| 5 | Nav signup styled apart from the hero action | Yes | One `SiteAction` family, 44px nav / 52px hero |
| 6 | Explanation and signup stranded in a far-right column | Yes | Single left reading cluster |
| 7 | Signup control read "STANDBY" | Yes | `GoLink` removed from the hero; plain "Start free" |
| 8 | Unexplained pseudo-live telemetry strip | Yes | Replaced by "Live event operations" |
| 9 | Real wall clock mixed with mock show state | Yes | `useWallClock` and `SplitFlap` removed from the hero |
| 10 | No secondary route to the demo | Yes | "See it in action" → `#product` |
| 11 | Headline scale made everything else incidental | Yes | 79–104px with the cluster given weight; measured |
| 12 | Invented traffic lights and URL chrome on the hero capture | Yes | Hero uses a plain frame; `AppWindow` untouched for lower sections |
| 13 | Hero forced into `100svh`, crushing the interface | Yes | Height cap removed; capture extends naturally |
| 14 | Bottom gradient faded the product into black | Yes | Removed from the hero |
| 15 | Copy faded out on scroll while being read | Yes | Scroll-linked opacity/translate removed |
| 16 | Full-screen STANDBY cover gated the first screen ~1.45s | Yes | Now a small non-blocking corner accent; content readable at first paint |
| 17 | Static rehearsal capture presented unlabelled | Yes | Caption "Operator console · Example event in rehearsal" |
| 18 | Anchor jumps landed under the fixed header | Yes | `scroll-margin-top: 96px`; measured before and after |

Not addressed in this scope: the capture's drifted logout icon (blocked, above) and the lower-page `text-muted-2/60` contrast failures (outside scope, pre-existing in both states).

## Gradient implementation

`@paper-design/shaders-react` pinned at `0.0.81` (exact, no caret), peer `react ^18 || ^19` against React 19.3.0; no Three.js stack. `components/site/hero-gradient.tsx`:

- `.hero-light` static CSS radial gradients are in the server HTML and are never removed; the shader only fades in on top.
- Module imported after first paint, on `requestIdleCallback`, and only when the hero intersects the viewport.
- Colours set explicitly in KramFlow's palette; no demo preset retained. Operational green and orange are deliberately absent.
- `maxPixelCount` 1280×720, `minPixelRatio` 1, `speed` 0.12, `distortion` 0.6, `swirl` 0.08.
- `aria-hidden`, `pointer-events-none`, masked away from the reading column, `z-0` beneath both the copy and the capture.
- Library pauses on `visibilitychange` and via its own IntersectionObserver, and disposes GL resources on unmount; WebGL2 is probed before mount and an error boundary catches context loss.

## Files changed by this pass

Authored or edited here: `components/site/hero-section.tsx`, `components/site/navbar.tsx`, `components/site/standby-overlay.tsx`, `components/site/hero-gradient.tsx` (new), `components/site/site-action.tsx` (new), `app/globals.css`, `app/page.tsx` (restores the dropped B006-F1/F2 metadata only), `package.json`, `package-lock.json`.

Committed but **not modified** by this pass (restored `ui-revamp` content, verified byte-identical to `6d69834`): `components/site/call-sheet.tsx`, `cta-section.tsx`, `live-operations-section.tsx`, `one-cue-section.tsx`, `playable-show.tsx`, `product-shot.tsx`, `use-gsap.ts`, `go-link.tsx`.

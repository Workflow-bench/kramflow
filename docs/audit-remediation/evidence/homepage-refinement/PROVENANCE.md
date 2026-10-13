# Published product-image provenance (HOME-R04)

Every image on the homepage is a genuine capture of KramFlow running the seeded "Northwind Summit 2026" event, produced by `scripts/capture-product.mjs`. None is a recreation, mockup, redrawn control or regenerated image. Nothing is repainted, colour-graded or retouched; page framing (aperture, crops, fade) is applied around the pixels, never inside them. Machine-readable copy: `assets.json`.

## Development artefact removed by crop

The Next.js development indicator was baked into **13 of the 14** published captures. It was measured, not guessed: an identical 158-pixel bright glyph at a fixed bottom-left position, full extent x 38-113 and y 39-114 from the bottom.

Recapture is blocked (below) and retouching is forbidden, so the artefact was removed by **crop** — a framing operation that preserves every remaining pixel at uniform scale. For each asset the crop axis was chosen only where content bounds were measured to allow it; the originals remain in git history at `a29ebf2`.

| File | Crop applied | SHA-256 before | SHA-256 after |
|---|---|---|---|
| `cue-sheet.png` | bottom 120px, 2360x1800 -> 2360x1680 | `073cba72817214cd` | `dea0158376bcf335` |
| `rehearsal.png` | bottom 120px, 2560x1880 -> 2560x1760 | `e51ab674ff954a05` | `959c0351ef3aa96a` |
| `display-presenter.png` | left 120px, 3840x2160 -> 3720x2160 | `031bc8e920185199` | `02b3312f8de84070` |
| `display-presenter-prev.png` | left 120px, 3840x2160 -> 3720x2160 | `d4e175b1ade905ba` | `4576f40407643bd3` |
| `display-av.png` | left 120px, 3840x2160 -> 3720x2160 | `78398ea4edf76ceb` | `64777b8073339f8f` |
| `display-av-prev.png` | left 120px, 3840x2160 -> 3720x2160 | `b6f5a488ad991082` | `978a36e32f0da3af` |
| `display-speaker-ready.png` | left 120px, 3840x2160 -> 3720x2160 | `5798583d06489e04` | `a010357daf32dffe` |
| `display-speaker-ready-prev.png` | left 120px, 3840x2160 -> 3720x2160 | `01f79c2a10095632` | `19300e50cac151d6` |
| `display-general.png` | left 120px, 3840x2160 -> 3720x2160 | `3090846d8a918d56` | `ac02846c76d55441` |
| `display-general-prev.png` | left 120px, 3840x2160 -> 3720x2160 | `848bf5c587171d46` | `74355ab33a549a4f` |
| `broadcast.png` | left 114px, 2560x1880 -> 2446x1880 | `7a7c77d0adbfd66c` | `62840dc04b798be2` |
| `displays.png` | bottom 120px, 2880x2000 -> 2880x1880 | `bec3d25498e0400b` | `7ad4300de342f9d2` |

`console-prev.png` is the one asset that could **not** be de-badged: its measured safe margins are 96px left and 40px bottom, both smaller than the badge, so any crop would cut real content. It still carries the badge. `console.png` never had one.

## Every published asset

| File | Route | Used in | Dimensions | Captured | SHA-256 (first 16) |
|---|---|---|---|---|---|
| `console.png` | `/e/<event>/operator` | Hero aperture; Call the show (cue 4); adaptation crops | 3360x2100 | 2026-09-20 16:59 | `4d3f024fdf7543e4` |
| `console-prev.png` | `/e/<event>/operator` | Call the show (cue 3) | 3360x2100 | 2026-09-16 21:23 | `6e74a5910e9ed844` |
| `cue-sheet.png` | `/e/<event>/operator/cue-sheet` | Before doors (Prepare) | 2360x1680 | 2026-09-16 21:23 | `dea0158376bcf335` |
| `rehearsal.png` | `/e/<event>/rehearsal` | Before doors (Rehearse) | 2560x1760 | 2026-09-16 21:23 | `959c0351ef3aa96a` |
| `display-presenter.png` | `/presenter?token=…` | Call the show (Presenter, cue 4) | 3720x2160 | 2026-09-16 21:23 | `02b3312f8de84070` |
| `display-presenter-prev.png` | `/presenter?token=…` | Call the show (Presenter, cue 3) | 3720x2160 | 2026-09-16 21:23 | `4576f40407643bd3` |
| `display-av.png` | `/av?token=…` | Call the show (AV, cue 4) | 3720x2160 | 2026-09-16 21:23 | `64777b8073339f8f` |
| `display-av-prev.png` | `/av?token=…` | Call the show (AV, cue 3) | 3720x2160 | 2026-09-16 21:23 | `978a36e32f0da3af` |
| `display-speaker-ready.png` | `/green-room?token=…` | Call the show (Green Room, cue 4) | 3720x2160 | 2026-09-16 21:23 | `a010357daf32dffe` |
| `display-speaker-ready-prev.png` | `/green-room?token=…` | Call the show (Green Room, cue 3) | 3720x2160 | 2026-09-16 21:23 | `19300e50cac151d6` |
| `display-general.png` | `/general?token=…` | Call the show (General, cue 4) | 3720x2160 | 2026-09-16 21:23 | `ac02846c76d55441` |
| `display-general-prev.png` | `/general?token=…` | Call the show (General, cue 3) | 3720x2160 | 2026-09-16 21:23 | `74355ab33a549a4f` |
| `broadcast.png` | `/e/<event>/broadcast` | When plans change (Send a notice) | 2446x1880 | 2026-09-16 21:23 | `62840dc04b798be2` |
| `displays.png` | `/e/<event>/displays` | The room (fleet inspection) | 2880x1880 | 2026-09-16 21:23 | `7ad4300de342f9d2` |

## Demonstration state

| File | State shown |
|---|---|
| `console.png` | Day 1 Morning Session, Rehearsal Mode, Product Launch Demo live, 13:51 remaining |
| `console-prev.png` | Same show one cue earlier, Opening Keynote live, 20:52 remaining |
| `cue-sheet.png` | Day 1 Morning Session, 7 items, Product Launch Demo current |
| `rehearsal.png` | Rehearsal run of the same seeded show |
| `display-presenter.png` | Confidence monitor at the advanced cue |
| `display-presenter-prev.png` | Confidence monitor one cue earlier |
| `display-av.png` | Technical requirements at the advanced cue |
| `display-av-prev.png` | Technical requirements one cue earlier |
| `display-speaker-ready.png` | Performer display at the advanced cue |
| `display-speaker-ready-prev.png` | Performer display one cue earlier |
| `display-general.png` | Lobby display at the advanced cue |
| `display-general-prev.png` | Lobby display one cue earlier |
| `broadcast.png` | Composer and active notices for the seeded show |
| `displays.png` | Four provisioned displays, all online |

## Drift against the current app

Captures remain genuine but are **not** proven to match the app as it stands today.

| File | Drift |
|---|---|
| `console.png` | Header trailing icon is the old padlock; the app now renders LogOut (856ff4a). CONFIRMED, unresolved. |
| `console-prev.png` | Same padlock drift. Also the ONLY published asset still carrying the Next.js dev badge: no crop margin exists on either axis without cutting content. |
| `cue-sheet.png` | Page changed since capture (post-import session choice UI). Visible impact on this view NOT established. |
| `rehearsal.png` | View changed since capture (status line, reset confirmation, overlay badge). Visible impact NOT established. |
| `display-presenter.png` | Display client changed since capture on error/loading paths only; normal state not re-verified. |
| `display-presenter-prev.png` | As above. |
| `display-av.png` | As above. |
| `display-av-prev.png` | As above. |
| `display-speaker-ready.png` | Captured from /green-room; file name keeps the older wording. Labelled with the current canonical name 'Green Room'. |
| `display-speaker-ready-prev.png` | As above. |
| `display-general.png` | As the other display clients. |
| `display-general-prev.png` | As above. |
| `broadcast.png` | Message placeholder text changed since capture. POSSIBLE visible drift, not re-verified. |
| `displays.png` | Shows the old 'Speaker Ready' type label; DISPLAY_TYPES now labels that type 'Green Room'. CONFIRMED, unresolved. |

## Recorded clocks differ between captures

`console.png` reads 13:51 while `console-prev.png` reads 20:52, and the venue displays carry their own times. These are separate recordings made minutes apart, so their clocks do not agree. That is a property of the capture session, **not** evidence of a live synchronisation fault, and the numbers are left exactly as recorded rather than repainted to match.

## Why the captures were not refreshed

1. **The capture pipeline is not read-only.** `npm run capture:product` first runs `scripts/seed-marketing-demo.ts`, which writes rows to the hosted Supabase project (`NEXT_PUBLIC_SUPABASE_URL` is a remote `*.supabase.co` instance); `scripts/capture-product.mjs` then PATCHes `display_registry` heartbeats and signs in to take control. Those are shared-resource writes, which this batch forbids.
2. **No authorised read-only session exists here.** That script authenticates with `DEMO1_PASSWORD`, absent from `.env.local` (present keys: `AUTH_COOKIE_SECRET`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `OPERATOR_PIN`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_OIDC_TOKEN`). No local Supabase stack is running (port 54321 closed; 54329 is an unrelated local Postgres).

A network-isolated fixture remains the other route. `lib/display-engine/fake-transport.ts` already drives the real display store with no Supabase and no network (used by the production-excluded `/dev/realtime` harness), but it is a store-level harness; mounting the four display surfaces and the Operator Console against it is a build of its own and was not half-done here.

**Exact remaining actions:** (a) supply `DEMO1_PASSWORD` for a read-only capture run, or authorise a seed; and (b) once captured, the padlock, the 'Speaker Ready' fleet label and `console-prev.png`'s dev badge all resolve together. Until then these are disclosed, not hidden.

# Published product-image provenance

Every image on the homepage is a genuine capture of KramFlow running the seeded "Northwind Summit 2026" event, produced by `scripts/capture-product.mjs`. None is a recreation, mockup, redrawn control or regenerated image. Nothing has been repainted, colour-graded or retouched; page framing (aperture, fade, frames) is applied around the pixels, never inside them.

Capture app revision: the captures predate this pass. `console.png` was taken 2026-09-20; every other published asset 2026-09-16. Machine-readable copy: `assets.json`.

| File | Route | Used in | Dimensions | Captured | SHA-256 (first 16) |
|---|---|---|---|---|---|
| `console.png` | `/e/<event>/operator` | Hero aperture; Call the show (after state) | 3360x2100 | 2026-09-20 16:59 | `4d3f024fdf7543e4` |
| `console-prev.png` | `/e/<event>/operator` | Call the show (before state) | 3360x2100 | 2026-09-16 21:23 | `6e74a5910e9ed844` |
| `cue-sheet.png` | `/e/<event>/operator/cue-sheet` | Before doors (Prepare) | 2360x1800 | 2026-09-16 21:23 | `073cba72817214cd` |
| `rehearsal.png` | `/e/<event>/rehearsal` | Before doors (Rehearse) | 2560x1880 | 2026-09-16 21:23 | `e51ab674ff954a05` |
| `display-presenter.png` | `/presenter?token=…` | Call the show (Presenter, after) | 3840x2160 | 2026-09-16 21:23 | `031bc8e920185199` |
| `display-presenter-prev.png` | `/presenter?token=…` | Call the show (Presenter, before) | 3840x2160 | 2026-09-16 21:23 | `d4e175b1ade905ba` |
| `display-av.png` | `/av?token=…` | Call the show (AV, after) | 3840x2160 | 2026-09-16 21:23 | `78398ea4edf76ceb` |
| `display-av-prev.png` | `/av?token=…` | Call the show (AV, before) | 3840x2160 | 2026-09-16 21:23 | `b6f5a488ad991082` |
| `display-speaker-ready.png` | `/green-room?token=…` | Call the show (Green Room, after) | 3840x2160 | 2026-09-16 21:23 | `5798583d06489e04` |
| `display-speaker-ready-prev.png` | `/green-room?token=…` | Call the show (Green Room, before) | 3840x2160 | 2026-09-16 21:23 | `01f79c2a10095632` |
| `display-general.png` | `/general?token=…` | Call the show (General, after) | 3840x2160 | 2026-09-16 21:23 | `3090846d8a918d56` |
| `display-general-prev.png` | `/general?token=…` | Call the show (General, before) | 3840x2160 | 2026-09-16 21:23 | `848bf5c587171d46` |
| `broadcast.png` | `/e/<event>/broadcast` | When plans change | 2560x1880 | 2026-09-16 21:23 | `7a7c77d0adbfd66c` |
| `displays.png` | `/e/<event>/displays` | The room | 2880x2000 | 2026-09-16 21:23 | `bec3d25498e0400b` |

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

This is the open fidelity gate. The captures are genuine but are **not** proven to match the app as it stands today.

| File | Drift |
|---|---|
| `console.png` | Header trailing icon is the old padlock; the app now renders a LogOut icon (commit 856ff4a). CONFIRMED visible drift. |
| `console-prev.png` | Same padlock drift as console.png. CONFIRMED visible drift. |
| `cue-sheet.png` | Page changed since capture (post-import session choice UI, one link style). Visible impact on this view NOT established. |
| `rehearsal.png` | View changed since capture (status line, reset confirmation, overlay badge). Visible impact NOT established. |
| `display-presenter.png` | Display client changed since capture (role prop, LinkInvalid, LoadingState) — error/loading paths only; normal state unaffected, not re-verified. |
| `display-presenter-prev.png` | As above. |
| `display-av.png` | As above. |
| `display-av-prev.png` | As above. |
| `display-speaker-ready.png` | Captured from /green-room; the file name keeps the older 'speaker ready' wording. Labelled with the current canonical DISPLAY_TYPES name 'Green Room'. |
| `display-speaker-ready-prev.png` | As above. |
| `display-general.png` | As the other display clients. |
| `display-general-prev.png` | As above. |
| `broadcast.png` | Message placeholder text changed since capture. POSSIBLE visible drift, not re-verified. |
| `displays.png` | Shows the old 'Speaker Ready' type label; DISPLAY_TYPES now labels that type 'Green Room'. CONFIRMED visible drift. |

## Why they were not refreshed in this pass

Two independent blockers, both verified rather than assumed:

1. **The capture pipeline is not read-only.** `npm run capture:product` first runs `scripts/seed-marketing-demo.ts`, which writes rows to the hosted Supabase project (`NEXT_PUBLIC_SUPABASE_URL` is a remote `*.supabase.co` instance), and `scripts/capture-product.mjs` then PATCHes `display_registry` heartbeats and signs in to take control. Those are shared-resource mutations, which this assignment forbids.
2. **No authorised read-only session is available.** `capture-product.mjs` authenticates with `DEMO1_PASSWORD`, which is not present in `.env.local` (keys present: `AUTH_COOKIE_SECRET`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `OPERATOR_PIN`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_OIDC_TOKEN`). No local Supabase stack is running either (port 54321 closed; 54329 is an unrelated local Postgres).

A network-isolated local fixture is the remaining path. The display store already has one usable seam — `lib/display-engine/fake-transport.ts`, used by the production-excluded `/dev/realtime` harness, drives the real store with no Supabase and no network — but it is a store-level harness; mounting the four real display surfaces and the Operator Console against it is a build of its own and was not attempted here rather than being half-done.

**Exact remaining action:** either supply `DEMO1_PASSWORD` for a read-only capture run against the existing seeded event, or authorise a seed, or commission the fixture harness above. Until one of those happens, the published images stay genuine-but-older, and this file is the disclosure.

# Brand Guidelines

## Status: naming and meaning are final. Visual identity is still a placeholder, not a designed brand.

This document exists to record what's approved and what's still pending, so the gap doesn't get papered over with an improvised logo.

A wordmark now exists (`components/site/wordmark.tsx`) and is used across the marketing site and auth pages, but it is explicitly a stand-in — see that file's own header comment: `logo.svg` at the repo root is an unrelated "CF Monogram," the favicon is a different mark again, and a real mark, matching favicon, and OG image are still unbuilt.

## Name

**KramFlow**

From क्रम (*Krama*) — Sanskrit/Hindi for sequence, order, progression, flow, movement, continuity, execution. Combined with "Flow" to read as **order in motion**: the product's entire job is keeping a live program moving in the right order, visibly, for everyone running it.

## What's approved

- The name **KramFlow** — used consistently across the app (page titles, headers, the launcher), the README, and all `/docs`.
- The naming rationale above, as the reference point for any future visual identity work (a wordmark or icon should read as "orderly, moving forward," not decorative).

## What's pending

A placeholder wordmark exists; nothing designed has shipped for:

- A real logo mark (icon or lockup — the interim wordmark is type-only, see above)
- Color palette as a *brand* system (the app currently uses a functional dark-mode palette — see `DESIGN.md` — chosen for legibility, not brand expression)
- Typography as a *brand* choice (currently Inter, chosen for availability and legibility, not as a brand decision)
- A designed favicon / browser tab icon (`app/favicon.ico` exists but is not the brand mark — see `components/site/wordmark.tsx`'s header comment)
- Apple touch icon
- PWA manifest + icon set
- Splash screen
- OG image and other marketing-facing assets

**Do not treat the current dark background + white text + Inter as "the brand."** It's the interim functional design system. When real brand assets arrive, they replace this — see the touchpoint checklist below so nothing gets missed.

## Touchpoint checklist (for when assets exist)

Replace, in this order of visibility:

- [ ] Browser favicon (`app/favicon.ico`)
- [ ] Apple touch icon
- [ ] Web app manifest + PWA icon set
- [ ] The interim wordmark itself (`components/site/wordmark.tsx`), used in the marketing navbar/footer (`components/site/navbar.tsx`, `components/site/footer.tsx`) and the auth pages (`app/login/page.tsx`, `app/signup/page.tsx`)
- [ ] Marketing landing page (`app/page.tsx`)
- [ ] Loading/empty states (none currently carry a wordmark — add if the new identity calls for it)
- [ ] README banner
- [ ] This document, once assets exist — replace this whole file with real specs (logo files, clear space, minimum size, color values, misuse examples)

## Rules that apply regardless of what the final logo looks like

- Never distort, stretch, or crop it.
- Maintain whatever safe area / clear space the final asset's designer specifies.
- Use SVG wherever the placement supports it (crisp at any size, including the 1920×1080 TV displays).
- The logo is a supporting element, not competition for the hero typography on TV displays — those screens exist to answer "what's now / what's next" in under 3 seconds; the logo should never slow that down.

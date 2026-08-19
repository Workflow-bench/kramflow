# Visual Hierarchy & Layout Theory

Sourced from Nielsen Norman Group (NN/g) and *Refactoring UI* (Adam Wathan & Steve Schoger).

## Visual hierarchy — the core definition

**NN/g:** "Visual hierarchy [is] the organization of the design elements on the page so that the eye is guided to consume each design element in the order of intended importance." And: "The page's visual hierarchy controls the delivery of information from the system to the end user — it lets users know where to focus their attention."

This is the single most load-bearing idea in this whole skill. Every other principle here is a *technique for building* hierarchy, not hierarchy itself. Before touching any layout, the question is: **what is the intended order of importance, and can you state it as an ordered list before you design anything?** NN/g's own guidance: "define the hierarchy of the content and the key point(s) you want the user to take away" *first*, then apply visual variation, then test.

## The techniques for establishing hierarchy (NN/g)

1. **Color and contrast** — "It's not the actual color of an element that creates the hierarchy, but rather the contrast in value and saturation between the element and the context." A color only reads as "important" relative to a quieter surrounding; if everything is saturated, nothing is emphasized (this connects directly to the Von Restorff Effect in `laws-of-ux.md`).
2. **Scale** — "Bigger elements stand out more and attract users' attention." NN/g's own constraint: "use no more than 3 sizes — small, medium, and large." More than three size tiers stops reading as hierarchy and starts reading as noise.
3. **Grouping (proximity + whitespace)** — "Grouping is usually conveyed implicitly through proximity and the use of white space, or explicitly through enclosure." "An element that has more space around it will be perceived as one group and thus will receive more attention." Isolation itself is a hierarchy signal — the emptiest part of a screen draws the eye as surely as the boldest part does.

## Refactoring UI's operational rules

*Refactoring UI* (Wathan & Schoger) reframes the same ideas as concrete, immediately-actionable rules, which is why it's useful alongside NN/g's more academic framing:

- **"Great UI isn't about creativity or talent — it's about systems."** Constrained scales for spacing, type, color, and shadow produce consistently professional results — the opposite of picking a "nice-looking" value ad hoc per screen.
- **Constrained spacing scale**, not arbitrary pixel values: a fixed set like 4/8/16/24/32/48/64px, used everywhere, so every gap in the product reads as one of a small number of *meaningful* distances rather than an accidental one.
- **Design in grayscale first, add color last.** This is the single most directly applicable rule to Kramflow's history: it forces hierarchy to be built from spacing, size, and contrast *before* color is available as a shortcut. If a grayscale version of a screen is confusing about what matters most, adding color on top won't fix it — it'll just be decoration standing in for a hierarchy problem that was never solved. (This is precisely the diagnosis for why removing the purple accent did not, by itself, fix Kramflow's UX: the accent was never the thing carrying the hierarchy — or the app would have gotten *more* confusing without it, not stayed exactly as confusing.)
- **"Leave space for your design to breathe"** — whitespace is treated as a design *decision*, not leftover space. Cramming a "6 identical buttons in a row" pattern is the direct opposite of this: it's optimizing for fitting everything in, not for the reader's ability to parse it.
- **Systems for color, type, and spacing reduce decision fatigue** for the *designer*, and that discipline is what makes the *user's* experience feel consistent — an unconstrained system produces visible inconsistency almost by definition, because every screen becomes its own ad hoc decision.

## Scanning patterns (F-pattern / Z-pattern)

Users don't read a screen uniformly — eye-tracking research (originating from NN/g's own studies) shows two dominant scan shapes:

- **F-pattern**: dense, text-heavy content (lists, tables, dashboards). The eye scans full-width along the top, a shorter full-width scan further down, then a vertical scan down the left edge, reading less and less of each line as it goes. This is why the **leftmost column and the topmost rows carry disproportionate weight** on a dense screen — it's not convention, it's where the eye actually goes first and most.
- **Z-pattern**: sparse, low-text content (landing pages, single-focus screens). The eye goes top-left → top-right → diagonally to bottom-left → bottom-right. This is closer to how Kramflow's *Stage* displays should be read (a handful of large elements, not a dense list) — top-left for context (session name), the dominant middle/large element for content, bottom for secondary info.

**Kramflow application:** Console (operator) surfaces are F-pattern territory — dense, list-heavy, scanned repeatedly. Stage (TV) surfaces are Z-pattern territory — sparse, glanced at once. Applying F-pattern assumptions (dense left rail, scannable rows) to a Stage screen, or Z-pattern assumptions (few big elements) to a dense operator console, is a mismatch worth explicitly checking for on every screen.

## Typographic scale and rhythm

A type scale is the same idea as a spacing scale applied to text: a small, fixed set of sizes (not a continuous range) so that any given text element's size alone tells you its rank in the hierarchy, without needing color or weight to disambiguate. Kramflow's existing two-scale system (Console: 10–22px range for instrument-density text; Stage: 17–92px range for glanceable-at-distance text) is the right *shape* of solution — the thing to keep checking is whether every text element on a given screen actually maps to one of the defined steps, or whether one-off sizes have crept back in (the same failure mode as stray hex colors, just in type).

## Alignment and grid

Alignment is a hierarchy signal by omission: misaligned elements draw attention to their misalignment rather than to their content, which is almost never the intent. A grid's job is to make every *intentional* alignment obvious and every *unintentional* misalignment visible as an error. This is less about picking a specific grid system (12-column, etc.) and more about consistency: once a screen establishes an edge (e.g., all card left-edges align to one x-position), every element on that screen should either sit on that edge or be deliberately offset from it for a reason that can be named.

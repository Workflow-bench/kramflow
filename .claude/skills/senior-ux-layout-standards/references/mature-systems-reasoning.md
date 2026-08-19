# How Mature Design Systems Reason About Their Own Rules

Material Design and Apple's Human Interface Guidelines are two of the most rigorously documented systems in the industry. The point of studying them is **not** to copy their tokens (Kramflow is not a Material app or an Apple app) — it's to see how a mature system *justifies* a rule, so Kramflow's own rules can be justified with the same rigor instead of asserted by taste.

## Material Design

**On why a systematic spacing/grid approach exists at all** (Material Design 1, "Layout Principles," still the clearest first-party statement of the underlying reasoning): "Material design is guided by print-based design elements — such as typography, grids, space, scale, color, and imagery — to create hierarchy, meaning, and focus that immerse the user in the experience."

Two things worth extracting from that sentence specifically:

1. **The lineage is explicit: print design, not "app design."** Grid theory, typographic scale, and margin/whitespace conventions predate digital interfaces by centuries — Material Design deliberately borrows a mature discipline rather than inventing UI-specific rules from scratch. This is a reusable move: when in doubt about a spacing or grid question for Kramflow, print/editorial design conventions (column grids, baseline rhythm, consistent margins) are a legitimate, tested source to reason from.
2. **The stated goal is "hierarchy, meaning, and focus"** — not "consistency" as an end in itself. Consistency is the *mechanism*, not the *goal*. A system that's perfectly consistent but doesn't produce clear hierarchy has optimized the wrong variable — exactly the gap this skill exists to catch.

**On why spacing consistency matters practically**, Material's own documentation frames it as: consistent, predictable padding is aesthetically pleasing, clarifies the relationship between elements, and improves readability — and layout grids more broadly "define structure, hierarchy, and rhythm," reducing decision-making and establishing "a rational approach to type scales, positioning, sizing and spacing." Again: the stated payoff is relationship-clarity and reduced decisions, not just visual tidiness.

**On adaptive layout**, Material's reasoning for breakpoints is functional, not aesthetic: a breakpoint exists at "the window size at which a layout needs to change to match available space, device conventions, and ergonomics" — three named reasons (space, platform convention, physical ergonomics), not "it looked cramped." This is the same standard Kramflow's Console/Stage split should be held to — a breakpoint or scale change should be traceable to one of those three reasons, not vibes.

## Apple Human Interface Guidelines

Apple's three foundational principles, consistently stated across HIG documentation:

- **Clarity** — "Interfaces should be legible, precise, and easy to understand... text is readable at any size, icons are precise and lucid, and adornments are kept to a minimum." Clarity is explicitly about *removing* ambiguity and unnecessary decoration, not adding polish.
- **Deference** — "The UI helps users focus on their content and tasks by minimizing unnecessary visual clutter... [it] keeps the interface in the background, so the user's [content] stays front and center." The chrome exists to serve the content, and should recede when it isn't needed.
- **Depth** — "Visual layers and realistic motion convey hierarchy and facilitate understanding... [they] help people understand what matters, without extra decoration getting in the way." Depth (layering, elevation, motion) is justified specifically as a *hierarchy-communication tool*, not a visual-interest tool — the same standard as Material's elevation system.

**Kramflow application of all of the above:** Both systems, independently, converge on the same underlying claim — every visual device (spacing, color, elevation, motion, scale) earns its place by *communicating hierarchy or relationship*, and is unjustified the moment it's there for its own sake. That's the test to apply to any Kramflow layout decision: does this visual choice make the intended order-of-importance clearer, or is it there because it looked incomplete without it? The second answer is the tell for an arbitrary decision (see `evaluation-criteria.md`).

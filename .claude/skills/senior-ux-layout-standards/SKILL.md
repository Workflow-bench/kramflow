---
name: senior-ux-layout-standards
description: Evaluate or guide any UI/UX/layout/visual-hierarchy decision on Kramflow (or a similar dense, real-time operator tool) against real, sourced design principles instead of taste or intuition. Use this whenever redesigning a screen, reviewing whether a layout choice is well-founded, arguing for or against a spacing/grouping/hierarchy decision, deciding where a control should live, judging whether something looks "inconsistent" or "random," or reverse-engineering why a reference product (e.g. StageTimer.io) made a specific design choice. Push to use this proactively any time a UI change is proposed for an operator-facing, data-dense, or real-time-status screen — not just when the user explicitly asks for a "design review."
---

# Senior UX & Layout Standards

## Why this skill exists

A prior design pass on Kramflow fixed *token-level* consistency (one color palette, one radius scale, one Button component) and reported the UI as "unified" — but the underlying UX problems were still there: no clear visual hierarchy, controls grouped by coincidence rather than function, primary actions no more prominent than secondary ones, state text and available actions disagreeing with each other. Token consistency and UX soundness are different axes. A screen can pass every "no stray colors, no stray radii" check and still be badly designed. **This skill is the second axis** — it's what to reach for when the question is "is this layout actually *good*," not "does this button match the others."

Every judgment this skill makes should be traceable to a specific, named principle from the reference files below. If you can't name which principle a decision serves, that's the signal the decision is arbitrary — flag it rather than defend it.

## How to use this skill

1. **Load the relevant reference file(s) below** rather than relying on memory — they contain the actual sourced definitions and quotes, not paraphrases, and citing the real thing is more convincing and more correct than reciting a rule from memory.
2. **For any layout/hierarchy question**, start from `references/layout-hierarchy-theory.md` — it's the most load-bearing file for "what should the eye see first, and why."
3. **For any "why does this control feel randomly placed" question**, check `references/laws-of-ux.md` for the specific law that governs proximity, grouping, or choice count.
4. **When redesigning something StageTimer.io also does**, read `references/stagetimer-reasoning.md` first — it documents *why* StageTimer's choices work, reverse-engineered from the live product plus StageTimer's own documentation, not just what they look like. Match the reasoning to Kramflow's actual situation rather than copying the pixels.
5. **When you want a second opinion on a spacing/elevation/motion rule**, check `references/mature-systems-reasoning.md` for how Material Design and Apple HIG justify their own rules — useful for calibration, not for verbatim copying (Kramflow is not a Material or Apple app).
6. **Before shipping any UI decision**, run it through `references/evaluation-criteria.md`'s well-founded-vs-arbitrary checklist.

## The core reframe: token consistency ≠ UX soundness

These are genuinely separate failure modes, and fixing one does not fix the other:

| Token consistency (the last pass) | UX soundness (this skill) |
|---|---|
| One Button component, no duplicates | Is this the *right* action to make prominent here? |
| One color palette, no stray hex | Does color communicate anything, or is it decoration? |
| One radius scale | Does the *grouping* of controls reflect how they're actually used together? |
| Consistent spacing tokens | Is there enough visual difference between primary and secondary actions? |
| No literal duplicate components | Do 8 nav items in a row actually need to be one undifferentiated row? |

A screen can be 100% consistent on the left column and still fail every principle in the right column. When asked to "fix the UI," check both — but don't mistake fixing the left column for having fixed the right one.

## Kramflow's specific operating context (read before applying anything)

Every principle in this skill needs to be applied through this lens, not a marketing-site lens:

- **The primary user is an operator under time pressure**, often mid-show, sometimes on a phone one-handed backstage. Fitts's Law and Hick's Law matter *more* here than on a leisurely-browsed page — a slow or ambiguous choice during a live cue has real consequences.
- **The screen is read at a glance, not studied.** Von Restorff / color-as-signal only works if color is rare. State (live / next / standby / hold) has to be legible in under a second, from an arm's length or across a room, sometimes under stage lighting.
- **Two genuinely different viewing distances exist in the same product**: Console surfaces (operator's laptop, 18–24in, dense, cursor-driven) and Stage surfaces (TV/confidence-monitor, 5–15ft, sparse, glanceable). A rule that's correct for one is often wrong for the other — don't apply a single hierarchy solution to both without checking which surface you're on.
- **State must never lie.** If the copy says "not started" and the controls say "Finish Session," that's not a cosmetic bug — for an operator mid-show, a UI that contradicts itself about the current state is actively dangerous. Coherence-of-state is a correctness requirement for this product category, not a nice-to-have.
- **A live/on-air indicator and a merely-selected/focused indicator are two different things and should look different.** Reserve the strongest visual treatment (full saturated fill) for "this is happening right now, for real, on a live display" — a lighter treatment (thin line, underline, ring) is enough for "this is what I'm currently looking at in the UI."

## Reference files

- `references/laws-of-ux.md` — Fitts's, Hick's, Jakob's, Miller's Laws, the Gestalt principles, Von Restorff Effect, Law of Prägnanz. Sourced from lawsofux.com (Jon Yablonski). Each entry has the real definition, origin, and application guidance, plus a Kramflow-specific application note.
- `references/layout-hierarchy-theory.md` — Visual hierarchy, grid systems, alignment, whitespace, scanning patterns, typographic scale, contrast-as-hierarchy. Sourced from NN/g and Refactoring UI (Wathan & Schoger).
- `references/mature-systems-reasoning.md` — How Material Design and Apple HIG explain their *own* spacing/elevation/clarity rules, as a calibration reference for mature, rigorously documented systems.
- `references/stagetimer-reasoning.md` — Reverse-engineered reasoning for StageTimer.io's specific layout and control choices (verified hands-on plus StageTimer's own docs/founder interviews), including an honest note on what's *not* available (no third-party design case study exists for StageTimer — don't cite one that doesn't exist).
- `references/evaluation-criteria.md` — The well-founded-vs-arbitrary checklist and a worked example of applying it to a real Kramflow screen.

## A hard rule for using this skill honestly

Never claim a UI decision is "backed by UX principles" without being able to name the specific principle and explain the mechanism (not just the label). "This uses Fitts's Law" is not an explanation; "this button is large and close to the cursor's likely position because it's the highest-frequency action on this screen, and Fitts's Law says acquisition time drops with target size and inverse distance" is. If you can't produce that second sentence, don't cite the law — just say the decision is a judgment call and flag it as such.

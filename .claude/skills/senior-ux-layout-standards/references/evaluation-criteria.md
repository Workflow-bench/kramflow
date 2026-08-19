# Evaluating Whether a UI Decision Is Well-Founded or Arbitrary

## The checklist

For any layout, grouping, sizing, color, or interaction-pattern decision, ask these in order. Stop as soon as one fails — that's the actual verdict.

1. **Can you name the specific principle this decision serves** (a named law from `laws-of-ux.md`, a hierarchy technique from `layout-hierarchy-theory.md`, or a reasoning pattern from `stagetimer-reasoning.md` / `mature-systems-reasoning.md`)? Not "good UX" in general — the specific mechanism.
2. **Can you state the failure mode this decision avoids**, concretely, for Kramflow's actual users (an operator under time pressure, or an audience glancing at a Stage display)? "It would look inconsistent" is not a failure mode. "The operator would have to re-read the label every time because the icon alone doesn't disambiguate it from three other identical buttons" is.
3. **Does the visual weight match the actual frequency/consequence of the action?** A destructive, rare action should never be easier to trigger than a routine, frequent one. A routine, frequent action should never require more precision or more steps than a rare one.
4. **If you removed this decision, would something break** (comprehension, speed, correctness of state communicated) — or would the screen just look slightly different? If nothing breaks, the decision might still be fine, but it should be labeled a preference, not a requirement, and shouldn't be defended as if a principle demands it.
5. **Is the same visual treatment used for the same meaning everywhere else in the product?** A decision can be individually well-reasoned and still be wrong if it's inconsistent with how the same *meaning* (not the same *component*) is expressed on other screens — e.g., if "this is happening right now" is a full color fill on one screen and a thin border on another, that's a hierarchy-of-hierarchy violation even if neither screen is wrong in isolation.

If a decision passes 1–3 with real, specific answers, it's well-founded — document the reasoning next to the decision (in code comments or the design doc) so it doesn't get silently "fixed" back to something arbitrary later. If it can't produce specific answers, say so plainly: "this is a judgment call, not backed by a specific principle" is a legitimate and honest thing to write down — it's the silent conflation of the two that causes problems.

## Worked example 1 — the Operator Console's top navigation row (a real, observed Kramflow issue)

**The decision as it currently stands:** eight pill-shaped buttons in a row (Cue Sheet, Green Room, AV, General, Presenter, Remote, Broadcast, Displays) at equal size, equal color, equal spacing, wrapping to a second row at narrower widths.

**Checklist:**
1. *Principle served?* None that can be named — the row isn't grouped by frequency (some of these are used constantly during a show, others almost never), isn't grouped by function (four are "preview a display type," two are "navigate to another operator tool," two are "system-level utility"), and Hick's Law is actively working against the operator here: 8 undifferentiated choices measurably slow down finding the right one, especially mid-show.
2. *Failure mode avoided by the current design?* None — if anything, the current layout actively enables the failure mode Hick's Law predicts (slower selection under an unnecessarily large, flat choice set).
3. *Visual weight vs. frequency/consequence?* Fails — "Cue Sheet" (used constantly while building a show) and "Displays" (used rarely, for device management) get identical visual weight.
4. *Would removing it break something?* No — regrouping these eight items by function (e.g., "operator tools" cluster vs. "preview a display" cluster, in `common-region`-style visually distinct groups per Gestalt) would only improve findability, nothing currently depends on the flat row.
5. *Consistent with the rest of the product?* The Display Manager screen has the same failure mode independently (six identical-weight action buttons per device row: Preview/Screenshot/Force Fullscreen/Test Message/Reload/Remove) — meaning this isn't a one-off, it's a pattern that recurs whenever a set of actions is added without deciding which one (if any) is primary.

**Verdict:** Arbitrary. This is exactly the kind of "still broken even after a token-consistency pass" issue this skill exists to catch — every button here can be visually consistent (same radius, same color system, same Button component) while the *grouping and hierarchy* remains unfounded.

## Worked example 2 — a state-coherence bug (a real, observed Kramflow issue)

**The decision as it currently stands:** on the Operator Console and Remote, after a live item was deleted mid-session, the main panel displayed "Press Start to begin the program" (implying the session hasn't started) while the Controls panel simultaneously offered Next / Finish Session / Hold (which only make sense for an *already-started* session) — and Remote's own version showed a completely empty "NOW" label with no fallback text at all.

**Checklist:**
1. *Principle served by the current behavior?* None — this isn't a hierarchy or grouping question, it's more basic: the screen's own two areas (status message, available actions) are asserting contradictory facts about the same state simultaneously.
2. *Failure mode?* For an operator mid-show, being told two different things about whether the show has started is not a cosmetic issue — it's a correctness issue. This directly violates the "state must never lie" requirement noted in the main SKILL.md for this product category.
3. *Not really applicable here* — this isn't a visual-weight question, it's a state-derivation bug (the UI is deriving "is there a live item" and "is the session in progress" from two different signals that disagreed after an edge-case deletion).

**Verdict:** Not a design-taste question at all — a functional bug that happens to *look like* a copy/UX problem. Worth flagging as such rather than trying to "fix" it by rewording the fallback message; the actual fix is making both areas of the screen derive their state from the same source of truth.

## The meta-lesson from both examples

Neither of these was caught by the prior token-consistency pass, and neither would be caught by *any* amount of further token-consistency work — no amount of unifying colors or radii fixes a grouping-by-coincidence nav row or a state-derivation bug. That's the entire reason this skill treats "is it consistent" and "is it well-designed" as genuinely separate questions requiring separate checks.

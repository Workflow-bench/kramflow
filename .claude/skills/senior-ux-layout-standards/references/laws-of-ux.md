# Laws of UX

Source: [lawsofux.com](https://lawsofux.com) (Jon Yablonski) — a widely-cited, credible synthesis of psychology research applied to interface design, also published as a physical book ("Laws of UX," O'Reilly). Definitions and application guidance below are drawn directly from that source; the "Kramflow application" note under each is this project's own extension, not lawsofux.com's.

## Fitts's Law

**Definition (lawsofux.com):** "The time to acquire a target is a function of the distance to and size of the target."

**Origin:** Psychologist Paul Fitts, 1954. Movement time to a target depends inversely on the target's size relative to distance — the speed-accuracy trade-off means smaller targets and faster movements increase error rates.

**Application guidance (lawsofux.com):**
- "Touch targets should be large enough for users to accurately select them."
- "Touch targets should have ample spacing between them."
- "Touch targets should be placed in areas of an interface that allow them to be easily acquired."

**Kramflow application:** This is the direct justification for the existing Console (18–24in, cursor) vs. Stage (5–15ft or one-handed phone, touch) size split — it's not a stylistic choice, it's Fitts's Law applied to two different physical interaction contexts. The highest-frequency, highest-consequence action on any given screen (Start/Next/Hold on the Operator Console, the transport row on Remote) should be the largest, closest-to-thumb, most isolated target on that screen — not just visually distinct, but literally faster to hit. Conversely: don't make a rarely-used, high-consequence action (Delete Event) large and easy to hit — for destructive actions, Fitts's Law should be worked *against* on purpose (smaller target, more distance, more friction), which is exactly what a guardrail-tier system is for.

## Hick's Law

**Definition (lawsofux.com):** "The time it takes to make a decision increases with the number and complexity of choices."

**Origin:** William Edmund Hick and Ray Hyman, 1952 — reaction time increases with the number of stimuli/options presented.

**Application guidance (lawsofux.com):**
1. Minimize choices during critical moments to reduce decision time.
2. Segment complex tasks into manageable steps to lower cognitive burden.
3. Guide users toward recommended options to prevent decision paralysis.
4. Use staged onboarding that gradually introduces features.
5. Maintain necessary complexity without over-simplifying to obscurity.

**Kramflow application:** This is the direct, named explanation for why "8 equal-weight nav pills in a row" or "6 identical-looking action buttons per row in Display Manager" is a real UX defect, not just a visual-consistency nitpick — every additional undifferentiated choice measurably slows the operator down, and this is exactly the moment (mid-show, time pressure) where that cost is least affordable. The fix implied by Hick's Law is not necessarily "remove features" — it's differentiate by frequency: the 1–2 things done constantly should be visually and positionally distinct from the 4–5 things done rarely, so the *decision* is pre-made by the layout rather than left to the operator to resolve on every glance.

## Jakob's Law

**Definition (lawsofux.com):** "Users spend most of their time on other sites/products. This means that users prefer your site to work the same way as all the other sites they already know."

**Origin:** Jakob Nielsen, co-founder of Nielsen Norman Group.

**Application guidance (lawsofux.com):**
- "Users will transfer expectations they have built around one familiar product to another that appears similar."
- "By leveraging existing mental models, we can create superior user experiences in which users can focus on their tasks rather than on learning new models."
- When making changes, minimize discord by letting users continue with a familiar version for a limited time.

**Kramflow application:** Jakob's Law applies at two levels for Kramflow, and they can conflict:
1. **General software conventions** — a play/pause/skip icon set, a gear = settings, a trash = delete. Don't reinvent these.
2. **Industry-specific conventions** — Kramflow's users are AV/event-production professionals who already have mental models from *other tools in their specific industry* (video editing timelines, run-of-show "rundown" terminology, broadcast console layouts). StageTimer's own blog explicitly frames its timer list as a "rundown" — borrowing vocabulary its target users already have from professional tooling, not inventing new terms. Kramflow should do the same: match the *industry's* existing mental model (a stage manager's paper/Excel run-of-show, a broadcast operator's rundown), not just generic consumer-app conventions.

## Miller's Law

**Definition (lawsofux.com):** "The average person can only keep 7 (plus or minus 2) items in their working memory."

**Origin:** George Miller, 1956 ("The Magical Number Seven, Plus or Minus Two").

**Application guidance (lawsofux.com):**
1. Don't use "the magical number seven" to justify unnecessary design limitations.
2. Organize content into smaller chunks to help users process, understand, and memorize easily.
3. Short-term memory capacity varies per individual, based on prior knowledge and situational context.

**Kramflow application:** The real, correctly-scoped lesson here is **chunking**, not a literal item-count limit. A 40-row cue sheet is fine — because the operator isn't holding 40 rows in working memory, they're scanning a structured list with clear groupings (sections/partitions). What *would* violate Miller's Law is an unchunked wall of 8 equal-weight nav items, or a settings panel with 15 flat fields and no section headers — anywhere the operator has to hold multiple ungrouped things in their head simultaneously rather than letting the layout do the chunking for them.

## Gestalt Principles

All sourced from lawsofux.com, rooted in early-20th-century Gestalt psychology (the mind perceives organized wholes/patterns, not disconnected parts).

### Law of Proximity
**Definition:** "Objects that are near, or proximate to each other, tend to be grouped together."
**Guidance:** Close elements appear to share functionality or characteristics; this grouping enables faster information processing. lawsofux.com's own example: spacing between search results groups each into "a related cluster of information," improving scannability.
**Kramflow application:** This is the literal mechanism behind "why does this look random" — if two controls that do unrelated things sit at the same distance apart as two controls that work together, the operator's eye can't tell which is which without reading labels. Proximity should encode function, every time, not just be whatever gap the grid produced.

### Law of Similarity
**Definition:** Elements that share visual characteristics (color, shape, size) are perceived as more related than elements that don't.
**Kramflow application:** All primary actions across the app should share one visual treatment (not "the button that happens to be biggest on this particular screen") so an operator's learned pattern ("the light/filled button is the main one") transfers between the Cue Sheet, the Operator Console, and Remote without re-learning.

### Law of Common Region
**Definition:** Elements sharing an enclosed area (a border, a background panel) are perceived as belonging to the same group, even more strongly than proximity alone.
**Kramflow application:** This is the justification for StageTimer's top-of-column button clusters (Blackout/Flash/... sit inside the Timers column's header band, not scattered) — a shared visual container (background panel, header row, card) is a stronger grouping signal than spacing alone, and should be used deliberately for "these N controls are one functional unit," not applied uniformly to everything (over-boxing everything cancels the signal).

### Law of Prägnanz
**Definition:** Ambiguous or complex forms are perceived and interpreted in their simplest possible form, because that requires the least cognitive effort.
**Kramflow application:** When a screen's structure is genuinely simple (one primary object, a few secondary ones), don't dress it up with extra visual complexity (extra borders, extra colors, extra containers) — let it read as the simple thing it is. Complexity should only be visually signaled when the underlying structure is actually complex.

### Figure-Ground
**Definition:** The eye separates a scene into a foreground "figure" (the object of attention) and a background "ground" (context). Good design makes this separation obvious; ambiguous figure-ground forces the viewer to work to determine what's foreground.
**Kramflow application:** On the audience-facing Stage displays especially, the "figure" (current item title, countdown) needs unambiguous separation from the "ground" (chrome, secondary info) — this is part of why StageTimer's countdown digits are enormous and isolated on a near-black ground, not competing with same-weight secondary text nearby.

## Von Restorff Effect

**Definition (lawsofux.com):** "When multiple similar objects are present, the one that differs from the rest is most likely to be remembered."

**Origin:** Hedwig von Restorff, 1933.

**Application guidance (lawsofux.com):**
1. Distinguish important information through visual differentiation.
2. Apply emphasis *sparingly* — overusing it makes salient items compete, or look like ads.
3. Don't rely solely on color contrast — must remain accessible for color vision deficiency.
4. Consider motion-sensitive users when using motion for contrast.

**Kramflow application:** This is the exact, named reason the old purple accent was wrong even before it clashed with any other color: if *many different UI roles* (focus rings, selected rows, decorative icons, one badge tone) all used the same accent hue, none of them stood out as specifically meaningful — Von Restorff only works when the differentiated thing is genuinely rare. The fix isn't "pick a different single accent color to spread everywhere" (same mistake, new color) — it's reserving strong visual difference for the few things that are actually urgent/live/critical, and using restraint everywhere else. This is also why StageTimer keeps almost the entire UI in grayscale and uses blue/green/red for exactly three specific, consistent meanings (selected, safe-time, danger-time) rather than for general decoration.

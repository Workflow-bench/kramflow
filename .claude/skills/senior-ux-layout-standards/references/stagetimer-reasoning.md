# StageTimer.io — Reverse-Engineered Design Reasoning

This is not a catalog of what StageTimer looks like — it's an attempt to explain *why*, verified hands-on against the live product (stagetimer.io, free Controller room) plus StageTimer's own documentation and founder interviews, cross-checked against the laws in `laws-of-ux.md` and the theory in `layout-hierarchy-theory.md`.

## An honest note on sourcing (per this skill's own standard)

No third-party UX case study, design teardown, or design-publication review of StageTimer.io could be found — this was checked directly (searches for case studies, Product Hunt commentary, design-blog breakdowns) and came up empty beyond generic "here's a list of case study repositories" results that don't mention StageTimer at all. What *does* exist and is genuinely usable:
- StageTimer's own documentation (stagetimer.io/docs/) — first-party, describes intent directly.
- StageTimer's own blog post on building the product (stagetimer.io/blog/building-stagetimerio/) — mostly business narrative, but contains one directly relevant design-intent quote (below).
- Founder interviews (business/growth-focused publications: Starter Story, IndiePattern, BoringCashCow, Indie Hackers) — mostly about revenue and growth, but the origin story is genuinely relevant to a specific design decision (below).
Don't cite a "StageTimer design case study" as if one exists — it doesn't. Cite these first-party sources specifically, or cite the hands-on observation as hands-on observation.

## The origin story explains the core architecture

Founder Lukas Hermann's own account: the product exists because he watched a friend have to **physically walk to another room** just to start a clunky, old timer program. That single pain point — *the person controlling the timer and the display showing it must be different devices, possibly in different rooms* — is not an incidental feature of StageTimer, it's the entire reason the product exists. This directly explains the fundamental split between the **Controller** (what the operator touches) and every **Output** (Viewer/Agenda/Moderator/etc. — what a display shows), including why "generate a link, open it on a separate device" is the core interaction, not an advanced feature bolted on later.

**Kramflow parallel:** Kramflow's own Controller/Output split (Operator Console vs. General/AV/Green Room/Presenter displays via share link) is solving the *identical* structural problem, for the identical reason (operator and displays are different people/devices/rooms). This isn't a coincidence to note and move past — it's confirmation that the split is correctly load-bearing, and any redesign work should preserve and clarify it, not flatten Controller and Output concerns into one interface for the sake of a simpler mental model.

## The Controller's three-column layout, and why each column is where it is

Verified hands-on (Controller room, desktop width) plus StageTimer's own Controller documentation.

**Left column — timer preview + transport + connections.** StageTimer's own docs: the preview section "shows what the talent sees on their screen"; the transport controls are "the central place to control the timer and rundown," with timeline functionality "similar to video editing software" (an explicit, named borrowing of an adjacent professional tool's mental model — Jakob's Law applied deliberately, not accidentally). The docs state directly that "the preview, transport controls, and live connections cluster together for immediate feedback during live events" — i.e., the grouping is stated intent, not an artifact of how the page happened to get built. This is Law of Proximity used on purpose: these three things are spatially adjacent because they're used together, in the same glance, during the same moment.

**Middle column — the Timers list.** StageTimer's own docs call this "the primary element of the controller page and the heart of Stagetimer." This is an important correction to a naive "biggest element = most important" reading: the huge countdown display on the left is a *monitoring/preview surface* (literally: what the talent sees), while the actual primary, most-interacted-with content is the list in the middle — smaller on the page, but functionally central. **Lesson: visual size and functional primacy are not the same axis, and conflating them is a mistake worth explicitly guarding against.** The blog's own phrase for this list — "a rundown that will make the life of producers even easier" — uses the industry's own term (see Jakob's Law, industry-specific mental models) rather than a generic label like "timer list" or "queue."

**Right column — Messages.** Spatially furthest from the primary transport controls, and requiring more steps to use (a compose form, not a single click) — consistent with Hick's/Fitts's reasoning: lower-frequency, lower-urgency actions are placed further away and behind more friction than the highest-frequency action (play/pause/skip), rather than being equally reachable.

**Bottom bar — a full-width, always-visible progress/scrub timeline**, sitting outside all three columns. This is StageTimer's "Room Progress Bar," described in their own docs as showing "total progress of the current event in real-time." Placed at the extreme edge, low-contrast until interacted with — ambient/peripheral information, always available but never competing for primary attention. This matches how flight-deck and broadcast-console interfaces conventionally place secondary telemetry: at the edges, not the center.

## The "current/live" state vs. "selected/focused" state use deliberately different visual intensities

Verified hands-on, cross-checked against Von Restorff Effect:

- **A timer that is live/on-air**: the *entire row* is filled with a saturated blue background — maximum contrast, glanceable from any angle, unambiguous even out of the corner of your eye. This treatment is reserved for exactly one state: this is what's actually happening right now.
- **A tab/output-type that is merely selected** (e.g. which output-link tab you're currently viewing in the Output Links modal): a thin colored underline beneath the thumbnail — present, but far lower visual weight than a full fill.

This is not an inconsistency — it's a *hierarchy of hierarchy*. Reserving the strongest available visual treatment for the state with real, live-show consequences (something is on air right now) and using a lighter treatment for a state with no real consequence (which tab am I looking at) is exactly the Von Restorff principle applied correctly: emphasis that's used sparingly, and reserved for what actually matters most, stays meaningful.

## Inline expansion vs. full modal — chosen by depth of the task, not arbitrarily

Two genuinely different interaction patterns exist side by side, and the choice between them is consistent and explicable:

- **Editing a single timer's settings** (clicking the gear icon on a timer row) expands **inline**, directly below the still-visible, still-live timer row — the operator never loses sight of the fact that the show is still running while they make a quick edit. A full-screen modal here would hide the live state during the edit, which is the wrong trade-off for a live-operations tool.
- **Managing Output Links** (a heavier, multi-step configuration task — choosing an output type, setting logo/password/mirroring options, getting a shareable URL) opens as a **genuine modal** with a blurred backdrop — because this is a distinct, bounded task the operator is stepping out of "running the show" to do, not a quick tweak to something already in view.

**The generalizable rule:** the depth/weight of the interaction should determine inline-expand vs. modal, not personal preference or "what's easier to build." A quick edit to something already on screen → inline, preserve context. A multi-field configuration task that's conceptually a different mode → modal, and it's fine to obscure the rest of the screen because the operator has explicitly stepped away from "operate the show" for a moment.

## Preview-adjacent-to-controls, in the Output Links modal specifically

The Output Links modal places a **live-updating visual preview of the actual output** (exactly what a Viewer link will show) directly next to the controls that configure it (logo, password, mirroring, hide-controls). Changing a setting is reflected in the adjacent preview immediately — the operator never has to imagine what a setting will produce or open the link separately to check. This is a specific, reusable pattern: **whenever a UI's job is to configure the appearance or output of something, put a live preview next to the controls that affect it** — don't separate configuration from its visible result.

## Restraint as the load-bearing color strategy

Handled in more depth in `laws-of-ux.md`'s Von Restorff entry, but worth restating as a StageTimer-specific observation: outside of the countdown progress bar's green→amber→red zones and the single blue selection/live-fill hue, the entire interface is grayscale — near-black chrome, white/gray text and icons, no decorative color anywhere. Every colored pixel in the product means something specific and consistent (blue = selected/live, green = on-time, amber = approaching, red = over). None of it is decoration. This is the mechanism, not just the aesthetic, and it's the direct model for why Kramflow's own accent-color removal needed to land on "neutral, no fifth hue" rather than "a different single accent color spread the same way the purple was" — the number of *meanings* a color system carries should be small and fixed, not the number of *hues*.

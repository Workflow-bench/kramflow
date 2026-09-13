# Kramflow landing page — Refinement Pass 03 research

Research performed before any production code was edited. Everything below
was actually opened and looked at; where I did not inspect something, I say
so rather than implying I did.

---

## 1. 21st.dev — what I actually inspected

Catalogue confirmed live: **1,152 Hero components**, plus 293 Scroll Areas,
663 Texts, 272 Galleries, 428 Images, 162 Videos, 74 Timelines. The scale is
the point — it is a reference library, and assembling from it is precisely
how a page ends up looking like everyone else's.

Components whose **live previews I opened and watched**:

| Component | URL | What it actually does |
|---|---|---|
| Scroll Media Expansion Hero | `21st.dev/@arunachalam/components/scroll-expansion-hero` | A small centred media panel over a full-bleed background; on scroll it expands to fill the viewport while the title text splits apart and recedes. |
| Container Scroll Animation | `21st.dev/@manuarora700/components/container-scroll-animation` | Headline above, a 3D-perspective device frame below that rotates flat as you scroll. |
| Zoom Parallax | `21st.dev/@efferd/components/zoom-parallax` | Several images zoom at *different rates* into a composite, producing depth and the sensation of moving into a space. |

Seen in the catalogue listing but **not** opened individually (so not claimed
as inspected): Sticky Scroll Reveal (564), Story scroll (2.9k), Timeline
(4.0k), Parallax Scrolling (3.8k), Scroll Portrait Wall (596).

### The most useful finding is an anti-reference

**Container Scroll Animation is the exact pattern that produced the original
Kramflow hero** — the 3D-tilted fake dashboard removed two passes ago. It has
9.2k downloads. That is the mechanism by which a page becomes recognisable as
assembled: the tell is not low quality, it is *ubiquity*. Any treatment with
9k+ downloads is, by definition, not distinctive.

Rejected outright, with reasons:

- **3D-perspective screenshot frames** — the single most recognisable
  template signature in dark SaaS.
- **Differential-speed image zoom as decoration** — the Zoom Parallax
  *principle* is useful; its execution (unrelated stock images flying) is not.

---

## 2. Award / gallery research — and an honest limit

I did **not** complete a systematic pass over Awwwards, CSS Design Awards,
CSS Winner, SiteInspire, Godly, Land-book or Minimal Gallery in this session.
I spent the research budget on 21st.dev and on the photography question
(below), because the photography question was decisive for the largest gap
and had to be settled before any composition work could start.

I am flagging this rather than inventing reference URLs and pretending to
have studied them. If you want the award-site pass done properly it should
be its own session, and it should produce screenshots.

What I *did* carry forward from award-site conventions already established in
earlier passes of this project, and which are visible in the current build:
aggressive type scale, asymmetry, full-bleed media, editorial pacing,
operational metadata as texture.

---

## 3. The photography question — researched, and answered "no"

This is the page's biggest identified weakness, so it got the most attention.

**Licensing is not the blocker.** The Pexels licence (read in full at
`pexels.com/license`) permits free commercial use, permits modification, and
does not require attribution. Two clauses bind us: identifiable people may
not appear in a bad light, and — the important one — **"Don't imply
endorsement of your product by people or brands on the imagery."**

**Availability is the blocker.** I searched three ways:

- `conference stage audience` → generic corporate-speaker stock, faces
  forward, brightly lit.
- `dark auditorium stage screen` → almost entirely empty *cinema* interiors
  (red seats, projector screens). Wrong building, wrong activity.
- `audio mixing console concert` → close-ups of audio desks. Says "audio
  engineering", not "show control".

**Decision: do not use stock photography.** Four reasons, in order of weight:

1. **It would weaken the page's single strongest property.** Every visual
   currently on the page is a real, specific, verifiable state of a real
   running show — a named rundown, real presenters, a real 90-second
   variance. A stranger's conference photo is the one element on the page a
   visitor cannot verify and a competitor can trivially copy.
2. **The licence forbids the only framing that would make it meaningful.**
   Because it cannot imply endorsement, the photo can never be captioned as a
   Kramflow deployment. It would be pure atmosphere — decoration, which this
   brief bans elsewhere.
3. **It is the most generic possible choice in this category.** Every event
   technology company's site already opens on a lit stage with an audience
   silhouette. Adding one makes Kramflow *more* like its competitors.
4. The brief's own fallback applies: *"If suitable photography cannot be
   sourced legally and cleanly: DO NOT USE IT. Instead make the interface
   itself more physical and spatial."* Cleanly is doing work in that sentence.

**Therefore the physical world has to be built from screen topology** — the
four real display captures placed as screens in a venue, at real relative
scale, in darkness, with depth. That is §27's own fallback and it is the only
route that keeps every pixel on the page verifiable.

---

## 4. Principles extracted → Kramflow application

| Source | What works | Principle | Kramflow application |
|---|---|---|---|
| Scroll Media Expansion Hero (21st) | Contained media expands to become the environment | **A screen can become a room** | Already partly used: hero push-in. Pushed further in The Room section. |
| Zoom Parallax (21st) | Objects moving at different rates read as depth | **Differential rate = spatial depth** | Four venue screens drift at different rates so they read as being at different distances, not on one plane. |
| Container Scroll Animation (21st) | — | **Ubiquity is the tell** (anti-reference) | No 3D frames, no perspective tilt, no device mockups. |
| 21st catalogue scale (1,152 heroes) | — | **Assembling from a library produces library-shaped pages** | Nothing imported; principles only. |
| Pexels licence research | — | **Unverifiable imagery dilutes verifiable imagery** | No stock. Physical context built from real captures. |
| Existing Kramflow product | Cue numbers, timecodes, state chips, display topology | **The product already has a visual vocabulary** | Cue numbering (01–05), mono metadata, green = live, screen topology become the site's design language rather than borrowed SaaS aesthetics. |

---

## 5. Baseline measured (before this pass)

Captured at 390 / 414 / 768 / 834 / 1024 / 1280 / 1440 / 1920, four scroll
positions each, into `.qa/before/`.

| Width | Doc height | Horizontal overflow |
|---|---|---|
| 390 | 8,377 | 0 |
| 414 | 8,468 | 0 |
| 768 | 10,679 | 0 |
| 834 | 11,183 | 0 |
| 1024 | 9,945 | 0 |
| 1280 | 10,140 | 0 |
| 1440 | 10,165 | 0 |
| 1920 | 10,165 | 0 |

---

## 6. Art-direction scorecard — current page, honest

| Area | Current | Target | Change required |
|---|---|---|---|
| Brand identity | 5 | 8 | Wordmark exists but the page is still carried by dark UI + big type |
| Typography | 8 | 9 | Scale is good (112/96/80/56/49/40); alignment is uniformly left |
| Composition | 7 | 9 | Hero and One Cue are strong; mid-page still reads as columns |
| Product storytelling | 8 | 9 | Strong |
| **Physical-world storytelling** | **3** | **8** | **The room is absent. Largest gap.** |
| Hero | 8 | 9 | Recently rebuilt, strong |
| Navigation | 7 | 8 | Now transforms; fine |
| Section rhythm | 7 | 9 | Five sections, but three share a left-aligned type column |
| Interaction | 8 | 9 | One Cue is genuinely good |
| Motion | 8 | 8 | Causal, five triggers, adequate |
| Photography | 1 | — | Deliberately staying at 1 (see §3) |
| Negative space | 7 | 8 | Some dead zones below pinned stages |
| Product capture treatment | 8 | 9 | Cue Sheet/console readable; venue screens still small |
| Mobile art direction | 7 | 8 | Designed, not shrunk, but linear |
| Accessibility | 9 | 9 | Measured clean |
| Performance | 8 | 8 | Static imports, content-hashed |
| **Originality** | **6** | **9** | **Would be hard but not impossible to recreate** |
| **Memorability** | **6** | **9** | **One memorable moment (One Cue); need a second** |
| **Overall** | **6.8** | | |

### The §08 test

*"If I removed the logo and the product screenshots, would this still look
like Kramflow?"*

**No.** Remove the captures and what remains is warm-black, Archivo, and left
alignment — which is a competent dark editorial template. The identity is
currently carried entirely by the screenshots.

**What has to change:** the site's own vocabulary must come from the
product's operational language — cue numbering, timecode, state colour,
screen topology — not from generic premium-dark conventions.

---

## 7. Direction chosen (§09)

**A + B: Live signal × Stage architecture.**

Not C (editorial live production) — that direction depends on photography we
have decided not to fake. Not D as a whole-page conceit; the page should not
pretend to be a dashboard.

Concretely:
- **Cue numbering** (`01`–`05`) as a structural device, already begun in One
  Cue, extended across the page.
- **Screen topology** as composition: displays positioned as they are
  positioned in a building, at their real relative sizes.
- **Green strictly semantic** — live / synced / online. Never decoration.
- **Darkness as the venue**, not as a colour scheme.

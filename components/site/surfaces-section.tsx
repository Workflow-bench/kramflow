"use client";

import { useEffect, useRef, useState } from "react";
import { ProductShot, type ShotKey } from "./product-shot";
import { AppWindow } from "./app-window";
import { PhoneFrame } from "./phone-frame";

/**
 * One environment, many endpoints.
 *
 * The previous version failed its own brief. It put a heading and a
 * paragraph on the left and a fully-contained screenshot on the right,
 * six times — which does not demonstrate six surfaces, it *lists six
 * product names next to a picture*. Same container, same hierarchy, same
 * gutter, six times. The screenshot was also small enough that nothing in
 * it could be read, so the product was decoration for the text.
 *
 * The inversion here is the whole idea:
 *
 * - **The frame never moves.** One aperture, bleeding off the left edge,
 *   holding a single large capture. Scrolling changes what is inside it,
 *   not where it is. That is the literal argument — one system, and the
 *   endpoint changes.
 * - **The type carries the scale contrast.** The active surface name is
 *   set at display scale; the other five collapse to 11px mono rules.
 *   Reading the column top to bottom, five-sixths of it is operational
 *   metadata and one-sixth is a headline, which is a far sharper contrast
 *   than six identical h3s.
 * - **The description is subordinate**, one line, under the active name —
 *   not a paragraph competing with the capture.
 *
 * No pin and no scroll-jacking: a plain `position: sticky` aperture, and
 * IntersectionObserver sentinels choose the active surface. Native scroll
 * is never touched, so a visitor can fling past the whole section.
 *
 * Below `lg` the aperture is abandoned — a stationary frame needs a
 * column beside it that a phone does not have — and it degrades to the
 * same content stacked, with each capture at full bleed width.
 */

interface Surface {
  id: string;
  name: string;
  line: string;
  shot: ShotKey;
  /** Real route shape, shown in the window chrome's label — no invented domain. */
  route: string;
  /** The phone is the one object that is a device, not a screen. */
  portrait?: boolean;
}

const SURFACES: Surface[] = [
  {
    id: "console",
    name: "Console",
    line: "The show as one screen. One operator holds the lease; everyone else watches the same truth.",
    shot: "console",
    route: "/e/northwind-summit-2026/operator",
  },
  {
    id: "cue-sheet",
    name: "Cue Sheet",
    line: "Build the running order before doors, or import the spreadsheet you already have.",
    shot: "cueSheet",
    route: "/e/northwind-summit-2026/operator/cue-sheet",
  },
  {
    id: "remote",
    name: "Remote",
    line: "What one hand needs while walking: what is on, how long is left, and Next.",
    shot: "remote",
    route: "/e/northwind-summit-2026/remote",
    portrait: true,
  },
  {
    id: "displays",
    name: "Displays",
    line: "Every screen in the building, its role, and whether it is still listening.",
    shot: "displays",
    route: "/e/northwind-summit-2026/displays",
  },
  {
    id: "broadcast",
    name: "Broadcast",
    line: "A Wi-Fi notice to the lobby, a mic call to the booth, an override everywhere.",
    shot: "broadcast",
    route: "/e/northwind-summit-2026/broadcast",
  },
  {
    id: "rehearsal",
    name: "Rehearsal",
    line: "Run the whole sequence without touching a single live display.",
    shot: "rehearsal",
    route: "/e/northwind-summit-2026/rehearsal",
  },
];

export function SurfacesSection() {
  const [active, setActive] = useState(0);
  const sentinels = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const i = sentinels.current.indexOf(entry.target as HTMLDivElement);
            if (i >= 0) setActive(i);
          }
        }
      },
      { rootMargin: "-48% 0px -48% 0px" }
    );
    sentinels.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section id="product" className="relative border-b border-line-soft">
      {/* Visually hidden on desktop by design — the active surface name
          (an h3, set at display scale) carries the section's visual
          announcement instead, which is the whole point of this layout.
          But a section needs an h2 in the accessibility tree regardless
          of what it looks like, and without this the desktop heading
          order skipped straight to h3 with nothing above it: the
          section's actual title was absent for every visitor above the
          lg breakpoint, screen readers included. */}
      <h2 className="hidden lg:block lg:sr-only">One system. Six endpoints.</h2>
      {/* ---------------------------------------------------------- desktop */}
      <div className="hidden grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:grid">
        {/* The aperture. Fixed position, bleeding toward the left edge.
            `pl-7` — not flush at pl-0. That gap was fine for the original
            bare screenshot (a bled photo has no "correct" edge to clip),
            but the AppWindow/PhoneFrame chrome around it is a drawn object
            with a rounded corner and, on the windows, three chrome dots —
            and a drawn object sitting exactly at x=0 with that corner and
            those dots cut off reads as clipped, not as bleeding. Measured
            before this fix: the window's left edge sat at literal x=0
            against the viewport. A small fixed gutter keeps the
            composition's intent (large, edge-run capture) while stopping
            the frame's own decorative edge short of the actual boundary. */}
        <div className="relative pl-7">
          <div className="sticky top-0 flex h-screen items-center overflow-hidden">
            <div className="relative aspect-[16/10] w-full">
              {SURFACES.map((surface, i) => (
                <div
                  key={surface.id}
                  aria-hidden={active !== i}
                  className={`absolute inset-0 flex items-center transition-opacity duration-500 ease-out motion-reduce:transition-none ${
                    active === i ? "opacity-100" : "pointer-events-none opacity-0"
                  } ${surface.portrait ? "justify-center" : "justify-end"}`}
                >
                  {surface.portrait ? (
                    // Height at 100% of the aperture box read as small: the
                    // aperture is a 16:10 *landscape* reference frame
                    // shared by all six surfaces, so a portrait object
                    // capped to its height sits well inside the available
                    // vertical space, surrounded by visible slack, next to
                    // a display-scale heading — it looked out of place at
                    // that scale, confirmed by comparing it against the
                    // desktop windows, which bleed 24% *past* the same box
                    // in their own dominant (horizontal) direction rather
                    // than sitting flush inside it. The phone gets the
                    // equivalent treatment in its own dominant direction,
                    // height, bleeding past the box instead of fitting
                    // inside it. The sticky wrapper is a full h-screen tall
                    // and centers its content, so this has real headroom
                    // before it would ever clip.
                    <PhoneFrame
                      className="shadow-[0_50px_140px_-40px_rgba(0,0,0,0.95)]"
                      style={{ height: "142%", aspectRatio: "430 / 932" }}
                    >
                      <ProductShot shot={surface.shot} sizes="30vw" className="h-full w-full object-cover" />
                    </PhoneFrame>
                  ) : (
                    <AppWindow label={surface.route} className="w-[124%] shadow-[0_50px_140px_-40px_rgba(0,0,0,0.95)]">
                      <ProductShot shot={surface.shot} sizes="78vw" />
                    </AppWindow>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* The index. One name at display scale, five as mono rules. */}
        <div className="pl-14 pr-10">
          {SURFACES.map((surface, i) => (
            <div
              key={surface.id}
              ref={(el) => {
                sentinels.current[i] = el;
              }}
              className="flex h-[58vh] flex-col justify-center"
            >
              <p className="tnum text-[11px] uppercase tracking-[0.2em] text-muted-2/60">
                {String(i + 1).padStart(2, "0")} / 06
              </p>
              <h3
                className={`mt-3 font-display transition-all duration-500 ease-out motion-reduce:transition-none ${
                  active === i ? "text-[clamp(2.25rem,3.4vw,3.5rem)] text-primary" : "text-[1.125rem] text-muted-2/45"
                }`}
              >
                {surface.name}
              </h3>
              <p
                className={`mt-4 max-w-[34ch] leading-relaxed transition-opacity duration-500 motion-reduce:transition-none ${
                  active === i ? "text-muted opacity-100" : "text-muted-2/40 opacity-55"
                }`}
              >
                {surface.line}
              </p>
            </div>
          ))}
          {/* Trailing spacer, not a seventh surface — no sentinel ref, so
              it never becomes "active".
              The sticky aperture stays pinned only as long as this grid
              row's height (driven by this column, since it's taller than
              the 100vh aperture) hasn't run out. Without this, the row's
              height was exactly 6 × 58vh, so the moment Rehearsal's own
              sentinel intersected and became active there was almost no
              track left before the row ended — the aperture detached and
              scrolled with the page while Rehearsal was still meant to be
              the pinned, centred view, clipping its own window mid-shape
              against the section boundary. Reproduced at 1440 by scrolling
              to 97% of the section's height and screenshotting. This
              spacer gives the last surface the same full dwell time as
              every other one before the aperture is allowed to release. */}
          <div aria-hidden="true" className="h-[58vh]" />
        </div>
      </div>

      {/* ----------------------------------------------------------- mobile */}
      <div className="space-y-14 py-16 lg:hidden">
        <h2 className="px-6 font-display text-[clamp(1.875rem,7vw,2.5rem)] text-primary">
          One system. Six endpoints.
        </h2>
        {SURFACES.map((surface, i) => (
          <div key={surface.id}>
            <div className="px-6">
              <p className="tnum text-[11px] uppercase tracking-[0.2em] text-muted-2/60">
                {String(i + 1).padStart(2, "0")} / 06
              </p>
              <h3 className="mt-2 font-display text-[1.75rem] text-primary">{surface.name}</h3>
              <p className="mt-3 max-w-[42ch] leading-relaxed text-muted">{surface.line}</p>
            </div>
            <div className={surface.portrait ? "mx-auto mt-6 w-[min(15rem,62%)]" : "mt-6"}>
              {surface.portrait ? (
                <PhoneFrame>
                  <ProductShot shot={surface.shot} sizes="62vw" />
                </PhoneFrame>
              ) : (
                <AppWindow label={surface.route}>
                  <ProductShot shot={surface.shot} sizes="100vw" />
                </AppWindow>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

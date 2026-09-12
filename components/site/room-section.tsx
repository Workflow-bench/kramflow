"use client";

import { useRef } from "react";
import { ProductShot, type ShotKey } from "./product-shot";
import { useGsap } from "./use-gsap";

/**
 * The Room — the page's physical-world moment.
 *
 * The problem this solves is the one the page could not previously answer:
 * *where is the room?* Kramflow controls things that exist in a building,
 * and a page made entirely of rectangles of software describes the
 * software and not the job.
 *
 * **Why there is no photograph here.** Licensing was not the obstacle —
 * the Pexels licence permits commercial use, modification and carries no
 * attribution requirement. Availability and honesty were. Searching
 * turned up empty cinema interiors, brightly-lit corporate-speaker stock
 * and close-ups of audio desks; none of it is a show-control environment,
 * and every event-technology company already opens on a lit stage with an
 * audience silhouette. More decisively: every other visual on this page
 * is a verifiable state of a real running show, and the licence
 * explicitly forbids implying endorsement, so a stock frame could never be
 * captioned as a Kramflow deployment. It would be the one unverifiable
 * thing on a page whose whole argument is verifiability. See
 * outputs/kramflow-landing-refinement-research.md §3.
 *
 * So the room is built from the screens themselves — which is the honest
 * version, because in a venue the screens *are* what you see. The four
 * real display captures are placed at the relative size and distance they
 * actually occupy: the lobby display is physically large and far away,
 * the confidence monitor is small and right at the stage lip, the booth
 * is behind the audience. Each is labelled with its distance from stage,
 * which is operational metadata doing the work a caption would otherwise
 * do badly.
 *
 * **The motion is depth, not parallax-for-its-own-sake.** Screens drift at
 * rates proportional to their stated distance — the near confidence
 * monitor moves most, the far lobby display least. That is the one idea
 * taken from 21st.dev's Zoom Parallax (differential rate reads as depth);
 * its execution there — unrelated stock images flying past each other — is
 * exactly what is not wanted. Here the rate encodes a real number that is
 * printed next to the screen it governs.
 *
 * Compositor-friendly throughout: `y` and `opacity` only, one ScrollTrigger
 * for the whole section, cleaned up by `gsap.context`. Under reduced motion
 * every screen simply sits at its resting position, fully visible.
 */

interface Placement {
  shot: ShotKey;
  label: string;
  /** Metres from the stage lip. Drives both the caption and the drift rate. */
  distance: number;
  /** Tailwind positioning inside the stage box. */
  position: string;
  width: string;
  /** Further screens are dimmer — atmosphere, not a filter animation. */
  opacity: string;
}

const PLACEMENTS: Placement[] = [
  {
    shot: "presenter",
    label: "Stage confidence monitor",
    distance: 2,
    // Nearest to the stage, so: lowest in frame and largest.
    position: "left-[13%] top-[54%]",
    width: "w-[33%]",
    opacity: "opacity-100",
  },
  {
    shot: "general",
    label: "Lobby display",
    distance: 60,
    // Furthest away, so: highest in frame and smallest.
    position: "left-[39%] top-[1%]",
    width: "w-[24%]",
    opacity: "opacity-[0.55]",
  },
  {
    shot: "av",
    label: "AV booth",
    distance: 24,
    position: "right-[2%] top-[29%]",
    width: "w-[28%]",
    opacity: "opacity-[0.8]",
  },
  {
    shot: "speakerReady",
    label: "Speaker ready room",
    distance: 40,
    position: "left-[3%] top-[17%]",
    width: "w-[25%]",
    opacity: "opacity-[0.68]",
  },
];

export function RoomSection() {
  const root = useRef<HTMLElement>(null);

  useGsap(root, ({ gsap, reduced }) => {
    if (reduced) {
      gsap.set("[data-screen]", { y: 0, opacity: 1 });
      return;
    }
    // One trigger, scrubbed. Drift is inversely proportional to distance:
    // the screen two metres away sweeps past, the one sixty metres away
    // barely moves. That is how a real room behaves when you walk through
    // it, and it is why the numbers are printed on the labels.
    gsap.utils.toArray<HTMLElement>("[data-screen]").forEach((el) => {
      const distance = Number(el.dataset.distance ?? 10);
      const drift = gsap.utils.clamp(8, 62, 130 / distance);
      gsap.fromTo(
        el,
        { y: drift },
        {
          y: -drift,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: 0.7 },
        }
      );
    });
  });

  return (
    <section ref={root} className="relative overflow-hidden border-b border-line-soft bg-[#080706]">
      <div className="mx-auto max-w-[1680px] px-6 pt-24 sm:px-10 lg:pt-32">
        <p className="tnum text-[11px] uppercase tracking-[0.22em] text-muted-2">05 / The room</p>
        <h2 className="mt-5 max-w-[17ch] font-display text-[clamp(2rem,5vw,4.25rem)] text-primary">
          Every screen in the building, on the same cue.
        </h2>
      </div>

      {/* --------------------------------------------------------- desktop */}
      <div className="relative mx-auto hidden h-[88vh] max-w-[1680px] px-10 lg:block">
        {/* The floor. One hairline where the room's surfaces sit, so the
            screens read as standing in a space rather than floating in a
            collage. */}
        <div aria-hidden="true" className="absolute inset-x-10 top-[86%] h-px bg-line-soft" />

        {PLACEMENTS.map((p) => (
          <figure
            key={p.label}
            data-screen
            data-distance={p.distance}
            className={`absolute ${p.position} ${p.width} ${p.opacity} will-change-transform`}
          >
            <div className="overflow-hidden rounded-[0.35rem] bg-black shadow-[0_40px_100px_-30px_rgba(0,0,0,0.95)] ring-1 ring-line-soft">
              <ProductShot shot={p.shot} sizes="34vw" />
            </div>
            <figcaption className="mt-2.5 flex items-baseline gap-3">
              <span className="text-console-label uppercase text-muted-2">{p.label}</span>
              <span className="tnum text-[10px] tracking-[0.16em] text-muted-2/55">{p.distance}m from stage</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mx-auto max-w-[1680px] px-6 pb-24 sm:px-10 lg:pb-28">
        <p className="max-w-[46ch] text-base leading-relaxed text-muted lg:ml-auto lg:mt-6 lg:text-right">
          Four screens, four jobs, four distances from the stage — and one live state between them. Nothing is
          typed twice, and nothing is showing the last item.
        </p>
      </div>

      {/* ---------------------------------------------------------- mobile */}
      <div className="space-y-8 px-6 pb-20 lg:hidden">
        {PLACEMENTS.map((p) => (
          <figure key={p.label}>
            <div className="overflow-hidden rounded-[0.35rem] bg-black ring-1 ring-line-soft">
              <ProductShot shot={p.shot} sizes="100vw" />
            </div>
            <figcaption className="mt-2 flex items-baseline justify-between gap-3">
              <span className="text-console-label uppercase text-muted-2">{p.label}</span>
              <span className="tnum text-[10px] tracking-[0.16em] text-muted-2/55">{p.distance}m</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

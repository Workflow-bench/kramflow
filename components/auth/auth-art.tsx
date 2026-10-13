"use client";

import Link from "next/link";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { Wordmark } from "@/components/site/wordmark";
import { useReduced } from "@/components/site/motion";
import consoleShot from "@/public/product/console.png";

/**
 * The auth split's left panel: the real Operator Console (the same capture
 * `ProductShot` uses on the homepage — `scripts/capture-product.mjs` against
 * the seeded "Northwind Summit 2026" event, not a mockup) filling the panel
 * edge to edge, with a scrim for the logo and headline sitting on top of it.
 * A prior version of this panel was a hand-built miniature replica of the
 * console; that read as decoration *about* the product. A real, large
 * capture reads as the product itself - the same reasoning product-shot.tsx
 * already documents for the homepage.
 */
export function AuthArt({ className = "" }: { className?: string }) {
  const reduced = useReduced();
  const rootRef = useRef<HTMLDivElement>(null);

  // A one-shot mount reveal, not a scroll reveal (this panel is never scrolled past —
  // AuthShell's layout centers it in the viewport), so it is its own small gsap.context
  // rather than the project's scroll-triggered reveal.ts. Same discipline: reduced
  // motion skips straight to the resolved state, and the context is reverted on
  // unmount so Strict Mode's double-invoke never doubles the tweens.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;
    const ctx = gsap.context(() => {
      const targets = gsap.utils.toArray<HTMLElement>("[data-art-reveal]");
      gsap.set(targets, { opacity: 0, y: 12 });
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out",
        delay: 0.1,
      });
    }, root);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <div ref={rootRef} aria-hidden="true" className={`relative isolate overflow-hidden bg-black ${className}`}>
      <Image
        src={consoleShot}
        alt=""
        fill
        sizes="(min-width: 900px) 55vw, 0px"
        quality={90}
        priority
        className="object-cover object-left-top opacity-90"
      />

      {/* Legibility scrims: a top-down wash so the logo sits on dark ground
          regardless of what the capture shows underneath it, and a taller
          bottom wash the headline needs to read over busy console pixels. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/10 to-black/85" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/55 to-transparent" />

      <div className="relative flex h-full flex-col p-10 sm:p-12">
        <Link
          data-art-reveal
          href="/"
          className="-m-2 inline-flex w-fit rounded-chip p-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Wordmark />
        </Link>

        <div className="mt-auto flex flex-col gap-3">
          <p data-art-reveal className="tnum text-[12px] uppercase tracking-[0.2em] text-muted-2">
            The real Operator Console
          </p>
          <p data-art-reveal className="font-display text-[clamp(1.75rem,2.6vw,2.5rem)] leading-[1.1] text-primary">
            One cue.
            <br />
            The whole room follows.
          </p>
          <p data-art-reveal className="max-w-[36ch] text-[14px] leading-5 text-muted">
            Rundown, live countdown and show controls, all synced to every screen in the venue.
          </p>
        </div>
      </div>
    </div>
  );
}

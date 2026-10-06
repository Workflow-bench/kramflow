import type { Metadata } from "next";
import { Navbar } from "@/components/site/navbar";
import { HeroSection } from "@/components/site/hero-section";
import { BeforeDoors } from "@/components/site/before-doors";
import { RoomScene } from "@/components/site/room-scene";
import { WhenPlansChange } from "@/components/site/when-plans-change";
import { TheRoom } from "@/components/site/the-room";
import { ClosingSection } from "@/components/site/closing-section";
import { MotionFlag } from "@/components/site/motion-flag";
import { SmoothScroll } from "@/components/site/smooth-scroll";
import { Arrival } from "@/components/site/arrival";
import { Footer } from "@/components/site/footer";

// The public marketing page — proxy.ts redirects a signed-in operator straight to
// /dashboard, so this only ever renders for a logged-out visitor.
//
// Six compositions, in the order the work actually happens: the promise and the
// instrument; what you do before doors; calling the cue and watching the room follow;
// what you reach for when the plan changes; how a screen in the venue joins; and the
// close. No two of them share a grammar, which is what stops a marketing page reading
// as one layout repeated with different words.
//
// Every product image on this page is a genuine capture of KramFlow running the seeded
// "Northwind Summit 2026" event (scripts/capture-product.mjs). Nothing here is a
// recreation, a mockup or a redrawn control — see
// docs/audit-remediation/evidence/homepage-redesign/PROVENANCE.md for each asset's
// route, date, dimensions, SHA-256 and known drift.
//
// The STANDBY/GO overlay is deliberately gone: it showed an amber-to-green cue light
// to a visitor with no show running, which reads as a live status indicator for a
// state that does not exist.

// Homepage metadata (B006-F1, B006-F2). Next merges nested metadata shallowly, so
// openGraph must repeat the root fields or the homepage loses siteName and type.
// The canonical is set here, not at the root, so private routes do not inherit it.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: "KramFlow",
    description:
      "KramFlow is a live-event operating system for coordinating stage managers, AV operators, and performers across TV displays and mobile control.",
    siteName: "KramFlow",
    type: "website",
  },
};

export default function Home() {
  return (
    <main className="bg-background">
      {/* Skip link: the first focusable element, hidden until keyboard focus (KF-020). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:border focus:border-line focus:bg-raised focus:px-4 focus:py-2 focus:text-console-sm focus:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Skip to content
      </a>
      <Navbar />
      <SmoothScroll>
      <div id="main-content" tabIndex={-1} className="focus:outline-none">
        <HeroSection />
        <BeforeDoors />
        {/* One canonical id per scene, with the earlier anchors kept as zero-height
            aliases beside it. The scroll scene owns `#product` (the nav's "Product"),
            and `#call`/`#one-cue` — both of which have pointed at this story in earlier
            revisions — resolve just above it. The operations chapter owns `#features`
            (the nav's "Features") with `#adapt` as its alias. No id is duplicated. */}
        <span id="one-cue" aria-hidden="true" className="legacy-anchor" />
        <span id="call" aria-hidden="true" className="legacy-anchor" />
        <RoomScene />
        <span id="adapt" aria-hidden="true" className="legacy-anchor" />
        <WhenPlansChange />
        <TheRoom />
        <ClosingSection />
      </div>
      <Footer />
      </SmoothScroll>
      <MotionFlag />
      <Arrival />
    </main>
  );
}

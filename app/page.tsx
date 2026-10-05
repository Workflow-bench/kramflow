import type { Metadata } from "next";
import { Navbar } from "@/components/site/navbar";
import { HeroSection } from "@/components/site/hero-section";
import { PlayableShow } from "@/components/site/playable-show";
import { CallSheet } from "@/components/site/call-sheet";
import { OneCueSection } from "@/components/site/one-cue-section";
import { LiveOperationsSection } from "@/components/site/live-operations-section";
import { CTASection } from "@/components/site/cta-section";
import { Footer } from "@/components/site/footer";

// The public marketing page — proxy.ts redirects a signed-in operator
// straight to /dashboard, so this only ever renders for a logged-out
// visitor.
//
// Every product visual on this page is a real screenshot of Kramflow
// running a seeded conference ("Northwind Summit 2026" — three sessions,
// a genuine rundown, a show running ninety seconds behind). They are
// produced by `npm run capture:product`, which seeds the show and then
// photographs the running app. The previous version hand-rebuilt each
// surface in markup instead; accurate, but an approximation is always
// thinner than the thing, and it drifts.
//
// Section rhythm is the composition, not an afterthought. Each beat is a
// different *kind* of thing, because six variations on "centred column,
// heading, paragraph, cards" is what made the earlier page read as
// generated no matter how correct it was:
//
//   Hero            full viewport; opens on a STANDBY/GO cue light, headline rises line by line
//   One cue         pinned cinematic sequence — one cue propagating
//   Your turn       a playable rundown: Next, +1 min, four screens follow
//   Call sheet      the details as a cue sheet whose rows go live on scroll
//   Trust           inverted; the only section with no product visual, counting facts
//   CTA             one sentence, one action
//
// No two consecutive sections share a compositional grammar, which is the
// thing that stops a page reading as a stack of blocks.
//
// The page is built on the product's own tokens (warm graphite #0c0b09,
// the macOS status ramp, `rounded-panel`, `.tnum`) rather than the literal
// zinc palette it used to carry, so the marketing surface and the app are
// made of the same material rather than merely described as sharing one.
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
      {/* Skip link: the first focusable element. Hidden until keyboard focus, then it
          jumps past the navigation to the content (KF-020). Target: #main-content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-raised focus:border focus:border-line focus:px-4 focus:py-2 focus:text-console-sm focus:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Skip to content
      </a>
      <Navbar />
      <div id="main-content" tabIndex={-1} className="focus:outline-none">
        <HeroSection />
        <PlayableShow />
        <OneCueSection />
        <CallSheet />
        <LiveOperationsSection />
        <CTASection />
      </div>
      <Footer />
    </main>
  );
}

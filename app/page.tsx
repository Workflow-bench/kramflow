import { Navbar } from "@/components/site/navbar";
import { HeroSection } from "@/components/site/hero-section";
import { OneCueSection } from "@/components/site/one-cue-section";
import { RoomSection } from "@/components/site/room-section";
import { ProblemSection } from "@/components/site/problem-section";
import { SurfacesSection } from "@/components/site/surfaces-section";
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
//   Hero            full viewport; type set on the console itself
//   Problem         quiet and editorial, answered by the cue sheet
//   One cue         pinned cinematic sequence — one cue propagating
//   Surfaces        one stationary aperture, the endpoint changes
//   The room        screen topology: four displays at four real distances
//   Trust           the only section with no product visual at all
//   CTA             one sentence, one action
//
// No two consecutive sections share a compositional grammar, which is the
// thing that stops a page reading as a stack of blocks.
//
// The page is built on the product's own tokens (warm graphite #0c0b09,
// the macOS status ramp, `rounded-panel`, `.tnum`) rather than the literal
// zinc palette it used to carry, so the marketing surface and the app are
// made of the same material rather than merely described as sharing one.
export default function Home() {
  return (
    <main className="bg-background">
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <OneCueSection />
      <SurfacesSection />
      <RoomSection />
      <LiveOperationsSection />
      <CTASection />
      <Footer />
    </main>
  );
}

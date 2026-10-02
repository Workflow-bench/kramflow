import { Navbar } from "@/components/site/navbar";
import { HeroSection } from "@/components/site/hero-section";
import { PlayableShow } from "@/components/site/playable-show";
import { CallSheet } from "@/components/site/call-sheet";
import { StandbyOverlay } from "@/components/site/standby-overlay";
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
export default function Home() {
  return (
    <main className="bg-background">
      <StandbyOverlay />
      <Navbar />
      <HeroSection />
      <OneCueSection />
      <PlayableShow />
      <CallSheet />
      <LiveOperationsSection />
      <CTASection />
      <Footer />
    </main>
  );
}

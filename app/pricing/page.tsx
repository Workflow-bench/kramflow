import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Wordmark } from "@/components/site/wordmark";
import { SiteAction, SiteTextLink } from "@/components/site/site-action";
import { LiquidBackdrop } from "@/components/site/liquid-backdrop";

// Deliberately one plan, not three invented tiers: there is no real pricing
// structure defined for this product yet (confirmed against PRODUCT.md and
// docs/PRD.md - neither mentions a price), and the rest of the site already
// makes one real commitment in its own copy ("Free for your first event. No
// credit card." - see components/site/new-landing.tsx's ClosingSection).
// This page states that same real commitment properly rather than fabricating
// dollar figures or plan names this product doesn't actually have.
export const metadata: Metadata = {
  title: "Pricing",
  alternates: { canonical: "/pricing" },
};

const INCLUDED = [
  "Unlimited queue items on your event",
  "Operator Console, Cue Sheet, Remote and Broadcast Center",
  "General, AV, Green Room and Presenter displays - no login for anyone in the room",
  "Share link, QR code and 6-digit TV code distribution",
  "Multi-day, multi-session events with sections",
  "Real-time sync across every connected display",
];

export default function PricingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-primary">
      <LiquidBackdrop opacity={0.18} />

      <header className="relative z-10 mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-6 sm:px-10">
        <SiteTextLink href="/" className="h-auto px-0 text-primary hover:text-primary">
          <Wordmark />
        </SiteTextLink>
        <div className="flex items-center gap-3">
          <SiteTextLink href="/login">Log in</SiteTextLink>
          <SiteAction href="/signup" role="primary" size="nav">
            Start free
          </SiteAction>
        </div>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-[1200px] px-6 py-16 sm:px-10 sm:py-24">
        <div className="mx-auto max-w-[52ch] text-center">
          <span className="inline-flex items-center gap-2 font-display text-[12px] uppercase tracking-[0.18em] text-muted-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-status-green motion-safe:animate-pulse" />
            Pricing
          </span>
          <h1 className="mt-4 font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.08] text-primary">
            Free to run your first event.
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            No credit card, no seat count, no feature gate. Kramflow is free while you run your first show.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-[560px]">
          <div className="glass-panel rounded-panel border border-line p-8 shadow-[0_40px_120px_-48px_rgba(0,0,0,0.9)] sm:p-10">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[22px] text-primary">Kramflow</h2>
              <p className="font-display text-[32px] leading-none text-primary">
                $0<span className="ml-1 text-[14px] font-normal text-muted">/ first event</span>
              </p>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              Everything you need to replace the spreadsheet shouted across a green room.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[14px] leading-relaxed text-primary">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-green" strokeWidth={2.5} />
                  {item}
                </li>
              ))}
            </ul>
            <SiteAction href="/signup" role="primary" size="hero" className="mt-8 w-full">
              Start free
            </SiteAction>
          </div>

          {/* Review 02: answer the two questions a buyer asks next, using
              only what's actually true today. No invented prices. */}
          <dl className="mt-10 flex flex-col gap-6 text-[14px] leading-relaxed">
            <div>
              <dt className="font-display text-[16px] text-primary">What counts as one event?</dt>
              <dd className="mt-1 text-muted">
                One show with all its days and sessions, for example a three-day conference with morning and
                evening sessions.
              </dd>
            </div>
            <div>
              <dt className="font-display text-[16px] text-primary">What happens after my first event?</dt>
              <dd className="mt-1 text-muted">
                Pricing for later events hasn&apos;t been announced yet. We never ask for a card, so nothing can be
                charged without you choosing a plan first.
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  );
}

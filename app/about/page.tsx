import type { Metadata } from "next";
import { Wordmark } from "@/components/site/wordmark";
import { SiteAction, SiteTextLink } from "@/components/site/site-action";
import { LiquidBackdrop } from "@/components/site/liquid-backdrop";

// Grounded in PRODUCT.md's own "Product Purpose," "Positioning" and
// "Operating Context" sections - the real, already-written statement of
// what this product is and who it's for. No invented founding story, team
// bios or funding history: none of that exists in the project's own
// documentation, so none of it appears here.
export const metadata: Metadata = {
  title: "About",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  {
    title: "The queue is the product",
    body: "Every surface - console, cue sheet, remote, every connected display - is a different lens onto one shared live queue state, not a separate feature bolted on beside it.",
  },
  {
    title: "Control and display are different surfaces",
    body: "An operator's console and a venue's TV display aren't the same UI with permissions toggled. Density, interactivity and distance from the viewer diverge on purpose.",
  },
  {
    title: "Two questions, answered in three seconds",
    body: "Everyone in the room who isn't driving the show needs exactly two things from a screen: what's happening now, and what's next.",
  },
];

const AUDIENCES = [
  {
    label: "Operators",
    body: "Stage managers and AV crew running the show from a laptop at the console or a phone backstage. Task-focused, trained on the tool, back in it across every day of a multi-day event.",
  },
  {
    label: "Everyone else in the venue",
    body: "Performers, crew, presenters, attendees - glancing at a screen from across the room. Reached by link, QR code or a 6-digit TV code. No account, ever.",
  },
];

export default function AboutPage() {
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
        <span className="inline-flex items-center gap-2 font-display text-[12px] uppercase tracking-[0.18em] text-muted-2">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-status-green motion-safe:animate-pulse" />
          About
        </span>
        <h1 className="mt-4 max-w-[18ch] font-display text-[clamp(2rem,4.5vw,3rem)] leading-[1.08] text-primary">
          Built to replace the spreadsheet shouted across a green room.
        </h1>
        <p className="mt-6 max-w-[60ch] text-[16px] leading-relaxed text-muted">
          Kramflow is a real-time production console. An operator drives a queue of program items through a live
          show, and every connected display - audience-facing, crew-facing, or performer-facing - reflects that
          state within about a second, with zero manual relay. Not a generic countdown-timer tool retrofitted with a
          queue, and not a generic event-management tool retrofitted with live sync: the queue is the product, and
          everything else is a property of it.
        </p>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-[1200px] px-6 pb-16 sm:px-10">
        <h2 className="font-display text-[14px] uppercase tracking-[0.18em] text-muted-2">What it&apos;s built on</h2>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="glass-panel rounded-panel border border-line p-6">
              <h3 className="font-display text-[16px] text-primary">{p.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-[1200px] px-6 pb-20 sm:px-10 sm:pb-28">
        <h2 className="font-display text-[14px] uppercase tracking-[0.18em] text-muted-2">Who it&apos;s for</h2>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {AUDIENCES.map((a) => (
            <div key={a.label} className="glass-panel rounded-panel border border-line p-6">
              <h3 className="font-display text-[16px] text-primary">{a.label}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{a.body}</p>
            </div>
          ))}
        </div>

        <div className="glass-panel mt-10 flex flex-col items-start gap-4 rounded-panel border border-line p-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[40ch] font-display text-[20px] leading-snug text-primary">
            Run your first event free. No credit card.
          </p>
          <SiteAction href="/signup" role="primary" size="hero">
            Start free
          </SiteAction>
        </div>
      </section>
    </main>
  );
}

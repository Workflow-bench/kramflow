import { AmbientLight } from "./ambient-light";
import { SiteAction } from "./site-action";

/**
 * The next show — the close.
 *
 * One statement, one action, one way back into the recorded example. The light from
 * the hero returns here at lower intensity so the page ends on the same material it
 * opened with, rather than introducing a final animation system of its own.
 *
 * No invented proof: no pricing, logos, customer names, uptime figures, counts or
 * "no credit card" reassurance. None of those are confirmed, so none are published.
 */
export function ClosingSection() {
  return (
    <section data-cue="The next show" className="relative isolate overflow-hidden border-b border-line-soft">
      <AmbientLight variant="echo" />
      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-6 py-28 sm:px-10 lg:py-40">
        <p className="text-[12px] uppercase tracking-[0.18em] text-muted-2">05 / The next show</p>
        <h2 className="mt-5 max-w-[14ch] font-display text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.02] tracking-[-0.025em] text-primary">
          Your next show. One console.
        </h2>
        <p className="mt-6 max-w-[40ch] text-[17px] leading-relaxed text-muted">
          Prepare the cues. Rehearse the handoffs. Run the room.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <SiteAction href="/signup" role="primary" size="hero">
            Start free
          </SiteAction>
          <SiteAction href="#call" role="quiet" size="hero">
            Explore the show again
          </SiteAction>
        </div>
      </div>
    </section>
  );
}

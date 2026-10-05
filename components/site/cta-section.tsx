import { GoLink } from "./go-link";
import { Reveal } from "./motion";

/**
 * The closing statement: one sentence, one action, staged as the last cue.
 * The action is a GoLink, which reads STANDBY until it is hovered or focused.
 */
export function CTASection() {
  return (
    <section data-cue="Go" className="border-b border-line-soft">
      <div className="mx-auto max-w-[1600px] px-6 py-32 sm:px-10 lg:py-48">
        <Reveal>
          <h2 className="max-w-[13ch] font-display text-[clamp(2.5rem,7vw,6rem)] text-primary">
            When the room moves, Kramflow moves with it.
          </h2>
        </Reveal>
        <Reveal delay={0.15} className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-5">
          <GoLink href="/signup" size="lg">
            Start free
          </GoLink>
          <span className="tnum text-[11px] uppercase tracking-[0.2em] text-muted-2">
            No credit card · Runs your next show
          </span>
        </Reveal>
      </div>
    </section>
  );
}

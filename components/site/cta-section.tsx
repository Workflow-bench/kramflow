import { LinkButton } from "@/components/ui/button";
import { Reveal } from "./motion";

/**
 * The closing statement: one sentence, one action, staged as the last cue.
 * The action is the shared hero-size primary action, the same as the hero (landing-auth D08).
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
          <LinkButton href="/signup" variant="primary" size="hero">
            Start free
          </LinkButton>
          <span className="tnum text-[11px] uppercase tracking-[0.2em] text-muted-2">
            No credit card · Runs your next show
          </span>
        </Reveal>
      </div>
    </section>
  );
}

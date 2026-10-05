import { ProductShot } from "./product-shot";
import { HeroGradient } from "./hero-gradient";
import { SiteAction } from "./site-action";

/**
 * The hero: one reading group, then the real console underneath it.
 *
 * What this composition is answering (desktop design pass, 5 Oct 2026):
 *
 * - The headline, the sentence that explains the product and both actions are
 *   now a single left-aligned cluster. Previously the explanation and signup sat
 *   in a far-right column at the opposite end of a `justify-between` row, so the
 *   claim and its explanation were separated by the full page width and read as
 *   two unrelated blocks (Linear/ChronoTask: message and explanation belong in
 *   one focal area).
 * - The telemetry strip (`LIVE · DAY 1 MORNING · 4/7 · 1M BEHIND`) and the live
 *   wall clock are gone. They animated real browser time next to invented show
 *   state, which claimed a running show the visitor does not have. One factual
 *   category label replaces them, and the capture is identified by a caption
 *   that says what it actually is.
 * - Nothing fades on scroll. The old hero drove copy opacity to 0 from scroll
 *   position, so the headline disappeared while it was still being read.
 * - No `100svh` cap. The console is allowed to extend past a short viewport
 *   instead of being squashed to fit one, which is what made the interface
 *   unreadable at 1280×600.
 *
 * This is a server component. The copy is in the server HTML with no hydration
 * gate and no entrance that starts from `opacity: 0`, so the first paint is the
 * readable one; the only motion is a CSS transform settle (`.hero-rise`), which
 * never hides text and is dropped entirely under reduced motion.
 */

// The capture is 3360×2100 and renders inside a 1360px-max frame.
const CONSOLE_SIZES = "(min-width: 1024px) min(1360px, 92vw), 100vw";

export function HeroSection() {
  return (
    <section data-cue="Standby" className="relative isolate overflow-hidden border-b border-line-soft">
      <HeroGradient />

      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-6 pt-[116px] sm:px-10 lg:pt-[152px]">
        <p className="hero-rise text-[13px] uppercase tracking-[0.18em] text-muted-2">Live event operations</p>

        <h1 className="hero-rise hero-rise-1 mt-6 font-display text-[clamp(2.75rem,6.2vw,6.5rem)] leading-[0.98] tracking-[-0.0325em] text-primary">
          <span className="block">Run the show</span>
          <span className="block">from one screen.</span>
        </h1>

        <p className="hero-rise hero-rise-2 mt-7 max-w-[46ch] text-[19px] leading-relaxed text-muted lg:text-[21px]">
          Run your cue sheet, timers, and venue displays from one operator console.
        </p>

        <div className="hero-rise hero-rise-2 mt-9 flex flex-wrap items-center gap-3">
          <SiteAction href="/signup" role="primary" size="hero">
            Start free
          </SiteAction>
          <SiteAction href="#product" role="quiet" size="hero">
            See it in action
          </SiteAction>
        </div>
      </div>

      {/* The product, framed but not costumed: no invented browser chrome or URL
          bar in this instance (AppWindow still dresses the lower sections, where
          a window frame is doing different work). The capture keeps its own real
          application header. */}
      <figure className="relative z-10 mx-auto mt-14 hidden w-full max-w-[1440px] px-6 sm:px-10 lg:mt-20 lg:block">
        <div className="hero-settle overflow-hidden rounded-panel border border-line bg-card shadow-[0_48px_140px_-40px_rgba(0,0,0,0.92)]">
          <ProductShot shot="console" sizes={CONSOLE_SIZES} priority />
        </div>
        <figcaption className="mt-4 pb-14 text-[13px] text-muted-2 lg:pb-20">
          Operator console · Example event in rehearsal
        </figcaption>
      </figure>

      {/* Mobile keeps the restored behaviour: no console crop in the hero, so the
          3360px capture is never shipped to a phone. Mobile is a regression check
          in this pass, not a redesign. */}
      <div className="h-16 lg:hidden" />
    </section>
  );
}

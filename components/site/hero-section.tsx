import { AmbientLight } from "./ambient-light";
import { ConsoleAperture } from "./console-aperture";
import { SiteAction } from "./site-action";

/**
 * The promise, and the instrument it is made with.
 *
 * The opening viewport has to carry four things at once: the navigation, the claim,
 * both actions, and enough of the real Operator Console that a visitor can see the
 * cue, the countdown and the controls. The previous hero had no height budget at
 * all, so the product started below the fold and the first screen was an empty
 * graphite field with a headline on it.
 *
 * So the section targets one viewport (`100svh`, header included) and spends that
 * budget deliberately: `.hero-copy` shrinks its type and gaps as the viewport gets
 * shorter (see globals.css), and whatever remains belongs to the console aperture.
 * `min-h`, never `h` — at browser zoom or large text the content is allowed to grow
 * past the viewport and scroll rather than being clipped to protect the effect.
 *
 * The operator is named once, here, and nowhere else on the page (HOME-R10): the rest
 * of the chapters describe tasks rather than re-introducing the audience.
 *
 * No STANDBY/GO ornament. Its amber-to-green cue light read as a live status
 * indicator for a visitor who has no show running, which is exactly the kind of
 * invented operational state this page must not display.
 */
export function HeroSection() {
  return (
    <section
      id="top"
      data-cue="Promise"
      className="hero-section relative isolate flex flex-col overflow-hidden border-b border-line-soft"
    >
      <AmbientLight variant="hero" />

      <div className="hero-copy relative z-10 mx-auto w-full max-w-[1440px] px-6 sm:px-10">
        <p className="hero-eyebrow uppercase tracking-[0.18em] text-muted-2">Live event operations</p>

        <h1 className="hero-title font-display tracking-[-0.0325em] text-primary">
          <span className="block">Run the show</span>
          <span className="block">from one screen.</span>
        </h1>

        <p className="hero-body max-w-[46ch] leading-relaxed text-muted">
          Stage managers and AV teams run the cue sheet, timers, and venue displays from one console.
        </p>

        <div className="hero-actions flex flex-wrap items-center gap-3">
          <SiteAction href="/signup" role="primary" size="hero">
            Start free
          </SiteAction>
          <SiteAction href="#prepare" role="quiet" size="hero">
            See how it works
          </SiteAction>
        </div>
      </div>

      {/* The aperture takes the viewport budget the copy did not use. */}
      <div className="hero-aperture-wrap relative z-10 mx-auto w-full max-w-[1440px] px-6 sm:px-10">
        <ConsoleAperture />
      </div>
    </section>
  );
}

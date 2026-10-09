/**
 * The loading screen's markup only. All timing, eligibility and cleanup live in
 * arrival.tsx, which is the one place that decides whether this ever runs.
 *
 * Source: the word-reveal choreography (chars masked in, held, masked out) is GSAP's
 * own documented SplitText pattern (gsap.com/docs/v3/Plugins/SplitText — chars type,
 * fromTo on `.chars`), the same technique demonstrated at gsap.com/text/. SplitText
 * ships free in the installed `gsap` package (v3.15.0; all GreenSock plugins became
 * free for every user in GSAP 3.13, April 2025) — nothing here is a paid or gated
 * dependency. The reference brief named an agency-portfolio aesthetic
 * (dennissnellenberg.com/work); that page returned HTTP 403 to a direct fetch this
 * session; the surfaced tells (large kinetic type, a curtain reveal into the real
 * page) are the documented GSAP/Osmo-style vocabulary for that genre, not a line-for-
 * line copy of a site this session could not actually inspect — see the handoff's
 * source ledger for the full account.
 *
 * Four words, the product's own stages, ending on the word the hero's real eyebrow
 * already uses ("Live"), so the curtain wipe away from this screen lands on a label
 * that was already there, not a new claim.
 */

export const LOADING_WORDS = ["Plan", "Preview", "Rehearse", "Live"] as const;

export function LoadingScreen() {
  return (
    <div aria-hidden="true" className="loading-screen fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
      <div className="loading-screen-stage relative w-full px-6 text-center">
        {LOADING_WORDS.map((word) => (
          <p
            key={word}
            data-word={word}
            className="loading-word absolute inset-0 flex items-center justify-center font-display text-[clamp(2.75rem,6.4vw,7rem)] tracking-[-0.0325em] text-primary"
          >
            {word}
          </p>
        ))}
      </div>
    </div>
  );
}

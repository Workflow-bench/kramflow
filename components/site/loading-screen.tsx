/**
 * The loading screen's markup only. Timing, eligibility and cleanup live in
 * arrival.tsx; the pre-paint boot script lives in app/page.tsx (see both for why).
 *
 * Source: Osmo's "Welcoming Words Loader" (osmo.supply/resource/welcoming-words-loader)
 * — one text node that slides up into place (`yPercent: 50 -> 0`, `Expo.easeInOut`,
 * ~1s), its content swapped at a fixed interval while it holds position, then slides
 * out (`yPercent: -75`, opacity to 0, `Expo.easeIn`, ~0.8s). One element, not one
 * GSAP SplitText instance per word — that was this batch's first attempt, and it read
 * as busy rather than smooth, which is the defect this rebuild fixes. Timing and
 * curves are this reference's own, ported to the product's own four stage words
 * instead of a generic greeting list; see arrival.tsx for the adapted timeline and the
 * full source-ledger note.
 */

export const LOADING_WORDS = ["Plan", "Preview", "Rehearse", "Live"] as const;

export function LoadingScreen() {
  return (
    <div aria-hidden="true" className="loading-screen fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
      <p
        className="loading-word font-display text-[clamp(2.75rem,6.4vw,7rem)] tracking-[-0.0325em] text-primary"
        data-loading-word
      >
        {LOADING_WORDS[0]}
      </p>
    </div>
  );
}

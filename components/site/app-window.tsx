import type { ReactNode } from "react";

/**
 * A restrained window frame for product captures.
 *
 * Adapted from the `product-mockup` skill's "Browser Window Frame" /
 * "Clean Window Frame" patterns, with three deliberate departures:
 *
 * - **Dark chrome, not light.** The reference uses `#E5E7EB` chrome with a
 *   white URL field. A light bar above a near-black console would be the
 *   brightest object in the hero and would pull the eye straight to the
 *   frame instead of the product. This uses the app's own `raised` and
 *   `line` tokens, so the frame reads as part of the same material.
 * - **Neutral traffic lights.** The reference colours them red / amber /
 *   green. Kramflow's palette is semantic — green means live, amber means
 *   behind schedule — and spending those two colours on window furniture
 *   would break the one rule the whole page is built on. Grey dots.
 * - **No 3D perspective.** The skill offers isometric and floating
 *   variants; a tilted screenshot is the single most recognisable
 *   template signature in this category and was removed from this page
 *   two passes ago. The window stays flat.
 *
 * The label shows the product's real route shape. It deliberately does not
 * show a domain: Kramflow has no production domain yet, and inventing one
 * would be the only fabricated thing on a page whose argument is that
 * everything on it is real.
 *
 * Why a frame at all, when an earlier pass argued against browser chrome:
 * the captures were reading as unframed rectangles floating on the page,
 * with hard edges that left it ambiguous whether they were crops or
 * cards. A frame resolves that ambiguity and — more usefully here — gives
 * the console a designed top edge instead of an arbitrary horizontal cut.
 */
export function AppWindow({
  children,
  label,
  className = "",
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-panel border border-line bg-card shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-line-soft bg-raised/50 px-4 py-2.5">
        <span aria-hidden="true" className="flex shrink-0 gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        </span>
        <span className="tnum truncate rounded-chip bg-background/70 px-3 py-1 text-[11px] leading-none text-muted-2">
          {label}
        </span>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * A fixed, page-root film-grain texture — one `feTurbulence` SVG filter painted once
 * over the whole viewport, never on a scrolling container (a repainting filter on
 * something that scrolls is a real mobile frame-rate cost; fixed and static is not).
 * Breaks up the large flat dark surfaces between sections without reading as visible
 * texture at normal viewing distance. `pointer-events: none` throughout: decoration,
 * never a hit target.
 */
export function GrainOverlay() {
  return (
    <div aria-hidden="true" className="grain-overlay pointer-events-none fixed inset-0 z-[90]">
      <svg className="h-full w-full" preserveAspectRatio="none">
        <filter id="grain-overlay-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-overlay-filter)" />
      </svg>
    </div>
  );
}

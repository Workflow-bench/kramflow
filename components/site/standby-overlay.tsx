/**
 * The page opens like a show: an amber STANDBY light flips to a green GO, then
 * the accent fades. Pure CSS (see `.standby-*` in globals.css), so it exists in
 * the server HTML, needs no hydration, and is switched off entirely under
 * reduced motion. It never intercepts input.
 *
 * Scoped change, desktop hero pass (5 Oct 2026): this used to be an opaque
 * full-screen cover (`fixed inset-0 bg-background`) that hid the entire first
 * screen while it ran, so the headline and actions were unreadable for the first
 * ~1.45s. The cue-light personality is kept, but as a small accent in the corner
 * of the first viewport rather than as a gate in front of the content. Nothing
 * about the lower page's own motion changed.
 */
export function StandbyOverlay() {
  return (
    <div
      aria-hidden="true"
      className="standby-accent pointer-events-none fixed right-6 top-[88px] z-[90] hidden sm:right-10 lg:block"
    >
      <div className="tnum flex items-center gap-2.5 text-[11px] uppercase tracking-[0.3em]">
        <span className="standby-light h-2.5 w-2.5 rounded-full" />
        <span className="relative grid">
          <span className="standby-word-a col-start-1 row-start-1 text-status-orange">Standby</span>
          <span className="standby-word-b col-start-1 row-start-1 text-status-green">Go</span>
        </span>
      </div>
    </div>
  );
}

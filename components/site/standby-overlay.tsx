/**
 * The page opens like a show: an amber STANDBY light, a green GO, then the
 * cover lifts away. Pure CSS (see `.standby-*` in globals.css), so it exists
 * in the server HTML, needs no hydration, and is switched off entirely under
 * reduced motion. It never intercepts input.
 */
export function StandbyOverlay() {
  return (
    <div aria-hidden="true" className="standby-cover pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-background">
      <div className="tnum relative flex items-center gap-3 text-[13px] uppercase tracking-[0.3em]">
        <span className="standby-light h-3 w-3 rounded-full" />
        <span className="relative grid">
          <span className="standby-word-a col-start-1 row-start-1 text-status-orange">Standby</span>
          <span className="standby-word-b col-start-1 row-start-1 text-status-green">Go</span>
        </span>
      </div>
    </div>
  );
}

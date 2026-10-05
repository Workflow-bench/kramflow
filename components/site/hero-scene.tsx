import { AppWindow } from "./app-window";

/**
 * The hero's product scene (landing-auth design D06, approved composition): a cue rail, one
 * large current cue with its timer, and two labelled output destinations. It is a static,
 * server-rendered sample of the demo show, not a live connection and not a screenshot, so it
 * reads at every width without a large image and carries no wall-clock time (CD-F6).
 */

const RAIL = [
  { title: "Welcome", state: "Done" },
  { title: "Opening Keynote", state: "Live" },
  { title: "Product Launch Demo", state: "Next" },
  { title: "Coffee Break", state: "" },
] as const;

export function HeroScene() {
  return (
    <div className="relative">
      {/* Warm stage light: low intensity, behind the scene, never over the reading area. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-10 rounded-full opacity-60 blur-2xl"
        style={{ background: "radial-gradient(closest-side, rgba(232,196,132,0.16), rgba(232,196,132,0) 70%)" }}
      />
      <AppWindow label="/e/northwind-summit-2026/operator">
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-6">
          <ol className="flex flex-col gap-1.5" aria-label="Rundown">
            {RAIL.map((item) => (
              <li
                key={item.title}
                className={`flex items-center justify-between gap-2 rounded-control border px-3 py-2 text-[13px] ${
                  item.state === "Live" ? "border-status-green/40 bg-status-green/10 text-primary" : "border-line-soft text-muted"
                }`}
              >
                <span className="truncate">{item.title}</span>
                {item.state && (
                  <span
                    className={`tnum shrink-0 text-[9px] uppercase tracking-[0.14em] ${
                      item.state === "Live" ? "text-status-green" : item.state === "Next" ? "text-status-blue" : "text-muted-2"
                    }`}
                  >
                    {item.state}
                  </span>
                )}
              </li>
            ))}
          </ol>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-panel border border-line-soft bg-background/40 p-4">
              <p className="tnum text-[10px] uppercase tracking-[0.18em] text-muted-2">Current cue · Demo show</p>
              <p className="font-display text-[clamp(1.75rem,3.2vw,2.75rem)] leading-tight text-primary">Opening Keynote</p>
              <p className="tnum text-[clamp(2.5rem,5vw,4.5rem)] leading-none text-status-green" aria-label="Remaining 4 minutes 12 seconds">
                04:12
              </p>
              <p className="text-[12px] text-muted">Amara Osei · next cue in 4 minutes</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-control border border-line-soft bg-background/40 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-2">Stage monitor</p>
                <p className="tnum mt-2 text-[12px] text-status-green">● Cue 3 live</p>
              </div>
              <div className="rounded-control border border-line-soft bg-background/40 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-2">Lobby display</p>
                <p className="mt-2 text-[12px] text-primary">Opening Keynote</p>
              </div>
            </div>
          </div>
        </div>
      </AppWindow>
    </div>
  );
}

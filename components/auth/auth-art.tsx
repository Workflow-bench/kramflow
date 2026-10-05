import { Wordmark } from "@/components/site/wordmark";

// Static product preview for the auth split. The same anatomy as the landing demo: a cue
// rail, a current cue timer, and labelled destination outputs. No timers and no motion: it
// is a composition, not a live status. Labelled as a preview so it cannot read as a live show.
const CUES = [
  { title: "Opening remarks", state: "done" },
  { title: "Keynote", state: "live" },
  { title: "Sponsor reel", state: "next" },
] as const;

const OUTPUTS = [
  { label: "Stage", status: "Live", tone: "text-status-green" },
  { label: "Speaker", status: "Next cue", tone: "text-status-blue" },
  { label: "Lobby", status: "Standby", tone: "text-status-orange" },
] as const;

export function AuthArt({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden border-r border-line-soft bg-[radial-gradient(120%_80%_at_20%_0%,rgba(244,239,229,0.07),transparent_60%)] p-12 ${className}`}
    >
      <div className="flex flex-col gap-10">
        <Wordmark />
        <div className="flex flex-col gap-6">
          <p className="tnum text-[12px] uppercase tracking-[0.2em] text-muted-2">Product preview</p>
          <p className="font-display text-[28px] leading-[34px] text-primary">One cue. The whole room follows.</p>
        </div>
        <div className="rounded-panel border border-line bg-card p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[14px] text-muted">Current cue</p>
            <p className="tnum text-[32px] leading-none text-primary">04:12</p>
          </div>
          <ol className="mt-5 flex flex-col gap-2">
            {CUES.map((cue) => (
              <li
                key={cue.title}
                className={`flex items-center justify-between rounded-control border px-3 py-2 text-[14px] ${
                  cue.state === "live" ? "border-status-green/40 bg-status-green/10 text-primary" : "border-line-soft text-muted"
                }`}
              >
                <span>{cue.title}</span>
                <span className="tnum text-[11px] uppercase tracking-[0.16em] text-muted-2">
                  {cue.state === "live" ? "Live" : cue.state === "next" ? "Next" : "Done"}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {OUTPUTS.map((out) => (
            <div key={out.label} className="rounded-control border border-line-soft bg-raised/60 p-3">
              <p className="text-[13px] text-primary">{out.label}</p>
              <p className={`mt-2 text-[12px] ${out.tone}`}>{out.status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

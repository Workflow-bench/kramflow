import { FitFrame } from "./fit-frame";

/**
 * Code replica of the Operator Console's three working columns — program list, live
 * item, controls — built from the same layout and tokens the product uses, with a fixed
 * fixture show (Northwind Summit 2026, cue 3 or cue 4). It is a sample, not a screenshot:
 * no real session, no store, no network. Used only where a capture cannot be refreshed.
 */

const PROGRAM = [
  { n: 1, title: "Doors and Walk-in Music", owner: "AV", start: "8:55 AM", dur: "30m" },
  { n: 2, title: "Welcome and Housekeeping", owner: "Stage Manager", start: "9:25 AM", dur: "5m" },
  { n: 3, title: "Opening Keynote", owner: "Amara Osei", start: "9:30 AM", dur: "25m" },
  { n: 4, title: "Product Launch Demo", owner: "Rafael Costa", start: "9:55 AM", dur: "20m" },
  { n: 5, title: "Coffee Break", owner: "", start: "10:15 AM", dur: "15m" },
  { n: 6, title: "Panel: Scaling Live Events", owner: "Moderator", start: "10:30 AM", dur: "40m" },
  { n: 7, title: "Closing Remarks", owner: "Amara Osei", start: "11:10 AM", dur: "10m" },
];

export const CUE_STATE = {
  3: { live: 3, remaining: "20:52", next: "Product Launch Demo" },
  4: { live: 4, remaining: "13:51", next: "Coffee Break" },
} as const;

export function ConsoleReplica({ cue, label }: { cue: 3 | 4; label: string }) {
  const s = CUE_STATE[cue];
  const liveTitle = PROGRAM[s.live - 1].title;
  const liveOwner = PROGRAM[s.live - 1].owner;
  return (
    <FitFrame designWidth={1360} designHeight={760} label={label}>
      <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px] text-[12px] text-primary">
        {/* program list */}
        <div className="border-r border-line-soft p-5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted-2">
            <span>Program</span>
            <span className="tnum">{s.live} / 7</span>
          </div>
          <div className="mt-3 h-[3px] w-full rounded bg-line-soft">
            <div className="h-full rounded bg-muted-2" style={{ width: `${(s.live / 7) * 100}%` }} />
          </div>
          <div className="mt-4 text-[11px] text-muted-2">Day 1 · Morning Session</div>
          <ul className="mt-2">
            {PROGRAM.map((it) => {
              const live = it.n === s.live;
              return (
                <li
                  key={it.n}
                  className={`flex items-center gap-3 border-b border-line-soft px-2 py-3 ${live ? "bg-status-green/10" : ""}`}
                >
                  <span className="tnum w-4 text-muted-2">{it.n}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${live ? "text-primary" : "text-muted"}`}>{it.title}</span>
                    <span className="block text-[11px] text-muted-2">{it.owner || " "}</span>
                  </span>
                  <span className="tnum text-muted-2">{it.start}</span>
                  <span className={`tnum w-9 text-right ${live ? "text-status-green" : "text-muted-2"}`}>{it.dur}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* live item */}
        <div className="border-r border-line-soft p-5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-status-green">
            <span className="h-1.5 w-1.5 rounded-full bg-status-green" /> Live now
          </div>
          <div className="mt-3 text-[26px] leading-tight text-primary">{liveTitle}</div>
          <div className="mt-1 text-[14px] text-muted">{liveOwner}</div>
          <div className="mt-3 text-[12px] text-status-orange">{cue === 4 ? "1m behind schedule" : "On time"}</div>
          <div className="tnum mt-10 text-[64px] leading-none text-primary">{s.remaining}</div>
          <div className="mt-3 h-[4px] w-full rounded bg-line-soft">
            <div className="h-full rounded bg-status-green" style={{ width: cue === 4 ? "40%" : "18%" }} />
          </div>
          <div className="mt-1 text-[11px] text-muted-2">remaining</div>
          <div className="mt-6 flex gap-2">
            {["−0:30", "−0:10", "+0:10", "+0:30"].map((t) => (
              <span key={t} className="tnum rounded-control border border-line-soft bg-raised px-3 py-2 text-[12px] text-primary">
                {t}
              </span>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-[72px_1fr] gap-y-2 text-[12px]">
            <span className="text-status-blue">Next</span>
            <span className="text-primary">{s.next}</span>
            <span className="text-muted-2">On deck</span>
            <span className="text-muted">{cue === 4 ? "Panel: Scaling Live Events" : "Product Launch Demo"}</span>
          </div>
        </div>

        {/* controls */}
        <div className="p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-2">Controls</div>
          <div className="mt-3 flex items-center justify-between rounded-control border border-status-green/30 bg-status-green/10 px-3 py-3 text-[12px] text-status-green">
            <span>You have control</span>
            <span className="text-muted-2">Release</span>
          </div>
          <div className="mt-4 text-[12px] text-primary">
            4 displays targeted <span className="ml-1 rounded-chip bg-status-green/15 px-2 py-0.5 text-[10px] text-status-green">4 online</span>
          </div>
          <div className="mt-4 flex h-12 items-center justify-center rounded-control bg-primary text-[15px] font-medium text-background">
            Next ›
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <span className="flex h-10 items-center justify-center rounded-control border border-line-soft bg-raised text-[12px] text-primary">‹ Previous</span>
            <span className="flex h-10 items-center justify-center rounded-control border border-line-soft bg-raised text-[12px] text-primary">Hold</span>
          </div>
          <div className="mt-8 text-[10px] uppercase tracking-[0.16em] text-muted-2">Activity</div>
          <div className="mt-2 space-y-1.5 text-[11px] text-muted">
            <div>10:02 AM · Took control</div>
            <div>9:59 AM · Took control</div>
          </div>
        </div>
      </div>
    </FitFrame>
  );
}

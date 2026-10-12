import { Lock, ChevronLeft, ChevronRight, Pause, Play, HelpCircle } from "lucide-react";
import { FitFrame } from "./fit-frame";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionLabel } from "@/components/ui/section-label";

/**
 * Code replica of the Operator Console's three working columns — program list, live
 * item, controls — built from the same layout and tokens the product uses, with a fixed
 * fixture show (Northwind Summit 2026, cue 3 or cue 4). It is a sample, not a screenshot:
 * no real session, no store, no network. Used only where a capture cannot be refreshed.
 */

export const PROGRAM = [
  { n: 1, title: "Doors and Walk-in Music", owner: "AV", start: "8:55 AM", dur: "30m" },
  { n: 2, title: "Welcome and Housekeeping", owner: "Stage Manager", start: "9:25 AM", dur: "5m" },
  { n: 3, title: "Opening Keynote", owner: "Amara Osei", start: "9:30 AM", dur: "25m" },
  { n: 4, title: "Product Launch Demo", owner: "Rafael Costa", start: "9:55 AM", dur: "20m" },
  { n: 5, title: "Coffee Break", owner: "", start: "10:15 AM", dur: "15m" },
  { n: 6, title: "Panel: Scaling Live Events", owner: "Moderator", start: "10:30 AM", dur: "40m" },
  { n: 7, title: "Closing Remarks", owner: "Amara Osei", start: "11:10 AM", dur: "10m" },
];

export type Cue = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** `next` cycles past item 7 back to item 1 - a real run-of-show loops Doors and
 *  Walk-in Music the next time the room is used, it doesn't dead-end. */
export const CUE_STATE: Record<Cue, { live: Cue; remaining: string; next: string }> = {
  1: { live: 1, remaining: "28:40", next: "Welcome and Housekeeping" },
  2: { live: 2, remaining: "3:12", next: "Opening Keynote" },
  3: { live: 3, remaining: "20:52", next: "Product Launch Demo" },
  4: { live: 4, remaining: "13:51", next: "Coffee Break" },
  5: { live: 5, remaining: "9:05", next: "Panel: Scaling Live Events" },
  6: { live: 6, remaining: "31:20", next: "Closing Remarks" },
  7: { live: 7, remaining: "6:44", next: "Doors and Walk-in Music" },
};

/** The Controls column alone, built from the same components the real
 *  screen uses - components/operator/controls-panel.tsx (SectionLabel,
 *  Button, the "you have control" lease row) and components/display-
 *  engine/target-health-summary.tsx (the "N displays targeted" badge) -
 *  not a hand-rolled copy of their look. Fixed to the "held by me, 4
 *  displays online" state, since the replica has no real lock/registry. */
function ControlsColumn({
  onNext,
  onPrevious,
  onHold,
  held,
}: {
  onNext?: () => void;
  onPrevious?: () => void;
  onHold?: () => void;
  held: boolean;
}) {
  const interactive = Boolean(onNext || onPrevious || onHold);
  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-center gap-1.5">
        <SectionLabel>Controls</SectionLabel>
        <span className="text-muted-2 rounded-control p-1">
          <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>

      <div className="flex items-center gap-2.5 rounded-control border border-status-green/25 bg-status-green/6 px-3 py-2.5">
        <Lock className="h-4 w-4 text-status-green shrink-0" strokeWidth={2} />
        <p className="text-console-sm font-medium text-status-green flex-1 min-w-0">You have control</p>
        <span className="text-console-meta text-muted-2">Release</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-console-sm text-primary font-medium">4 displays targeted</span>
        <Badge tone="green" dot>
          4 online
        </Badge>
      </div>

      <div className="flex flex-col gap-3 mt-2">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!interactive || held}
          onClick={onNext}
        >
          Next
          <ChevronRight className="h-5 w-5" strokeWidth={2} />
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="md" className="flex-1" disabled={!interactive || held} onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            Previous
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="flex-1"
            disabled={!interactive}
            onClick={onHold}
            aria-label={held ? "Resume" : "Hold"}
          >
            {held ? <Play className="h-4 w-4" strokeWidth={2} /> : <Pause className="h-4 w-4" strokeWidth={2} />}
            {held ? "Resume" : "Hold"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ConsoleReplica({
  cue,
  label,
  onNext,
  onPrevious,
  onHold,
  held = false,
  controlsOnly = false,
}: {
  cue: Cue;
  label: string;
  /** Optional - when provided, Next/Previous/Hold render as real buttons instead
   *  of the static sample chrome every other call site still gets by default. */
  onNext?: () => void;
  onPrevious?: () => void;
  onHold?: () => void;
  held?: boolean;
  /** Renders just the Controls column as its own narrow card, instead of the
   *  full three-column console. */
  controlsOnly?: boolean;
}) {
  const s = CUE_STATE[cue];
  const liveTitle = PROGRAM[s.live - 1].title;
  const liveOwner = PROGRAM[s.live - 1].owner;

  if (controlsOnly) {
    return (
      <FitFrame designWidth={360} designHeight={300} label={label}>
        <ControlsColumn onNext={onNext} onPrevious={onPrevious} onHold={onHold} held={held} />
      </FitFrame>
    );
  }

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
                    <span className="block text-[11px] text-muted-2">{it.owner || " "}</span>
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
          <div className="mt-3 text-[12px] text-status-orange">{cue === 4 || cue === 7 ? "1m behind schedule" : "On time"}</div>
          <div className="tnum mt-10 text-[64px] leading-none text-primary">{s.remaining}</div>
          <div className="mt-3 h-[4px] w-full rounded bg-line-soft">
            <div className="h-full rounded bg-status-green" style={{ width: `${Math.round((cue / 7) * 100)}%` }} />
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
            <span className="text-muted">{PROGRAM[cue % 7].title}</span>
          </div>
        </div>

        {/* controls */}
        <ControlsColumn onNext={onNext} onPrevious={onPrevious} onHold={onHold} held={held} />
      </div>
    </FitFrame>
  );
}

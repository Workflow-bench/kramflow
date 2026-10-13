import { FitFrame } from "./fit-frame";
import type { ShotKey } from "../product-shot";

/**
 * Code replicas of the four built-in venue displays, laid out from the product's display
 * clients (presenter, av, green-room, general) and driven by the same fixture show as the
 * console replica. Each takes a cue (3 = before, 4 = after) and renders that cue's state.
 * They are samples for the landing page: no store, no token, no network.
 */

export type Cue = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Kept in step with PROGRAM/CUE_STATE in console-replica.tsx - same fixture show,
 *  same seven items, `next` cycling from 7 back to 1. */
const DATA: Record<Cue, { title: string; owner: string; clock: string; next: string; nextOwner: string; onDeck: string }> = {
  1: { title: "Doors and Walk-in Music", owner: "AV", clock: "28:40", next: "Welcome and Housekeeping", nextOwner: "Stage Manager", onDeck: "Opening Keynote" },
  2: { title: "Welcome and Housekeeping", owner: "Stage Manager", clock: "3:12", next: "Opening Keynote", nextOwner: "Amara Osei", onDeck: "Product Launch Demo" },
  3: { title: "Opening Keynote", owner: "Amara Osei", clock: "20:40", next: "Product Launch Demo", nextOwner: "Rafael Costa", onDeck: "Coffee Break" },
  4: { title: "Product Launch Demo", owner: "Rafael Costa", clock: "13:51", next: "Coffee Break", nextOwner: "", onDeck: "Panel: Scaling Live Events" },
  5: { title: "Coffee Break", owner: "", clock: "9:05", next: "Panel: Scaling Live Events", nextOwner: "Moderator", onDeck: "Closing Remarks" },
  6: { title: "Panel: Scaling Live Events", owner: "Moderator", clock: "31:20", next: "Closing Remarks", nextOwner: "Amara Osei", onDeck: "Doors and Walk-in Music" },
  7: { title: "Closing Remarks", owner: "Amara Osei", clock: "6:44", next: "Doors and Walk-in Music", nextOwner: "AV", onDeck: "Welcome and Housekeeping" },
};

const W = 960;
const H = 540;

function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 border-t border-line-soft bg-card/70 px-8 py-4 text-[16px] text-primary">
      {children}
    </div>
  );
}

export function PresenterReplica({
  cue,
  label,
  clockOverride,
}: {
  cue: Cue;
  label: string;
  /** Live ticking seconds, formatted - overrides the fixture's static clock
   *  so the displays read as a running show instead of a frozen sample. */
  clockOverride?: string;
}) {
  const d = DATA[cue];
  return (
    <FitFrame designWidth={W} designHeight={H} label={label} className="bg-black">
      <div className="absolute inset-0 px-10 pt-8 text-primary">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted-2">
          <span>Northwind Summit 2026 · Day 1 Morning</span>
          <span className="text-status-green">Live</span>
        </div>
        <div className="tnum mt-6 text-center text-[150px] leading-none text-status-green">{clockOverride ?? d.clock}</div>
        <div className="mt-2 text-center text-[11px] uppercase tracking-[0.2em] text-muted-2">Remaining</div>
        <div className="mt-6 text-center text-[34px]">{d.title}</div>
        <div className="mt-1 text-center text-[16px] text-muted">{d.owner}</div>
        <div className="mt-6 text-center text-[11px] uppercase tracking-[0.2em] text-muted-2">Next</div>
        <div className="mt-1 text-center text-[18px]">{d.next}</div>
        <Strip>
          <span className="text-status-blue">ⓘ</span>
          <span className="font-medium">Wi-Fi</span>
          <span className="text-muted">Guest network: Northwind-Summit · password in your badge holder.</span>
        </Strip>
      </div>
    </FitFrame>
  );
}

export function AVReplica({
  cue,
  label,
  clockOverride,
}: {
  cue: Cue;
  label: string;
  clockOverride?: string;
}) {
  const d = DATA[cue];
  const reqs = cue === 3
    ? [["Microphone / Track", "Mic"], ["Video / Presentation", "Slides + Backdrop"], ["Lighting", "Half Half · Stage Wash"], ["Curtains", "Open"]]
    : [["Microphone / Track", "Mic"], ["Video / Presentation", "Slides + Laptop feed"], ["Lighting", "Front wash"], ["Curtains", "Closed"]];
  return (
    <FitFrame designWidth={W} designHeight={H} label={label} className="bg-black">
      <div className="absolute inset-0 px-10 pt-8 text-primary">
        <div className="flex items-center justify-between">
          <span className="text-[24px]">AV Waiting Room</span>
          <span className="tnum text-[18px] text-muted">{cue === 3 ? "11:50 AM" : "11:55 AM"}</span>
        </div>
        <div className="mt-8 text-[11px] uppercase tracking-[0.18em] text-muted-2">Current cue</div>
        <div className="mt-1 text-[40px]">{d.title}</div>
        <div className="tnum mt-2 text-[28px] text-status-green">{clockOverride ?? d.clock} <span className="text-[11px] uppercase tracking-[0.16em] text-muted-2">cue countdown</span></div>
        <div className="mt-8 text-[11px] uppercase tracking-[0.18em] text-muted-2">Prep requirements · {d.title}</div>
        <div className="mt-3 divide-y divide-line-soft">
          {reqs.map(([k, v]) => (
            <div key={k} className="flex justify-between py-2.5 text-[16px]">
              <span className="text-muted">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
        <div className="absolute right-10 top-28 w-[300px] rounded-control border border-line-soft bg-card p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-2">Next · Please prepare</div>
          <div className="mt-2 text-[17px]">{d.next}</div>
          <div className="text-[13px] text-muted">{d.nextOwner || "Crew"}</div>
          <div className="mt-4 text-[11px] uppercase tracking-[0.16em] text-muted-2">On deck</div>
          <div className="text-[14px] text-muted">{d.onDeck}</div>
        </div>
        <Strip>
          <span className="text-status-blue">ⓘ</span>
          <span className="font-medium">Wi-Fi</span>
          <span className="text-muted">Guest network: Northwind-Summit · password in your badge holder.</span>
        </Strip>
      </div>
    </FitFrame>
  );
}

export function GreenRoomReplica({
  cue,
  label,
  clockOverride,
}: {
  cue: Cue;
  label: string;
  clockOverride?: string;
}) {
  const d = DATA[cue];
  return (
    <FitFrame designWidth={W} designHeight={H} label={label} className="bg-black">
      <div className="absolute inset-0 px-10 pt-8 text-primary">
        <div className="flex items-center justify-between">
          <span className="text-[24px]">Speaker Ready</span>
          <span className="tnum text-[18px] text-muted">{cue === 3 ? "11:51 AM" : "12:10 PM"}</span>
        </div>
        <div className="mt-8 text-[11px] uppercase tracking-[0.18em] text-muted-2">On stage now</div>
        <div className="mt-1 text-[46px] leading-tight">{d.title}</div>
        <div className="text-[18px] text-muted">{d.owner}</div>
        <div className="tnum mt-4 text-[32px] text-status-green">{clockOverride ?? d.clock}</div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-2">Remaining, counting down until called</div>
        <div className="absolute right-10 top-28 w-[300px] rounded-control border border-status-orange/30 bg-status-orange/10 p-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-2">Next · Please prepare</div>
          <div className="mt-2 text-[17px]">{d.next}</div>
          <div className="text-[13px] text-muted">{d.nextOwner || "Crew"}</div>
        </div>
        <Strip>
          <span className="text-status-blue">ⓘ</span>
          <span className="font-medium">Wi-Fi</span>
          <span className="text-muted">Guest network: Northwind-Summit · password in your badge holder.</span>
        </Strip>
      </div>
    </FitFrame>
  );
}

export function GeneralReplica({ cue, label }: { cue: Cue; label: string }) {
  const d = DATA[cue];
  return (
    <FitFrame designWidth={W} designHeight={H} label={label} className="bg-black">
      <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center text-primary">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-2">Now in session · Northwind Summit 2026</div>
        <div className="mt-6 text-[64px] leading-tight">{d.title}</div>
        <div className="mt-2 text-[22px] text-muted">{d.owner}</div>
        <div className="mt-12 flex gap-14 text-left">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">Next</div>
            <div className="mt-1 text-[20px]">{d.next}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-2">Venue</div>
            <div className="mt-1 text-[20px]">Main Auditorium</div>
          </div>
        </div>
      </div>
    </FitFrame>
  );
}

/** Maps a shot key to the replica that stands in for it, for the scene's screen order. */
export const DISPLAY_REPLICA: Record<"presenter" | "av" | "green-room" | "general", typeof PresenterReplica> = {
  presenter: PresenterReplica,
  av: AVReplica,
  "green-room": GreenRoomReplica,
  general: GeneralReplica,
};

export type { ShotKey };

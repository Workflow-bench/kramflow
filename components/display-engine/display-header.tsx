import type { Session } from "@/lib/types";
import { StageStatusPill, type StageStatus } from "./stage-status-pill";

// The day/session label + clock + status-pill header block was
// line-for-line identical between AV and Green Room's display clients
// (only the static title string differed) — already accumulated
// independent CSS patches for what is visually the same header (see the
// justify-start fix in green-room's git history), which had no way to
// reach AV's copy and vice versa. General and Presenter still hand-rolled
// their own near-identical copies rather than using this — folded in now
// (2026-09 Public Displays pass) along with two real content gaps neither
// side had: an account-level event name (previously nowhere on any of the
// four displays — only General's optional per-session title existed) and
// the registered display's own name/room (existed in the data model via
// useRegisterDisplay, never rendered back to the screen itself). Both
// answer questions a venue technician or wandering attendee actually asks:
// "what event is this" and "which physical screen am I looking at."
export function DisplayHeader({
  title,
  eventName,
  displayName,
  room,
  session,
  clockLabel,
  stageStatus,
}: {
  /** Route/type label, e.g. "AV Waiting Room". Omit for a display (General)
   *  whose body content already carries the identity, to keep the header
   *  from competing with it — Stage density stays reduced by choice, not
   *  by accident. */
  title?: string;
  eventName: string | null;
  /** This display's own registered name, e.g. "AV Waiting Room — Left". */
  displayName?: string | null;
  room?: string | null;
  session: Session | null | undefined;
  clockLabel: string;
  stageStatus: StageStatus;
}) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-y-3">
      <div className="min-w-0">
        <p className="text-caption uppercase tracking-wide text-muted-2 truncate">
          {eventName ?? "Kramflow"}
          {session && ` · ${session.dayLabel} • ${session.sessionLabel}`}
        </p>
        {title && (
          <p className="text-title text-primary mt-1 flex items-baseline gap-3 flex-wrap">
            {title}
            {(room || displayName) && (
              <span className="text-body text-muted-2 font-normal">{room ?? displayName}</span>
            )}
          </p>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className="text-hero tabular-nums text-muted" style={{ fontSize: "clamp(2rem, 3vw, 3rem)" }}>
          {clockLabel}
        </span>
        <StageStatusPill status={stageStatus} />
      </div>
    </div>
  );
}

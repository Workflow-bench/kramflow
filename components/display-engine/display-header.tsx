import type { Session } from "@/lib/types";
import { StageStatusPill, type StageStatus } from "./stage-status-pill";

// The day/session label + clock + status-pill header block was
// line-for-line identical between AV and Green Room's display clients
// (only the static title string differed) — already accumulated
// independent CSS patches for what is visually the same header (see the
// justify-start fix in green-room's git history), which had no way to
// reach AV's copy and vice versa.
export function DisplayHeader({
  title,
  session,
  clockLabel,
  stageStatus,
}: {
  title: string;
  session: Session | null | undefined;
  clockLabel: string;
  stageStatus: StageStatus;
}) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-y-3">
      <div>
        <p className="text-caption uppercase tracking-wide text-muted-2">
          {session ? `${session.dayLabel} • ${session.sessionLabel}` : "KramFlow"}
        </p>
        <p className="text-title text-primary mt-1">{title}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-hero tabular-nums text-muted" style={{ fontSize: "clamp(2rem, 3vw, 3rem)" }}>
          {clockLabel}
        </span>
        <StageStatusPill status={stageStatus} />
      </div>
    </div>
  );
}

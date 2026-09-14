import type { Program } from "@/lib/types";
import type { ViewingDistance } from "@/lib/display-engine/types";
import { cn } from "@/lib/utils";

/**
 * The "Now Playing" widget — current item, presenter, and a live
 * countdown. Reuses the exact same timer/color values the fixed AV/Green
 * Room/Presenter displays already compute (deriveAutoTimerInput +
 * useDisplayTimer + TIMER_COLORS) rather than a second, simplified
 * countdown implementation — this is the one widget where "distance
 * dictates fidelity" (the case study's own principle) matters most, so it
 * gets the same type-scale treatment those fixed displays hand-tune.
 */
export function NowPlayingWidget({
  live,
  isFinished,
  timerLabel,
  timerColor,
  isOverrun,
  viewingDistance,
}: {
  live: Program | null;
  isFinished: boolean;
  timerLabel: string | null;
  timerColor: string;
  isOverrun: boolean;
  viewingDistance: ViewingDistance;
}) {
  const close = viewingDistance === "close";
  return (
    <div className="flex flex-col justify-center h-full">
      <p className={cn("uppercase tracking-wide text-muted-2", close ? "text-caption" : "text-body")}>Now</p>
      <p
        className="text-primary mt-3 font-semibold"
        style={{ fontSize: close ? "clamp(1.75rem, 3vw, 2.5rem)" : "clamp(2.75rem, 5vw, 4.5rem)" }}
      >
        {live ? live.title : isFinished ? "Session Finished" : "Not Started"}
      </p>
      {live?.presenter && (
        <p className={cn("text-muted mt-2", close ? "text-body" : "text-subtitle")}>{live.presenter}</p>
      )}
      {!isFinished && timerLabel && (
        <p
          className="tabular-nums font-semibold leading-none mt-6"
          style={{ fontSize: close ? "clamp(2rem, 4vw, 3rem)" : "clamp(3rem, 6vw, 5rem)", color: timerColor }}
        >
          {isOverrun ? `+${timerLabel}` : timerLabel}
        </p>
      )}
    </div>
  );
}

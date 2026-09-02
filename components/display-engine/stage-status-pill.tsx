import { cn } from "@/lib/utils";

export type StageStatus = "LIVE" | "PAUSED" | "STANDBY" | "ON HOLD";

// Was hand-rolled independently in general/av/green-room/presenter's
// display clients — each with its own copy of this exact tone mapping,
// which had already started to drift (differing opacity values between
// copies). Not swapped for components/ui/badge.tsx's Badge: Badge's shape
// (rounded-chip, bordered, /12 opacity) is a deliberately different look
// from this pill (rounded-full, borderless, /15) — unifying visual style
// across the app is a design decision, not a bug fix, and out of scope
// here; this only removes the duplication while keeping what's actually
// on screen unchanged.
export function StageStatusPill({ status, className }: { status: StageStatus; className?: string }) {
  return (
    <span
      className={cn(
        "text-caption font-semibold uppercase tracking-wide px-3 py-1 rounded-full",
        status === "LIVE" && "bg-status-green/15 text-status-green",
        (status === "PAUSED" || status === "ON HOLD") && "bg-status-orange/15 text-status-orange",
        status === "STANDBY" && "bg-white/5 text-muted-2",
        className
      )}
    >
      {status}
    </span>
  );
}

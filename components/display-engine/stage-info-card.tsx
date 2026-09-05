import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The plain "label + content" card shape — On Deck (AV/Green Room/General),
// Venue (General), Props (Green Room) — was hand-copied identically
// (rounded-card bg-card/50, caption label, body content) across all four
// display clients. One structural wrapper here; each caller still owns its
// own content markup.
export function StageInfoCard({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-card bg-card/50 px-6 py-5", className)}>
      <p className="text-caption uppercase tracking-wide text-muted-2">{label}</p>
      {children}
    </div>
  );
}

import type { Program } from "@/lib/types";
import { StageNextCard } from "@/components/display-engine/stage-next-card";

/** Thin adapter over the existing StageNextCard primitive (already shared
 *  by AV/Green Room) — the widget catalog composes real, validated pieces
 *  instead of a parallel "custom-only" reimplementation. */
export function UpNextWidget({ next }: { next: Program | null }) {
  if (!next) {
    return <p className="text-body text-muted-2">Nothing scheduled next.</p>;
  }
  return <StageNextCard item={next} />;
}

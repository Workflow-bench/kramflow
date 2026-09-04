"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Moved from components/tv/ (Stage-only namespace) to components/ui/ —
// despite the old location, every real consumer is a Console surface
// (Live Details, Remote); no display route ever imported this. Type-scale
// neutral on its own (no text at all), so the move is a Console/Stage
// boundary closure, not a behavior change.
export function ProgressBar({
  fraction,
  tone = "green",
}: {
  fraction: number;
  tone?: "green" | "orange" | "red";
}) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <div className="h-2 w-full rounded-full bg-card overflow-hidden">
      <motion.div
        className={cn(
          "h-full rounded-full",
          tone === "green" && "bg-status-green",
          tone === "orange" && "bg-status-orange",
          tone === "red" && "bg-status-red"
        )}
        initial={false}
        animate={{ width: `${clamped * 100}%` }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      />
    </div>
  );
}

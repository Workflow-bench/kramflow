"use client";

import { COLOR_TAGS } from "@/lib/color-tags";
import { cn } from "@/lib/utils";

const swatch: Record<string, string> = {
  green: "bg-status-green",
  blue: "bg-status-blue",
  orange: "bg-status-orange",
  red: "bg-status-red",
};

const selectedRing: Record<string, string> = {
  green: "border-status-green/50 bg-status-green/12 text-status-green",
  blue: "border-status-blue/50 bg-status-blue/12 text-status-blue",
  orange: "border-status-orange/50 bg-status-orange/12 text-status-orange",
  red: "border-status-red/50 bg-status-red/12 text-status-red",
};

// Swatch picker for programs.color_tag. Every option carries a dot *and* a
// word — colour alone never conveys meaning, which matters twice over here:
// once for colourblindness, and once because these get read off a washed-out
// venue monitor under stage lighting.
export function ColorTagPicker({
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  "aria-label"?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel ?? "Color tag"} className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        onClick={() => onChange(null)}
        className={cn(
          "flex items-center gap-1.5 rounded-chip border px-2.5 py-1.5 text-console-meta cursor-pointer",
          "transition-[background-color,border-color,color] duration-[110ms] ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          value === null
            ? "border-white/25 bg-raised text-primary"
            : "border-line text-muted-2 hover:border-white/20 hover:text-muted"
        )}
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full border border-muted-2" />
        None
      </button>

      {COLOR_TAGS.map((tag) => (
        <button
          key={tag.value}
          type="button"
          role="radio"
          aria-checked={value === tag.value}
          onClick={() => onChange(tag.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-chip border px-2.5 py-1.5 text-console-meta cursor-pointer",
            "transition-[background-color,border-color,color] duration-[110ms] ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            value === tag.value
              ? selectedRing[tag.tone]
              : "border-line text-muted-2 hover:border-white/20 hover:text-muted"
          )}
        >
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full shrink-0", swatch[tag.tone])} />
          {tag.label}
        </button>
      ))}
    </div>
  );
}

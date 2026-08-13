import { cn } from "@/lib/utils";

type Tone = "green" | "blue" | "orange" | "red" | "accent" | "muted";

// Tinted fill + matching text + a faint border of the same hue. A dot is
// available for anywhere the badge carries status rather than a count —
// colour alone never conveys meaning, so status badges pair the hue with
// both a dot and a word.
export function Badge({
  tone = "muted",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip px-2 py-0.5 text-console-label font-semibold uppercase tracking-wide",
        tone === "green" && "bg-status-green/12 text-status-green border border-status-green/25",
        tone === "blue" && "bg-status-blue/12 text-status-blue border border-status-blue/25",
        tone === "orange" && "bg-status-orange/12 text-status-orange border border-status-orange/25",
        tone === "red" && "bg-status-red/12 text-status-red border border-status-red/25",
        tone === "accent" && "bg-accent/12 text-accent border border-accent/25",
        tone === "muted" && "bg-raised text-muted border border-line",
        className
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            tone === "green" && "bg-status-green",
            tone === "blue" && "bg-status-blue",
            tone === "orange" && "bg-status-orange",
            tone === "red" && "bg-status-red",
            tone === "accent" && "bg-accent",
            tone === "muted" && "bg-muted-2"
          )}
        />
      )}
      {children}
    </span>
  );
}

import { cn } from "@/lib/utils";

// Canonical checkbox — Broadcast Center hand-rolled this three times over
// (acknowledgement, persistent, schedule-for-later) with its own inline
// className string; this is the one implementation every checkbox in the
// product should use, matching Input/Select/Textarea's own focus-ring and
// disabled treatment rather than each caller redefining it.
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  // Cue Sheet's row-selection checkbox needs the accessible name without
  // spending row width on visible text (the row already reads "select"
  // from context) — same "sr-only, not absent" a11y treatment the color-
  // tag dot uses, rather than a second, label-less checkbox implementation.
  hideLabel,
  className,
  onClick,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  hideLabel?: boolean;
  className?: string;
  /** Raw onClick passthrough — Cue Sheet's row checkbox needs it to capture
   *  shiftKey for range-select (onChange events carry no modifier keys),
   *  without preventDefault-ing the click itself (see that call site's own
   *  comment on the real-checkbox-state bug preventDefault causes here). */
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={cn("flex items-center gap-2", disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer", className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onClick={onClick}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded-control border-line bg-background accent-accent cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
      <span className={cn("text-console-sm text-muted", hideLabel && "sr-only")}>{label}</span>
    </label>
  );
}

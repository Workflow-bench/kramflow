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
  className,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("flex items-center gap-2", disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer", className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded-control border-line bg-background accent-accent cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
      <span className="text-console-sm text-muted">{label}</span>
    </label>
  );
}

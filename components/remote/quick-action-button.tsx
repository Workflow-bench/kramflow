import { cn } from "@/lib/utils";

// Not a Button variant — an icon-above-label toggle chip is a different
// layout, not a different flavor of the same button, so it stays its own
// small component. It still pulls radius and focus-ring from the same
// tokens Button uses (rounded-card, ring-accent) rather than the
// independently-authored rounded-2xl/ring-white/40 it had before.
export function QuickActionButton({
  icon: Icon,
  label,
  active,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "flex-1 flex flex-col items-center justify-center gap-2 rounded-card py-4 transition-colors active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        active ? "bg-card text-primary" : "bg-card/50 text-muted"
      )}
      {...props}
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
      <span className="text-caption font-medium">{label}</span>
    </button>
  );
}

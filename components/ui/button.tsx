import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

// `loading` exists because it didn't: four call sites each hand-rolled their
// own busy convention ("Posting…", "Sending…", "Saving…") because there was
// nothing shared to reach for. A spinner next to the unchanged label avoids
// needing a verb-form per call site at all — the label stays put, so the
// button doesn't reflow, and `loading` implies `disabled` so it also closes
// the double-submit gap for free.
//
// sm/md are Console sizes. lg/xl stay large for the Remote and TV surfaces,
// where the target is a thumb at arm's length rather than a cursor.
export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }
>(function Button({ variant = "secondary", size = "md", loading = false, disabled, className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium cursor-pointer",
        "transition-[background-color,border-color,color] duration-[140ms] ease-out",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        size === "sm" && "h-8 px-3 text-console-meta rounded-control",
        size === "md" && "h-9 px-3.5 text-console-sm rounded-control",
        size === "lg" && "h-14 px-6 text-lg rounded-xl",
        size === "xl" && "h-20 px-8 text-xl rounded-2xl",
        variant === "primary" && "bg-primary text-background hover:bg-white",
        variant === "secondary" && "bg-raised text-primary border border-line hover:bg-card-hover hover:border-white/20",
        variant === "ghost" && "text-muted hover:text-primary hover:bg-card-hover",
        // Destructive never gets a solid fill — a solid red button reads as
        // the primary action on a surface whose primary action it never is.
        variant === "danger" && "bg-status-red/12 text-status-red border border-status-red/25 hover:bg-status-red/20",
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
      {children}
    </button>
  );
});

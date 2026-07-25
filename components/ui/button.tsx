import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

// `loading` exists because it didn't: four call sites this session each
// hand-rolled their own busy convention ("Posting…", "Sending…", "Saving…",
// "Jumping…") because there was nothing shared to reach for. A spinner next
// to the unchanged label avoids needing a verb-form per call site at all —
// the label stays put, so the button doesn't reflow, and `loading` implies
// `disabled` so it also close the double-submit gap for free.
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
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        size === "md" && "h-10 px-4 text-[15px]",
        size === "sm" && "h-8 px-3 text-sm",
        size === "lg" && "h-14 px-6 text-lg rounded-xl",
        size === "xl" && "h-20 px-8 text-xl rounded-2xl",
        variant === "primary" && "bg-primary text-background hover:bg-white/90",
        variant === "secondary" &&
          "bg-card text-primary hover:bg-card-hover border border-white/10",
        variant === "ghost" && "text-muted hover:text-primary hover:bg-card",
        variant === "danger" && "bg-status-red/15 text-status-red hover:bg-status-red/25",
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
      {children}
    </button>
  );
});

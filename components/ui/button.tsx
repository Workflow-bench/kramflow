import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "warning" | "danger" | "danger-minor" | "danger-solid";
type Size = "sm" | "md" | "lg" | "xl";

// `loading` exists because it didn't: four call sites each hand-rolled their
// own busy convention ("Posting…", "Sending…", "Saving…") because there was
// nothing shared to reach for. A spinner next to the unchanged label avoids
// needing a verb-form per call site at all — the label stays put, so the
// button doesn't reflow, and `loading` implies `disabled` so it also closes
// the double-submit gap for free.
//
// `square` collapses horizontal padding to a fixed icon-only footprint at
// the current size — added so the app's many hand-rolled icon buttons
// (transport controls, close buttons, row actions) have one place to render
// through instead of each re-deriving h-8/w-8-style dimensions.
//
// sm/md are Console sizes. lg/xl stay large for the Remote and TV surfaces,
// where the target is a thumb at arm's length rather than a cursor.
export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; square?: boolean }
>(function Button(
  { variant = "secondary", size = "md", loading = false, square = false, disabled, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium cursor-pointer",
        "transition-[background-color,border-color,color,transform] duration-[110ms] ease-out active:scale-[0.98]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        size === "sm" && (square ? "h-8 w-8 rounded-control" : "h-8 px-3 text-console-meta rounded-control"),
        size === "md" && (square ? "h-9 w-9 rounded-control" : "h-9 px-3.5 text-console-sm rounded-control"),
        size === "lg" && (square ? "h-14 w-14 rounded-card" : "h-14 px-6 text-lg rounded-card"),
        size === "xl" && (square ? "h-20 w-20 rounded-card" : "h-20 px-8 text-xl rounded-card"),
        variant === "primary" && "bg-primary text-background hover:bg-white",
        variant === "secondary" && "bg-raised text-primary border border-line hover:bg-card-hover hover:border-white/20",
        variant === "ghost" && "text-muted hover:text-primary hover:bg-card-hover",
        variant === "warning" && "bg-status-orange/15 text-status-orange border border-status-orange/30 hover:bg-status-orange/25",
        // Guardrail-weight escalates through commitment on one hue (alert
        // red), not through a spreading family of danger colors — see
        // docs/DESIGN.md's guardrail-tier table. Three steps, low to high:
        //   danger-minor — tier 1, text only. Low blast radius, easily
        //     undone (e.g. revoking a share link — a new one is one click
        //     away).
        //   danger — tier 2/3, outlined/translucent. The default destructive
        //     button; still never a solid fill, since that would read as
        //     this surface's primary action, which a delete never is.
        //   danger-solid — tier 4 only. Reserved for the single highest-
        //     consequence action in the product (deleting an entire event) —
        //     paired with a typed-confirmation field in ConfirmDialog, never
        //     used on its own.
        variant === "danger-minor" && "text-status-red hover:bg-status-red/10",
        variant === "danger" && "bg-status-red/12 text-status-red border border-status-red/25 hover:bg-status-red/20",
        variant === "danger-solid" && "bg-status-red text-white hover:bg-status-red/90",
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
      {children}
    </button>
  );
});

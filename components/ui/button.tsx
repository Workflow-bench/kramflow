import { forwardRef } from "react";
import NextLink from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "warning" | "danger" | "danger-minor" | "danger-solid";
type Size = "sm" | "md" | "lg" | "xl";

// Shared with LinkButton below so the two never drift into two different
// "button-shaped thing" visual languages — see that component's own comment
// for why it exists as a second component instead of a variant prop.
function buttonClasses({
  variant = "secondary",
  size = "md",
  square = false,
  disabled = false,
  className,
}: {
  variant?: Variant;
  size?: Size;
  square?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-medium cursor-pointer",
    "transition-[background-color,border-color,color,transform] duration-[110ms] ease-out active:scale-[0.98]",
    disabled && "opacity-40 cursor-not-allowed active:scale-100 pointer-events-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    // min-h/min-w, not a size bump — a real button on a touchscreen (not
    // just a narrow viewport: [pointer:coarse] targets the input method,
    // so a touch-capable laptop with a mouse attached is unaffected, and a
    // narrow-viewport desktop browser window never triggers this either)
    // grows to a genuine ~44px minimum instead of an invisible hit-area
    // trick layered over the same small box. min-height/min-width only
    // raise the floor — they never shrink a size that's already bigger
    // (lg/xl stay untouched), and height-only growth can't cause the
    // horizontal-overlap risk a same-direction hit-area expansion would
    // for tightly-packed groups like EventNav's four nav pills (only
    // width would risk that, and every sm/md button already clears 44px
    // of width once its icon+label/padding are accounted for, except the
    // icon-only `square` case, which is exactly why square gets the
    // min-width too). 2026-09 convergence sprint, Workstream 6 — measured
    // real controls at 32-38px tall before this existed.
    size === "sm" &&
      (square
        ? "h-8 w-8 rounded-control [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
        : "h-8 px-3 text-console-meta rounded-control [@media(pointer:coarse)]:min-h-11"),
    size === "md" &&
      (square
        ? "h-9 w-9 rounded-control [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
        : "h-9 px-3.5 text-console-sm rounded-control [@media(pointer:coarse)]:min-h-11"),
    size === "lg" && (square ? "h-14 w-14 rounded-card" : "h-14 px-6 text-lg rounded-card"),
    size === "xl" && (square ? "h-20 w-20 rounded-card" : "h-20 px-8 text-xl rounded-card"),
    variant === "primary" && "bg-primary text-background hover:bg-white",
    variant === "secondary" && "bg-raised text-primary border border-line hover:bg-card-hover hover:border-white/20",
    variant === "ghost" && "text-muted hover:text-primary hover:bg-card-hover",
    variant === "warning" && "bg-status-orange/15 text-status-orange border border-status-orange/30 hover:bg-status-orange/25",
    // Guardrail-weight escalates through commitment on one hue (alert red),
    // not through a spreading family of danger colors — see docs/DESIGN.md's
    // guardrail-tier table. Three steps, low to high:
    //   danger-minor — tier 1, text only. Low blast radius, easily undone
    //     (e.g. revoking a share link — a new one is one click away).
    //   danger — tier 2/3, outlined/translucent. The default destructive
    //     button; still never a solid fill, since that would read as this
    //     surface's primary action, which a delete never is.
    //   danger-solid — tier 4 only. Reserved for the single highest-
    //     consequence action in the product (deleting an entire event) —
    //     paired with a typed-confirmation field in ConfirmDialog, never
    //     used on its own.
    variant === "danger-minor" && "text-status-red hover:bg-status-red/10",
    variant === "danger" && "bg-status-red/12 text-status-red border border-status-red/25 hover:bg-status-red/20",
    variant === "danger-solid" && "bg-status-red text-white hover:bg-status-red/90",
    className
  );
}

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
      className={buttonClasses({ variant, size, square, disabled: disabled || loading, className })}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
      {children}
    </button>
  );
});

// A button-shaped *navigation* control renders as one real `<a>`, never a
// `<button>` nested inside `next/link`'s anchor — that composition
// (`<Link><Button>…</Button></Link>`, previously repeated across every
// header/nav/CTA in the app) produces two overlapping interactive elements
// in the accessibility tree and unreliable focus/activation behavior (see
// the 2026-09-01 UI/UX audit, P1 finding #4 and P0 finding #1's contributing
// cause). Same visual language as Button via the shared buttonClasses()
// helper — this is a second component, not a Button prop, because a link
// and a button have genuinely different semantics/props (`href` vs
// `onClick`/`type`/`disabled`) and forcing them through one prop surface is
// what produced the nesting workaround in the first place.
export const LinkButton = forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<typeof NextLink> & { variant?: Variant; size?: Size; square?: boolean }
>(function LinkButton({ variant = "secondary", size = "md", square = false, className, children, ...props }, ref) {
  return (
    <NextLink ref={ref} className={buttonClasses({ variant, size, square, className })} {...props}>
      {children}
    </NextLink>
  );
});

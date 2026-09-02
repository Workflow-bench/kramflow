import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Thin wrapper over the app's one Button component at its "xl" (Remote/TV,
// thumb-at-arm's-length) size — this used to be its own hand-rolled button
// with a second variant system and its own focus-ring color, which is
// exactly the "buttons in different styles instead of variants of one
// component" pattern the design-consistency pass set out to remove. Kept as
// a named wrapper (rather than inlining Button at every Remote call site)
// to narrow Button's fuller variant set (which also includes "ghost",
// "danger-minor", "danger-solid") down to the four Remote actually uses —
// "danger" here is Button's outlined tier, not its solid one, since
// Remote's own destructive actions (finish, discard) are reversible enough
// not to warrant the highest guardrail tier.
export function BigActionButton({
  variant = "primary",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "warning" | "danger";
}) {
  return (
    <Button variant={variant} size="xl" className={cn("w-full text-2xl", className)} {...props}>
      {children}
    </Button>
  );
}

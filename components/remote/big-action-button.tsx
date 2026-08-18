import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Thin wrapper over the app's one Button component at its "xl" (Remote/TV,
// thumb-at-arm's-length) size — this used to be its own hand-rolled button
// with a second variant system and its own focus-ring color, which is
// exactly the "buttons in different styles instead of variants of one
// component" pattern the design-consistency pass set out to remove. Kept as
// a named wrapper (rather than inlining Button at every Remote call site)
// only because "danger" here maps to Button's outlined danger tier, not its
// solid one — Remote's own destructive actions (finish, discard) are
// reversible enough not to warrant the highest guardrail tier.
const VARIANT_MAP = {
  primary: "primary",
  secondary: "secondary",
  warning: "warning",
  danger: "danger",
} as const;

export function BigActionButton({
  variant = "primary",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "warning" | "danger";
}) {
  return (
    <Button variant={VARIANT_MAP[variant]} size="xl" className={cn("w-full text-2xl", className)} {...props}>
      {children}
    </Button>
  );
}

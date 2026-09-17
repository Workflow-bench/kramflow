import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// The canonical answer to DESIGN.md's flagged gap: every surface previously
// hand-rolled its own "Loading…" treatment (a bare text string, no shared
// shape). Same anatomy as EmptyState (title/body, centered, dashed-border-
// free since this isn't a boundary case) so a surface can swap between the
// two without its layout shifting. Loader2 + animate-spin matches Button's
// own `loading` prop — one spinner vocabulary, not two.
export function LoadingState({
  title = "Loading…",
  body,
  className,
}: {
  title?: string;
  body?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center text-center gap-2 rounded-panel px-6 py-12", className)}
    >
      <Loader2 className="h-5 w-5 text-muted-2 animate-spin" strokeWidth={2} aria-hidden="true" />
      <p className="text-console-sm font-medium text-primary mt-1">{title}</p>
      {body && <p className="text-console-meta text-muted-2 max-w-[42ch]">{body}</p>}
    </div>
  );
}

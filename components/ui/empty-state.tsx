import { cn } from "@/lib/utils";

// Empty states used to be a single grey sentence. An empty state is the one
// moment the interface has the user's full attention and nothing to compete
// with, so it says what's true, why, and what to do next — with the control
// to do it right there rather than sending them back to the header.
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center gap-2 rounded-panel border border-dashed border-line px-6 py-12",
        className
      )}
    >
      <p className="text-console-sm font-medium text-primary">{title}</p>
      {body && <p className="text-console-meta text-muted-2 max-w-[42ch]">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

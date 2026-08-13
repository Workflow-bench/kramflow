import { cn } from "@/lib/utils";

// Stage surface — TV routes, read at 5-15ft. 20px radius, generous padding.
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-card bg-card p-6", className)}
      {...props}
    />
  );
}

// Console surface — operator routes, read at 18-24in. Depth comes from the
// card → card-hover → raised ramp and a single hairline, never from a
// shadow stack or blur. Flat on purpose: an instrument, not a stack of paper.
export function Panel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-panel bg-card border border-line-soft", className)}
      {...props}
    />
  );
}

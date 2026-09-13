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

// Console surface — operator routes, read at 18-24in. kramflow-v3: real
// Liquid Glass material (.glass-panel — translucent + blurred + a specular
// inset highlight), the same treatment ControlsPanel/LiveDetailsPanel got
// directly. This is the shared primitive most Console pages actually build
// on (Broadcast, Displays, Cue Sheet, Dashboard, Settings, auth), so this
// one change is what carries the v3 material system to all of them rather
// than each page needing its own edit.
export function Panel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-panel glass-panel border border-line-soft", className)}
      {...props}
    />
  );
}

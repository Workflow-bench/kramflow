"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// One floating pill, two jobs.
//
// The selection bar used to sit inline between the header and the list, so
// ticking a single checkbox shoved all 244 rows down the page — the worst
// possible moment for the content under your cursor to move. Floating it
// removes the layout shift entirely, and since it occupies a fixed slot it
// can also carry drag feedback and confirmations, which means bulk-edit and
// transient messaging stop being two separate components in two positions.
//
// Rendered above the toast stack's own corner so the two never collide.
export function ActionBar({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none">
      <div
        role="toolbar"
        className={cn(
          "pointer-events-auto flex flex-wrap items-center gap-1 rounded-full",
          "bg-raised border border-line px-1.5 py-1.5",
          "shadow-[0_8px_28px_rgba(0,0,0,0.45)]",
          "motion-safe:animate-rise",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function ActionBarClear({ onClick, label = "Clear selection" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-full text-muted-2 cursor-pointer transition-colors duration-[140ms] ease-out hover:bg-card-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <X className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}

export function ActionBarCount({ n, children }: { n?: number; children: React.ReactNode }) {
  return (
    <span className="px-2 text-console-meta text-primary whitespace-nowrap">
      {n !== undefined && <span className="tnum font-semibold">{n}</span>}
      {n !== undefined && " "}
      {children}
    </span>
  );
}

export function ActionBarSeparator() {
  return <span aria-hidden="true" className="mx-1 h-4 w-px bg-line shrink-0" />;
}

export function ActionBarButton({
  tone = "default",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "danger" | "accent" }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full px-2.5 py-1.5 text-console-meta whitespace-nowrap cursor-pointer",
        "transition-colors duration-[140ms] ease-out",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        tone === "default" && "text-muted hover:bg-card-hover hover:text-primary",
        tone === "accent" && "text-accent hover:bg-accent/12",
        tone === "danger" && "text-status-red hover:bg-status-red/12",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

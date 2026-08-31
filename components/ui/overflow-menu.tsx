"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { useDismissOnOutsideOrEscape } from "@/lib/use-dismiss-on-outside-or-escape";

export interface OverflowMenuItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  target?: string;
}

// A generic low-frequency-actions menu — same shell/interaction pattern as
// components/dashboard/help-menu.tsx, generalized so any nav row can demote
// its rarely-used links into one "More" trigger instead of keeping them at
// permanent equal weight with whatever's actually used constantly. Hick's
// Law: every extra always-visible choice taxes the time to find the one
// you actually want, every time you glance at the row — reserved for
// genuinely low-frequency destinations, not a place to hide things that
// are just inconvenient to lay out.
export function OverflowMenu({ items, label = "More" }: { items: OverflowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useDismissOnOutsideOrEscape(rootRef, open, () => setOpen(false));

  return (
    <div ref={rootRef} className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
        {label}
      </Button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-30 mt-1.5 min-w-[11rem] rounded-panel bg-card border border-line shadow-float py-1",
            "motion-safe:animate-rise"
          )}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              target={item.target}
              rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-console-sm text-primary hover:bg-card-hover transition-colors"
            >
              <item.icon className="h-4 w-4 shrink-0 text-muted-2" strokeWidth={2} />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

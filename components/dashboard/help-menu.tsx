"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reopenGettingStarted } from "./getting-started-checklist";
import { cn } from "@/lib/utils";

// The one entry point back to onboarding once it's been dismissed or
// completed — nothing else in the app currently has a menu at all, so this
// stays a single-purpose popover rather than growing into a full account
// menu that isn't otherwise needed yet.
export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleReopen() {
    reopenGettingStarted();
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <Button variant="ghost" size="md" square onClick={() => setOpen((v) => !v)} aria-label="Help">
        <HelpCircle className="h-4.5 w-4.5" strokeWidth={2} />
      </Button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 z-30 mt-1.5 min-w-[12rem] rounded-panel bg-card border border-line shadow-float py-1",
            "motion-safe:animate-rise"
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleReopen}
            className="w-full text-left px-3 py-2 text-console-sm text-primary hover:bg-card-hover transition-colors cursor-pointer"
          >
            Getting started
          </button>
        </div>
      )}
    </div>
  );
}

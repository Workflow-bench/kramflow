"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSpreadsheet, LayoutDashboard, MonitorPlay, Settings as SettingsIcon, Smartphone } from "lucide-react";
import { useEventId } from "@/lib/event-context";
import { Button } from "@/components/ui/button";

type Destination = "console" | "cue-sheet" | "displays" | "settings";

// Broadcast Center lives under /e/[eventId]/broadcast, not /displays — it's
// still its own route (a live-composing surface, not a shallow sub-page),
// but navigationally it's part of "outputs I'm distributing," so it
// highlights the same tab as Displays rather than counting as a 5th
// destination. See kramflow_nav_layout_ground_up.md.
function destinationFor(pathname: string): Destination {
  if (pathname.includes("/operator/cue-sheet")) return "cue-sheet";
  if (pathname.includes("/displays") || pathname.includes("/broadcast")) return "displays";
  if (pathname.includes("/settings")) return "settings";
  return "console";
}

const TABS: { id: Destination; label: string; path: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: "console", label: "Console", path: "/operator", icon: LayoutDashboard },
  { id: "cue-sheet", label: "Cue Sheet", path: "/operator/cue-sheet", icon: FileSpreadsheet },
  { id: "displays", label: "Displays", path: "/displays", icon: MonitorPlay },
  { id: "settings", label: "Settings", path: "/settings", icon: SettingsIcon },
];

// The one shared top-level nav row for every in-event screen — Console,
// Cue Sheet, Displays, and Settings are peers reachable from any of them,
// not a hierarchy that funnels back through Console first. Same rounded-
// full tab-pill convention as Broadcast Center's own TabButton (variant
// flips primary/ghost on active) rather than inventing a second style.
// Remote sits just outside the pill group — a controller-adjacent surface
// (opens on a second device), not a peer content screen, so it reads as
// grouped-but-distinct rather than a fifth tab.
export function EventNav() {
  const eventId = useEventId();
  const pathname = usePathname();
  const active = destinationFor(pathname);

  return (
    <div className="flex items-center flex-wrap gap-2">
      <div
        className="flex items-center flex-wrap gap-1 rounded-full border border-line-soft bg-card/50 p-1"
        role="group"
        aria-label="Navigate"
      >
        {TABS.map((tab) => (
          <Link key={tab.id} href={`/e/${eventId}${tab.path}`}>
            <Button variant={active === tab.id ? "primary" : "ghost"} size="sm" className="rounded-full">
              <tab.icon className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">{tab.label}</span>
            </Button>
          </Link>
        ))}
      </div>
      <Link href={`/e/${eventId}/remote`} target="_blank" rel="noopener noreferrer">
        <Button variant="ghost" size="sm" aria-label="Remote" title="Remote — one-handed mobile control">
          <Smartphone className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden lg:inline">Remote</span>
        </Button>
      </Link>
    </div>
  );
}

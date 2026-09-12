"use client";

import { usePathname } from "next/navigation";
import { ChevronDown, FileSpreadsheet, Gauge, MonitorPlay, Settings as SettingsIcon, Smartphone } from "lucide-react";
import { useEventId } from "@/lib/event-context";
import { LinkButton } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

// Phase 7a: Console's icon was LayoutDashboard — a near-duplicate of
// Dashboard's own LayoutGrid (EventIdentity's "All events" link), and it
// read as "a dashboard" rather than "the live control surface." Gauge is
// unclaimed elsewhere in this exact vocabulary (unlike Radio/MonitorPlay/
// SlidersHorizontal, each already assigned) and reads as a control panel.
// See DESIGN.md's canonical destination-icon table — this is the one
// entry that changed; every other destination was already consistent.
const TABS: { id: Destination; label: string; path: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: "console", label: "Console", path: "/operator", icon: Gauge },
  { id: "cue-sheet", label: "Cue Sheet", path: "/operator/cue-sheet", icon: FileSpreadsheet },
  { id: "displays", label: "Displays", path: "/displays", icon: MonitorPlay },
  { id: "settings", label: "Settings", path: "/settings", icon: SettingsIcon },
];

// The one shared top-level nav row for every in-event screen — Console,
// Cue Sheet, Displays, and Settings are peers reachable from any of them,
// not a hierarchy that funnels back through Console first.
//
// Kramflow UI Shell v1 (Phase 4): two distinct renderings, not one markup
// shrunk with CSS. Below md: (real mobile, not "desktop nav with smaller
// icons") a single compact, fully-labeled trigger opens a Popover listing
// every destination by name — replacing the old behaviour of hiding each
// pill's text below sm: via `hidden sm:inline`, which meant a mobile
// operator saw four bare icons and had to guess. `display:none` content is
// also excluded from accessible-name computation, so that old markup
// resolved to zero accessible name below 640px despite carrying an
// aria-label — confirmed live during the 2026-09 convergence sprint. The
// new mobile trigger's label is always in the DOM, not display:none'd.
// md: and up keeps the pill group, labels always visible now (tablet is
// not "desktop with room to spare, so hide labels" — 834px has plenty of
// room for icon+label pills).
export function EventNav() {
  const eventId = useEventId();
  const pathname = usePathname();
  const active = destinationFor(pathname);
  const activeTab = TABS.find((t) => t.id === active) ?? TABS[0];

  return (
    <div className="flex items-center gap-2">
      <div
        className="hidden md:flex items-center flex-wrap gap-1 rounded-full border border-line-soft bg-card/50 p-1"
        role="group"
        aria-label="Navigate"
      >
        {TABS.map((tab) => (
          <LinkButton
            key={tab.id}
            href={`/e/${eventId}${tab.path}`}
            variant={active === tab.id ? "primary" : "ghost"}
            size="sm"
            className="rounded-full"
            aria-current={active === tab.id ? "page" : undefined}
          >
            <tab.icon className="h-3.5 w-3.5" strokeWidth={2} />
            <span>{tab.label}</span>
          </LinkButton>
        ))}
      </div>

      <div className="md:hidden">
        <Popover
          align="start"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-haspopup="true"
              aria-expanded={open}
              aria-label={`Navigate — currently ${activeTab.label}`}
              className="flex items-center gap-1.5 rounded-control border border-line-soft bg-card/50 px-2.5 py-1.5 text-console-sm text-primary hover:bg-card-hover transition-colors"
            >
              <activeTab.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span>{activeTab.label}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} strokeWidth={2} />
            </button>
          )}
        >
          <div className="min-w-[12rem]" role="menu" aria-label="Navigate">
            {TABS.map((tab) => (
              <LinkButton
                key={tab.id}
                href={`/e/${eventId}${tab.path}`}
                variant="ghost"
                size="sm"
                className={cn("w-full justify-start rounded-none px-3", active === tab.id && "bg-card-hover text-primary")}
                aria-current={active === tab.id ? "page" : undefined}
              >
                <tab.icon className="h-3.5 w-3.5" strokeWidth={2} />
                <span>{tab.label}</span>
              </LinkButton>
            ))}
            <div aria-hidden="true" className="h-px bg-line-soft my-1" />
            <LinkButton
              href={`/e/${eventId}/remote`}
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              size="sm"
              className="w-full justify-start rounded-none px-3"
            >
              <Smartphone className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Remote</span>
            </LinkButton>
          </div>
        </Popover>
      </div>

      <LinkButton
        href={`/e/${eventId}/remote`}
        target="_blank"
        rel="noopener noreferrer"
        variant="ghost"
        size="sm"
        aria-label="Remote"
        title="Remote: one-handed mobile control"
        className="hidden md:inline-flex"
      >
        <Smartphone className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="hidden lg:inline">Remote</span>
      </LinkButton>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { useEventId } from "@/lib/event-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EventSummary {
  id: string;
  name: string;
}

// The piece EventNav's rollout left out: EventNav (Console/Cue Sheet/
// Displays/Settings) answers "which screen am I on," but nothing answered
// "which event am I in, and how do I get back to all of them" — every
// event-scoped header just showed the literal string "KramFlow" (Console's
// h1) or a static "KramFlow"/"Displays" caption (Displays/Settings/
// Broadcast), never the actual event name, and nowhere linked back to
// /dashboard. An operator running two events in the same afternoon had no
// way to confirm which one they were looking at short of opening Settings
// and reading the name field.
//
// Two separate affordances, not one overloaded control (mirrors Vercel's
// Geist breadcrumb split into a plain trail segment vs. its "menu variant,"
// and GitHub's org-link-vs-repo-name split): the grid icon is a direct,
// single-click zoom-out to the Dashboard; the event name is a separate
// trigger that opens a switcher for jumping laterally to another event
// without detouring through the Dashboard's list first (the same shortcut
// Linear's and Notion's workspace switchers exist to provide).
export function EventIdentity() {
  const eventId = useEventId();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    // /api/events only returns events this operator *owns* — same scope
    // the Dashboard itself already lists with (app/(operator)/dashboard/
    // page.tsx's `.eq("owner_id", ...)`). A collaborator on someone else's
    // event won't see it in this switcher either, matching that existing
    // limitation rather than introducing a new inconsistency — fixing
    // collaborator visibility is a data-layer change, not a nav one.
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list: EventSummary[] = Array.isArray(data?.events)
          ? data.events.map((e: { id: string; name: string }) => ({ id: e.id, name: e.name }))
          : [];
        setEvents(list);
        const mine = list.find((e) => e.id === eventId);
        if (mine) setCurrentName(mine.name);
      })
      .catch(() => {});
    // Fetched separately (viewer-accessible, unlike the owner-scoped list
    // above) so a collaborator still sees the *current* event's real name
    // even when it can't appear in their own switcher list.
    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.event?.name) setCurrentName(data.event.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    const root = rootRef.current;
    root?.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      root?.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const others = (events ?? []).filter((e) => e.id !== eventId);

  return (
    <div className="flex items-center gap-1 min-w-0" ref={rootRef}>
      <Link href="/dashboard" aria-label="All events" title="All events">
        <Button variant="ghost" size="sm" square>
          <LayoutGrid className="h-4 w-4" strokeWidth={2} />
        </Button>
      </Link>

      <div className="relative min-w-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="true"
          aria-expanded={open}
          className="min-w-0 max-w-[12rem] sm:max-w-[16rem]"
        >
          <span className="truncate">{currentName ?? "…"}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} strokeWidth={2} />
        </Button>

        {open && (
          <div
            role="menu"
            aria-label="Switch event"
            className="absolute left-0 top-full z-30 mt-1.5 min-w-[14rem] max-w-[20rem] rounded-panel bg-card border border-line shadow-float py-1 motion-safe:animate-rise"
          >
            {events === null ? (
              <p className="px-3 py-2 text-console-sm text-muted-2">Loading…</p>
            ) : others.length === 0 ? (
              <p className="px-3 py-2 text-console-sm text-muted-2">No other events yet.</p>
            ) : (
              others.map((e) => (
                <Link
                  key={e.id}
                  href={`/e/${e.id}/operator`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-console-sm text-primary hover:bg-card-hover transition-colors truncate"
                >
                  {e.name}
                </Link>
              ))
            )}
            <div aria-hidden="true" className="h-px bg-line-soft my-1" />
            <Link
              href="/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-console-sm text-muted-2 hover:text-primary hover:bg-card-hover transition-colors"
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              All events
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

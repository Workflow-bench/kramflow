"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The "+" trigger in Displays' "Preview a display" row for custom
 * displays — replaces listing every DisplayProfile as its own always-
 * visible tile (which read as one more fixed screen alongside Presenter/
 * AV/etc., rather than "the extensible one"). One button, a dropdown:
 * pick an existing profile to preview it, or jump straight to creating a
 * new one (with your own name) when there isn't one yet — the empty case
 * is a real state here, not just an absent list.
 *
 * Same click-outside/Escape dropdown shape as EventIdentity's own event
 * switcher, for the same interaction everywhere a "trigger + role=menu"
 * pattern appears in this app.
 */
export function CustomDisplayPreviewMenu({
  eventId,
  profiles,
  onCreateProfile,
}: {
  eventId: string;
  profiles: { id: string; name: string }[];
  /** Opens the Display Profiles editor directly into "create new" — see
   *  DisplayProfilePanel's exposed `openCreate()` ref method. */
  onCreateProfile: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        Custom
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Preview a custom display"
          className="absolute left-0 top-full z-30 mt-1.5 min-w-[16rem] max-w-[20rem] rounded-panel bg-card border border-line shadow-float py-1 motion-safe:animate-rise"
        >
          {profiles.length === 0 ? (
            <div className="flex flex-col gap-2 px-3.5 py-3">
              <p className="text-console-sm text-primary">No custom profiles yet</p>
              <p className="text-console-meta text-muted-2">
                A profile is a custom display you build from widgets, under whatever name you give it.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-1 self-start"
                onClick={() => {
                  setOpen(false);
                  onCreateProfile();
                }}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Create a profile
              </Button>
            </div>
          ) : (
            <>
              {profiles.map((p) => (
                <Link
                  key={p.id}
                  href={`/custom?eventId=${encodeURIComponent(eventId)}&profileId=${encodeURIComponent(p.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-console-sm text-primary hover:bg-card-hover transition-colors truncate"
                >
                  <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-muted-2" strokeWidth={2} />
                  <span className="truncate">{p.name}</span>
                </Link>
              ))}
              <div aria-hidden="true" className="h-px bg-line-soft my-1" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onCreateProfile();
                }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3.5 py-2 text-console-sm text-muted-2",
                  "hover:text-primary hover:bg-card-hover transition-colors"
                )}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                New profile…
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

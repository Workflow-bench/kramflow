"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileSpreadsheet,
  FlaskConical,
  LayoutDashboard,
  Tv,
  Presentation,
  Smartphone,
  Megaphone,
  MonitorPlay,
  Settings as SettingsIcon,
  Lock,
  Calendar,
  Search,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { useEventStore } from "@/lib/store";
import { useSessions } from "@/lib/use-sessions";
import { useEventId } from "@/lib/event-context";
import { DISPLAY_TYPES, type DisplayType } from "@/lib/display-engine/types";
import { cn } from "@/lib/utils";

const DISPLAY_COMMAND_ICON: Record<DisplayType, typeof Tv> = {
  "green-room": Tv,
  av: Tv,
  general: Tv,
  presenter: Presentation,
  custom: Tv,
};

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

// Right-sized, not the full "1-2 week" version the design audit estimated:
// no fuzzy search library, no recent-commands memory — just fast
// substring-filtered navigation across the routes and sessions an operator
// actually needs mid-show, which was the concrete gap (jumping between
// items/sessions/displays always meant a full round trip through the top
// nav). Mounted once in app/(operator)/layout.tsx, so Cmd+K works from
// every authenticated operator page.
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const eventId = useEventId();
  const { status, lock } = useAuth();
  const { selectSession } = useEventStore();
  const sessions = useSessions();

  // Mounted once for the whole (operator) route group (including the PIN
  // screen itself, before AuthProvider knows the answer), so it has to
  // gate on auth status directly rather than assuming it's only ever
  // rendered post-unlock.
  const unlocked = status === "unlocked";

  // Cmd+K / Ctrl+K deliberately does NOT use lib/display-engine/use-
  // keyboard-shortcuts' input-exclusion — every real command palette
  // (Linear, GitHub, Raycast) opens from inside a text field too; only the
  // single-letter Operator Dashboard shortcuts (H, arrows) need to stay out
  // of the way of typing.
  useEffect(() => {
    if (!unlocked) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [unlocked]);

  // Reset the search + selection during render (React's documented
  // "adjusting state when a prop changes" pattern, used throughout this
  // codebase — see pin-gate.tsx's wasOpen tracking) rather than in an
  // effect, which would commit a stale first frame then immediately
  // re-render. Only the DOM focus() call is a genuine effect, since
  // focusing can't happen during render.
  const [trackedOpen, setTrackedOpen] = useState(open);
  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (open) {
      setQuery("");
      setHighlighted(0);
    }
  }

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const nav = (path: string) => () => {
      router.push(path);
      setOpen(false);
    };
    const routes: Command[] = [
      { id: "console", label: "Console", icon: <LayoutDashboard className="h-4 w-4" strokeWidth={2} />, run: nav(`/e/${eventId}/operator`) },
      { id: "cue-sheet", label: "Cue Sheet", icon: <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />, run: nav(`/e/${eventId}/operator/cue-sheet`) },
      { id: "displays", label: "Displays", icon: <MonitorPlay className="h-4 w-4" strokeWidth={2} />, run: nav(`/e/${eventId}/displays`) },
      { id: "settings", label: "Settings", icon: <SettingsIcon className="h-4 w-4" strokeWidth={2} />, run: nav(`/e/${eventId}/settings`) },
      ...DISPLAY_TYPES.filter((d) => d.value !== "custom").map((d) => {
        const Icon = DISPLAY_COMMAND_ICON[d.value];
        return {
          id: d.value,
          label: `${d.label} display`,
          icon: <Icon className="h-4 w-4" strokeWidth={2} />,
          run: nav(`${d.route}?eventId=${eventId}`),
        };
      }),
      { id: "remote", label: "Remote", icon: <Smartphone className="h-4 w-4" strokeWidth={2} />, run: nav(`/e/${eventId}/remote`) },
      { id: "broadcast", label: "Broadcast Center", icon: <Megaphone className="h-4 w-4" strokeWidth={2} />, run: nav(`/e/${eventId}/broadcast`) },
      { id: "rehearsal", label: "Rehearsal Mode", icon: <FlaskConical className="h-4 w-4" strokeWidth={2} />, run: nav(`/e/${eventId}/rehearsal`) },
    ];
    const sessionCommands: Command[] = sessions.map((s) => ({
      id: `session-${s.id}`,
      label: `Switch to ${s.dayLabel} • ${s.sessionLabel}`,
      hint: "Session",
      icon: <Calendar className="h-4 w-4" strokeWidth={2} />,
      run: () => {
        selectSession(s.id);
        setOpen(false);
      },
    }));
    const utilityCommands: Command[] = [
      { id: "lock", label: "Lock", hint: "Sign out of the operator PIN", icon: <Lock className="h-4 w-4" strokeWidth={2} />, run: () => { lock(); setOpen(false); } },
    ];
    return [...routes, ...sessionCommands, ...utilityCommands];
  }, [sessions, router, selectSession, lock, eventId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  const [trackedQuery, setTrackedQuery] = useState(query);
  if (query !== trackedQuery) {
    setTrackedQuery(query);
    setHighlighted(0);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[highlighted]?.run();
    }
  }

  return (
    <AnimatePresence>
      {open && unlocked && (
        <motion.div
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="fixed inset-0 z-[70] flex items-start justify-center bg-background/80 backdrop-blur-sm pt-[15vh] px-6"
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-full max-w-lg rounded-panel bg-card border border-white/10 shadow-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
              <Search className="h-4 w-4 text-muted-2 shrink-0" strokeWidth={2} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Jump to a display, session, or tool…"
                aria-label="Command palette search"
                // text-base below sm: — same iOS zoom-on-focus fix as Input
                // and Select's own embedded search field.
                className="flex-1 bg-transparent text-base sm:text-console-sm text-primary placeholder:text-muted-2 outline-none"
              />
              <kbd className="text-console-meta text-muted-2 border border-white/10 rounded px-1.5 py-0.5">Esc</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto py-2">
              {filtered.length === 0 && (
                <p className="text-console-sm text-muted-2 px-4 py-6 text-center">No matches.</p>
              )}
              {filtered.map((cmd, i) => (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={cmd.run}
                  onMouseEnter={() => setHighlighted(i)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer",
                    i === highlighted ? "bg-card-hover text-primary" : "text-muted"
                  )}
                >
                  <span className="text-muted-2 shrink-0">{cmd.icon}</span>
                  <span className="flex-1 text-console-sm truncate">{cmd.label}</span>
                  {cmd.hint && <span className="text-console-meta text-muted-2 shrink-0">{cmd.hint}</span>}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

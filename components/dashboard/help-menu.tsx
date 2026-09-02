"use client";

import { useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { reopenGettingStarted } from "./getting-started-checklist";
import { cn } from "@/lib/utils";
import { useDismissOnOutsideOrEscape } from "@/lib/use-dismiss-on-outside-or-escape";

// The one help entry point in the app. Previously a single "Getting
// started" item that just reopened the onboarding checklist — a dead end
// for anyone who already knows the basics but hits an unfamiliar term or
// wants a shortcut reference mid-show. Still a single-purpose popover, not
// a full account menu (nothing else needs one yet) — just with two more
// real, static destinations instead of one repeated one.
export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useDismissOnOutsideOrEscape(rootRef, open, () => setOpen(false));

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
            "absolute right-0 z-30 mt-1.5 min-w-[13rem] rounded-panel bg-card border border-line shadow-float py-1",
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
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setShortcutsOpen(true);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-console-sm text-primary hover:bg-card-hover transition-colors cursor-pointer"
          >
            Keyboard shortcuts
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setGlossaryOpen(true);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-console-sm text-primary hover:bg-card-hover transition-colors cursor-pointer"
          >
            Glossary
          </button>
        </div>
      )}

      <Modal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="Keyboard Shortcuts" size="sm">
        <ShortcutsContent />
      </Modal>

      <Modal open={glossaryOpen} onClose={() => setGlossaryOpen(false)} title="Glossary" size="md">
        <GlossaryContent />
      </Modal>
    </div>
  );
}

function ShortcutGroup({ title, shortcuts }: { title: string; shortcuts: { keys: string; action: string }[] }) {
  return (
    <div>
      <h3 className="text-console-label text-muted-2">{title}</h3>
      <div className="mt-2 flex flex-col gap-1.5">
        {shortcuts.map((s) => (
          <div key={s.action} className="flex items-center justify-between gap-4">
            <span className="text-console-sm text-muted">{s.action}</span>
            <kbd className="shrink-0 rounded-control border border-line bg-raised px-2 py-0.5 text-console-meta text-primary font-mono">
              {s.keys}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

// Only the shortcuts that actually exist in the app today — see
// components/operator/controls-panel.tsx and app/presenter/
// presenter-display-client.tsx's useKeyboardShortcuts calls. Both are
// scoped to their own page (never global) and disabled while typing in an
// input field.
function ShortcutsContent() {
  return (
    <div className="flex flex-col gap-6">
      <ShortcutGroup
        title="Operator Console"
        shortcuts={[
          { keys: "→", action: "Next item" },
          { keys: "←", action: "Previous item" },
          { keys: "H", action: "Hold / Resume" },
        ]}
      />
      <ShortcutGroup
        title="Presenter Display"
        shortcuts={[
          { keys: "Space", action: "Pause / resume timer" },
          { keys: "+", action: "Add 30 seconds" },
          { keys: "-", action: "Subtract 30 seconds" },
          { keys: "R", action: "Reset timer" },
          { keys: "F", action: "Toggle fullscreen" },
          { keys: "H", action: "Hold / Resume" },
          { keys: "Esc", action: "Exit fullscreen" },
        ]}
      />
      <p className="text-console-meta text-muted-2">
        Shortcuts are ignored while typing in a text field, and only apply on the page they&rsquo;re listed under.
      </p>
    </div>
  );
}

function GlossaryTerm({ term, definition }: { term: string; definition: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-1 sm:gap-4">
      <dt className="text-console-sm text-primary font-medium">{term}</dt>
      <dd className="text-console-sm text-muted">{definition}</dd>
    </div>
  );
}

// Terms specific to how Kramflow itself models a show — not a general AV
// glossary. The persona UX study (kramflow_ux_report.md) flagged several of
// these as needing active mental re-translation on first use, "Session" in
// particular, since it doesn't match how the wider events industry uses the
// same word — worth explaining rather than renaming everywhere at once.
function GlossaryContent() {
  const terms = [
    { term: "Session", definition: "A block of the day within an event — e.g. \"Saturday Evening.\" Holds an ordered list of items, not a single agenda entry." },
    { term: "Item", definition: "One row on the cue sheet — a single segment, speech, or piece of the running order within a session." },
    { term: "Auditorium", definition: "A physical room or venue space you can assign to an item. Assigning one unlocks that item's Production Requirements fields." },
    { term: "Production Requirements", definition: "The AV/technical needs for an item — lighting, curtains, sidescreen, and similar — visible once that item has an Auditorium." },
    { term: "Color tag", definition: "A status marker on an item: Ready, VIP, Needs Confirmation, or Urgent. Meant to be scanned at a glance during a live show." },
    { term: "Hold", definition: "Pauses the live show without ending it. Displays reflect Hold differently depending on audience (General) vs. crew (Presenter, Green Room, AV) screens." },
    { term: "On deck", definition: "The item after \"Next\" — the AV display shows Live / Next / On Deck as a three-deep lookahead." },
    { term: "Broadcast", definition: "A message sent to some or all of your display screens — includes separate, visually distinct Emergency presets for urgent alerts." },
    { term: "Display Manager", definition: "Where every screen currently connected to your event is registered and controlled — reload, test message, force fullscreen, and similar." },
    { term: "Share Link", definition: "A URL (with a scannable QR code) that lets a screen connect to one of your event's displays without logging in." },
    { term: "Operator Console", definition: "The screen you run the live show from — Start, Next, Previous, Hold, and alerts. Distinct from your account's dashboard." },
  ];
  return (
    <dl className="flex flex-col gap-3">
      {terms.map((t) => (
        <GlossaryTerm key={t.term} term={t.term} definition={t.definition} />
      ))}
    </dl>
  );
}

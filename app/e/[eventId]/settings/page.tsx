"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Info, KeyRound, Trash2, Users } from "lucide-react";
import { useEventId, useIsOwner } from "@/lib/event-context";
import { useConnectionStatus } from "@/lib/store";
import { EventShellHeader } from "@/components/operator/event-shell-header";
import { EventSettingsPanel, type SettingsSection } from "@/components/forms/event-settings-panel";
import { IntegrationCredentialsPanel } from "@/components/forms/integration-credentials-panel";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Promoted out of the gear icon that used to live inside Cue Sheet's own
// header — collaborators/auditoriums/event details are properties of the
// event, not of the queue-editing screen, and checking who has access
// shouldn't require detouring through Cue Sheet first. Reachable as its
// own top-level destination regardless of which content screen is
// showing, the way StageTimer's Room menu works from the Controller no
// matter what's on screen. See kramflow_nav_layout_ground_up.md.
//
// This is a route, not a modal — EventSettingsPanel used to be shaped like
// one (a single boxed panel with a sticky "Close" footer, inherited from
// when it really was a modal body). EventNav + the event switcher in
// EventIdentity are already a complete way back to the rest of the event;
// a second, redundant "Close" button was removed along with the modal
// anatomy rather than kept as a safety net for a navigation path that
// already exists.
//
// Phase 7c: was five equally-weighted Panel cards stacked in one column —
// the clearest remaining "card soup" the Landing -> Product Visual System
// Audit found. Now a two-region workspace (section nav + contextual pane),
// the same shape System Settings/Linear/Stripe all converged on for
// exactly this problem, applied with Kramflow's own grammar (EventNav's
// icon+label list/Popover pattern, Console-scale typography, dividers
// instead of boxes) rather than copied wholesale from any of them.
const SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  ownerOnly?: boolean;
}[] = [
  { id: "details", label: "Event Details", icon: Info },
  { id: "auditoriums", label: "Auditoriums", icon: Building2 },
  { id: "collaborators", label: "Collaborators", icon: Users },
  { id: "integrations", label: "External API", icon: KeyRound },
  { id: "danger", label: "Danger Zone", icon: Trash2, ownerOnly: true },
];

export default function EventSettingsPage() {
  const eventId = useEventId();
  const router = useRouter();
  const connectionStatus = useConnectionStatus();
  const isOwner = useIsOwner();
  const [eventName, setEventName] = useState("");
  const [auditoriums, setAuditoriums] = useState<{ id: string; name: string }[]>([]);
  const [section, setSection] = useState<SettingsSection>("details");

  function loadAuditoriums() {
    fetch(`/api/auditoriums?eventId=${encodeURIComponent(eventId)}`)
      .then((res) => res.json())
      .then((data) => setAuditoriums(data.auditoriums ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    loadAuditoriums();
    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => setEventName(data?.event?.name ?? ""))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadAuditoriums is stable across the eventId this effect keys on
  }, [eventId]);

  // Owner-only server-side (EventSettingsPanel's own Danger Zone check,
  // unchanged) — hidden from the nav too rather than shown-then-empty, the
  // same courtesy every owner-gated control in this file already follows.
  const visibleSections = SECTIONS.filter((s) => !s.ownerOnly || isOwner);
  const active = visibleSections.find((s) => s.id === section) ?? visibleSections[0];

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <EventShellHeader title="Settings" connectionStatus={connectionStatus} />

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Desktop/tablet: a real section list, not a horizontal tab strip
            — this is a sidebar-shaped workspace (per the brief), matching
            how a settings area actually reads at a glance: every section
            visible at once, current one obvious. */}
        <nav
          className="hidden md:flex md:w-56 lg:w-64 shrink-0 flex-col gap-0.5 border-r border-line-soft px-3 py-6"
          aria-label="Settings sections"
        >
          {visibleSections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              aria-current={active.id === s.id ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-control px-3 py-2 text-console-sm text-left transition-colors duration-[110ms] cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                s.id === "danger"
                  ? cn("text-status-red/80 hover:text-status-red", active.id === s.id && "bg-card-hover text-status-red")
                  : active.id === s.id
                    ? "bg-card-hover text-primary"
                    : "text-muted hover:text-primary hover:bg-card-hover"
              )}
            >
              <s.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              {s.label}
            </button>
          ))}
        </nav>

        {/* Mobile: the same compact trigger + Popover pattern EventNav
            already uses for "which destination am I in" — reused verbatim
            for "which settings section am I in" rather than a second
            selector idiom. */}
        <div className="md:hidden px-4 sm:px-6 py-4 border-b border-line-soft">
          <Popover
            align="start"
            className="w-[min(92vw,20rem)]"
            trigger={({ open, toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-haspopup="true"
                aria-expanded={open}
                aria-label={`Settings section — currently ${active.label}`}
                className={cn(
                  "flex w-full items-center gap-2 rounded-control border border-line-soft bg-card/50 px-3 py-2 text-console-sm hover:bg-card-hover transition-colors",
                  active.id === "danger" ? "text-status-red" : "text-primary"
                )}
              >
                <active.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span className="flex-1 text-left">{active.label}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} strokeWidth={2} />
              </button>
            )}
          >
            <div role="menu" aria-label="Settings sections">
              {visibleSections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="menuitem"
                  onClick={() => setSection(s.id)}
                  aria-current={active.id === s.id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2.5 text-console-sm text-left transition-colors cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
                    s.id === "danger"
                      ? cn("text-status-red/80 hover:text-status-red", active.id === s.id && "bg-card-hover text-status-red")
                      : active.id === s.id
                        ? "bg-card-hover text-primary"
                        : "text-muted hover:text-primary hover:bg-card-hover"
                  )}
                >
                  <s.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {s.label}
                </button>
              ))}
            </div>
          </Popover>
        </div>

        <div className="flex-1 min-w-0 px-4 sm:px-6 xl:px-12 py-8">
          <div className="max-w-2xl">
            {section === "integrations" ? (
              <IntegrationCredentialsPanel eventId={eventId} />
            ) : (
              <EventSettingsPanel
                section={section}
                eventId={eventId}
                initialName={eventName}
                auditoriums={auditoriums}
                onAuditoriumsChanged={loadAuditoriums}
                onEventDeleted={() => router.push("/dashboard")}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

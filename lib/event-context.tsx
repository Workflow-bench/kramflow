"use client";

import { createContext, useContext } from "react";

// The current event an authenticated operator is managing — set once at
// app/e/[eventId]/layout.tsx (after that layout has already verified the
// signed-in user owns it) and read by useEventStore()/useSessions() and
// every operator component that calls them (ProgramList, ControlsPanel,
// CommandPalette, ...). A context, not a hook parameter, for the same
// reason lib/display-engine/context.tsx exists: these are called directly
// by many nested components that have no natural way to receive an eventId
// prop without threading it through every intermediate layer. Only ever
// used by authenticated operator surfaces — the anonymous share-link
// display pages use lib/use-display-view.ts instead, which takes its own
// token/eventId explicitly and never touches this context.

const EventContext = createContext<string | null>(null);

export function EventProvider({ eventId, children }: { eventId: string; children: React.ReactNode }) {
  return <EventContext.Provider value={eventId}>{children}</EventContext.Provider>;
}

export function useEventId(): string {
  const eventId = useContext(EventContext);
  if (!eventId) {
    throw new Error("useEventStore()/useSessions() was called outside an <EventProvider>");
  }
  return eventId;
}

// Report finding #26 — the signed-in user's role on *this* event, resolved
// once server-side in the layout (same request that already checks they
// have any access at all) and handed down for UI adaptation: hiding
// controls a viewer/editor can't use is a courtesy so they don't have to
// click-and-fail to discover that, not the actual security boundary — the
// real enforcement is server-side, in every API route's
// requireEventAccess() call. A separate context from EventContext rather
// than widening its shape, so every existing useEventId() call site (there
// are many) is unaffected.
export type EventRole = "viewer" | "editor" | "owner";
const EventRoleContext = createContext<EventRole>("owner");

export function EventRoleProvider({ role, children }: { role: EventRole; children: React.ReactNode }) {
  return <EventRoleContext.Provider value={role}>{children}</EventRoleContext.Provider>;
}

export function useEventRole(): EventRole {
  return useContext(EventRoleContext);
}

// 2026-09 permission-truth pass — the same two checks (role === "owner",
// role !== "viewer") were independently re-derived in
// app/e/[eventId]/broadcast/page.tsx, components/operator/controls-panel.tsx,
// components/forms/event-settings-panel.tsx, and
// app/e/[eventId]/operator/cue-sheet/page.tsx before this existed — not
// wrong anywhere it appeared, but four independent copies of "is this
// person allowed to do the owner-only/editor-plus thing" is exactly the
// kind of duplication that lets UI and API rules quietly drift apart over
// time. One canonical place, matching CAPABILITY -> SERVER REQUIREMENT
// mapping in docs/BLOCKER_REMEDIATION_RUNBOOK.md's permission section:
// every "owner"-gated API route (requireEventAccess(eventId, "owner")) —
// live-state control, broadcasts, fleet management, collaborator
// management — corresponds to useIsOwner() here; every "editor"-gated
// route (cue-sheet/session writes, auditoriums) corresponds to
// useCanEdit(). This is still only a UI courtesy, same as useEventRole()
// itself — the actual enforcement is server-side in every route's own
// requireEventAccess() call.
export function useIsOwner(): boolean {
  return useEventRole() === "owner";
}

export function useCanEdit(): boolean {
  return useEventRole() !== "viewer";
}

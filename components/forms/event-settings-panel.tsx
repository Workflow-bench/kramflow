"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Copy, RefreshCw, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { SectionLabel } from "@/components/ui/section-label";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useEventRole } from "@/lib/event-context";
import { useToast } from "@/components/ui/toast";

interface Collaborator {
  id: string;
  user_id: string | null;
  role: "editor" | "viewer";
  invited_email: string;
  status: "pending" | "accepted";
  invite_token: string | null;
}

const PERMISSION_NOTE = "Only the event owner can change this.";

// Real IANA identifiers, generated at runtime rather than hand-maintained —
// Intl.supportedValuesOf is supported everywhere this app already targets
// (see docs/DEPLOYMENT.md's supported-browser baseline). Falls back to a
// short list of common zones on the rare runtime that lacks it, so the
// field degrades instead of breaking.
function timezoneOptions(): { value: string; label: string }[] {
  try {
    const zones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.(
      "timeZone"
    );
    if (zones && zones.length > 0) return zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }));
  } catch {
    // fall through to the manual list below
  }
  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Asia/Singapore",
    "Australia/Sydney",
  ].map((z) => ({ value: z, label: z.replace(/_/g, " ") }));
}

// Four real, distinct configuration domains — Event Details, Auditoriums,
// Collaborators, and (owner-only) the one destructive action the product
// has at the event level. Each is its own Panel with its own heading and
// one-line "what this configures" description, not three <section>s of
// identical weight inside one box shaped like the modal this used to be
// (2026-09-01 UI/UX audit: "Event, Auditoriums and Collaborators visually
// undifferentiated"). Auditorium management had no UI at all before an
// earlier pass — the API route existed, nothing called it except the Add
// Item form's read-only dropdown.
export function EventSettingsPanel({
  eventId,
  initialName,
  auditoriums,
  onAuditoriumsChanged,
  onEventDeleted,
}: {
  eventId: string;
  initialName: string;
  auditoriums: { id: string; name: string }[];
  onAuditoriumsChanged: () => void;
  onEventDeleted: () => void;
}) {
  const toast = useToast();
  const role = useEventRole();
  // Report finding #26 — the actual boundary is server-side
  // (requireEventAccess in every one of this panel's routes); disabling
  // rather than hiding is a courtesy so an editor/viewer can still see
  // current values instead of wondering why a whole section vanished, and
  // matches the pattern Broadcast Center and Displays already established
  // for the same kind of boundary.
  const isOwner = role === "owner";
  const canAddAuditorium = role !== "viewer";

  const [name, setName] = useState(initialName);
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [timezone, setTimezone] = useState("");
  const [initialDetails, setInitialDetails] = useState({ name: initialName, eventDate: "", venue: "", timezone: "" });
  const [savingDetails, setSavingDetails] = useState(false);
  const [newAuditorium, setNewAuditorium] = useState("");
  const [addingAuditorium, setAddingAuditorium] = useState(false);
  const tzOptions = useMemo(() => timezoneOptions(), []);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  // Distinct from "loaded, zero rows" — a fetch failure was previously
  // swallowed here (a bare .catch(() => {})), which left `collaborators`
  // at its empty initial value and rendered indistinguishably from a
  // genuinely empty roster. Confirmed live that this is exactly what's
  // happening right now: the collaborators GET 500s (a live-database
  // schema gap — event_collaborators is missing invited_by/
  // invite_expires_at/accepted_at, columns supabase/schema.sql already
  // documents and this route's own POST already writes to), so every
  // event's collaborator list has been silently rendering as "No
  // collaborators yet" regardless of who's actually on it. This can't be
  // fixed from application code — it needs the missing columns added to
  // the live database — so at minimum the UI should say so instead of
  // lying.
  const [collaboratorsError, setCollaboratorsError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deleteEventOpen, setDeleteEventOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/collaborators`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok) {
          setCollaborators(data.collaborators ?? []);
          setCollaboratorsError(null);
        } else {
          setCollaboratorsError(data?.error ?? "Couldn't load collaborators");
        }
      })
      .catch(() => {
        if (!cancelled) setCollaboratorsError("Couldn't load collaborators");
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function sendInvite(email: string, role: "editor" | "viewer") {
    const res = await fetch(`/api/events/${eventId}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data: { ok: boolean; error?: string; status?: "accepted" | "pending"; emailSent?: boolean } =
      await res.json();
    if (!res.ok || !data.ok) {
      toast.error(data.error ?? "Couldn't add collaborator");
      return false;
    }
    if (data.status === "accepted") {
      toast.success(`Added as ${role}`);
    } else if (data.emailSent) {
      toast.success(`Invite emailed to ${email}`);
    } else {
      toast.success(`Invite created for ${email} — copy the link below to send it manually.`);
    }
    const list = await fetch(`/api/events/${eventId}/collaborators`).then((r) => r.json());
    if (list?.ok) setCollaborators(list.collaborators ?? []);
    return true;
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      if (await sendInvite(inviteEmail.trim(), inviteRole)) setInviteEmail("");
    } finally {
      setInviting(false);
    }
  }

  async function handleResendInvite(c: Collaborator) {
    setRemovingId(c.id);
    try {
      await sendInvite(c.invited_email, c.role);
    } finally {
      setRemovingId(null);
    }
  }

  function handleCopyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied.");
  }

  async function handleRemoveCollaborator(c: Collaborator) {
    setRemovingId(c.id);
    try {
      const query = c.status === "pending" ? `inviteId=${encodeURIComponent(c.id)}` : `userId=${encodeURIComponent(c.user_id!)}`;
      const res = await fetch(`/api/events/${eventId}/collaborators?${query}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(c.status === "pending" ? "Couldn't revoke invite" : "Couldn't remove collaborator");
        return;
      }
      setCollaborators((prev) => prev.filter((x) => x.id !== c.id));
      toast.success(c.status === "pending" ? "Invite revoked" : "Removed");
    } finally {
      setRemovingId(null);
    }
  }

  // React's documented "adjusting state when a prop changes" pattern
  // (matches components/operator/command-palette.tsx's trackedOpen) rather
  // than an effect — initialName only actually changes once, when the
  // event-name fetch in the parent resolves after this panel's first
  // render, and syncing that during render avoids the extra commit an
  // effect would cost.
  const [trackedInitialName, setTrackedInitialName] = useState(initialName);
  if (initialName !== trackedInitialName) {
    setTrackedInitialName(initialName);
    setName(initialName);
    setInitialDetails((d) => ({ ...d, name: initialName }));
  }

  // Date/venue/timezone aren't fetched by the parent (only the name is,
  // for the header) — self-contained fetch here, same pattern
  // ProgramForm already uses for this event's form_config.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const event = data?.event ?? {};
        const nextDate = typeof event.event_date === "string" ? event.event_date : "";
        const nextVenue = typeof event.venue === "string" ? event.venue : "";
        const nextTimezone = typeof event.timezone === "string" ? event.timezone : "";
        setEventDate(nextDate);
        setVenue(nextVenue);
        setTimezone(nextTimezone);
        setInitialDetails((d) => ({ ...d, eventDate: nextDate, venue: nextVenue, timezone: nextTimezone }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const detailsDirty =
    name.trim() !== initialDetails.name || eventDate !== initialDetails.eventDate || venue !== initialDetails.venue || timezone !== initialDetails.timezone;

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !detailsDirty || !isOwner) return;
    setSavingDetails(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          event_date: eventDate || null,
          venue: venue.trim() || null,
          timezone: timezone || null,
        }),
      });
      if (!res.ok) {
        toast.error("Couldn't save event details");
        return;
      }
      setInitialDetails({ name: name.trim(), eventDate, venue, timezone });
      toast.success("Event details saved");
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleAddAuditorium(e: React.FormEvent) {
    e.preventDefault();
    if (!newAuditorium.trim() || !canAddAuditorium) return;
    setAddingAuditorium(true);
    try {
      const res = await fetch("/api/auditoriums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, name: newAuditorium.trim() }),
      });
      if (!res.ok) {
        toast.error("Couldn't add the auditorium");
        return;
      }
      setNewAuditorium("");
      onAuditoriumsChanged();
      toast.success("Auditorium added");
    } finally {
      setAddingAuditorium(false);
    }
  }

  async function handleDeleteEvent() {
    setDeletingEvent(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Couldn't delete the event");
        return;
      }
      router.prefetch?.("/dashboard");
      onEventDeleted();
    } finally {
      setDeletingEvent(false);
      setDeleteEventOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel className="p-6 flex flex-col gap-4">
        <div>
          <SectionLabel>Event Details</SectionLabel>
          <p className="text-console-meta text-muted-2 mt-1">
            Name, date, venue, and timezone — shown across the Dashboard, Console, and every display.
          </p>
        </div>
        {!isOwner && (
          <p className="text-console-meta text-status-orange">{PERMISSION_NOTE}</p>
        )}
        <form onSubmit={handleSaveDetails} className="flex flex-col gap-3 max-w-lg">
          <FormField label="Event name">
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Date (optional)">
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} disabled={!isOwner} />
            </FormField>
            <FormField label="Timezone (optional)">
              <Select
                value={timezone}
                onChange={setTimezone}
                options={tzOptions}
                placeholder="Select timezone…"
                aria-label="Timezone"
                disabled={!isOwner}
              />
            </FormField>
          </div>

          <FormField label="Venue (optional)">
            <Input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. Main Ballroom, 123 Main St"
              disabled={!isOwner}
            />
          </FormField>

          {isOwner && (
            <div>
              <Button type="submit" variant="secondary" size="sm" loading={savingDetails} disabled={!name.trim() || !detailsDirty}>
                Save
              </Button>
            </div>
          )}
        </form>
      </Panel>

      <Panel className="p-6 flex flex-col gap-4">
        <div>
          <SectionLabel>Auditoriums</SectionLabel>
          <p className="text-console-meta text-muted-2 mt-1">
            Drives the Add Item form&rsquo;s Production Requirements — an item&rsquo;s auditorium determines which of those fields apply.
          </p>
        </div>

        {auditoriums.length > 0 ? (
          <ul className="flex flex-col gap-1.5 max-w-lg">
            {auditoriums.map((a) => (
              <li key={a.id} className="rounded-control bg-raised border border-line px-3 py-2 text-console-sm text-primary">
                {a.name}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No auditoriums yet" body="Add one below — it becomes selectable from the Add Item form." className="max-w-lg" />
        )}

        {canAddAuditorium ? (
          <form onSubmit={handleAddAuditorium} className="flex items-end gap-2 max-w-lg">
            <FormField label="New auditorium" className="flex-1">
              <Input
                value={newAuditorium}
                onChange={(e) => setNewAuditorium(e.target.value)}
                placeholder="e.g. Main Hall"
              />
            </FormField>
            <Button type="submit" variant="secondary" size="sm" loading={addingAuditorium} disabled={!newAuditorium.trim()}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Add
            </Button>
          </form>
        ) : (
          <p className="text-console-meta text-status-orange">{PERMISSION_NOTE}</p>
        )}
      </Panel>

      {/* Report finding #26 — minimum-viable role-based permissions.
          "editor" can edit the cue sheet but not run the live show or touch
          this panel's own settings; "viewer" is read-only. Only the owner
          manages the roster (server-enforced — see /api/events/[eventId]/
          collaborators/route.ts's requireEventAccess(..., "owner")), so a
          collaborator sees the list but not the invite form or remove
          buttons. */}
      <Panel className="p-6 flex flex-col gap-4">
        <div>
          <SectionLabel>Collaborators</SectionLabel>
          <p className="text-console-meta text-muted-2 mt-1">
            Editors can edit the cue sheet but can&rsquo;t run the live show. Viewers can only look.
          </p>
        </div>

        {collaboratorsError ? (
          <EmptyState
            title="Couldn't load collaborators"
            body={`This isn't the same as having none — the list failed to load (${collaboratorsError}). Try reloading the page.`}
          />
        ) : collaborators.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {collaborators.map((c) => (
              <li key={c.id} className="rounded-control bg-raised border border-line px-3 py-2.5">
                {/* Identity / Role / Status / Actions — four distinct facts,
                    not one generic badge doing double duty (2026-09-01
                    audit). Role and status are separate Badge families:
                    role is a stable fact about permission tier, status is
                    the invite's own lifecycle — collapsing them would lose
                    which is which. */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-console-sm text-primary truncate min-w-0">{c.invited_email}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone="muted" className="capitalize">
                      {c.role}
                    </Badge>
                    <Badge tone={c.status === "pending" ? "orange" : "green"} dot>
                      {c.status === "pending" ? "Pending" : "Accepted"}
                    </Badge>
                    {isOwner && (
                      <Tooltip content={c.status === "pending" ? "Revoke invite" : "Remove collaborator"}>
                        <Button
                          variant="ghost"
                          size="sm"
                          square
                          aria-label={c.status === "pending" ? `Revoke invite to ${c.invited_email}` : `Remove ${c.invited_email}`}
                          onClick={() => handleRemoveCollaborator(c)}
                          disabled={removingId === c.id}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2} />
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </div>
                {c.status === "pending" && isOwner && c.invite_token && (
                  <div className="flex items-center gap-1 pt-1.5 -ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyInviteLink(c.invite_token!)}
                    >
                      <Copy className="h-3 w-3" strokeWidth={2} />
                      Copy invite link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResendInvite(c)}
                      disabled={removingId === c.id}
                    >
                      <RefreshCw className="h-3 w-3" strokeWidth={2} />
                      Resend
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No collaborators yet"
            body={isOwner ? "Invite someone below to give them access to this event." : "Only you and the event owner have access right now."}
          />
        )}

        {isOwner && (
          <>
            <form onSubmit={handleInvite} className="flex items-end gap-2 flex-wrap">
              <FormField label="Add by email" className="flex-1 min-w-[10rem]">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </FormField>
              <FormField label="Role" className="w-32">
                <Select
                  value={inviteRole}
                  onChange={(v) => setInviteRole(v as "editor" | "viewer")}
                  options={[
                    { value: "editor", label: "Editor" },
                    { value: "viewer", label: "Viewer" },
                  ]}
                />
              </FormField>
              <Button type="submit" variant="secondary" size="sm" loading={inviting} disabled={!inviteEmail.trim()}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Add
              </Button>
            </form>
            <p className="text-console-meta text-muted-2">
              If they don&rsquo;t have a Kramflow account yet, we&rsquo;ll email them an invite to create one and join
              this event.
            </p>
          </>
        )}
      </Panel>

      {/* Guardrail tier 4 (docs/DESIGN.md) — the same weight and typed-
          confirmation pattern the Dashboard's own Delete Event uses,
          exposed here too since Settings is where an owner configuring an
          event would actually look for it. Owner-only and hidden (not
          merely disabled) for anyone else — there is no legitimate reason
          for a non-owner to see a control this consequential for an event
          they don't own. */}
      {isOwner && (
        <Panel className="p-6 flex flex-col gap-4 border-status-red/30">
          <div>
            <SectionLabel className="text-status-red">Danger Zone</SectionLabel>
            <p className="text-console-meta text-muted-2 mt-1">
              Permanently destroys this event — every session, item, share link, collaborator, and display state.
            </p>
          </div>
          <div>
            <Button variant="danger" size="sm" onClick={() => setDeleteEventOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              Delete Event
            </Button>
          </div>
        </Panel>
      )}

      <ConfirmDialog
        open={deleteEventOpen}
        title={`Delete "${initialDetails.name || name}"?`}
        description="Every session, item, share link, collaborator, and display state for this event — permanently destroyed. This can't be undone."
        confirmLabel="Delete Event"
        tone="danger-solid"
        loading={deletingEvent}
        requireTypedConfirmation={{ value: initialDetails.name || name, label: `Type "${initialDetails.name || name}" to confirm` }}
        onConfirm={handleDeleteEvent}
        onCancel={() => setDeleteEventOpen(false)}
      />
    </div>
  );
}

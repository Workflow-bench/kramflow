"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

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

// Event name + Auditorium management — folded into the same one-click
// modal-layer anatomy as the Add Item panel and Share Link panel (Phase 2
// §2 of the UX rethink: "Event settings and Auditorium management don't
// currently live in a single consistent modal layer... should join this
// layer rather than getting bespoke pages"). Auditorium management had no
// UI at all before this — the API route existed, nothing called it except
// the Add Item form's read-only dropdown.
export function EventSettingsPanel({
  eventId,
  initialName,
  auditoriums,
  onAuditoriumsChanged,
  onCancel,
}: {
  eventId: string;
  initialName: string;
  auditoriums: { id: string; name: string }[];
  onAuditoriumsChanged: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [timezone, setTimezone] = useState("");
  const [initialDetails, setInitialDetails] = useState({ name: initialName, eventDate: "", venue: "", timezone: "" });
  const [savingDetails, setSavingDetails] = useState(false);
  const [newAuditorium, setNewAuditorium] = useState("");
  const [addingAuditorium, setAddingAuditorium] = useState(false);
  const tzOptions = useMemo(() => timezoneOptions(), []);

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
    if (!name.trim() || !detailsDirty) return;
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
    if (!newAuditorium.trim()) return;
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

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-console-label text-muted-2 shrink-0">Event</h3>
          <span aria-hidden="true" className="flex-1 h-px bg-line-soft" />
        </div>
        <form onSubmit={handleSaveDetails} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 min-w-0">
            <span className="text-console-meta text-muted-2">Event name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="text-console-meta text-muted-2">Date (optional)</span>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="text-console-meta text-muted-2">Timezone (optional)</span>
              <Select
                value={timezone}
                onChange={setTimezone}
                options={tzOptions}
                placeholder="Select timezone…"
                aria-label="Timezone"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 min-w-0">
            <span className="text-console-meta text-muted-2">Venue (optional)</span>
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Main Ballroom, 123 Main St" />
          </label>

          <div>
            <Button type="submit" variant="secondary" size="sm" loading={savingDetails} disabled={!name.trim() || !detailsDirty}>
              Save
            </Button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-console-label text-muted-2 shrink-0">Auditoriums</h3>
          <span aria-hidden="true" className="flex-1 h-px bg-line-soft" />
        </div>
        <p className="text-console-meta text-muted-2">
          Drives the Add Item form&rsquo;s Production Requirements — an item&rsquo;s auditorium determines which of those fields apply.
        </p>

        {auditoriums.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {auditoriums.map((a) => (
              <li key={a.id} className="rounded-control bg-raised border border-line px-3 py-2 text-console-sm text-primary">
                {a.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-console-sm text-muted-2">No auditoriums yet.</p>
        )}

        <form onSubmit={handleAddAuditorium} className="flex items-end gap-2">
          <label className="flex-1 flex flex-col gap-1.5 min-w-0">
            <span className="text-console-meta text-muted-2">New auditorium</span>
            <Input
              value={newAuditorium}
              onChange={(e) => setNewAuditorium(e.target.value)}
              placeholder="e.g. Main Hall"
            />
          </label>
          <Button type="submit" variant="secondary" size="sm" loading={addingAuditorium} disabled={!newAuditorium.trim()}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add
          </Button>
        </form>
      </section>

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-1 flex items-center gap-2 border-t border-line-soft bg-card/95 backdrop-blur-sm px-6 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Close
        </Button>
      </div>
    </div>
  );
}

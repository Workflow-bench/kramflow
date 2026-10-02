"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { normalizeStartTime } from "@/lib/schedule";
import type { Session } from "@/lib/types";

interface SessionFormProps {
  eventId: string;
  session?: Session; // present -> edit (PATCH), absent -> create (POST)
  nextSortOrder: number;
  onSaved: () => void;
  onCancel: () => void;
}

function slugify(dayLabel: string, sessionLabel: string): string {
  const base = `${dayLabel}-${sessionLabel}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `session-${Date.now()}`;
}

export function SessionForm({ eventId, session, nextSortOrder, onSaved, onCancel }: SessionFormProps) {
  const [dayLabel, setDayLabel] = useState(session?.dayLabel ?? "");
  const [sessionLabel, setSessionLabel] = useState(session?.sessionLabel ?? "");
  const [eventName, setEventName] = useState(session?.eventName ?? "");
  const toast = useToast();
  // A start time lives on a *section*, which is what the schedule cascades
  // from. A session with several sections (an Excel import) is edited at its
  // section headers, so the field only appears when there is at most one.
  const existingSection = session?.partitions[0] ?? null;
  const showStartTime = !session || session.partitions.length <= 1;
  const [startTime, setStartTime] = useState(existingSection?.startTime ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Saves the start time: creates the section if the session has none. */
  async function saveStartTime(sessionId: string): Promise<boolean> {
    const parsed = normalizeStartTime(startTime);
    const label = parsed.ok ? parsed.label : null;
    if (existingSection) {
      if ((existingSection.startTime ?? "") === (label ?? "")) return true;
      const res = await fetch(`/api/partitions/${existingSection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, start_time: label }),
      });
      return res.ok;
    }
    if (!label) return true;
    const created = await fetch("/api/partitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, sessionId, label: "Main", start_time: label }),
    });
    if (!created.ok) return false;
    // Items added before there was a section move into it, so they schedule too.
    const ids = session?.items.map((i) => i.id) ?? [];
    if (ids.length === 0) return true;
    const { id } = (await created.json()) as { id: string };
    const moved = await fetch("/api/programs/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, ids, partitionId: id }),
    });
    return moved.ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dayLabel.trim() || !sessionLabel.trim()) {
      setError("Day and session name are required.");
      return;
    }
    if (showStartTime && !normalizeStartTime(startTime).ok) {
      setError("Start time should look like 9:00 AM.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(session ? `/api/sessions/${session.id}` : "/api/sessions", {
        method: session ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          session
            ? { eventId, day_label: dayLabel.trim(), session_label: sessionLabel.trim(), event_name: eventName.trim() }
            : {
                eventId,
                id: slugify(dayLabel, sessionLabel),
                day_label: dayLabel.trim(),
                session_label: sessionLabel.trim(),
                event_name: eventName.trim(),
                sheet_name: `${dayLabel.trim()} ${sessionLabel.trim()}`,
                sort_order: nextSortOrder,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      if (showStartTime) {
        const sessionId = session ? session.id : slugify(dayLabel, sessionLabel);
        if (!(await saveStartTime(sessionId))) {
          toast.error("Session saved, but its start time could not be set. Set it from the section header.");
        }
      }
      onSaved();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Day">
          <Input
            value={dayLabel}
            onChange={(e) => setDayLabel(e.target.value)}
            placeholder="e.g. Saturday"
            autoFocus
          />
        </FormField>
        <FormField label="Session">
          <Input
            value={sessionLabel}
            onChange={(e) => setSessionLabel(e.target.value)}
            placeholder="e.g. Evening Session"
          />
        </FormField>
      </div>
      {showStartTime && (
        <div>
          <FormField label="Start time (optional)">
            <Input
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="e.g. 9:00 AM"
              inputMode="text"
            />
          </FormField>
          <p className="text-console-meta text-muted-2 mt-1">
            The first item starts here and every item after it follows from its duration. Leave blank to schedule
            times yourself.
          </p>
        </div>
      )}
      <div>
        <FormField label="Display title (optional)">
          <Input
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="e.g. Evening Gala"
          />
        </FormField>
        <p className="text-console-meta text-muted-2 mt-1">
          Shown as the headline on the General audience display while this session is live. Leave blank to show
          nothing.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-console-meta text-status-red">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={saving}>
          {session ? "Save changes" : "Add session"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dayLabel.trim() || !sessionLabel.trim()) {
      setError("Day and session name are required.");
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
      onSaved();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card bg-card p-6 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-caption text-muted-2">Day</label>
          <Input
            className="mt-1.5"
            value={dayLabel}
            onChange={(e) => setDayLabel(e.target.value)}
            placeholder="e.g. Saturday"
            autoFocus
          />
        </div>
        <div>
          <label className="text-caption text-muted-2">Session</label>
          <Input
            className="mt-1.5"
            value={sessionLabel}
            onChange={(e) => setSessionLabel(e.target.value)}
            placeholder="e.g. Evening Session"
          />
        </div>
      </div>
      <div>
        <label className="text-caption text-muted-2">Event name (optional)</label>
        <Input
          className="mt-1.5"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="e.g. Satsang Shibir 2026"
        />
      </div>

      {error && <p className="text-caption text-status-red">{error}</p>}

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

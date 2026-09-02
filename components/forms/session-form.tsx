"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
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
    <form onSubmit={handleSubmit} className="rounded-panel bg-card p-6 flex flex-col gap-4">
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

      {error && <p className="text-console-meta text-status-red">{error}</p>}

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

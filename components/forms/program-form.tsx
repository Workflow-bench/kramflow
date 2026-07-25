"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/tv/section-label";
import type { ProgramInput } from "@/lib/validation/program";
import { cn } from "@/lib/utils";

const EMPTY: ProgramInput = {
  sessionId: "",
  sectionLabel: null,
  type: "item",
  name: "",
  description: null,
  presenter: null,
  presenterRequirement: null,
  presenterContact: null,
  duration: 0,
  startTime: null,
  endTime: null,
  audioMics: false,
  audioTrack: false,
  videoSidescreen: "none",
  backdrop: false,
  videoPptNeeded: false,
  hallLights: null,
  stageLights: null,
  cameraAngle: null,
  props: null,
  curtains: null,
  remarks: null,
  status: "confirmed",
  colorTag: null,
};

interface ProgramFormProps {
  sessionId: string;
  sessionOptions: { id: string; label: string }[];
  programId?: string; // present -> edit (PATCH), absent -> create (POST)
  initial?: Partial<ProgramInput>;
  // The row's version as of when this form was opened — required for edits.
  // Confirmed live that without this, two people editing the same item
  // within the same stale-data window silently overwrite each other with
  // no error to either party (the form PATCHes its whole snapshot, not a
  // diff). See app/api/programs/[id]/route.ts's optimistic-concurrency
  // check, same pattern as live_state/display_state.
  version?: number;
  onSaved: () => void;
  onCancel: () => void;
}

export function ProgramForm({ sessionId, sessionOptions, programId, initial, version, onSaved, onCancel }: ProgramFormProps) {
  const [values, setValues] = useState<ProgramInput>({ ...EMPTY, ...initial, sessionId });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ProgramInput>(key: K, value: ProgramInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const res = await fetch(programId ? `/api/programs/${programId}` : "/api/programs", {
        method: programId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(programId ? { ...values, version } : values),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setErrors({ form: [data.error ?? "This item was changed by someone else — reload the cue sheet and try again"] });
        } else {
          setErrors(data.errors?.fieldErrors ?? {});
        }
        return;
      }
      onSaved();
    } catch {
      setErrors({ form: ["Something went wrong. Try again."] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div>
        <SectionLabel>Basics</SectionLabel>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Item name" error={errors.name}>
            <Input value={values.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Type">
            <select
              value={values.type}
              onChange={(e) => set("type", e.target.value as ProgramInput["type"])}
              className={selectClass}
            >
              <option value="item">Item</option>
              <option value="break">Break</option>
            </select>
          </Field>
          <Field label="Session">
            <select value={values.sessionId} onChange={(e) => set("sessionId", e.target.value)} className={selectClass}>
              {sessionOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Section label">
            <Input value={values.sectionLabel ?? ""} onChange={(e) => set("sectionLabel", e.target.value || null)} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Input value={values.description ?? ""} onChange={(e) => set("description", e.target.value || null)} />
          </Field>
          <Field label="Status">
            <select
              value={values.status}
              onChange={(e) => set("status", e.target.value as ProgramInput["status"])}
              className={selectClass}
            >
              <option value="confirmed">Confirmed</option>
              <option value="draft">Draft</option>
              <option value="cut">Cut</option>
              <option value="tbd">TBD</option>
            </select>
          </Field>
          <Field label="Color tag">
            <Input value={values.colorTag ?? ""} onChange={(e) => set("colorTag", e.target.value || null)} placeholder="e.g. needs-confirmation" />
          </Field>
        </div>
      </div>

      <div>
        <SectionLabel>Presenter</SectionLabel>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Presenter">
            <Input value={values.presenter ?? ""} onChange={(e) => set("presenter", e.target.value || null)} />
          </Field>
          <Field label="Contact">
            <Input value={values.presenterContact ?? ""} onChange={(e) => set("presenterContact", e.target.value || null)} placeholder="Phone / walkie channel" />
          </Field>
          <Field label="Requirement" className="sm:col-span-2">
            <Input value={values.presenterRequirement ?? ""} onChange={(e) => set("presenterRequirement", e.target.value || null)} />
          </Field>
        </div>
      </div>

      <div>
        <SectionLabel>Timing</SectionLabel>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Start time">
            <Input value={values.startTime ?? ""} onChange={(e) => set("startTime", e.target.value || null)} placeholder="5:00 PM" />
          </Field>
          <Field label="End time">
            <Input value={values.endTime ?? ""} onChange={(e) => set("endTime", e.target.value || null)} placeholder="5:15 PM" />
          </Field>
          <Field label="Duration (min)" error={errors.duration}>
            <Input
              type="number"
              min={0}
              value={values.duration}
              onChange={(e) => set("duration", Number(e.target.value))}
            />
          </Field>
        </div>
      </div>

      <div>
        <SectionLabel>Production</SectionLabel>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Sidescreen">
            <select
              value={values.videoSidescreen}
              onChange={(e) => set("videoSidescreen", e.target.value as ProgramInput["videoSidescreen"])}
              className={selectClass}
            >
              <option value="none">None</option>
              <option value="slides">Slides</option>
              <option value="live_feed">Live Feed</option>
            </select>
          </Field>
          <Field label="Camera angle">
            <Input value={values.cameraAngle ?? ""} onChange={(e) => set("cameraAngle", e.target.value || null)} />
          </Field>
          <Field label="Hall lights">
            <Input value={values.hallLights ?? ""} onChange={(e) => set("hallLights", e.target.value || null)} />
          </Field>
          <Field label="Stage lights">
            <Input value={values.stageLights ?? ""} onChange={(e) => set("stageLights", e.target.value || null)} />
          </Field>
          <Field label="Props">
            <Input value={values.props ?? ""} onChange={(e) => set("props", e.target.value || null)} placeholder="Left / Right" />
          </Field>
          <Field label="Curtains">
            <select
              value={values.curtains ?? ""}
              onChange={(e) => set("curtains", (e.target.value || null) as ProgramInput["curtains"])}
              className={selectClass}
            >
              <option value="">—</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-5">
          <Checkbox label="Mic needed" checked={values.audioMics} onChange={(v) => set("audioMics", v)} />
          <Checkbox label="Audio track" checked={values.audioTrack} onChange={(v) => set("audioTrack", v)} />
          <Checkbox label="Backdrop" checked={values.backdrop} onChange={(v) => set("backdrop", v)} />
          <Checkbox label="PPT needed" checked={values.videoPptNeeded} onChange={(v) => set("videoPptNeeded", v)} />
        </div>
      </div>

      <div>
        <SectionLabel>Remarks</SectionLabel>
        <div className="mt-3">
          <textarea
            value={values.remarks ?? ""}
            onChange={(e) => set("remarks", e.target.value || null)}
            rows={3}
            className="w-full rounded-lg bg-background border border-white/10 px-3.5 py-2.5 text-[15px] text-primary placeholder:text-muted-2 outline-none focus:border-white/25 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background resize-none"
          />
        </div>
      </div>

      {errors.form && <p className="text-caption text-status-red">{errors.form.join(", ")}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : programId ? "Save changes" : "Add item"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const selectClass =
  "h-10 w-full rounded-lg bg-background border border-white/10 px-3.5 text-[15px] text-primary outline-none focus:border-white/25 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors cursor-pointer";

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string[];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-caption text-muted-2">{label}</span>
      {children}
      {error && error.length > 0 && <span className="text-caption text-status-red">{error.join(", ")}</span>}
    </label>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-background accent-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      />
      <span className="text-caption text-muted">{label}</span>
    </label>
  );
}

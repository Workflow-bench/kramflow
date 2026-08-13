"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ColorTagPicker } from "@/components/ui/color-tag-picker";
import { Select } from "@/components/ui/select";
import type { ProgramInput } from "@/lib/validation/program";
import type { Partition } from "@/lib/types";
import { DEFAULT_CONFIG, ALWAYS_REQUIRED_KEYS, resolveVisibility, type FormFieldConfig } from "@/lib/form-config";
import { cn } from "@/lib/utils";

const EMPTY: ProgramInput = {
  sessionId: "",
  sectionLabel: null,
  partitionId: null,
  type: "item",
  name: "",
  description: null,
  presenter: null,
  presenterRequirement: null,
  presenterContact: null,
  duration: 0,
  startTime: null,
  endTime: null,
  timeIsComputed: false,
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
  auditoriumId: null,
};

const GROUP_ORDER = ["Basics", "Presenter", "Timing", "Production", "Remarks"] as const;

type Values = Record<string, unknown>;

function isEmpty(field: FormFieldConfig, value: unknown): boolean {
  if (field.type === "checkbox") return false; // a boolean has no "empty" state
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return Number.isNaN(value);
  return false;
}

interface ProgramFormProps {
  sessionId: string;
  sessionOptions: { id: string; label: string }[];
  // Keyed by session id so the section picker can update when the form's
  // own "Session" dropdown changes — a partition belongs to exactly one
  // session, same as items do.
  partitionsBySession: Record<string, Partition[]>;
  // Keyed by session id too, for the same reason — which event's form
  // config applies depends on which session is currently selected.
  eventNameBySession: Record<string, string>;
  auditoriums: { id: string; name: string }[];
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

// Item 6d — this form has no hardcoded field list anymore. It renders
// whatever lib/form-config.ts's DEFAULT_CONFIG (or a per-event override
// fetched from /api/event-form-configs) says to, in the order and
// groups the config declares. Item 6c ("production fields depend on
// auditorium/program type") is just a visibleIf condition on a field —
// no separate mechanism.
export function ProgramForm({
  sessionId,
  sessionOptions,
  partitionsBySession,
  eventNameBySession,
  auditoriums,
  programId,
  initial,
  version,
  onSaved,
  onCancel,
}: ProgramFormProps) {
  const [values, setValues] = useState<ProgramInput>({ ...EMPTY, ...initial, sessionId });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [configFields, setConfigFields] = useState<FormFieldConfig[]>(DEFAULT_CONFIG);

  const eventName = eventNameBySession[values.sessionId];

  useEffect(() => {
    // Reset happens via the fetch's own resolution (falling back to
    // DEFAULT_CONFIG on a 404/empty config below), not synchronously here —
    // calling setState directly in an effect body triggers a needless extra
    // render. configFields already starts at DEFAULT_CONFIG, which is the
    // correct state for the !eventName case too.
    if (!eventName) return;
    let cancelled = false;
    fetch(`/api/event-form-configs/${encodeURIComponent(eventName)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const fields = data?.config?.fields;
        setConfigFields(Array.isArray(fields) && fields.length > 0 ? fields : DEFAULT_CONFIG);
      })
      .catch(() => {
        if (!cancelled) setConfigFields(DEFAULT_CONFIG);
      });
    return () => {
      cancelled = true;
    };
  }, [eventName]);

  function set(key: string, value: unknown) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function optionsFor(field: FormFieldConfig) {
    if (field.key === "sessionId") return sessionOptions.map((s) => ({ value: s.id, label: s.label }));
    if (field.key === "partitionId") {
      return [
        { value: "", label: "No section" },
        ...(partitionsBySession[values.sessionId] ?? []).map((p) => ({ value: p.id, label: p.label })),
      ];
    }
    if (field.key === "auditoriumId") {
      return [{ value: "", label: "No auditorium" }, ...auditoriums.map((a) => ({ value: a.id, label: a.name }))];
    }
    return field.options ?? [];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const valuesAsRecord = values as unknown as Values;
    const missing = configFields.filter(
      (f) => resolveVisibility(f, valuesAsRecord) && f.required && isEmpty(f, valuesAsRecord[f.key])
    );
    if (missing.length > 0) {
      setErrors(Object.fromEntries(missing.map((f) => [f.key, [`${f.label} is required`]])));
      return;
    }

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

  const valuesAsRecord = values as unknown as Values;
  const visibleFields = configFields.filter((f) => resolveVisibility(f, valuesAsRecord));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {GROUP_ORDER.map((group) => {
        const fields = visibleFields.filter((f) => f.group === group);
        if (fields.length === 0) return null;
        return (
          // Each group is a labelled band with a rule, not another card.
          // A config-driven form can produce any number of groups, and
          // nesting cards inside the panel this form already sits in would
          // stack three surfaces deep for no gain.
          <section key={group} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-console-label text-muted-2 shrink-0">{group}</h3>
              <span aria-hidden="true" className="flex-1 h-px bg-line-soft" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              {fields.map((field) => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={valuesAsRecord[field.key]}
                  options={optionsFor(field)}
                  error={errors[field.key]}
                  onChange={(v) => set(field.key, v)}
                  timeIsComputed={values.timeIsComputed}
                  onToggleComputed={(v) => set("timeIsComputed", v)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {errors.form && (
        <p role="alert" className="text-console-meta text-status-red">
          {errors.form.join(", ")}
        </p>
      )}

      {/* Sticky footer — a config-driven form can run long enough that the
          save control scrolls out of reach, and this one is reached from a
          list you were mid-task in. */}
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-1 flex items-center gap-2 border-t border-line-soft bg-card/95 backdrop-blur-sm px-5 py-3">
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          {programId ? "Save changes" : "Add item"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function FieldRenderer({
  field,
  value,
  options,
  error,
  onChange,
  timeIsComputed,
  onToggleComputed,
}: {
  field: FormFieldConfig;
  value: unknown;
  options: { value: string; label: string }[];
  error?: string[];
  onChange: (value: unknown) => void;
  timeIsComputed: boolean;
  onToggleComputed: (v: boolean) => void;
}) {
  const wide = field.type === "textarea" || field.key === "colorTag";
  const requiredMark = ALWAYS_REQUIRED_KEYS.has(field.key) || field.required;

  if (field.type === "checkbox") {
    return (
      <div className="sm:col-span-2 flex items-center">
        <Checkbox label={field.label} checked={Boolean(value)} onChange={onChange} />
      </div>
    );
  }

  if (field.type === "color-swatch") {
    return (
      <Field label={field.label} error={error} className="sm:col-span-2">
        <ColorTagPicker value={(value as string | null) ?? null} onChange={onChange} aria-label={field.label} />
      </Field>
    );
  }

  if (field.type === "select") {
    return (
      <Field label={field.label} error={error}>
        <Select
          value={(value as string | null) ?? ""}
          // The "none" option in an optional select carries "" as its
          // value, but the API validates partitionId/auditoriumId as
          // nullable UUIDs — sending "" failed Zod with "Invalid UUID" and
          // returned a 400, so picking "No section" or "No auditorium" and
          // saving was simply broken. Normalise the empty option back to
          // null here, where every config-driven select passes through.
          onChange={(v) => onChange(v === "" ? null : v)}
          options={options}
          placeholder={`Choose ${field.label.toLowerCase()}…`}
          aria-label={field.label}
        />
      </Field>
    );
  }

  if (field.type === "duration") {
    return (
      <Field label={field.label} error={error} className="sm:col-span-2">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <Input
            type="number"
            min={0}
            value={(value as number) ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </div>
        <div className="mt-2">
          <Checkbox
            label="Compute from duration (cascades off the previous item / section start)"
            checked={timeIsComputed}
            onChange={onToggleComputed}
          />
        </div>
      </Field>
    );
  }

  if (field.type === "textarea") {
    return (
      <Field label={field.label} error={error} className="sm:col-span-2">
        <textarea
          value={(value as string | null) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          rows={3}
          className="w-full rounded-control bg-background border border-line px-3 py-2 text-console-sm text-primary placeholder:text-muted-2 outline-none resize-y min-h-[4.5rem] transition-[border-color,box-shadow] duration-[140ms] focus:border-accent focus:ring-[3px] focus:ring-accent/15"
        />
      </Field>
    );
  }

  // "text" / "number" — startTime/endTime disable while timeIsComputed is
  // on, same as before (they're derived, editing them would be discarded).
  const isTimeField = field.key === "startTime" || field.key === "endTime";
  return (
    <Field label={field.label} error={error} className={wide ? "sm:col-span-2" : undefined}>
      <Input
        type={field.type === "number" ? "number" : "text"}
        value={(value as string | number | null) ?? ""}
        onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value || null)}
        required={requiredMark && field.key === "name"}
        disabled={isTimeField && timeIsComputed}
      />
    </Field>
  );
}

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
    <label className={cn("flex flex-col gap-1.5 min-w-0", className)}>
      <span className="text-console-meta text-muted-2">{label}</span>
      {children}
      {error && error.length > 0 && (
        <span role="alert" className="text-console-meta text-status-red">
          {error.join(", ")}
        </span>
      )}
    </label>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 rounded-[3px] border-line bg-background accent-accent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      />
      <span className="text-console-meta text-muted">{label}</span>
    </label>
  );
}

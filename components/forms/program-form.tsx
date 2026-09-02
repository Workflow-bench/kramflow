"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ColorTagPicker } from "@/components/ui/color-tag-picker";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import type { ProgramInput } from "@/lib/validation/program";
import type { Partition } from "@/lib/types";
import { DEFAULT_CONFIG, ALWAYS_REQUIRED_KEYS, resolveVisibility, type FormFieldConfig } from "@/lib/form-config";
import { useItemEditingPresence } from "@/lib/use-item-editing-presence";
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
  // The cue sheet editor now always operates within exactly one event
  // (see app/(operator)/e/[eventId]/) — one eventId for the whole form,
  // not per-session, since every session it can pick from already belongs
  // to this same event.
  eventId: string;
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
  // Fired whenever the form gains or loses unsaved changes, so the parent
  // (which owns the Modal wrapping this form) can gate its own close
  // affordances — backdrop click, the X button, Escape — behind a confirm
  // step instead of discarding silently. See app/e/[eventId]/operator/
  // cue-sheet/page.tsx's requestClosePanel.
  onDirtyChange?: (dirty: boolean) => void;
}

// Item 6d — this form has no hardcoded field list anymore. It renders
// whatever lib/form-config.ts's DEFAULT_CONFIG (or a per-event override
// fetched from /api/events/[eventId]'s form_config column) says to, in the
// order and groups the config declares. Item 6c ("production fields depend
// on auditorium/program type") is just a visibleIf condition on a field —
// no separate mechanism.
export function ProgramForm({
  sessionId,
  sessionOptions,
  partitionsBySession,
  eventId,
  auditoriums,
  programId,
  initial,
  version,
  onSaved,
  onCancel,
  onDirtyChange,
}: ProgramFormProps) {
  const [values, setValues] = useState<ProgramInput>({ ...EMPTY, ...initial, sessionId });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Report finding #36 — proactive half of the concurrent-editing warning;
  // the reactive half (a 409 on Save if someone else's edit already landed)
  // already existed below. null for a brand-new item (programId undefined)
  // since two people can't collide creating the same not-yet-existing row.
  const othersEditing = useItemEditingPresence(eventId, programId ?? null);

  useEffect(() => {
    onDirtyChange?.(dirty);
    // Runs once more on unmount so a closed form never leaves the parent
    // thinking it's still dirty.
    return () => onDirtyChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDirtyChange is a setState setter from the parent, stable across renders
  }, [dirty]);
  const [configFields, setConfigFields] = useState<FormFieldConfig[]>(DEFAULT_CONFIG);
  // Layer 3 of the Add Item disclosure grammar (docs/DESIGN.md) — collapsed
  // until Auditorium is set, since almost none of "Production" means
  // anything without it. Starts open only when editing an item that
  // already has one (initial?.auditoriumId), never re-forced-closed once a
  // user has opened it manually — only auditoriumId being empty forces it
  // closed, never state alone.
  const [productionOpen, setProductionOpen] = useState(() => Boolean(initial?.auditoriumId));

  useEffect(() => {
    // Reset happens via the fetch's own resolution (falling back to
    // DEFAULT_CONFIG on a 404/empty config below), not synchronously here —
    // calling setState directly in an effect body triggers a needless extra
    // render. configFields already starts at DEFAULT_CONFIG, which is the
    // correct state for the no-custom-config case too.
    let cancelled = false;
    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const fields = data?.event?.form_config?.fields;
        setConfigFields(Array.isArray(fields) && fields.length > 0 ? fields : DEFAULT_CONFIG);
      })
      .catch(() => {
        if (!cancelled) setConfigFields(DEFAULT_CONFIG);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  function set(key: string, value: unknown) {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty(true);
    // Choosing an Auditorium is what makes Production Requirements
    // meaningful at all — open the section the moment it gains a value,
    // rather than making the operator pick Auditorium and then separately
    // remember to expand a still-collapsed section right below it.
    if (key === "auditoriumId" && value) setProductionOpen(true);
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
        body: JSON.stringify(programId ? { ...values, eventId, version } : { ...values, eventId }),
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
      setDirty(false);
      onSaved();
    } catch {
      setErrors({ form: ["Something went wrong. Try again."] });
    } finally {
      setSaving(false);
    }
  }

  const valuesAsRecord = values as unknown as Values;
  const visibleFields = configFields.filter((f) => resolveVisibility(f, valuesAsRecord));

  const auditoriumSet = Boolean(values.auditoriumId);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {othersEditing && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-panel border border-status-orange/30 bg-status-orange/10 px-4 py-3 text-console-sm text-status-orange"
        >
          <Users className="h-4 w-4 shrink-0" strokeWidth={2} />
          Another operator has this item open right now. If you both save, whoever saves second will be asked to
          reload and redo their changes.
        </div>
      )}
      {GROUP_ORDER.map((group) => {
        const fields = visibleFields.filter((f) => f.group === group);
        if (fields.length === 0) return null;

        // Layer 3 of the disclosure grammar: "Production" splits into the
        // one field that gates the rest (Auditorium — always visible,
        // rendered like any other Layer-2 field) and everything else,
        // which collapses until Auditorium has a value. Every other group
        // renders exactly as before — this only changes "Production".
        if (group === "Production") {
          const auditoriumField = fields.find((f) => f.key === "auditoriumId");
          const restFields = fields.filter((f) => f.key !== "auditoriumId");
          return (
            <section key={group} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-console-label text-muted-2 shrink-0">{group}</h3>
                <span aria-hidden="true" className="flex-1 h-px bg-line-soft" />
              </div>

              {auditoriumField && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  <FieldRenderer
                    field={auditoriumField}
                    value={valuesAsRecord[auditoriumField.key]}
                    options={optionsFor(auditoriumField)}
                    error={errors[auditoriumField.key]}
                    onChange={(v) => set(auditoriumField.key, v)}
                    timeIsComputed={values.timeIsComputed}
                    onToggleComputed={(v) => set("timeIsComputed", v)}
                  />
                </div>
              )}

              {restFields.length > 0 && (
                <div className="rounded-panel border border-line-soft overflow-hidden">
                  <button
                    type="button"
                    onClick={() => auditoriumSet && setProductionOpen((o) => !o)}
                    disabled={!auditoriumSet}
                    aria-expanded={auditoriumSet && productionOpen}
                    className={cn(
                      "w-full flex items-center gap-2 px-4 py-3 text-left text-console-sm",
                      auditoriumSet ? "text-muted cursor-pointer hover:text-primary" : "text-muted-2 cursor-not-allowed"
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform duration-[180ms]",
                        auditoriumSet && productionOpen && "rotate-90"
                      )}
                      strokeWidth={2}
                    />
                    Production Requirements
                    {!auditoriumSet && <span className="text-console-meta italic">— select an auditorium to configure</span>}
                  </button>
                  {auditoriumSet && productionOpen && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4 pt-1 border-t border-line-soft">
                      {restFields.map((field) => (
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
                  )}
                </div>
              )}
            </section>
          );
        }

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

      {/* Reserves clearance for the sticky footer below — without it, the
          footer's own translucent background (bg-card/95, deliberately
          see-through so it never looks like a hard-opaque bar) let the last
          field's content show through behind the buttons once scrolled
          near the bottom, on any event with enough dynamic Production
          fields to make the form taller than the viewport (2026-09-01
          UI/UX audit, P1 finding #9 — reproduced on mobile at 390×844).
          `sticky` only ever "sticks" relative to *its own* container's
          scroll range; nothing about it reserves the space a fixed footer
          would, so the space has to be added explicitly. */}
      <div aria-hidden="true" className="h-16 -mb-8" />

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
      <FormField label={field.label} error={error} className="sm:col-span-2">
        <ColorTagPicker value={(value as string | null) ?? null} onChange={onChange} aria-label={field.label} />
      </FormField>
    );
  }

  if (field.type === "select") {
    return (
      <FormField label={field.label} error={error}>
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
      </FormField>
    );
  }

  if (field.type === "duration") {
    return (
      <FormField label={field.label} error={error} className="sm:col-span-2">
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
      </FormField>
    );
  }

  if (field.type === "textarea") {
    return (
      <FormField label={field.label} error={error} className="sm:col-span-2">
        <Textarea
          value={(value as string | null) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          rows={3}
          className="min-h-[4.5rem]"
        />
      </FormField>
    );
  }

  // "text" / "number" — startTime/endTime disable while timeIsComputed is
  // on, same as before (they're derived, editing them would be discarded).
  const isTimeField = field.key === "startTime" || field.key === "endTime";
  return (
    <FormField label={field.label} error={error} className={wide ? "sm:col-span-2" : undefined}>
      <Input
        type={field.type === "number" ? "number" : "text"}
        value={(value as string | number | null) ?? ""}
        onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value || null)}
        required={requiredMark && field.key === "name"}
        disabled={isTimeField && timeIsComputed}
      />
    </FormField>
  );
}

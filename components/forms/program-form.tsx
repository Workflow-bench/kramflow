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
import { SectionLabel } from "@/components/ui/section-label";
import type { ProgramInput } from "@/lib/validation/program";
import type { Partition } from "@/lib/types";
import { DEFAULT_CONFIG, ALWAYS_REQUIRED_KEYS, resolveVisibility, type FormFieldConfig } from "@/lib/form-config";
import { useItemEditingPresence } from "@/lib/use-item-editing-presence";
import { parseTimeLabel, formatMinutesToLabel } from "@/lib/schedule";
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
  // Defaults on: without it, a brand-new item's duration has no effect on
  // its own end time or on anything scheduled after it (lib/schedule.ts's
  // cascade only touches timeIsComputed rows) — an operator adding an item
  // and typing a duration reasonably expects the schedule to just work,
  // not to also have to find and check a box. Existing items keep whatever
  // value they already have; this only changes what a *new* item starts as.
  timeIsComputed: true,
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
    setValues((v) => {
      const next = { ...v, [key]: value };
      // Keep duration/startTime/endTime mutually consistent as the operator
      // types, instead of three fields that only agree once you've manually
      // updated all three yourself. Only applies to a literal (not
      // timeIsComputed) item — a computed item's start/end are disabled and
      // derived server-side by lib/schedule.ts's cascade off the previous
      // item/section start, which already re-runs (and reaches every later
      // computed item in the session) on every save.
      if (!next.timeIsComputed) {
        const start = parseTimeLabel(next.startTime ?? null);
        const end = parseTimeLabel(next.endTime ?? null);
        if (key === "duration") {
          const duration = Number(value) || 0;
          if (start !== null) next.endTime = formatMinutesToLabel(start + duration);
          else if (end !== null) next.startTime = formatMinutesToLabel(end - duration);
        } else if (key === "startTime") {
          // Moving the start shifts the end, preserving the duration that
          // was already set — the same "drag the whole block" behavior a
          // calendar gives you, not a resize.
          if (start !== null) next.endTime = formatMinutesToLabel(start + (next.duration || 0));
        } else if (key === "endTime") {
          // Moving the end resizes the block instead — duration follows,
          // start stays put. Negative/zero results are left for the
          // existing min:0 validation on submit rather than silently
          // clamped here, so a genuine mistake is still visible.
          if (start !== null && end !== null) next.duration = end - start;
        }
      }
      return next;
    });
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
          setErrors({ form: [data.error ?? "This item was changed by someone else. Reload the cue sheet and try again."] });
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
    // h-full so the scrollable region below can size itself against the
    // Modal's own bounded height (Modal renders this with scrollBody=false
    // — see its doc comment for why the footer can't just live inside a
    // sticky-positioned div in the scrolling region below).
    <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
    <div className="flex flex-1 min-h-0 flex-col gap-8 overflow-y-auto px-6 pb-6">
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
                <SectionLabel className="shrink-0">{group}</SectionLabel>
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
                    {!auditoriumSet && <span className="text-console-meta italic">: select an auditorium to configure</span>}
                  </button>
                  {/* Kept mounted (not conditionally unmounted) so the close
                      transition is as real as the open one, not an instant
                      snap. grid-template-rows 0fr->1fr animates a "height:
                      auto" target CSS alone can't transition directly; the
                      inner overflow-hidden clips the fields while collapsed.
                      Blur+opacity cross-fade (not just opacity) masks the
                      reveal so newly-appearing rows don't read as a layout
                      pop — see the design-eng skill's "use blur to mask
                      imperfect transitions" note. `inert` while collapsed
                      keeps these fields out of both tab order and the
                      accessibility tree — without it a screen reader or
                      keyboard user could reach fields that are visually
                      clipped to zero height. */}
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-200 ease-out",
                      auditoriumSet && productionOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                  >
                    <div className="overflow-hidden" inert={!(auditoriumSet && productionOpen)}>
                      <div
                        className={cn(
                          "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4 pt-1 border-t border-line-soft",
                          "transition-[filter,opacity] duration-200 ease-out",
                          auditoriumSet && productionOpen ? "opacity-100 blur-none" : "opacity-0 blur-[2px]"
                        )}
                      >
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
                    </div>
                  </div>
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
              <SectionLabel className="shrink-0">{group}</SectionLabel>
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
    </div>

      {/* A real flex sibling below the scrollable region above, not a
          `position: sticky` element living inside it. Sticky content never
          reserves space — it just always stays visible on top of whatever
          scrolls behind it, which means a sticky footer *inside* the
          scrolling area overlaps whatever field is currently in view at
          any scroll position, not just once you've reached the bottom
          (confirmed live: it covered Start/End/Duration while sitting at
          the very top of a short form, then covered Remarks once scrolled
          further — same root cause, just a different field each time).
          Moving it out here, as a shrink-0 sibling of the flex-1 scroll
          region, makes the overlap structurally impossible instead of
          something to keep re-tuning a spacer against. */}
      <div className="flex shrink-0 items-center gap-2 border-t border-line-soft bg-card/95 backdrop-blur-sm px-6 py-3">
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
            label="Auto-schedule (cascades off the previous item / section start — off pins this item's start/end so later edits upstream never move it)"
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
        // Auto-scheduled items derive start/end from duration + the previous
        // item on save (lib/schedule.ts) — this form has no sibling-item
        // data to preview that number, so say so rather than leaving a
        // disabled field blank with no explanation.
        placeholder={isTimeField && timeIsComputed ? "Computed on save" : undefined}
      />
    </FormField>
  );
}

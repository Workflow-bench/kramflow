"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
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
import { SAVE_WAIT_MS, describeSaveCheck } from "@/lib/save-check";
import { SaveSession, type SaveEffect } from "@/lib/save-attempt";

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

// F07 (2026-10 review): a render-time arrangement over whatever field config
// the event uses — the config itself (keys, types, requiredness, visibleIf)
// is untouched, so per-event custom configs keep working.
//   1. Cue essentials: identity, placement, status and timing, plus any
//      field the config marks required (never hidden behind a disclosure).
//   2. Details: everything else that isn't Production, collapsed with a
//      summary of what's filled in.
//   3. Production: the existing auditorium-gated disclosure, unchanged.
const ESSENTIAL_ORDER = ["name", "type", "sessionId", "partitionId", "status", "duration", "startTime", "endTime"];

// Fixed, actionable form-level copy for a failed save (F04). Server error
// text is never shown verbatim (it can carry database or stack details);
// field-level messages from validation still render beside their fields.
function failureMessage(status: number): string {
  if (status === 400 || status === 422) return "Some fields need attention. Fix them and save again.";
  if (status === 401) return "Your session has expired. Log in again in another tab, then save. Your changes are still here.";
  if (status === 403) return "You don't have permission to edit cues in this event. Ask the event owner for editor access.";
  if (status === 429) return "Too many saves in a short time. Wait a moment, then save again.";
  if (status >= 500) return "The server couldn't save this cue right now. Your changes are still here, so try saving again.";
  return "This cue couldn't be saved. Your changes are still here, so try again.";
}

function displayLabel(field: FormFieldConfig): string {
  // User-facing vocabulary is Cue; the default config predates it.
  if (field.key === "name" && field.label === "Item name") return "Cue name";
  return field.label;
}

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
  /** A save was confirmed without the form closing through onSaved — a late
   *  answer, an earlier attempt, edits made after submitting, or an answer
   *  that arrives after the form was closed. Refresh `sessionId`'s list if
   *  it's still the one shown. */
  onServerChanged?: (sessionId: string) => void;
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
  onServerChanged,
}: ProgramFormProps) {
  const [values, setValues] = useState<ProgramInput>({ ...EMPTY, ...initial, sessionId });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [reconcileNote, setReconcileNote] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  // A definite success the user should read before closing (a late answer,
  // or a save that went through while an earlier attempt was unresolved).
  const [confirmed, setConfirmed] = useState<{ title: string; body: string } | null>(null);
  const confirmedRef = useRef<HTMLDivElement>(null);
  // Outcome of an earlier timed-out attempt that finished after a resubmit.
  const [earlierNote, setEarlierNote] = useState<string | null>(null);
  // Attempt lifecycle (deadline, which attempt an answer belongs to, check
  // sequencing, draft revision) lives in lib/save-attempt.ts; this form only
  // renders its effects. A confirmed save clears "unsaved changes" only if
  // the draft is still the revision that was sent.
  const [session] = useState(() => new SaveSession({ deadlineMs: SAVE_WAIT_MS }));
  // Production fields that have ever had an error stay pinned outside the
  // disclosure, so clearing errors on the next submit doesn't move them.
  const [pinnedKeys, setPinnedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const detailsFieldsId = useId();
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  // Bumped on every failed save; the effect focuses the summary after React
  // has committed it (a timer could fire before the summary exists).
  const [errorFocusTick, setErrorFocusTick] = useState(0);
  useEffect(() => {
    if (errorFocusTick > 0) errorSummaryRef.current?.focus();
  }, [errorFocusTick]);

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
    session.noteEdit();
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

  // Shows errors, opens any collapsed group holding one, and moves focus to
  // the summary so keyboard and screen-reader users land on the explanation.
  function showErrors(next: Record<string, string[]>) {
    setErrors(next);
    const errored = Object.keys(next).filter((k) => k !== "form");
    if (errored.some((k) => !pinnedKeys.has(k))) setPinnedKeys((prev) => new Set([...prev, ...errored]));
    // Derived from this event's own config, so custom fields open too.
    const keys = Object.keys(next).filter((k) => k !== "form");
    const groupOf = (k: string) => configFields.find((f) => f.key === k);
    if (keys.some((k) => { const f = groupOf(k); return f && f.group !== "Production" && !ESSENTIAL_ORDER.includes(f.key) && !f.required && !ALWAYS_REQUIRED_KEYS.has(f.key); }))
      setDetailsOpen(true);
    if (keys.some((k) => groupOf(k)?.group === "Production")) setProductionOpen(true);
    setErrorFocusTick((t) => t + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (confirmed) return;

    const valuesAsRecord = values as unknown as Values;
    const missing = configFields.filter(
      (f) => resolveVisibility(f, valuesAsRecord) && f.required && isEmpty(f, valuesAsRecord[f.key])
    );
    if (missing.length > 0) {
      showErrors(Object.fromEntries(missing.map((f) => [f.key, [`${displayLabel(f)} is required`]])));
      return;
    }

    setErrors({});
    setOutcomeUnknown(false);
    setReconcileNote(null);
    setCheckCount(0);
    setConfirmed(null);
    // No AbortController: aborting wouldn't stop the server committing, and
    // a request left running lets a late answer still be reported. Never
    // re-sent automatically.
    const body = JSON.stringify(programId ? { ...values, eventId, version } : { ...values, eventId });
    await session.submit({ name: values.name, sessionId: values.sessionId, version }, () =>
      fetch(programId ? `/api/programs/${programId}` : "/api/programs", {
        method: programId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })
    );
  }

  function markOutcomeUnknown(message: string) {
    setOutcomeUnknown(true);
    setReconcileNote(null);
    showErrors({ form: [message] });
  }

  // Applies one effect from the save session. Answers arrive already bound
  // to their attempt: "current", "late" (current, after the form stopped
  // waiting) or "earlier" (superseded by a newer submit).
  function handleEffect(effect: SaveEffect) {
    const unknownWhat = programId ? "this edit may or may not have saved" : "this cue may or may not have been added";
    const keep = programId ? "Check below before saving again." : "Check below before adding it again.";
    switch (effect.type) {
      case "saving":
        setSaving(effect.value);
        return;
      case "checking":
        setReconciling(effect.value);
        return;
      case "check":
        setReconcileNote(describeSaveCheck(effect.result, effect.snapshot.name));
        setCheckCount((n) => n + 1);
        return;
      case "unknown":
        markOutcomeUnknown(
          effect.reason === "timeout"
            ? `No answer from the server after ${Math.round(SAVE_WAIT_MS / 1000)} seconds. The request wasn’t cancelled, so ${unknownWhat}. Your changes are still here. ${keep}`
            : `The connection dropped before the server answered, so ${unknownWhat}. Your changes are still here. ${keep}`
        );
        return;
      case "answer":
        break;
    }
    const { kind, status, revisionMatches } = effect;
    switch (kind) {
      case "earlier-accepted":
        setEarlierNote(
          programId
            ? "An earlier attempt has also finished and the server accepted it. Check the cue in the cue sheet before doing anything else."
            : "An earlier attempt has also finished and the server accepted it, so this session may now have two copies of this cue. Check the cue sheet before doing anything else."
        );
        onServerChanged?.(effect.snapshot.sessionId);
        return;
      case "earlier-error":
        // A 5xx doesn't settle whether an earlier create was added.
        setEarlierNote(
          status >= 500 && !programId
            ? `An earlier attempt has also finished, without a confirmed outcome (status ${status}), so it may also have added this cue. Check the cue sheet for a second copy.`
            : `An earlier attempt has also finished, with an error (status ${status}).`
        );
        return;
      case "unknown-server-error":
        markOutcomeUnknown(
          `The server answered with an error (status ${status}) instead of confirming, so ${unknownWhat}. Your changes are still here. ${keep}`
        );
        return;
      case "conflict":
      case "conflict-maybe-own-attempt":
        setOutcomeUnknown(false);
        showErrors({
          form: [
            kind === "conflict-maybe-own-attempt"
              ? "This cue changed since you opened it. That may be your earlier attempt, which may have saved, or someone else’s edit. Reload the cue sheet and compare before trying again."
              : "This cue was changed by someone else. Reload the cue sheet and try again.",
          ],
        });
        return;
      case "failed":
        setOutcomeUnknown(false);
        // F04: field errors AND a form-level explanation — an error-only
        // payload used to leave the form with nothing on screen at all.
        showErrors({
          ...(effect.fieldErrors ?? {}),
          form: [
            effect.bodyTimedOut && (status === 400 || status === 422)
              ? "The server rejected this save but didn’t say which fields. Check the required fields and save again."
              : failureMessage(status),
          ],
        });
        return;
    }
    // Success. Clear "unsaved changes" only if the draft is still what was
    // sent; newer edits stay protected by the discard prompt.
    if (revisionMatches) setDirty(false);
    if (kind === "saved-close" && revisionMatches) {
      onSaved();
      return;
    }
    // Saving again is blocked (it would add a duplicate cue, or hit a version
    // conflict on an edit), so say how to keep newer edits.
    const newerEdits = revisionMatches
      ? ""
      : " Edits you made after pressing Save aren’t saved. To keep them, copy what you need, close this form (you’ll be asked before anything is discarded), then reopen the cue and apply them.";
    setOutcomeUnknown(false);
    setErrors({});
    // An earlier create that failed without a confirmed outcome (connection
    // dropped, timed out then failed, or 5xx) may also have been added.
    // Possible, not certain — say so without claiming a duplicate exists.
    const unresolvedNote =
      effect.earlierUnresolved > 0
        ? ` An earlier attempt ended without a confirmed outcome (the connection failed or the server returned an error), so it may also have added this cue. Check the cue sheet for a second copy.`
        : "";
    setConfirmed(
      kind === "saved-late"
        ? {
            title: "The server has now confirmed the save.",
            body: `The request you sent earlier finished after the form stopped waiting.${unresolvedNote}${newerEdits}`,
          }
        : kind === "saved-close"
          ? { title: "This save went through.", body: newerEdits.trim() }
          : {
              title: "This save went through.",
              body:
                (kind === "saved-earlier-accepted"
                  ? programId
                    ? "An earlier attempt was also accepted. Check the cue in the cue sheet."
                    : "An earlier attempt was also accepted, so this session may have two copies of this cue. Check the cue sheet." + unresolvedNote
                  : kind === "saved-earlier-unresolved"
                    ? unresolvedNote.trim()
                    : (programId
                        ? "An earlier attempt is still unconfirmed and may also apply. Check the cue in the cue sheet."
                        : "An earlier attempt is still unconfirmed and may also add this cue. Check the cue sheet for a duplicate.") +
                      unresolvedNote) + newerEdits,
            }
    );
    onServerChanged?.(effect.snapshot.sessionId);
  }

  // Fresh props for every effect; on unmount, a detached handler that can
  // only refresh the list. An answer arriving after this form closed must
  // never call onSaved (it would close whatever form is open by then).
  useLayoutEffect(() => {
    session.setHandler(handleEffect);
    const refresh = onServerChanged;
    return () =>
      session.setHandler((effect) => {
        if (effect.type !== "answer") return;
        if (effect.kind === "earlier-accepted" || effect.kind.startsWith("saved-")) refresh?.(effect.snapshot.sessionId);
      });
  });

  // R6: read-only check of what the server shows now (lib/save-check.ts).
  // Observations only, GET only; a result that arrives after a newer submit
  // or check is dropped by the session.
  function reconcile() {
    void session.check(fetch, eventId, { name: values.name, sessionId: values.sessionId, version }, programId);
  }

  // Move focus to a confirmation when it replaces the error summary, so it
  // isn't dropped to <body> with the summary's buttons.
  useEffect(() => {
    if (confirmed) confirmedRef.current?.focus();
  }, [confirmed]);

  const valuesAsRecord = values as unknown as Values;
  const visibleFields = configFields.filter((f) => resolveVisibility(f, valuesAsRecord));

  const auditoriumSet = Boolean(values.auditoriumId);

  const isEssential = (f: FormFieldConfig) =>
    ESSENTIAL_ORDER.includes(f.key) || f.required || ALWAYS_REQUIRED_KEYS.has(f.key);
  const essentialFields = visibleFields
    .filter((f) => f.group !== "Production" && isEssential(f))
    .sort((a, b) => {
      const ia = ESSENTIAL_ORDER.indexOf(a.key);
      const ib = ESSENTIAL_ORDER.indexOf(b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  const detailFields = visibleFields.filter((f) => f.group !== "Production" && !isEssential(f));
  const productionFields = visibleFields.filter((f) => f.group === "Production");
  const filledDetails = detailFields.filter((f) => f.type !== "checkbox" ? !isEmpty(f, valuesAsRecord[f.key]) : Boolean(valuesAsRecord[f.key]));
  const fieldErrorEntries = Object.entries(errors).filter(([k]) => k !== "form");
  const labelFor = (key: string) => {
    const f = configFields.find((c) => c.key === key);
    return f ? displayLabel(f) : key;
  };

  function renderField(field: FormFieldConfig) {
    return (
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
    );
  }

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
      {confirmed && (
        <div
          ref={confirmedRef}
          tabIndex={-1}
          role="status"
          className="shrink-0 rounded-panel border border-status-green/40 bg-status-green/10 px-4 py-3 text-console-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <p className="font-medium text-status-green">{confirmed.title}</p>
          <p className="mt-1">{confirmed.body}</p>
          {earlierNote && <p className="mt-1">{earlierNote}</p>}
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => (dirty ? onCancel() : onSaved())}>
            {/* With newer unsaved edits this goes through the parent's
                discard prompt (same as Cancel, X, Escape and backdrop). */}
            {dirty ? "Close" : "Close and refresh the cue sheet"}
          </Button>
        </div>
      )}
      {earlierNote && !confirmed && (
        <div role="status" className="shrink-0 rounded-panel border border-line px-4 py-3 text-console-sm text-primary">
          {earlierNote}
        </div>
      )}
      {/* F04: one focusable summary for any failed save, listing the fields
          that need attention. Field-level messages still render in place. */}
      {(errors.form || fieldErrorEntries.length > 0) && (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role="alert"
          className="shrink-0 rounded-panel border border-status-red/40 bg-status-red/10 px-4 py-3 text-console-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <p className="font-medium text-status-red">
            {outcomeUnknown ? "Couldn’t confirm this save." : "This cue wasn’t saved."}
          </p>
          {errors.form?.map((m) => (
            <p key={m} className="mt-1">{m}</p>
          ))}
          {outcomeUnknown && (
            <div className="mt-2 flex flex-col gap-2">
              <Button type="button" variant="secondary" size="sm" className="self-start" onClick={reconcile} loading={reconciling}>
                {checkCount === 0 ? "Check what the server shows" : "Check again"}
              </Button>
              {reconcileNote && (
                <p role="status" className="text-muted">
                  {checkCount > 1 && <span className="text-muted-2">Check {checkCount}: </span>}
                  {reconcileNote}
                </p>
              )}
            </div>
          )}
          {fieldErrorEntries.length > 0 && (
            <p className="mt-1 text-muted">
              Check: {fieldErrorEntries.map(([k]) => labelFor(k)).join(", ")}.
            </p>
          )}
        </div>
      )}

      {essentialFields.length > 0 && (
        <section className="shrink-0 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <SectionLabel className="shrink-0">Cue essentials</SectionLabel>
            <span aria-hidden="true" className="flex-1 h-px bg-line-soft" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">{essentialFields.map(renderField)}</div>
        </section>
      )}

      {detailFields.length > 0 && (
        <section className="shrink-0 rounded-panel border border-line-soft overflow-hidden">
          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            aria-expanded={detailsOpen}
            aria-controls={detailsFieldsId}
            className="w-full flex items-center gap-2 px-4 py-3 text-left text-console-sm text-muted cursor-pointer hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          >
            <ChevronRight
              className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-[180ms]", detailsOpen && "rotate-90")}
              strokeWidth={2}
            />
            <span className="text-primary">Details</span>
            <span className="text-console-meta text-muted truncate">
              {filledDetails.length > 0
                ? `· ${filledDetails.map(displayLabel).join(", ")}`
                : `· ${detailFields.map(displayLabel).join(", ").toLowerCase()}`}
            </span>
          </button>
          {/* Kept mounted and inert while closed: values survive collapsing,
              and hidden fields stay out of tab order. */}
          <div
            id={detailsFieldsId}
            className={cn("grid transition-[grid-template-rows] duration-200 ease-out", detailsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
          >
            <div className="overflow-hidden" inert={!detailsOpen}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4 pt-1 border-t border-line-soft">
                {detailFields.map(renderField)}
              </div>
            </div>
          </div>
        </section>
      )}

      {productionFields.length > 0 && (() => {
        // R5: Auditorium plus any configured-required or error-holding
        // production field render ungated, so nothing that can block a save
        // is ever trapped inside the collapsed, Auditorium-gated disclosure.
        // visibleIf is still honored (productionFields is already filtered).
        const ungated = (f: FormFieldConfig) => f.key === "auditoriumId" || f.required || pinnedKeys.has(f.key);
        const auditoriumField = productionFields.find((f) => f.key === "auditoriumId");
        const pinnedFields = productionFields.filter((f) => f.key !== "auditoriumId" && ungated(f));
        const restFields = productionFields.filter((f) => !ungated(f));
        return (
            <section className="shrink-0 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <SectionLabel className="shrink-0">Production</SectionLabel>
                <span aria-hidden="true" className="flex-1 h-px bg-line-soft" />
              </div>

              {(auditoriumField || pinnedFields.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {auditoriumField && renderField(auditoriumField)}
                  {pinnedFields.map(renderField)}
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
      })()}

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
        {/* Once a late answer confirms the earlier save, submitting again
            would add a duplicate (or hit a version conflict on edit). */}
        <Button type="submit" variant="primary" size="sm" loading={saving} disabled={Boolean(confirmed)}>
          {programId ? "Save cue" : "Add cue"}
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
        <Checkbox label={displayLabel(field)} checked={Boolean(value)} onChange={onChange} />
      </div>
    );
  }

  if (field.type === "color-swatch") {
    return (
      <FormField label={displayLabel(field)} error={error} className="sm:col-span-2">
        <ColorTagPicker value={(value as string | null) ?? null} onChange={onChange} aria-label={displayLabel(field)} />
      </FormField>
    );
  }

  if (field.type === "select") {
    return (
      <FormField label={displayLabel(field)} error={error}>
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
          aria-label={displayLabel(field)}
        />
      </FormField>
    );
  }

  if (field.type === "duration") {
    return (
      <FormField label={displayLabel(field)} error={error} className="sm:col-span-2">
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
      <FormField label={displayLabel(field)} error={error} className="sm:col-span-2">
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
    <FormField label={displayLabel(field)} error={error} className={wide ? "sm:col-span-2" : undefined}>
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

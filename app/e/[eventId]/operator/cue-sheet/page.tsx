"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, GripVertical, Plus, Upload, Download, Printer, Pencil, Trash2, CalendarPlus, Settings } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSessions } from "@/lib/use-sessions";
import { useEventId, useEventRole } from "@/lib/event-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { ColorTagPicker } from "@/components/ui/color-tag-picker";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ActionBar,
  ActionBarButton,
  ActionBarClear,
  ActionBarCount,
  ActionBarSeparator,
} from "@/components/ui/action-bar";
import { SectionLabel } from "@/components/tv/section-label";
import { ProgramForm } from "@/components/forms/program-form";
import { SessionForm } from "@/components/forms/session-form";
import { EventSettingsPanel } from "@/components/forms/event-settings-panel";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { ProgramInput } from "@/lib/validation/program";
import type { ParsedProgram, ParsedSession } from "@/lib/parse-cuesheet";
import type { Partition, Session } from "@/lib/types";
import { colorTagLabel, colorTagTone } from "@/lib/color-tags";
import { cn } from "@/lib/utils";

// Above this count, a bulk delete gets a confirm dialog in addition to the
// Undo toast every delete already gets — the toast alone is the right-sized
// guardrail up to a handful of items (matching a single item's own
// guardrail-free delete), but a genuinely large bulk action is a different
// psychological event even with Undo available. docs/DESIGN.md's
// guardrail-tier table.
const BULK_DELETE_CONFIRM_THRESHOLD = 3;

interface ProgramRow extends ParsedProgram {
  id: string;
  version: number;
  time_is_computed: boolean;
  auditorium_id: string | null;
}

interface PartitionGroup {
  partitionId: string | null;
  label: string | null;
  rows: ProgramRow[];
}

// Groups an already sort_order-ordered row list into contiguous runs by
// partitionId — real identity, not the old adjacency-plus-label-string
// comparison (see supabase/schema.sql's partitions table comment). Each
// group becomes its own SortableContext below, which is what actually
// keeps drag-and-drop scoped within a single partition: a group's rows
// are a separate DOM/dnd-kit subtree, so a drag physically can't land in
// a different group.
function groupByPartition(rows: ProgramRow[], partitionLabels: Map<string, string>): PartitionGroup[] {
  const groups: PartitionGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.partitionId === row.partition_id) {
      last.rows.push(row);
    } else {
      groups.push({
        partitionId: row.partition_id,
        label: row.partition_id ? (partitionLabels.get(row.partition_id) ?? row.section_label) : null,
        rows: [row],
      });
    }
  }
  return groups;
}

function rowToInput(row: ProgramRow): Partial<ProgramInput> {
  return {
    sessionId: row.session_id,
    sectionLabel: row.section_label,
    partitionId: row.partition_id,
    type: row.type,
    name: row.name,
    description: row.description,
    presenter: row.presenter,
    presenterRequirement: row.presenter_requirement,
    presenterContact: row.presenter_contact,
    duration: row.duration,
    startTime: row.start_time,
    endTime: row.end_time,
    timeIsComputed: row.time_is_computed,
    audioMics: row.audio_mics,
    audioTrack: row.audio_track,
    videoSidescreen: row.video_sidescreen,
    backdrop: row.backdrop,
    videoPptNeeded: row.video_ppt_needed,
    hallLights: row.hall_lights,
    stageLights: row.stage_lights,
    cameraAngle: row.camera_angle,
    props: row.props,
    curtains: row.curtains,
    remarks: row.remarks,
    status: row.status,
    colorTag: row.color_tag,
    auditoriumId: row.auditorium_id,
  };
}

export default function CueSheetPage() {
  const eventId = useEventId();
  // Report finding #26 — a viewer can see the cue sheet but not touch it;
  // hiding the write affordances is a courtesy (the actual boundary is
  // server-side, in every mutating route's requireEventAccess(..., "editor")
  // check) so a viewer isn't clicking around discovering what's blocked one
  // failed request at a time.
  const role = useEventRole();
  const canEdit = role !== "viewer";
  const sessions = useSessions();
  const toast = useToast();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const activeSessionId = selectedSessionId ?? sessions[0]?.id ?? "";

  const [rows, setRows] = useState<ProgramRow[] | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [auditoriums, setAuditoriums] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Anchor for shift-click range select — the id of the last checkbox
  // clicked without shift held, so a subsequent shift-click knows which
  // range to select between "there" and "here."
  const lastSelectedId = useRef<string | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [panel, setPanel] = useState<
    "none" | "upload" | "create" | "create-session" | "event-settings" | { edit: ProgramRow } | { editSession: Session }
  >("none");
  const [eventName, setEventName] = useState("");
  const deleteConfirm = useConfirmDialog<ProgramRow[]>();
  const deleteSessionConfirm = useConfirmDialog<Session>();
  // Whether the currently-open Add/Edit Item form has unsaved changes —
  // gates the Add/Edit Item Modal's close affordances (backdrop click, the
  // X button, Escape) behind a confirm step instead of discarding silently.
  // See program-form.tsx's onDirtyChange and the confirmDiscardOpen dialog
  // below.
  const [itemFormDirty, setItemFormDirty] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  function requestClosePanel() {
    if (itemFormDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    setPanel("none");
  }

  function confirmDiscardAndClose() {
    setConfirmDiscardOpen(false);
    setItemFormDirty(false);
    setPanel("none");
  }
  // Deletes are delayed, not immediate — the row disappears from view right
  // away, but the actual DELETE only fires after this window, so "Undo" in
  // the toast can cancel it outright instead of needing to reconstruct a
  // deleted row. Keyed by a joined id string since bulk delete removes
  // several rows as one undoable action, not one timer per row.
  const pendingDeleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  async function loadRows(sessionId: string) {
    setLoadingRows(true);
    try {
      const res = await fetch(`/api/programs?eventId=${encodeURIComponent(eventId)}&sessionId=${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      setRows(data.programs ?? []);
    } finally {
      setLoadingRows(false);
    }
  }

  // The first session tab renders as selected by default (activeSessionId
  // falls back to sessions[0]) but rows were only ever fetched from a tab's
  // onClick — so the pre-selected default never loaded its items until the
  // user clicked a tab (even the same one). Load once sessions arrive.
  useEffect(() => {
    // Standard fetch-on-mount pattern, not the derived-state anti-pattern
    // this rule targets — loadRows' setLoadingRows(true) is a side effect
    // of kicking off the fetch, not a synchronous state derivation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeSessionId && rows === null) loadRows(activeSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  function loadAuditoriums() {
    fetch(`/api/auditoriums?eventId=${encodeURIComponent(eventId)}`)
      .then((res) => res.json())
      .then((data) => setAuditoriums(data.auditoriums ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    loadAuditoriums();
    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => setEventName(data?.event?.name ?? ""))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadAuditoriums is stable across the eventId this effect keys on
  }, [eventId]);

  function scheduleDelete(toRemove: ProgramRow[]) {
    const ids = toRemove.map((r) => r.id);
    const key = ids.join(",");
    setRows((prev) => (prev ? prev.filter((r) => !ids.includes(r.id)) : prev));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });

    const timer = setTimeout(async () => {
      pendingDeleteTimers.current.delete(key);
      await Promise.all(
        ids.map((id) => fetch(`/api/programs/${id}?eventId=${encodeURIComponent(eventId)}`, { method: "DELETE" }))
      );
    }, 5000);
    pendingDeleteTimers.current.set(key, timer);

    toast.success(ids.length === 1 ? "Item deleted" : `${ids.length} items deleted`, {
      label: "Undo",
      onClick: () => {
        const pending = pendingDeleteTimers.current.get(key);
        if (pending) {
          clearTimeout(pending);
          pendingDeleteTimers.current.delete(key);
        }
        setRows((prev) => (prev ? [...prev, ...toRemove].sort((a, b) => a.sort_order - b.sort_order) : prev));
      },
    });
  }

  function handleDeleteConfirmed() {
    const rowsToDelete = deleteConfirm.pending;
    deleteConfirm.cancel();
    if (!rowsToDelete || rowsToDelete.length === 0) return;
    scheduleDelete(rowsToDelete);
  }

  // Replaces the old up/down arrow swap-based reorder. Scoped to a single
  // partition per drop (item 4's stated default: cross-partition drags are
  // a separate explicit action via bulk-edit's "move to section," not a
  // drag-and-drop drop target) — enforced by rendering one SortableContext
  // per partition group below, so a drag physically can't land outside its
  // own group's DOM subtree in the first place.
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(group: PartitionGroup, groupIndex: number, allGroups: PartitionGroup[], event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = group.rows.findIndex((r) => r.id === active.id);
    const newIndex = group.rows.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(group.rows, oldIndex, newIndex);
    const movedId = String(active.id);
    const newPosInGroup = reordered.findIndex((r) => r.id === movedId);
    // Front of this partition's group — afterId is the last row of the
    // *previous* group (so the move still lands inside this partition's
    // own contiguous range), or null only if this is genuinely the first
    // group in the whole session.
    const afterId =
      newPosInGroup === 0
        ? (allGroups[groupIndex - 1]?.rows.at(-1)?.id ?? null)
        : reordered[newPosInGroup - 1].id;

    const res = await fetch("/api/programs/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, id: movedId, afterId, partitionId: group.partitionId }),
    });
    if (res.ok) {
      loadRows(activeSessionId);
    } else {
      toast.error("Couldn't reorder — try again");
    }
  }

  // shiftKey selects the whole range between the last-clicked checkbox and
  // this one (against the current filtered/unfiltered order on screen —
  // whatever's actually visible), matching the common spreadsheet/file-
  // manager convention rather than inventing a new one.
  function toggleSelected(id: string, checked: boolean, shiftKey: boolean) {
    if (shiftKey && lastSelectedId.current && filteredRows) {
      const ids = filteredRows.map((r) => r.id);
      const a = ids.indexOf(lastSelectedId.current);
      const b = ids.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [from, to] = a < b ? [a, b] : [b, a];
        setSelected((prev) => {
          const next = new Set(prev);
          for (let i = from; i <= to; i++) next.add(ids[i]);
          return next;
        });
        lastSelectedId.current = id;
        return;
      }
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    lastSelectedId.current = id;
  }

  async function handleBulkFieldEdit(field: string, value: string | null) {
    setBulkApplying(true);
    try {
      const res = await fetch("/api/programs/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, ids: Array.from(selected), field, value }),
      });
      if (res.ok) {
        toast.success(`${selected.size} items updated`);
        setBulkEditOpen(false);
        setSelected(new Set());
        loadRows(activeSessionId);
      } else {
        toast.error("Couldn't apply the bulk edit — try again");
      }
    } finally {
      setBulkApplying(false);
    }
  }

  async function handleBulkMoveToPartition(partitionId: string | null) {
    setBulkApplying(true);
    try {
      const res = await fetch("/api/programs/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, ids: Array.from(selected), partitionId }),
      });
      if (res.ok) {
        toast.success(`${selected.size} items moved`);
        setBulkEditOpen(false);
        setSelected(new Set());
        loadRows(activeSessionId);
      } else {
        toast.error("Couldn't move the selected items — try again");
      }
    } finally {
      setBulkApplying(false);
    }
  }

  async function handleDeleteSessionConfirmed() {
    const target = deleteSessionConfirm.pending;
    if (!target) return;
    await fetch(`/api/sessions/${target.id}?eventId=${encodeURIComponent(eventId)}`, { method: "DELETE" });
    toast.success("Session deleted");
    deleteSessionConfirm.cancel();
    if (activeSessionId === target.id) {
      setSelectedSessionId(null);
      setRows(null);
    }
  }

  const sessionOptions = sessions.map((s) => ({ id: s.id, label: `${s.dayLabel} • ${s.sessionLabel}` }));
  const partitionsBySession = Object.fromEntries(sessions.map((s) => [s.id, s.partitions]));

  // No search existed here at all — unlike Broadcast Center, which has
  // one for a much shorter list. At the real cue sheet's actual scale
  // (244 items across 6 sessions, measured directly from the real file),
  // scrolling to find one item by eye stops being reasonable.
  const searchQuery = search.trim().toLowerCase();
  const filteredRows = !searchQuery || !rows
    ? rows
    : rows.filter(
        (r) => r.name.toLowerCase().includes(searchQuery) || (r.presenter ?? "").toLowerCase().includes(searchQuery)
      );

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const partitionLabels = new Map((activeSession?.partitions ?? []).map((p) => [p.id, p.label]));
  // Grouping (and therefore drag-and-drop) only makes sense against the
  // full, unfiltered order — same reasoning the old arrow-based reorder
  // already had for hiding its controls while a search is active, since a
  // filtered view's neighbors aren't real neighbors.
  const partitionGroups = searchQuery || !filteredRows ? [] : groupByPartition(filteredRows, partitionLabels);

  // Cmd/Ctrl+A selects the visible rows, Escape clears. Both competitors
  // ship these and the sheet feels markedly slower without them — at 244
  // items, reaching for a button to select a session's worth of rows is
  // the difference between a two-second edit and a ten-second one.
  // Guarded on an editable target so they never steal a real text
  // selection out of the search box or a form field.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (panel !== "none") return;
      const el = e.target as HTMLElement | null;
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && !typing) {
        if (!filteredRows || filteredRows.length === 0) return;
        e.preventDefault();
        setSelected(new Set(filteredRows.map((r) => r.id)));
        return;
      }
      if (e.key === "Escape" && !typing) {
        if (bulkEditOpen) {
          setBulkEditOpen(false);
        } else if (selected.size > 0) {
          setSelected(new Set());
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panel, filteredRows, bulkEditOpen, selected.size]);

  return (
    <main className="min-h-screen bg-background pb-28">
      {/* Two-tier header. Tier one is identity and the two things you do to
          the sheet as a whole; tier two is navigation — which session am I
          editing — promoted out of the page body so it stays put while the
          list scrolls. The session switcher is the most-used control here
          and used to sit below the fold of a long sheet. */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-line-soft">
        <div className="flex items-center justify-between gap-4 px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/e/${eventId}/operator`} className="shrink-0">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                <span className="hidden sm:inline">Operator</span>
              </Button>
            </Link>
            <span aria-hidden="true" className="h-4 w-px bg-line shrink-0" />
            <h1 className="text-console-lg text-primary truncate">Cue Sheet</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Report finding #28 — no export path existed. Excel downloads
                directly (same column layout the importer expects, so it can
                be re-imported elsewhere); PDF opens a print-optimized page
                and hands off to the browser's own Save-as-PDF rather than a
                bundled PDF-generation dependency. Viewer-accessible — export
                is a read, not a write. */}
            <a href={`/api/cue-sheet/export?eventId=${encodeURIComponent(eventId)}`} download>
              <Button variant="ghost" size="sm" aria-label="Export to Excel">
                <Download className="h-4 w-4" strokeWidth={2} />
                <span className="hidden md:inline">Export Excel</span>
              </Button>
            </a>
            <Link href={`/e/${eventId}/operator/cue-sheet/print`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" aria-label="Export to PDF">
                <Printer className="h-4 w-4" strokeWidth={2} />
                <span className="hidden md:inline">Export PDF</span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Event settings"
              onClick={() => setPanel(panel === "event-settings" ? "none" : "event-settings")}
            >
              <Settings className="h-4 w-4" strokeWidth={2} />
              <span className="hidden sm:inline">Settings</span>
            </Button>
            {canEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPanel(panel === "upload" ? "none" : "upload")}
              >
                <Upload className="h-4 w-4" strokeWidth={2} />
                <span className="hidden sm:inline">Import Excel</span>
              </Button>
            )}
            {canEdit && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setPanel(panel === "create" ? "none" : "create")}
                disabled={!activeSessionId}
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Add item
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-14 border-t border-line-soft">
          {sessions.length === 0 ? (
            <p className="text-console-sm text-muted-2">No sessions yet — add one to start building the cue sheet.</p>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <Select
                value={activeSessionId}
                onChange={(id) => {
                  setSelectedSessionId(id);
                  setSearch("");
                  setSelected(new Set());
                  loadRows(id);
                }}
                options={sessions.map((s) => ({
                  value: s.id,
                  label: `${s.dayLabel} • ${s.sessionLabel}`,
                  description: s.eventName,
                }))}
                placeholder="Select a session…"
                aria-label="Session"
                size="lg"
                className="flex-1 min-w-0 sm:flex-none sm:w-[19rem]"
              />
              {activeSession && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Edit session"
                    onClick={() => setPanel({ editSession: activeSession })}
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                    <span className="hidden md:inline">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Delete session"
                    onClick={() => deleteSessionConfirm.request(activeSession)}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    <span className="hidden md:inline">Delete</span>
                  </Button>
                </>
              )}
            </div>
          )}
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setPanel("create-session")} className="shrink-0">
              <CalendarPlus className="h-4 w-4" strokeWidth={2} />
              <span className="hidden sm:inline">New session</span>
            </Button>
          )}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto flex flex-col gap-6">

        {panel === "create-session" && (
          <SessionForm
            eventId={eventId}
            nextSortOrder={sessions.length}
            onSaved={() => {
              setPanel("none");
              toast.success("Session added");
            }}
            onCancel={() => setPanel("none")}
          />
        )}

        {typeof panel === "object" && "editSession" in panel && (
          <SessionForm
            eventId={eventId}
            session={panel.editSession}
            nextSortOrder={sessions.length}
            onSaved={() => {
              setPanel("none");
              toast.success("Session updated");
            }}
            onCancel={() => setPanel("none")}
          />
        )}

        {panel === "upload" && (
          <UploadPanel
            eventId={eventId}
            onDone={() => {
              setPanel("none");
              toast.success("Cue sheet imported");
              if (activeSessionId) loadRows(activeSessionId);
            }}
            onCancel={() => setPanel("none")}
          />
        )}

        {/* Event Settings and Add/Edit Item are genuinely multi-step
            configuration tasks the operator steps out of the queue view to
            do — not a quick, single-field, in-context tweak (that's what
            inline expansion is reserved for: session settings, bulk-edit).
            Real modals here match how StageTimer treats its own equivalent
            (Output Links) — see senior-ux-layout-standards's inline-vs-modal
            reasoning. */}
        <Modal open={panel === "event-settings"} onClose={() => setPanel("none")} title="Event Settings" size="md">
          <EventSettingsPanel
            eventId={eventId}
            initialName={eventName}
            auditoriums={auditoriums}
            onAuditoriumsChanged={loadAuditoriums}
            onCancel={() => setPanel("none")}
          />
        </Modal>

        <Modal open={panel === "create" && !!activeSessionId} onClose={requestClosePanel} title="Add Item" size="lg">
          {activeSessionId && (
            <ProgramForm
              sessionId={activeSessionId}
              sessionOptions={sessionOptions}
              partitionsBySession={partitionsBySession}
              eventId={eventId}
              auditoriums={auditoriums}
              onSaved={() => {
                setItemFormDirty(false);
                setPanel("none");
                toast.success("Item added");
                loadRows(activeSessionId);
              }}
              onCancel={requestClosePanel}
              onDirtyChange={setItemFormDirty}
            />
          )}
        </Modal>

        <Modal
          open={typeof panel === "object" && "edit" in panel}
          onClose={requestClosePanel}
          title="Edit Item"
          size="lg"
        >
          {typeof panel === "object" && "edit" in panel && (
            <ProgramForm
              sessionId={panel.edit.session_id}
              sessionOptions={sessionOptions}
              partitionsBySession={partitionsBySession}
              eventId={eventId}
              auditoriums={auditoriums}
              programId={panel.edit.id}
              initial={rowToInput(panel.edit)}
              version={panel.edit.version}
              onSaved={() => {
                setItemFormDirty(false);
                setPanel("none");
                toast.success("Item updated");
                loadRows(activeSessionId);
              }}
              onCancel={requestClosePanel}
              onDirtyChange={setItemFormDirty}
            />
          )}
        </Modal>

        {panel === "none" && (
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-baseline gap-2.5 min-w-0">
                <h2 className="text-console-md text-primary">Items</h2>
                {rows && rows.length > 0 && (
                  <span className="tnum text-console-meta text-muted-2">
                    {filteredRows?.length ?? 0} of {rows.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
                {filteredRows && filteredRows.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="whitespace-nowrap shrink-0"
                    onClick={() => {
                      const allSelected = filteredRows.every((r) => selected.has(r.id));
                      setSelected(allSelected ? new Set() : new Set(filteredRows.map((r) => r.id)));
                    }}
                  >
                    {filteredRows.every((r) => selected.has(r.id)) ? "Deselect all" : "Select all"}
                  </Button>
                )}
                {rows && rows.length > 0 && (
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSelected(new Set());
                    }}
                    placeholder="Search…"
                    aria-label="Search items or presenters"
                    className="min-w-0 flex-1 sm:flex-none sm:w-60"
                  />
                )}
              </div>
            </div>

            {/* Column header. The old list had none, so the three right-hand
                numeric columns were unlabelled and you had to infer which
                was start and which was duration. */}
            {filteredRows && filteredRows.length > 0 && (
              <div className="mt-4 grid grid-cols-[1.25rem_1rem_1fr_4.25rem] sm:grid-cols-[1.25rem_1rem_2rem_1fr_5rem_3.25rem_4.25rem] items-center gap-2 sm:gap-3 px-3 pb-2 border-b border-line">
                <span />
                <span />
                <span className="hidden sm:block text-console-label text-muted-2 text-right">#</span>
                <span className="text-console-label text-muted-2">Item</span>
                <span className="hidden sm:block text-console-label text-muted-2 text-right">Start</span>
                <span className="hidden sm:block text-console-label text-muted-2 text-right">Dur</span>
                <span />
              </div>
            )}

            <div className="flex flex-col">
              {/* Skeleton rows rather than a spinner — the list's shape is
                  known before its content is, so reserving it stops the
                  header and action bar jumping when rows land. */}
              {loadingRows && (
                <div className="flex flex-col" aria-busy="true" aria-label="Loading items">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 min-h-11 border-b border-line-soft">
                      <span className="h-3 w-3 rounded bg-card-hover motion-safe:animate-pulse" />
                      <span
                        className="h-3 rounded bg-card-hover motion-safe:animate-pulse"
                        style={{ width: `${38 + ((i * 13) % 34)}%` }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {!loadingRows && rows === null && (
                // Two different nothings. With zero sessions there is
                // nothing above to pick, so telling someone to pick one is
                // a dead end — offer the action that actually unblocks them.
                sessions.length === 0 ? (
                  <EmptyState
                    title="No sessions yet"
                    body="A session is one block of your event — Friday Evening, Saturday Morning. Create one, or import a rundown and get its sessions for free."
                    action={
                      <div className="flex items-center gap-2">
                        <Button variant="primary" size="sm" onClick={() => setPanel("create-session")}>
                          <CalendarPlus className="h-4 w-4" strokeWidth={2} />
                          New session
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setPanel("upload")}>
                          <Upload className="h-4 w-4" strokeWidth={2} />
                          Import Excel
                        </Button>
                      </div>
                    }
                  />
                ) : (
                  <EmptyState
                    title="No session selected"
                    body="Pick a session above to load its cue sheet."
                  />
                )
              )}

              {!loadingRows && rows?.length === 0 && (
                <EmptyState
                  title="This session is empty"
                  body="Add items one at a time, or import an existing rundown from Excel."
                  action={
                    <div className="flex items-center gap-2">
                      <Button variant="primary" size="sm" onClick={() => setPanel("create")}>
                        <Plus className="h-4 w-4" strokeWidth={2} />
                        Add item
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setPanel("upload")}>
                        <Upload className="h-4 w-4" strokeWidth={2} />
                        Import Excel
                      </Button>
                    </div>
                  }
                />
              )}

              {!loadingRows && rows && rows.length > 0 && filteredRows?.length === 0 && (
                <EmptyState
                  title={`Nothing matches “${search}”`}
                  body="Search covers item names and presenters."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  }
                />
              )}

              {/* Searching flattens to a plain list — filtered neighbors
                  aren't real neighbors, so grouping/dragging is meaningless
                  here, same reasoning the old arrow-based reorder already
                  used to hide its controls during a search. */}
              {search.trim() &&
                filteredRows?.map((row) => {
                  const isSelected = selected.has(row.id);
                  return (
                    <ProgramRowView
                      key={row.id}
                      row={row}
                      selected={isSelected}
                      onToggleSelect={(checked, shiftKey) => toggleSelected(row.id, checked, shiftKey)}
                      onEdit={() => setPanel({ edit: row })}
                      onDelete={() => scheduleDelete([row])}
                    />
                  );
                })}

              {!search.trim() &&
                partitionGroups.map((group, groupIndex) => (
                  <div key={group.partitionId ?? `unpartitioned-${groupIndex}`}>
                    {group.label && (
                      // Sticky so you always know which section you're
                      // inside while scrolling a forty-row run — the old
                      // header scrolled away and partitions became
                      // indistinguishable from each other mid-list.
                      <div className="sticky top-28 z-10 flex items-center gap-2.5 bg-background/95 backdrop-blur-sm px-3 py-2 mt-6 first:mt-0 border-b border-line">
                        <h3 className="text-console-label text-muted truncate">{group.label}</h3>
                        <span className="tnum text-console-label text-muted-2 shrink-0">
                          {group.rows.length}
                        </span>
                        <span aria-hidden="true" className="flex-1 h-px bg-line-soft" />
                        {group.partitionId && (
                          <PartitionStartTimeEditor
                            eventId={eventId}
                            partition={activeSession?.partitions.find((p) => p.id === group.partitionId) ?? null}
                            onSaved={() => activeSessionId && loadRows(activeSessionId)}
                          />
                        )}
                      </div>
                    )}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={(e) => setActiveDragId(String(e.active.id))}
                      onDragEnd={(e) => handleDragEnd(group, groupIndex, partitionGroups, e)}
                      onDragCancel={() => setActiveDragId(null)}
                    >
                      <SortableContext items={group.rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                        {group.rows.map((row) => {
                          const isSelected = selected.has(row.id);
                          return (
                          <SortableProgramRow
                            key={row.id}
                            row={row}
                            selected={isSelected}
                            isDragging={activeDragId === row.id}
                            onToggleSelect={(checked, shiftKey) => toggleSelected(row.id, checked, shiftKey)}
                            onEdit={() => setPanel({ edit: row })}
                            onDelete={() => scheduleDelete([row])}
                          />
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating, so ticking a checkbox never shoves 244 rows down the
          page. Bulk-edit opens as a popover above the bar rather than
          expanding it in place, for the same reason. */}
      {panel === "none" && selected.size > 0 && (
        <ActionBar>
          {bulkEditOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[calc(100vw-2rem)] rounded-panel bg-card border border-line p-3 shadow-float motion-safe:animate-rise">
              <BulkEditPanel
                partitions={activeSession?.partitions ?? []}
                applying={bulkApplying}
                onApplyField={handleBulkFieldEdit}
                onApplyPartition={handleBulkMoveToPartition}
                onCancel={() => setBulkEditOpen(false)}
              />
            </div>
          )}

          <ActionBarClear onClick={() => setSelected(new Set())} />
          <ActionBarCount n={selected.size}>selected</ActionBarCount>
          {filteredRows && !filteredRows.every((r) => selected.has(r.id)) && (
            <ActionBarButton
              tone="accent"
              onClick={() => setSelected(new Set(filteredRows.map((r) => r.id)))}
            >
              Select all {filteredRows.length}
            </ActionBarButton>
          )}
          <ActionBarSeparator />
          <ActionBarButton onClick={() => setBulkEditOpen((o) => !o)} aria-expanded={bulkEditOpen}>
            Edit fields
          </ActionBarButton>
          <ActionBarSeparator />
          <ActionBarButton
            tone="danger"
            onClick={() => {
              const toDelete = (filteredRows ?? []).filter((r) => selected.has(r.id));
              // Guardrail weight scales with blast radius, not with the verb
              // (docs/DESIGN.md) — a handful of items still gets the same
              // Undo-toast-only guardrail a single delete does; only a
              // genuinely large bulk action earns the extra confirm step.
              if (toDelete.length > BULK_DELETE_CONFIRM_THRESHOLD) {
                deleteConfirm.request(toDelete);
              } else {
                scheduleDelete(toDelete);
              }
            }}
          >
            Delete
          </ActionBarButton>
        </ActionBar>
      )}

      <ConfirmDialog
        open={deleteConfirm.isOpen}
        title={`Delete ${deleteConfirm.pending?.length ?? 0} items?`}
        description="You'll get a few seconds to undo it after."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={handleDeleteConfirmed}
        onCancel={deleteConfirm.cancel}
      />

      <ConfirmDialog
        open={deleteSessionConfirm.isOpen}
        title={`Delete "${deleteSessionConfirm.pending?.dayLabel} • ${deleteSessionConfirm.pending?.sessionLabel}"?`}
        description="This deletes the session and every item in it. This can't be undone."
        confirmLabel="Delete Session"
        tone="danger"
        onConfirm={handleDeleteSessionConfirmed}
        onCancel={deleteSessionConfirm.cancel}
      />

      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Discard unsaved changes?"
        description="You've entered details on this item that haven't been saved yet. Closing now will discard them."
        confirmLabel="Discard"
        tone="danger"
        onConfirm={confirmDiscardAndClose}
        onCancel={() => setConfirmDiscardOpen(false)}
      />
    </main>
  );
}

interface ProgramRowViewProps {
  row: ProgramRow;
  selected: boolean;
  onToggleSelect: (checked: boolean, shiftKey: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  dragHandle?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  setNodeRef?: (el: HTMLElement | null) => void;
}

// Shared row content — used directly (no drag handle) for the flattened
// search-results list, and wrapped by SortableProgramRow below for the
// normal grouped/draggable view.
function ProgramRowView({
  row,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
  dragHandle,
  style,
  className,
  setNodeRef,
}: ProgramRowViewProps) {
  const shiftKeyRef = useRef(false);
  const colorTone = colorTagTone(row.color_tag);
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-selected={selected || undefined}
      className={cn(
        // 44px min-height meets the touch target exactly and is the
        // tightest a draggable row may go. Grid rather than flex so the
        // numeric columns line up with the header above them.
        //
        // Two layouts, not one shrunk: at >=640px the index, start and
        // duration each get their own aligned column; below that they'd
        // leave ~80px for the title, so they collapse out of the grid
        // (display:none removes them as grid items, hence the different
        // column count) and the time reappears on the meta line instead.
        "group grid min-h-11 items-center gap-2 sm:gap-3 px-3 py-2 border-b border-line-soft",
        "grid-cols-[1.25rem_1rem_1fr_4.25rem] sm:grid-cols-[1.25rem_1rem_2rem_1fr_5rem_3.25rem_4.25rem]",
        "transition-colors duration-[110ms] ease-out",
        // Selection is a full tinted fill, not a coloured left border —
        // both competitors fill the row, and a 2px accent rail on every
        // list item is the tell of a design that had no better idea.
        selected ? "bg-accent/10 hover:bg-accent/15" : "hover:bg-card-hover",
        className
      )}
    >
      {dragHandle}
      <input
        type="checkbox"
        checked={selected}
        // Letting the native toggle run and reading it back in onChange
        // (rather than preventDefault-ing the click and computing the next
        // state ourselves) avoids a real React quirk: calling
        // preventDefault() in a checkbox's onClick can leave React's
        // internal DOM-value tracker believing `checked` was already
        // applied when the actual DOM node never flipped, so the box
        // silently stays visually unchecked despite the right state
        // reaching React. onClick here only captures shiftKey (onChange
        // events don't carry modifier keys) into a ref for onChange to read.
        onClick={(e) => {
          shiftKeyRef.current = e.shiftKey;
        }}
        onChange={(e) => {
          onToggleSelect(e.target.checked, shiftKeyRef.current);
        }}
        aria-label={`Select ${row.name}`}
        className="h-4 w-4 rounded-control border-line bg-background accent-accent cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />

      <span className="tnum hidden sm:block text-console-meta text-muted-2 text-right">{row.sort_order}</span>

      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* Colour tag as a dot beside the title rather than a chip on its
              own line — at this density a chip per row doubles the row
              height for information that only needs to be glanceable. The
              accessible name carries the word, so it is never colour-only. */}
          {row.color_tag && (
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                colorTone === "green" && "bg-status-green",
                colorTone === "blue" && "bg-status-blue",
                colorTone === "orange" && "bg-status-orange",
                colorTone === "red" && "bg-status-red",
                colorTone === "muted" && "bg-muted-2"
              )}
              title={colorTagLabel(row.color_tag) ?? undefined}
            >
              <span className="sr-only">{colorTagLabel(row.color_tag)}</span>
            </span>
          )}
          <p className="text-console-row text-primary truncate">{row.name}</p>
          {row.status !== "confirmed" && (
            <span className="text-console-label text-muted-2 shrink-0 uppercase">{row.status}</span>
          )}
        </div>
        {/* Below 640px the numeric columns are gone, so start and duration
            ride here instead — a rundown row without its time is useless. */}
        <p className="text-console-meta text-muted-2 truncate">
          <span className="tnum sm:hidden">
            {row.sort_order}
            {" · "}
            {row.start_time ?? "—"}
            {row.duration > 0 ? ` · ${row.duration}m` : ""}
          </span>
          {row.presenter && <span className="sm:hidden">{" · "}</span>}
          {row.presenter}
        </p>
      </div>

      <span className="tnum hidden sm:block text-console-meta text-muted text-right">
        {row.start_time ?? "—"}
      </span>
      <span className="tnum hidden sm:block text-console-meta text-muted-2 text-right">
        {row.duration > 0 ? `${row.duration}m` : "—"}
      </span>

      {/* Row actions stay dim until the row is hovered or focused within,
          so 40 rows of icons don't compete with the content. They remain
          keyboard-reachable at all times. */}
      <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-[110ms]">
        <button
          type="button"
          aria-label={`Edit ${row.name}`}
          onClick={onEdit}
          className="grid h-8 w-8 place-items-center rounded-control text-muted-2 cursor-pointer transition-colors duration-[110ms] hover:bg-raised hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label={`Delete ${row.name}`}
          onClick={onDelete}
          className="grid h-8 w-8 place-items-center rounded-control text-muted-2 cursor-pointer transition-colors duration-[110ms] hover:bg-status-red/12 hover:text-status-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// Drag handle is a dedicated grip icon, not the whole row — the row also
// hosts its own checkbox/edit/delete clicks, and dnd-kit's listeners
// capture pointerdown for drag initiation, which would fight those clicks
// if attached to the whole row instead of one small handle.
function SortableProgramRow({
  row,
  selected,
  isDragging,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  row: ProgramRow;
  selected: boolean;
  isDragging: boolean;
  onToggleSelect: (checked: boolean, shiftKey: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // The row being dragged lifts rather than just fading: raised surface,
    // a real offset shadow, and it stays above its neighbours. A flat 0.4
    // opacity read as "disabled", not "in hand".
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? "relative" : undefined,
    boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.45)" : undefined,
  };

  return (
    <ProgramRowView
      row={row}
      selected={selected}
      onToggleSelect={onToggleSelect}
      onEdit={onEdit}
      onDelete={onDelete}
      setNodeRef={setNodeRef}
      style={style}
      className={isDragging ? "bg-raised rounded-control border-b-transparent" : undefined}
      dragHandle={
        <button
          type="button"
          aria-label={`Drag to reorder ${row.name}`}
          {...attributes}
          {...listeners}
          // Was `hidden sm:flex`, which removed drag-to-reorder entirely on
          // touch — the one place a grip matters most, since there is no
          // keyboard alternative on a tablet. Now always present, with a
          // hit area that spills past the 20px grid column via -mx.
          className={cn(
            "flex items-center justify-center -mx-2 px-2 h-11 shrink-0 touch-none",
            "text-muted-2 cursor-grab active:cursor-grabbing",
            "transition-colors duration-[110ms] hover:text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-control"
          )}
        >
          <GripVertical className="h-4 w-4" strokeWidth={2} />
        </button>
      }
    />
  );
}

// Inline editor for a section's start_time — the anchor item 6b's duration
// cascade walks forward from. Click-to-edit rather than a permanent input
// since most partition headers never need touching once set; keeping it
// out of the way matches how the rest of the queue sheet stays read-first.
function PartitionStartTimeEditor({
  eventId,
  partition,
  onSaved,
}: {
  eventId: string;
  partition: Partition | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(partition?.startTime ?? "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  if (!partition) return null;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(partition.startTime ?? "");
          setEditing(true);
        }}
        className="shrink-0 rounded-chip px-1.5 py-0.5 text-console-label text-muted-2 cursor-pointer transition-colors duration-[110ms] hover:bg-raised hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {partition.startTime ? <span className="tnum">Starts {partition.startTime}</span> : "Set start time"}
      </button>
    );
  }

  async function commit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/partitions/${partition!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, start_time: value.trim() || null }),
      });
      if (!res.ok) {
        toast.error("Couldn't update the section's start time");
        return;
      }
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setEditing(false);
      }}
      disabled={saving}
      placeholder="9:00 AM"
      aria-label="Section start time"
      className="tnum h-7 w-24 shrink-0 rounded-control border border-line bg-background px-2 text-console-meta text-primary outline-none transition-[border-color,box-shadow] duration-[110ms] focus:border-accent focus:ring-[3px] focus:ring-accent/15"
    />
  );
}

type BulkEditKind = "color_tag" | "status" | "partition";

// Applies one field/value to every selected item at once (item 5's other
// half — bulk delete already existed). Color tag uses the same constrained
// swatch picker as the Add Item form (item 6a) rather than a second,
// inconsistent free-text input.
function BulkEditPanel({
  partitions,
  applying,
  onApplyField,
  onApplyPartition,
  onCancel,
}: {
  partitions: Partition[];
  applying: boolean;
  onApplyField: (field: string, value: string | null) => void;
  onApplyPartition: (partitionId: string | null) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<BulkEditKind>("color_tag");
  const [colorValue, setColorValue] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState("confirmed");
  const [partitionValue, setPartitionValue] = useState<string>("");

  return (
    <div className="flex flex-col gap-3 min-w-[19rem]">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-console-label text-muted-2 shrink-0">Set</span>
        {/* One dropdown primitive throughout — the native <select> that used
            to sit here rendered the OS menu, which on this dark ground was
            a light popup in the middle of a console. */}
        <Select
          value={kind}
          onChange={(v) => setKind(v as BulkEditKind)}
          options={[
            { value: "color_tag", label: "Color tag" },
            { value: "status", label: "Status" },
            { value: "partition", label: "Section" },
          ]}
          searchable={false}
          aria-label="Field to apply"
          className="w-full sm:w-40"
        />
      </div>

      <div className="flex flex-col gap-3">
        {kind === "color_tag" && (
          <ColorTagPicker value={colorValue} onChange={setColorValue} aria-label="Color tag value" />
        )}
        {kind === "status" && (
          <Select
            value={statusValue}
            onChange={setStatusValue}
            options={[
              { value: "confirmed", label: "Confirmed" },
              { value: "draft", label: "Draft" },
              { value: "cut", label: "Cut" },
              { value: "tbd", label: "TBD" },
            ]}
            searchable={false}
            aria-label="Status value"
            className="w-full sm:w-56"
          />
        )}
        {kind === "partition" && (
          <Select
            value={partitionValue}
            onChange={setPartitionValue}
            options={[{ value: "", label: "No section" }, ...partitions.map((p) => ({ value: p.id, label: p.label }))]}
            placeholder="Choose a section…"
            aria-label="Section value"
            className="w-full sm:w-56"
          />
        )}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-line-soft">
        <Button
          variant="primary"
          size="sm"
          loading={applying}
          className="mt-2"
          onClick={() => {
            if (kind === "color_tag") onApplyField("color_tag", colorValue);
            else if (kind === "status") onApplyField("status", statusValue);
            else onApplyPartition(partitionValue || null);
          }}
        >
          Apply to selection
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={applying} className="mt-2">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function UploadPanel({ eventId, onDone, onCancel }: { eventId: string; onDone: () => void; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ sessions: ParsedSession[]; programs: ParsedProgram[]; errors: { index: number; name: string; errors: string[] }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("eventId", eventId);
      const res = await fetch("/api/cue-sheet/upload?dryRun=1", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to parse file");
        return;
      }
      setPreview(data);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("eventId", eventId);
      const res = await fetch("/api/cue-sheet/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to import");
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card bg-card p-6 flex flex-col gap-4">
      <SectionLabel>Import Excel</SectionLabel>
      {/* Report finding #8 — no downloadable template or example existed
          anywhere, so a first-time import meant guessing the expected
          format. This is the exact file lib/parse-cuesheet.ts's
          resolveColumns() expects (verified by round-tripping it through
          the real parser, not just eyeballed), with one filled example
          row showing a real item and a break. */}
      <a
        href="/templates/kramflow-cue-sheet-template.xlsx"
        download
        className="self-start text-console-sm text-accent hover:underline underline-offset-2"
      >
        Download the import template (.xlsx)
      </a>
      <input
        type="file"
        accept=".xlsx"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setPreview(null);
        }}
        className="text-console-sm text-muted file:mr-4 file:h-9 file:px-4 file:rounded-control file:border-0 file:bg-primary file:text-background file:font-medium file:cursor-pointer cursor-pointer"
      />

      {error && <p className="text-caption text-status-red">{error}</p>}

      {!preview && (
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handlePreview} disabled={!file} loading={busy}>
            Preview
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      )}

      {preview && (
        <div className="flex flex-col gap-4">
          <p className="text-body text-muted">
            Parsed {preview.sessions.length} sessions, {preview.programs.length} items.
            {preview.errors.length > 0 && (
              <span className="text-status-red"> {preview.errors.length} rows have validation errors.</span>
            )}
          </p>
          {preview.errors.length > 0 && (
            <ul className="text-caption text-status-red flex flex-col gap-1 max-h-40 overflow-y-auto">
              {preview.errors.map((e) => (
                <li key={e.index}>
                  Row {e.index + 1} ({e.name || "untitled"}): {e.errors.join(", ")}
                </li>
              ))}
            </ul>
          )}

          {/* Report finding #9 — Preview previously showed only aggregate
              counts, so committing an import was still a leap of faith
              about what would actually land in the cue sheet. Now shows
              the real mapped rows — exactly what Confirm Import will
              create — grouped by the session they'll land in. */}
          <div className="max-h-80 overflow-y-auto rounded-panel border border-line-soft">
            {preview.sessions.map((session) => (
              <div key={session.id}>
                <div className="sticky top-0 bg-raised px-3 py-1.5 text-console-meta text-muted-2 uppercase tracking-wide border-b border-line-soft">
                  {session.day_label} • {session.session_label}
                </div>
                <table className="w-full text-console-sm">
                  <thead>
                    <tr className="text-console-meta text-muted-2 text-left">
                      <th className="px-3 py-1.5 font-normal">#</th>
                      <th className="px-3 py-1.5 font-normal">Item</th>
                      <th className="px-3 py-1.5 font-normal">Presenter</th>
                      <th className="px-3 py-1.5 font-normal">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.programs
                      .filter((p) => p.session_id === session.id)
                      .map((p, i) => (
                        <tr key={i} className="border-t border-line-soft">
                          <td className="px-3 py-1.5 text-muted-2">{p.sort_order}</td>
                          <td className="px-3 py-1.5 text-primary">
                            {p.name}
                            {p.type === "break" && <span className="text-muted-2"> (break)</span>}
                          </td>
                          <td className="px-3 py-1.5 text-muted">{p.presenter ?? "—"}</td>
                          <td className="px-3 py-1.5 text-muted tabular-nums">{p.duration ? `${p.duration}m` : "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={handleConfirm} disabled={preview.errors.length > 0} loading={busy}>
              Confirm import
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

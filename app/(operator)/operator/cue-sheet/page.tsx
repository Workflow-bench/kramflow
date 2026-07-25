"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronUp, ChevronDown, Plus, Upload, Pencil, Trash2, CalendarPlus } from "lucide-react";
import { useSessions } from "@/lib/use-sessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/tv/section-label";
import { ProgramForm } from "@/components/forms/program-form";
import { SessionForm } from "@/components/forms/session-form";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { ProgramInput } from "@/lib/validation/program";
import type { ParsedProgram, ParsedSession } from "@/lib/parse-cuesheet";
import type { Session } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProgramRow extends ParsedProgram {
  id: string;
  version: number;
}

function rowToInput(row: ProgramRow): Partial<ProgramInput> {
  return {
    sessionId: row.session_id,
    sectionLabel: row.section_label,
    type: row.type,
    name: row.name,
    description: row.description,
    presenter: row.presenter,
    presenterRequirement: row.presenter_requirement,
    presenterContact: row.presenter_contact,
    duration: row.duration,
    startTime: row.start_time,
    endTime: row.end_time,
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
  };
}

export default function CueSheetPage() {
  const sessions = useSessions();
  const toast = useToast();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const activeSessionId = selectedSessionId ?? sessions[0]?.id ?? "";

  const [rows, setRows] = useState<ProgramRow[] | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [panel, setPanel] = useState<
    "none" | "upload" | "create" | "create-session" | { edit: ProgramRow } | { editSession: Session }
  >("none");
  const deleteConfirm = useConfirmDialog<ProgramRow[]>();
  const deleteSessionConfirm = useConfirmDialog<Session>();
  // Deletes are delayed, not immediate — the row disappears from view right
  // away, but the actual DELETE only fires after this window, so "Undo" in
  // the toast can cancel it outright instead of needing to reconstruct a
  // deleted row. Keyed by a joined id string since bulk delete removes
  // several rows as one undoable action, not one timer per row.
  const pendingDeleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  async function loadRows(sessionId: string) {
    setLoadingRows(true);
    try {
      const res = await fetch(`/api/programs?sessionId=${encodeURIComponent(sessionId)}`);
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
      await Promise.all(ids.map((id) => fetch(`/api/programs/${id}`, { method: "DELETE" })));
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

  // sort_order swap only makes sense against the full, unfiltered order —
  // reorder controls are hidden while a search is active (see the row
  // markup below) so this always operates on real neighbors, not
  // neighbors-in-the-filtered-view.
  async function moveItem(row: ProgramRow, direction: -1 | 1) {
    if (!rows) return;
    const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((r) => r.id === row.id);
    const partner = sorted[idx + direction];
    if (idx < 0 || !partner) return;

    setReorderingId(row.id);
    const res = await fetch("/api/programs/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idA: row.id, idB: partner.id }),
    });
    setReorderingId(null);
    if (res.ok) {
      loadRows(activeSessionId);
    } else {
      toast.error("Couldn't reorder — try again");
    }
  }

  async function handleDeleteSessionConfirmed() {
    const target = deleteSessionConfirm.pending;
    if (!target) return;
    await fetch(`/api/sessions/${target.id}`, { method: "DELETE" });
    toast.success("Session deleted");
    deleteSessionConfirm.cancel();
    if (activeSessionId === target.id) {
      setSelectedSessionId(null);
      setRows(null);
    }
  }

  const sessionOptions = sessions.map((s) => ({ id: s.id, label: `${s.dayLabel} • ${s.sessionLabel}` }));

  // No search existed here at all — unlike Broadcast Center, which has
  // one for a much shorter list. At the real cue sheet's actual scale
  // (244 items across 6 sessions, measured directly from the real file),
  // scrolling to find one item by eye stops being reasonable.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !rows) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.presenter ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <div className="flex items-center gap-4">
          <Link href="/operator">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              Operator
            </Button>
          </Link>
          <h1 className="text-title text-primary">Cue Sheet</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPanel("upload")}>
            <Upload className="h-4 w-4" strokeWidth={2} />
            Import Excel
          </Button>
          <Button variant="primary" size="sm" onClick={() => setPanel("create")} disabled={!activeSessionId}>
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add item
          </Button>
        </div>
      </header>

      <div className="px-6 py-6 max-w-4xl mx-auto flex flex-col gap-8">
        <div>
          <div className="flex items-center justify-between">
            <SectionLabel>Session</SectionLabel>
            <Button variant="ghost" size="sm" onClick={() => setPanel("create-session")}>
              <CalendarPlus className="h-4 w-4" strokeWidth={2} />
              New session
            </Button>
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {sessions.length === 0 && (
              <p className="text-body text-muted py-2">
                No sessions yet. Add one to start building the cue sheet.
              </p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group shrink-0 flex items-center gap-1 rounded-full pl-3 pr-1.5 py-1.5 text-caption font-medium transition-colors",
                  s.id === activeSessionId ? "bg-card text-primary" : "text-muted-2 hover:text-primary"
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSessionId(s.id);
                    setSearch("");
                    setSelected(new Set());
                    loadRows(s.id);
                  }}
                  className="cursor-pointer"
                >
                  {s.dayLabel} • {s.sessionLabel}
                </button>
                <button
                  type="button"
                  aria-label="Edit session"
                  onClick={() => setPanel({ editSession: s })}
                  className="opacity-0 group-hover:opacity-100 hover:text-primary cursor-pointer p-1 shrink-0 transition-opacity"
                >
                  <Pencil className="h-3 w-3" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  aria-label="Delete session"
                  onClick={() => deleteSessionConfirm.request(s)}
                  className="opacity-0 group-hover:opacity-100 hover:text-status-red cursor-pointer p-1 shrink-0 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {panel === "create-session" && (
          <SessionForm
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
            onDone={() => {
              setPanel("none");
              toast.success("Cue sheet imported");
              if (activeSessionId) loadRows(activeSessionId);
            }}
            onCancel={() => setPanel("none")}
          />
        )}

        {panel === "create" && activeSessionId && (
          <div className="rounded-2xl bg-card p-6">
            <ProgramForm
              sessionId={activeSessionId}
              sessionOptions={sessionOptions}
              onSaved={() => {
                setPanel("none");
                toast.success("Item added");
                loadRows(activeSessionId);
              }}
              onCancel={() => setPanel("none")}
            />
          </div>
        )}

        {typeof panel === "object" && "edit" in panel && (
          <div className="rounded-2xl bg-card p-6">
            <ProgramForm
              sessionId={panel.edit.session_id}
              sessionOptions={sessionOptions}
              programId={panel.edit.id}
              initial={rowToInput(panel.edit)}
              version={panel.edit.version}
              onSaved={() => {
                setPanel("none");
                toast.success("Item updated");
                loadRows(activeSessionId);
              }}
              onCancel={() => setPanel("none")}
            />
          </div>
        )}

        {panel === "none" && (
          <div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <SectionLabel>
                Items{rows && rows.length > 0 ? ` (${filteredRows?.length ?? 0} of ${rows.length})` : ""}
              </SectionLabel>
              {rows && rows.length > 0 && (
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelected(new Set());
                  }}
                  placeholder="Search items or presenters…"
                  aria-label="Search items"
                  className="w-full sm:w-64 h-9"
                />
              )}
            </div>

            {selected.size > 0 && (
              <div className="mt-3 flex items-center justify-between gap-4 rounded-lg bg-card border border-white/10 px-4 py-2.5">
                <p className="text-caption text-muted">{selected.size} selected</p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      const toDelete = (filteredRows ?? []).filter((r) => selected.has(r.id));
                      deleteConfirm.request(toDelete);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Delete {selected.size}
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-col">
              {loadingRows && <p className="text-body text-muted py-4">Loading…</p>}
              {!loadingRows && rows === null && (
                <p className="text-body text-muted py-4">Select a session to view its items.</p>
              )}
              {!loadingRows && rows?.length === 0 && <p className="text-body text-muted py-4">No items yet.</p>}
              {!loadingRows && rows && rows.length > 0 && filteredRows?.length === 0 && (
                <p className="text-body text-muted py-4">No items match &ldquo;{search}&rdquo;.</p>
              )}
              {filteredRows?.map((row, i) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 py-3 px-3 rounded-lg border-b border-white/5 hover:bg-card transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(row.id);
                        else next.delete(row.id);
                        return next;
                      });
                    }}
                    aria-label={`Select ${row.name}`}
                    className="h-4 w-4 rounded border-white/20 bg-background accent-white cursor-pointer shrink-0"
                  />
                  <span className="w-8 text-caption text-muted-2 tabular-nums shrink-0">{row.sort_order}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body text-primary truncate">{row.name}</p>
                    {row.presenter && <p className="text-caption text-muted-2 truncate">{row.presenter}</p>}
                  </div>
                  <span className="hidden sm:inline text-caption text-muted-2 tabular-nums shrink-0 w-16 text-right">
                    {row.start_time ?? ""}
                  </span>
                  <span className="hidden sm:inline text-caption text-muted-2 tabular-nums shrink-0 w-10 text-right">
                    {row.duration > 0 ? `${row.duration}m` : "—"}
                  </span>
                  {row.status !== "confirmed" && (
                    <span className="text-caption text-muted-2 uppercase tracking-wide shrink-0">{row.status}</span>
                  )}
                  {!search.trim() && (
                    <div className="hidden sm:flex flex-col shrink-0">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={i === 0 || reorderingId !== null}
                        onClick={() => moveItem(row, -1)}
                        className="text-muted-2 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer p-0.5"
                      >
                        <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={i === (filteredRows?.length ?? 0) - 1 || reorderingId !== null}
                        onClick={() => moveItem(row, 1)}
                        className="text-muted-2 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer p-0.5"
                      >
                        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label="Edit"
                    onClick={() => setPanel({ edit: row })}
                    className="text-muted-2 hover:text-primary cursor-pointer p-1.5 shrink-0"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => deleteConfirm.request([row])}
                    className="text-muted-2 hover:text-status-red cursor-pointer p-1.5 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirm.isOpen}
        title={
          deleteConfirm.pending?.length === 1
            ? `Delete "${deleteConfirm.pending[0].name}"?`
            : `Delete ${deleteConfirm.pending?.length ?? 0} items?`
        }
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
    </main>
  );
}

function UploadPanel({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
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
    <div className="rounded-2xl bg-card p-6 flex flex-col gap-4">
      <SectionLabel>Import Excel</SectionLabel>
      <input
        type="file"
        accept=".xlsx"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setPreview(null);
        }}
        className="text-body text-muted file:mr-4 file:h-9 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-background file:font-medium file:cursor-pointer cursor-pointer"
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

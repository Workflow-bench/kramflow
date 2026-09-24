"use client";

import { useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedPartition, ParsedProgram, ParsedSession } from "@/lib/parse-cuesheet";
import type { Session } from "@/lib/types";

interface AiPreview {
  sessions: ParsedSession[];
  partitions: ParsedPartition[];
  programs: ParsedProgram[];
  warnings: { item: number | null; message: string }[];
  errors: { index: number; name: string; errors: string[] }[];
}

// Import from anything that reads like a run of show — a messy spreadsheet,
// a CSV, pasted text from an email or doc. Two steps like the Excel import:
// the AI reads the document and proposes rows, the operator reviews (and can
// drop rows), then confirms. Nothing is saved until Confirm.
export function AiImportPanel({
  eventId,
  sessions,
  onDone,
  onCancel,
}: {
  eventId: string;
  sessions: Session[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<AiPreview | null>(null);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRead() {
    if (busy || (!file && !text.trim())) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("eventId", eventId);
      if (file) body.append("file", file);
      else body.append("text", text);
      const res = await fetch("/api/ai/cue-sheet-import", { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Couldn't read that document. Try again.");
        return;
      }
      setPreview(data);
      setRemoved(new Set());
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // What Confirm will actually send: removed rows dropped, positions
  // re-sequenced per session, and any session left empty left out.
  const kept = useMemo(() => {
    if (!preview) return null;
    const counters = new Map<string, number>();
    const programs: ParsedProgram[] = [];
    preview.programs.forEach((p, index) => {
      if (removed.has(index)) return;
      const next = (counters.get(p.session_id) ?? 0) + 1;
      counters.set(p.session_id, next);
      programs.push({ ...p, sort_order: next });
    });
    const sessionIds = new Set(programs.map((p) => p.session_id));
    return {
      sessions: preview.sessions.filter((s) => sessionIds.has(s.id)),
      partitions: preview.partitions.filter((p) => sessionIds.has(p.session_id)),
      programs,
    };
  }, [preview, removed]);

  const remainingErrors = preview?.errors.filter((e) => !removed.has(e.index)) ?? [];

  async function handleConfirm() {
    if (!kept || busy || kept.programs.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/cue-sheet-import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, sheet: kept }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Failed to import. Try again.");
        return;
      }
      onDone();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const existingIds = new Set(sessions.map((s) => s.id));

  if (!preview || !kept) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-console-sm text-muted">
          Upload a spreadsheet (.xlsx or .csv) or a text file, or paste a run of show. The AI reads it and proposes cue-sheet
          items for you to review before anything is saved. The document&apos;s content is sent to Anthropic to be read.
        </p>
        <input
          type="file"
          accept=".xlsx,.csv,.txt,.md"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-console-sm text-muted file:mr-4 file:h-9 file:px-4 file:rounded-control file:border-0 file:bg-primary file:text-background file:font-medium file:cursor-pointer cursor-pointer"
        />
        {!file && (
          <Textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"…or paste it here, e.g.\nFriday evening\n6:00 PM  Doors open\n6:30 PM  Welcome – Alex Kim (5 min)"}
            aria-label="Pasted run of show"
          />
        )}
        {error && <p className="text-console-meta text-status-red">{error}</p>}
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={handleRead} disabled={!file && !text.trim()} loading={busy}>
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            {busy ? "Reading…" : "Read with AI"}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
        {busy && <p className="text-console-meta text-muted-2">A long cue sheet can take a minute or two.</p>}
      </div>
    );
  }

  const replacing = kept.sessions.filter((s) => existingIds.has(s.id));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-console-sm text-muted">
        The AI found {kept.sessions.length} session{kept.sessions.length === 1 ? "" : "s"} and {kept.programs.length} item
        {kept.programs.length === 1 ? "" : "s"}. AI can misread a document, so check the rows below and remove any that are wrong.
        You can fix details in the cue sheet afterwards.
      </p>

      {replacing.length > 0 && (
        <div className="rounded-panel border border-status-orange/30 bg-status-orange/10 px-4 py-3 flex flex-col gap-1.5">
          <p className="text-console-sm text-status-orange font-medium">This replaces existing sessions</p>
          <ul className="text-console-meta text-status-orange flex flex-col gap-0.5">
            {replacing.map((s) => (
              <li key={s.id}>
                &ldquo;{s.day_label} • {s.session_label}&rdquo;: its current items are deleted and replaced with{" "}
                {kept.programs.filter((p) => p.session_id === s.id).length} from this import.
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.warnings.length > 0 && (
        <div className="rounded-panel border border-line-soft px-4 py-3 flex flex-col gap-1.5">
          <p className="text-console-sm text-primary font-medium">Worth a look</p>
          <ul className="text-console-meta text-muted flex flex-col gap-0.5 max-h-32 overflow-y-auto">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w.item !== null ? `Item ${w.item}: ` : ""}{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {remainingErrors.length > 0 && (
        <ul className="text-console-meta text-status-red flex flex-col gap-1 max-h-32 overflow-y-auto">
          {remainingErrors.map((e) => (
            <li key={e.index}>
              Item {e.index + 1} ({e.name || "untitled"}): {e.errors.join(", ")} — remove it to continue.
            </li>
          ))}
        </ul>
      )}

      <div className="max-h-80 overflow-y-auto rounded-panel border border-line-soft">
        {preview.sessions.map((session) => {
          const rows = preview.programs.map((p, index) => ({ p, index })).filter(({ p }) => p.session_id === session.id);
          return (
            <div key={session.id}>
              <div className="sticky top-0 bg-raised px-3 py-1.5 text-console-meta text-muted-2 uppercase tracking-wide border-b border-line-soft">
                {session.day_label} • {session.session_label}
              </div>
              <table className="w-full text-console-sm">
                <thead>
                  <tr className="text-console-meta text-muted-2 text-left">
                    <th className="px-3 py-1.5 font-normal">Time</th>
                    <th className="px-3 py-1.5 font-normal">Item</th>
                    <th className="px-3 py-1.5 font-normal">Presenter</th>
                    <th className="px-3 py-1.5 font-normal">Duration</th>
                    <th className="px-3 py-1.5 font-normal"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, index }) => {
                    const isRemoved = removed.has(index);
                    return (
                      <tr key={index} className={`border-t border-line-soft ${isRemoved ? "opacity-40 line-through" : ""}`}>
                        <td className="px-3 py-1.5 text-muted-2 tabular-nums whitespace-nowrap">{p.start_time ?? "—"}</td>
                        <td className="px-3 py-1.5 text-primary">
                          {p.name}
                          {p.type === "break" && <span className="text-muted-2"> (break)</span>}
                        </td>
                        <td className="px-3 py-1.5 text-muted">{p.presenter ?? "—"}</td>
                        <td className="px-3 py-1.5 text-muted tabular-nums">{p.duration ? `${p.duration}m` : "—"}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            aria-label={isRemoved ? `Restore ${p.name}` : `Remove ${p.name}`}
                            onClick={() =>
                              setRemoved((prev) => {
                                const next = new Set(prev);
                                if (next.has(index)) next.delete(index);
                                else next.add(index);
                                return next;
                              })
                            }
                            className="text-muted-2 hover:text-primary cursor-pointer no-underline"
                          >
                            {isRemoved ? "Undo" : <X className="h-4 w-4" strokeWidth={2} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {error && <p className="text-console-meta text-status-red">{error}</p>}

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={remainingErrors.length > 0 || kept.programs.length === 0}
          loading={busy}
        >
          Confirm import
        </Button>
        <Button variant="ghost" onClick={() => setPreview(null)} disabled={busy}>
          Back
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

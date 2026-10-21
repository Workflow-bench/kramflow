"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { replacedSessions, type ImportDone } from "@/lib/cue-sheet-import-result";
import type { ParsedProgram, ParsedSession } from "@/lib/parse-cuesheet";
import type { Session } from "@/lib/types";

// Upload step of the cue-sheet import. Real requests go to /api/cue-sheet/upload
// through `api`; the production-excluded import harness passes a synthetic one.
export interface UploadApi {
  post(url: string, body: FormData): Promise<Response>;
}

export const defaultUploadApi: UploadApi = {
  post: (url, body) => fetch(url, { method: "POST", body }),
};

export function UploadPanel({
  eventId,
  sessions,
  onDone,
  onCancel,
  api = defaultUploadApi,
}: {
  eventId: string;
  sessions: Session[];
  onDone: (done: ImportDone) => void;
  onCancel: () => void;
  api?: UploadApi;
}) {
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
      const res = await api.post("/api/cue-sheet/upload?dryRun=1", body);
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
      const res = await api.post("/api/cue-sheet/upload", body);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to import");
        return;
      }
      onDone({ sessionIds: data.sessionIds ?? {}, sessions: preview?.sessions ?? [], programs: preview?.programs ?? [] });
    } finally {
      setBusy(false);
    }
  }

  // Import is a wholesale replace, not a merge — /api/cue-sheet/upload's
  // own comment confirms it ("replaces each affected session's programs
  // wholesale") and session ids are a deterministic slug of day+session
  // label (lib/parse-cuesheet.ts, matching session-form.tsx's own id
  // scheme), so a parsed session whose label matches one that already
  // exists *will* land on that same id and silently delete its current
  // items. The preview never said so — this makes the real consequence
  // visible before Confirm rather than after.
  const sessionVerdicts = preview?.sessions.map((s) => ({
    session: s,
    replaces: replacedSessions(sessions, [s]).length > 0,
    itemCount: preview.programs.filter((p) => p.session_id === s.id).length,
  }));

  return (
    <div className="flex flex-col gap-4">
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

      {/* role="alert": a failed parse or import is announced, not only shown. */}
      {error && <p role="alert" className="text-console-meta text-status-red">{error}</p>}

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
          <p className="text-console-sm text-muted">
            Parsed {preview.sessions.length} sessions, {preview.programs.length} items.
            {preview.errors.length > 0 && (
              <span className="text-status-red"> {preview.errors.length} rows have validation errors.</span>
            )}
          </p>

          {/* Import replaces, it never merges — a session whose day/session
              label matches one that already exists lands on that session's
              real id and its current items are deleted and replaced by
              what's parsed here. Previously unstated; this is the real
              consequence, not a hedge. */}
          {sessionVerdicts && sessionVerdicts.some((v) => v.replaces) && (
            <div className="rounded-panel border border-status-orange/30 bg-status-orange/10 px-4 py-3 flex flex-col gap-1.5">
              <p className="text-console-sm text-status-orange font-medium">This replaces existing sessions</p>
              <ul className="text-console-meta text-status-orange flex flex-col gap-0.5">
                {sessionVerdicts
                  .filter((v) => v.replaces)
                  .map((v) => (
                    <li key={v.session.id}>
                      &ldquo;{v.session.day_label} • {v.session.session_label}&rdquo;, its current items are deleted
                      and replaced with {v.itemCount} from this file.
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {preview.errors.length > 0 && (
            <ul className="text-console-meta text-status-red flex flex-col gap-1 max-h-40 overflow-y-auto">
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

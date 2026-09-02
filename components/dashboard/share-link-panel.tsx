"use client";

import { useEffect, useState } from "react";
import { Link2, Plus, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { QrCode } from "./qr-code";

interface ShareLink {
  id: string;
  token: string;
  label: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

const EXPIRY_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
];

// Takes `now` as a parameter rather than calling Date.now() itself — this
// gets called from render (mapping over links), and Date.now() is an
// impure call React's render-purity rule (react-hooks/purity) correctly
// flags there: two renders in the same commit could disagree on "now" and
// produce a different status for the same link. The caller threads through
// one `now` value captured in state instead (set alongside the links list
// itself, not on every tick — link expiry is measured in days, not
// something that needs second-by-second freshness).
function linkStatus(link: ShareLink, now: number): { label: string; tone: "green" | "muted" | "red" } {
  if (link.revoked_at) return { label: "Revoked", tone: "red" };
  if (new Date(link.expires_at).getTime() <= now) return { label: "Expired", tone: "muted" };
  return { label: "Active", tone: "green" };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ShareLinkPanel({
  eventId,
  compact = false,
}: {
  eventId: string;
  /** Skip the standalone Panel/heading/description trigger and render just
   *  the button — for embedding inside another card (the Dashboard's event
   *  grid) that already carries the event's own identity and doesn't need
   *  a second nested card explaining what a share link is. The Modal this
   *  opens is unchanged either way. */
  compact?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  // Captured once per data load (mount + after create/revoke), not read
  // live during render — see linkStatus()'s comment on why Date.now()
  // can't be called from render itself.
  const [now, setNow] = useState(() => Date.now());
  const [expiryDays, setExpiryDays] = useState("7");
  const [creating, setCreating] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ShareLink | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/share-links?eventId=${encodeURIComponent(eventId)}`)
      .then((res) => res.json())
      .then((data: { ok: boolean; links?: ShareLink[] }) => {
        if (data.ok && data.links) {
          setLinks(data.links);
          setNow(Date.now());
        }
      })
      .catch(() => toast.error("Couldn't load share links."));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount / eventId change
  }, [eventId]);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, expiresInDays: Number(expiryDays) }),
      });
      const data: { ok: boolean; link?: ShareLink; error?: string } = await res.json();
      if (!data.ok || !data.link) {
        toast.error(data.error ?? "Couldn't generate a link.");
        return;
      }
      setLinks((prev) => [data.link!, ...(prev ?? [])]);
      setNow(Date.now());
      setExpandedId(data.link.id);
      toast.success("Share link generated.");
    } catch {
      toast.error("Couldn't reach the server.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/share-links/${revokeTarget.id}`, { method: "DELETE" });
      const data: { ok: boolean; link?: ShareLink; error?: string } = await res.json();
      if (!data.ok) {
        toast.error(data.error ?? "Couldn't revoke this link.");
        return;
      }
      setLinks((prev) => prev?.map((l) => (l.id === revokeTarget.id ? data.link! : l)) ?? null);
      setNow(Date.now());
      toast.success("Link revoked — it will no longer open for anyone.");
      setRevokeTarget(null);
    } catch {
      toast.error("Couldn't reach the server.");
    } finally {
      setRevoking(false);
    }
  }

  // Self-computed rather than passed from the server: window.location.origin
  // is exactly what a browser opening this page actually used to reach it,
  // and this is text copied into a QR code, not a redirect target — no
  // security reason to prefer a server-trusted value. Read directly during
  // render (not state+effect) — it's a stable property read, not a call to
  // an impure function, and the typeof guard keeps SSR from throwing.
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const activeLinks = links?.filter((l) => !l.revoked_at && new Date(l.expires_at).getTime() > now) ?? [];
  const inactiveLinks = links?.filter((l) => l.revoked_at || new Date(l.expires_at).getTime() <= now) ?? [];

  return (
    <>
      {/* A trigger, not the panel itself — generating/managing links is a
          multi-step task (pick an expiry, generate, then copy/QR/revoke)
          that produces a real artifact, the same shape as StageTimer's own
          Output Links, which is a modal rather than living permanently
          inline on the room's main view. See
          senior-ux-layout-standards's inline-vs-modal reasoning. */}
      {compact ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="w-full">
          <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
          Share Display Link{links && links.length > 0 ? ` (${links.length})` : ""}
        </Button>
      ) : (
        <Panel className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-console-md text-primary">Share Display Link</h2>
            <p className="text-console-meta text-muted-2 mt-1">
              Generate a no-login link + QR code for a TV or tablet — picks a screen (General, AV, Green Room,
              Presenter) and shows a live, read-only view.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setOpen(true)} className="shrink-0">
            <Link2 className="h-4 w-4" strokeWidth={2} />
            Manage Links{links && links.length > 0 ? ` (${links.length})` : ""}
          </Button>
        </Panel>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Share Display Link" size="lg">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-console-meta text-muted-2 flex-1 min-w-[16rem]">
          Anyone who opens the link picks a screen (General, AV, Green Room, Presenter) and sees a live, read-only
          view — no account needed.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={expiryDays} onChange={setExpiryDays} options={EXPIRY_OPTIONS} className="w-28" aria-label="Link expiry" />
          <Button variant="primary" onClick={handleCreate} loading={creating}>
            <Plus className="h-4 w-4" strokeWidth={2} />
            Generate Link
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {links === null && <p className="text-console-meta text-muted-2">Loading…</p>}

        {links !== null && links.length === 0 && (
          <EmptyState
            title="No share links yet"
            body="Generate one to let a TV or tablet pick a display screen without logging in."
          />
        )}

        {[...activeLinks, ...inactiveLinks].map((link) => {
          const status = linkStatus(link, now);
          const url = `${origin}/screens?token=${link.token}`;
          const expanded = expandedId === link.id;
          return (
            <div key={link.id} className="rounded-control border border-line-soft bg-raised/40">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : link.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Link2 className="h-4 w-4 text-muted-2 shrink-0" strokeWidth={2} />
                <span className="min-w-0 flex-1">
                  <span className="block text-console-sm text-primary truncate">
                    {link.label ?? "Display link"}
                  </span>
                  <span className="block text-console-meta text-muted-2 mt-0.5">
                    Created {formatDate(link.created_at)} · Expires {formatDate(link.expires_at)}
                    {link.last_used_at && ` · Last used ${formatDate(link.last_used_at)}`}
                  </span>
                </span>
                <Badge tone={status.tone} dot>
                  {status.label}
                </Badge>
              </button>

              {expanded && (
                <div className="px-4 pb-4 pt-1 flex flex-col sm:flex-row gap-4 items-start border-t border-line-soft">
                  {status.label === "Active" ? (
                    <>
                      <QrCode value={url} size={140} />
                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <p className="text-console-meta text-muted-2">Share URL</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 min-w-0 truncate rounded-control bg-background border border-line px-3 py-2 text-console-meta text-primary">
                            {url}
                          </code>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(url);
                              toast.success("Link copied.");
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                        <div>
                          <Button variant="danger" size="sm" onClick={() => setRevokeTarget(link)}>
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                            Revoke
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-console-meta text-muted-2 py-2">
                      This link is {status.label.toLowerCase()} and no longer opens.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </Modal>

      {/* A sibling of Modal, not nested inside it — Modal's motion.div
          animates `transform`, which creates a new containing block for
          `position: fixed` descendants, so a ConfirmDialog nested inside
          it would be constrained to the Modal's box instead of the real
          viewport. Rendering it here keeps its own fixed inset-0 correct
          regardless of whether the Share Link modal is open. */}
      {/* Lower guardrail weight than session/event delete on purpose
          (docs/DESIGN.md's guardrail-tier table) — this revokes one link,
          not any data. A screen currently open on it loses access, but a
          replacement link is the same two clicks this one took, so the
          copy says that plainly instead of matching event-delete's
          "permanently destroyed" register. */}
      <ConfirmDialog
        open={revokeTarget !== null}
        title="Revoke this link?"
        description="Any screen currently open on it loses access right away. A new link takes the same two clicks this one did."
        confirmLabel="Revoke"
        tone="danger"
        loading={revoking}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </>
  );
}

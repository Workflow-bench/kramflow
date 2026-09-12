"use client";

import { useEffect, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/ui/section-label";
import { useIsOwner } from "@/lib/event-context";
import { useToast } from "@/components/ui/toast";

type Credential = { id: string; label: string; scopes: string[]; created_at: string; last_used_at: string | null; revoked_at: string | null };

// Phase 7c: this was the one file in Settings — and per the Landing ->
// Product Visual System Audit, in the whole authenticated product — still
// on raw text-sm/text-xs and rounded-lg instead of the console-scale
// tokens/radius every sibling section already used, plus a Panel wrapper
// now redundant with the section-nav workspace shell
// (app/e/[eventId]/settings/page.tsx) that renders exactly one section at
// a time. Brought into the same field/row/action grammar as Event
// Details/Auditoriums/Collaborators — no change to token generation,
// hashing, API routes, or the one-time-reveal behavior below.
export function IntegrationCredentialsPanel({ eventId }: { eventId: string }) {
  const isOwner = useIsOwner();
  const toast = useToast();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [label, setLabel] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () =>
    fetch(`/api/events/${eventId}/integrations`)
      .then((r) => r.json())
      .then((d) => setCredentials(d.credentials ?? []))
      .catch(() => {});
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load is stable across the eventId this effect keys on
  }, [eventId]);

  async function create() {
    if (!label.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Couldn't create integration");
      setToken(data.token);
      setLabel("");
      load();
    } finally {
      setLoading(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/events/${eventId}/integrations/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Couldn't revoke integration");
    load();
  }

  function copy(value: string) {
    navigator.clipboard.writeText(value);
    toast.success("Copied");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionLabel>External API</SectionLabel>
        <p className="text-console-meta text-muted-2 mt-1">
          Use a scoped credential for Companion, Stream Deck, or trusted automation. Live actions still respect the
          active controller.
        </p>
      </div>

      {/* The one genuinely sensitive, shown-once secret in Settings — still
          a bordered surface on purpose (a real boundary worth having, per
          Phase 7c's own carve-out), just on canonical tokens now
          (rounded-control, not rounded-lg). */}
      {token && (
        <div className="rounded-control border border-line-soft bg-background p-3">
          <p className="text-console-sm font-medium text-primary">Copy this token now. It will not be shown again.</p>
          <div className="mt-2 flex gap-2">
            <code className="min-w-0 flex-1 break-all text-console-meta text-muted">{token}</code>
            <Button size="sm" variant="secondary" onClick={() => copy(token)} aria-label="Copy integration token">
              <Copy className="h-3.5 w-3.5" strokeWidth={2} />
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Integration name, e.g. FOH Stream Deck"
          aria-label="Integration name"
          disabled={!isOwner || loading}
          maxLength={80}
          className="flex-1"
        />
        <Button variant="secondary" size="sm" onClick={create} loading={loading} disabled={!isOwner || !label.trim()}>
          Create credential
        </Button>
      </div>
      <p className="text-console-meta text-muted-2">
        Scopes: state read and live control. Base URL: <code className="text-muted">/api/v1/events/{eventId}</code>
      </p>

      {credentials.length > 0 && (
        <ul className="flex flex-col">
          {credentials.map((credential) => (
            <li key={credential.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-line-soft">
              <div className="min-w-0">
                <p className="text-console-sm text-primary truncate">{credential.label}</p>
                <p className="text-console-meta text-muted-2">
                  {credential.revoked_at
                    ? "Revoked"
                    : credential.last_used_at
                      ? `Last used ${new Date(credential.last_used_at).toLocaleString()}`
                      : "Active, not yet used"}
                </p>
              </div>
              {!credential.revoked_at && (
                <Button
                  size="sm"
                  variant="ghost"
                  square
                  disabled={!isOwner}
                  onClick={() => revoke(credential.id)}
                  aria-label={`Revoke ${credential.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

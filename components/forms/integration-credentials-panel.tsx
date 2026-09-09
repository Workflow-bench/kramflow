"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsOwner } from "@/lib/event-context";
import { useToast } from "@/components/ui/toast";

type Credential = { id: string; label: string; scopes: string[]; created_at: string; last_used_at: string | null; revoked_at: string | null };

export function IntegrationCredentialsPanel({ eventId }: { eventId: string }) {
  const isOwner = useIsOwner();
  const toast = useToast();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [label, setLabel] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => fetch(`/api/events/${eventId}/integrations`).then((r) => r.json()).then((d) => setCredentials(d.credentials ?? [])).catch(() => {});
  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    if (!label.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/integrations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Couldn't create integration");
      setToken(data.token);
      setLabel("");
      load();
    } finally { setLoading(false); }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/events/${eventId}/integrations/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Couldn't revoke integration");
    load();
  }

  function copy(value: string) { navigator.clipboard.writeText(value); toast.success("Copied"); }

  return (
    <Panel className="mt-6 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 text-muted" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <h2 className="text-console-md">External API</h2>
          <p className="mt-1 text-console-sm text-muted">Use a scoped credential for Companion, Stream Deck, or trusted automation. Live actions still respect the active controller.</p>
        </div>
      </div>
      {token && <div className="mt-4 rounded-lg border border-line-soft bg-background p-3">
        <p className="text-sm font-medium">Copy this token now. It will not be shown again.</p>
        <div className="mt-2 flex gap-2"><code className="min-w-0 flex-1 break-all text-xs text-muted">{token}</code><Button size="sm" variant="secondary" onClick={() => copy(token)} aria-label="Copy integration token"><Copy className="h-4 w-4" /></Button></div>
      </div>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Integration name, e.g. FOH Stream Deck" disabled={!isOwner || loading} maxLength={80} />
        <Button onClick={create} loading={loading} disabled={!isOwner || !label.trim()}>Create credential</Button>
      </div>
      <p className="mt-2 text-sm text-muted">Scopes: state read and live control. Base URL: <code>/api/v1/events/{eventId}</code></p>
      <div className="mt-4 space-y-2">
        {credentials.map((credential) => <div key={credential.id} className="flex items-center justify-between gap-3 rounded-lg border border-line-soft p-3">
          <div><p className="text-sm font-medium">{credential.label}</p><p className="text-xs text-muted">{credential.revoked_at ? "Revoked" : credential.last_used_at ? `Last used ${new Date(credential.last_used_at).toLocaleString()}` : "Active, not yet used"}</p></div>
          {!credential.revoked_at && <Button size="sm" variant="ghost" disabled={!isOwner} onClick={() => revoke(credential.id)} aria-label={`Revoke ${credential.label}`}><Trash2 className="h-4 w-4" /></Button>}
        </div>)}
      </div>
    </Panel>
  );
}

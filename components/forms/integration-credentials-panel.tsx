"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { useIsOwner } from "@/lib/event-context";
import { useToast } from "@/components/ui/toast";

type Credential = { id: string; label: string; scopes: string[]; created_at: string; last_used_at: string | null; revoked_at: string | null };

// Phase 7c originally brought this file into the same field/row/action
// grammar as Event Details/Auditoriums/Collaborators (console-scale
// tokens/radius, no more standalone Panel wrapper). That pass's own
// comment claimed "no change to token generation, hashing, API routes, or
// the one-time-reveal behavior" — no longer true (Codex Phase 1 review,
// R-standards): both the POST route and this component changed materially
// below, per KF-003. Corrected rather than left to mislead the next
// reader.
//
// Audit remediation KF-003 / R3: credential creation is disabled
// server-side (app/api/events/[eventId]/integrations/route.ts's POST
// always returns 403 coming_soon), and every control action an *existing*
// credential could take is separately, unconditionally gated the same way
// in app/api/v1/events/[eventId]/actions/[action]/route.ts — see that
// route's own comment for why "the lease can never be acquired" was an
// overclaim the Codex review caught, and why the gate now lives before any
// lease/no-op logic instead of relying on it. The create form (and its
// one-time token-reveal box) is removed here entirely, not left to fail
// against the API: a disabled-looking button that still 403s on click is
// exactly the "UI copy doesn't match server behavior" pattern the original
// audit flagged elsewhere. List + revoke stay so an owner can still see
// and clean up credentials created before this was disabled.
export function IntegrationCredentialsPanel({ eventId }: { eventId: string }) {
  const isOwner = useIsOwner();
  const toast = useToast();
  const [credentials, setCredentials] = useState<Credential[]>([]);

  const load = () =>
    fetch(`/api/events/${eventId}/integrations`)
      .then((r) => r.json())
      .then((d) => setCredentials(d.credentials ?? []))
      .catch(() => {});
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load is stable across the eventId this effect keys on
  }, [eventId]);

  async function revoke(id: string) {
    const res = await fetch(`/api/events/${eventId}/integrations/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Couldn't revoke integration");
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionLabel>External API</SectionLabel>
        <p className="text-console-meta text-muted-2 mt-1">
          A scoped credential for Companion, Stream Deck, or trusted automation to control the live show.
        </p>
      </div>

      <div className="rounded-control border border-line-soft bg-background p-3">
        <p className="text-console-sm font-medium text-primary">Coming soon</p>
        <p className="text-console-meta text-muted-2 mt-1">
          Control credentials aren&rsquo;t available yet — we&rsquo;re still building reliable ownership of the live
          show for external tools. {isOwner ? "You" : "The event owner"} can still revoke any credential created
          earlier below.
        </p>
      </div>

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

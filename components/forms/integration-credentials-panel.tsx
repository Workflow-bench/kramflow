"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
//
// Audit remediation KF-003: credential creation is disabled server-side
// (app/api/events/[eventId]/integrations/route.ts's POST always returns
// 403 coming_soon) because every control action a credential can take
// (start/hold/resume/next) structurally cannot acquire the controller
// lease and would always 423 — see that route's own comment. The create
// form is removed here too, not just left to fail against the API: a
// disabled-looking button that still 403s on click is exactly the "UI
// copy doesn't match server behavior" pattern the audit flagged elsewhere.
// List + revoke stay so an owner can still see and clean up credentials
// created before this was disabled.
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

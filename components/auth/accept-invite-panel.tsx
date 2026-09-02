"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, LinkButton } from "@/components/ui/button";

type AcceptState = "accepting" | "error";

// The three shapes app/invite/[token]/page.tsx can hand off to, once the
// invite token itself is known to be valid:
//  - "auto-accept": visitor is already logged in as the invited email —
//    accept immediately, no extra click needed.
//  - "mismatch": visitor is logged in, but as a different email — the
//    invite can't silently switch accounts out from under them.
//  - "signed-out": normal case — send them to log in or sign up, carrying
//    the invite token through so acceptance happens right after.
type Props =
  | { mode: "auto-accept"; token: string; eventName: string }
  | { mode: "mismatch"; invitedEmail: string; loggedInEmail: string }
  | { mode: "signed-out"; eventName: string; role: "editor" | "viewer"; hasAccount: boolean; loginHref: string; signupHref: string };

export function AcceptInvitePanel(props: Props) {
  if (props.mode === "auto-accept") return <AutoAccept token={props.token} eventName={props.eventName} />;
  if (props.mode === "mismatch") return <EmailMismatch {...props} />;
  return <SignedOutCta {...props} />;
}

function AutoAccept({ token, eventName }: { token: string; eventName: string }) {
  const [state, setState] = useState<AcceptState>("accepting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/invites/${token}/accept`, { method: "POST" })
      .then((res) => res.json())
      .then((data: { ok: boolean; eventId?: string; error?: string }) => {
        if (cancelled) return;
        if (!data.ok || !data.eventId) {
          setError(data.error ?? "Couldn't accept this invite.");
          setState("error");
          return;
        }
        // Hard navigation, same reasoning as login/signup's redirects —
        // proxy.ts needs to see this on a fresh request, and the roster
        // change should land before the event's own pages fetch anything.
        window.location.href = `/e/${data.eventId}/operator`;
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't reach the server.");
          setState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "error") {
    return (
      <div className="flex flex-col items-center text-center gap-4 max-w-md">
        <h1 className="text-title text-primary">Couldn&rsquo;t join {eventName}</h1>
        <p className="text-body text-muted">{error}</p>
        <Link
          href="/dashboard"
          className="mt-2 rounded-control bg-raised border border-line px-5 py-2.5 text-console-sm text-primary hover:bg-card-hover hover:border-white/20 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center gap-3">
      <h1 className="text-title text-primary">Joining {eventName}&hellip;</h1>
      <p className="text-body text-muted">One moment.</p>
    </div>
  );
}

function EmailMismatch({ invitedEmail, loggedInEmail }: { invitedEmail: string; loggedInEmail: string }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleSwitch() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }

  return (
    <div className="flex flex-col items-center text-center gap-4 max-w-md">
      <h1 className="text-title text-primary">Wrong account</h1>
      <p className="text-body text-muted">
        This invite was sent to <span className="text-primary">{invitedEmail}</span>, but you&rsquo;re logged in as{" "}
        <span className="text-primary">{loggedInEmail}</span>.
      </p>
      <Button variant="secondary" size="lg" loading={loggingOut} onClick={handleSwitch}>
        Log Out &amp; Switch Accounts
      </Button>
    </div>
  );
}

function SignedOutCta({
  eventName,
  role,
  hasAccount,
  loginHref,
  signupHref,
}: {
  eventName: string;
  role: "editor" | "viewer";
  hasAccount: boolean;
  loginHref: string;
  signupHref: string;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-4 max-w-md">
      <h1 className="text-title text-primary">You&rsquo;re invited to {eventName}</h1>
      <p className="text-body text-muted">
        Join as {role === "editor" ? "an Editor" : "a Viewer"} — {role === "editor" ? "edit the cue sheet" : "view the live cue sheet"}.
      </p>
      <LinkButton
        href={hasAccount ? loginHref : signupHref}
        className="mt-2 w-full max-w-xs"
        variant="primary"
        size="lg"
      >
        {hasAccount ? "Log In to Accept" : "Create Your Account"}
      </LinkButton>
      {!hasAccount && (
        <Link href={loginHref} className="text-console-meta text-muted-2 hover:underline">
          Already have an account? Log in
        </Link>
      )}
    </div>
  );
}

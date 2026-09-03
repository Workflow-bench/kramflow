import Link from "next/link";
import { Link2Off } from "lucide-react";
import type { ResolveInviteReason } from "@/lib/server/collaborator-invites";

const MESSAGES: Record<ResolveInviteReason, { title: string; body: string }> = {
  expired: {
    title: "This invite has expired",
    body: "Invites are valid for 14 days. Ask the event owner to send a new one.",
  },
  already_accepted: {
    title: "This invite was already used",
    body: "If you're the one who accepted it, just log in. You already have access.",
  },
  not_found: {
    title: "This invite isn't recognized",
    body: "Double-check the link, or ask the event owner to send it again.",
  },
};

// Same visual language and "why, specifically" approach as
// components/auth/link-invalid.tsx (share-display-link's equivalent), on
// the standard app background rather than the TV-display one — this is a
// page an invitee opens on their own phone or laptop, not a stage TV.
export function InviteInvalid({ reason }: { reason: ResolveInviteReason }) {
  const { title, body } = MESSAGES[reason];
  return (
    <main className="h-screen w-screen flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center text-center gap-4 max-w-md">
        <div className="h-14 w-14 rounded-full bg-card flex items-center justify-center">
          <Link2Off className="h-6 w-6 text-muted-2" strokeWidth={2} />
        </div>
        <h1 className="text-title text-primary">{title}</h1>
        <p className="text-body text-muted">{body}</p>
        <Link
          href="/login"
          className="mt-4 rounded-control bg-raised border border-line px-5 py-2.5 text-console-sm text-primary hover:bg-card-hover hover:border-white/20 transition-colors"
        >
          Log In
        </Link>
      </div>
    </main>
  );
}

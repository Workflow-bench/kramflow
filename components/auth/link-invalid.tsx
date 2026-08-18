import Link from "next/link";
import { Link2Off } from "lucide-react";
import type { ShareLinkInvalidReason } from "@/lib/server/share-links";

const MESSAGES: Record<ShareLinkInvalidReason | "no_token", { title: string; body: string }> = {
  expired: {
    title: "This link has expired",
    body: "Ask the operator to generate a new Share Display Link from the dashboard.",
  },
  revoked: {
    title: "This link is no longer valid",
    body: "It was revoked by an operator. Ask them to generate a new Share Display Link.",
  },
  not_found: {
    title: "This link isn't recognized",
    body: "Double-check the URL, or scan the QR code again from the operator dashboard.",
  },
  no_token: {
    title: "This page requires a link or login",
    body: "Scan the QR code an operator shared with you, or log in if you're the operator.",
  },
};

// The explicit "this link is no longer valid" state the task called out —
// StageTimer's own equivalent (an expired/tampered signed URL) rendered a
// generic access-denied page in our research pass; this is deliberately
// specific about *why*, on the same dark Stage-scale surface every TV
// display already uses, so it never looks like the app just broke.
export function LinkInvalid({ reason }: { reason: ShareLinkInvalidReason | "no_token" }) {
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
          Operator Log In
        </Link>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-context";

// Private surface: not for search. Title is static, so no account or event data reaches the head.
export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

// This group now covers /dashboard only — every per-event operator
// surface (console, cue sheet, remote, broadcast center, display manager)
// moved under app/e/[eventId]/layout.tsx, which has its own ownership
// check and mounts CommandPalette itself (it needs an eventId to build
// its nav targets, which /dashboard's event *list* doesn't have). No
// PinGate anymore — proxy.ts (project root) is the real gate now,
// redirecting to /login server-side before any route under this layout
// ever renders. AuthProvider stays: it's what backs useAuth()'s
// status/lock for the operator UI, not what enforces access.
export default function OperatorGroupLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

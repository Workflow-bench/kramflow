import { notFound } from "next/navigation";
import { RealtimeHarness } from "./harness";

// SYNTHETIC HARNESS, development only (404 in production, same gate as the other
// catalog harnesses). Drives the REAL display store with a controlled transport
// (lib/display-engine/fake-transport.ts). No Supabase, no network: every read and
// Realtime event is answered by the harness's controlled server.
export default function RealtimeHarnessPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RealtimeHarness />;
}

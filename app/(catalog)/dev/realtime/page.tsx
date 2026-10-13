import { notFound } from "next/navigation";

// SYNTHETIC HARNESS, development only (404 in production, same gate as the other
// catalog harnesses). Drives the REAL display store with a controlled transport
// (lib/display-engine/fake-transport.ts). No Supabase, no network: every read and
// Realtime event is answered by the harness's controlled server.

// Production build: the harness module is not imported (see the dev branch).
export default async function RealtimeHarnessPage() {
  if (process.env.NODE_ENV !== "production") {
    const { RealtimeHarness } = await import("./harness");
    return <RealtimeHarness />;
  }
  notFound();
}

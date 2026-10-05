import { notFound } from "next/navigation";
import { ImportHarness } from "./harness";

// SYNTHETIC HARNESS, development only. Mounts the real UploadPanel, ImportCompleteStep
// and planOpenConsole with synthetic requests and fixtures. Returns 404 in production
// (same gate as the component catalog and rehearsal harness). No database, no
// /api/cue-sheet/upload, no store writes: every request is answered by the harness.
export default async function ImportHarnessPage({ searchParams }: { searchParams: Promise<{ live?: string; fail?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { live, fail } = await searchParams;
  return <ImportHarness live={live === "started" || live === "locked" ? live : "none"} fail={fail === "parse" || fail === "commit" ? fail : "none"} />;
}

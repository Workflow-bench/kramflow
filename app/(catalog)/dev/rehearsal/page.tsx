import { notFound } from "next/navigation";
import { RehearsalHarness } from "./harness";

// SYNTHETIC HARNESS, development only. Mounts the real RehearsalView with fixture
// sessions so zero-, one- and multi-cue boundaries, Finish, completion, exit
// confirmation and focus return can be exercised without an authenticated event.
// Returns 404 in production (same gate as the component catalog). No auth bypass,
// no database, no /api/live: the view itself never calls those.
export default async function RehearsalHarnessPage({ searchParams }: { searchParams: Promise<{ fixture?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { fixture } = await searchParams;
  const known = fixture === "none" || fixture === "zero" || fixture === "one" || fixture === "two" ? fixture : "multi";
  return <RehearsalHarness fixture={known} />;
}

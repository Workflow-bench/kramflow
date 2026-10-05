"use client";

import { useEventId } from "@/lib/event-context";
import { useSessions } from "@/lib/use-sessions";
import { RehearsalView } from "@/components/rehearsal/rehearsal-view";

// Real route: sessions come from the same read path the console uses. The view
// takes them as props, so the production-excluded harness can mount it with fixtures.
export default function RehearsalPage() {
  const eventId = useEventId();
  const sessions = useSessions();
  return <RehearsalView eventId={eventId} sessions={sessions} />;
}

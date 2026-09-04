import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { LockButton } from "@/components/dashboard/lock-button";
import { HelpMenu } from "@/components/dashboard/help-menu";
import { EventsDashboard } from "@/components/dashboard/events-dashboard";
import { PageHeader } from "@/components/ui/page-header";

// The post-login landing point — proxy.ts sends every authenticated
// operator here. Lists every event this operator can actually open:
// owned, plus events they're an accepted collaborator on — see
// app/api/events/route.ts's GET for why (a collaborator previously had
// real working access but no way to find the event from their own
// Dashboard). The `.eq("owner_id", ...)` / `.eq("user_id", ...)` filters
// here are belt-and-suspenders on top of the real boundary, RLS
// (supabase/schema.sql), which returns nothing either query isn't
// actually entitled to even if a filter were removed by mistake.
export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already redirects signed-out requests to /login, but that
  // check and this one aren't atomic — a session revoked in the narrow
  // window between them would otherwise hit the non-null assertion below
  // and 500 instead of bouncing to /login like every other unauthenticated
  // request in the app.
  if (!user) redirect("/login");

  const admin = supabaseAdmin();
  const EVENT_FIELDS = "id, name, created_at, event_date, venue, timezone";
  const [ownedResult, collabResult] = await Promise.all([
    admin.from("events").select(EVENT_FIELDS).eq("owner_id", user.id).order("created_at", { ascending: false }),
    admin
      .from("event_collaborators")
      .select(`role, event:events(${EVENT_FIELDS})`)
      .eq("user_id", user.id)
      .eq("status", "accepted"),
  ]);
  const owned = (ownedResult.data ?? []).map((e) => ({ ...e, role: "owner" as const }));
  const collaborating = (collabResult.data ?? [])
    .filter((c) => c.event)
    .map((c) => ({ ...(c.event as object as { id: string; name: string; created_at: string; event_date: string | null; venue: string | null; timezone: string | null }), role: c.role as "editor" | "viewer" }));
  const events = [...owned, ...collaborating].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Readiness, not a KPI dashboard: real counts (do sessions/items exist
  // yet?) and whether any session is actually live right now — every
  // field here is data the product already has, batched for all events
  // in one pass rather than N+1 queries per row. No invented metrics.
  const eventIds = events.map((e) => e.id);
  const [sessionsResult, programsResult, liveStateResult] = eventIds.length
    ? await Promise.all([
        admin.from("sessions").select("id, event_id").in("event_id", eventIds),
        admin.from("programs").select("event_id").in("event_id", eventIds),
        admin.from("live_state").select("event_id, active_session_id, progress_by_session").in("event_id", eventIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const sessionCounts = new Map<string, number>();
  for (const s of sessionsResult.data ?? []) sessionCounts.set(s.event_id, (sessionCounts.get(s.event_id) ?? 0) + 1);
  const itemCounts = new Map<string, number>();
  for (const p of programsResult.data ?? []) itemCounts.set(p.event_id, (itemCounts.get(p.event_id) ?? 0) + 1);
  const liveEventIds = new Set(
    (liveStateResult.data ?? [])
      .filter((row) => {
        const progress = row.active_session_id
          ? (row.progress_by_session as Record<string, { currentOrder: number | null }>)?.[row.active_session_id]
          : null;
        return progress?.currentOrder != null;
      })
      .map((row) => row.event_id)
  );

  const eventsWithReadiness = events.map((e) => ({
    ...e,
    sessionCount: sessionCounts.get(e.id) ?? 0,
    itemCount: itemCounts.get(e.id) ?? 0,
    isLive: liveEventIds.has(e.id),
  }));

  return (
    <main className="min-h-screen bg-background px-6 py-10 sm:px-10">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        <PageHeader
          eyebrow="Operator Dashboard"
          title="Your Events"
          meta={
            <>
              Signed in as {user?.email ?? "unknown"} · {events.length} event{events.length === 1 ? "" : "s"}
            </>
          }
          actions={
            <>
              <HelpMenu />
              <LockButton />
            </>
          }
        />

        <EventsDashboard initialEvents={eventsWithReadiness} />
      </div>
    </main>
  );
}

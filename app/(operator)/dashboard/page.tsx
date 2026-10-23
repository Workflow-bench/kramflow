import { redirect } from "next/navigation";
import { deriveSessionLifecycle, isRunning, type SessionLifecycle } from "@/lib/session-lifecycle";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { LockButton } from "@/components/dashboard/lock-button";
import { HelpMenu } from "@/components/dashboard/help-menu";
import { EventsDashboard } from "@/components/dashboard/events-dashboard";
import { DashboardInstrumentStrip } from "@/components/dashboard/dashboard-instrument-strip";

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
        admin.from("programs").select("event_id, session_id").in("event_id", eventIds),
        admin.from("live_state").select("event_id, active_session_id, progress_by_session, paused_at").in("event_id", eventIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const sessionCounts = new Map<string, number>();
  for (const s of sessionsResult.data ?? []) sessionCounts.set(s.event_id, (sessionCounts.get(s.event_id) ?? 0) + 1);
  const itemCounts = new Map<string, number>();
  const sessionItemCounts = new Map<string, number>();
  for (const p of (programsResult.data ?? []) as { event_id: string; session_id: string | null }[]) {
    itemCounts.set(p.event_id, (itemCounts.get(p.event_id) ?? 0) + 1);
    if (p.session_id) sessionItemCounts.set(p.session_id, (sessionItemCounts.get(p.session_id) ?? 0) + 1);
  }
  // F03: the active session's lifecycle comes from the same derivation Run
  // and the session switcher use, so a finished active session no longer
  // reads LIVE here just because its progress entry is non-null.
  const lifecycleByEvent = new Map<string, SessionLifecycle>();
  for (const row of (liveStateResult.data ?? []) as {
    event_id: string;
    active_session_id: string | null;
    progress_by_session: Record<string, { currentOrder: number | null }> | null;
    paused_at: string | null;
  }[]) {
    if (!row.active_session_id) continue;
    lifecycleByEvent.set(
      row.event_id,
      deriveSessionLifecycle({
        currentOrder: row.progress_by_session?.[row.active_session_id]?.currentOrder ?? null,
        itemCount: sessionItemCounts.get(row.active_session_id) ?? 0,
        pausedAt: row.paused_at,
      })
    );
  }

  const eventsWithReadiness = events.map((e) => {
    const lifecycle = lifecycleByEvent.get(e.id) ?? "not-started";
    return {
      ...e,
      sessionCount: sessionCounts.get(e.id) ?? 0,
      itemCount: itemCounts.get(e.id) ?? 0,
      lifecycle,
      isLive: isRunning(lifecycle),
    };
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DashboardInstrumentStrip
        email={user?.email ?? "unknown"}
        eventCount={events.length}
        actions={
          <>
            <HelpMenu />
            <LockButton />
          </>
        }
      />
      {/* max-w-5xl, not 7xl — the same bounded measure Console and Cue
          Sheet's own workspaces use for a list of like items (Phase 5/6):
          a dense row list scans better at a consistent width than
          stretched edge-to-edge, and matching their cap is what makes this
          read as the same application instead of a wider, looser one. */}
      <main className="px-6 py-6 sm:px-10">
        <div className="max-w-5xl mx-auto">
          <EventsDashboard initialEvents={eventsWithReadiness} />
        </div>
      </main>
    </div>
  );
}

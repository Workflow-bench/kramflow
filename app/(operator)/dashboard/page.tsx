import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { LockButton } from "@/components/dashboard/lock-button";
import { HelpMenu } from "@/components/dashboard/help-menu";
import { EventsDashboard } from "@/components/dashboard/events-dashboard";

// The post-login landing point — proxy.ts sends every authenticated
// operator here. Any operator can sign up and create their own event(s)
// (see the approved multi-tenant plan); this lists only events this
// specific operator owns — the `.eq("owner_id", user.id)` filter here is
// belt-and-suspenders on top of the real boundary, "owner select" RLS
// (supabase/schema.sql), which returns nothing for anyone else's events
// even if this filter were ever removed by mistake.
export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = supabaseAdmin();
  const { data: events } = await admin
    .from("events")
    .select("id, name, created_at")
    .eq("owner_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-background px-6 py-10 sm:px-10">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-console-label text-muted-2 uppercase tracking-wide">Operator Dashboard</p>
            <h1 className="text-console-lg text-primary mt-1">Your Events</h1>
            <p className="text-console-sm text-muted mt-1">
              Signed in as {user?.email ?? "unknown"} · {(events ?? []).length} event{(events ?? []).length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HelpMenu />
            <LockButton />
          </div>
        </header>

        <EventsDashboard initialEvents={events ?? []} />
      </div>
    </main>
  );
}

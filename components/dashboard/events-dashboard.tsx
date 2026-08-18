"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Smartphone, ListChecks, MonitorPlay, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ShareLinkPanel } from "./share-link-panel";
import { GettingStartedChecklist } from "./getting-started-checklist";

export interface EventSummary {
  id: string;
  name: string;
  created_at: string;
}

// The operator's own event list — each operator can create and manage
// multiple events (see the approved multi-tenant plan's "one operator,
// many events"), and every event here is already scoped to the signed-in
// user by the GET /api/events route's owner_id filter plus RLS underneath
// it. Nothing here needs its own ownership check — an operator simply
// never receives another operator's event in this list to begin with.
export function EventsDashboard({ initialEvents }: { initialEvents: EventSummary[] }) {
  const toast = useToast();
  const router = useRouter();
  const [events, setEvents] = useState<EventSummary[]>(initialEvents);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(events[0]?.id ?? null);
  const [deleteTarget, setDeleteTarget] = useState<EventSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleCreate() {
    // Captured before the request, not after — by the time the response
    // comes back, `events` already has the new row appended, so checking
    // post-create would never see "this was the first one."
    const isFirstEverEvent = events.length === 0;
    setCreating(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() || undefined }),
      });
      const data: { ok: boolean; event?: EventSummary; error?: string } = await res.json();
      if (!data.ok || !data.event) {
        toast.error(data.error ?? "Couldn't create the event.");
        return;
      }
      setNewName("");
      toast.success("Event created.");
      if (isFirstEverEvent) {
        // A brand-new operator's next real step is adding a section, not
        // looking at a Share Link panel for an event with nothing in it
        // yet — send them straight to where that happens ("arrive already
        // working") instead of expanding the dashboard card in place.
        router.push(`/e/${data.event.id}/operator/cue-sheet`);
        return;
      }
      setEvents((prev) => [data.event!, ...prev]);
      setExpandedId(data.event.id);
    } catch {
      toast.error("Couldn't reach the server.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${deleteTarget.id}`, { method: "DELETE" });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        toast.error(data.error ?? "Couldn't delete this event.");
        return;
      }
      setEvents((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      toast.success("Event deleted.");
      setDeleteTarget(null);
    } catch {
      toast.error("Couldn't reach the server.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <GettingStartedChecklist events={events} />

      <Panel className="p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Event name (e.g. Satsang Shibir 2027)"
            aria-label="New event name"
            className="flex-1 min-w-[16rem]"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <Button variant="primary" onClick={handleCreate} loading={creating}>
            <Plus className="h-4 w-4" strokeWidth={2} />
            Create Event
          </Button>
        </div>
      </Panel>

      {events.length === 0 && (
        <EmptyState
          title="No events yet"
          body="Create your first event to start building a cue sheet and running a show."
        />
      )}

      {events.map((event) => {
        const expanded = expandedId === event.id;
        return (
          <Panel key={event.id} className="p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : event.id)}
              className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer"
            >
              <div className="min-w-0">
                <h2 className="text-console-lg text-primary truncate">{event.name}</h2>
                <p className="text-console-sm text-muted mt-1">
                  Created {new Date(event.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              {expanded ? <ChevronUp className="h-5 w-5 text-muted-2 shrink-0" /> : <ChevronDown className="h-5 w-5 text-muted-2 shrink-0" />}
            </button>

            {expanded && (
              <div className="px-6 pb-6 flex flex-col gap-6 border-t border-line-soft pt-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                    <DashboardLink
                      href={`/e/${event.id}/operator`}
                      icon={LayoutDashboard}
                      title="Operator Console"
                      desc="Run the show — start, next, hold, alerts."
                    />
                    <DashboardLink href={`/e/${event.id}/remote`} icon={Smartphone} title="Remote" desc="One-handed mobile control." />
                    <DashboardLink
                      href={`/e/${event.id}/operator/cue-sheet`}
                      icon={ListChecks}
                      title="Cue Sheet"
                      desc="Edit the queue, upload a rundown."
                    />
                  </section>
                </div>

                <ShareLinkPanel eventId={event.id} />

                <Panel className="p-5">
                  <div className="flex items-center gap-2">
                    <MonitorPlay className="h-4 w-4 text-muted-2" strokeWidth={2} />
                    <h3 className="text-console-md text-primary">Preview a display</h3>
                  </div>
                  <p className="text-console-meta text-muted-2 mt-1">
                    You&apos;re logged in, so these open directly — no link or QR code needed.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {[
                      { path: "general", label: "General" },
                      { path: "av", label: "AV" },
                      { path: "green-room", label: "Green Room" },
                      { path: "presenter", label: "Presenter" },
                    ].map((d) => (
                      <Link
                        key={d.path}
                        href={`/${d.path}?eventId=${event.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-control bg-raised border border-line px-3.5 py-2 text-console-sm text-primary hover:bg-card-hover hover:border-white/20 transition-colors"
                      >
                        {d.label}
                      </Link>
                    ))}
                  </div>
                </Panel>

                <div>
                  <Button variant="danger" size="sm" onClick={() => setDeleteTarget(event)}>
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Delete Event
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        );
      })}

      {/* Tier 4 — the one action in the product that outweighs everything
          else on the guardrail-tier table (docs/DESIGN.md): it cascades
          through every session, item, share link, and live state this
          event has, all at once, irreversibly. Typing the event's name is
          the one place that weight is warranted; nothing else in Kramflow
          asks for it. */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete "${deleteTarget?.name}"?`}
        description="Every session, item, share link, and live state for this event — permanently destroyed. This can't be undone."
        confirmLabel="Delete Event"
        tone="danger-solid"
        loading={deleting}
        requireTypedConfirmation={deleteTarget ? { value: deleteTarget.name, label: `Type "${deleteTarget.name}" to confirm` } : undefined}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function DashboardLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-panel bg-card border border-line-soft p-5 hover:bg-card-hover hover:border-white/10 transition-colors flex flex-col gap-2"
    >
      <Icon className="h-5 w-5 text-accent" strokeWidth={2} />
      <span className="text-console-sm font-medium text-primary">{title}</span>
      <span className="text-console-meta text-muted-2">{desc}</span>
    </Link>
  );
}

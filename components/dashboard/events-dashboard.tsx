"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Smartphone, FileSpreadsheet, MonitorPlay, Plus, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { OperationalStatus } from "@/components/ui/operational-status";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ShareLinkPanel } from "./share-link-panel";
import { GettingStartedChecklist } from "./getting-started-checklist";
import { cn } from "@/lib/utils";

export type EventRole = "owner" | "editor" | "viewer";

export interface EventSummary {
  id: string;
  name: string;
  created_at: string;
  event_date?: string | null;
  venue?: string | null;
  timezone?: string | null;
  /** Which relationship this operator has to the event — owned, or an
   *  accepted collaboration. Gates owner-only actions (Delete, Share
   *  Links) client-side as a courtesy; every one of those routes already
   *  enforces the same boundary server-side regardless (requireEventAccess
   *  in each API route). */
  role?: EventRole;
  /** Readiness, not analytics — real counts of what already exists, no
   *  invented metrics. Undefined (not 0) when the caller didn't compute
   *  them, so a freshly-created event in local state doesn't briefly
   *  render "0 sessions" before it's ever been fetched with real data. */
  sessionCount?: number;
  itemCount?: number;
  isLive?: boolean;
}

// Every event this operator can actually open — owned, plus accepted
// collaborations (GET /api/events, and this page's own server component,
// both merge the two). role on each row is what the client uses to decide
// which actions to offer; RLS and every mutating route's own
// requireEventAccess() call are the real boundary regardless of what this
// list shows.
export function EventsDashboard({ initialEvents }: { initialEvents: EventSummary[] }) {
  const toast = useToast();
  const router = useRouter();
  const [events, setEvents] = useState<EventSummary[]>(initialEvents);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EventSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleCreate() {
    // Re-entrancy guard: the Input's onKeyDown below calls this directly
    // (not gated by `creating` the way the Button's `disabled` prop is), so
    // a fast double Enter — or Enter immediately followed by a click before
    // React re-renders the disabled button — could otherwise fire two
    // concurrent creates from one submission.
    if (creating) return;

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
      setEvents((prev) => [{ ...data.event!, role: "owner", sessionCount: 0, itemCount: 0, isLive: false }, ...prev]);
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

  // Live events surface first — the one thing on this whole page that
  // genuinely needs attention right now outranks recency (Von Restorff:
  // an exceptional state should be first to catch the eye, not buried at
  // whatever position creation order happened to leave it). A stable sort
  // (no comparator ties reordering same-liveness events against each
  // other) preserves the server's own recency ordering within each group.
  const sortedEvents = [...events].sort((a, b) => Number(b.isLive) - Number(a.isLive));

  return (
    <div className="flex flex-col gap-6">
      <GettingStartedChecklist events={events} />

      {events.length === 0 ? (
        <>
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
          <EmptyState
            title="No events yet"
            body="Create your first event to start building a cue sheet and running a show."
          />
        </>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
          {/* auto-fit, not fixed breakpoint column counts — a fixed column
              count stretches to fill every track regardless of how many
              events actually exist, so 1-2 events left ~75% of a wide
              desktop viewport as dead space (2026-09 convergence sprint,
              Workstream 7: measured directly). auto-fit collapses tracks
              with no content to 0 width and grows the real cards to fill
              what's freed (up to minmax's cap) instead of leaving them
              narrow in a sea of empty gutter — one rule that self-adjusts
              for any event count, not per-breakpoint tuning. */}
          {/* The "create" affordance is a peer of the events it creates, not
              a separate toolbar above them (uniform connectedness) — same
              first-grid-tile convention as Linear's/Notion's "new" tiles,
              a familiar pattern rather than an invented one (Jakob's Law).
              The input stays visible rather than hidden behind its own
              "+" click — one fewer gate in front of the single most
              common first action on this page. */}
          <div className="rounded-panel border border-dashed border-line p-5 flex flex-col gap-3 justify-center">
            <p className="text-console-meta text-muted-2 uppercase tracking-wide">New event</p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Satsang Shibir 2027"
              aria-label="New event name"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <Button variant="primary" size="sm" onClick={handleCreate} loading={creating}>
              <Plus className="h-4 w-4" strokeWidth={2} />
              Create Event
            </Button>
          </div>

          {sortedEvents.map((event) => (
            <EventCard key={event.id} event={event} onRequestDelete={() => setDeleteTarget(event)} />
          ))}
        </div>
      )}

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

// Everything meaningful about an event visible in one glance — identity,
// readiness counts, and the primary action (Open Console, sized and
// weighted above its siblings: Pareto — running the live show is the
// overwhelmingly common reason to open an event, so it gets the biggest
// target, not equal billing with Cue Sheet/Remote/Displays). Previously
// this whole card lived behind a click-to-expand row, which meant scanning
// N events for "which one needs me" cost N clicks before any of this was
// visible — Hick's Law says that gate should only exist if the content
// behind it is genuinely secondary, and none of this is.
function EventCard({ event, onRequestDelete }: { event: EventSummary; onRequestDelete: () => void }) {
  const isOwner = (event.role ?? "owner") === "owner";

  return (
    <Panel
      className={cn(
        "p-5 flex flex-col gap-4",
        // A live event's card gets a visible accent, not just an inline
        // badge easy to miss while scanning a grid of otherwise-identical
        // cards (Von Restorff) — routine events stay visually calm so this
        // keeps its power.
        event.isLive && "border-status-green/40 bg-status-green/[0.03]"
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-console-md font-semibold text-primary truncate">{event.name}</h2>
          {event.isLive && <OperationalStatus kind="live" />}
          {!isOwner && (
            <Badge tone="muted" className="capitalize">
              {event.role}
            </Badge>
          )}
        </div>
        <p className="text-console-meta text-muted-2 mt-1 truncate">
          {event.event_date
            ? // Parsed as a plain calendar date (not a UTC instant) so the
              // displayed date can't shift a day depending on the viewer's
              // own timezone offset from midnight UTC.
              new Date(`${event.event_date}T00:00:00`).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : `Created ${new Date(event.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
          {event.venue ? ` · ${event.venue}` : ""}
          {event.sessionCount !== undefined &&
            ` · ${event.sessionCount} session${event.sessionCount === 1 ? "" : "s"} · ${event.itemCount ?? 0} item${event.itemCount === 1 ? "" : "s"}`}
        </p>
      </div>

      <LinkButton href={`/e/${event.id}/operator`} variant="primary" size="sm">
        <LayoutDashboard className="h-3.5 w-3.5" strokeWidth={2} />
        Open Console
      </LinkButton>

      <div className="flex items-center gap-1.5">
        <Tooltip content="Cue Sheet">
          <LinkButton href={`/e/${event.id}/operator/cue-sheet`} variant="secondary" size="sm" square aria-label="Cue Sheet">
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={2} />
          </LinkButton>
        </Tooltip>
        <Tooltip content="Remote — one-handed mobile control">
          <LinkButton href={`/e/${event.id}/remote`} variant="secondary" size="sm" square aria-label="Remote">
            <Smartphone className="h-3.5 w-3.5" strokeWidth={2} />
          </LinkButton>
        </Tooltip>
        <Tooltip content="Displays">
          <LinkButton href={`/e/${event.id}/displays`} variant="secondary" size="sm" square aria-label="Displays">
            <MonitorPlay className="h-3.5 w-3.5" strokeWidth={2} />
          </LinkButton>
        </Tooltip>
      </div>

      {/* Share links and Delete are owner-only server-side
          (requireEventAccess(eventId, "owner") in both routes) — hidden
          here too so a collaborator never sees an action that would just
          403, not because the client is what's actually stopping them. */}
      {isOwner && (
        <div className="flex items-center gap-2 pt-1 border-t border-line-soft -mx-5 px-5 mt-1">
          <div className="flex-1 pt-3">
            <ShareLinkPanel eventId={event.id} compact />
          </div>
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label={`Delete ${event.name}`}
            className="shrink-0 mt-3 text-muted-2 hover:text-status-red transition-colors cursor-pointer p-1.5 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      )}
    </Panel>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { useEventId } from "@/lib/event-context";
import { EventNav } from "@/components/operator/event-nav";
import { EventIdentity } from "@/components/operator/event-identity";
import { EventSettingsPanel } from "@/components/forms/event-settings-panel";
import { Button } from "@/components/ui/button";

// Promoted out of the gear icon that used to live inside Cue Sheet's own
// header — collaborators/auditoriums/event details are properties of the
// event, not of the queue-editing screen, and checking who has access
// shouldn't require detouring through Cue Sheet first. Reachable as its
// own top-level destination regardless of which content screen is
// showing, the way StageTimer's Room menu works from the Controller no
// matter what's on screen. See kramflow_nav_layout_ground_up.md.
//
// This is a route, not a modal — EventSettingsPanel used to be shaped like
// one (a single boxed panel with a sticky "Close" footer, inherited from
// when it really was a modal body). EventNav + the event switcher in
// EventIdentity are already a complete way back to the rest of the event;
// a second, redundant "Close" button was removed along with the modal
// anatomy rather than kept as a safety net for a navigation path that
// already exists.
export default function EventSettingsPage() {
  const eventId = useEventId();
  const router = useRouter();
  const { lock } = useAuth();
  const [eventName, setEventName] = useState("");
  const [auditoriums, setAuditoriums] = useState<{ id: string; name: string }[]>([]);

  function loadAuditoriums() {
    fetch(`/api/auditoriums?eventId=${encodeURIComponent(eventId)}`)
      .then((res) => res.json())
      .then((data) => setAuditoriums(data.auditoriums ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    loadAuditoriums();
    fetch(`/api/events/${eventId}`)
      .then((res) => res.json())
      .then((data) => setEventName(data?.event?.name ?? ""))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadAuditoriums is stable across the eventId this effect keys on
  }, [eventId]);

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 px-4 sm:px-6 xl:px-12 py-4 xl:py-6 border-b border-white/5 flex-wrap">
        <div className="min-w-0">
          <EventIdentity />
          <h1 className="text-console-lg text-primary mt-1.5">Settings</h1>
        </div>
        <div className="flex items-center gap-3">
          <EventNav />
          <Button variant="ghost" size="sm" onClick={lock}>
            Lock
          </Button>
        </div>
      </header>

      <div className="px-4 sm:px-6 xl:px-12 py-8 max-w-3xl mx-auto">
        <EventSettingsPanel
          eventId={eventId}
          initialName={eventName}
          auditoriums={auditoriums}
          onAuditoriumsChanged={loadAuditoriums}
          onEventDeleted={() => router.push("/dashboard")}
        />
      </div>
    </main>
  );
}

// Provisions 2 demo operator accounts, each owning a full event seeded from
// the real bundled cue sheet (data/cue-sheet.xlsx, parsed with the app's
// own lib/parse-cuesheet.ts — the same ~244-item, 6-session real rundown
// the rest of the codebase's own comments reference), plus enough
// supporting data (a cross-account collaborator, share links, display
// registry rows, broadcasts, an activity log, and two different live-show
// states) to exercise every major feature from two logins.
//
// Run with: npx tsx scripts/seed-demo.ts
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// .env.local. Safe to re-run — idempotent throughout (reuses existing
// demo users/events by email/name rather than duplicating them).

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

import { parseCueSheet, type ParsedPartition, type ParsedProgram, type ParsedSession } from "../lib/parse-cuesheet";
import { supabaseAdmin } from "../lib/supabase/server";

const supabase = supabaseAdmin();

interface DemoAccountSpec {
  key: "demo1" | "demo2";
  email: string;
  password: string;
  name: string;
  eventName: string;
  venue: string;
  timezone: string;
}

const DEMO_ACCOUNTS: DemoAccountSpec[] = [
  {
    key: "demo1",
    email: "demo1@kramflow.test",
    password: "KramflowDemo1!",
    name: "Demo Operator One",
    eventName: "Demo — Satsang Shibir 2026 (Weekend A)",
    venue: "Main Auditorium",
    timezone: "America/Los_Angeles",
  },
  {
    key: "demo2",
    email: "demo2@kramflow.test",
    password: "KramflowDemo2!",
    name: "Demo Operator Two",
    eventName: "Demo — Satsang Shibir 2026 (Weekend B)",
    venue: "East Wing Hall",
    timezone: "America/New_York",
  },
];

function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

async function ensureUser(email: string, password: string, name: string): Promise<string> {
  // list+find rather than trying create-then-catch — admin.createUser's
  // error shape for "already exists" isn't guaranteed stable across
  // supabase-js versions, listing is.
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    // Reset the password every run so the credentials printed at the end
    // are always the ones that actually work, even if this script (or the
    // account) was touched between runs.
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  return data.user.id;
}

async function ensureEvent(ownerId: string, name: string, venue: string, timezone: string): Promise<string> {
  const { data: existing } = await supabase.from("events").select("id").eq("owner_id", ownerId).eq("name", name).maybeSingle();
  if (existing) return existing.id;

  const { data: event, error } = await supabase
    .from("events")
    .insert({ owner_id: ownerId, name, venue, timezone, event_date: new Date().toISOString().slice(0, 10) })
    .select("id")
    .single();
  if (error) throw error;

  const { error: liveStateError } = await supabase.from("live_state").insert({ event_id: event.id });
  if (liveStateError) throw liveStateError;
  const { error: displayStateError } = await supabase.from("display_state").insert({ event_id: event.id });
  if (displayStateError) throw displayStateError;
  return event.id;
}

// Demo accounts share one source cue sheet, but sessions.id is a globally
// unique primary key (not scoped to event_id alone) — seeding the same
// file into two events would collide on insert. Prefixing every parsed
// session id (and remapping every partition/program reference to match)
// keeps each event's rows independent while still using the same real,
// large rundown for both.
function remapForEvent(
  parsed: { sessions: ParsedSession[]; partitions: ParsedPartition[]; programs: ParsedProgram[] },
  prefix: string
) {
  const idMap = new Map(parsed.sessions.map((s) => [s.id, `${prefix}_${s.id}`]));
  const sessions = parsed.sessions.map((s) => ({ ...s, id: idMap.get(s.id)! }));
  const partitions = parsed.partitions.map((p) => ({ ...p, session_id: idMap.get(p.session_id)! }));
  const programs = parsed.programs.map((p) => ({ ...p, session_id: idMap.get(p.session_id)! }));
  return { sessions, partitions, programs };
}

async function seedCueSheet(eventId: string, prefix: string) {
  const filePath = path.join(process.cwd(), "data", "cue-sheet.xlsx");
  const buffer = readFileSync(filePath);
  const parsed = parseCueSheet(buffer);
  const { sessions, partitions, programs } = remapForEvent(parsed, prefix);

  const sessionsWithEvent = sessions.map((s) => ({ ...s, event_id: eventId }));
  const { error: sessionsError } = await supabase.from("sessions").upsert(sessionsWithEvent, { onConflict: "event_id,id" });
  if (sessionsError) throw sessionsError;

  const sessionIds = [...new Set(programs.map((p) => p.session_id))];
  const { error: replaceError } = await supabase.rpc("replace_session_programs", {
    p_event_id: eventId,
    p_session_ids: sessionIds,
    p_partitions: partitions,
    p_programs: programs,
  });
  if (replaceError) throw replaceError;

  return { sessions, programs };
}

async function main() {
  const results: { spec: DemoAccountSpec; userId: string; eventId: string; sessions: ParsedSession[]; programs: ParsedProgram[] }[] = [];

  for (const spec of DEMO_ACCOUNTS) {
    console.log(`\n[seed-demo] Provisioning ${spec.key} (${spec.email})...`);
    const userId = await ensureUser(spec.email, spec.password, spec.name);
    // Bumped past the free tier's 3-event cap so exploring "Create Event"
    // during a demo doesn't hit a wall.
    const { error: profileError } = await supabase.from("profiles").upsert({ id: userId, tier: "pro" });
    if (profileError) throw profileError;
    const eventId = await ensureEvent(userId, spec.eventName, spec.venue, spec.timezone);
    const { sessions, programs } = await seedCueSheet(eventId, spec.key);
    console.log(`[seed-demo] ${spec.key}: event=${eventId}, ${sessions.length} sessions, ${programs.length} programs`);
    results.push({ spec, userId, eventId, sessions, programs });
  }

  const [demo1, demo2] = results;

  // Cross-account collaborator: demo2 gets editor access to demo1's event,
  // so logging in as either account can exercise both the owner experience
  // and the collaborator experience without a third identity.
  // invited_email set explicitly — the real "Add by email" UI flow always
  // sets it, and Settings' collaborator list renders it as the row label;
  // a raw insert that leaves it null renders as a blank row (confirmed
  // for real: a first pass without this showed an unlabeled "EDITOR" pill).
  const { error: collaboratorError } = await supabase
    .from("event_collaborators")
    .upsert(
      { event_id: demo1.eventId, user_id: demo2.userId, role: "editor", invited_email: demo2.spec.email },
      { onConflict: "event_id,user_id" }
    );
  if (collaboratorError) throw collaboratorError;
  console.log(`\n[seed-demo] ${demo2.spec.key} added as editor on ${demo1.spec.key}'s event`);

  // Two different live-show states, so switching between the two demo
  // events shows two different Operator Console / TV display pictures
  // rather than the same "not started" screen twice.
  const demo1FirstSession = demo1.sessions[0];
  const demo1SessionPrograms = demo1.programs.filter((p) => p.session_id === demo1FirstSession.id);
  const demo1LiveOrder = Math.min(6, demo1SessionPrograms.length); // a few items in, mid-show

  await supabase
    .from("live_state")
    .update({
      active_session_id: demo1FirstSession.id,
      progress_by_session: { [demo1FirstSession.id]: { currentOrder: demo1LiveOrder, startedAt: new Date(Date.now() - 3 * 60_000).toISOString() } },
      alert: { message: "Green Room running 5 min behind — heads up", severity: "warning" },
    })
    .eq("event_id", demo1.eventId);

  const demo2FirstSession = demo2.sessions[0];
  const demo2SessionPrograms = demo2.programs.filter((p) => p.session_id === demo2FirstSession.id);
  const demo2LiveOrder = Math.min(3, demo2SessionPrograms.length);
  // ParsedProgram (pre-insert) has no id — the DB generates it — so fetch
  // the real inserted row to get the id effectiveNotes()/notesOverrides
  // actually key on.
  const { data: demo2LiveProgramRow } = await supabase
    .from("programs")
    .select("id")
    .eq("event_id", demo2.eventId)
    .eq("session_id", demo2FirstSession.id)
    .eq("sort_order", demo2LiveOrder)
    .maybeSingle();

  await supabase
    .from("live_state")
    .update({
      active_session_id: demo2FirstSession.id,
      progress_by_session: { [demo2FirstSession.id]: { currentOrder: demo2LiveOrder, startedAt: new Date(Date.now() - 90_000).toISOString() } },
      paused_at: new Date().toISOString(), // On Hold, to demo the Hold Screen / countdown-freeze feature
      notes_overrides: demo2LiveProgramRow ? { [demo2LiveProgramRow.id]: "Presenter requested 2 extra minutes — approved." } : {},
    })
    .eq("event_id", demo2.eventId);

  await supabase
    .from("display_state")
    .update({ hold: { active: true, message: "Back Shortly", subMessage: "We'll resume in a few minutes.", activatedAt: new Date().toISOString(), continueClock: false } })
    .eq("event_id", demo2.eventId);

  console.log("[seed-demo] live_state seeded: demo1 mid-show + alert, demo2 on Hold + a note override");

  // Share links — one per event, for the no-login TV display flow. No
  // natural unique key besides the generated token itself, so idempotency
  // is by label: skip creating a second one for a re-run instead of
  // accumulating duplicates.
  for (const { spec, eventId, userId } of results) {
    const label = `${spec.name}'s General Display`;
    const { data: existingLink } = await supabase
      .from("share_links")
      .select("token")
      .eq("event_id", eventId)
      .eq("label", label)
      .is("revoked_at", null)
      .maybeSingle();
    if (existingLink) {
      console.log(`[seed-demo] ${spec.key} share link (existing): /general?token=${existingLink.token}`);
      continue;
    }
    const token = generateShareToken();
    const { error: shareLinkError } = await supabase.from("share_links").insert({
      token,
      event_id: eventId,
      label,
      created_by: userId,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (shareLinkError) throw shareLinkError;
    console.log(`[seed-demo] ${spec.key} share link: /general?token=${token}`);
  }

  // Display registry — a few "previously connected" displays per event so
  // Display Manager has real rows to rename/reassign/remove against, even
  // though nothing is actually heartbeating them right now.
  const staleSeenAt = new Date(Date.now() - 5 * 60_000).toISOString();
  for (const { eventId } of results) {
    const displays = [
      { id: `${eventId}-general`, name: "Lobby General", type: "general" },
      { id: `${eventId}-av`, name: "AV Waiting Room", type: "av" },
      { id: `${eventId}-greenroom`, name: "Green Room TV", type: "green-room" },
      { id: `${eventId}-presenter`, name: "Presenter Monitor", type: "presenter" },
    ];
    const { error: registryError } = await supabase.from("display_registry").upsert(
      displays.map((d) => ({ ...d, event_id: eventId, last_seen_at: staleSeenAt, latency_ms: 28 })),
      { onConflict: "event_id,id" }
    );
    if (registryError) throw registryError;
  }
  console.log("[seed-demo] display_registry seeded (4 displays per event, shown offline until a real one connects)");

  // Broadcasts — one of each status so Broadcast Center's active/scheduled/
  // history tabs all have content immediately. Guarded on title so a
  // re-run doesn't accumulate duplicates (no natural unique key otherwise).
  for (const { eventId } of results) {
    const { data: existingBroadcast } = await supabase
      .from("display_broadcasts")
      .select("id")
      .eq("event_id", eventId)
      .eq("title", "Welcome")
      .maybeSingle();
    if (existingBroadcast) {
      console.log(`[seed-demo] display_broadcasts already seeded for ${eventId}, skipping`);
      continue;
    }
    // All three objects deliberately share the exact same key set — a
    // supabase-js/PostgREST batch insert unions keys across the array and
    // pads any row missing a key with NULL rather than falling back to
    // that column's DEFAULT, so a heterogeneous batch here would fail on
    // whichever NOT NULL column any single row omitted (confirmed for
    // real: this originally omitted created_at on 2 of 3 rows and failed
    // with "null value in column created_at" on the row that never even
    // referenced it).
    const { error: broadcastsError } = await supabase.from("display_broadcasts").insert([
      {
        event_id: eventId,
        type: "info",
        title: "Welcome",
        message: "Thanks for joining — please silence phones during the program.",
        priority: 2,
        target: { kind: "all" },
        status: "sent",
        acknowledgement_required: false,
        persistent: true,
        scheduled_for: null,
        dismissed_at: null,
        created_at: new Date().toISOString(),
      },
      {
        event_id: eventId,
        type: "warning",
        title: "Lunch Break Reminder",
        message: "Lunch service ends in 10 minutes.",
        priority: 2,
        target: { kind: "all" },
        status: "scheduled",
        acknowledgement_required: false,
        persistent: false,
        scheduled_for: new Date(Date.now() + 60 * 60_000).toISOString(),
        dismissed_at: null,
        created_at: new Date().toISOString(),
      },
      {
        event_id: eventId,
        type: "success",
        title: "Session Started",
        message: "Morning session is now live.",
        priority: 1,
        target: { kind: "all" },
        status: "sent",
        acknowledgement_required: false,
        persistent: false,
        scheduled_for: null,
        dismissed_at: new Date(Date.now() - 20 * 60_000).toISOString(),
        created_at: new Date(Date.now() - 25 * 60_000).toISOString(),
      },
    ]);
    if (broadcastsError) throw broadcastsError;
  }
  console.log("[seed-demo] display_broadcasts seeded (1 active, 1 scheduled, 1 dismissed/history per event)");

  // Activity log — a short realistic trail per event. Guarded the same way.
  for (const { eventId, spec } of results) {
    const { data: existingActivity } = await supabase
      .from("activity_log")
      .select("id")
      .eq("event_id", eventId)
      .eq("action", "eventCreated")
      .maybeSingle();
    if (existingActivity) {
      console.log(`[seed-demo] activity_log already seeded for ${eventId}, skipping`);
      continue;
    }
    const { error: activityError } = await supabase.from("activity_log").insert([
      { event_id: eventId, action: "eventCreated", detail: `${spec.name} created this event` },
      { event_id: eventId, action: "cueSheetUpload", detail: "Uploaded 00_SS26_Cue Sheet_v4.xlsx via seed script" },
      { event_id: eventId, action: "sessionStarted", detail: "Started the first session" },
    ]);
    if (activityError) throw activityError;
  }
  console.log("[seed-demo] activity_log seeded");

  console.log("\n" + "=".repeat(72));
  console.log("DEMO ACCOUNTS READY");
  console.log("=".repeat(72));
  for (const { spec, eventId } of results) {
    console.log(`\n${spec.name}`);
    console.log(`  Login:    ${spec.email} / ${spec.password}`);
    console.log(`  Event:    ${spec.eventName}`);
    console.log(`  Event ID: ${eventId}`);
  }
  console.log(`\n${demo2.spec.name} also has EDITOR access to ${demo1.spec.name}'s event (cross-account collaborator).`);
  console.log("\nWhat each login can exercise:");
  console.log("  - Dashboard: event list, create/delete event (tier bumped to 'pro', no 3-event cap)");
  console.log(`  - Operator Console + Cue Sheet: real ~244-item rundown across 6 sessions per event`);
  console.log("  - demo1's event: mid-show live state + an active alert banner");
  console.log("  - demo2's event: On Hold state + a note override on the live item");
  console.log("  - Collaborators: demo2 is an editor on demo1's event (Settings -> Collaborators)");
  console.log("  - Share Links: printed above, open /general?token=... with no login");
  console.log("  - Displays: 4 registry rows per event (Display Manager) — showing offline until a real display heartbeats");
  console.log("  - Broadcast Center: 1 active, 1 scheduled, 1 history broadcast per event");
  console.log("  - Remote: /e/<eventId>/remote once signed in");
  console.log("=".repeat(72));
}

main().catch((err) => {
  console.error("[seed-demo] failed:", err);
  process.exit(1);
});

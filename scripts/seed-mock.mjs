// One-time, re-runnable end-to-end mock data seed for the multi-tenant
// schema (supabase/migration_multitenant.sql). Not scripts/seed.ts's
// Excel-import path — this writes directly against events/sessions/
// programs/etc. so every table and edge case (multiple events, roles,
// program field combinations, broadcasts, share links, display registry)
// gets real rows to click through in the running app.
//
// Run with: node --env-file=.env.local scripts/seed-mock.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { randomUUID } from "node:crypto";

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function db(table, { method = "GET", query = "", body, prefer = "return=representation" } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}${query}`, {
    method,
    headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${table}${query} -> ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function auth(path, body) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin${path}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok && data.msg !== "User already registered" && !`${data.error_code ?? ""}`.includes("exists")) {
    throw new Error(`admin${path} -> ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function listUsers() {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const data = await res.json();
  return data.users ?? [];
}

async function ensureUser(email, password, name) {
  const existing = (await listUsers()).find((u) => u.email?.toLowerCase() === email);
  if (existing) return existing;
  const created = await auth("/users", { email, password, email_confirm: true, user_metadata: { name } });
  return created;
}

// ---------------------------------------------------------------------------
// Users: the existing demo owner, plus a second account to exercise
// collaborator roles (editor/viewer) and cross-tenant isolation (an event
// the demo user must never see).
// ---------------------------------------------------------------------------
const owner = await ensureUser("demo@kramflow.test", "DemoPass123!", "Demo Operator");
const collaborator = await ensureUser("collaborator@kramflow.test", "CollabPass123!", "Collaborator Operator");
console.log(`[seed] owner=${owner.id} collaborator=${collaborator.id}`);

// ---------------------------------------------------------------------------
// Helper: fully provision an event the way POST /api/events does (event row
// + live_state + display_state), since this script writes directly to the
// DB rather than going through that route.
// ---------------------------------------------------------------------------
async function createEvent({ ownerId, name, event_date, venue, timezone }) {
  const [event] = await db("events", {
    method: "POST",
    body: { owner_id: ownerId, name, event_date, venue, timezone },
  });
  await db("live_state", { method: "POST", body: { event_id: event.id }, prefer: "return=minimal" });
  await db("display_state", { method: "POST", body: { event_id: event.id }, prefer: "return=minimal" });
  return event;
}

// Clear any prior run's data for these two owners so this script is safe to
// re-run without accumulating duplicate events.
for (const uid of [owner.id, collaborator.id]) {
  const existing = await db("events", { query: `?owner_id=eq.${uid}&select=id` });
  for (const e of existing) {
    await db("events", { method: "DELETE", query: `?id=eq.${e.id}`, prefer: "return=minimal" });
  }
}

const eventA = await createEvent({
  ownerId: owner.id,
  name: "Founders Summit 2026",
  event_date: "2026-09-12",
  venue: "Grand Convention Center, Hall A",
  timezone: "America/Los_Angeles",
});
const eventB = await createEvent({
  ownerId: owner.id,
  name: "Product Launch — Draft",
  event_date: null,
  venue: null,
  timezone: null,
});
const eventC = await createEvent({
  ownerId: owner.id,
  name: "Empty Test Event",
  event_date: null,
  venue: null,
  timezone: null,
});
const eventD = await createEvent({
  ownerId: collaborator.id,
  name: "Collaborator's Own Event (isolation check)",
  event_date: "2026-11-01",
  venue: "Riverside Hall",
  timezone: "UTC",
});
console.log(`[seed] events: A=${eventA.id} B=${eventB.id} C=${eventC.id} D=${eventD.id}`);

// Collaborator gets editor on A, viewer on B — exercises both non-owner
// roles; has no row at all on C (should 404, not 403) or D (owns it).
await db("event_collaborators", {
  method: "POST",
  body: [
    { event_id: eventA.id, user_id: collaborator.id, role: "editor", invited_email: "collaborator@kramflow.test" },
    { event_id: eventB.id, user_id: collaborator.id, role: "viewer", invited_email: "collaborator@kramflow.test" },
  ],
  prefer: "return=minimal",
});

// ---------------------------------------------------------------------------
// Event A — the rich one. Two auditoriums, two sessions, partitions in both
// time modes (anchored/cascading and literal), and programs sweeping every
// status/color_tag/video/audio/curtains combination plus several textual
// edge cases (very long name, empty-ish optional fields, quotes/unicode).
// ---------------------------------------------------------------------------
const [mainHall, breakoutB] = await db("auditoriums", {
  method: "POST",
  body: [
    { event_id: eventA.id, name: "Main Hall" },
    { event_id: eventA.id, name: "Breakout Room B" },
  ],
});

const sessionMorning = "day1-morning";
const sessionAfternoon = "day1-afternoon";
await db("sessions", {
  method: "POST",
  body: [
    {
      id: sessionMorning,
      event_id: eventA.id,
      sheet_name: "Day 1",
      event_name: "Founders Summit 2026",
      day_label: "Day 1 — Sept 12",
      session_label: "Morning Keynotes",
      sort_order: 1,
    },
    {
      id: sessionAfternoon,
      event_id: eventA.id,
      sheet_name: "Day 1",
      event_name: "Founders Summit 2026",
      day_label: "Day 1 — Sept 12",
      session_label: "Afternoon Breakouts",
      sort_order: 2,
    },
  ],
  prefer: "return=minimal",
});

const partOpening = randomUUID();
const partKeynotes = randomUUID();
const partBreakouts = randomUUID();
await db("partitions", {
  method: "POST",
  body: [
    { id: partOpening, event_id: eventA.id, session_id: sessionMorning, label: "Opening", sort_order: 1, start_time: "9:00 AM" },
    { id: partKeynotes, event_id: eventA.id, session_id: sessionMorning, label: "Keynotes", sort_order: 2, start_time: null },
    { id: partBreakouts, event_id: eventA.id, session_id: sessionAfternoon, label: "Breakout Sessions", sort_order: 1, start_time: "1:00 PM" },
  ],
  prefer: "return=minimal",
});

function programBase(overrides) {
  return {
    event_id: eventA.id,
    session_id: sessionMorning,
    type: "item",
    description: null,
    presenter: null,
    presenter_requirement: null,
    presenter_contact: null,
    start_time: null,
    end_time: null,
    audio_mics: false,
    audio_track: false,
    video_sidescreen: "none",
    backdrop: false,
    video_ppt_needed: false,
    hall_lights: null,
    stage_lights: null,
    camera_angle: null,
    props: null,
    curtains: null,
    remarks: null,
    status: "confirmed",
    color_tag: null,
    partition_id: null,
    time_is_computed: false,
    auditorium_id: null,
    ...overrides,
  };
}

const morningPrograms = [
  // Opening partition — time-cascaded (time_is_computed: true), anchored at
  // the partition's 9:00 AM start_time.
  programBase({
    sort_order: 1,
    partition_id: partOpening,
    name: "Doors Open / Registration",
    type: "break",
    duration: 30,
    time_is_computed: true,
    status: "confirmed",
    remarks: "Coffee + badge pickup in the lobby.",
    auditorium_id: mainHall.id,
  }),
  programBase({
    sort_order: 2,
    partition_id: partOpening,
    name: "Welcome & Opening Remarks",
    duration: 10,
    time_is_computed: true,
    presenter: "Jordan Lee",
    presenter_requirement: "Lapel mic, confidence monitor",
    presenter_contact: "+1 (555) 010-2231",
    audio_mics: true,
    video_sidescreen: "slides",
    backdrop: true,
    stage_lights: "Warm wash",
    curtains: "open",
    status: "confirmed",
    color_tag: "ready",
    auditorium_id: mainHall.id,
  }),
  // A very long name/remarks pair, quotes + unicode — text-rendering edge case.
  programBase({
    sort_order: 3,
    partition_id: partOpening,
    name: 'The Future of "Ambient Computing": Ten Years of Lessons from Building at the Edge of What\'s Possible — a Founders Summit Retrospective',
    description: "Fireside-style talk with audience Q&A in the last 5 minutes — see remarks.",
    duration: 25,
    time_is_computed: true,
    presenter: "Dr. Amara Okonkwo-García",
    presenter_requirement: "Handheld mic for Q&A runner",
    audio_mics: true,
    audio_track: true,
    video_sidescreen: "live_feed",
    camera_angle: "Wide, center stage",
    curtains: "open",
    remarks: "Speaker uses 中文 slides for the last 2 minutes — AV has the deck. Contains em dash — and “curly quotes.”",
    status: "confirmed",
    color_tag: "vip",
    auditorium_id: mainHall.id,
  }),
  // Keynotes partition — literal (non-computed) times, one item mid-way
  // through with status variety and a null-everything minimal row.
  programBase({
    sort_order: 4,
    partition_id: partKeynotes,
    name: "Keynote: Scaling Trust",
    duration: 20,
    start_time: "10:15 AM",
    end_time: "10:35 AM",
    time_is_computed: false,
    presenter: "Priya Nathan",
    audio_mics: true,
    video_sidescreen: "slides",
    video_ppt_needed: true,
    stage_lights: "Blue accent",
    curtains: "open",
    status: "confirmed",
    color_tag: "ready",
    auditorium_id: mainHall.id,
  }),
  programBase({
    sort_order: 5,
    partition_id: partKeynotes,
    name: "Panel: What We'd Build Differently",
    duration: 30,
    start_time: "10:35 AM",
    end_time: "11:05 AM",
    presenter: "Panel — see green room roster",
    presenter_requirement: "4x lapel mics, 4 stools",
    audio_mics: true,
    video_sidescreen: "live_feed",
    camera_angle: "Wide, 4-seat panel",
    status: "tbd",
    color_tag: "needs_confirmation",
    remarks: "Waiting on 4th panelist travel confirmation — see activity log.",
    auditorium_id: mainHall.id,
  }),
  programBase({
    sort_order: 6,
    partition_id: partKeynotes,
    name: "Sponsor Video — DraftCo",
    type: "item",
    duration: 3,
    start_time: "11:05 AM",
    end_time: "11:08 AM",
    video_sidescreen: "slides",
    status: "draft",
    color_tag: null,
    remarks: "Final cut not delivered yet — placeholder slide until then.",
    auditorium_id: mainHall.id,
  }),
  programBase({
    sort_order: 7,
    partition_id: partKeynotes,
    name: "Cut: Investor Spotlight (pulled from program)",
    duration: 15,
    status: "cut",
    color_tag: "urgent",
    remarks: "Pulled after sponsor withdrew — kept in cue sheet for the printed run-of-show record.",
    auditorium_id: mainHall.id,
  }),
  // Unpartitioned item — exercises partition_id: null in the UI grouping.
  programBase({
    sort_order: 8,
    partition_id: null,
    name: "Morning Session Wrap",
    type: "break",
    duration: 5,
    status: "confirmed",
    curtains: "closed",
    auditorium_id: mainHall.id,
  }),
];

const afternoonPrograms = [
  programBase({
    sort_order: 1,
    session_id: sessionAfternoon,
    partition_id: partBreakouts,
    name: "Breakout A: Hardware Deep Dive",
    duration: 45,
    time_is_computed: true,
    presenter: "Marcus Webb",
    audio_mics: true,
    video_sidescreen: "slides",
    status: "confirmed",
    color_tag: "ready",
    auditorium_id: breakoutB.id,
  }),
  programBase({
    sort_order: 2,
    session_id: sessionAfternoon,
    partition_id: partBreakouts,
    name: "Breakout B: Field Notes from Series A",
    duration: 45,
    time_is_computed: true,
    presenter: "Naomi Fischer",
    presenter_contact: "walkie ch. 3",
    audio_mics: true,
    status: "confirmed",
    color_tag: null,
    auditorium_id: breakoutB.id,
  }),
  // Minimal row — every optional field left null, to check the UI doesn't
  // choke on an item with essentially no metadata.
  programBase({
    sort_order: 3,
    session_id: sessionAfternoon,
    partition_id: partBreakouts,
    name: "TBD — slot held for late addition",
    duration: 20,
    status: "tbd",
    auditorium_id: null,
  }),
];

const insertedMorning = await db("programs", { method: "POST", body: morningPrograms });
await db("programs", { method: "POST", body: afternoonPrograms, prefer: "return=minimal" });

// speaker_ready keys off program id — grab two real ids from what we just
// inserted (the welcome remarks and the panel) for display_state below.
const welcomeProgram = insertedMorning.find((p) => p.name === "Welcome & Opening Remarks");
const panelProgram = insertedMorning.find((p) => p.name.startsWith("Panel:"));

// ---------------------------------------------------------------------------
// live_state for A — show in progress: partway through the morning
// session, a warning alert live, and one operator-edited notes override.
// ---------------------------------------------------------------------------
await db("live_state", {
  method: "PATCH",
  query: `?event_id=eq.${eventA.id}`,
  prefer: "return=minimal",
  body: {
    active_session_id: sessionMorning,
    progress_by_session: {
      [sessionMorning]: { currentOrder: 3, startedAt: new Date(Date.now() - 22 * 60_000).toISOString() },
    },
    alert: { message: "Running about 5 minutes behind schedule", severity: "warning" },
    notes_overrides: { [welcomeProgram.id]: "Confirmed on site — skip the walk-in music cue, go straight to mic." },
  },
});

// ---------------------------------------------------------------------------
// display_state for A — timer actively running (auto mode, tracking the
// live program), speaker-ready toggled for two presenters (one ready, one
// not), Hold left inactive so General/AV display the live program normally.
// ---------------------------------------------------------------------------
await db("display_state", {
  method: "PATCH",
  query: `?event_id=eq.${eventA.id}`,
  prefer: "return=minimal",
  body: {
    timer: {
      mode: "program",
      source: "auto",
      startedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
      durationSeconds: 25 * 60,
      pausedAt: null,
      adjustmentSeconds: 0,
      thresholds: { yellowAt: 300, orangeAt: 60, redAt: 0, criticalAfter: 60 },
    },
    speaker_ready: { [welcomeProgram.id]: true, [panelProgram.id]: false },
  },
});

// ---------------------------------------------------------------------------
// display_registry for A — one of each display type; Green Room hasn't
// heartbeated in 3 minutes (stale, shows offline in Display Manager), the
// rest are fresh. One custom-type display carries a pending remote command.
// ---------------------------------------------------------------------------
const now = Date.now();
function registryRow(overrides) {
  return {
    id: null,
    event_id: eventA.id,
    name: null,
    type: null,
    room: null,
    profile_id: null,
    latency_ms: null,
    registered_at: new Date(now - 3600_000).toISOString(),
    last_seen_at: null,
    pending_command: null,
    ...overrides,
  };
}
await db("display_registry", {
  method: "POST",
  prefer: "return=minimal",
  body: [
    registryRow({
      id: "general-lobby",
      name: "General Display — Lobby",
      type: "general",
      room: "Lobby",
      latency_ms: 42,
      last_seen_at: new Date(now - 5_000).toISOString(),
    }),
    registryRow({
      id: "av-booth",
      name: "AV Booth",
      type: "av",
      room: "Main Hall — Booth",
      latency_ms: 18,
      last_seen_at: new Date(now - 8_000).toISOString(),
    }),
    registryRow({
      id: "green-room-monitor",
      name: "Green Room Monitor",
      type: "green_room",
      room: "Green Room",
      latency_ms: 65,
      last_seen_at: new Date(now - 180_000).toISOString(),
    }),
    registryRow({
      id: "presenter-confidence",
      name: "Presenter Confidence Monitor",
      type: "presenter",
      room: "Main Hall — Stage",
      latency_ms: 27,
      last_seen_at: new Date(now - 3_000).toISOString(),
    }),
    registryRow({
      id: "lobby-tv-2",
      name: "Lobby TV 2 (custom profile)",
      type: "custom",
      room: "Lobby — East Wall",
      profile_id: "general",
      latency_ms: 51,
      last_seen_at: new Date(now - 12_000).toISOString(),
      pending_command: { type: "reload" },
    }),
  ],
});

// ---------------------------------------------------------------------------
// display_broadcasts for A — active + ack-required, scheduled-future,
// persistent, and already-sent/expired (history-only).
// ---------------------------------------------------------------------------
function broadcastRow(overrides) {
  return {
    event_id: eventA.id,
    type: null,
    title: null,
    message: null,
    icon: null,
    priority: 1,
    target: null,
    created_at: null,
    expires_at: null,
    duration_seconds: null,
    acknowledgement_required: false,
    persistent: false,
    acknowledged_by: [],
    scheduled_for: null,
    status: "sent",
    ...overrides,
  };
}
await db("display_broadcasts", {
  method: "POST",
  prefer: "return=minimal",
  body: [
    broadcastRow({
      type: "alert",
      title: "Panel needs a 4th mic",
      message: "AV — please bring a 4th lapel mic to the panel setup before 10:35.",
      priority: 3,
      target: { audience: "av" },
      created_at: new Date(now - 6 * 60_000).toISOString(),
      expires_at: new Date(now + 20 * 60_000).toISOString(),
      acknowledgement_required: true,
      status: "sent",
    }),
    broadcastRow({
      type: "info",
      title: "Lunch service begins",
      message: "Lunch service opens in the Grand Foyer.",
      priority: 1,
      target: { audience: "all" },
      created_at: new Date(now).toISOString(),
      scheduled_for: new Date(now + 90 * 60_000).toISOString(),
      duration_seconds: 60,
      status: "scheduled",
    }),
    broadcastRow({
      type: "warning",
      title: "Fire exit B temporarily blocked",
      message: "Please direct attendees to exit A or C until further notice.",
      priority: 3,
      target: { audience: "all" },
      created_at: new Date(now - 40 * 60_000).toISOString(),
      persistent: true,
      status: "sent",
    }),
    broadcastRow({
      type: "info",
      title: "Registration desk closing soon (expired)",
      message: "Registration closes at 9:00 AM.",
      priority: 1,
      target: { audience: "general" },
      created_at: new Date(now - 3 * 3600_000).toISOString(),
      expires_at: new Date(now - 2 * 3600_000).toISOString(),
      acknowledged_by: [{ displayId: "general-lobby", at: new Date(now - 2.5 * 3600_000).toISOString() }],
      status: "sent",
    }),
  ],
});

// ---------------------------------------------------------------------------
// share_links for A — active, revoked, expired, and one previously used.
// ---------------------------------------------------------------------------
function token() {
  return randomUUID().replace(/-/g, "");
}
function shareLinkRow(overrides) {
  return {
    token: token(),
    event_id: eventA.id,
    label: null,
    created_by: owner.id,
    created_at: null,
    expires_at: null,
    revoked_at: null,
    last_used_at: null,
    ...overrides,
  };
}
await db("share_links", {
  method: "POST",
  prefer: "return=minimal",
  body: [
    shareLinkRow({
      label: "Green Room iPad",
      created_at: new Date(now - 2 * 24 * 3600_000).toISOString(),
      expires_at: new Date(now + 5 * 24 * 3600_000).toISOString(),
      last_used_at: new Date(now - 3600_000).toISOString(),
    }),
    shareLinkRow({
      label: "Lobby TV (revoked — old vendor)",
      created_at: new Date(now - 10 * 24 * 3600_000).toISOString(),
      expires_at: new Date(now + 20 * 24 * 3600_000).toISOString(),
      revoked_at: new Date(now - 5 * 24 * 3600_000).toISOString(),
    }),
    shareLinkRow({
      label: "Press Room (expired)",
      created_at: new Date(now - 30 * 24 * 3600_000).toISOString(),
      expires_at: new Date(now - 1 * 24 * 3600_000).toISOString(),
    }),
  ],
});

// ---------------------------------------------------------------------------
// activity_log for A — a small realistic trail.
// ---------------------------------------------------------------------------
await db("activity_log", {
  method: "POST",
  prefer: "return=minimal",
  body: [
    { event_id: eventA.id, action: "start", detail: "Started", created_at: new Date(now - 22 * 60_000).toISOString() },
    { event_id: eventA.id, action: "next", detail: "Advanced to item 2", created_at: new Date(now - 18 * 60_000).toISOString() },
    { event_id: eventA.id, action: "next", detail: "Advanced to item 3", created_at: new Date(now - 8 * 60_000).toISOString() },
    { event_id: eventA.id, action: "setAlert", detail: "Alert: Running about 5 minutes behind schedule", created_at: new Date(now - 6 * 60_000).toISOString() },
    { event_id: eventA.id, action: "setNotes", detail: "Notes updated", created_at: new Date(now - 5 * 60_000).toISOString() },
  ],
});

// ---------------------------------------------------------------------------
// Event B — sparse/draft: one session, a couple of minimally-filled items,
// nothing started yet (currentOrder stays null), no broadcasts/registry/
// share links at all — exercises the app's empty states.
// ---------------------------------------------------------------------------
const sessionDraft = "launch-day-run";
await db("sessions", {
  method: "POST",
  prefer: "return=minimal",
  body: [
    {
      id: sessionDraft,
      event_id: eventB.id,
      sheet_name: "Run of Show",
      event_name: "Product Launch — Draft",
      day_label: "TBD",
      session_label: "Full Run",
      sort_order: 1,
    },
  ],
});
await db("programs", {
  method: "POST",
  prefer: "return=minimal",
  body: [
    {
      event_id: eventB.id,
      session_id: sessionDraft,
      sort_order: 1,
      type: "item",
      name: "Intro video",
      duration: 2,
      status: "draft",
      remarks: null,
    },
    {
      event_id: eventB.id,
      session_id: sessionDraft,
      sort_order: 2,
      type: "item",
      name: "Live demo",
      duration: 10,
      status: "draft",
      remarks: "Needs a run-through before this is confirmed.",
    },
  ],
});
await db("live_state", {
  method: "PATCH",
  query: `?event_id=eq.${eventB.id}`,
  prefer: "return=minimal",
  body: { active_session_id: sessionDraft },
});

// Event C is intentionally left with zero sessions/programs — true empty
// state — and also brings the demo owner to 3/3 events, the free-tier cap
// (lib/server/plan-limits.ts), so "create event" correctly refuses a 4th.

console.log("[seed] done");
console.log("--------------------------------------------------------------");
console.log("Owner login:        demo@kramflow.test / DemoPass123!");
console.log("Collaborator login: collaborator@kramflow.test / CollabPass123!");
console.log(`Founders Summit 2026 (rich, live in progress):  /e/${eventA.id}/operator`);
console.log(`Product Launch — Draft (sparse, not started):   /e/${eventB.id}/operator`);
console.log(`Empty Test Event (zero data, at free-tier cap): /e/${eventC.id}/operator`);
console.log(`Collaborator's own event (owner-isolation check, demo user must NOT see this): ${eventD.id}`);
console.log("--------------------------------------------------------------");

// Seeds "Northwind Summit 2026" — a generic, plausible conference event used
// ONLY as the subject of the public landing page's product screenshots.
//
// Why a dedicated event rather than the existing demo data: the Satsang
// Shibir demo event is a real, culturally specific rundown whose live state
// is ten days stale, so every capture of it showed a seven-hour overrun in
// red. That reads as a product failing, not working. Marketing captures need
// a show that any event team can see themselves in, running with the small
// honest variance a real show actually carries.
//
// This script NEVER touches the Shibir events. It creates (or reuses) one
// additional event owned by demo1 and writes only that event's rows.
//
// Run:  npx tsx scripts/seed-marketing-demo.ts
//
// The live state is anchored to the real clock at the moment this runs, so
// scripts/capture-product.mjs must run immediately afterwards — together
// they are one pipeline (`npm run capture:product`). Re-run both whenever
// the screenshots need refreshing; the show is always "now", never a stale
// timestamp drifting further behind every hour.

import { config } from "dotenv";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";

config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

import type { ParsedPartition, ParsedProgram, ParsedSession } from "../lib/parse-cuesheet";
import { supabaseAdmin } from "../lib/supabase/server";

const supabase = supabaseAdmin();

const OWNER_EMAIL = "demo1@kramflow.test";
const EVENT_NAME = "Northwind Summit 2026";
const VENUE = "Main Auditorium";
// The event's timezone is chosen at seed time rather than fixed, so that
// "now" always lands mid-morning *in the venue's own timezone*.
//
// Two bugs forced this. First, DATE_ONLY came from
// `new Date().toISOString()`, which is the UTC date — seeding during a
// Pacific evening put the whole show on the following day and the console
// reported a cue that had not started. Second, and worse for the
// screenshots: with a fixed timezone the anchor drifts with the wall
// clock, so a capture run in the evening produced "Day 1 Morning Session"
// with doors at 5:45 PM. Deriving the offset means the rundown always
// reads as the morning session it is labelled as, whatever time of day
// the pipeline happens to run.
const TARGET_LOCAL_HOUR = 10;
const UTC_NOW = new Date();
const OFFSET_HOURS = (() => {
  let o = TARGET_LOCAL_HOUR - UTC_NOW.getUTCHours();
  if (o > 14) o -= 24;
  if (o < -11) o += 24;
  return o;
})();
// POSIX sign convention: Etc/GMT-7 is UTC+7.
const TIMEZONE = OFFSET_HOURS >= 0 ? `Etc/GMT-${OFFSET_HOURS}` : `Etc/GMT+${-OFFSET_HOURS}`;

// The rundown is anchored to the real clock at seed time rather than to
// fixed 9:00-11:15 labels, and the capture run follows immediately.
//
// Why not just pin the browser clock and keep literal times: the four TV
// display routes run lib/display-engine/use-time-sync.ts, an NTP-style
// handshake that measures the offset between the browser and the *server*
// and corrects the browser back onto server time. That is the right
// behaviour for a venue TV with a wrong clock, and it means a faked browser
// clock is actively undone on exactly the surfaces that most need to agree
// with the console. Anchoring the data instead makes every surface honest
// at once: the console's "1m behind", the presenter countdown, and the
// lobby display are all reading the same real instants.
//
// LIVE_INDEX is the item that is live in the captures. Its planned start is
// placed a few minutes in the past, on a tidy 5-minute boundary, and its
// recorded actual start 90 seconds after that — a show running a minute and
// a half behind, which is what a real one looks like.
// Overridable so the capture pipeline can produce two internally-consistent
// states of the same show, one cue apart, for the landing page's "one cue,
// the room responds" sequence. Each pass re-anchors from scratch, so both
// states carry the same honest ~90s variance rather than one of them being
// a fabricated "after" frame.
const LIVE_INDEX = Number(process.env.LIVE_INDEX ?? 3); // default: "Product Launch Demo"
const BEHIND_SECONDS = 90;
const ELAPSED_TARGET_MIN = 5; // roughly how far into the live item to sit

/** Local wall-clock "now" in the venue timezone, as minutes past midnight. */
const NOW_LOCAL_MINUTES = TARGET_LOCAL_HOUR * 60 + UTC_NOW.getUTCMinutes();

/** Midnight of the event's local day, expressed as a UTC instant. */
const LOCAL_MIDNIGHT_UTC = Date.UTC(
  UTC_NOW.getUTCFullYear(),
  UTC_NOW.getUTCMonth(),
  UTC_NOW.getUTCDate(),
  -OFFSET_HOURS
);
/** The event's own calendar date, not the UTC one. */
const DATE_ONLY = new Date(LOCAL_MIDNIGHT_UTC + 12 * 3600_000).toISOString().slice(0, 10);

const pad = (n: number) => String(n).padStart(2, "0");

/** An instant `minutes` past local midnight on the event's date. */
function instantAtLocalMinutes(minutes: number, seconds = 0): string {
  return new Date(LOCAL_MIDNIGHT_UTC + minutes * 60_000 + seconds * 1000).toISOString();
}

function label(h: number, m: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad(m)} ${period}`;
}

function nowLocalMinutes(): number {
  return NOW_LOCAL_MINUTES;
}

const labelFromMinutes = (total: number) => {
  const wrapped = ((total % 1440) + 1440) % 1440;
  return label(Math.floor(wrapped / 60), wrapped % 60);
};

// ---------------------------------------------------------------- rundowns

interface Row {
  name: string;
  presenter: string;
  duration: number;
  type?: "item" | "break";
  requirement?: string;
  remarks?: string;
  /** Drives the AV display's "Video / Presentation" line. Only the talks
   *  that genuinely run a slide deck to the side screens set this — the
   *  live demo runs off the presenter's own laptop feed instead. */
  ppt?: boolean;
}

// Day 1 Morning — the session that is live in every screenshot. Start times
// are derived from these durations and the anchor, not written literally.
const DAY1_MORNING: Row[] = [
  { name: "Doors and Walk-in Music", presenter: "AV", duration: 30, requirement: "Walk-in playlist, house lights up" },
  { name: "Welcome and Housekeeping", presenter: "Stage Manager", duration: 5, requirement: "Handheld mic" },
  { name: "Opening Keynote", presenter: "Amara Osei", duration: 25, requirement: "Lav mic, slides, confidence monitor", ppt: true },
  { name: "Product Launch Demo", presenter: "Rafael Costa", duration: 20, requirement: "Laptop HDMI, live screen share, backup slides", remarks: "Demo laptop on stage-left input. Cut to live feed on cue." },
  { name: "Coffee Break", presenter: "AV", duration: 15, type: "break", requirement: "Break slide, walk-in music" },
  { name: "Panel: Scaling Live Events", presenter: "Moderator", duration: 40, requirement: "4 lav mics, stools, panel lighting" },
  { name: "Closing Remarks", presenter: "Amara Osei", duration: 10, requirement: "Handheld mic" },
];

const DAY1_AFTERNOON: Row[] = [
  { name: "Doors and Afternoon Walk-in", presenter: "AV", duration: 15 },
  { name: "Lightning Talks", presenter: "Community Track", duration: 45, requirement: "Presenter clicker, slide handoff" },
  { name: "Breakout Sessions", presenter: "Track Leads", duration: 60, requirement: "Rooms B and C, roving mics" },
  { name: "Afternoon Break", presenter: "AV", duration: 20, type: "break" },
  { name: "Customer Story: Field Operations", presenter: "Priya Raman", duration: 25, requirement: "Lav mic, slides" },
  { name: "Day 1 Wrap", presenter: "Stage Manager", duration: 10 },
];

const DAY2_MORNING: Row[] = [
  { name: "Doors and Walk-in Music", presenter: "AV", duration: 30 },
  { name: "Day 2 Welcome", presenter: "Stage Manager", duration: 5 },
  { name: "Technical Deep Dive", presenter: "Rafael Costa", duration: 35, requirement: "Slides, live terminal feed" },
  { name: "Coffee Break", presenter: "AV", duration: 15, type: "break" },
  { name: "Workshop: Run of Show", presenter: "Dana Whitfield", duration: 50, requirement: "Handouts, roving mics" },
  { name: "Closing Keynote", presenter: "Amara Osei", duration: 25, requirement: "Lav mic, slides", ppt: true },
];

// The anchor. Place the live item's planned start a tidy few minutes back so
// the capture sits ELAPSED_TARGET_MIN into it, then lay the rest of the
// session out around it from the durations above.
const NOW_LOCAL = nowLocalMinutes();
const LIVE_PLANNED_START = Math.round((NOW_LOCAL - ELAPSED_TARGET_MIN) / 5) * 5;
const MORNING_START = LIVE_PLANNED_START - DAY1_MORNING.slice(0, LIVE_INDEX).reduce((a, r) => a + r.duration, 0);
const MORNING_END = MORNING_START + DAY1_MORNING.reduce((a, r) => a + r.duration, 0);

/** Start-time (minutes since midnight) for every row of a session. */
function startsFor(rows: Row[], sessionStart: number): number[] {
  const out: number[] = [];
  let cursor = sessionStart;
  for (const row of rows) {
    out.push(cursor);
    cursor += row.duration;
  }
  return out;
}

const SESSION_SPECS = [
  { id: "northwind_d1_morning", day: "Day 1", session: "Morning Session", rows: DAY1_MORNING, start: MORNING_START },
  // The afternoon block opens 105 minutes after the morning closes (lunch).
  { id: "northwind_d1_afternoon", day: "Day 1", session: "Afternoon Session", rows: DAY1_AFTERNOON, start: MORNING_END + 105 },
  // Day 2 repeats day 1's opening hour — the same room, the next morning.
  { id: "northwind_d2_morning", day: "Day 2", session: "Morning Session", rows: DAY2_MORNING, start: MORNING_START },
];

function buildProgram(row: Row, sessionId: string, order: number, partitionId: string, startMin: number): ParsedProgram {
  const endMinutes = startMin + row.duration;
  return {
    sort_order: order,
    session_id: sessionId,
    section_label: null,
    partition_id: partitionId,
    type: row.type ?? "item",
    name: row.name,
    description: null,
    presenter: row.presenter,
    presenter_requirement: row.requirement ?? null,
    presenter_contact: null,
    duration: row.duration,
    start_time: labelFromMinutes(startMin),
    end_time: labelFromMinutes(endMinutes),
    audio_mics: row.type !== "break",
    audio_track: row.type === "break" || row.name.includes("Walk-in"),
    video_sidescreen: row.requirement?.includes("slides") ? "slides" : row.requirement?.includes("live") ? "live_feed" : "none",
    backdrop: true,
    video_ppt_needed: Boolean(row.ppt),
    // Rendered by the AV display as "Hall <value> · Stage <value>", so the
    // stored value must not repeat the word or it reads "Stage Stage wash".
    hall_lights: row.type === "break" ? "Up full" : "Half",
    stage_lights: row.type === "break" ? "Off" : "Wash",
    camera_angle: null,
    props: null,
    curtains: row.type === "break" ? "closed" : "open",
    remarks: row.remarks ?? null,
    status: "confirmed",
    color_tag: null,
  };
}

// ------------------------------------------------------------------- seed

async function findOwner(): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email?.toLowerCase() === OWNER_EMAIL);
  if (!user) throw new Error(`${OWNER_EMAIL} not found — run scripts/seed-demo.ts first.`);
  return user.id;
}

async function ensureEvent(ownerId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("name", EVENT_NAME)
    .maybeSingle();
  if (existing) {
    await supabase.from("events").update({ event_date: DATE_ONLY }).eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await supabase
    .from("events")
    .insert({ owner_id: ownerId, name: EVENT_NAME, venue: VENUE, timezone: TIMEZONE, event_date: DATE_ONLY })
    .select("id")
    .single();
  if (error) throw error;
  const { error: ls } = await supabase.from("live_state").insert({ event_id: data.id });
  if (ls) throw ls;
  const { error: ds } = await supabase.from("display_state").insert({ event_id: data.id });
  if (ds) throw ds;
  return data.id;
}

async function main() {
  const ownerId = await findOwner();
  const eventId = await ensureEvent(ownerId);
  console.log(`[marketing-demo] event ${EVENT_NAME} -> ${eventId}`);

  const sessions: ParsedSession[] = SESSION_SPECS.map((s, i) => ({
    id: s.id,
    sheet_name: `${s.day} ${s.session}`,
    event_name: EVENT_NAME,
    day_label: s.day,
    session_label: s.session,
    sort_order: i + 1,
  }));

  const { error: sessionsError } = await supabase
    .from("sessions")
    .upsert(sessions.map((s) => ({ ...s, event_id: eventId })), { onConflict: "event_id,id" });
  if (sessionsError) throw sessionsError;

  const partitions: ParsedPartition[] = [];
  const programs: ParsedProgram[] = [];
  for (const spec of SESSION_SPECS) {
    const partitionId = randomUUID();
    const starts = startsFor(spec.rows, spec.start);
    partitions.push({
      id: partitionId,
      session_id: spec.id,
      label: `${spec.day} · ${spec.session}`,
      sort_order: 1,
      start_time: labelFromMinutes(starts[0]),
    });
    spec.rows.forEach((row, i) => programs.push(buildProgram(row, spec.id, i + 1, partitionId, starts[i])));
  }

  const { error: replaceError } = await supabase.rpc("replace_session_programs", {
    p_event_id: eventId,
    p_session_ids: SESSION_SPECS.map((s) => s.id),
    p_partitions: partitions,
    p_programs: programs,
  });
  if (replaceError) throw replaceError;
  console.log(`[marketing-demo] ${sessions.length} sessions, ${programs.length} items`);

  // Live state: item 4 (Product Launch Demo), started 10:01:30 against a
  // 10:00 plan. Items 1-3 carry real recorded actuals so the rundown reads
  // as a show that has genuinely been running, not one faked at item four.
  const liveSessionId = "northwind_d1_morning";
  const { data: rows, error: rowsError } = await supabase
    .from("programs")
    .select("id, sort_order")
    .eq("event_id", eventId)
    .eq("session_id", liveSessionId)
    .order("sort_order");
  if (rowsError) throw rowsError;

  const byOrder = new Map(rows!.map((r) => [r.sort_order, r.id]));
  const LIVE_ORDER = LIVE_INDEX + 1;
  const morningStarts = startsFor(DAY1_MORNING, MORNING_START);

  /** An instant on today's date, `minutes` past midnight in the event's
   *  timezone, plus `extraSeconds` of real-show slippage. */
  const instantAt = (minutes: number, extraSeconds = 0) =>
    instantAtLocalMinutes(minutes, extraSeconds);

  // Items 1-3 carry real recorded actuals that accumulate into the 90
  // seconds the show is currently behind, so the rundown reads as one that
  // has genuinely been running rather than one faked at item four.
  const liveActualStart = instantAt(morningStarts[LIVE_INDEX], BEHIND_SECONDS);
  const itemActuals: Record<string, { actualStart: string | null; actualEnd: string | null }> = {
    [byOrder.get(1)!]: { actualStart: instantAt(morningStarts[0], 12), actualEnd: instantAt(morningStarts[1], 40) },
    [byOrder.get(2)!]: { actualStart: instantAt(morningStarts[1], 40), actualEnd: instantAt(morningStarts[2], 65) },
    [byOrder.get(3)!]: { actualStart: instantAt(morningStarts[2], 65), actualEnd: liveActualStart },
    [byOrder.get(LIVE_ORDER)!]: { actualStart: liveActualStart, actualEnd: null },
  };

  const { error: liveError } = await supabase
    .from("live_state")
    .update({
      active_session_id: liveSessionId,
      progress_by_session: {
        [liveSessionId]: { currentOrder: LIVE_ORDER, startedAt: liveActualStart },
      },
      item_actuals: itemActuals,
      paused_at: null,
      alert: null,
      // Release any lease left behind by a previous capture run. Without
      // this the console renders "No one has control" or a stale holder,
      // the capture script's Take Control button is missing, and the
      // surfaces section ends up showing an unclaimed show while the hero
      // crop happens to hide it — two captures of the same product
      // disagreeing with each other.
      controller_id: null,
      controller_claimed_at: null,
      notes_overrides: {
        [byOrder.get(LIVE_ORDER)!]: "Demo laptop on stage-left input. Cut to live feed on Rafael's cue, back to slides for Q&A.",
      },
    })
    .eq("event_id", eventId);
  if (liveError) throw liveError;
  console.log("[marketing-demo] live_state: item 4 live, 1m30s behind plan");

  // Displays — conference vocabulary, and recently seen so the fleet reads
  // as connected rather than the "4 OFFLINE" a stale event shows.
  const seenAt = new Date(Date.now() - 4_000).toISOString();
  const displays = [
    { id: `${eventId}-stage`, name: "Stage Confidence Monitor", type: "presenter", latency_ms: 22 },
    { id: `${eventId}-speaker-ready`, name: "Green Room", type: "green-room", latency_ms: 31 },
    { id: `${eventId}-av`, name: "AV Booth", type: "av", latency_ms: 18 },
    { id: `${eventId}-lobby`, name: "Lobby Display", type: "general", latency_ms: 44 },
  ];
  // Drop anything not in this list first. Visiting the four TV routes during
  // a capture run makes each one self-register as a real display, so without
  // this the fleet accumulates anonymous `client-…` rows from previous runs
  // and the console reports them as OFFLINE.
  await supabase
    .from("display_registry")
    .delete()
    .eq("event_id", eventId)
    .not("id", "in", `(${displays.map((d) => d.id).join(",")})`);
  const { error: registryError } = await supabase
    .from("display_registry")
    .upsert(displays.map((d) => ({ ...d, event_id: eventId, last_seen_at: seenAt })), { onConflict: "event_id,id" });
  if (registryError) throw registryError;

  // Broadcasts — one standing, one queued for the upcoming break, one just
  // sent. Timed off the same anchor so the queued one is genuinely still in
  // the future when the captures run.
  const breakStart = morningStarts[LIVE_INDEX + 1];
  await supabase.from("display_broadcasts").delete().eq("event_id", eventId);
  const { error: broadcastError } = await supabase.from("display_broadcasts").insert([
    {
      event_id: eventId,
      type: "info",
      title: "Wi-Fi",
      message: "Guest network: Northwind-Summit · password in your badge holder.",
      priority: 2,
      target: { kind: "all" },
      status: "sent",
      acknowledgement_required: false,
      persistent: true,
      scheduled_for: null,
      dismissed_at: null,
      created_at: instantAt(morningStarts[0], 120),
    },
    {
      event_id: eventId,
      type: "info",
      title: `Coffee Break at ${labelFromMinutes(breakStart)}`,
      message: `Service in the east foyer. Sessions resume at ${labelFromMinutes(breakStart + DAY1_MORNING[LIVE_INDEX + 1].duration)}.`,
      priority: 2,
      target: { kind: "all" },
      status: "scheduled",
      acknowledgement_required: false,
      persistent: false,
      scheduled_for: instantAt(breakStart - 2),
      dismissed_at: null,
      created_at: instantAt(morningStarts[2], 0),
    },
    {
      event_id: eventId,
      type: "warning",
      title: "Panel mics",
      message: `Four lavs needed at the stage-right table before ${labelFromMinutes(breakStart)}.`,
      priority: 1,
      target: { kind: "type", displayTypes: ["av", "green-room"] },
      status: "sent",
      acknowledgement_required: true,
      persistent: false,
      scheduled_for: null,
      dismissed_at: null,
      created_at: instantAt(morningStarts[LIVE_INDEX], 150),
    },
  ]);
  if (broadcastError) throw broadcastError;

  // One share link so the no-login display flow can be captured too.
  const linkLabel = "Lobby Display";
  const { data: existingLink } = await supabase
    .from("share_links")
    .select("token")
    .eq("event_id", eventId)
    .eq("label", linkLabel)
    .is("revoked_at", null)
    .maybeSingle();
  const token = existingLink?.token ?? randomBytes(32).toString("base64url");
  if (!existingLink) {
    const { error } = await supabase.from("share_links").insert({
      token,
      event_id: eventId,
      label: linkLabel,
      created_by: ownerId,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) throw error;
  }

  // Handed to scripts/capture-product.mjs, which must photograph exactly
  // the event this run just anchored, in the timezone it anchored it to.
  writeFileSync(
    path.join(process.cwd(), "scripts", ".capture-context.json"),
    JSON.stringify({ eventId, shareToken: token, timezone: TIMEZONE }, null, 2)
  );

  console.log(
    JSON.stringify({ eventId, shareToken: token, timezone: TIMEZONE, anchor: { liveItem: DAY1_MORNING[LIVE_INDEX].name, plannedStart: labelFromMinutes(morningStarts[LIVE_INDEX]), behindSeconds: BEHIND_SECONDS }, dateOnly: DATE_ONLY }, null, 2)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

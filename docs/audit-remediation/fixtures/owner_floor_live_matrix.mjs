#!/usr/bin/env node
// Reusable, bounded live-fixture script for the owner/editor/viewer authorization
// matrix used across KF-001/KF-003's live evidence in B002/B003/B004.
//
// Scope and boundary (read before running):
// - Targets ONLY the dev Supabase project already authorized for this work
//   (qofggbarsdiovzqwgkpz.supabase.co — see BASELINE.md). `assertAllowedProject`
//   parses the URL and requires an EXACT match (scheme/host/port/path/query/
//   fragment/userinfo) before any service-role key is read or any client is
//   created — a substring/`.includes()` check is not a boundary (Codex B003
//   review, B003-S1).
// - Uses ONLY pre-existing, already-authorized .test-TLD fixture accounts
//   (demo1@kramflow.test as owner, phase1-viewer-test@kramflow.test,
//   phase1-editor-test@kramflow.test). It does NOT create new auth accounts,
//   does NOT send real email, does NOT reset any existing user's password to
//   obtain a session, and does NOT touch the KF-002 flagged
//   must_change_password scenario (see DECISIONS.md and the B004
//   pending-authorization request in batches/B004/BATCH_REPORT.md).
// - `setup` is a resumable state machine (event_created -> collaborators_created
//   -> broadcast_created -> complete), not a single untracked insert. Every
//   remote write is checked and persisted to an atomically-written state file
//   immediately — a remote write that succeeds but whose state-save fails is
//   reported as its own distinct, recoverable error, never silently merged
//   into "setup complete."
// - `cleanup` re-validates ownership (event name carries this run's id, and
//   owner_id matches a known fixture account) against the DATABASE row before
//   deleting anything, not just against the state file's own claims — a
//   tampered or stale state file cannot be used to delete an unrelated event.
//   Partial cleanup failure is retried from where it left off, never silently
//   discarded.
// - `run` performs real, bounded HTTP assertions against a caller-provided
//   dev-server base URL using an injectable session-cookie source — see
//   `runMatrix`'s `getSessionCookie` parameter. The default implementation
//   intentionally throws rather than fabricate a working end-to-end login
//   flow this script hasn't verified against this app's exact `@supabase/ssr`
//   cookie format; see "Obtaining a real session" below.
//
// Obtaining a real session for `run`, without resetting any account's password:
//   Use `admin.auth.admin.generateLink({ type: "magiclink", email })` to get a
//   one-time `email_otp`, exchange it with an anon client's
//   `auth.verifyOtp({ email, token: email_otp, type: "magiclink" })` to get a
//   real access token for that user, then translate that into this app's
//   actual session-cookie format (its `@supabase/ssr` cookie name/shape) —
//   that translation step is app-specific and was not implemented here
//   without first reading and confirming the exact cookie contract, so `run`'s
//   default `getSessionCookie` throws a clear "not implemented" error naming
//   this exact gap rather than printing instructions and calling it done.
//
// Usage:
//   node --env-file=.env.local fixtures/owner_floor_live_matrix.mjs setup
//   node --env-file=.env.local fixtures/owner_floor_live_matrix.mjs run --base-url=http://localhost:3000
//   node --env-file=.env.local fixtures/owner_floor_live_matrix.mjs cleanup
//
// Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in the
// environment (never printed by this script). See owner_floor_live_matrix.test.ts
// for the fake-transport/fake-filesystem unit tests covering the logic below.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import nodeFs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ALLOWED_PROJECT_HOST = "qofggbarsdiovzqwgkpz.supabase.co";
export const OWNER_EMAIL = "demo1@kramflow.test";
export const VIEWER_EMAIL = "phase1-viewer-test@kramflow.test";
export const EDITOR_EMAIL = "phase1-editor-test@kramflow.test";
export const FIXTURE_RUN_ID = "b00x-owner-floor-live-matrix"; // stable, not random: one canonical fixture, reused/resumed rather than multiplied.
export const FIXTURE_NAME_PREFIX = `[fixture:${FIXTURE_RUN_ID}]`;

/**
 * @typedef {{
 *   readFile: (p: string, enc?: string) => Promise<string>,
 *   writeFile: (p: string, content: string, enc?: string) => Promise<void>,
 *   rename: (from: string, to: string) => Promise<void>,
 *   rm: (p: string, opts?: { force?: boolean }) => Promise<void>,
 * }} FsLike
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STATE_PATH = path.join(__dirname, `.owner_floor_live_matrix.${FIXTURE_RUN_ID}.state.json`);

/**
 * Strict allow-list check for the Supabase project URL. Throws before the
 * caller reads any secret or creates any client. Rejects: wrong scheme,
 * wrong/lookalike hostname (including the allowed host as a suffix or substring
 * of a longer unrelated host), userinfo, a non-default port, any path beyond
 * "/", any query string, any fragment, and a malformed URL outright.
 */
export function assertAllowedProjectUrl(urlString, allowedHost = ALLOWED_PROJECT_HOST) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`Refusing to run: '${urlString}' is not a valid URL.`);
  }
  const problems = [];
  if (parsed.protocol !== "https:") problems.push(`scheme must be https, got '${parsed.protocol}'`);
  if (parsed.hostname !== allowedHost) problems.push(`host must be exactly '${allowedHost}', got '${parsed.hostname}'`);
  if (parsed.port !== "") problems.push(`no explicit port is allowed, got ':${parsed.port}'`);
  if (parsed.username !== "" || parsed.password !== "") problems.push("no userinfo (user:pass@) is allowed");
  if (parsed.pathname !== "" && parsed.pathname !== "/") problems.push(`no path is allowed, got '${parsed.pathname}'`);
  if (parsed.search !== "") problems.push(`no query string is allowed, got '${parsed.search}'`);
  if (parsed.hash !== "") problems.push(`no fragment is allowed, got '${parsed.hash}'`);
  if (problems.length > 0) {
    throw new Error(`Refusing to run: '${urlString}' does not match the authorized dev project exactly — ${problems.join("; ")}.`);
  }
  return parsed;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}. Run with --env-file=.env.local.`);
  return v;
}

/** Atomic write: write to a sibling temp file, then rename over the target. Never leaves a half-written state file. */
/** @param {FsLike} fs */
export async function writeStateAtomic(fs, statePath, state) {
  const tmp = `${statePath}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tmp, statePath);
}

const VALID_PHASES = ["event_created", "collaborators_created", "broadcast_created", "complete"];
const REQUIRED_FIELDS_BY_PHASE = {
  event_created: ["runId", "phase", "eventId", "ownerId", "viewerId", "editorId"],
  collaborators_created: ["runId", "phase", "eventId", "ownerId", "viewerId", "editorId"],
  broadcast_created: ["runId", "phase", "eventId", "ownerId", "viewerId", "editorId", "broadcastId", "displayId"],
  complete: ["runId", "phase", "eventId", "ownerId", "viewerId", "editorId", "broadcastId", "displayId"],
};

/**
 * Reads and validates the state file. Returns a tagged result rather than
 * throwing, so callers decide what "missing" vs "malformed" means for them —
 * cleanup treats "missing" as nothing-to-do but "malformed" as an error
 * requiring manual recovery, never silently equivalent.
 */
/** @param {FsLike} fs */
export async function readState(fs, statePath, expectedRunId = FIXTURE_RUN_ID) {
  let raw;
  try {
    raw = await fs.readFile(statePath, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return { ok: false, reason: "missing" };
    return { ok: false, reason: "unreadable", error: err };
  }
  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed", raw };
  }
  if (!state || typeof state !== "object" || !VALID_PHASES.includes(state.phase)) {
    return { ok: false, reason: "malformed", raw };
  }
  const required = REQUIRED_FIELDS_BY_PHASE[state.phase];
  const missing = required.filter((f) => !(f in state) || state[f] == null || state[f] === "");
  if (missing.length > 0) {
    return { ok: false, reason: "malformed", raw, missing };
  }
  if (state.runId !== expectedRunId) {
    return { ok: false, reason: "wrong_run_id", state };
  }
  return { ok: true, state };
}

function malformedStateMessage(statePath, result) {
  return (
    `State file at ${statePath} exists but is ${result.reason === "malformed" ? "malformed" : "unreadable"} ` +
    `(${result.missing ? `missing fields: ${result.missing.join(", ")}` : result.error?.message || "parse failure"}). ` +
    `This is an error requiring manual recovery, not an empty state: inspect the file by hand, cross-check any ` +
    `eventId it still contains against the database directly, and only delete the file once you've confirmed no ` +
    `orphaned fixture rows remain (look for events named with the '${FIXTURE_NAME_PREFIX}' prefix).`
  );
}

/** db: a minimal interface — {select, insert, update, delete} — over a Supabase-js client or a fake for tests. */
async function checked(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label} failed: ${error.message}`);
  return data;
}

/** @param {{db: any, fs?: FsLike, statePath?: string, log?: (...args: any[]) => void}} opts */
export async function runSetup({ db, fs = nodeFs, statePath = DEFAULT_STATE_PATH, log = console.log }) {
  const existing = await readState(fs, statePath);
  if (existing.ok && existing.state.phase === "complete") {
    log(`Already set up (run ${FIXTURE_RUN_ID}, event ${existing.state.eventId}). Run cleanup first to recreate.`);
    return existing.state;
  }
  if (!existing.ok && (existing.reason === "malformed" || existing.reason === "unreadable")) {
    throw new Error(malformedStateMessage(statePath, existing));
  }
  if (!existing.ok && existing.reason === "wrong_run_id") {
    throw new Error(`State file at ${statePath} belongs to a different run id than the current fixture. Refusing to touch it.`);
  }

  let state = existing.ok ? existing.state : null;

  if (!state) {
    const users = await checked(db.listUsers(), "listing users");
    const owner = users.users.find((u) => u.email === OWNER_EMAIL);
    const viewer = users.users.find((u) => u.email === VIEWER_EMAIL);
    const editor = users.users.find((u) => u.email === EDITOR_EMAIL);
    for (const [label, u, email] of [["owner", owner, OWNER_EMAIL], ["viewer", viewer, VIEWER_EMAIL], ["editor", editor, EDITOR_EMAIL]]) {
      if (!u) throw new Error(`Expected pre-existing fixture account for ${label} (${email}) not found. This script does not create new auth accounts.`);
    }

    const event = await checked(
      db.from("events").insert({ name: `${FIXTURE_NAME_PREFIX} live-matrix fixture event`, owner_id: owner.id }).select("id").single(),
      "creating the fixture event"
    );

    const nextState = { runId: FIXTURE_RUN_ID, phase: "event_created", eventId: event.id, ownerId: owner.id, viewerId: viewer.id, editorId: editor.id, createdAt: new Date().toISOString() };
    try {
      await writeStateAtomic(fs, statePath, nextState);
    } catch (saveErr) {
      throw new Error(
        `Event ${event.id} was created successfully, but saving the recovery state file failed (${saveErr.message}). ` +
        `This is NOT a clean setup — record event id ${event.id} now and either retry the state save manually or ` +
        `delete that event directly before anything else touches this fixture.`
      );
    }
    state = nextState;
    log("event created:", event.id);
  }

  if (state.phase === "event_created") {
    await checked(
      db.from("event_collaborators").insert([
        { event_id: state.eventId, user_id: state.viewerId, role: "viewer", status: "accepted" },
        { event_id: state.eventId, user_id: state.editorId, role: "editor", status: "accepted" },
      ]),
      "creating fixture collaborators"
    );
    const nextState = { ...state, phase: "collaborators_created" };
    await writeStateAtomic(fs, statePath, nextState);
    state = nextState;
    log("collaborators created for event", state.eventId);
  }

  if (state.phase === "collaborators_created") {
    // Bounded, test-owned prerequisites: the hold/timer/speaker-ready/dismiss
    // matrix needs a real display_type_state row and a real display_broadcasts
    // row to exercise, not just an event/collaborator shell (Codex B004 item 1:
    // "don't call setup complete when the subsequent matrix cannot run").
    const display = await checked(
      db.from("display_type_state").insert({ event_id: state.eventId, display_type: "presenter" }).select("id").single(),
      "creating the fixture display_type_state row"
    );
    const broadcast = await checked(
      db.from("display_broadcasts").insert({ event_id: state.eventId, title: `${FIXTURE_NAME_PREFIX} test broadcast`, type: "info", status: "sent" }).select("id").single(),
      "creating the fixture broadcast row"
    );
    const nextState = { ...state, phase: "broadcast_created", displayId: display.id, broadcastId: broadcast.id };
    await writeStateAtomic(fs, statePath, nextState);
    state = nextState;
    log("broadcast + display-state fixtures created for event", state.eventId);
  }

  if (state.phase === "broadcast_created") {
    const nextState = { ...state, phase: "complete" };
    await writeStateAtomic(fs, statePath, nextState);
    state = nextState;
  }

  log("setup complete:", state);
  return state;
}

/**
 * Re-validates ownership against the database row itself, not just the state
 * file's own claims, before deleting anything (Codex B003 review, B003-S2:
 * "do not let a tampered state file delete an unrelated event").
 */
export async function verifyFixtureOwnership({ db, state }) {
  const event = await checked(db.from("events").select("id,name,owner_id").eq("id", state.eventId).maybeSingle(), "reading the event before cleanup");
  if (!event) return { ok: true, alreadyGone: true };
  if (event.owner_id !== state.ownerId || !event.name?.startsWith(FIXTURE_NAME_PREFIX)) {
    return {
      ok: false,
      reason: `Database row for event ${state.eventId} does not match this fixture's expected owner/name marker (expected owner ${state.ownerId}, name prefix '${FIXTURE_NAME_PREFIX}'; got owner ${event.owner_id}, name '${event.name}'). Refusing to delete — this looks like a different event than the one this fixture created.`,
    };
  }
  return { ok: true, alreadyGone: false };
}

/** @param {{db: any, fs?: FsLike, statePath?: string, log?: (...args: any[]) => void}} opts */
export async function runCleanup({ db, fs = nodeFs, statePath = DEFAULT_STATE_PATH, log = console.log }) {
  const result = await readState(fs, statePath);
  if (!result.ok && result.reason === "missing") {
    log("No state file found — nothing to clean up.");
    return;
  }
  if (!result.ok) {
    throw new Error(malformedStateMessage(statePath, result));
  }
  const state = result.state;

  const ownership = await verifyFixtureOwnership({ db, state });
  if (!ownership.ok) {
    throw new Error(ownership.reason);
  }
  if (!ownership.alreadyGone) {
    if (state.broadcastId) await checked(db.from("display_broadcasts").delete().eq("id", state.broadcastId).eq("event_id", state.eventId), "deleting the fixture broadcast");
    if (state.displayId) await checked(db.from("display_type_state").delete().eq("id", state.displayId).eq("event_id", state.eventId), "deleting the fixture display-state row");
    await checked(db.from("event_collaborators").delete().eq("event_id", state.eventId), "deleting fixture collaborators");
    await checked(db.from("events").delete().eq("id", state.eventId), "deleting the fixture event");
  }

  await fs.rm(statePath, { force: true });
  log(`cleanup complete for event ${state.eventId}${ownership.alreadyGone ? " (was already gone)" : ""}`);
}

/**
 * Real, bounded HTTP assertions against a running dev server. `getSessionCookie`
 * is an injected seam: tests supply a fake; real use requires a verified
 * session-cookie source (see file header "Obtaining a real session" — the
 * default throws rather than fabricate one).
 */
export async function runMatrix({
  baseUrl,
  state,
  getSessionCookie = async () => {
    throw new Error(
      "No session-cookie source configured. This script will not fabricate a login flow it hasn't verified against " +
      "this app's exact @supabase/ssr cookie contract — see this file's header comment for the real, non-password-reset " +
      "mechanism (generateLink + verifyOtp) and wire a getSessionCookie implementation before calling runMatrix for real."
    );
  },
  fetchImpl = fetch,
}) {
  const identities = [
    { label: "owner", email: OWNER_EMAIL, expectHold: 200 },
    { label: "viewer", email: VIEWER_EMAIL, expectHold: 403 },
    { label: "editor", email: EDITOR_EMAIL, expectHold: 403 },
  ];
  const results = [];
  for (const identity of identities) {
    const cookie = await getSessionCookie(identity.email);
    const res = await fetchImpl(`${baseUrl}/api/display-engine/hold`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ eventId: state.eventId, displayType: "presenter", active: true }),
    });
    results.push({ identity: identity.label, action: "hold", expected: identity.expectHold, actual: res.status, pass: res.status === identity.expectHold });
  }
  return results;
}

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  assertAllowedProjectUrl(url);
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const db = {
    from: (table) => client.from(table),
    listUsers: () => client.auth.admin.listUsers(),
  };

  const cmd = process.argv[2];
  const args = parseArgs(process.argv.slice(3));

  if (cmd === "setup") return void (await runSetup({ db }));
  if (cmd === "cleanup") return void (await runCleanup({ db }));
  if (cmd === "run") {
    const baseUrl = args["base-url"] || process.env.DEV_SERVER_URL;
    if (!baseUrl) throw new Error("run requires --base-url=<dev server> or DEV_SERVER_URL.");
    const result = await readState(nodeFs, DEFAULT_STATE_PATH);
    if (!result.ok) throw new Error(`No completed fixture state found — run setup first. (${result.reason})`);
    const results = await runMatrix({ baseUrl, state: result.state });
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  console.error("Usage: owner_floor_live_matrix.mjs <setup|run|cleanup> [--base-url=...]");
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("FAILED:", err.message);
    process.exit(1);
  });
}

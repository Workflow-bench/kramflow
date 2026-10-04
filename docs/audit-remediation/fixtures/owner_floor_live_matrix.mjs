#!/usr/bin/env node
// Reusable, bounded live-fixture script for the owner/editor/viewer authorization
// matrix used across KF-001/KF-003's live evidence in B002-B005.
//
// Scope and boundary (read before running):
// - Targets ONLY the dev Supabase project already authorized for this work
//   (qofggbarsdiovzqwgkpz.supabase.co — see BASELINE.md). `assertAllowedProjectUrl`
//   parses the URL and requires an EXACT match (scheme/host/port/path/query/
//   fragment/userinfo) before any service-role key is read or any client is
//   created — a substring/`.includes()` check is not a boundary (Codex B003
//   review, B003-S1).
// - Uses ONLY pre-existing, already-authorized .test-TLD fixture accounts
//   (demo1@kramflow.test as owner, phase1-viewer-test@kramflow.test,
//   phase1-editor-test@kramflow.test). It does NOT create new auth accounts,
//   does NOT send real email, does NOT reset any existing user's password to
//   obtain a session, and does NOT touch the KF-002 flagged
//   must_change_password scenario (see DECISIONS.md and the authorization
//   request in the most recent batch report).
// - `setup` is a resumable state machine (event -> collaborators -> the
//   display_type_state row -> the display_state row -> a real broadcast ->
//   complete), where EVERY step first checks whether its target already
//   exists (by event_id + a natural key) before inserting, and persists state
//   atomically immediately after that step — not batched across several
//   writes (Codex B004 review, B004-S2: a prior version created the display
//   and broadcast rows before persisting either id, so a broadcast failure
//   left state at an earlier phase and a retry re-inserted a second display
//   row, violating UNIQUE(event_id, display_type)). Because every insert is
//   preceded by a lookup, re-running any step after a state-save failure
//   reconciles with whatever already exists remotely instead of duplicating it.
// - `cleanup` re-validates ownership (event name carries this run's id, and
//   owner_id matches a known fixture account) against the DATABASE row before
//   deleting anything, not just against the state file's own claims.
// - `run` performs real, bounded HTTP assertions against a caller-provided
//   dev-server base URL using an injectable session-cookie source (see
//   `runMatrix`). It validates the base URL is a local/dev-looking origin
//   before sending any cookie, never follows a redirect (so a cookie can
//   never leak to a host this script didn't validate), and exits non-zero if
//   any assertion fails (Codex B004 review, B004-S3: a prior version printed
//   `pass:false` results and still exited 0).
//
// Obtaining a session for `run`, without creating or resetting any account:
//   1. Start the dev server locally (`npm run dev`) against the authorized dev
//      project, and sign in in your own browser as each fixture account. Sign
//      in as you normally would. This script does not type a password.
//   2. In that browser's DevTools (Application > Cookies, localhost), copy the
//      sb-<ref>-auth-token cookies (including any .0/.1 chunks) as a single
//      "name=value; name.1=value" line.
//   3. Put each account's line in .env.local (untracked), e.g.
//      KRAMFLOW_LOCAL_COOKIE_OWNER="sb-<ref>-auth-token=...; ..."
//      KRAMFLOW_LOCAL_COOKIE_EDITOR=... and KRAMFLOW_LOCAL_COOKIE_VIEWER=...
//   4. `run` validates each value's cookie names before sending it, sends it
//      only to a localhost/*.localhost/*.test origin, and never follows redirects.
//   Missing or non-Supabase cookie names fail before any request is made.
//   Tests cover this seam with fake env values only (see the test file).
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
export const FIXTURE_DISPLAY_TYPE = "presenter";

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

/**
 * Allow-list for where `run` may send a session cookie — a local dev server
 * only. Rejects anything else, including a URL that merely redirects to one
 * (fetch below is called with redirect: "manual" for the same reason): a
 * cookie must never leave the machine this fixture is meant to test
 * (Codex B005 prompt item 2: "validate the allowed local/dev application
 * origin before transmitting cookies, prohibit redirects leaking authenticated
 * inputs").
 */
export function assertLocalDevOrigin(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`Refusing to send session cookies: '${urlString}' is not a valid URL.`);
  }
  const host = parsed.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost") || host.endsWith(".test");
  if (!isLocal) {
    throw new Error(`Refusing to send session cookies to '${host}': only localhost/127.0.0.1/*.localhost/*.test dev origins are allowed.`);
  }
  return parsed;
}

// B005-S3 — executable session-cookie input. The operator signs in as a
// fixture account in their own local browser on the dev server, copies that
// browser's Supabase auth cookies, and stores them in an untracked env file.
// No password is typed by this script, no account is created or reset, and no
// session is minted here. The value is only ever sent to a validated local
// origin (runMatrix calls assertLocalDevOrigin first) and is never logged.
export const SESSION_COOKIE_ENV = {
  [OWNER_EMAIL]: "KRAMFLOW_LOCAL_COOKIE_OWNER",
  [EDITOR_EMAIL]: "KRAMFLOW_LOCAL_COOKIE_EDITOR",
  [VIEWER_EMAIL]: "KRAMFLOW_LOCAL_COOKIE_VIEWER",
};

// @supabase/ssr names its auth cookie sb-<project-ref>-auth-token, and splits
// large values into .0, .1, ... chunks. Anything else is refused, so a value
// copied from the wrong cookie is caught before it is sent.
const SUPABASE_AUTH_COOKIE = /^sb-[a-z0-9]+-auth-token(\.[0-9]+)?$/;

export function parseSessionCookie(raw) {
  const pairs = raw.split(";").map((p) => p.trim()).filter(Boolean);
  if (pairs.length === 0) throw new Error("Session cookie input is empty.");
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    const name = eq > 0 ? pair.slice(0, eq) : "";
    if (!SUPABASE_AUTH_COOKIE.test(name)) {
      throw new Error("Session cookie input has a cookie that is not a Supabase auth cookie (expected sb-<ref>-auth-token[.N]).");
    }
    if (eq === pair.length - 1) throw new Error("Session cookie input has a cookie with no value.");
  }
  return pairs.join("; ");
}

export function cookieFromEnv(email, env = process.env) {
  const name = SESSION_COOKIE_ENV[email];
  if (!name) throw new Error(`No session-cookie input is defined for fixture account ${email}.`);
  const raw = env[name];
  if (!raw) {
    throw new Error(`Missing ${name}. Copy the local dev browser's Supabase auth cookies for this account into it (see the header).`);
  }
  return parseSessionCookie(raw);
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

const VALID_PHASES = [
  "event_created",
  "collaborators_created",
  "display_type_state_created",
  "display_state_created",
  "broadcast_created",
  "complete",
];
const BASE_FIELDS = ["runId", "phase", "eventId", "ownerId", "viewerId", "editorId"];
const REQUIRED_FIELDS_BY_PHASE = {
  event_created: BASE_FIELDS,
  collaborators_created: BASE_FIELDS,
  display_type_state_created: [...BASE_FIELDS, "displayTypeStateId"],
  display_state_created: [...BASE_FIELDS, "displayTypeStateId"],
  broadcast_created: [...BASE_FIELDS, "displayTypeStateId", "broadcastId"],
  complete: [...BASE_FIELDS, "displayTypeStateId", "broadcastId"],
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

/** db: a minimal interface — {from, listUsers} — over a Supabase-js client or a fake for tests. */
async function checked(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label} failed: ${error.message}`);
  return data;
}

async function saveOrReportDivergence(fs, statePath, nextState, successDescription) {
  try {
    await writeStateAtomic(fs, statePath, nextState);
  } catch (saveErr) {
    throw new Error(
      `${successDescription}, but saving the recovery state file failed (${saveErr.message}). ` +
      `This is NOT a clean step — the remote write really did succeed (re-running setup will find and reuse it via ` +
      `its lookup-before-insert check, not duplicate it), but you must fix the state-save problem (disk space, ` +
      `permissions on ${statePath}) before relying on this fixture's own bookkeeping again.`
    );
  }
}

/**
 * Each ensure* step below follows the same shape: look up whether the target
 * already exists (by a natural key, not by the state file's say-so), reuse it
 * if so, insert only if genuinely absent, then persist immediately. This is
 * what makes `setup` safe to re-run after ANY failure, remote or local
 * (Codex B004 review, B004-S2).
 */

async function ensureEvent({ db, fs, statePath, log }) {
  const users = await checked(db.listUsers(), "listing users");
  const owner = users.users.find((u) => u.email === OWNER_EMAIL);
  const viewer = users.users.find((u) => u.email === VIEWER_EMAIL);
  const editor = users.users.find((u) => u.email === EDITOR_EMAIL);
  for (const [label, u, email] of [["owner", owner, OWNER_EMAIL], ["viewer", viewer, VIEWER_EMAIL], ["editor", editor, EDITOR_EMAIL]]) {
    if (!u) throw new Error(`Expected pre-existing fixture account for ${label} (${email}) not found. This script does not create new auth accounts.`);
  }

  const fixtureEventName = `${FIXTURE_NAME_PREFIX} live-matrix fixture event`;
  const existingEvent = await checked(
    db.from("events").select("id,owner_id,name").eq("owner_id", owner.id).eq("name", fixtureEventName).maybeSingle(),
    "looking up an existing fixture event"
  );
  const event = existingEvent ?? (await checked(
    db.from("events").insert({ name: fixtureEventName, owner_id: owner.id }).select("id").single(),
    "creating the fixture event"
  ));

  const nextState = { runId: FIXTURE_RUN_ID, phase: "event_created", eventId: event.id, ownerId: owner.id, viewerId: viewer.id, editorId: editor.id, createdAt: new Date().toISOString() };
  await saveOrReportDivergence(fs, statePath, nextState, `Event ${event.id} ${existingEvent ? "was found and reused" : "was created"}`);
  log(existingEvent ? "event reused:" : "event created:", event.id);
  return nextState;
}

async function ensureCollaborators({ db, fs, statePath, log, state }) {
  const existing = await checked(
    db.from("event_collaborators").select("user_id").eq("event_id", state.eventId),
    "looking up existing fixture collaborators"
  );
  const existingIds = new Set((existing || []).map((r) => r.user_id));
  const toInsert = [
    { event_id: state.eventId, user_id: state.viewerId, role: "viewer", status: "accepted", invited_email: VIEWER_EMAIL },
    { event_id: state.eventId, user_id: state.editorId, role: "editor", status: "accepted", invited_email: EDITOR_EMAIL },
  ].filter((row) => !existingIds.has(row.user_id));
  if (toInsert.length > 0) {
    await checked(db.from("event_collaborators").insert(toInsert), "creating fixture collaborators");
  }
  const nextState = { ...state, phase: "collaborators_created" };
  await saveOrReportDivergence(fs, statePath, nextState, `Collaborators for event ${state.eventId} were ensured (${toInsert.length} inserted, ${existingIds.size} already present)`);
  log("collaborators ensured for event", state.eventId);
  return nextState;
}

async function ensureDisplayTypeState({ db, fs, statePath, log, state }) {
  const existing = await checked(
    db.from("display_type_state").select("id").eq("event_id", state.eventId).eq("display_type", FIXTURE_DISPLAY_TYPE).maybeSingle(),
    "looking up an existing fixture display_type_state row"
  );
  const row = existing ?? (await checked(
    db.from("display_type_state").insert({ event_id: state.eventId, display_type: FIXTURE_DISPLAY_TYPE }).select("id").single(),
    "creating the fixture display_type_state row"
  ));
  const nextState = { ...state, phase: "display_type_state_created", displayTypeStateId: row.id };
  await saveOrReportDivergence(fs, statePath, nextState, `display_type_state row ${row.id} for event ${state.eventId} was ${existing ? "found and reused" : "created"}`);
  log("display_type_state ensured:", row.id);
  return nextState;
}

async function ensureDisplayState({ db, fs, statePath, log, state }) {
  // speaker-ready's route does a plain .single() read on display_state by
  // event_id with no fallback — a missing row 500s rather than exercising the
  // authorization boundary meaningfully for the OWNER success path (denied
  // roles still correctly 403 before that read). Codex B004/B005: "prepare
  // the schema prerequisites, including speaker-ready state, rather than
  // letting missing rows replace an authorization test."
  const existing = await checked(
    db.from("display_state").select("id").eq("event_id", state.eventId).maybeSingle(),
    "looking up an existing fixture display_state row"
  );
  if (!existing) {
    await checked(db.from("display_state").insert({ event_id: state.eventId }), "creating the fixture display_state row");
  }
  const nextState = { ...state, phase: "display_state_created" };
  await saveOrReportDivergence(fs, statePath, nextState, `display_state row for event ${state.eventId} was ${existing ? "found and reused" : "created"}`);
  log("display_state ensured for event", state.eventId);
  return nextState;
}

async function ensureBroadcast({ db, fs, statePath, log, state }) {
  const fixtureTitle = `${FIXTURE_NAME_PREFIX} test broadcast`;
  const existing = await checked(
    db.from("display_broadcasts").select("id").eq("event_id", state.eventId).eq("title", fixtureTitle).maybeSingle(),
    "looking up an existing fixture broadcast"
  );
  const row = existing ?? (await checked(
    db.from("display_broadcasts").insert({
      event_id: state.eventId,
      type: "info",
      title: fixtureTitle,
      // `message` and `target` are NOT NULL with no default
      // (supabase/migrations/20260909091731_schema_base.sql) — a prior
      // version of this fixture omitted both, so setup could never actually
      // succeed against this schema (Codex B004 review, B004-S1).
      message: `${FIXTURE_NAME_PREFIX} message body`,
      target: { kind: "all" },
      status: "sent",
    }).select("id").single(),
    "creating the fixture broadcast"
  ));
  const nextState = { ...state, phase: "broadcast_created", broadcastId: row.id };
  await saveOrReportDivergence(fs, statePath, nextState, `Broadcast ${row.id} for event ${state.eventId} was ${existing ? "found and reused" : "created"}`);
  log("broadcast ensured:", row.id);
  return nextState;
}

/**
 * Before any resumed write, re-derive the fixture accounts from the live auth
 * directory (never from the state file) and verify the saved parent event is
 * still the fixture's own: owner matches the independently resolved owner
 * account and the name carries this run's marker. Missing or unrelated events
 * fail here with zero writes (Codex B005 review, B005-S2). Child lookups
 * scoped by event_id are not parent-ownership proof on their own.
 */
async function assertResumableParent({ db, state }) {
  const users = await checked(db.listUsers(), "re-resolving fixture accounts");
  const byEmail = (email) => users.users.find((u) => u.email === email);
  const owner = byEmail(OWNER_EMAIL);
  const viewer = byEmail(VIEWER_EMAIL);
  const editor = byEmail(EDITOR_EMAIL);
  if (!owner || !viewer || !editor) {
    throw new Error("Cannot resume: one or more pre-existing fixture accounts are missing. No writes performed.");
  }
  if (state.ownerId !== owner.id || state.viewerId !== viewer.id || state.editorId !== editor.id) {
    throw new Error("Cannot resume: saved fixture account ids do not match the live accounts for these emails. No writes performed.");
  }
  const event = await checked(
    db.from("events").select("id,owner_id,name").eq("id", state.eventId).maybeSingle(),
    "re-reading the saved parent event before resuming"
  );
  if (!event) {
    throw new Error(`Cannot resume: saved event ${state.eventId} does not exist. No writes performed; re-run after recovery review.`);
  }
  if (event.owner_id !== owner.id || !String(event.name ?? "").startsWith(FIXTURE_NAME_PREFIX)) {
    throw new Error(`Cannot resume: event ${state.eventId} is not owned by the fixture owner or lacks the run marker. No writes performed.`);
  }
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
  const ctx = { db, fs, statePath, log };

  if (state) await assertResumableParent({ db, state });

  if (!state) state = await ensureEvent(ctx);
  if (state.phase === "event_created") state = await ensureCollaborators({ ...ctx, state });
  if (state.phase === "collaborators_created") state = await ensureDisplayTypeState({ ...ctx, state });
  if (state.phase === "display_type_state_created") state = await ensureDisplayState({ ...ctx, state });
  if (state.phase === "display_state_created") state = await ensureBroadcast({ ...ctx, state });
  if (state.phase === "broadcast_created") {
    const nextState = { ...state, phase: "complete" };
    await saveOrReportDivergence(fs, statePath, nextState, "All fixture resources were ensured");
    state = nextState;
  }

  log("setup complete:", state);
  return state;
}

/**
 * Re-validates ownership against the database row itself, not just the state
 * file's own claims, before mutating OR deleting anything (Codex B003/B004
 * review: "do not let a tampered state file delete an unrelated event" —
 * B005 extends this to apply before resuming writes too, via ensure*'s own
 * lookups above, which always re-derive from the real row rather than
 * trusting the state file's ids blindly).
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
    await checked(db.from("display_state").delete().eq("event_id", state.eventId), "deleting the fixture display_state row");
    if (state.displayTypeStateId) await checked(db.from("display_type_state").delete().eq("id", state.displayTypeStateId).eq("event_id", state.eventId), "deleting the fixture display_type_state row");
    await checked(db.from("event_collaborators").delete().eq("event_id", state.eventId), "deleting fixture collaborators");
    await checked(db.from("events").delete().eq("id", state.eventId), "deleting the fixture event");
  }

  await fs.rm(statePath, { force: true });
  log(`cleanup complete for event ${state.eventId}${ownership.alreadyGone ? " (was already gone)" : ""}`);
}

// Per-action route contracts, taken from the real handlers (B005 review
// B005-S1). method must match the export the route file actually provides;
// the test in owner_floor_live_matrix.test.ts asserts that against the
// imported modules. Denied expectations follow each handler's own guard:
// hold/timer/speaker-ready return 403 "Unauthorized"; dismiss uses
// requireBroadcastSessionAccess, which returns 404 "Broadcast not found" for
// any non-owner (anti-enumeration by design, not a bug).
export const ACTIONS = [
  {
    name: "hold",
    method: "PATCH",
    routeFile: "app/api/display-engine/hold/route.ts",
    path: "/api/display-engine/hold",
    body: (state) => ({ eventId: state.eventId, displayType: FIXTURE_DISPLAY_TYPE, active: true }),
    readback: (db, state) => checked(db.from("display_type_state").select("hold").eq("event_id", state.eventId).eq("display_type", FIXTURE_DISPLAY_TYPE).maybeSingle(), "reading hold readback"),
    ownerExpect: 200,
    deniedExpect: 403,
  },
  {
    name: "timer",
    method: "PATCH",
    routeFile: "app/api/display-engine/timer/route.ts",
    path: "/api/display-engine/timer",
    body: (state) => ({ eventId: state.eventId, displayType: FIXTURE_DISPLAY_TYPE, action: "setMode", mode: "countdown" }),
    readback: (db, state) => checked(db.from("display_type_state").select("timer").eq("event_id", state.eventId).eq("display_type", FIXTURE_DISPLAY_TYPE).maybeSingle(), "reading timer readback"),
    ownerExpect: 200,
    deniedExpect: 403,
  },
  {
    name: "speaker-ready",
    method: "PATCH",
    routeFile: "app/api/display-engine/speaker-ready/route.ts",
    path: "/api/display-engine/speaker-ready",
    body: (state) => ({ eventId: state.eventId, programId: `${FIXTURE_NAME_PREFIX}-program`, ready: true }),
    readback: (db, state) => checked(db.from("display_state").select("speaker_ready").eq("event_id", state.eventId).maybeSingle(), "reading speaker_ready readback"),
    ownerExpect: 200,
    deniedExpect: 403,
  },
  {
    name: "dismiss",
    method: "POST",
    routeFile: "app/api/display-engine/broadcasts/[id]/dismiss/route.ts",
    path: (state) => `/api/display-engine/broadcasts/${state.broadcastId}/dismiss`,
    body: (state) => ({ eventId: state.eventId }),
    readback: (db, state) => checked(db.from("display_broadcasts").select("dismissed_at").eq("id", state.broadcastId).maybeSingle(), "reading dismissed_at readback"),
    ownerExpect: 200,
    deniedExpect: 404,
  },
];

/**
 * Real, bounded HTTP assertions against a running dev server, covering the
 * full owner/editor/viewer matrix across hold, timer, speaker-ready, and
 * dismissal of the real fixture broadcast (Codex B004 review, B004-S3). For
 * every action: the owner's success is proven by an independent before/after
 * DB readback (not a status-code assumption), and every denied identity's
 * attempt is proven to have caused ZERO mutation via the same before/after
 * comparison — both using the service-role `db` client directly, which is
 * independent of the HTTP session-cookie mechanism (the one piece this
 * script does not fabricate — see `getSessionCookie` below).
 * `getSessionCookie` is an injected seam: tests supply a fake; real use
 * requires a verified session-cookie source (see this file's header
 * "Obtaining a real session"). Every assertion's `pass` is aggregated into
 * an overall `ok`; `main()` below exits non-zero when any assertion fails.
 * @param {{
 *   baseUrl: string,
 *   state: { eventId: string, broadcastId: string },
 *   db?: any,
 *   getSessionCookie?: (email: string) => Promise<string>,
 *   fetchImpl?: (url: string, init: RequestInit & { redirect?: string }) => Promise<{ status: number }>,
 * }} opts
 */
export async function runMatrix({
  baseUrl,
  state,
  db,
  getSessionCookie = async (email) => cookieFromEnv(email),
  fetchImpl = fetch,
}) {
  assertLocalDevOrigin(baseUrl);

  async function call(method, path, body, email) {
    const cookie = await getSessionCookie(email);
    return fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
      redirect: "manual", // never follow a redirect with an authenticated cookie attached to an unvalidated destination
    });
  }

  const identities = [
    { label: "owner", email: OWNER_EMAIL, isOwner: true },
    { label: "editor", email: EDITOR_EMAIL, isOwner: false },
    { label: "viewer", email: VIEWER_EMAIL, isOwner: false },
  ];

  const results = [];

  for (const identity of identities) {
    for (const action of ACTIONS) {
      const expect = identity.isOwner ? action.ownerExpect : action.deniedExpect;
      const path = typeof action.path === "function" ? action.path(state) : action.path;

      const before = db ? await action.readback(db, state) : null;
      const res = await call(action.method, path, action.body(state), identity.email);
      const after = db ? await action.readback(db, state) : null;

      const statusPass = res.status === expect;
      let mutationPass = true;
      let mutationNote;
      if (db) {
        const changed = JSON.stringify(before) !== JSON.stringify(after);
        if (identity.isOwner) {
          mutationPass = changed;
          mutationNote = changed ? "persisted (independent readback, not a status-code assumption)" : "owner call reported success but the DB row did not change";
        } else {
          mutationPass = !changed;
          mutationNote = changed ? "DENIED identity's call still mutated the row — this is the bug this matrix exists to catch" : "no mutation (before/after byte-identical)";
        }
      }

      results.push({
        identity: identity.label,
        action: action.name,
        expected: expect,
        actual: res.status,
        pass: statusPass && mutationPass,
        ...(db ? { mutation: mutationNote } : {}),
      });
    }
  }

  const ok = results.every((r) => r.pass);
  return { ok, results };
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
    if (!result.ok || result.state.phase !== "complete") throw new Error(`No completed fixture state found — run setup first. (${result.ok ? result.state.phase : result.reason})`);
    const { ok, results } = await runMatrix({ baseUrl, state: result.state, db });
    console.log(JSON.stringify(results, null, 2));
    if (!ok) {
      console.error(`FAILED: ${results.filter((r) => !r.pass).length} of ${results.length} assertions did not match expected status.`);
      process.exit(1);
    }
    console.log("All assertions passed.");
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

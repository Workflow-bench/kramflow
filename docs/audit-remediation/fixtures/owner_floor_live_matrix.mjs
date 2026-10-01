#!/usr/bin/env node
// Reusable, bounded live-fixture script for the owner/editor/viewer authorization
// matrix used across KF-001/KF-003's live evidence in B002/B003.
//
// Scope and boundary (read before running):
// - Targets ONLY the dev Supabase project already authorized for this work
//   (qofggbarsdiovzqwgkpz.supabase.co — see BASELINE.md). Refuses to run against
//   any other NEXT_PUBLIC_SUPABASE_URL as a safety check.
// - Uses ONLY pre-existing, already-authorized .test-TLD fixture accounts
//   (demo1@kramflow.test as owner, phase1-viewer-test@kramflow.test,
//   phase1-editor-test@kramflow.test) and a disposable event/credential row it
//   creates and deletes itself. It does NOT create new auth accounts, does NOT
//   send real email, and does NOT touch the KF-002 flagged must_change_password
//   scenario (that fixture remains explicitly blocked — see DECISIONS.md and the
//   B003 pending-authorization request in batches/B003/BATCH_REPORT.md).
// - `setup`, `run`, and `cleanup` are separate, idempotent commands so a failed
//   run never leaves orphaned state silently: `cleanup` is safe to call even if
//   `setup` partially failed.
//
// Usage:
//   node --env-file=.env.local docs/audit-remediation/fixtures/owner_floor_live_matrix.mjs setup
//   node --env-file=.env.local docs/audit-remediation/fixtures/owner_floor_live_matrix.mjs run
//   node --env-file=.env.local docs/audit-remediation/fixtures/owner_floor_live_matrix.mjs cleanup
//
// Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in the environment
// (already present in .env.local for this project; never printed by this script).

import { createClient } from "@supabase/supabase-js";

const ALLOWED_PROJECT_HOST = "qofggbarsdiovzqwgkpz.supabase.co";
const OWNER_EMAIL = "demo1@kramflow.test";
const VIEWER_EMAIL = "phase1-viewer-test@kramflow.test";
const EDITOR_EMAIL = "phase1-editor-test@kramflow.test";
const STATE_FILE = new URL("./.owner_floor_live_matrix.state.json", import.meta.url);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}. Run with --env-file=.env.local.`);
  return v;
}

function assertAllowedProject(url) {
  if (!url.includes(ALLOWED_PROJECT_HOST)) {
    throw new Error(
      `Refusing to run: NEXT_PUBLIC_SUPABASE_URL does not point at the authorized dev project (${ALLOWED_PROJECT_HOST}). ` +
      `This script must never run against production or an unreviewed project.`
    );
  }
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  assertAllowedProject(url);
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const cmd = process.argv[2];
  if (!["setup", "run", "cleanup"].includes(cmd)) {
    console.error("Usage: owner_floor_live_matrix.mjs <setup|run|cleanup>");
    process.exit(1);
  }

  if (cmd === "setup") {
    const { data: users, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) throw listErr;
    const owner = users.users.find((u) => u.email === OWNER_EMAIL);
    const viewer = users.users.find((u) => u.email === VIEWER_EMAIL);
    const editor = users.users.find((u) => u.email === EDITOR_EMAIL);
    for (const [label, u] of [["owner", owner], ["viewer", viewer], ["editor", editor]]) {
      if (!u) throw new Error(`Expected pre-existing fixture account for ${label} (${label === "owner" ? OWNER_EMAIL : label === "viewer" ? VIEWER_EMAIL : EDITOR_EMAIL}) not found. This script does not create new auth accounts.`);
    }

    const { data: event, error: eventErr } = await admin
      .from("events")
      .insert({ name: "B003 live-matrix fixture event", owner_id: owner.id })
      .select("id")
      .single();
    if (eventErr) throw eventErr;

    await admin.from("event_collaborators").insert([
      { event_id: event.id, user_id: viewer.id, role: "viewer", status: "accepted" },
      { event_id: event.id, user_id: editor.id, role: "editor", status: "accepted" },
    ]);

    const state = { eventId: event.id, ownerId: owner.id, viewerId: viewer.id, editorId: editor.id };
    await import("node:fs/promises").then((fs) => fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2)));
    console.log("setup complete:", state);
    return;
  }

  if (cmd === "run") {
    const fs = await import("node:fs/promises");
    const state = JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
    console.log(
      "Fixture ready for event", state.eventId,
      "— drive the HTTP matrix (hold/timer/speaker-ready/broadcast-dismiss) against a real dev server",
      "using session cookies for", OWNER_EMAIL, VIEWER_EMAIL, EDITOR_EMAIL,
      "exactly as documented in batches/B002/TEST_RESULTS.json#live_verification;",
      "this command intentionally does not drive the browser itself — see DECISIONS.md for why live HTTP",
      "verification is done interactively, not scripted end-to-end, in this project."
    );
    return;
  }

  if (cmd === "cleanup") {
    const fs = await import("node:fs/promises");
    let state;
    try {
      state = JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
    } catch {
      console.log("No state file found — nothing to clean up.");
      return;
    }
    await admin.from("event_collaborators").delete().eq("event_id", state.eventId);
    await admin.from("events").delete().eq("id", state.eventId);
    await fs.rm(STATE_FILE, { force: true });
    console.log("cleanup complete for event", state.eventId);
    return;
  }
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});

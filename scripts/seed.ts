// One-time (or re-run-as-needed) initial data load: parses
// data/cue-sheet.xlsx with lib/parse-cuesheet.ts and upserts the result into
// Supabase. Run with `npm run seed`. Requires NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local is loaded
// automatically by tsx via --env-file if present, or export them manually).
//
// Not part of predev/prebuild anymore — the cue sheet is dynamic runtime
// data now (Supabase), not a build artifact. See docs/ROADMAP.md and the
// restructure plan for why.

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";

config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

import { parseCueSheet } from "../lib/parse-cuesheet";
import { supabaseAdmin } from "../lib/supabase/server";

async function main() {
  const filePath = path.join(process.cwd(), "data", "cue-sheet.xlsx");
  const buffer = readFileSync(filePath);
  const { sessions, partitions, programs } = parseCueSheet(buffer);

  const supabase = supabaseAdmin();

  const { error: sessionsError } = await supabase.from("sessions").upsert(sessions, { onConflict: "id" });
  if (sessionsError) throw sessionsError;

  // Replace this session's programs wholesale rather than upserting by a
  // synthetic id — the parser doesn't assign stable per-row ids (order can
  // shift between spreadsheet edits). replace_session_programs (supabase/
  // schema.sql) does the delete + insert atomically in one transaction, so
  // a failure partway through can't leave a session with zero programs.
  const sessionIds = [...new Set(programs.map((p) => p.session_id))];
  const { error: replaceError } = await supabase.rpc("replace_session_programs", {
    p_session_ids: sessionIds,
    p_partitions: partitions,
    p_programs: programs,
  });
  if (replaceError) throw replaceError;

  // Only set a default active session if live_state has none yet — never
  // clobber an operator's actual live progress on a re-seed.
  const { data: liveState, error: liveStateError } = await supabase
    .from("live_state")
    .select("active_session_id")
    .eq("id", 1)
    .single();
  if (liveStateError) throw liveStateError;
  if (!liveState.active_session_id && sessions[0]) {
    const { error } = await supabase
      .from("live_state")
      .update({ active_session_id: sessions[0].id })
      .eq("id", 1);
    if (error) throw error;
  }

  console.log(`[seed] wrote ${sessions.length} sessions, ${programs.length} programs`);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});

// One-time unblock for operators who signed up while Supabase couldn't
// actually deliver the confirmation email (see the email/SMTP setup note in
// .env.example and docs/DEPLOYMENT.md's auth section) — they have real
// accounts with a password, but auth.users.email_confirmed_at is null, so
// signInWithPassword() correctly refuses them with "Email not confirmed"
// forever, since the link that would set it never reached their inbox.
//
// This calls the Supabase Auth *admin* API to mark every currently
// unconfirmed user confirmed, bypassing the need for the email link. It
// requires a REAL service_role key — the admin API rejects any other key
// with "User not allowed" (401/403), including an anon key even when RLS is
// wide open, because admin auth endpoints check the key's role claim, not
// table policies. Get the real key from Supabase Dashboard -> Project
// Settings -> API -> service_role (or reveal it), and put it in
// SUPABASE_SERVICE_ROLE_KEY in .env.local before running.
//
// Run once with `npx tsx scripts/confirm-existing-users.ts`. Safe to
// re-run — already-confirmed users are skipped.

import { config } from "dotenv";
import path from "node:path";

config({ path: path.join(process.cwd(), ".env.local"), quiet: true });

import { supabaseAdmin } from "../lib/supabase/server";

async function main() {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Couldn't list users — is SUPABASE_SERVICE_ROLE_KEY a real service_role key?", error.message);
    process.exit(1);
  }

  const unconfirmed = data.users.filter((u) => !u.email_confirmed_at);
  if (unconfirmed.length === 0) {
    console.log("No unconfirmed users found. Nothing to do.");
    return;
  }

  console.log(`Confirming ${unconfirmed.length} user(s):`);
  for (const user of unconfirmed) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });
    if (updateError) {
      console.error(`  FAILED ${user.email}: ${updateError.message}`);
    } else {
      console.log(`  confirmed ${user.email}`);
    }
  }
}

main();

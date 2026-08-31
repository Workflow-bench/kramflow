import { test, expect } from "@playwright/test";

// Real end-to-end smoke test against the actual running dev server and a
// real Supabase project — no mocking. Requires a provisioned test account:
// run `node --env-file=.env.local scripts/provision-test-account.mjs`
// once locally first (writes .env.test.local, gitignored). Skips itself
// with a clear message rather than failing CI/local runs for everyone
// when that hasn't been done yet.
const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Free-tier accounts are capped at 3 events (lib/server/plan-limits.ts) —
// a real, correct limit, not a bug. Since this test reuses the same
// account run after run, it has to clean up its own events first or it
// eventually hits that cap and every subsequent run fails with a 403 that
// has nothing to do with what the test is actually checking. Uses the
// service-role key directly (same credentials already required for this
// spec to run at all) rather than the UI, so cleanup doesn't depend on
// the very create/delete flow being tested.
async function deleteAllEventsForTestAccount() {
  const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}` },
  });
  const { users } = await usersRes.json();
  const user = users.find((u: { email?: string }) => u.email?.toLowerCase() === email);
  if (!user) return;
  await fetch(`${supabaseUrl}/rest/v1/events?owner_id=eq.${user.id}`, {
    method: "DELETE",
    headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey}`, Prefer: "return=minimal" },
  });
}

test.describe("auth golden path", () => {
  test.skip(
    !email || !password,
    "E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — run scripts/provision-test-account.mjs first (see e2e/README.md)"
  );
  test.skip(!supabaseUrl || !serviceKey, "NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — needed to reset the test account's events before each run");

  test.beforeEach(async () => {
    await deleteAllEventsForTestAccount();
  });

  test("login -> dashboard -> create event -> logout -> redirected to login", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(email!);
    await page.locator("#password").fill(password!);
    await page.getByRole("button", { name: "Log In" }).click();

    await page.waitForURL("/dashboard");
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

    const eventName = `E2E Test Event ${Date.now()}`;
    await page.getByLabel("New event name").fill(eventName);
    const createResponse = page.waitForResponse(
      (res) => res.url().endsWith("/api/events") && res.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Create Event" }).click();

    // Wait for the actual write to complete (not a UI guess) before
    // asserting anything. A brand-new operator's *first-ever* event then
    // auto-navigates them into that event's own console
    // (components/dashboard/events-dashboard.tsx handleCreate) instead of
    // staying on the dashboard list — confirmed by actually running this
    // test against the live app. Since this test reuses the same account
    // across runs, only the very first run hits that branch; regardless
    // of which branch fires, the dashboard's own events list is the one
    // durable place to confirm the event actually persisted, so go there
    // directly rather than trying to detect which branch happened.
    const response = await createResponse;
    expect(response.ok(), `POST /api/events -> ${response.status()}: ${await response.text()}`).toBe(true);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: eventName })).toBeVisible();

    await page.getByRole("button", { name: "Log Out" }).click();
    await page.waitForURL("/login");

    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
  });
});

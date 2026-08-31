import { test, expect } from "@playwright/test";

// Real end-to-end smoke test against the actual running dev server and a
// real Supabase project — no mocking. Requires a provisioned test account:
// run `node --env-file=.env.local scripts/provision-test-account.mjs`
// once locally first (writes .env.test.local, gitignored). Skips itself
// with a clear message rather than failing CI/local runs for everyone
// when that hasn't been done yet.
const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

test.describe("auth golden path", () => {
  test.skip(
    !email || !password,
    "E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set — run scripts/provision-test-account.mjs first (see e2e/README.md)"
  );

  test("login -> dashboard -> create event -> logout -> redirected to login", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(email!);
    await page.locator("#password").fill(password!);
    await page.getByRole("button", { name: "Log In" }).click();

    await page.waitForURL("/dashboard");
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

    const eventName = `E2E Test Event ${Date.now()}`;
    await page.getByLabel("New event name").fill(eventName);
    await page.getByRole("button", { name: "Create Event" }).click();

    // A brand-new operator's *first-ever* event auto-navigates them into
    // that event's own console (components/dashboard/events-dashboard.tsx
    // handleCreate) instead of staying on the dashboard list — confirmed
    // by actually running this test and inspecting the real page, not
    // assumed from reading the code. Since this test reuses the same
    // account across runs, only the very first run hits that branch;
    // later runs already have events and stay on the dashboard — handle
    // both rather than assuming one.
    await Promise.race([
      page.waitForURL(/\/e\/[0-9a-f-]+\/operator/),
      expect(page.getByRole("heading", { name: eventName })).toBeVisible({ timeout: 10_000 }),
    ]);

    // Either way, the dashboard's own events list is the durable place to
    // confirm the event actually persisted.
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: eventName })).toBeVisible();

    await page.getByRole("button", { name: "Log Out" }).click();
    await page.waitForURL("/login");

    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
  });
});

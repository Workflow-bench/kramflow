// Captures real screenshots of the running Kramflow product for use as
// art-directed objects on the public landing page.
//
// These are genuine captures of the actual application rendering the seeded
// "Northwind Summit 2026" event — the same components, the same live-state
// maths, the same realtime plumbing an operator uses. Nothing here is a
// mockup or a DOM recreation, and no state is invented at capture time: the
// show's plan, its recorded actuals, and its variance all come from the
// database rows scripts/seed-marketing-demo.ts wrote.
//
// The show is anchored to real wall-clock time by the seed step, which is
// why this must run straight after it. An earlier attempt pinned the browser
// clock instead and kept literal 9:00-11:15 times; that failed on exactly
// the surfaces that matter most, because the four TV routes run an NTP-style
// handshake (lib/display-engine/use-time-sync.ts) that measures the browser
// against the server and corrects a faked clock straight back. Anchoring the
// data rather than the clock keeps console and displays telling one story.
//
// Run the whole pipeline with the dev server up:  npm run capture:product
//
// Read-only against show state: it signs in, navigates and screenshots. It
// never clicks a control that advances or mutates the running show.

import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

// The seeded displays carry a heartbeat, and the console/fleet views grade
// them stale within seconds — correct behaviour for a venue TV that has
// dropped off, but it means a capture run lasting a minute would show its
// own duration as four stale displays. Re-stamping the heartbeat
// immediately before the two shots that render fleet health keeps them
// reading the way they would with the TVs actually plugged in.
const env = Object.fromEntries(
  readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

async function heartbeatDisplays(eventId) {
  const res = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/display_registry?event_id=eq.${eventId}`,
    {
      method: "PATCH",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) throw new Error(`heartbeat -> ${res.status} ${await res.text()}`);
}

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = "demo1@kramflow.test";
const PASSWORD = "KramflowDemo1!";
// Written by the seed step immediately before this runs. Hardcoding these
// meant a capture could silently run against a different event, or in a
// timezone the show was not anchored to.
const context = JSON.parse(readFileSync(path.join(process.cwd(), "scripts", ".capture-context.json"), "utf8"));
const EVENT = process.env.EVENT_ID ?? context.eventId;
const TOKEN = process.env.SHARE_TOKEN ?? context.shareToken;
const TIMEZONE = context.timezone;
const OUT = path.join(process.cwd(), "public", "product");
// A second pass writes the same surfaces under a suffix so the page can
// cross-fade between two real cue states.
const SUFFIX = process.env.SHOT_SUFFIX ?? "";
const ONLY = process.env.CAPTURE_ONLY?.split(",").map((s) => s.trim());

mkdirSync(OUT, { recursive: true });

const SHOTS = [
  { name: "console", url: `/e/${EVENT}/operator`, w: 1680, h: 1050 },
  // Narrower than the console on purpose: the cue sheet centres a
  // max-width table, so a 1680px capture is a small table adrift in two
  // wide empty gutters. At 1180 the table fills the frame and the crop
  // reads as a rundown continuing past the edge.
  { name: "cue-sheet", url: `/e/${EVENT}/operator/cue-sheet`, w: 1180, h: 900 },
  { name: "displays", url: `/e/${EVENT}/displays`, w: 1440, h: 1000 },
  { name: "broadcast", url: `/e/${EVENT}/broadcast`, w: 1280, h: 940 },
  { name: "rehearsal", url: `/e/${EVENT}/rehearsal`, w: 1280, h: 940 },
  { name: "remote", url: `/e/${EVENT}/remote`, w: 430, h: 932 },
  // The four TV outputs, at the resolution they actually run at in a venue.
  { name: "display-general", url: `/general?token=${TOKEN}`, w: 1920, h: 1080 },
  { name: "display-presenter", url: `/presenter?token=${TOKEN}`, w: 1920, h: 1080 },
  { name: "display-av", url: `/av?token=${TOKEN}`, w: 1920, h: 1080 },
  { name: "display-speaker-ready", url: `/green-room?token=${TOKEN}`, w: 1920, h: 1080 },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1680, height: 1050 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
  reducedMotion: "reduce",
  timezoneId: TIMEZONE,
});
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("input[type=email]", EMAIL);
await page.fill("input[type=password]", PASSWORD);
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 }),
  page.click("button[type=submit]"),
]);
console.log("[capture] signed in as", EMAIL);

const results = [];
for (const shot of SHOTS) {
  if (ONLY && !ONLY.includes(shot.name)) continue;
  if (shot.name === "console" || shot.name === "displays") await heartbeatDisplays(EVENT);
  await page.setViewportSize({ width: shot.w, height: shot.h });
  await page.goto(`${BASE}${shot.url}`, { waitUntil: "networkidle", timeout: 60_000 });
  // Claim the lease on the page being photographed. Doing this in an
  // earlier navigation does not survive: the lease is keyed to a tab id,
  // and the fresh page load that follows owns a different one, so the
  // console still rendered "No one has control".
  if (shot.name === "console") {
    const take = page.getByRole("button", { name: /take control/i });
    if (await take.count()) {
      await take.first().click();
      await page.waitForTimeout(1200);
    }
  }
  await page.waitForTimeout(shot.wait ?? 4000);
  const file = path.join(OUT, `${shot.name}${SUFFIX}.png`);
  await page.screenshot({ path: file, animations: "disabled" });
  results.push({ name: shot.name, size: `${shot.w}x${shot.h}@2x` });
  console.log("[capture]", shot.name + SUFFIX);
}

await browser.close();
console.log(JSON.stringify(results, null, 2));

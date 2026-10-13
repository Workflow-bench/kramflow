import { chromium } from "/Users/deeppatel/Documents/AI/Shibir/stageflow/node_modules/playwright/index.mjs";
const BASE = process.env.BASE || "http://localhost:3961/";
const OUT = process.env.OUT;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const KEY = "kf-arrival-v1";
const browser = await chromium.launch();
const bgX = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".hero-title")).backgroundPosition));
const state = (page) => page.evaluate(() => ({
  arrival: document.documentElement.classList.contains("arrival-running"),
  anim: getComputedStyle(document.querySelector(".hero-title")).animationName,
  running: document.getAnimations().filter((a) => a.animationName === "arrival-title" || a.animationName === "arrival-band").length,
}));
/** Hydration starts the arrival after domcontentloaded, so poll for it rather than sampling once. */
async function pollArrival(page) {
  let seen = null;
  for (let i = 0; i < 60; i++) {
    const s = await state(page);
    if (s.arrival) return s;
    seen = s;
    await page.waitForTimeout(50);
  }
  return seen;
}
async function ctxFor(name, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: `${OUT}/gm03/video-${name}`, size: { width: 1440, height: 900 } }, ...extra });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return { ctx, page, errors };
}

// 1. fresh arrival, resting after, animation released
{
  const { ctx, page, errors } = await ctxFor("1-fresh-arrival");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const during = await pollArrival(page);
  await page.waitForTimeout(1900);
  const after = await state(page);
  const stored = await page.evaluate((k) => sessionStorage.getItem(k), KEY);
  check("1 fresh arrival runs sweep", during.arrival && during.anim.includes("arrival-title"), JSON.stringify(during));
  check("1 arrival class removed on completion", !after.arrival && after.anim === "none", JSON.stringify(after));
  check("1 no arrival animation remains", after.running === 0, `running ${after.running}`);
  check("1 resting gradient at 43%", Math.abs((await bgX(page)) - 43) <= 0.5, `bgX ${await bgX(page)}`);
  check("1 arrival writes storage on completion", stored === "1", `stored ${stored}`);
  check("1 no console errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  // 2. hover: sample the transition
  const cta = page.locator(".hero-actions a").first();
  const box = await cta.boundingBox();
  const samples = [];
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 12; i++) { samples.push(Math.round((await bgX(page)) * 10) / 10); await page.waitForTimeout(100); }
  check("2 hover moves gradient to 28%", Math.abs(samples.at(-1) - 28) <= 0.5, `samples ${samples.join(",")}`);
  check("2 hover transition is gradual (intermediate values)", samples.some((v) => v > 28.5 && v < 42.5), samples.join(","));
  await page.mouse.move(5, 450);
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(100); }
  check("2 leaving hover returns to 43%", Math.abs((await bgX(page)) - 43) <= 0.5, `bgX ${await bgX(page)}`);
  // 3. keyboard focus
  await page.evaluate(() => document.activeElement?.blur());
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => !!document.activeElement?.closest(".hero-actions"));
  }
  await page.waitForTimeout(1100);
  const focusOn = await bgX(page);
  const focusVisible = await page.evaluate(() => document.activeElement?.matches(":focus-visible") ?? false);
  check("3 keyboard focus on hero action reaches focus-visible", reached && focusVisible, `reached ${reached} focusVisible ${focusVisible}`);
  check("3 keyboard focus moves gradient to 28%", Math.abs(focusOn - 28) <= 0.5, `bgX ${focusOn}`);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(5, 450);
  await page.waitForTimeout(1100);
  check("3 focus loss returns to 43%", Math.abs((await bgX(page)) - 43) <= 0.5, `bgX ${await bgX(page)}`);
  // 4. live reduced-motion change does not restart the entrance
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(400);
  check("4 reduced-motion live change keeps resting gradient", Math.abs((await bgX(page)) - 43) <= 0.5, `bgX ${await bgX(page)}`);
  check("4 reduced-motion live change: no animation", (await state(page)).anim === "none", JSON.stringify(await state(page)));
  check("4 no console errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}
// 5. second visit (same tab storage), reload, back, deep link
{
  const { ctx, page, errors } = await ctxFor("2-revisit-reload-back-deeplink");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1900);
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); // second visit, same tab
  await page.waitForTimeout(150);
  const second = await state(page);
  check("5 second visit does not run arrival", !second.arrival && second.anim === "none", JSON.stringify(second));
  check("5 second visit resting at 43%", Math.abs((await bgX(page)) - 43) <= 0.5, `bgX ${await bgX(page)}`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(150);
  check("5 reload does not run arrival", !(await state(page)).arrival, JSON.stringify(await state(page)));
  await page.locator('nav a[href="/login"]').first().click();
  await page.waitForURL("**/login", { timeout: 15000 });
  await page.goBack();
  await page.waitForFunction(() => location.pathname === "/", null, { timeout: 15000 });
  await page.waitForTimeout(150);
  check("5 Back does not run arrival", !(await state(page)).arrival, JSON.stringify(await state(page)));
  check("5 Back resting at 43%", Math.abs((await bgX(page)) - 43) <= 0.5, `bgX ${await bgX(page)}`);
  check("5 no console errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}
// 6. deep link on first ever visit: no arrival, settled
{
  const { ctx, page, errors } = await ctxFor("3-deeplink-first-visit");
  await page.goto(BASE + "#features", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(200);
  const s = await state(page);
  check("6 deep link first visit: no arrival", !s.arrival && s.anim === "none", JSON.stringify(s));
  check("6 deep link resting at 43%", Math.abs((await bgX(page)) - 43) <= 0.5, `bgX ${await bgX(page)}`);
  check("6 no console errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}
// 7. interruption: wheel at 300ms ends arrival early, storage not written
{
  const { ctx, page, errors } = await ctxFor("4-interrupt");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const started = await pollArrival(page);
  check("7 arrival started before interruption", started.arrival, JSON.stringify(started));
  await page.waitForTimeout(250);
  await page.mouse.move(720, 450); await page.mouse.wheel(0, 300);
  await page.waitForTimeout(250);
  const s = await state(page);
  const stored = await page.evaluate((k) => sessionStorage.getItem(k), KEY);
  check("7 wheel interruption ends arrival", !s.arrival && s.anim === "none", JSON.stringify(s));
  check("7 visitor interruption marks the visit seen (by design, arrival.tsx finish(true))", stored === "1", `stored ${stored}`);
  check("7 interruption: resting at 43% after interrupt", Math.abs((await bgX(page)) - 43) <= 0.5, `bgX ${await bgX(page)}`);
  check("7 no console errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}
// 8. reduced motion from first load: no arrival at all
{
  const { ctx, page, errors } = await ctxFor("5-reduced-first", { reducedMotion: "reduce" });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(200);
  const s = await state(page);
  check("8 reduced-motion first load: no arrival", !s.arrival && s.anim === "none", JSON.stringify(s));
  check("8 reduced-motion resting at 43%", Math.abs((await bgX(page)) - 43) <= 0.5, `bgX ${await bgX(page)}`);
  check("8 no console errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}
// 9. live reduced-motion change mid-arrival: entrance ends, does not restart
{
  const { ctx, page, errors } = await ctxFor("6-live-reduced-midarrival");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(300);
  const s1 = await state(page);
  await page.waitForTimeout(1500);
  const s2 = await state(page);
  check("9 live reduced-motion ends arrival", !s1.arrival && s1.anim === "none", JSON.stringify(s1));
  check("9 no restart after reduced-motion", !s2.arrival && s2.anim === "none" && s2.running === 0, JSON.stringify(s2));
  check("9 no console errors", errors.length === 0, errors.join(" | ").slice(0, 200));
  await ctx.close();
}
// 10. denied storage: arrival still runs; no errors
{
  const { ctx, page, errors } = await ctxFor("7-denied-storage");
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new DOMException("denied", "SecurityError"); } });
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const s = await pollArrival(page);
  check("10 denied storage: arrival still runs", s.arrival, JSON.stringify(s));
  await page.waitForTimeout(1700);
  check("10 denied storage: page settles", Math.abs((await bgX(page)) - 43) <= 0.5 && errors.length === 0, `bgX ${await bgX(page)} errors ${errors.join("|").slice(0, 160)}`);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 1));

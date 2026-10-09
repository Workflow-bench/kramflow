import { chromium } from "/Users/deeppatel/Documents/AI/Shibir/stageflow/node_modules/playwright/index.mjs";
const BASE = process.env.BASE || "http://localhost:3961/";
const OUT = process.env.OUT;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const browser = await chromium.launch();

const state = (page) => page.evaluate(() => {
  const overlay = document.querySelector(".loading-screen");
  const word = document.querySelector("[data-loading-word]");
  const cs = overlay ? getComputedStyle(overlay) : null;
  let scaleY = null;
  if (cs && cs.transform && cs.transform !== "none") {
    try { scaleY = new DOMMatrix(cs.transform).m22; } catch { scaleY = null; }
  } else if (cs) scaleY = 1;
  return {
    overlayOpacity: cs?.opacity ?? null,
    overlayScaleY: scaleY,
    arrivalRunning: document.documentElement.classList.contains("arrival-running"),
    arrivalBoot: document.documentElement.classList.contains("arrival-boot"),
    wordText: word?.textContent ?? null,
    wordOpacity: word ? getComputedStyle(word).opacity : null,
  };
});

// 1. Fresh visit: track the word sequence and total duration
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: `${OUT}/video-fresh-load-v2`, size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const samples = [];
  let settledAt = null, sawRunning = false;
  for (let i = 0; i < 150; i++) {
    const s = await state(page);
    samples.push({ t: Date.now() - t0, ...s });
    if (s.arrivalRunning) sawRunning = true;
    if (sawRunning && settledAt === null && !s.arrivalRunning && s.overlayOpacity === "0") settledAt = Date.now() - t0;
    if (settledAt !== null && Date.now() - t0 - settledAt > 300) break;
    await page.waitForTimeout(30);
  }
  const wordsSeen = [...new Set(samples.filter((s) => parseFloat(s.wordOpacity) > 0.5).map((s) => s.wordText))];
  const curtainClosed = samples.some((s) => s.overlayScaleY !== null && s.overlayScaleY < 0.15);
  const coveredFromStart = samples[0]?.arrivalBoot === true || samples[0]?.overlayOpacity !== "0";
  check("1 overlay covers from the very first sample (no hero flash)", coveredFromStart, JSON.stringify(samples[0]));
  check("1 all 4 words appear in sequence, in order", JSON.stringify(wordsSeen) === JSON.stringify(["Plan", "Preview", "Rehearse", "Live"]), JSON.stringify(wordsSeen));
  check("1 curtain collapses (scaleY -> ~0) before settling", curtainClosed, "min scaleY " + Math.min(...samples.filter((s) => s.overlayScaleY !== null).map((s) => s.overlayScaleY)));
  check("1 settles: class removed, overlay invisible", settledAt !== null, `settledAt ${settledAt}ms`);
  check("1 total duration (informational, measured not enforced)", true, `settledAt ${settledAt}ms`);
  await page.waitForTimeout(300);
  const eyebrow = await page.evaluate(() => document.querySelector(".hero-eyebrow")?.textContent);
  const stored = await page.evaluate(() => sessionStorage.getItem("kf-arrival-v1"));
  check("1 real hero eyebrow intact after wipe", eyebrow === "Live event operations", eyebrow);
  check("1 storage written on completion", stored === "1", `stored ${stored}`);
  check("1 no console errors", errors.length === 0, errors.join("|").slice(0, 300));
  console.error("DURATION", settledAt);
  await ctx.close();
}
// 2. repeat visit: no loading screen (generous wait past the full sequence)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  const s = await state(page);
  check("2 repeat visit: no loading screen", s.overlayOpacity === "0" && !s.arrivalRunning && !s.arrivalBoot, JSON.stringify(s));
  await ctx.close();
}
// 3. deep link: no loading screen, scroll not hijacked
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "#features", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  const top = await page.evaluate(() => document.getElementById("features").getBoundingClientRect().top);
  const s = await state(page);
  check("3 deep link: no loading screen", s.overlayOpacity === "0" && !s.arrivalBoot, JSON.stringify(s));
  check("3 deep link: lands at target", Math.abs(top - 88) <= 4, `top ${Math.round(top)}`);
  await ctx.close();
}
// 4. interruption mid-sequence
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900); // mid-sequence
  const beforeInterrupt = await state(page);
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(500);
  const after = await state(page);
  const stored = await page.evaluate(() => sessionStorage.getItem("kf-arrival-v1"));
  check("4 was mid-sequence before interrupt", beforeInterrupt.arrivalRunning, JSON.stringify(beforeInterrupt));
  check("4 interruption releases overlay (not stuck)", after.overlayOpacity === "0" && !after.arrivalRunning, JSON.stringify(after));
  check("4 interruption marks visit seen (by design)", stored === "1", `stored ${stored}`);
  const canClickCTA = await page.locator("text=Start free").first().isVisible();
  check("4 real CTA reachable after interrupt", canClickCTA, "");
  check("4 no console errors", errors.length === 0, errors.join("|").slice(0, 300));
  await ctx.close();
}
// 5. reduced motion: settled immediately, no boot cover either
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  const s = await state(page);
  check("5 reduced motion: overlay never shows", s.overlayOpacity === "0" && !s.arrivalRunning && !s.arrivalBoot, JSON.stringify(s));
  await ctx.close();
}
// 6. never blocks input
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const s0 = await state(page);
  const pe = await page.evaluate(() => getComputedStyle(document.querySelector(".loading-screen")).pointerEvents);
  check("6 overlay visible at this point (sanity)", parseFloat(s0.overlayOpacity) > 0.5, JSON.stringify(s0));
  check("6 overlay never captures pointer events", pe === "none", `pointer-events: ${pe}`);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 1));

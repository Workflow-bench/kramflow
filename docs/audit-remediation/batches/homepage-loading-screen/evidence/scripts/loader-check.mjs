import { chromium } from "/Users/deeppatel/Documents/AI/Shibir/stageflow/node_modules/playwright/index.mjs";
const BASE = process.env.BASE || "http://localhost:3975/";
const OUT = process.env.OUT;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const browser = await chromium.launch();

const state = (page) => page.evaluate(() => {
  const overlay = document.querySelector(".loading-screen");
  const cs = overlay ? getComputedStyle(overlay) : null;
  const wordsVisible = [...document.querySelectorAll(".loading-word")].map((w) => ({
    word: w.dataset.word,
    opacity: getComputedStyle(w).opacity,
  }));
  return {
    overlayOpacity: cs?.opacity ?? null,
    overlayScaleY: cs ? new DOMMatrix(cs.transform).m22 : null,
    arrivalRunning: document.documentElement.classList.contains("arrival-running"),
    wordsVisible,
  };
});

// 1. Fresh visit: frame-by-frame capture + total duration measurement
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: `${OUT}/video-fresh-load`, size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const samples = [];
  let settledAt = null;
  let sawRunning = false;
  for (let i = 0; i < 120; i++) {
    const s = await state(page);
    samples.push({ t: Date.now() - t0, ...s });
    if (s.arrivalRunning) sawRunning = true;
    if (sawRunning && settledAt === null && !s.arrivalRunning && s.overlayOpacity === "0") settledAt = Date.now() - t0;
    if (settledAt !== null && Date.now() - t0 - settledAt > 200) break;
    await page.waitForTimeout(40);
  }
  const everShowed = samples.some((s) => parseFloat(s.overlayOpacity) > 0.5);
  const sawEachWord = new Set(samples.filter((s) => parseFloat(s.overlayOpacity) > 0.5).flatMap((s) => s.wordsVisible.filter((w) => parseFloat(w.opacity) > 0.3).map((w) => w.word)));
  const curtainClosed = samples.some((s) => s.overlayScaleY !== null && s.overlayScaleY < 0.1);
  check("1 overlay becomes visible", everShowed, "");
  check("1 all 4 words appear in sequence", ["Plan", "Preview", "Rehearse", "Live"].every((w) => sawEachWord.has(w)), JSON.stringify([...sawEachWord]));
  check("1 curtain collapses (scaleY -> 0) before settling", curtainClosed, "");
  check("1 settles: class removed, overlay invisible", settledAt !== null, `settledAt ${settledAt}ms`);
  check("1 total duration is bounded (<= 2800ms)", settledAt !== null && settledAt <= 2800, `settledAt ${settledAt}ms`);
  await page.waitForTimeout(300);
  const eyebrow = await page.evaluate(() => document.querySelector(".hero-eyebrow")?.textContent);
  const stored = await page.evaluate(() => sessionStorage.getItem("kf-arrival-v1"));
  check("1 real hero eyebrow intact after wipe", eyebrow === "Live event operations", eyebrow);
  check("1 storage written on completion", stored === "1", `stored ${stored}`);
  check("1 no console errors", errors.length === 0, errors.join("|").slice(0, 300));
  console.error("DURATION", settledAt);
  await ctx.close();
}
// 2. repeat visit: no loading screen
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  const s = await state(page);
  check("2 repeat visit: no loading screen", s.overlayOpacity === "0" && !s.arrivalRunning, JSON.stringify(s));
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
  check("3 deep link: no loading screen", s.overlayOpacity === "0", JSON.stringify(s));
  check("3 deep link: lands at target", Math.abs(top - 88) <= 4, `top ${Math.round(top)}`);
  await ctx.close();
}
// 4. interruption mid-sequence: quick fade, no stuck cover, real content reachable
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900); // mid-sequence, before natural completion
  const beforeInterrupt = await state(page);
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(500);
  const after = await state(page);
  const stored = await page.evaluate(() => sessionStorage.getItem("kf-arrival-v1"));
  check("4 was mid-sequence before interrupt", beforeInterrupt.arrivalRunning, JSON.stringify(beforeInterrupt));
  check("4 interruption releases overlay (not stuck)", after.overlayOpacity === "0" && !after.arrivalRunning, JSON.stringify(after));
  check("4 interruption marks visit seen (by design)", stored === "1", `stored ${stored}`);
  // Real content underneath is reachable immediately.
  const canClickCTA = await page.locator("text=Start free").first().isVisible();
  check("4 real CTA reachable after interrupt", canClickCTA, "");
  check("4 no console errors", errors.length === 0, errors.join("|").slice(0, 300));
  await ctx.close();
}
// 5. reduced motion: settled immediately, loading screen never shows
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  const s = await state(page);
  check("5 reduced motion: overlay never shows", s.overlayOpacity === "0" && !s.arrivalRunning, JSON.stringify(s));
  await ctx.close();
}
// 6. loading screen never blocks input (pointer-events: none) even while visible
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700); // overlay should be visible now
  const s0 = await state(page);
  const pe = await page.evaluate(() => getComputedStyle(document.querySelector(".loading-screen")).pointerEvents);
  check("6 overlay visible at this point (sanity)", parseFloat(s0.overlayOpacity) > 0.5, JSON.stringify(s0));
  check("6 overlay never captures pointer events", pe === "none", `pointer-events: ${pe}`);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 1));

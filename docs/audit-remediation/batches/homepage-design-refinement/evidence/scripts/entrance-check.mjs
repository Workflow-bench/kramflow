import { chromium } from "/Users/deeppatel/Documents/AI/Shibir/stageflow/node_modules/playwright/index.mjs";
const BASE = "http://localhost:3975/";
const OUT = process.env.OUT;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const browser = await chromium.launch();

const wordAt = (page) => page.evaluate(() => {
  const track = document.querySelector(".entrance-words-track");
  const opacity = getComputedStyle(document.querySelector(".entrance-words")).opacity;
  const m = track ? getComputedStyle(track).transform : "none";
  return { overlayOpacity: opacity, transform: m };
});

// 1. fresh visit: capture the sequence mid-flight
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: `${OUT}/video-fresh-entrance`, size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const samples = [];
  for (let i = 0; i < 16; i++) { samples.push(await wordAt(page)); await page.waitForTimeout(100); }
  check("1 overlay becomes visible during entrance", samples.some((s) => parseFloat(s.overlayOpacity) > 0.5), JSON.stringify(samples.map((s) => s.overlayOpacity)));
  check("1 overlay cycles through words (transform changes)", new Set(samples.map((s) => s.transform)).size >= 3, JSON.stringify([...new Set(samples.map((s) => s.transform))]));
  await page.waitForTimeout(1600);
  const after = await wordAt(page);
  const eyebrowText = await page.evaluate(() => document.querySelector(".hero-eyebrow:not(.entrance-words)").textContent);
  check("1 overlay released, real label intact", parseFloat(after.overlayOpacity) === 0 && eyebrowText === "Live event operations", JSON.stringify({ after, eyebrowText }));
  const stored = await page.evaluate(() => sessionStorage.getItem("kf-arrival-v1"));
  check("1 storage written on completion", stored === "1", `stored ${stored}`);
  check("1 no console errors", errors.length === 0, errors.join("|").slice(0, 200));
  await ctx.close();
}
// 2. repeat visit in same tab: no entrance
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1600);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(200);
  const s = await wordAt(page);
  check("2 repeat visit: overlay never shows", parseFloat(s.overlayOpacity) === 0, JSON.stringify(s));
  await ctx.close();
}
// 3. deep link: entrance does not take scroll control
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "#features", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  const top = await page.evaluate(() => document.getElementById("features").getBoundingClientRect().top);
  const s = await wordAt(page);
  check("3 deep link: lands on target (top~88)", Math.abs(top - 88) <= 4, `top ${Math.round(top)}`);
  check("3 deep link: entrance did not run", parseFloat(s.overlayOpacity) === 0, JSON.stringify(s));
  await ctx.close();
}
// 4. interruption: wheel mid-sequence ends it early, no stuck overlay
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  await page.mouse.move(700, 400); await page.mouse.wheel(0, 200);
  await page.waitForTimeout(400);
  const s = await wordAt(page);
  const eyebrowVisible = await page.evaluate(() => {
    const r = document.querySelector(".hero-eyebrow:not(.entrance-words)").getBoundingClientRect();
    return r.width > 0;
  });
  check("4 interruption: overlay released (not stuck)", parseFloat(s.overlayOpacity) === 0, JSON.stringify(s));
  check("4 interruption: real label visible underneath", eyebrowVisible, "");
  await ctx.close();
}
// 5. reduced motion: settled immediately, no overlay ever
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(200);
  const s = await wordAt(page);
  const label = await page.evaluate(() => document.querySelector(".hero-eyebrow:not(.entrance-words)").textContent);
  check("5 reduced motion: overlay never shows", parseFloat(s.overlayOpacity) === 0, JSON.stringify(s));
  check("5 reduced motion: real label reads immediately", label === "Live event operations", label);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 1));

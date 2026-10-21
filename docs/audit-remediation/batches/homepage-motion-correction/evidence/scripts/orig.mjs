import { chromium } from "/Users/deeppatel/Documents/AI/Shibir/stageflow/node_modules/playwright/index.mjs";
const BASE = process.env.BASE || "http://localhost:3961/";
const OUT = process.env.OUT;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--enable-unsafe-swiftshader"] });
const DRAW_COUNTER = () => {
  window.__draws = 0;
  for (const fn of ["drawArrays", "drawElements"]) {
    const orig = WebGL2RenderingContext.prototype[fn];
    WebGL2RenderingContext.prototype[fn] = function (...a) { window.__draws++; return orig.apply(this, a); };
  }
};
const draws = (page, ms) => page.evaluate(async (ms) => { const a = window.__draws; await new Promise((r) => setTimeout(r, ms)); return window.__draws - a; }, ms);
const pinState = (page) => page.evaluate(() => ({ spacers: document.querySelectorAll(".pin-spacer").length, smoother: !!document.querySelector("#smooth-content")?.style.transform, motion: document.documentElement.dataset.motion }));

for (const [w, h] of [[1440, 900], [1366, 768], [375, 812], [320, 640]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => ({ vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h1: getComputedStyle(document.querySelector("h1")).fontSize }));
  check(`viewport ${w}x${h} readback ${r.vw}x${r.vh}`, r.vw === w && r.vh === h, JSON.stringify(r));
  check(`viewport ${w}x${h} no horizontal page scroll`, r.sw <= r.cw, `scrollWidth ${r.sw} clientWidth ${r.cw}`);
  check(`viewport ${w}x${h} no page errors`, errs.length === 0, errs.join("|").slice(0, 160));
  await page.screenshot({ path: `${OUT}/orig/viewport-${w}x${h}.png` });
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference", recordVideo: { dir: `${OUT}/orig/video-preferences`, size: { width: 1440, height: 900 } } });
  await ctx.addInitScript(DRAW_COUNTER);
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const visibleDraws = await draws(page, 1000);
  for (let i = 0; i < 10; i++) { await page.mouse.move(720, 450); await page.mouse.wheel(0, 500); await page.waitForTimeout(150); }
  await page.waitForTimeout(1200);
  const offscreenY = await page.evaluate(() => Math.round(scrollY));
  const offscreenDraws = await draws(page, 1000);
  check("shader draws while hero visible", visibleDraws > 0, `draws/s ${visibleDraws}`);
  check("shader suspends while offscreen", offscreenDraws <= Math.max(2, visibleDraws * 0.05), `draws/s offscreen ${offscreenDraws} (scrollY ${offscreenY}) vs visible ${visibleDraws}`);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(800);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(1500);
  const redDraws = await draws(page, 1000);
  const red = await pinState(page);
  check("live reduce: data-motion off (CSS)", red.motion === "off", `motion ${red.motion}`);
  check("live reduce: smoother destroyed (GSAP)", !red.smoother, `transform present ${red.smoother}`);
  check("live reduce: pinned scene released (GSAP)", red.spacers === 0, `pin spacers ${red.spacers}`);
  check("live reduce: shader stops (WebGL)", redDraws === 0, `draws/s ${redDraws}`);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(2000);
  const back = await pinState(page);
  const backDraws = await draws(page, 1000);
  check("restore: data-motion on", back.motion === "on", `motion ${back.motion}`);
  check("restore: smoother recreated", back.smoother, "");
  check("restore: pinned scene recreated", back.spacers === 1, `pin spacers ${back.spacers}`);
  check("restore: shader resumes", backDraws > 0, `draws/s ${backDraws}`);
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference", recordVideo: { dir: `${OUT}/orig/video-scene-scrub`, size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const caption = () => page.evaluate(() => {
    const el = [...document.querySelectorAll("p[aria-hidden='true']")].find((p) => /Before the cue|Reaching the room|Display views updated|Console cut/.test(p.textContent));
    return el?.textContent?.trim() ?? null;
  });
  const seqFwd = [], seqBack = [];
  for (let i = 0; i < 30; i++) { await page.mouse.move(720, 450); await page.mouse.wheel(0, 120); await page.waitForTimeout(160); seqFwd.push(await caption()); }
  const fwdPeak = await page.evaluate(() => Math.round(scrollY));
  for (let i = 0; i < 30; i++) { await page.mouse.move(720, 450); await page.mouse.wheel(0, -120); await page.waitForTimeout(160); seqBack.push(await caption()); }
  const uniq = (a) => a.filter((v, i) => v && (i === 0 || v !== a[i - 1]));
  const fwd = uniq(seqFwd), back = uniq(seqBack);
  check("scene forward: caption advances through phases", fwd.length >= 3, JSON.stringify(fwd));
  check("scene back: caption retreats through phases", back.length >= 2, JSON.stringify(back));
  check("scene scroll range traversed", fwdPeak > 0, `peak scrollY ${fwdPeak}`);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 1));

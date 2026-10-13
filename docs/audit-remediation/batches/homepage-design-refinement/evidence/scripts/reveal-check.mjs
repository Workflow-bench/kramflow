import { chromium } from "/Users/deeppatel/Documents/AI/Shibir/stageflow/node_modules/playwright/index.mjs";
const BASE = "http://localhost:3975/";
const OUT = process.env.OUT;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const browser = await chromium.launch();

const opacityOf = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  return el ? getComputedStyle(el).opacity : null;
}, sel);

// 1. no flash: sample opacity of hero content every 16ms for the first 500ms; must be 1 always (hero has no data-reveal; sanity for "no flash" method)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const samples = [];
  for (let i = 0; i < 20; i++) { samples.push(await opacityOf(page, "h1.hero-title")); await page.waitForTimeout(25); }
  check("1 hero h1 never fades (no reveal attached)", samples.every((o) => o === "1"), JSON.stringify(samples));
  check("1 no console errors", errors.length === 0, errors.join("|").slice(0, 200));
  await ctx.close();
}
// 2. below-fold heading starts hidden, then reveals on scroll (once)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: `${OUT}/video-reveal-scroll`, size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600); // let arrival finish so it doesn't interleave
  const sel = '#prepare h2[data-reveal="heading"]';
  const before = await opacityOf(page, sel);
  for (let i = 0; i < 6; i++) { await page.mouse.move(700, 450); await page.mouse.wheel(0, 250); await page.waitForTimeout(150); }
  await page.waitForTimeout(700);
  const after = await opacityOf(page, sel);
  check("2 below-fold heading starts hidden (opacity 0)", before === "0", `before ${before}`);
  check("2 below-fold heading reveals on scroll (opacity 1)", after === "1", `after ${after}`);
  // scroll back up and down again: must not hide again
  await page.mouse.move(700, 450);
  for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -250); await page.waitForTimeout(60); }
  const scrolledBack = await opacityOf(page, sel);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 250); await page.waitForTimeout(60); }
  const scrolledDownAgain = await opacityOf(page, sel);
  check("2 does not re-hide scrolling back then forward", scrolledBack === "1" && scrolledDownAgain === "1", `back ${scrolledBack} forward ${scrolledDownAgain}`);
  check("2 no console errors", errors.length === 0, errors.join("|").slice(0, 200));
  await ctx.close();
}
// 3. stagger group: items reveal together with a stagger, all end visible
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  const items = await page.$$eval('#room ol[data-reveal="stagger"] > li', (els) => els.map((e) => getComputedStyle(e).opacity));
  for (let i = 0; i < 24; i++) { await page.mouse.move(700, 450); await page.mouse.wheel(0, 250); await page.waitForTimeout(100); }
  await page.waitForTimeout(700);
  const after = await page.$$eval('#room ol[data-reveal="stagger"] > li', (els) => els.map((e) => getComputedStyle(e).opacity));
  check("3 stagger items start hidden", items.every((o) => o === "0"), JSON.stringify(items));
  check("3 stagger items all reveal", after.every((o) => o === "1") && after.length === 3, JSON.stringify(after));
  await ctx.close();
}
// 4. reduced motion: nothing ever hidden
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  const o1 = await opacityOf(page, '#prepare h2[data-reveal="heading"]');
  const o2 = await opacityOf(page, '#room ol[data-reveal="stagger"] > li');
  check("4 reduced motion: below-fold heading already visible", o1 === "1", `o1 ${o1}`);
  check("4 reduced motion: stagger items already visible", o2 === "1", `o2 ${o2}`);
  await ctx.close();
}
// 5. keyboard: tabbing into a hidden section reveals it before scroll arrives
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  const sel = '#before-doors-panel';
  const before = await opacityOf(page, sel.includes("panel") ? '#prepare figure[data-reveal="media"]' : sel);
  // Tab repeatedly until the before-doors tabpanel (inside the media figure's section) is focused
  let focused = false;
  for (let i = 0; i < 40 && !focused; i++) {
    await page.keyboard.press("Tab");
    focused = await page.evaluate(() => !!document.activeElement?.closest("#prepare"));
  }
  await page.waitForTimeout(700);
  const after = await opacityOf(page, '#prepare figure[data-reveal="media"]');
  check("5 reaches before-doors by keyboard", focused, `focused ${focused}`);
  check("5 keyboard focus reveals media before scroll", before === "0" && after === "1", `before ${before} after ${after}`);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 1));

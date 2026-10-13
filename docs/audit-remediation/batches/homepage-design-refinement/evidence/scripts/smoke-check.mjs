import { chromium } from "/Users/deeppatel/Documents/AI/Shibir/stageflow/node_modules/playwright/index.mjs";
const BASE = "http://localhost:3975/";
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const browser = await chromium.launch();

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1600);

// Pinned room scene still works: scroll through and confirm phase caption changes
const caption = () => page.evaluate(() => {
  const el = [...document.querySelectorAll("p[aria-hidden='true']")].find((p) => /Before the cue|Reaching the room|Display views updated|Console cut/.test(p.textContent));
  return el?.textContent?.trim() ?? null;
});
const seq = [];
for (let i = 0; i < 24; i++) { await page.mouse.move(720, 450); await page.mouse.wheel(0, 150); await page.waitForTimeout(140); seq.push(await caption()); }
const uniq = seq.filter((v, i) => v && (i === 0 || v !== seq[i - 1]));
check("room scene still advances through phases", uniq.length >= 3, JSON.stringify(uniq));

// Scroll the rest of the way to the bottom before checking reveal state.
for (let i = 0; i < 20; i++) { await page.mouse.move(720, 450); await page.mouse.wheel(0, 300); await page.waitForTimeout(100); }
await page.waitForTimeout(700);
const opac = await page.$$eval('[data-reveal]', (els) => els.map((e) => [e.getAttribute("data-reveal"), getComputedStyle(e).opacity]));
check("all reveal targets visible after scrolling through", opac.every(([, o]) => o === "1"), JSON.stringify(opac));

// Dialog still opens/closes correctly
await page.locator("text=View full console").first().evaluate((el) => el.click());
await page.waitForTimeout(400);
const dialogOpen = await page.locator('[role="dialog"][aria-modal="true"]').count();
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const dialogClosed = (await page.locator('[role="dialog"][aria-modal="true"]').count()) === 0;
check("dialog opens", dialogOpen === 1, "");
check("dialog closes with Escape", dialogClosed, "");

// Deep link still lands correctly with the extra ScrollTriggers registered
await ctx.close();
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page2 = await ctx2.newPage();
await page2.goto(BASE + "#features", { waitUntil: "networkidle" });
await page2.waitForTimeout(2200);
const top = await page2.evaluate(() => document.getElementById("features").getBoundingClientRect().top);
check("deep link #features still lands at 88px", Math.abs(top - 88) <= 3, `top ${Math.round(top)}`);
await ctx2.close();

check("no console errors across smoke run", errors.length === 0, errors.join("|").slice(0, 300));
await browser.close();
console.log(JSON.stringify(results, null, 1));

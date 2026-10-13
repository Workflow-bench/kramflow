import { chromium } from "/Users/deeppatel/Documents/AI/Shibir/stageflow/node_modules/playwright/index.mjs";
const BASE = process.env.BASE || "http://localhost:3961/";
const OUT = process.env.OUT;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const LOGGER = () => { const gen = (window.__gen = (window.__gen || 0) + 1); window.__log = []; const t0 = performance.now(); const f = (t) => { if (window.__gen !== gen) return; window.__log.push([Math.round(t - t0), Math.round(scrollY)]); requestAnimationFrame(f); }; requestAnimationFrame(f); };
const at = (log, ms) => { let v = null; for (const [t, y] of log) { if (t <= ms) v = y; else break; } return v; };
const topOf = (id) => document.getElementById(id)?.getBoundingClientRect().top;
const browser = await chromium.launch();
async function fresh(name, viewport = { width: 1440, height: 900 }, opts = {}) {
  const ctx = await browser.newContext({ viewport, recordVideo: { dir: `${OUT}/gm02/video-${name}`, size: viewport }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return { ctx, page, errors };
}
async function boot(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.setItem("kf-arrival-v1", "1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.evaluate(LOGGER);
}
const log = (page) => page.evaluate(() => window.__log);
const navFeatures = (page) => page.locator('nav a[href="#features"]').first();
const navProduct = (page) => page.locator('nav a[href="#product"]').first();

// A. rapid Product -> Features -> Product
{
  const { ctx, page, errors } = await fresh("A-rapid");
  await boot(page);
  await navFeatures(page).click();
  await page.waitForTimeout(120);
  const tClick2 = await page.evaluate(() => performance.now());
  await navProduct(page).click();
  await page.waitForTimeout(2600);
  const L = await log(page);
  const tTop = await page.evaluate(() => document.getElementById("product").getBoundingClientRect().top);
  const y900 = at(L, 900 + 0), yFinal = L.at(-1)[1];
  const last1200 = L.filter(([t]) => t > L.at(-1)[0] - 1000).map(([, y]) => y);
  const stable = Math.max(...last1200) - Math.min(...last1200) <= 2;
  check("A product settles at 88px header offset", Math.abs(tTop - 88) <= 2, `product top ${Math.round(tTop)}`);
  check("A no drift after settle (last 1s)", stable, `range ${Math.max(...last1200) - Math.min(...last1200)}px`);
  check("A no console errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  console.error("A samples", JSON.stringify(L.filter(([t]) => t % 300 < 20).slice(0, 25)));
  results.push({ name: "A positions", ok: true, detail: `y@900ms=${y900} final=${yFinal}` });
  await ctx.close();
}
// B. Features click, then Home key interrupts before the old 900ms correction
{
  const { ctx, page, errors } = await fresh("B-home");
  await boot(page);
  await navFeatures(page).click();
  await page.waitForTimeout(150);
  await page.keyboard.press("Home");
  const cancelAt = await page.evaluate(() => Math.round(scrollY));
  await page.waitForTimeout(2200);
  const L = await log(page);
  const yAfterCancel = L.filter(([t]) => t >= 0).slice(-1)[0][1];
  const tail = L.filter(([t]) => t > L.at(-1)[0] - 1000).map(([, y]) => y);
  const drift = Math.max(...tail) - Math.min(...tail);
  check("B Home cancels: no movement in last 1s", drift <= 2, `drift ${drift}px, y ${cancelAt}->${yAfterCancel}`);
  check("B Home: no return jump after 900ms window", at(L, 1200) === at(L, 2000), `y@1200=${at(L, 1200)} y@2000=${at(L, 2000)}`);
  check("B no console errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await ctx.close();
}
// C. Features click, then wheel interrupts
{
  const { ctx, page, errors } = await fresh("C-wheel");
  await boot(page);
  await navFeatures(page).click();
  await page.waitForTimeout(150);
  await page.mouse.move(720, 450); await page.mouse.wheel(0, 240);
  await page.waitForTimeout(2200);
  const L = await log(page);
  const tail = L.filter(([t]) => t > L.at(-1)[0] - 1000).map(([, y]) => y);
  check("C wheel interrupt: settles without snapping back", Math.max(...tail) - Math.min(...tail) <= 2, `range ${Math.max(...tail) - Math.min(...tail)}px`);
  check("C no console errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await ctx.close();
}
// D. route exit then Back
{
  const { ctx, page, errors } = await fresh("D-route");
  await boot(page);
  await navFeatures(page).click();
  await page.waitForTimeout(200);
  await page.locator('nav a[href="/login"]').first().click();
  await page.waitForURL("**/login", { timeout: 15000 });
  await page.waitForTimeout(800);
  const yLogin = await page.evaluate(() => Math.round(scrollY));
  await page.waitForTimeout(1500);
  const yLogin2 = await page.evaluate(() => Math.round(scrollY));
  check("D no scroll writes after route exit", yLogin === yLogin2, `${yLogin} -> ${yLogin2}`);
  await page.evaluate(() => {
    window.__calls = [];
    const orig = window.scrollTo.bind(window);
    window.scrollTo = (...a) => { window.__calls.push([Math.round(performance.now()), JSON.stringify(a), new Error().stack.split("\n").slice(2, 5).map((x) => x.trim()).join(" | ")]); return orig(...a); };
    window.addEventListener("popstate", () => window.__calls.push([Math.round(performance.now()), "popstate", location.href]));
    window.addEventListener("scroll", () => { const n = window.__calls; if (n.length < 400) n.push([Math.round(performance.now()), "scroll", Math.round(scrollY)]); }, { passive: true });
  });
  await page.goBack();
  await page.waitForFunction(() => location.pathname === "/", null, { timeout: 15000 });
  await page.evaluate(LOGGER);
  await page.waitForTimeout(2200);
  const L = await log(page);
  const hashNow = await page.evaluate(() => location.hash);
  const topBack = await page.evaluate(() => document.getElementById("features").getBoundingClientRect().top);
  const tail = L.filter(([t]) => t > L.at(-1)[0] - 800).map(([, y]) => y);
  const calls = await page.evaluate(() => window.__calls);
  for (const c of calls.slice(0, 200)) console.error("DCALL", c[0], c[1], typeof c[2] === "number" ? c[2] : String(c[2]).slice(0, 40), typeof c[2] === "string" && c[2].includes("at") ? c[2].split("|").map((x) => x.replace(/.*chunks\//, "").slice(0, 36)).join("|") : "");
  console.error("D tailinfo", L.at(-1)[0], JSON.stringify([Math.min(...L.filter(([t]) => t > L.at(-1)[0] - 800).map(([, y]) => y)), Math.max(...L.filter(([t]) => t > L.at(-1)[0] - 800).map(([, y]) => y))]), "first", JSON.stringify(L.slice(0, 3)));
  check("D back restores #features hash", hashNow === "#features", `hash ${hashNow}`);
  check("D back: lands at 88px and settles", Math.abs(topBack - 88) <= 2 && Math.max(...tail) - Math.min(...tail) <= 2, `top ${Math.round(topBack)} range ${Math.max(...tail) - Math.min(...tail)}px`);
  check("D no console errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await ctx.close();
}
// E. direct links
for (const hash of ["features", "product"]) {
  const { ctx, page, errors } = await fresh(`E-deep-${hash}`);
  await page.goto(BASE + "#" + hash, { waitUntil: "networkidle" });
  await page.waitForTimeout(2600);
  const top = await page.evaluate((h) => document.getElementById(h).getBoundingClientRect().top, hash);
  check(`E direct #${hash} lands at 88px`, Math.abs(top - 88) <= 2, `top ${Math.round(top)}`);
  check(`E direct #${hash} no console errors`, errors.length === 0, errors.join(" | ").slice(0, 300));
  await ctx.close();
}
// F. resize across desktop breakpoint during navigation
{
  const { ctx, page, errors } = await fresh("F-resize");
  await boot(page);
  await navFeatures(page).click();
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: 900, height: 800 });
  await page.waitForTimeout(2200);
  const L = await log(page);
  const tail = L.filter(([t]) => t > L.at(-1)[0] - 900).map(([, y]) => y);
  check("F resize below breakpoint: stable, no stale write", Math.max(...tail) - Math.min(...tail) <= 2, `range ${Math.max(...tail) - Math.min(...tail)}px`);
  const hasSmoother = await page.evaluate(() => !!document.querySelector("#smooth-content")?.style.transform);
  check("F smoother torn down at mobile width", !hasSmoother, `transform='${await page.evaluate(() => document.querySelector("#smooth-content")?.style.transform)}'`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(800);
  check("F F no console errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await ctx.close();
}
// G. reduced-motion change during navigation
{
  const { ctx, page, errors } = await fresh("G-reduced");
  await boot(page);
  await navFeatures(page).click();
  await page.waitForTimeout(200);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(2200);
  const L = await log(page);
  const tail = L.filter(([t]) => t > L.at(-1)[0] - 900).map(([, y]) => y);
  check("G reduced-motion mid-navigation: no stale write", Math.max(...tail) - Math.min(...tail) <= 2, `range ${Math.max(...tail) - Math.min(...tail)}px`);
  check("G reduced-motion: motion flag off", (await page.evaluate(() => document.documentElement.dataset.motion)) === "off", "");
  check("G no console errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 1));

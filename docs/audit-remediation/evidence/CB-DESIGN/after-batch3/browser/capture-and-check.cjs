// Final browser proof against the production build on port 3959 (own server only).
// Captures measured viewports and reads link targets. No form is submitted, no account or email is used.
const { chromium } = require("playwright");
const path = require("path");
const OUT = __dirname;
const BASE = "http://localhost:3959";
const VIEWS = [
  ["desktop-1280x800", 1280, 800],
  ["tablet-768x1024", 768, 1024],
  ["mobile-375x812", 375, 812],
  ["mobile-320x640", 320, 640],
  ["short-1280x600", 1280, 600],
];
const TOKEN = "abcDEF123_-abcDEF123_-abcDEF123_-abcDEF123_-abc";
const PAGES = [["landing", "/"], ["login", "/login"], ["signup", "/signup"], ["reset", "/reset"], ["set-password", "/set-password"]];

(async () => {
  const browser = await chromium.launch();
  const report = { captures: [], links: {}, routes: {} };
  for (const [name, w, h] of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const [pn, route] of PAGES) {
      await page.goto(BASE + route, { waitUntil: "load" });
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        h1: document.querySelectorAll("h1").length,
        main: document.querySelectorAll("main").length,
      }));
      await page.screenshot({ path: path.join(OUT, `${pn}-${name}.png`), fullPage: false });
      report.captures.push({ page: pn, view: name, ...m });
    }
    await ctx.close();
  }
  // Link-target checks (static DOM, no submission).
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const hrefs = async (url, selector) => { await page.goto(BASE + url, { waitUntil: "load" }); return page.$$eval(selector, (as) => as.map((a) => a.getAttribute("href"))); };
  report.links.loginWithValidInvite = await hrefs(`/login?next=${encodeURIComponent("/invite/" + TOKEN)}`, 'a[href*="reset"], a[href*="signup"]');
  report.links.resetWithNext = await hrefs(`/reset?next=${encodeURIComponent("/invite/" + TOKEN)}`, 'a[href*="login"]');
  report.links.signupMalformedInvite = await hrefs(`/signup?invite=${encodeURIComponent("abc?x=1#frag")}`, 'a[href*="login"]');
  report.links.signupValidInvite = await hrefs(`/signup?invite=${TOKEN}`, 'a[href*="login"]');
  report.links.signupNextAndInvite = await hrefs(`/signup?next=${encodeURIComponent("/e/1/remote")}&invite=${TOKEN}`, 'a[href*="login"]');
  report.links.signupUnsafeNext = await hrefs(`/signup?next=${encodeURIComponent("//evil.example")}`, 'a[href*="login"]');
  // Dev and harness routes must not exist in production (known harness list).
  for (const r of ["/dev", "/dev/components", "/dev/modal", "/dev/realtime", "/dev/import", "/dev/import/console", "/dev/rehearsal", "/api/dev-harness"]) {
    const res = await page.goto(BASE + r, { waitUntil: "load" });
    report.routes[r] = res ? res.status() : null;
  }
  // Positive control: a page known to exist must return 200 through the same call path.
  report.routes["/login (positive control)"] = (await page.goto(BASE + "/login", { waitUntil: "load" })).status();
  // Hero: confirm no clock and no scroll-linked style on the copy.
  await page.goto(BASE + "/", { waitUntil: "load" });
  report.hero = await page.evaluate(() => ({
    hasWallClockText: /\d{2}:\d{2}:\d{2}/.test(document.querySelector("section")?.innerText || ""),
    demoLabelCount: (document.body.innerText.match(/Demo show/g) || []).length,
    inlineOpacityOnH1: getComputedStyle(document.querySelector("h1")).opacity,
  }));
  await ctx.close();
  await browser.close();
  require("fs").writeFileSync(path.join(OUT, "browser-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

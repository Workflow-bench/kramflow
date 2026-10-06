// HOME-R01..R10 rendered evidence against a production build on an own port.
// Usage: node capture.cjs <label>
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const LABEL = process.argv[2] || "after";
const BASE = process.env.BASE || "http://localhost:3961";
const OUT = path.join(__dirname, LABEL);
fs.mkdirSync(OUT, { recursive: true });

const VIEWS = [
  ["1280x720", 1280, 720],
  ["1440x900", 1440, 900],
  ["1920x1080", 1920, 1080],
  ["1280x600-compact", 1280, 600],
  ["375x812-mobile", 375, 812],
];

const report = { label: LABEL, viewports: [], checks: {}, errors: [] };
let n = 0;

async function page(browser, w, h, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    reducedMotion: opts.reducedMotion || "no-preference",
    isMobile: opts.isMobile || false,
    hasTouch: opts.isMobile || false,
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 200)));
  return { ctx, p, errs };
}
// Each load gets a unique query so component state never carries over between checks.
const fresh = (p, hash = "") => p.goto(`${BASE}/?e=${++n}${hash}`, { waitUntil: "load" });
const settle = (p, ms = 2600) => p.waitForTimeout(ms);
const shots = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].map((i) => i.currentSrc.split("%2F").pop().split(".")[0]), sel);

(async () => {
  const browser = await chromium.launch();

  // ---- R01/R05: viewports, measured CSS size and zoom ----------------------
  for (const [name, w, h] of VIEWS) {
    const { ctx, p, errs } = await page(browser, w, h, { isMobile: name.includes("mobile") });
    await fresh(p);
    await settle(p);
    const m = await p.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const r = (s) => { const e = q(s); return e ? Math.round(e.getBoundingClientRect().height) : null; };
      const ap = q(".hero-aperture");
      const apBox = ap ? ap.getBoundingClientRect() : null;
      return {
        cssViewport: `${window.innerWidth}x${window.innerHeight}`,
        browserZoom: window.visualViewport ? +window.visualViewport.scale.toFixed(2) : null,
        devicePixelRatio: +window.devicePixelRatio.toFixed(2),
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        headerHeight: r("nav"),
        heroHeight: r(".hero-section"),
        apertureHeight: apBox ? Math.round(apBox.height) : null,
        apertureVisibleInFirstView: apBox ? Math.round(Math.min(apBox.bottom, window.innerHeight) - apBox.top) : null,
        h1FontSize: getComputedStyle(q("h1")).fontSize,
        sectionHeights: [...document.querySelectorAll("section")].map((s) => ({ id: s.id || s.dataset.cue, h: Math.round(s.getBoundingClientRect().height) })),
      };
    });
    report.viewports.push({ view: name, requested: `${w}x${h}`, ...m });
    await p.screenshot({ path: path.join(OUT, `home-${name}-first-view.png`) });
    await p.screenshot({ path: path.join(OUT, `home-${name}-whole-page.png`), fullPage: true });
    if (errs.length) report.errors.push({ view: name, errs });
    await ctx.close();
  }

  // ---- R02/R06: cue before / after / replay, outputs, persistence ----------
  {
    const { ctx, p, errs } = await page(browser, 1440, 900);
    await fresh(p, "#call");
    await settle(p);
    const state = async () => ({
      console: (await shots(p, "#call figure:first-of-type img"))[0],
      output: (await shots(p, "#call-output-panel img"))[0],
      announced: await p.evaluate(() => document.querySelector("#call [aria-live]")?.textContent?.trim()),
      primary: await p.evaluate(() => document.querySelector("#call button")?.textContent?.trim()),
    });
    report.checks.cueBefore = await state();
    await p.screenshot({ path: path.join(OUT, "cue-before.png") });

    await p.click('button:has-text("Advance example")');
    await p.waitForTimeout(900);
    report.checks.cueAfter = await state();
    await p.screenshot({ path: path.join(OUT, "cue-after.png") });

    // Every output at the advanced cue: persistence across view change.
    const perView = {};
    for (const v of ["AV", "Green Room", "General", "Presenter"]) {
      await p.click(`#call [role="tab"]:has-text("${v}")`);
      await p.waitForTimeout(700);
      perView[v] = await state();
      await p.screenshot({ path: path.join(OUT, `cue-view-${v.replace(/\s+/g, "-").toLowerCase()}.png`) });
    }
    report.checks.perView = perView;

    // Rapid selection: the last choice must win and must be the one announced.
    for (const v of ["AV", "General", "Green Room"]) {
      await p.click(`#call [role="tab"]:has-text("${v}")`);
      await p.waitForTimeout(60);
    }
    await p.waitForTimeout(1600);
    report.checks.rapidSelection = await state();

    await p.click('button:has-text("Replay cue change")');
    await p.waitForTimeout(900);
    report.checks.cueReplay = await state();
    await p.screenshot({ path: path.join(OUT, "cue-replay.png") });

    // Full view: complete unchanged source image, close and focus return.
    await p.click('button:has-text("View the whole console")');
    await p.waitForTimeout(700);
    report.checks.fullView = await p.evaluate(() => ({
      dialog: Boolean(document.querySelector('[role="dialog"]')),
      focusInside: Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement)),
      imageNaturalRatio: (() => { const i = document.querySelector('[role="dialog"] img'); return i ? +(i.naturalWidth / i.naturalHeight).toFixed(3) : null; })(),
    }));
    await p.screenshot({ path: path.join(OUT, "cue-full-view.png") });
    await p.keyboard.press("Escape");
    await p.waitForTimeout(500);
    report.checks.fullViewClosed = await p.evaluate(() => ({
      dialog: Boolean(document.querySelector('[role="dialog"]')),
      focusReturned: (document.activeElement?.textContent || "").includes("View the whole console"),
    }));
    if (errs.length) report.errors.push({ view: "cue", errs });
    await ctx.close();
  }

  // ---- R03: each adaptation row maps to its own imagery and caption --------
  {
    const { ctx, p } = await page(browser, 1440, 900);
    await fresh(p, "#adapt");
    await settle(p);
    const rows = {};
    for (const t of ["Adjust the timer", "Hold the room", "Send a notice", "Keep control clear"]) {
      await p.click(`#adapt [role="tab"]:has-text("${t}")`);
      await p.waitForTimeout(700);
      rows[t] = await p.evaluate(() => ({
        image: document.querySelector("#plans-panel img")?.currentSrc.split("%2F").pop().split(".")[0],
        crop: (() => { const i = document.querySelector("#plans-panel img"); return i ? `${getComputedStyle(i).width}@${getComputedStyle(i).left}` : null; })(),
        caption: document.querySelector("#plans-panel figcaption")?.textContent?.trim(),
      }));
      await p.screenshot({ path: path.join(OUT, `adapt-${t.split(" ")[0].toLowerCase()}.png`) });
    }
    report.checks.adaptationRows = rows;
    await ctx.close();
  }

  // ---- R07: selected tab clarity and panel association --------------------
  {
    const { ctx, p } = await page(browser, 1440, 900);
    await fresh(p, "#prepare");
    await settle(p);
    report.checks.tabs = await p.evaluate(() => {
      const sel = document.querySelector('#prepare [role="tab"][aria-selected="true"]');
      const ind = sel?.querySelector("span[aria-hidden]") || sel?.querySelector("span");
      const panel = document.getElementById("before-doors-panel");
      return {
        selectedLabel: sel?.textContent?.trim(),
        indicatorZIndex: ind ? getComputedStyle(ind).zIndex : null,
        indicatorVisible: ind ? ind.getBoundingClientRect().width > 0 : null,
        selectedFontWeight: sel ? getComputedStyle(sel).fontWeight : null,
        panelContainsImage: Boolean(panel?.querySelector("img")),
        panelContainsCaption: Boolean(panel?.querySelector("figcaption")),
        panelContainsCopy: Boolean(panel?.querySelector("p")),
      };
    });
    await p.focus('#prepare [role="tab"][aria-selected="true"]');
    await p.screenshot({ path: path.join(OUT, "tabs-focus.png") });
    await ctx.close();
  }

  // ---- R08: pause scope, reduced motion, runtime change -------------------
  {
    const { ctx, p } = await page(browser, 1440, 900);
    await fresh(p, "#call");
    await p.waitForFunction(() => Boolean(document.querySelector(".hero-section canvas")), { timeout: 15000 }).catch(() => {});
    await settle(p);
    const canvasBefore = await p.evaluate(() => Boolean(document.querySelector(".hero-section canvas")));
    await p.click('button:has-text("Pause motion")');
    await p.waitForTimeout(700);
    // While paused, the cue still changes — it just does not travel.
    await p.click('button:has-text("Advance example")');
    await p.waitForTimeout(900);
    report.checks.pause = {
      canvasBefore,
      canvasWhilePaused: await p.evaluate(() => Boolean(document.querySelector(".hero-section canvas"))),
      staticFieldPresent: await p.evaluate(() => Boolean(document.querySelector(".ambient-light-hero"))),
      cueStillChanges: (await shots(p, "#call figure:first-of-type img"))[0],
      announced: await p.evaluate(() => document.querySelector("#call [aria-live]")?.textContent?.trim()),
      controlLabel: await p.evaluate(() => document.querySelector('button[aria-pressed="true"]')?.textContent?.trim()),
    };
    await p.screenshot({ path: path.join(OUT, "motion-paused.png") });
    await ctx.close();
  }
  {
    const { ctx, p } = await page(browser, 1440, 900, { reducedMotion: "reduce" });
    await fresh(p);
    await settle(p, 3000);
    report.checks.reducedMotion = await p.evaluate(() => ({
      canvas: Boolean(document.querySelector(".hero-section canvas")),
      staticField: Boolean(document.querySelector(".ambient-light-hero")),
      h1Visible: document.querySelector("h1").getBoundingClientRect().height > 0,
      controlText: document.querySelector("main p.fixed")?.textContent?.trim() ?? null,
      navCompactAtRest: document.querySelector("nav")?.getAttribute("data-compact"),
    }));
    await p.screenshot({ path: path.join(OUT, "reduced-motion.png") });
    // Runtime change: allowing motion again must bring the engines back.
    await p.emulateMedia({ reducedMotion: "no-preference" });
    await p.waitForTimeout(2600);
    report.checks.reducedMotionRuntime = {
      canvasAfterAllowingMotion: await p.evaluate(() => Boolean(document.querySelector(".hero-section canvas"))),
    };
    await ctx.close();
  }

  // ---- no WebGL fallback ---------------------------------------------------
  {
    const b2 = await chromium.launch({ args: ["--disable-3d-apis"] });
    const ctx = await b2.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
    await p.goto(`${BASE}/?e=webgl`, { waitUntil: "load" });
    await settle(p, 3000);
    report.checks.noWebGL = {
      canvas: await p.evaluate(() => Boolean(document.querySelector(".hero-section canvas"))),
      staticField: await p.evaluate(() => Boolean(document.querySelector(".ambient-light-hero"))),
      h1Visible: await p.evaluate(() => document.querySelector("h1").getBoundingClientRect().height > 0),
      pageErrors: errs,
    };
    await p.screenshot({ path: path.join(OUT, "fallback-no-webgl.png") });
    await b2.close();
  }

  // ---- R09: mobile disclosure ---------------------------------------------
  {
    const { ctx, p } = await page(browser, 375, 812, { isMobile: true });
    await fresh(p);
    await settle(p);
    await p.click('button[aria-label="Open menu"]');
    await p.waitForTimeout(600);
    const opened = await p.evaluate(() => ({
      expanded: document.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded"),
      menuVisible: Boolean(document.getElementById("site-menu")),
    }));
    await p.screenshot({ path: path.join(OUT, "mobile-menu-open.png") });
    await p.keyboard.press("Escape");
    await p.waitForTimeout(700);
    const afterEscape = await p.evaluate(() => ({
      expanded: document.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded"),
      menuPresent: Boolean(document.getElementById("site-menu")),
      focusOnToggle: document.activeElement?.getAttribute("aria-controls") === "site-menu",
    }));
    await p.screenshot({ path: path.join(OUT, "mobile-menu-after-escape.png") });

    // Activating a chapter link closes the menu and leaves native scrolling.
    await p.click('button[aria-label="Open menu"]');
    await p.waitForTimeout(500);
    await p.click('#site-menu a[href="#call"]');
    await p.waitForTimeout(900);
    const afterLink = await p.evaluate(() => ({
      expanded: document.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded"),
      hash: location.hash,
      scrolledAway: window.scrollY > 100,
      bodyOverflow: getComputedStyle(document.body).overflow,
    }));
    // A closing panel must not keep focusable links.
    const hiddenFocusable = await p.evaluate(() => {
      const menu = document.getElementById("site-menu");
      if (!menu) return { menuPresent: false, focusable: 0 };
      return { menuPresent: true, inert: menu.hasAttribute("inert"), focusable: menu.querySelectorAll("a,button").length };
    });
    report.checks.mobileMenu = { opened, afterEscape, afterLink, hiddenFocusable };
    await p.screenshot({ path: path.join(OUT, "mobile-after-link.png") });
    await ctx.close();
  }

  // ---- R10: published copy -------------------------------------------------
  {
    const { ctx, p } = await page(browser, 1440, 900);
    await fresh(p);
    await settle(p, 1500);
    const text = await p.evaluate(() => document.body.innerText);
    report.checks.copy = {
      namesOperatorOnce: (text.match(/Stage managers and AV teams/g) || []).length,
      mentionsLease: /lease/i.test(text),
      mentionsNoKeyboardTv: /no keyboard/i.test(text),
      mentionsTvRoute: /\/tv/.test(text),
      forbiddenClaims: ["No credit card", "uptime", "99.", "customers", "trusted by"].filter((t) => text.toLowerCase().includes(t.toLowerCase())),
    };
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

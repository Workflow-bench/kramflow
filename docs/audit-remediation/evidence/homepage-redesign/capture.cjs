// Homepage redesign: rendered evidence against a production build on an own port
// (never the user's :3000). Usage: node capture.cjs <label>
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

async function page(browser, w, h, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    reducedMotion: opts.reducedMotion || "no-preference",
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text().slice(0, 200));
  });
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 200)));
  return { ctx, p, errs };
}

const settle = (p, ms = 2500) => p.waitForTimeout(ms);

(async () => {
  const browser = await chromium.launch();

  // ---- Viewport captures, whole page plus first viewport -------------------
  for (const [name, w, h] of VIEWS) {
    const { ctx, p, errs } = await page(browser, w, h);
    await p.goto(BASE + "/", { waitUntil: "load" });
    await settle(p);

    const m = await p.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const box = (s) => {
        const e = q(s);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width) };
      };
      const hero = q(".hero-section");
      const ap = q(".hero-aperture");
      // Is meaningful product content inside the first viewport?
      const apBox = ap ? ap.getBoundingClientRect() : null;
      return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
        headerHeight: box("nav")?.height ?? null,
        heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) : null,
        apertureHeight: apBox ? Math.round(apBox.height) : null,
        apertureVisibleInFirstViewport: apBox ? Math.round(Math.min(apBox.bottom, window.innerHeight) - apBox.top) : null,
        apertureMask: ap ? getComputedStyle(ap).maskImage.slice(0, 90) : null,
        h1FontSize: getComputedStyle(q("h1")).fontSize,
        ctaCount: document.querySelectorAll('.hero-section a[href="/signup"], .hero-section a[href="#prepare"]').length,
        standbyOverlay: Boolean(q(".standby-accent, .standby-cover")),
      };
    });
    report.viewports.push({ view: name, ...m });

    await p.screenshot({ path: path.join(OUT, `home-${name}-first-viewport.png`) });
    await p.screenshot({ path: path.join(OUT, `home-${name}-whole-page.png`), fullPage: true });
    if (errs.length) report.errors.push({ view: name, errs });
    await ctx.close();
  }

  // ---- Ambient light: visible movement at 0s / 2s / 4s ---------------------
  {
    const { ctx, p } = await page(browser, 1440, 900);
    await p.goto(BASE + "/", { waitUntil: "load" });
    await p.waitForFunction(() => Boolean(document.querySelector(".hero-section canvas")), { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(600);
    const frames = [];
    for (const t of [0, 2000, 2000]) {
      if (t) await p.waitForTimeout(t);
      const el = await p.$(".hero-section canvas");
      if (!el) break;
      const buf = await el.screenshot();
      frames.push(buf);
    }
    // Compare frames byte-wise and by mean absolute difference on raw PNG bytes.
    if (frames.length === 3) {
      const { PNG } = require("pngjs");
      const imgs = frames.map((b) => PNG.sync.read(b));
      const diff = (a, b) => {
        let sum = 0;
        const n = Math.min(a.data.length, b.data.length);
        for (let i = 0; i < n; i += 4) sum += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
        return +(sum / (n / 4) / 3).toFixed(3);
      };
      report.checks.ambientMotion = {
        shaderMounted: true,
        meanChannelDiff_0s_to_2s: diff(imgs[0], imgs[1]),
        meanChannelDiff_2s_to_4s: diff(imgs[1], imgs[2]),
        meanChannelDiff_0s_to_4s: diff(imgs[0], imgs[2]),
      };
      frames.forEach((b, i) => fs.writeFileSync(path.join(OUT, `ambient-frame-${i * 2}s.png`), b));
    } else {
      report.checks.ambientMotion = { shaderMounted: false };
    }
    await ctx.close();
  }

  // ---- Pause / resume ------------------------------------------------------
  {
    const { ctx, p } = await page(browser, 1440, 900);
    await p.goto(BASE + "/", { waitUntil: "load" });
    await p.waitForFunction(() => Boolean(document.querySelector(".hero-section canvas")), { timeout: 15000 }).catch(() => {});
    const before = await p.evaluate(() => Boolean(document.querySelector(".hero-section canvas")));
    await p.click('button:has-text("Pause motion")');
    await p.waitForTimeout(600);
    const paused = await p.evaluate(() => ({
      canvas: Boolean(document.querySelector(".hero-section canvas")),
      staticField: Boolean(document.querySelector(".ambient-light-hero")),
      headingReadable: document.querySelector("h1").getBoundingClientRect().height > 0,
      label: document.querySelector('button[aria-pressed="true"]')?.textContent?.trim(),
    }));
    await p.screenshot({ path: path.join(OUT, "motion-paused-1440x900.png") });
    await p.click('button:has-text("Resume motion")');
    await p.waitForTimeout(900);
    const resumed = await p.evaluate(() => Boolean(document.querySelector(".hero-section canvas")));
    report.checks.pause = { canvasBefore: before, whilePaused: paused, canvasAfterResume: resumed };
    await ctx.close();
  }

  // ---- Reduced motion, and a runtime preference change --------------------
  {
    const { ctx, p } = await page(browser, 1440, 900, { reducedMotion: "reduce" });
    await p.goto(BASE + "/", { waitUntil: "load" });
    await settle(p, 3000);
    report.checks.reducedMotion = await p.evaluate(() => ({
      canvas: Boolean(document.querySelector(".hero-section canvas")),
      staticField: Boolean(document.querySelector(".ambient-light-hero")),
      h1Visible: document.querySelector("h1").getBoundingClientRect().height > 0,
      motionControlText: document.querySelector("main > p, main p.fixed")?.textContent?.trim() ?? null,
    }));
    await p.screenshot({ path: path.join(OUT, "reduced-motion-1440x900.png") });
    // Toggle the preference mid-session: the shader must appear once motion is allowed.
    await p.emulateMedia({ reducedMotion: "no-preference" });
    await p.waitForTimeout(2500);
    report.checks.reducedMotionRuntimeChange = {
      canvasAfterPreferenceAllowsMotion: await p.evaluate(() => Boolean(document.querySelector(".hero-section canvas"))),
    };
    await ctx.close();
  }

  // ---- No WebGL: static fallback, content intact ---------------------------
  {
    const b2 = await chromium.launch({ args: ["--disable-3d-apis"] });
    const ctx = await b2.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
    await p.goto(BASE + "/", { waitUntil: "load" });
    await settle(p, 3000);
    report.checks.noWebGL = {
      webgl2: await p.evaluate(() => Boolean(document.createElement("canvas").getContext("webgl2"))),
      canvas: await p.evaluate(() => Boolean(document.querySelector(".hero-section canvas"))),
      staticField: await p.evaluate(() => Boolean(document.querySelector(".ambient-light-hero"))),
      h1Visible: await p.evaluate(() => document.querySelector("h1").getBoundingClientRect().height > 0),
      pageErrors: errs,
    };
    await p.screenshot({ path: path.join(OUT, "fallback-no-webgl-1440x900.png") });
    await b2.close();
  }

  // ---- Signature interaction: cue, views, keyboard, persistence -----------
  {
    const { ctx, p, errs } = await page(browser, 1440, 900);
    await p.goto(BASE + "/#call", { waitUntil: "load" });
    await settle(p);
    const shots = () => p.evaluate(() => [...document.querySelectorAll("#call img")].map((i) => i.currentSrc.split("%2F").pop().split(".")[0]));
    const cueLabel = () => p.evaluate(() => document.querySelector("#call figcaption span:last-child")?.textContent?.trim());

    const initial = { shots: await shots(), cue: await cueLabel() };
    await p.screenshot({ path: path.join(OUT, "cue-before.png") });

    await p.click('button:has-text("Advance example")');
    await p.waitForTimeout(600);
    const advanced = { shots: await shots(), cue: await cueLabel() };
    await p.screenshot({ path: path.join(OUT, "cue-after.png") });

    // Each view, at the advanced cue: persistence across selection.
    const perView = {};
    for (const v of ["AV", "Green Room", "General", "Presenter"]) {
      await p.click(`[role="tab"]:has-text("${v}")`);
      await p.waitForTimeout(450);
      perView[v] = { shots: await shots(), cue: await cueLabel() };
      await p.screenshot({ path: path.join(OUT, `view-${v.replace(/\s+/g, "-").toLowerCase()}.png`) });
    }

    // Keyboard: arrows, Home, End on the view selector.
    await p.focus('[role="tab"][aria-selected="true"]');
    const keyboard = [];
    for (const key of ["ArrowRight", "ArrowRight", "End", "Home", "ArrowLeft"]) {
      await p.keyboard.press(key);
      await p.waitForTimeout(220);
      keyboard.push(await p.evaluate(() => ({
        selected: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim(),
        focused: document.activeElement?.textContent?.trim(),
      })));
    }
    await p.screenshot({ path: path.join(OUT, "view-keyboard-focus.png") });

    await p.click('button:has-text("Reset example")');
    await p.waitForTimeout(600);
    const reset = { shots: await shots(), cue: await cueLabel() };
    await p.screenshot({ path: path.join(OUT, "cue-reset.png") });

    const label = await p.evaluate(() => [...document.querySelectorAll("#call p")].map((n) => n.textContent.trim()).find((t) => t.startsWith("Recorded product preview")));
    report.checks.cueExample = { initial, advanced, perView, keyboard, reset, provenanceLabel: label };
    if (errs.length) report.errors.push({ view: "cue", errs });
    await ctx.close();
  }

  // ---- Full-console expansion: open, focus trap, Escape, focus return ------
  {
    const { ctx, p } = await page(browser, 1440, 900);
    await p.goto(BASE + "/", { waitUntil: "load" });
    await settle(p);
    await p.click('button:has-text("View full console")');
    await p.waitForTimeout(600);
    const open = await p.evaluate(() => ({
      dialog: Boolean(document.querySelector('[role="dialog"]')),
      focusInsideDialog: Boolean(document.querySelector('[role="dialog"]')?.contains(document.activeElement)),
      bodyScrollLocked: getComputedStyle(document.body).overflow === "hidden",
    }));
    await p.screenshot({ path: path.join(OUT, "full-console-expanded.png") });
    await p.keyboard.press("Escape");
    await p.waitForTimeout(500);
    const closed = await p.evaluate(() => ({
      dialog: Boolean(document.querySelector('[role="dialog"]')),
      focusReturnedToTrigger: (document.activeElement?.textContent || "").includes("View full console"),
      bodyScrollRestored: getComputedStyle(document.body).overflow !== "hidden",
    }));
    report.checks.fullConsole = { open, closed };
    await ctx.close();
  }

  // ---- Navigation, anchors, destinations, keyboard order ------------------
  {
    const { ctx, p } = await page(browser, 1440, 900);
    await p.goto(BASE + "/", { waitUntil: "load" });
    await settle(p);
    const anchors = {};
    for (const id of ["prepare", "call", "adapt", "room", "one-cue", "product", "features"]) {
      anchors[id] = await p.evaluate((anchorId) => {
        const el = document.getElementById(anchorId);
        if (!el) return { exists: false };
        el.scrollIntoView();
        const r = el.getBoundingClientRect();
        const nav = document.querySelector("nav").getBoundingClientRect();
        return { exists: true, top: Math.round(r.top), navBottom: Math.round(nav.bottom), obscured: r.top < nav.bottom - 1 };
      }, id);
    }
    await p.evaluate(() => window.scrollTo(0, 0));
    const order = [];
    for (let i = 0; i < 10; i++) {
      await p.keyboard.press("Tab");
      order.push(await p.evaluate(() => {
        const a = document.activeElement;
        const cs = getComputedStyle(a);
        return { tag: a.tagName, text: (a.textContent || "").trim().slice(0, 26), href: a.getAttribute("href"), focusRing: cs.outlineStyle !== "none" || cs.boxShadow !== "none" };
      }));
    }
    report.checks.anchors = anchors;
    report.checks.keyboardOrder = order;
    report.checks.destinations = await p.evaluate(() => ({
      signup: [...document.querySelectorAll('a[href="/signup"]')].length,
      login: [...document.querySelectorAll('a[href="/login"]')].length,
    }));
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

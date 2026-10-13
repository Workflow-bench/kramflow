// Lane A/B/C + HF-01..HF-07 rendered evidence against a production build on an own port.
// Usage: node capture.cjs <label>
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const LABEL = process.argv[2] || "after";
const BASE = process.env.BASE || "http://localhost:3961";
const OUT = path.join(__dirname, LABEL);
fs.mkdirSync(OUT, { recursive: true });

const VIEWS = [
  ["1280x800", 1280, 800],
  ["1440x900", 1440, 900],
  ["1920x1080", 1920, 1080],
  ["1280x620-short", 1280, 620],
  ["320x720-mobile", 320, 720],
  ["375x812-mobile", 375, 812],
  ["768x1024-tablet", 768, 1024],
];

const report = { label: LABEL, viewports: [], lanes: {}, hf: {}, errors: [] };
let n = 0;

async function ctxPage(browser, w, h, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    reducedMotion: opts.reducedMotion || "no-preference",
    isMobile: !!opts.isMobile,
    hasTouch: !!opts.isMobile,
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 180)); });
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 180)));
  return { ctx, p, errs };
}
const fresh = (p, hash = "") => p.goto(`${BASE}/?e=${++n}${hash}`, { waitUntil: "load" });
const settle = (p, ms = 2200) => p.waitForTimeout(ms);

// Scene state read straight from painted pixels, never from component state.
const SCENE = `(() => {
  const label = [...document.querySelectorAll('#product p')].map(p => p.textContent.trim())
    .find(t => /Before the cue|Console cut|Reaching|updated/.test(t)) || null;
  const ca = document.querySelector('[data-console-after]');
  const consoleAfter = ca ? Number(getComputedStyle(ca).opacity) > 0.5 : null;
  const shown = [...document.querySelectorAll('[data-after]')]
    .filter(e => Number(getComputedStyle(e).opacity) > 0.5).length;
  const spacer = document.querySelector('#product .pin-spacer');
  return { label, consoleAfter, shown, pinSpacer: !!spacer, pinSpacerH: spacer ? Math.round(spacer.getBoundingClientRect().height) : 0 };
})()`;

(async () => {
  const browser = await chromium.launch();

  // ---- viewports -----------------------------------------------------------
  for (const [name, w, h] of VIEWS) {
    const { ctx, p, errs } = await ctxPage(browser, w, h, { isMobile: name.includes("mobile") });
    await fresh(p);
    await settle(p);
    const m = await p.evaluate(() => ({
      requestedNote: "see report row",
      cssViewport: `${window.innerWidth}x${window.innerHeight}`,
      browserZoom: window.visualViewport ? +window.visualViewport.scale.toFixed(2) : null,
      devicePixelRatio: +window.devicePixelRatio.toFixed(2),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      headerHeight: Math.round(document.querySelector("nav").getBoundingClientRect().height),
      navLinks: [...document.querySelectorAll("nav a")].map((a) => a.textContent.trim()).filter(Boolean),
      sections: [...document.querySelectorAll("section")].map((s) => ({ id: s.id || s.dataset.cue, h: Math.round(s.getBoundingClientRect().height) })),
      duplicateIds: (() => {
        const seen = {}, dup = [];
        document.querySelectorAll("[id]").forEach((e) => { if (seen[e.id]) dup.push(e.id); seen[e.id] = 1; });
        return dup;
      })(),
    }));
    report.viewports.push({ view: name, requested: `${w}x${h}`, ...m });
    await p.screenshot({ path: path.join(OUT, `page-${name}-top.png`) });
    await p.screenshot({ path: path.join(OUT, `page-${name}-whole.png`), fullPage: true });
    if (errs.length) report.errors.push({ view: name, errs });
    await ctx.close();
  }

  // ---- Lane A: the scroll scene, forwards, reverse, release ----------------
  {
    const { ctx, p, errs } = await ctxPage(browser, 1440, 900);
    await fresh(p);
    await settle(p);
    const scan = [];
    for (let y = 1200; y <= 4200; y += 300) {
      await p.evaluate((v) => window.scrollTo(0, v), y);
      await p.waitForTimeout(700);
      scan.push({ y, ...(await p.evaluate(SCENE)) });
    }
    const reverse = [];
    for (let y = 3600; y >= 1500; y -= 500) {
      await p.evaluate((v) => window.scrollTo(0, v), y);
      await p.waitForTimeout(800);
      reverse.push({ y, ...(await p.evaluate(SCENE)) });
    }
    // Label must never claim more displays than are painted.
    const lies = [...scan, ...reverse].filter((s) =>
      (s.label === "Display views updated" && s.shown !== 4) ||
      (s.label === "Before the cue · Opening Keynote" && s.consoleAfter === true)
    );
    report.lanes.sceneScan = scan.filter((s, i) => i === 0 || s.label !== scan[i - 1].label || s.shown !== scan[i - 1].shown);
    report.lanes.sceneReverse = reverse.filter((s, i) => i === 0 || s.label !== reverse[i - 1].label || s.shown !== reverse[i - 1].shown);
    report.lanes.labelContradictions = lies;

    for (const [name, y] of [["establish", 1800], ["cue", 2300], ["room", 2700], ["resolve", 3500], ["release", 4200]]) {
      await p.evaluate((v) => window.scrollTo(0, v), y);
      await p.waitForTimeout(900);
      await p.screenshot({ path: path.join(OUT, `scene-${name}.png`) });
    }

    // Anchor entry and clean release.
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(500);
    await p.evaluate(() => { location.hash = "#product"; });
    await p.waitForTimeout(1200);
    report.lanes.anchorEntry = await p.evaluate(() => {
      const s = document.getElementById("product");
      const nav = document.querySelector("nav").getBoundingClientRect();
      const r = s.getBoundingClientRect();
      return { sectionTop: Math.round(r.top), navBottom: Math.round(nav.bottom), obscured: r.top < nav.bottom - 1 };
    });
    // Legacy anchors still resolve to the same scene.
    const legacy = {};
    for (const id of ["call", "one-cue", "adapt", "prepare", "room", "features"]) {
      legacy[id] = await p.evaluate((anchor) => {
        const el = document.getElementById(anchor);
        if (!el) return { exists: false };
        el.scrollIntoView();
        const r = el.getBoundingClientRect();
        const nav = document.querySelector("nav").getBoundingClientRect();
        return { exists: true, top: Math.round(r.top), obscured: r.top < nav.bottom - 1 };
      }, id);
    }
    report.lanes.legacyAnchors = legacy;
    if (errs.length) report.errors.push({ view: "scene", errs });
    await ctx.close();
  }

  // ---- Lane A: pause + reduced motion must drop the pin -------------------
  {
    const { ctx, p } = await ctxPage(browser, 1440, 900);
    await fresh(p);
    await settle(p);
    const before = await p.evaluate(SCENE);
    await p.click('button:has-text("Pause motion")');
    await p.waitForTimeout(1200);
    const paused = await p.evaluate(SCENE);
    await p.screenshot({ path: path.join(OUT, "scene-paused-static.png") });
    await p.click('button:has-text("Resume motion")');
    await p.waitForTimeout(1200);
    report.lanes.pauseScene = { before, paused, resumedPin: (await p.evaluate(SCENE)).pinSpacer };
    await ctx.close();
  }
  {
    const { ctx, p } = await ctxPage(browser, 1440, 900, { reducedMotion: "reduce" });
    await fresh(p);
    await settle(p, 2600);
    report.lanes.reducedScene = await p.evaluate(SCENE);
    await p.screenshot({ path: path.join(OUT, "scene-reduced-motion.png") });
    await p.emulateMedia({ reducedMotion: "no-preference" });
    await p.waitForTimeout(2000);
    report.lanes.reducedSceneRuntime = await p.evaluate(SCENE);
    await ctx.close();
  }

  // ---- Lane B: operations ---------------------------------------------------
  {
    const { ctx, p, errs } = await ctxPage(browser, 1440, 900);
    await fresh(p, "#features");
    await settle(p);
    const rows = {};
    for (const t of ["Adjust the timer", "Hold the room", "Send a notice", "Keep control clear"]) {
      await p.click(`#features button:has-text("${t}")`);
      await p.waitForTimeout(800);
      rows[t] = await p.evaluate(() => {
        const img = document.querySelector("#features figure img");
        const openBtn = [...document.querySelectorAll('#features button[aria-expanded="true"]')][0];
        return {
          image: img ? img.currentSrc.split("%2F").pop().split(".")[0] : null,
          imgWidth: img ? getComputedStyle(img).width : null,
          imgLeft: img ? getComputedStyle(img).left : null,
          caption: document.querySelector("#features figcaption span")?.textContent?.trim(),
          expanded: openBtn?.textContent?.replace(/\s+/g, " ").trim(),
          openRegions: document.querySelectorAll('#features [role="region"]:not([hidden])').length,
        };
      });
      await p.screenshot({ path: path.join(OUT, `ops-${t.split(" ")[1] || t}.png`) });
    }
    report.lanes.operations = rows;
    // Rapid selection: last wins, aperture never empty.
    for (const t of ["Hold the room", "Send a notice", "Keep control clear"]) {
      await p.click(`#features button:has-text("${t}")`);
      await p.waitForTimeout(70);
    }
    await p.waitForTimeout(1600);
    report.lanes.operationsRapid = await p.evaluate(() => ({
      images: [...document.querySelectorAll("#features figure img")].map((i) => i.currentSrc.split("%2F").pop().split(".")[0]),
      caption: document.querySelector("#features figcaption span")?.textContent?.trim(),
    }));
    report.lanes.publicCopyClean = await p.evaluate(() => !/No capture (of a display )?.*exists yet/i.test(document.body.innerText));
    if (errs.length) report.errors.push({ view: "ops", errs });
    await ctx.close();
  }

  // ---- HF-01: committed image survives A -> B pending -> C -----------------
  {
    const { ctx, p } = await ctxPage(browser, 1440, 900);
    await p.route("**/_next/image**", async (route) => {
      // Stall every capture request so pending states are observable.
      await new Promise((r) => setTimeout(r, 2500));
      return route.continue();
    });
    await fresh(p, "#features");
    await p.waitForTimeout(6000);
    const a = await p.evaluate(() => [...document.querySelectorAll("#features figure img")].map((i) => ({ src: i.currentSrc.split("%2F").pop().split(".")[0], complete: i.complete, opacity: getComputedStyle(i.closest("div") || i).opacity })));
    await p.click('#features button:has-text("Hold the room")');
    await p.waitForTimeout(300);
    const b = await p.evaluate(() => [...document.querySelectorAll("#features figure img")].map((i) => ({ src: i.currentSrc.split("%2F").pop().split(".")[0], complete: i.complete })));
    await p.click('#features button:has-text("Send a notice")');
    await p.waitForTimeout(300);
    const c = await p.evaluate(() => [...document.querySelectorAll("#features figure img")].map((i) => ({ src: i.currentSrc.split("%2F").pop().split(".")[0], complete: i.complete })));
    const anyDecoded = (arr) => arr.some((x) => x.complete);
    report.hf.HF01 = { afterA: a, duringB: b, duringC: c, decodedImagePresentThroughout: anyDecoded(a) && anyDecoded(b) && anyDecoded(c) };
    await p.screenshot({ path: path.join(OUT, "hf01-pending-chain.png") });
    await ctx.close();
  }

  // ---- HF-03/HF-04: pause reaches nav; closing menu is inert ---------------
  {
    const { ctx, p } = await ctxPage(browser, 375, 812, { isMobile: true });
    await fresh(p);
    await settle(p);
    await p.click('button:has-text("Pause motion")').catch(() => {});
    await p.waitForTimeout(400);
    await p.click('button[aria-label="Open menu"]');
    await p.waitForTimeout(500);
    const open = await p.evaluate(() => ({ expanded: document.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded"), inert: document.getElementById("site-menu")?.hasAttribute("inert") }));
    await p.keyboard.press("Escape");
    // Sample inside the exit window, not after it.
    await p.waitForTimeout(60);
    const exiting = await p.evaluate(() => {
      const m = document.getElementById("site-menu");
      return {
        present: !!m,
        inert: m ? m.hasAttribute("inert") : null,
        ariaHidden: m ? m.getAttribute("aria-hidden") : null,
        focusableLinks: m ? m.querySelectorAll("a,button").length : 0,
        style: m ? getComputedStyle(m).maxHeight : null,
        motionAttr: document.documentElement.dataset.motion,
      };
    });
    await p.waitForTimeout(700);
    const after = await p.evaluate(() => ({
      expanded: document.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded"),
      focusOnToggle: document.activeElement?.getAttribute("aria-controls") === "site-menu",
      inert: document.getElementById("site-menu")?.hasAttribute("inert"),
    }));
    report.hf.HF03_HF04 = { open, exitWindow: exiting, after };
    await p.screenshot({ path: path.join(OUT, "mobile-menu-exit.png") });
    await ctx.close();
  }

  // ---- HF-05: static panels are keyboard reachable -------------------------
  {
    const { ctx, p } = await ctxPage(browser, 1440, 900);
    await fresh(p, "#prepare");
    await settle(p);
    const stops = [];
    await p.evaluate(() => document.querySelector('#prepare [role="tab"]')?.focus());
    for (let i = 0; i < 6; i++) {
      await p.keyboard.press("Tab");
      await p.waitForTimeout(150);
      stops.push(await p.evaluate(() => {
        const a = document.activeElement;
        return { tag: a.tagName, id: a.id || null, role: a.getAttribute("role"), text: (a.textContent || "").trim().slice(0, 28) };
      }));
    }
    report.hf.HF05 = { tabStopsAfterTabs: stops, reachesPanel: stops.some((s) => s.id === "before-doors-panel" || s.role === "tabpanel" || s.tag === "FIGURE") };
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

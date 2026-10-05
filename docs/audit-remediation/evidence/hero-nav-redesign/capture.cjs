// Desktop hero/nav design pass: matched before/after capture + checks.
// Runs against a production build served on an own port (never the user's :3000).
// Usage: node capture.cjs <label>   e.g. node capture.cjs before
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const LABEL = process.argv[2] || "after";
const BASE = process.env.BASE || "http://localhost:3961";
const OUT = path.join(__dirname, LABEL);
fs.mkdirSync(OUT, { recursive: true });

// Desktop targets plus one mobile regression width.
const VIEWS = [
  ["1280x800", 1280, 800],
  ["1440x900", 1440, 900],
  ["1920x1080", 1920, 1080],
  ["1280x600-short", 1280, 600],
  ["375x812-regression", 375, 812],
];

const report = { label: LABEL, measured: [], checks: {}, contrast: {}, errors: [] };

async function newPage(browser, w, h, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    reducedMotion: opts.reducedMotion || "no-preference",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));
  return { ctx, page, errors };
}

(async () => {
  const browser = await chromium.launch();

  for (const [name, w, h] of VIEWS) {
    const { ctx, page, errors } = await newPage(browser, w, h);
    await page.goto(BASE + "/", { waitUntil: "load" });
    // Let the staged entrance settle; the shader loads on idle.
    await page.waitForTimeout(2200);

    const measured = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      headerHeight: document.querySelector("nav")?.getBoundingClientRect().height ?? null,
      h1FontSize: getComputedStyle(document.querySelector("h1")).fontSize,
      h1Top: document.querySelector("h1")?.getBoundingClientRect().top ?? null,
    }));
    report.measured.push({ view: name, ...measured });
    await page.screenshot({ path: path.join(OUT, `landing-${name}-top.png`) });

    // Header after scrolling: compaction and legibility.
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `landing-${name}-scrolled.png`) });

    if (errors.length) report.errors.push({ view: name, errors });
    await ctx.close();
  }

  // Reduced motion at the primary desktop width.
  {
    const { ctx, page } = await newPage(browser, 1440, 900, { reducedMotion: "reduce" });
    await page.goto(BASE + "/", { waitUntil: "load" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, "landing-1440x900-reduced-motion.png") });
    report.checks.reducedMotionHeadlineVisible = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const cs = getComputedStyle(h1);
      return { opacity: cs.opacity, visible: h1.getBoundingClientRect().height > 0 };
    });
    await ctx.close();
  }

  // Hover + keyboard focus on the hero and nav actions.
  {
    const { ctx, page } = await newPage(browser, 1440, 900);
    await page.goto(BASE + "/", { waitUntil: "load" });
    await page.waitForTimeout(1800);
    const primary = page.locator('a[href="/signup"]').first();
    await primary.hover();
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(OUT, "hero-action-hover.png"), clip: { x: 0, y: 0, width: 1440, height: 760 } });

    // Keyboard order from the top of the document.
    const order = [];
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press("Tab");
      order.push(await page.evaluate(() => {
        const a = document.activeElement;
        const r = a.getBoundingClientRect();
        const cs = getComputedStyle(a);
        return {
          tag: a.tagName,
          text: (a.textContent || "").trim().slice(0, 24),
          href: a.getAttribute("href"),
          outline: cs.outlineStyle !== "none" || cs.boxShadow !== "none",
          top: Math.round(r.top),
          height: Math.round(r.height),
        };
      }));
    }
    report.checks.keyboardOrder = order;
    await page.screenshot({ path: path.join(OUT, "focus-visible.png"), clip: { x: 0, y: 0, width: 1440, height: 400 } });

    // Anchor targets resolve and are not hidden behind the fixed header.
    const anchors = {};
    for (const id of ["one-cue", "product", "features"]) {
      anchors[id] = await page.evaluate((anchorId) => {
        const el = document.getElementById(anchorId);
        if (!el) return { exists: false };
        el.scrollIntoView();
        const r = el.getBoundingClientRect();
        const nav = document.querySelector("nav").getBoundingClientRect();
        return { exists: true, top: Math.round(r.top), navBottom: Math.round(nav.bottom), obscured: r.top < nav.bottom - 1 };
      }, id);
    }
    report.checks.anchors = anchors;

    // Contrast of hero text over the gradient's brightest relevant state.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    report.contrast = await page.evaluate(() => {
      const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
      const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      // Sample the composited background under each text node by reading the
      // painted pixels behind it is not possible without a screenshot, so use the
      // brightest static gradient stop (measured separately) as the worst case.
      const results = [];
      const nodes = [document.querySelector("h1"), ...document.querySelectorAll("section:first-of-type p")];
      for (const el of nodes) {
        if (!el) continue;
        const cs = getComputedStyle(el);
        const fg = parse(cs.color);
        const size = parseFloat(cs.fontSize);
        const weight = Number(cs.fontWeight) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        results.push({ text: (el.textContent || "").trim().slice(0, 32), fontSize: size, large, color: cs.color, fgLum: lum(fg) });
      }
      return { nodes: results };
    });
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ label: LABEL, measured: report.measured, checks: report.checks, errors: report.errors }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

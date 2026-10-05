// Measures hero/nav text contrast against the ACTUAL composited background,
// including the WebGL mesh gradient at its brightest sampled state.
//
// Method: wait for the shader to mount, collect each text element's box and
// computed colour, hide only those text elements (visibility:hidden, so layout
// and the background layers are unchanged), screenshot, then take the BRIGHTEST
// pixel inside each box as the worst case for light-on-dark text.
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE || "http://localhost:3961";
const OUT = path.join(__dirname, "after");

const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

const SELECTORS = [
  ["hero label", "section[data-cue='Standby'] p.hero-rise:first-of-type"],
  ["hero h1", "section[data-cue='Standby'] h1"],
  ["hero support", "section[data-cue='Standby'] p.hero-rise-2"],
  ["hero caption", "section[data-cue='Standby'] figcaption"],
  ["nav link", "nav a[href='#one-cue']"],
  ["nav log in", "nav a[href='/login']"],
  ["hero quiet action", "section[data-cue='Standby'] a[href='#product']"],
];

(async () => {
  const results = [];
  const browser = await chromium.launch();
  for (const width of [1440, 1920]) {
    const ctx = await browser.newContext({ viewport: { width, height: 950 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "load" });
    // Give the progressive shader time to mount and animate to its brightest state.
    await page.waitForTimeout(4000);
    const shaderMounted = await page.evaluate(() => Boolean(document.querySelector(".hero-light canvas")));

    const boxes = await page.evaluate((sels) => {
      const out = [];
      for (const [name, sel] of sels) {
        const el = document.querySelector(sel);
        if (!el) { out.push({ name, missing: true }); continue; }
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const size = parseFloat(cs.fontSize);
        const weight = Number(cs.fontWeight) || 400;
        out.push({
          name, color: cs.color, fontSize: size, weight,
          large: size >= 24 || (size >= 18.66 && weight >= 700),
          // Document coordinates: the screenshot below is full-page, so elements
          // beneath the fold (e.g. the capture's caption) are measured too.
          x: Math.max(0, Math.floor(r.left + window.scrollX)), y: Math.max(0, Math.floor(r.top + window.scrollY)),
          w: Math.ceil(r.width), h: Math.ceil(r.height),
        });
      }
      return out;
    }, SELECTORS);

    // Hide only the measured text, leaving every background layer untouched.
    await page.evaluate((sels) => {
      for (const [, sel] of sels) {
        const el = document.querySelector(sel);
        if (el) el.style.visibility = "hidden";
      }
    }, SELECTORS);
    await page.waitForTimeout(250);
    const shot = await page.screenshot({ fullPage: true });
    if (width === 1440) fs.writeFileSync(path.join(OUT, "contrast-background-1440.png"), shot);
    const png = PNG.sync.read(shot);

    for (const b of boxes) {
      if (b.missing) { results.push({ width, ...b }); continue; }
      let worst = -1, worstPx = null, sampled = 0;
      const x1 = Math.min(png.width, b.x + b.w), y1 = Math.min(png.height, b.y + b.h);
      for (let y = b.y; y < y1; y++) {
        for (let x = b.x; x < x1; x++) {
          const i = (png.width * y + x) << 2;
          const L = lum(png.data[i], png.data[i + 1], png.data[i + 2]);
          sampled++;
          if (L > worst) { worst = L; worstPx = [png.data[i], png.data[i + 1], png.data[i + 2]]; }
        }
      }
      if (sampled === 0) { results.push({ width, name: b.name, error: "no pixels sampled" }); continue; }
      const fg = (b.color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const r = ratio(lum(fg[0], fg[1], fg[2]), worst);
      results.push({
        width, name: b.name, fontSize: b.fontSize, large: b.large, color: b.color,
        brightestBackground: worstPx, ratio: Number(r.toFixed(2)),
        required: b.large ? 3 : 4.5, pass: r >= (b.large ? 3 : 4.5), shaderMounted,
      });
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "contrast.json"), JSON.stringify(results, null, 2));
  for (const r of results) {
    if (r.missing || r.error) { console.log(`${r.width} ${r.name}: ${r.error || "MISSING"}`); continue; }
    console.log(`${r.width} ${String(r.name).padEnd(18)} ${String(r.fontSize).padStart(5)}px ${r.large ? "large" : "normal"} ratio ${String(r.ratio).padStart(6)} need ${r.required} ${r.pass ? "PASS" : "FAIL"} shader:${r.shaderMounted}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });

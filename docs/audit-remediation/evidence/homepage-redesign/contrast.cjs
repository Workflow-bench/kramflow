// Text contrast against the ACTUAL composited background, including the live mesh
// gradient. Method: wait for the shader, record each text element's box and colour,
// hide only those text elements (layout and every background layer unchanged),
// screenshot full-page, then take the BRIGHTEST pixel inside each box as the worst
// case for light-on-dark text. Sampled twice, seconds apart, so the moving gradient's
// extremes are both covered.
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const fs = require("fs");
const path = require("path");
const BASE = process.env.BASE || "http://localhost:3961";
const OUT = path.join(__dirname, "after");

const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const SELECTORS = [
  ["hero eyebrow", ".hero-eyebrow"],
  ["hero h1", ".hero-title"],
  ["hero body", ".hero-body"],
  ["hero caption", ".hero-aperture-row p"],
  ["hero view-full button", '.hero-aperture-row button'],
  ["nav link", 'nav a[href="#prepare"]'],
  ["nav log in", 'nav a[href="/login"]'],
  ["hero quiet action", '.hero-section a[href="#prepare"]'],
  ["closing h2", 'section[data-cue="The next show"] h2'],
  ["closing body", 'section[data-cue="The next show"] p.mt-6'],
  // Measured against its own opaque chip, not the page: it is a fixed overlay with a
  // solid background, so the page pixels behind it are not what the text sits on.
  ["motion control", 'button[aria-pressed]', "ownBackground"],
];

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const [pass, wait] of [["sample-1", 1200], ["sample-2", 4200]]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.goto(BASE + "/", { waitUntil: "load" });
    await p.waitForFunction(() => Boolean(document.querySelector(".hero-section canvas")), { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(wait);
    const shaderMounted = await p.evaluate(() => Boolean(document.querySelector(".hero-section canvas")));

    const boxes = await p.evaluate((sels) => sels.map(([name, sel, mode]) => {
      const el = document.querySelector(sel);
      if (!el) return { name, missing: true };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight) || 400;
      return { name, color: cs.color, fontSize: size, ownBackground: mode === "ownBackground" ? cs.backgroundColor : null,
        large: size >= 24 || (size >= 18.66 && weight >= 700),
        x: Math.max(0, Math.floor(r.left + scrollX)), y: Math.max(0, Math.floor(r.top + scrollY)),
        w: Math.ceil(r.width), h: Math.ceil(r.height) };
    }), SELECTORS);

    await p.evaluate((sels) => sels.forEach(([, sel, mode]) => {
      if (mode === "ownBackground") return; // keep it painted; it is measured analytically
      const el = document.querySelector(sel);
      if (el) el.style.visibility = "hidden";
    }), SELECTORS);
    await p.waitForTimeout(200);
    const shot = await p.screenshot({ fullPage: true });
    if (pass === "sample-1") fs.writeFileSync(path.join(OUT, "contrast-background.png"), shot);
    const png = PNG.sync.read(shot);

    for (const b of boxes) {
      if (b.missing) { results.push({ pass, ...b }); continue; }
      if (b.ownBackground) {
        const bg = (b.ownBackground.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const fg0 = (b.color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        const rr = ratio(lum(fg0[0], fg0[1], fg0[2]), lum(bg[0], bg[1], bg[2]));
        results.push({ pass, name: b.name, fontSize: b.fontSize, large: b.large, brightestBackground: bg,
          ratio: +rr.toFixed(2), required: b.large ? 3 : 4.5, pass_: rr >= (b.large ? 3 : 4.5), shaderMounted,
          method: "own opaque background" });
        continue;
      }
      let worst = -1, px = null, n = 0;
      for (let y = b.y; y < Math.min(png.height, b.y + b.h); y++) {
        for (let x = b.x; x < Math.min(png.width, b.x + b.w); x++) {
          const i = (png.width * y + x) << 2;
          const L = lum(png.data[i], png.data[i+1], png.data[i+2]);
          n++;
          if (L > worst) { worst = L; px = [png.data[i], png.data[i+1], png.data[i+2]]; }
        }
      }
      if (!n) { results.push({ pass, name: b.name, error: "no pixels" }); continue; }
      const fg = (b.color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const r = ratio(lum(fg[0], fg[1], fg[2]), worst);
      results.push({ pass, name: b.name, fontSize: b.fontSize, large: b.large, brightestBackground: px,
        ratio: +r.toFixed(2), required: b.large ? 3 : 4.5, pass_: r >= (b.large ? 3 : 4.5), shaderMounted });
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "contrast.json"), JSON.stringify(results, null, 2));
  let worstFail = 0;
  for (const r of results) {
    if (r.missing || r.error) { console.log(`${r.pass} ${r.name}: ${r.error || "MISSING"}`); continue; }
    if (!r.pass_) worstFail++;
    console.log(`${r.pass} ${String(r.name).padEnd(22)} ${String(r.fontSize).padStart(5)}px ${r.large?"large ":"normal"} ratio ${String(r.ratio).padStart(6)} need ${r.required} ${r.pass_?"PASS":"FAIL"}`);
  }
  console.log("FAILURES:", worstFail);
})().catch(e => { console.error(e); process.exit(1); });

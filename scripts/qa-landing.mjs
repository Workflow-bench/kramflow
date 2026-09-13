// Landing-page QA: screenshots and measurements across the breakpoint
// matrix, in a clean (logged-out) context — the marketing page only ever
// renders for a signed-out visitor, and a signed-in browser is redirected
// to /dashboard by proxy.ts, so an authenticated tab cannot see it at all.
//
// Run with the dev server up:  node scripts/qa-landing.mjs [--full]

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const FULL = process.argv.includes("--full");
const OUT = path.join(process.cwd(), ".qa");
mkdirSync(OUT, { recursive: true });

const WIDTHS = [390, 414, 768, 834, 1024, 1280, 1440, 1920];

const browser = await chromium.launch();
const report = [];

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: Math.round(width * 0.62) + 300 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 160)}`));

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2500);

  const metrics = await page.evaluate(() => {
    const de = document.documentElement;
    const spills = [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > de.clientWidth + 1.5 || r.left < -1.5);
      })
      .filter((el) => getComputedStyle(el).pointerEvents !== "none")
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}`);
    const heads = [...document.querySelectorAll("h1,h2,h3")];
    return {
      url: location.pathname,
      horizontalOverflow: de.scrollWidth - de.clientWidth,
      docHeight: de.scrollHeight,
      spills,
      h1Count: document.querySelectorAll("h1").length,
      headingOrder: heads.map((h) => h.tagName).join(" "),
      h1Size: parseFloat(getComputedStyle(document.querySelector("h1")).fontSize),
      h2Sizes: [...document.querySelectorAll("h2")].map((h) => parseFloat(getComputedStyle(h).fontSize)),
      imgCount: document.querySelectorAll("img").length,
      imgsMissingAlt: [...document.querySelectorAll("img")].filter((i) => !i.getAttribute("alt")).length,
      brokenImgs: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0).length,
      landmarks: [...document.querySelectorAll("main,nav,footer,header")].map((e) => e.tagName).join(","),
      placeholderLinks: document.querySelectorAll('a[href="#"]').length,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });

  // Small touch targets on the interactive controls.
  const smallTargets = await page.evaluate(() =>
    [...document.querySelectorAll("a,button")]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 38 || r.width < 24))
      .slice(0, 8)
      .map(({ el, r }) => `${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 22)}" ${Math.round(r.width)}x${Math.round(r.height)}`)
  );

  if (FULL) {
    await page.screenshot({ path: path.join(OUT, `landing-${width}-full.png`), fullPage: true });
  }
  await page.screenshot({ path: path.join(OUT, `landing-${width}.png`) });

  report.push({ width, ...metrics, smallTargets, consoleErrors: consoleErrors.slice(0, 4) });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));

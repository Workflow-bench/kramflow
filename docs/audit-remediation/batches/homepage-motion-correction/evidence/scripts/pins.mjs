import { chromium } from "/Users/deeppatel/Documents/AI/Shibir/stageflow/node_modules/playwright/index.mjs";
const b = await chromium.launch();
for (const base of ["http://localhost:3971/", "http://localhost:3961/"]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(base, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => ({
    pinSpacers: document.querySelectorAll(".pin-spacer").length,
    insideContent: document.querySelectorAll("#smooth-content .pin-spacer").length,
    outsideContent: document.querySelectorAll(".pin-spacer:not(#smooth-content .pin-spacer)").length,
    wrappers: document.querySelectorAll("#smooth-wrapper").length,
    contentTransform: !!document.querySelector("#smooth-content")?.style.transform,
  }));
  console.log(base, JSON.stringify(r));
  await p.close();
}
await b.close();

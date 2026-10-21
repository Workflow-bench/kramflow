import { chromium } from "/Users/deeppatel/Documents/AI/Shibir/stageflow/node_modules/playwright/index.mjs";
const BASE = "http://localhost:3961/";
const OUT = process.env.OUT;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(100); // boot cover, pre-hydration
await page.screenshot({ path: `${OUT}/v2-boot-cover-1440x900.png` });
await page.waitForTimeout(500); // mid entrance slide
await page.screenshot({ path: `${OUT}/v2-entrance-1440x900.png` });
await page.waitForTimeout(900); // mid word-cycle
await page.screenshot({ path: `${OUT}/v2-cycle-1440x900.png` });
await page.waitForTimeout(1500); // exit/curtain window
await page.screenshot({ path: `${OUT}/v2-curtain-1440x900.png` });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/v2-settled-1440x900.png` });
await ctx.close();
await browser.close();
console.log("done");

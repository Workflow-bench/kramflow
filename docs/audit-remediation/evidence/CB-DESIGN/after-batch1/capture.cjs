// Controlled public-page capture: production build, own port. No auth submissions.
const { chromium } = require('playwright');
const BASE = 'http://localhost:3963';
const pages = [['home', '/'], ['login', '/login'], ['signup', '/signup'], ['reset', '/reset']];
const sizes = [['desk', 1280, 800], ['tab', 900, 1000], ['m375', 375, 812], ['m320', 320, 640], ['short', 1280, 520]];
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const [pn, path] of pages) for (const [sn, w, h] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); const page = await ctx.newPage();
    const errs = []; page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); }); page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
    await page.goto(BASE + path, { waitUntil: 'load' }); await page.waitForTimeout(900);
    const info = await page.evaluate(() => ({ h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main').length, overflowX: document.documentElement.scrollWidth - innerWidth, h1Text: document.querySelector('h1')?.textContent.trim().slice(0, 60) }));
    await page.screenshot({ path: `${__dirname}/${pn}-${sn}.png`, fullPage: false });
    out[`${pn}-${sn}`] = { ...info, consoleErrors: errs };
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

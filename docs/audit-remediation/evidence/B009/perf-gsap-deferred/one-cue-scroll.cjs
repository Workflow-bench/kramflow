const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const reduce of ['no-preference', 'reduce']) {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: reduce });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.goto('http://localhost:3950/', { waitUntil: 'domcontentloaded' });
    // first paint: sample before GSAP can have loaded
    const first = await page.evaluate(() => { const el = document.querySelector('[data-console-after]'); return el ? getComputedStyle(el).opacity : null; });
    await page.waitForTimeout(2500);
    const top = await page.evaluate(() => { const el = document.querySelector('[data-console-after]'); return el ? getComputedStyle(el).opacity : null; });
    const navCompactTop = await page.evaluate(() => document.querySelector('nav')?.getAttribute('data-compact'));
    const sec = await page.evaluate(() => { const r = document.querySelector('#one-cue'); return r ? r.getBoundingClientRect().top + window.scrollY : 0; });
    const samples = [];
    for (const frac of [0.2, 0.5, 0.9, 1.6, 2.6]) {
      await page.evaluate(y => window.scrollTo(0, y), sec + frac * 600); await page.waitForTimeout(700);
      samples.push(await page.evaluate(() => { const el = document.querySelector('[data-console-after]'); return el ? +(+getComputedStyle(el).opacity).toFixed(2) : null; }));
    }
    await page.evaluate(() => window.scrollTo(0, 400)); await page.waitForTimeout(700);
    const navCompactScrolled = await page.evaluate(() => document.querySelector('nav')?.getAttribute('data-compact'));
    console.log(JSON.stringify({ mode: reduce, firstPaintAfterOpacity: first, afterLoadTopOpacity: top, navCompactAtTop: navCompactTop, navCompactAt400px: navCompactScrolled, consoleAfterOpacityThroughPin: samples, pageErrors: errs.length }));
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

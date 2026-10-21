// Hero visibility without JavaScript (server HTML + CSS only), and reduced-motion final state.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const out = {};
  for (const [label, js, reduce] of [['noJs', false, 'no-preference'], ['js', true, 'no-preference'], ['noJsReduced', false, 'reduce']]) {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, javaScriptEnabled: js, reducedMotion: reduce });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3957/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3200);
    out[label] = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const p = document.querySelector('.hero-rise');
      const cs = (el) => el ? getComputedStyle(el) : null;
      return { h1Text: h1?.textContent.trim(), h1Visible: h1 ? (h1.getBoundingClientRect().height > 0) : false, lineOpacity: cs(document.querySelector('.hero-line'))?.transform, riseOpacity: cs(p)?.opacity, reduceMatch: matchMedia('(prefers-reduced-motion: reduce)').matches };
    });
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

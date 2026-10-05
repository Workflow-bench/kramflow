const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const mode of ['reduce', 'no-preference']) {
    const ctx = await browser.newContext({ reducedMotion: mode, viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://localhost:3943/', { waitUntil: 'load' });
    const t200 = await page.evaluate(() => new Promise(r => setTimeout(() => {
      const cover = document.querySelector('.standby-cover');
      const nav = document.querySelector('nav');
      const light = document.querySelector('.standby-light');
      r({
        coverDisplay: cover ? getComputedStyle(cover).display : 'absent',
        navCompact: nav?.getAttribute('data-compact'),
        lightAnimDuration: light ? getComputedStyle(light).animationDuration : null,
        mqReduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
    }, 200)));
    await page.waitForTimeout(3000);
    const after = await page.evaluate(() => {
      const hasTransitionLong = [...document.querySelectorAll('body *')].filter(el => {
        const s = getComputedStyle(el); return parseFloat(s.transitionDuration) > 0.05 && s.transitionProperty !== 'none';
      }).length;
      return { longTransitionEls: hasTransitionLong, scrollWidth: document.documentElement.scrollWidth - innerWidth, errors: 0 };
    });
    out[mode] = { t200, after, pageErrors: errors.length, sampleErrors: errors.slice(0, 3) };
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

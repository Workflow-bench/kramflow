const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__lcp = [];
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), size: e.size, url: (e.url||'').slice(-40), el: e.element ? e.element.tagName + ' ' + (e.element.getAttribute('alt')||'').slice(0,30) : null }); }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await page.goto('http://localhost:3943/', { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => {
    const img = [...document.querySelectorAll('img')].find(i => (i.getAttribute('alt')||'').startsWith('Kramflow Operator Console'));
    const chain = []; let e = img; while (e) { const s = getComputedStyle(e); if (s.opacity !== '1' || s.transform !== 'none') chain.push(e.tagName + ' op=' + s.opacity + ' tf=' + s.transform.slice(0,40)); e = e.parentElement; }
    const cover = document.querySelector('.standby-cover');
    return { lcp: window.__lcp, complete: img && img.complete, naturalW: img && img.naturalWidth, rect: img && img.getBoundingClientRect().toJSON(), chain, coverDisplay: cover && getComputedStyle(cover).display, standbyAnimEnd: cover && cover.getAnimations().map(a=>a.playState) };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

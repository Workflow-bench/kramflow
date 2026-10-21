const { chromium } = require('playwright');
const BASE = 'http://localhost:3944';
(async () => {
  const b = await chromium.launch();
  const out = { reflow: {}, skipLink: {}, headings: {}, unnamed: {}, linkExpired: {} };
  for (const w of [320, 375, 768, 1024, 1440]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage();
    await p.goto(BASE + '/', { waitUntil: 'load' }); await p.waitForTimeout(3500);
    out.reflow[w] = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (w === 1440) {
      const hs = await p.evaluate(() => [...document.querySelectorAll('h1,h2,h3')].filter(h => !h.closest('[aria-hidden="true"]') && getComputedStyle(h).display !== 'none').map(h => h.tagName + ':' + h.textContent.trim().slice(0, 60)));
      const counts = {}; hs.forEach(h => counts[h] = (counts[h] || 0) + 1);
      out.headings = { total: hs.length, duplicates: Object.entries(counts).filter(([, c]) => c > 1) };
      out.unnamed = await p.evaluate(() => [...document.querySelectorAll('a,button')].filter(el => getComputedStyle(el).display !== 'none' && !el.closest('[aria-hidden="true"]') && !(el.textContent.trim() || el.getAttribute('aria-label') || el.getAttribute('title'))).length);
      await p.keyboard.press('Tab');
      const first = await p.evaluate(() => ({ text: document.activeElement.textContent.trim(), href: document.activeElement.getAttribute('href') }));
      await p.keyboard.press('Enter'); await p.waitForTimeout(200);
      out.skipLink = { firstFocus: first, afterEnter: await p.evaluate(() => ({ id: document.activeElement.id, tag: document.activeElement.tagName })) };
    }
    await p.context().close();
  }
  const lp = await (await b.newContext()).newPage();
  await lp.goto(BASE + '/login?link=expired', { waitUntil: 'load' }); await lp.waitForTimeout(1500);
  out.linkExpired = { text: await lp.evaluate(() => document.querySelector('[role=status]')?.textContent.trim() || null), resetLink: await lp.evaluate(() => !!document.querySelector('a[href="/reset"]')) };
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

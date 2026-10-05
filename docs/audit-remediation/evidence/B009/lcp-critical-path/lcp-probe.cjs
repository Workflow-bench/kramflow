// Mobile LCP critical path under Lighthouse-like throttling (CDP). Records request order and timings.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:3959/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const reqs = new Map();
  cdp.on('Network.requestWillBeSent', e => reqs.set(e.requestId, { url: e.request.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 90), t0: e.timestamp, type: e.type, prio: e.request.initialPriority }));
  cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) r.tResp = e.timestamp; });
  cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) r.tEnd = e.timestamp; });
  await page.addInitScript(() => { window.__lcp = null; new PerformanceObserver(l => { const e = l.getEntries().at(-1); window.__lcp = { t: e.startTime, id: e.element?.getAttribute?.('alt')?.slice(0, 30) || e.element?.tagName, size: e.size }; }).observe({ type: 'largest-contentful-paint', buffered: true }); });
  const nav0 = Date.now();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const lcp = await page.evaluate(() => window.__lcp);
  const t0 = Math.min(...[...reqs.values()].map(r => r.t0));
  const rows = [...reqs.values()].sort((a, b) => a.t0 - b.t0).map(r => ({ url: r.url, type: r.type, prio: r.prio, startMs: Math.round((r.t0 - t0) * 1000), endMs: r.tEnd ? Math.round((r.tEnd - t0) * 1000) : null })).filter(r => !/\.(woff2)$/.test(r.url) || true);
  const img = rows.find(r => /console-mobile-crop/.test(r.url));
  console.log(JSON.stringify({ lcp, cropRequest: img, requestsBeforeCrop: rows.filter(r => img && r.startMs <= img.startMs).length, totalRequests: rows.length, timeline: rows.slice(0, 40) }, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

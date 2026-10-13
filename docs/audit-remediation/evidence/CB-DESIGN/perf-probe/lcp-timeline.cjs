// Replays the page under Lighthouse-like mobile throttling (4x CPU, 150ms RTT, 1.6Mbps) and
// records every LCP candidate with its element and paint time. Controlled measurement only.
const { chromium } = require("playwright");
const url = process.argv[2] || "http://localhost:3959/";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
  await p.addInitScript(() => {
    window.__lcp = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), tag: e.element ? e.element.tagName + "." + (e.element.className || "").toString().slice(0, 40) : "", text: e.element ? (e.element.textContent || "").trim().slice(0, 40) : "", size: Math.round(e.size) }); }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__fcp = Math.round(e.startTime); }).observe({ type: "paint", buffered: true });
  });
  await p.goto(url, { waitUntil: "load" });
  await p.waitForTimeout(4000);
  console.log(JSON.stringify(await p.evaluate(() => ({ fcp: window.__fcp, lcp: window.__lcp, nav: Math.round(performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd) })), null, 1));
  await b.close();
})();

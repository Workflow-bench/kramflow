// KF-036.9 through the real display store in the browser, controlled transport (synthetic).
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000/dev/realtime';
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext()).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(400);
  const active = async () => (await page.locator('[data-active]').textContent()).replace('active broadcasts: ', '');
  const channels = async () => (await page.locator('[data-channels]').textContent()).replace('open channels: ', '');
  const out = {};
  // Scenario 1 (the race): subscribe, broadcast after hydrate and before SUBSCRIBED, first SUBSCRIBED.
  await page.click('[data-step=reset]'); await page.waitForTimeout(200);
  await page.click('[data-step=subscribe]'); await page.waitForTimeout(300);
  const hydrateActive = await active();
  await page.click('[data-step=send]'); await page.waitForTimeout(100);
  const beforeSubscribed = await active();
  await page.click('[data-step=subscribed]'); await page.waitForTimeout(400);
  out.firstConnectRace = { afterHydrate: hydrateActive, beforeFirstSubscribed: beforeSubscribed, afterFirstSubscribed: await active(), channels: await channels(), expected: 'b-1 visible after first SUBSCRIBED without another mutation' };
  // Scenario 2: drop, change lands, reconnect SUBSCRIBED refetches
  await page.click('[data-step=drop]'); await page.waitForTimeout(200);
  const duringDrop = await active();
  await page.click('[data-step=reconnect]'); await page.waitForTimeout(400);
  out.reconnect = { duringDrop, afterReconnect: await active() };
  // Scenario 3: unsubscribe removes the channel at zero listeners
  await page.click('[data-step=unsubscribe]'); await page.waitForTimeout(300);
  out.unsubscribe = { channelsAfter: await channels() };
  out.pageErrors = errs;
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

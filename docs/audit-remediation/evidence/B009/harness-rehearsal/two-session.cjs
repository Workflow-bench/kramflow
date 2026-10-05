const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  const mut = []; page.on('request', r => { if (r.method() !== 'GET' && !r.url().includes('_next')) mut.push(r.method()+' '+r.url()); });
  await page.goto('http://localhost:3947/dev/rehearsal?fixture=two', { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(1200);
  const trigger = page.getByRole('button', { name: /Session to rehearse/ }).or(page.getByLabel('Session to rehearse')).first();
  const triggerText = await trigger.textContent().catch(() => null);
  const triggerAria = await trigger.getAttribute('aria-haspopup').catch(() => null);
  await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.waitForTimeout(200);
  const startedOnDefault = await page.getByText('Rehearsing now').count();
  const titleOnDefault = await page.getByText('SYNTHETIC session A', { exact: false }).count();
  await trigger.click(); await page.waitForTimeout(250);
  await page.getByRole('option', { name: /SYNTHETIC session B/ }).click(); await page.waitForTimeout(300);
  const after = { notStarted: await page.getByText('Not started', { exact: true }).count(), titleB: await page.getByText('SYNTHETIC session B', { exact: false }).count() };
  console.log(JSON.stringify({ triggerText: triggerText && triggerText.trim().slice(0,80), triggerAriaHasPopup: triggerAria, startedOnDefault: startedOnDefault > 0, defaultTitleCount: titleOnDefault, afterChange: after, mutatingRequests: mut.length }, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

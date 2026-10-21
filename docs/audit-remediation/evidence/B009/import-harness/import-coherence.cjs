// Import refresh coherence and Open Console with the controlled harness store.
// Synthetic: the store is sessionStorage in the harness, not the real store.
const { chromium } = require('playwright');
const BASE = 'http://localhost:3947';
async function importAndOpen(page, index) {
  await page.setInputFiles('input[type=file]', { name: 'SYNTHETIC.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('synthetic') });
  await page.getByRole('button', { name: 'Preview', exact: true }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Confirm import', exact: true }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Open console' }).nth(index).click();
  await page.waitForURL('**/dev/import/console', { timeout: 30000 });
  await page.waitForTimeout(300);
}
const consoleLine = page => page.locator('[data-console-live]').textContent();
(async () => {
  const b = await chromium.launch();
  const out = {};
  // 1. Import -> Open console (PM) -> console shows PM live -> reload console -> same
  { const ctx = await b.newContext(); const page = await ctx.newPage(); const api = []; page.on('request', r => { if (r.url().includes('/api/') && !r.url().includes('/api/cue-sheet/upload')) api.push(r.url()); });
    await page.goto(BASE + '/dev/import?live=none', { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 });
    await importAndOpen(page, 1);
    const afterOpen = await consoleLine(page);
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400);
    const afterReload = await consoleLine(page);
    out.importOpenThenReload = { afterOpen, afterReload, coherent: afterOpen === afterReload, realApiRequests: api };
    await ctx.close(); }
  // 2. Same store, back to import after reload: store shows PM live; import page offers AM and PM; AM open is guarded (no other session started) and selects AM explicitly
  { const ctx = await b.newContext(); const page = await ctx.newPage();
    await page.goto(BASE + '/dev/import?live=none', { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 });
    await importAndOpen(page, 1); // PM live
    await page.goto(BASE + '/dev/import?live=none', { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(300);
    const storeOnReload = await page.locator('[data-harness-store]').textContent().catch(() => null);
    await importAndOpen(page, 0); // AM chosen while PM is live but NOT started
    out.refreshThenOpenOther = { storeOnReload, afterOpenAM: await consoleLine(page), note: 'PM was live, not started: AM opens by explicit click (selectSession path)' };
    await ctx.close(); }
  // 3. Running session guard: fixture started (PM running), open AM -> console opens unchanged, PM stays live
  { const ctx = await b.newContext(); const page = await ctx.newPage();
    await page.goto(BASE + '/dev/import?live=started', { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 });
    const storeStart = await page.locator('[data-harness-store]').textContent();
    await importAndOpen(page, 0);
    out.runningGuard = { storeAtStart: storeStart, afterOpenAM: await consoleLine(page), note: 'PM running: console opens without switching; the console shows PM' };
    await ctx.close(); }
  // 4. Locked: refuse, no navigation
  { const ctx = await b.newContext(); const page = await ctx.newPage();
    await page.goto(BASE + '/dev/import?live=locked', { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 });
    await page.setInputFiles('input[type=file]', { name: 'SYNTHETIC.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('synthetic') });
    await page.getByRole('button', { name: 'Preview', exact: true }).click(); await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Confirm import', exact: true }).click(); await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Open console' }).nth(0).click(); await page.waitForTimeout(500);
    out.lockedRefusal = { stillOnImport: page.url().includes('/dev/import') && !page.url().includes('/console'), outcome: await page.locator('[data-harness-outcome]').textContent() };
    await ctx.close(); }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

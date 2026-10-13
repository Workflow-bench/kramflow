const { chromium } = require('playwright');
const BASE = 'http://localhost:3947/dev/import';
const out = {};
async function run(b, label, q) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  const api = []; page.on('request', r => { if (r.url().includes('/api/') || (r.method() !== 'GET' && !r.url().includes('_next'))) api.push(r.method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '')); });
  await page.goto(BASE + q, { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(800);
  await page.setInputFiles('input[type=file]', { name: 'SYNTHETIC-cuesheet.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('synthetic') });
  await page.waitForTimeout(150);
  return { ctx, page, api };
}
(async () => {
  const b = await chromium.launch();
  // A. happy path, nothing live
  { const { ctx, page, api } = await run(b, 'A', '?live=none&fail=none');
    await page.getByRole('button', { name: 'Preview', exact: true }).click(); await page.waitForTimeout(400);
    const previewShown = await page.getByText('SYNTHETIC cue A1').count();
    await page.getByRole('button', { name: 'Confirm import', exact: true }).click(); await page.waitForTimeout(400);
    const headingNames = await page.evaluate(() => [...document.querySelectorAll('[data-harness-banner], p, li')].map(e => e.textContent.trim()).filter(t => /wrote|SYNTHETIC Sat/.test(t)).slice(0, 6));
    const selectedBefore = await page.locator('[data-harness-selected]').textContent();
    const openButtons = await page.getByRole('button', { name: 'Open console' }).count();
    await page.getByRole('button', { name: 'Open console' }).nth(1).click(); await page.waitForTimeout(300);
    out.A_happyPath = { previewShown: previewShown > 0, openButtons, listed: headingNames, selectedBeforeAnyClick: selectedBefore, outcome: await page.locator('[data-harness-outcome]').textContent(), selectedAfterExplicitClick: await page.locator('[data-harness-selected]').textContent(), apiRequests: api, axDialogs: await page.evaluate(() => document.querySelectorAll('[role=alertdialog]').length) };
    await ctx.close(); }
  // B. parse error
  { const { ctx, page, api } = await run(b, 'B', '?live=none&fail=parse');
    await page.getByRole('button', { name: 'Preview', exact: true }).click(); await page.waitForTimeout(400);
    const err = await page.getByText('SYNTHETIC parse error', { exact: false }).first().evaluate(el => ({ text: el.textContent.trim(), role: el.getAttribute('role'), live: el.closest('[aria-live]')?.getAttribute('aria-live') || null }));
    out.B_parseError = { error: err, confirmAvailable: await page.getByRole('button', { name: 'Confirm import', exact: true }).count(), importStepShown: await page.getByText('The import wrote').count(), apiRequests: api };
    await ctx.close(); }
  // C. commit error: nothing written, no completion step
  { const { ctx, page, api } = await run(b, 'C', '?live=none&fail=commit');
    await page.getByRole('button', { name: 'Preview', exact: true }).click(); await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Confirm import', exact: true }).click(); await page.waitForTimeout(400);
    const err = await page.getByText('SYNTHETIC commit failed', { exact: false }).first().evaluate(el => ({ text: el.textContent.trim(), role: el.getAttribute('role') }));
    out.C_commitError = { error: err, importStepShown: await page.getByText('The import wrote').count(), previewStillShown: await page.getByText('SYNTHETIC cue A1').count(), apiRequests: api };
    await ctx.close(); }
  // D. another session running: open another does not switch it
  { const { ctx, page, api } = await run(b, 'D', '?live=started&fail=none');
    await page.getByRole('button', { name: 'Preview', exact: true }).click(); await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Confirm import', exact: true }).click(); await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Open console' }).nth(0).click(); await page.waitForTimeout(300);
    out.D_runningSession = { outcome: await page.locator('[data-harness-outcome]').textContent(), selectSessionCalls: await page.locator('[data-harness-selected]').textContent(), apiRequests: api };
    await ctx.close(); }
  // E. control held by another operator: refused
  { const { ctx, page, api } = await run(b, 'E', '?live=locked&fail=none');
    await page.getByRole('button', { name: 'Preview', exact: true }).click(); await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Confirm import', exact: true }).click(); await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Open console' }).nth(0).click(); await page.waitForTimeout(300);
    out.E_locked = { outcome: await page.locator('[data-harness-outcome]').textContent(), selectSessionCalls: await page.locator('[data-harness-selected]').textContent(), apiRequests: api };
    await ctx.close(); }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

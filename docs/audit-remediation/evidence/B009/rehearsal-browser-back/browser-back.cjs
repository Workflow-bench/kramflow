// Rehearsal browser back/forward. Rehearsal state is local and unpersisted (by design),
// so back/forward must not trap the operator (no beforeunload prompt) and must not
// carry progress across a history visit.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  const dialogs = []; page.on('dialog', d => { dialogs.push(d.type()); d.accept(); });
  const api = []; page.on('request', r => { if (r.url().includes('/api/live') || (r.method() !== 'GET' && !r.url().includes('_next'))) api.push(r.method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '')); });
  const state = async () => ({ url: new URL(page.url()).pathname + new URL(page.url()).search, notStarted: await page.getByText('Not started', { exact: true }).count(), rehearsing: await page.getByText('Rehearsing now').count(), cue: (await page.evaluate(() => (document.body.innerText.match(/SYNTHETIC cue \d+/) || [])[0] || null)), dialogOpen: await page.evaluate(() => !!document.querySelector('[role=alertdialog]')) });
  await page.goto('http://localhost:3947/dev/rehearsal?fixture=multi', { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Start Rehearsal' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(200);
  const A = await state();
  await page.evaluate(() => { window.location.href = '/dev/import?live=none'; }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(300);
  const B = await state();
  await page.goBack(); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(300);
  const C = await state();
  // back while the exit dialog is open
  await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Exit Rehearsal' }).click(); await page.waitForTimeout(300);
  const D = await state();
  await page.evaluate(() => { window.location.href = '/dev/import?live=none'; }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 });
  await page.goBack(); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(300);
  const E2 = await state();
  await page.goForward(); await page.waitForTimeout(300);
  const F = await state();
  console.log(JSON.stringify({ A_progressBeforeNavigate: A, B_afterNavigateAway: B, C_afterBack_freshState: C, D_dialogOpenBeforeNavigate: D, E_backWithDialogOpen: E2, F_forwardToImport: F, browserDialogs: dialogs, liveOrMutatingRequests: api }, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

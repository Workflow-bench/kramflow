// Rehearsal navigation with real progress. Synthetic harness route (dev only).
// Covers reload/close (beforeunload), in-app Link navigation (Next router), browser back after in-app navigation.
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000/dev/rehearsal?fixture=multi';
const progress = page => page.evaluate(() => (document.body.innerText.match(/SYNTHETIC cue \d+/) || [])[0] || null);
const notStarted = page => page.getByText('Not started', { exact: true }).count();
async function fresh(b) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  const dialogs = []; page.on('dialog', async d => { dialogs.push(d.type()); await d.dismiss(); });
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(500);
  return { ctx, page, dialogs };
}
(async () => {
  const b = await chromium.launch(); const out = {};
  // A. no progress: reload raises no prompt
  { const { ctx, page, dialogs } = await fresh(b); await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(300);
    out.A_noProgressReload = { prompts: dialogs }; await ctx.close(); }
  // B. progress: reload raises beforeunload; dismissing keeps the page and its progress
  { const { ctx, page, dialogs } = await fresh(b);
    await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(200);
    const before = await progress(page);
    await page.reload({ waitUntil: 'load' }).catch(() => {}); await page.waitForTimeout(400);
    out.B_progressReload = { before, prompts: dialogs, afterDismissedReload: await progress(page), note: 'dismissed prompt keeps the page' }; await ctx.close(); }
  // C. progress: in-app Link navigation (Next router). Measures whether progress is protected.
  { const { ctx, page, dialogs } = await fresh(b);
    await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(200);
    const before = await progress(page);
    await page.locator('[data-in-app-link]').click(); await page.waitForURL('**/dev/import**', { timeout: 30000 }); await page.waitForTimeout(300);
    out.C_progressInAppLink = { before, urlAfter: new URL(page.url()).pathname, promptsShown: dialogs, progressProtected: dialogs.length > 0, note: 'no confirmation: in-app Link discards progress' };
    // D. browser back from there returns to a fresh rehearsal
    await page.goBack({ waitUntil: 'load' }); await page.waitForTimeout(400);
    out.D_backAfterInAppLink = { url: new URL(page.url()).pathname, progressRestored: await progress(page), notStarted: await notStarted(page), rehearsing: await page.getByText('Rehearsing now').count(), prompts: dialogs };
    // F. explicit discard: Run again resets in place
    await page.getByRole('button', { name: 'Reset rehearsal' }).click(); await page.waitForTimeout(200);
    out.F_resetAfterBack = { notStartedAfterReset: await notStarted(page), progressAfterReset: await progress(page) };
    await ctx.close(); }
  // E. progress: the in-app Exit button still confirms (dialog), Cancel keeps progress
  { const { ctx, page, dialogs } = await fresh(b);
    await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Exit Rehearsal' }).click(); await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.waitForTimeout(300);
    out.E_exitCancelKeepsProgress = { progressAfterCancel: await progress(page), prompts: dialogs }; await ctx.close(); }
  // G. confirmed Exit clears the stored run
  { const { ctx, page, dialogs } = await fresh(b);
    await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(200);
    await page.getByRole('button', { name: 'Exit Rehearsal' }).click(); await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Leave rehearsal', exact: true }).click(); await page.waitForTimeout(300);
    const keys = await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('kf-rehearsal-run')));
    out.G_confirmedExitClearsRun = { storedKeysAfterExit: keys, prompts: dialogs }; await ctx.close(); }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

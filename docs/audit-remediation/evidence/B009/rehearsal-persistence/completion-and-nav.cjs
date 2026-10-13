// Completion survives reload as completion (not as restartable progress); in-app Link keeps a completed run.
const { chromium } = require('playwright');
const url = 'http://localhost:3000/dev/rehearsal?fixture=multi&user=a&cues=current';
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const dialogs = []; page.on('dialog', async d => { dialogs.push(d.type()); await d.accept(); });
  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(400);
  await page.evaluate(() => Object.keys(sessionStorage).forEach(k => k.startsWith('kf-rehearsal-run:') && sessionStorage.removeItem(k)));
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Start Rehearsal' }).click();
  for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(120); }
  await page.getByRole('button', { name: 'Finish', exact: true }).click(); await page.waitForTimeout(300);
  const completed = await page.getByText('Rehearsal complete', { exact: true }).count();
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400);
  const afterReload = await page.getByText('Rehearsal complete', { exact: true }).count();
  const runAgain = await page.getByRole('button', { name: 'Run again' }).count();
  await page.locator('[data-in-app-link]').click(); await page.waitForURL('**/dev/import**', { timeout: 30000 });
  await page.goBack({ waitUntil: 'load' }); await page.waitForTimeout(400);
  const afterBack = await page.getByText('Rehearsal complete', { exact: true }).count();
  console.log(JSON.stringify({ completedBeforeReload: completed, completionAfterReload: afterReload, runAgainAvailable: runAgain, completionAfterInAppLinkAndBack: afterBack, dialogs }, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

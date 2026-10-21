// Rehearsal persistence rules in the browser (synthetic harness, dev only, controlled identity).
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000/dev/rehearsal?fixture=multi';
const url = (q) => `${BASE}&${q}`;
// The live cue is the first cue title after the REHEARSING NOW label (innerText is uppercase for labels).
const cue = page => page.evaluate(() => { const t = document.body.innerText; const i = t.toUpperCase().indexOf('REHEARSING NOW'); if (i < 0) return null; return (t.slice(i).match(/SYNTHETIC cue \d+/) || [])[0] || null; });
const notStarted = page => page.getByText('Not started', { exact: true }).count();
const stale = page => page.getByText('The cue list changed', { exact: false }).count();
const runKeys = page => page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('kf-rehearsal-run:')));
async function open(page, q) {
  await page.goto(url(q), { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(500);
}
(async () => {
  const b = await chromium.launch(); const out = {};
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  const dialogs = []; page.on('dialog', async d => { dialogs.push(d.type()); await d.accept(); }); // beforeunload: accept to leave (the prompt itself is recorded)
  // Start clean for this context
  await open(page, 'user=a&cues=current');
  await page.evaluate(() => Object.keys(sessionStorage).forEach(k => k.startsWith('kf-rehearsal-run:') && sessionStorage.removeItem(k)));
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400);
  // S1 user A: start, Next -> cue 2; reload keeps it (same user, event, session, cues)
  await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(200);
  const beforeReload = await cue(page);
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(500);
  out.S1_reloadSameIdentity = { beforeReload, afterReload: await cue(page), prompts: dialogs.slice() };
  // S2 identity isolation: user B sees a fresh run, not A's
  await open(page, 'user=b&cues=current');
  out.S2_otherIdentity = { cueShown: await cue(page), notStarted: await notStarted(page), keysForB: await runKeys(page) };
  // S3 back to user A: A's own run is still there (isolated, not overwritten)
  await open(page, 'user=a&cues=current');
  out.S3_backToA = { cue: await cue(page), keys: await runKeys(page) };
  // S4 cue data changed: stale run is not restored; notice shown; progress reset
  await open(page, 'user=a&cues=changed');
  out.S4_cueChanged = { staleNotice: await stale(page) > 0, cueShown: await cue(page), notStarted: await notStarted(page) };
  // S5 next action on the changed cues starts a fresh run, then a reload keeps that fresh run
  await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(200);
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400);
  out.S5_freshRunOnChangedCues = { cueAfterReload: await cue(page), staleNoticeAfterReload: await stale(page) };
  // S6 Reset rehearsal: explicit discard (no prompt needed: preservation is not at stake here)
  await page.getByRole('button', { name: 'Reset rehearsal', exact: true }).first().click(); await page.waitForTimeout(250);
  const resetDialogOpened = await page.getByRole('alertdialog').count();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click(); await page.waitForTimeout(250);
  const cueAfterCancel = await cue(page);
  await page.waitForFunction(() => !document.querySelector('[role=alertdialog]'), null, { timeout: 5000 });
  await page.getByRole('button', { name: 'Reset rehearsal', exact: true }).first().click(); await page.waitForTimeout(250);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset rehearsal', exact: true }).click(); await page.waitForTimeout(250);
  out.S6_reset = { resetDialogOpened, cueAfterCancel, notStartedAfterConfirm: await notStarted(page), keys: await runKeys(page) };
  // S7 sign-out clears all runs for every identity
  await open(page, 'user=a&cues=current');
  await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(150);
  await page.evaluate(() => {}); // progress recorded
  const before = await runKeys(page);
  await page.click('[data-signout]'); await page.waitForTimeout(300);
  out.S7_signOut = { keysBefore: before, keysAfter: await runKeys(page) };
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(400);
  out.S7_afterReload = { cue: await cue(page), notStarted: await notStarted(page) };
  // S8 no identity: nothing is written to sessionStorage
  await open(page, 'user=none&cues=current');
  await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(150);
  out.S8_noIdentity = { keysWritten: await runKeys(page), cue: await cue(page) };
  // S9 confirmed Exit clears the stored run for this identity
  await open(page, 'user=a&cues=current');
  await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Exit Rehearsal' }).click(); await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Leave rehearsal', exact: true }).click(); await page.waitForTimeout(250);
  out.S9_confirmedExit = { keysAfterExit: await runKeys(page) };
  out.browserDialogs = dialogs;
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

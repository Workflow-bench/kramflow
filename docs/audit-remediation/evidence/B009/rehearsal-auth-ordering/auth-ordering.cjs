// Auth-event ordering against rehearsal runs. Controlled seam: the harness applies the same
// policy (lib/auth/auth-events.ts) and clearing function the auth provider uses. Synthetic, dev only.
const { chromium } = require('playwright');
const ROOT = 'http://localhost:3000/dev/rehearsal?fixture=multi';
// One query per call: user and cues are set once, never duplicated.
const urlFor = (user, cues = 'current') => `${ROOT}&user=${user}&cues=${cues}`;
const cue = page => page.evaluate(() => { const t = document.body.innerText; const i = t.toUpperCase().indexOf('REHEARSING NOW'); if (i < 0) return null; return (t.slice(i).match(/SYNTHETIC cue \d+/) || [])[0] || null; });
const keys = page => page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('kf-rehearsal-run:')));
const stale = page => page.getByText('The cue list changed', { exact: false }).count();
async function open(page, url) { await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(400); }
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on('dialog', async d => d.accept());
  const out = {};
  await open(page, urlFor('a'));
  await page.evaluate(() => Object.keys(sessionStorage).forEach(k => k.startsWith('kf-rehearsal-run:') && sessionStorage.removeItem(k)));
  await open(page, urlFor('a'));
  // 1. A progresses to cue 2
  await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(200);
  out.A_progress = { cue: await cue(page), keys: await keys(page) };
  // 2. token refresh (A) keeps the run; a reload restores it
  await page.click('[data-auth="TOKEN_REFRESHED"]'); await page.waitForTimeout(200);
  await open(page, urlFor('a'));
  out.afterTokenRefreshAndReload_A = { cue: await cue(page), keys: await keys(page) };
  // 3. account switch to B clears A's run; B starts fresh
  await page.click('[data-auth="SIGNED_IN-B"]'); await page.waitForTimeout(300);
  out.afterSignedInB = { cue: await cue(page), keys: await keys(page) };
  // 4. B progresses; a failed sign-out keeps B's run and identity
  await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(200);
  await page.click('[data-signout-failed]'); await page.waitForTimeout(250);
  await open(page, urlFor('b'));
  out.B_afterFailedSignOutAndReload = { cue: await cue(page), keys: await keys(page) };
  // 5. confirmed sign-out clears everything
  await page.click('[data-signout]'); await page.waitForTimeout(250);
  out.afterConfirmedSignOut = { keys: await keys(page) };
  // 6. A signs back in; A's earlier run was cleared at sign-in B, so nothing is restored
  await page.click('[data-auth="SIGNED_IN-A"]'); await page.waitForTimeout(250);
  await open(page, urlFor('a'));
  out.A_signInAgain = { cue: await cue(page), keys: await keys(page) };
  // 7. stale cue data after re-login: A progresses, cues change, notice, no progress merged
  await page.getByRole('button', { name: 'Start Rehearsal' }).click(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(200);
  await open(page, urlFor('a', 'changed'));
  out.staleCuesAfterRelogin = { notice: await stale(page) > 0, cue: await cue(page) };
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

// Modal exclusion: AX tree and keyboard, rehearsal exit dialog (ConfirmDialog) and the Modal primitive.
const { chromium } = require('playwright');
async function axNames(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  return nodes.filter(n => !n.ignored && ['button', 'link', 'alertdialog', 'dialog'].includes(n.role?.value)).map(n => `${n.role.value}:${n.name?.value || ''}`);
}
const inertCount = page => page.evaluate(() => document.querySelectorAll('[inert]').length);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  await page.goto('http://localhost:3947/dev/rehearsal?fixture=multi', { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Start Rehearsal' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(200);
  const before = await axNames(page); const inertBefore = await inertCount(page);
  await page.getByRole('button', { name: 'Exit Rehearsal' }).click(); await page.waitForTimeout(400);
  const open = await axNames(page); const inertOpen = await inertCount(page);
  // keyboard: Tab across many presses; never lands outside the dialog
  const tabOutside = []; for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); tabOutside.push(await page.evaluate(() => !document.activeElement?.closest('[role=alertdialog]'))); }
  // direct attempt to focus a background control while open
  const bgFocus = await page.evaluate(() => { const n = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Next'); if (!n) return 'no-node'; n.focus(); return document.activeElement === n ? 'focused' : 'blocked'; });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const after = await axNames(page); const inertAfter = await inertCount(page);
  const focusBack = await page.evaluate(() => document.activeElement?.textContent.trim());
  const out = { backgroundInAxBeforeOpen: before.filter(x => /Next|Exit Rehearsal/.test(x)), axWhileOpen: open, inertElementsBefore: inertBefore, inertElementsWhileOpen: inertOpen, inertElementsAfterClose: inertAfter, keyboardTabEscapedDialog: tabOutside.some(Boolean), backgroundFocusWhileOpen: bgFocus, focusAfterEscape: focusBack, axAfterClose: after.filter(x => /Next|Exit Rehearsal/.test(x)) };
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

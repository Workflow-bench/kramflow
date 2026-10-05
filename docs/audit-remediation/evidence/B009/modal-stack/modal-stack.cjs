// Modal (lower) + ConfirmDialog (upper) stack. Real browser, real AX tree, real focus.
const { chromium } = require('playwright');
async function ax(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  return nodes.filter(n => !n.ignored && ['button', 'alertdialog', 'dialog'].includes(n.role?.value)).map(n => `${n.role.value}:${n.name?.value || ''}`);
}
const inertN = page => page.evaluate(() => document.querySelectorAll('[inert]').length);
const bgInAx = tree => tree.some(x => x === 'button:Background action');
const focused = page => page.evaluate(() => document.activeElement?.textContent.trim());
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  const out = {};
  await page.goto('http://localhost:3000/dev/modal', { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(600);
  out.start = { bgInAx: bgInAx(await ax(page)), inert: await inertN(page) };
  // 1. open lower
  await page.getByRole('button', { name: 'Manage links' }).click(); await page.waitForTimeout(400);
  let tree = await ax(page);
  out.lowerOpen = { bgInAx: bgInAx(tree), inert: await inertN(page), dialogs: tree.filter(x => x.startsWith('dialog') || x.startsWith('alertdialog')), focus: await focused(page) };
  // 2. open upper from the lower's "Revoke link"
  await page.getByRole('button', { name: 'Revoke link', exact: true }).click(); await page.waitForTimeout(400);
  tree = await ax(page);
  out.upperOpen = { bgInAx: bgInAx(tree), lowerDoneInAx: tree.includes('button:Done'), dialogs: tree.filter(x => /dialog/.test(x)), focus: await focused(page), inert: await inertN(page) };
  // 3. Escape closes the upper ONLY
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  tree = await ax(page);
  out.afterEscapeUpper = { upperOpen: tree.some(x => x === 'alertdialog:Revoke link?'), lowerStillOpen: tree.some(x => x.startsWith('dialog:Manage links') || x.includes('Manage links')) || tree.includes('button:Done'), bgInAx: bgInAx(tree), lowerDoneInAx: tree.includes('button:Done'), focus: await focused(page), inert: await inertN(page) };
  // 4. Cancel path of upper
  await page.getByRole('button', { name: 'Revoke link', exact: true }).click(); await page.waitForTimeout(400);
  await page.keyboard.press('Tab'); await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.waitForTimeout(400);
  tree = await ax(page);
  out.afterCancelUpper = { bgInAx: bgInAx(tree), lowerDoneInAx: tree.includes('button:Done'), focus: await focused(page), inert: await inertN(page) };
  // 5. Confirm path of upper (Revoke)
  await page.getByRole('button', { name: 'Revoke link', exact: true }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Revoke', exact: true }).click(); await page.waitForTimeout(400);
  tree = await ax(page);
  out.afterConfirmUpper = { revoked: await page.locator('[data-revoked]').textContent(), bgInAx: bgInAx(tree), lowerDoneInAx: tree.includes('button:Done'), focus: await focused(page), inert: await inertN(page) };
  // 6. close lower with Done: background restored, focus returns to the Manage links trigger
  await page.getByRole('button', { name: 'Done', exact: true }).click(); await page.waitForTimeout(400);
  tree = await ax(page);
  out.afterCloseLower = { bgInAx: bgInAx(tree), inert: await inertN(page), focus: await focused(page), dialogs: tree.filter(x => /dialog/.test(x)) };
  // 7. background click works again
  await page.getByRole('button', { name: 'Background action' }).click(); await page.waitForTimeout(200);
  out.backgroundWorksAfterClose = await page.locator('[data-bg-clicks]').textContent();
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

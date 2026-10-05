// Unmounting an open Modal (teardown) in the browser: background and focus restored, and the
// overlapping-upper case keeps the background excluded until the upper closes. Synthetic harness, dev only.
const { chromium } = require('playwright');
async function ax(page) { const cdp = await page.context().newCDPSession(page); const { nodes } = await cdp.send('Accessibility.getFullAXTree'); return nodes.filter(n => !n.ignored && ['button','dialog','alertdialog'].includes(n.role?.value)).map(n => `${n.role.value}:${n.name?.value || ''}`); }
const inertN = page => page.evaluate(() => document.querySelectorAll('[inert]').length);
const focusName = page => page.evaluate(() => document.activeElement === document.body ? 'BODY' : document.activeElement?.textContent.trim());
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
  await page.goto('http://localhost:3000/dev/modal', { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(500);
  const out = {};
  // A. lower Modal alone: open, then unmount while open
  await page.getByRole('button', { name: 'Manage links', exact: true }).click(); await page.waitForTimeout(400);
  out.A_open = { inert: await inertN(page), bgInAx: (await ax(page)).includes('button:Background action') };
  await page.evaluate(() => document.querySelector('[data-unmount]').click()); // app-code unmount: the background control is inert behind the backdrop, so no pointer click await page.waitForTimeout(400);
  let t = await ax(page);
  out.A_afterUnmount = { inert: await inertN(page), bgInAx: t.includes('button:Background action'), dialogs: t.filter(x => /dialog/.test(x)), focus: await focusName(page), bgClickable: null };
  await page.getByRole('button', { name: 'Background action' }).click(); await page.waitForTimeout(150);
  out.A_afterUnmount.bgClickable = await page.locator('[data-bg-clicks]').textContent();
  // B. lower open, upper ConfirmDialog open on top, unmount the lower while the upper is open
  await page.getByRole('button', { name: 'Manage links', exact: true }).click(); await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Revoke link', exact: true }).click(); await page.waitForTimeout(400);
  out.B_upperOpen = { inert: await inertN(page), dialogs: (await ax(page)).filter(x => /dialog/.test(x)) };
  await page.evaluate(() => document.querySelector('[data-unmount]').click()); // app-code unmount: the background control is inert behind the backdrop, so no pointer click await page.waitForTimeout(400);
  t = await ax(page);
  out.B_afterUnmountLowerWhileUpperOpen = { inert: await inertN(page), bgInAx: t.includes('button:Background action'), upperOpen: t.some(x => x.startsWith('alertdialog')), focus: await focusName(page) };
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click(); await page.waitForTimeout(400);
  t = await ax(page);
  out.B_afterUpperClosed = { inert: await inertN(page), bgInAx: t.includes('button:Background action'), focus: await focusName(page) };
  out.pageErrors = errors;
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

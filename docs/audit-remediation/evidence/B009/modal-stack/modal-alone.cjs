// Shared Modal alone: open, background excluded, Escape closes, focus returns to the trigger, cleanup.
const { chromium } = require('playwright');
async function ax(page) { const cdp = await page.context().newCDPSession(page); const { nodes } = await cdp.send('Accessibility.getFullAXTree'); return nodes.filter(n => !n.ignored && ['button','dialog','alertdialog'].includes(n.role?.value)).map(n => `${n.role.value}:${n.name?.value || ''}`); }
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto('http://localhost:3000/dev/modal', { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(500);
  const out = {};
  await page.getByRole('button', { name: 'Manage links' }).click(); await page.waitForTimeout(400);
  let t = await ax(page);
  out.open = { dialogs: t.filter(x => /dialog/.test(x)), backgroundInAx: t.includes('button:Background action'), inert: await page.evaluate(() => document.querySelectorAll('[inert]').length), focusInside: await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')) };
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  t = await ax(page);
  out.afterEscape = { dialogs: t.filter(x => /dialog/.test(x)), backgroundInAx: t.includes('button:Background action'), inert: await page.evaluate(() => document.querySelectorAll('[inert]').length), focus: await page.evaluate(() => document.activeElement?.textContent.trim()) };
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext()).newPage();
  await page.goto('http://localhost:3950/login', { waitUntil: 'load' }); await page.waitForTimeout(1500);
  const cdp = await page.context().newCDPSession(page); await cdp.send('Accessibility.enable');
  const snap = async () => (await cdp.send('Accessibility.getFullAXTree')).nodes.filter(n => !n.ignored && n.role?.value === 'button' && /password/i.test(n.name?.value || '')).map(n => ({ name: n.name.value, pressed: (n.properties || []).find(p => p.name === 'pressed')?.value?.value ?? null, expanded: (n.properties||[]).find(p=>p.name==='expanded')?.value?.value ?? null }));
  const before = await snap();
  await page.click('button[aria-controls="password"]'); await page.waitForTimeout(300);
  const after = await snap();
  console.log(JSON.stringify({ before, after }));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

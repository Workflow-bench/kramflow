const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext()).newPage();
  const posts = []; page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
  await page.goto('http://localhost:3944/login', { waitUntil: 'load' });
  await page.waitForSelector('#password'); const pw = page.locator('#password');
  const toggle = page.locator('button[aria-controls="password"]');
  const before = { type: await pw.getAttribute('type'), pressed: await toggle.getAttribute('aria-pressed'), label: await toggle.getAttribute('aria-label') };
  await toggle.click();
  const after = { type: await pw.getAttribute('type'), pressed: await toggle.getAttribute('aria-pressed'), label: await toggle.getAttribute('aria-label') };
  await pw.fill('pw-typed-123');
  const value = await pw.inputValue();
  await page.evaluate(() => { document.querySelector('#password').value=''; });
  await pw.focus(); await page.keyboard.insertText('pasted-pw-456');
  const pasted = await pw.inputValue();
  console.log(JSON.stringify({ before, after, typedKept: value === 'pw-typed-123', pasteWorks: pasted === 'pasted-pw-456', postsOnToggle: posts.length }, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

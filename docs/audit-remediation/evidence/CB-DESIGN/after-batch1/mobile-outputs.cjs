const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 375, height: 812 } }); const page = await ctx.newPage();
  await page.goto('http://localhost:3963/', { waitUntil: 'load' }); await page.waitForTimeout(700);
  await page.locator('#one-cue').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  const tabs = page.getByRole('tab');
  const names = await tabs.allTextContents();
  await page.getByRole('tab', { name: 'Speaker' }).click(); await page.waitForTimeout(200);
  const selected = await page.locator('[role=tab][aria-selected=true]').textContent();
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
  const afterArrow = await page.locator('[role=tab][aria-selected=true]').textContent();
  const panel = await page.locator('#output-panel').boundingBox();
  await page.locator('#output-panel').screenshot({ path: `${__dirname}/mobile-output-panel.png` });
  const demo = await page.evaluate(() => { const d = document.getElementById('demo'); const o = document.getElementById('one-cue'); return { demoBeforeOneCue: !!d && !!o && (d.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0, demoTop: d ? Math.round(d.getBoundingClientRect().top + scrollY) : null }; });
  console.log(JSON.stringify({ tabs: names, selectedAfterSpeakerClick: selected, selectedAfterArrowRight: afterArrow, panelWidth: panel && Math.round(panel.width), ...demo }, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

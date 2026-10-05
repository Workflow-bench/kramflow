// Rehearsal exit dialog: initial focus on Cancel, Tab containment, background pointer block, Escape, focus return.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  const api = []; page.on('request', r => { if (r.url().includes('/api/live') || (r.method() !== 'GET' && !r.url().includes('_next'))) api.push(r.method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '')); });
  await page.goto('http://localhost:3947/dev/rehearsal?fixture=multi', { waitUntil: 'load' }); await page.waitForSelector('[data-harness-banner]', { timeout: 60000 }); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Start Rehearsal' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(200);
  const cueBefore = await page.getByText(/Rehearsing now/).count();
  const posBefore = await page.evaluate(() => (document.body.innerText.match(/SYNTHETIC cue \d+/) || [])[0] || null);
  await page.getByRole('button', { name: 'Exit Rehearsal' }).click(); await page.waitForTimeout(400);
  const focusOnOpen = await page.evaluate(() => document.activeElement?.textContent.trim());
  const dlgName = await page.evaluate(() => document.querySelector('[role=alertdialog]')?.getAttribute('aria-labelledby') ? document.getElementById(document.querySelector('[role=alertdialog]').getAttribute('aria-labelledby')).textContent : null);
  const inside = []; for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); inside.push(await page.evaluate(() => !!document.activeElement?.closest('[role=alertdialog]'))); }
  // Background point well outside the dialog (page top-left corner). The established
  // pattern: a full-viewport backdrop sits above the page; it closes the dialog as a
  // cancel and never reaches the page beneath it.
  const bgPoint = { x: 12, y: 890 };
  const bgHit = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? { tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), inDialog: !!el.closest('[role=alertdialog]') } : null; }, [bgPoint.x, bgPoint.y]);
  await page.mouse.click(bgPoint.x, bgPoint.y); await page.waitForTimeout(400);
  const posAfterBgClick = await page.evaluate(() => (document.body.innerText.match(/SYNTHETIC cue \d+/) || [])[0] || null);
  const stillOpen = await page.evaluate(() => !!document.querySelector('[role=alertdialog]'));
  const bgNote = bgHit;
  // Escape
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const closedAfterEsc = await page.evaluate(() => !document.querySelector('[role=alertdialog]'));
  const focusReturn = await page.evaluate(() => document.activeElement?.textContent.trim());
  const cueAfterEsc = await page.evaluate(() => (document.body.innerText.match(/SYNTHETIC cue \d+/) || [])[0] || null);
  // Enter on the initially focused Cancel does nothing destructive; reopen and press Enter on initial focus
  await page.getByRole('button', { name: 'Exit Rehearsal' }).click(); await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const enterOnInitialClosed = await page.evaluate(() => !document.querySelector('[role=alertdialog]'));
  const exitMarkerAfterEnter = await page.getByText('Exit confirmed', { exact: false }).count();
  // Confirm path
  await page.getByRole('button', { name: 'Exit Rehearsal' }).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Leave rehearsal', exact: true }).click(); await page.waitForTimeout(300);
  const result = { focusOnOpen, dialogAccessibleName: dlgName, tabStaysInsideDialog: inside.every(Boolean), backgroundElementAtPoint: bgNote, positionBefore: posBefore, positionAfterBackgroundClick: posAfterBgClick, dialogOpenAfterBackgroundClick: stillOpen, closedByEscape: closedAfterEsc, focusReturnedTo: focusReturn, positionAfterEscape: cueAfterEsc, enterOnInitialFocusClosedWithoutExit: enterOnInitialClosed && exitMarkerAfterEnter === 0, confirmExitMarker: await page.getByText('Exit confirmed', { exact: false }).count(), mutatingOrLiveRequests: api };
  console.log(JSON.stringify(result, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

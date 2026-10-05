const { chromium } = require('playwright');
const BASE = 'http://localhost:3947/dev/rehearsal';
const results = {};
async function ax(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  return nodes.filter(n => !n.ignored).map(n => ({ role: n.role?.value, name: n.name?.value || '', disabled: (n.properties || []).some(p => p.name === 'disabled' && p.value.value === true) }));
}
function headingsOf(tree) { return tree.filter(n => n.role === 'heading').map(n => n.name); }
async function instrument(page) {
  const live = [];
  page.on('request', r => { if (r.url().includes('/api/live') || (r.method() !== 'GET' && !r.url().includes('_next'))) live.push(r.method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '')); });
  return live;
}
async function open(b, fixture) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const net = await instrument(page);
  await page.goto(`${BASE}?fixture=${fixture}`, { waitUntil: 'load' });
  await page.waitForSelector('[data-harness-banner]', { timeout: 60000 });
  await page.waitForTimeout(1200);
  return { ctx, page, net };
}
(async () => {
  const b = await chromium.launch();

  // 1. Empty session list (error/empty state)
  { const { ctx, page, net } = await open(b, 'none');
    const tree = await ax(page);
    results.none = { headings: headingsOf(tree), text: (await page.textContent('main, body')).replace(/\s+/g, ' ').slice(0, 300), network: net };
    await ctx.close(); }

  // 2. Zero-cue session: Start must be disabled, no completion possible
  { const { ctx, page, net } = await open(b, 'zero');
    const tree = await ax(page);
    const start = tree.find(n => n.role === 'button' && n.name === 'Start Rehearsal');
    results.zero = { startButton: start ? { disabled: start.disabled } : 'absent', finishVisible: tree.some(n => n.role === 'button' && n.name === 'Finish'), completionVisible: await page.getByText('Rehearsal complete').count(), network: net };
    await ctx.close(); }

  // 3. One cue: Start, Finish at the only cue (keyboard), completion appears once
  { const { ctx, page, net } = await open(b, 'one');
    await page.getByRole('button', { name: 'Start Rehearsal' }).click();
    await page.waitForTimeout(300);
    const finishBtn = page.getByRole('button', { name: 'Finish', exact: true });
    const enabledBefore = await finishBtn.isEnabled();
    await finishBtn.focus(); await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    const tree = await ax(page);
    results.one = { finishEnabledAtCue1: enabledBefore, completionCount: await page.getByText('Rehearsal complete', { exact: true }).count(), summary: await page.getByText(/cues completed/).first().textContent(), runAgain: tree.some(n => n.role === 'button' && n.name === 'Run again'), exitLink: tree.some(n => n.role === 'link' && n.name === 'Exit Rehearsal'), headings: headingsOf(tree), network: net };
    await ctx.close(); }

  // 4. Multi cue (4): Next to last, Finish by keyboard, completion once, Run again resets
  { const { ctx, page, net } = await open(b, 'multi');
    await page.getByRole('button', { name: 'Start Rehearsal' }).click();
    const finishVisibleAtCue1 = await page.getByRole('button', { name: 'Finish', exact: true }).count();
    for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(150); }
    const finishBtn = page.getByRole('button', { name: 'Finish', exact: true });
    const enabledAtLast = await finishBtn.isEnabled();
    await finishBtn.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const completion = await page.getByText('Rehearsal complete', { exact: true }).count();
    const summary = await page.getByText(/cues completed/).first().textContent();
    await page.getByRole('button', { name: 'Run again' }).click(); await page.waitForTimeout(300);
    const afterReset = await page.getByText('Not started', { exact: true }).count();
    results.multi = { finishCountAtCue1: finishVisibleAtCue1, finishEnabledAtLastCue: enabledAtLast, completionCount: completion, summary, runAgainReturnsToNotStarted: afterReset > 0, network: net };
    await ctx.close(); }

  // 5. Jump to Finish path (ghost control)
  { const { ctx, page, net } = await open(b, 'multi');
    await page.getByRole('button', { name: 'Start Rehearsal' }).click();
    const jump = page.getByRole('button', { name: 'Jump to Finish' });
    const jumpVisible = await jump.count();
    if (jumpVisible) { await jump.click(); await page.waitForTimeout(300); }
    results.jumpToFinish = { visible: jumpVisible > 0, completionCount: await page.getByText('Rehearsal complete', { exact: true }).count(), network: net };
    await ctx.close(); }

  // 6. Exit confirmation (alertdialog): AX-tree name, focus inside, Escape returns focus to Exit, confirm exits via onExit
  { const { ctx, page, net } = await open(b, 'multi');
    await page.getByRole('button', { name: 'Start Rehearsal' }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(150);
    await page.getByRole('button', { name: 'Exit Rehearsal' }).click(); await page.waitForTimeout(400);
    const treeOpen = await ax(page);
    const dlg = treeOpen.find(n => n.role === 'alertdialog');
    const focusInDialog = await page.evaluate(() => !!document.activeElement?.closest('[role=alertdialog]'));
    const focusedName = await page.evaluate(() => document.activeElement?.textContent.trim());
    const bgInert = await page.evaluate(() => { const m = document.querySelector('main, [data-harness-banner]')?.parentElement; return m ? m.getAttribute('aria-hidden') : null; });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    const dlgAfterEsc = await page.getByRole('alertdialog').count();
    const focusReturn = await page.evaluate(() => document.activeElement?.textContent.trim());
    await page.getByRole('button', { name: 'Exit Rehearsal' }).click(); await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Leave rehearsal', exact: true }).click(); await page.waitForTimeout(400);
    results.exitDialog = { alertdialogInAxTree: dlg ? dlg.name : null, focusInsideOnOpen: focusInDialog, focusedElementOnOpen: focusedName, backgroundAriaHidden: bgInert, closedAfterEscape: dlgAfterEsc === 0, focusReturnedToExitAfterEscape: focusReturn, confirmedExitMarker: await page.getByText('Exit confirmed', { exact: false }).count(), network: net };
    await ctx.close(); }

  // 7. Exit without progress is a plain link (navigates; not intercepted by the harness)
  { const { ctx, page } = await open(b, 'multi');
    const link = page.getByRole('link', { name: 'Exit Rehearsal' });
    results.exitNoProgress = { isLink: (await link.count()) > 0, href: (await link.count()) ? await link.first().getAttribute('href') : null, dialogOnOpen: await page.getByRole('dialog').count() };
    await ctx.close(); }

  console.log(JSON.stringify(results, null, 1));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

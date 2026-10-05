const { chromium } = require('playwright');
const fs = require('fs');
async function tree(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Accessibility.enable');
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  return nodes;
}
(async () => {
  const b = await chromium.launch();
  const out = {};
  for (const [label, url, w] of [['landing-desktop', 'http://localhost:3948/', 1440], ['landing-mobile', 'http://localhost:3948/', 375], ['login', 'http://localhost:3948/login', 1280]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(3500);
    if (label.startsWith('landing')) { const H = await page.evaluate(() => document.documentElement.scrollHeight); for (let y = 0; y <= H; y += 400) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(100); } await page.waitForTimeout(2000); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800); }
    const nodes = await tree(page);
    const byId = new Map(nodes.map(n => [n.nodeId, n]));
    const live = nodes.filter(n => !n.ignored);
    const role = n => n.role?.value || '';
    const name = n => n.name?.value || '';
    const headings = live.filter(n => role(n) === 'heading').map(n => { const lvl = (n.properties || []).find(p => p.name === 'level')?.value?.value; return { level: lvl, name: name(n) }; });
    const landmarks = live.filter(n => ['banner','navigation','main','contentinfo','complementary','region'].includes(role(n))).map(n => role(n) + ':' + name(n));
    const unnamedInteractive = live.filter(n => ['button','link'].includes(role(n)) && !name(n)).length;
    const names = live.filter(n => ['button','link'].includes(role(n))).map(n => role(n) + ': ' + name(n).slice(0, 60));
    const dup = {}; headings.forEach(h => dup[h.level + ' ' + h.name] = (dup[h.level + ' ' + h.name] || 0) + 1);
    out[label] = { viewport: w, axNodes: nodes.length, ignoredNodes: nodes.length - live.length, headingCount: headings.length, headings: headings.slice(0, 40), duplicateHeadings: Object.entries(dup).filter(([, c]) => c > 1), landmarks, unnamedInteractive, interactive: names.slice(0, 60) };
    if (label === 'login') {
      
    }
    await ctx.close();
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { headingCount: v.headingCount, dupHeadings: v.duplicateHeadings, landmarks: v.landmarks.length, unnamedInteractive: v.unnamedInteractive, axNodes: v.axNodes }])));
  await b.close();
})().catch(e => { console.error('FAIL', e.stack); process.exit(1); });

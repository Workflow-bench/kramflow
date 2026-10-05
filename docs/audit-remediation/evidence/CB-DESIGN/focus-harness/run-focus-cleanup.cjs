// Runs the dialog-cleanup scenarios against the bundled real Modal/ConfirmDialog harness.
// Usage: node run-focus-cleanup.cjs  (run from repo root with NODE_PATH=$PWD/node_modules)
const { chromium } = require("playwright");
const path = require("path");
const url = "file://" + path.join(__dirname, "index.html");

// Describes the focused element with its owning dialog title, so unnamed close buttons read unambiguously.
const DESC = `((el) => { if (!el) return "none"; const d = el.closest("[role=dialog]"); const t = d ? (d.querySelector("h2")?.textContent || "").trim() : ""; return el.tagName + "#" + el.id + "|dialog:" + (t || "-") + "|" + (el.textContent || "").trim().slice(0, 14); })(document.activeElement)`;

const SCENARIOS = {
  "trigger-clicked-restores-trigger": async (p) => { await p.click("#trigger"); await settle(p); await p.evaluate(() => H.setLower(false)); await settle(p); return p.evaluate(`${DESC}`); },
  "upper-closes-lower-survives": async (p) => { await p.evaluate(() => H.setLower(true)); await p.evaluate(() => H.setUpper(true)); await settle(p); await p.evaluate(() => H.setUpper(false)); await settle(p); return p.evaluate(`${DESC}`); },
  "lower-unmounts-upper-survives": async (p) => { await p.evaluate(() => H.setLower(true)); await p.evaluate(() => H.setUpper(true)); await settle(p); await p.evaluate(() => H.setLower(false)); await settle(p); return p.evaluate(`${DESC}`); },
  "both-closed-trigger-visible": async (p) => { await p.evaluate(() => H.setLower(true)); await settle(p); await p.evaluate(() => H.setLower(false)); await settle(p); return p.evaluate(`${DESC}`); },
  "trigger-hidden-fallback": async (p) => { await p.evaluate(() => H.setTrig("hidden")); await p.evaluate(() => H.setLower(true)); await settle(p); await p.evaluate(() => H.setLower(false)); await settle(p); return p.evaluate(`${DESC}`); },
  "trigger-disabled-fallback": async (p) => { await p.evaluate(() => H.setTrig("disabled")); await p.evaluate(() => H.setLower(true)); await settle(p); await p.evaluate(() => H.setLower(false)); await settle(p); return p.evaluate(`${DESC}`); },
  "trigger-removed-fallback": async (p) => { await p.evaluate(() => H.setLower(true)); await settle(p); await p.evaluate(() => H.setTrig("gone")); await p.evaluate(() => H.setLower(false)); await settle(p); return p.evaluate(`${DESC}`); },
  "escape-closes-topmost": async (p) => { await p.evaluate(() => H.setLower(true)); await p.evaluate(() => H.setUpper(true)); await settle(p); await p.keyboard.press("Escape"); await settle(p); return p.evaluate(`({ upper: H.upper, lower: H.lower, active: ${DESC} })`); },
  "tab-trap-stays-in-dialog": async (p) => { await p.evaluate(() => H.setLower(true)); await settle(p); const seen = []; for (let i = 0; i < 4; i++) { await p.keyboard.press("Tab"); seen.push(await p.evaluate(`${DESC}`)); } return seen; },
  "inert-released-after-all-close": async (p) => { await p.evaluate(() => H.setLower(true)); await p.evaluate(() => H.setUpper(true)); await settle(p); const during = await p.evaluate(() => H.inert()); await p.evaluate(() => H.setUpper(false)); await p.evaluate(() => H.setLower(false)); await settle(p); return { during, after: await p.evaluate(() => H.inert()) }; },
};

async function settle(p) { await p.waitForTimeout(120); }

(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const [name, run] of Object.entries(SCENARIOS)) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url);
    await page.waitForFunction(() => window.H);
    await settle(page);
    out[name] = await run(page);
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

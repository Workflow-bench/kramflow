import { chromium } from "/Users/deeppatel/Documents/AI/Shibir/stageflow/node_modules/playwright/index.mjs";
const BASE = "http://localhost:3961/";
const OUT = process.env.OUT;
const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

const browser = await chromium.launch();
for (const [w, h] of [[1280, 720], [1440, 900]]) {
  for (const caller of ["console", "fleet"]) {
    for (const pos of ["top", "scrolled"]) {
      const tag = `${caller}-${w}x${h}-${pos}`;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, recordVideo: { dir: `${OUT}/gm01/video-${tag}`, size: { width: w, height: h } }, reducedMotion: "no-preference" });
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.evaluate(() => sessionStorage.setItem("kf-arrival-v1", "1"));
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      if (pos === "scrolled") {
        for (let i = 0; i < 6; i++) { await page.mouse.move(w / 2, h / 2); await page.mouse.wheel(0, 500); await page.waitForTimeout(120); }
        await page.waitForTimeout(900);
      }
      const y0 = await page.evaluate(() => Math.round(window.scrollY));
      const trigger = caller === "console"
        ? page.getByRole("button", { name: "View full console" })
        : page.getByRole("button", { name: "Inspect the display fleet" });
      if (!(await trigger.count())) { check(`${tag} trigger found`, false); await ctx.close(); continue; }
      for (let i = 0; i < 60; i++) {
        const r = await trigger.first().boundingBox();
        if (r && r.y >= 40 && r.y + r.height <= h - 40) break;
        await page.mouse.move(w / 2, h / 2);
        await page.mouse.wheel(0, r && r.y > h / 2 ? 120 : -120);
        await page.waitForTimeout(260);
      }
      await page.waitForTimeout(1200);
      console.error(tag, "trigger box", JSON.stringify(await trigger.first().boundingBox()), "y", await page.evaluate(() => Math.round(scrollY)));
      const yBefore = await page.evaluate(() => Math.round(window.scrollY));
      await trigger.first().focus(); await trigger.first().evaluate((el) => el.click());
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (!d) return null;
        const overlay = d.parentElement.getBoundingClientRect();
        const panel = d.getBoundingClientRect();
        const close = [...d.querySelectorAll('button[aria-label="Close"]')][0];
        const cr = close.getBoundingClientRect();
        const scroller = [...d.querySelectorAll("div")].find((el) => el.className.includes("overflow-auto"));
        return {
          vw: innerWidth, vh: innerHeight,
          overlay: { x: overlay.x, y: overlay.y, w: Math.round(overlay.width), h: Math.round(overlay.height) },
          panel: { top: Math.round(panel.top), bottom: Math.round(panel.bottom), w: Math.round(panel.width), h: Math.round(panel.height) },
          closeVisible: cr.width > 0 && cr.top >= 0 && cr.bottom <= innerHeight,
          regionScroll: scroller ? { sh: scroller.scrollHeight, ch: scroller.clientHeight } : null,
          htmlOverflow: document.documentElement.style.overflow,
          topmost: (() => { const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return !!el?.closest('[role="dialog"]') || !!el?.closest(".fixed"); })(),
        };
      });
      check(`${tag} dialog opens`, m, "");
      if (m) {
        check(`${tag} backdrop = viewport`, m.overlay.x === 0 && m.overlay.y === 0 && m.overlay.w === m.vw && m.overlay.h === m.vh, JSON.stringify(m.overlay));
        check(`${tag} panel inside viewport`, m.panel.top >= 0 && m.panel.bottom <= m.vh, JSON.stringify(m.panel));
        check(`${tag} close control visible`, m.closeVisible, "");
        check(`${tag} html overflow locked`, m.htmlOverflow === "hidden", m.htmlOverflow);
        check(`${tag} image region scrolls internally`, m.regionScroll && m.regionScroll.sh >= m.regionScroll.ch, JSON.stringify(m.regionScroll));
      }
      // wheel while open must not move the page
      await page.mouse.move(w / 2, h / 2); await page.mouse.wheel(0, 600); await page.waitForTimeout(500);
      const yLocked = await page.evaluate(() => Math.round(window.scrollY));
      check(`${tag} page locked while open`, yLocked === yBefore, `before ${yBefore} after ${yLocked}`);
      // focus trap: Tab 30 times, each stays inside dialog
      let escaped = 0;
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press("Tab");
        const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
        if (!inside) escaped++;
      }
      check(`${tag} Tab trapped (30 presses)`, escaped === 0, `escaped ${escaped}`);
      let escapedBack = 0;
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press("Shift+Tab");
        const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
        if (!inside) escapedBack++;
      }
      check(`${tag} Shift+Tab trapped`, escapedBack === 0, `escaped ${escapedBack}`);
      // Escape closes, focus returns to trigger
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => ({
        dialog: !!document.querySelector('[role="dialog"][aria-modal="true"]'),
        htmlOverflow: document.documentElement.style.overflow,
        active: document.activeElement?.textContent?.trim().slice(0, 40),
        activeLabel: document.activeElement?.getAttribute("aria-label"),
      }));
      check(`${tag} Escape closes`, !after.dialog, "");
      check(`${tag} focus returns to trigger`, after.active && (after.active.includes(caller === "console" ? "View full console" : "Inspect the display fleet")), JSON.stringify(after));
      check(`${tag} overflow restored`, after.htmlOverflow !== "hidden", `html overflow='${after.htmlOverflow}'`);
      // scrolling works after close
      const yA = await page.evaluate(() => Math.round(window.scrollY));
      await page.mouse.move(w / 2, h / 2); await page.mouse.wheel(0, 500); await page.waitForTimeout(900);
      const yB = await page.evaluate(() => Math.round(window.scrollY));
      check(`${tag} scroll works after close`, yB !== yA, `before ${yA} after ${yB}`);
      // reopen then close by backdrop
      await trigger.first().focus(); await trigger.first().evaluate((el) => el.click()); await page.waitForTimeout(350);
      const hit = await page.evaluate(() => { const el = document.elementFromPoint(innerWidth / 2, innerHeight - 6); return el?.tagName + " " + (el?.getAttribute("aria-label") ?? "") + " " + (el?.closest('[role="dialog"]') ? "in-dialog" : "backdrop-or-other"); });
      check(`${tag} gutter hit-target is overlay`, hit.startsWith("DIV"), hit);
      await page.mouse.click(w / 2, h - 6); await page.waitForTimeout(400);
      check(`${tag} backdrop click closes`, !(await page.locator('[role="dialog"][aria-modal="true"]').count()), "");
      await page.screenshot({ path: `${OUT}/gm01/shot-${tag}.png` });
      const vid = await page.video()?.path();
      await ctx.close();
      if (vid) results.push({ name: `${tag} video`, ok: true, detail: vid });
    }
  }
}
await browser.close();
console.log(JSON.stringify(results, null, 1));

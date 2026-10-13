# Browser pass 2 (B009, 2026-10-04)

Playwright 1.x from project node_modules, Chromium from the local Playwright cache, against the production build on port 3944 (webpack build of the current tree). Reproduce: `NODE_PATH=$PWD/node_modules node <script>` with the server running.

- `reduced-motion.cjs` -> `reduced-motion.out`: prefers-reduced-motion reduce vs no-preference, 375 px.
- `login-a11y.cjs` -> `login-toggle.out`: password show/hide `aria-pressed`, label, typed value kept, paste, no POST on toggle.
- `a11y-pass.cjs` -> `a11y-pass.out`: horizontal overflow at 320/375/768/1024/1440 CSS px; skip link target; visible heading count per section; unnamed controls; `/login?link=expired` message.
- `lcp-probe.cjs`: unthrottled mobile LCP element and paint time (diagnostic only; not a Lighthouse measurement).

Limits: viewport reflow at 320 CSS px approximates the 400% zoom requirement; it is not browser zoom. No screen reader. The heading check counts rendered (`getClientRects`) headings, not a CDP accessibility tree dump.

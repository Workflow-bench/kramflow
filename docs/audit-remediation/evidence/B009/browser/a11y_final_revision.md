# Public accessibility observations, final local production build (B009)

Revision: the working tree at HEAD after the navbar Escape fix (see commit message). Build via `npm run build`, served with `next start`. Identity: anonymous. Data: static public pages. No remote calls.
Browser: built-in Browser pane. Viewports in CSS px.

| Route | Viewport | Check | Expected | Actual |
|---|---|---|---|---|
| `/` | 375 | Open the navbar "Open menu" control, then Escape | menu closes, aria-expanded false, focus on the toggle | BEFORE fix: Escape did nothing (aria-expanded stayed true, label "Close menu"). AFTER fix: aria-expanded false, label "Open menu", focus on toggle |
| `/` | 1440 | skip link first Tab stop, Enter moves focus to #main-content | as stated | verified earlier build; repeated on final build in the prior session |
| `/` | 320 | document and element overflow | none | docOverflow 0, elements past edge 0 |
| `/` | 640 | document and element overflow | none | docOverflow 0, elements past edge 0 |
| `/login` | 320 | document and element overflow; password toggle present | none; toggle present | docOverflow 0, elements past edge 0, toggle present |

Scope limits (not verified here):
- 200% browser zoom: this tool cannot set browser zoom. 320 px and 640 px CSS-width checks approximate the WCAG reflow requirement (320 CSS px); they are not a zoom test.
- Dialog focus trap and focus return for modal dialogs: no modal dialog exists on the public pages. The navbar menu is a disclosure, not a role=dialog. Authenticated dialogs (confirm, modal, sheet) are not reachable without a session.
- True accessibility tree with hidden flags: the browser tool's read_page does not filter display:none nodes, so it cannot settle KF-021 duplication. A DevTools accessibility-tree capture is not available in this environment. UNVERIFIED.
- Screen-reader speech: not performed.

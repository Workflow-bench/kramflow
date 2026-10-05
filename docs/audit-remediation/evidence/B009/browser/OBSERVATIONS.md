# B009 browser observations (public, local production build)

Build: `npm run build` at HEAD (see BATCH_REPORT), served with `next start -p 3920` on localhost.
Browser: built-in Browser pane (tab `seed`). Identity: unauthenticated visitor. Data source: static
public pages only. No remote calls were made by these checks.

| Route | Viewport | Identity | Steps | Expected | Actual | Evidence |
|---|---|---|---|---|---|---|
| `/` | 1440x900 | anonymous | scroll to settle reveals, measure text contrast of all rendered text | every text node meets WCAG 4.5:1 / 3:1 large | 73 text nodes measured, 0 failing, min 4.72:1, 0 excluded | in-session script output (recorded here) |
| `/` | 1440 (tab-stop) | anonymous | Tab from top of page | first stop is skip link, visible with focus ring | "Skip to content", focus-visible true, ring `rgb(244,239,229)` 2px | in-session |
| `/` | 1440 (activation) | anonymous | Enter on skip link | focus moves to `#main-content` | activeElement `DIV#main-content` | in-session |
| `/` | 320x640 | anonymous | document and element overflow | no horizontal overflow | docOverflow 0, elements past edge 0 | in-session |
| `/login` | 1440 | anonymous | password show/hide by pointer and keyboard (previous build; not repeated) | type flips text/password, aria-pressed | verified on the prior build only | prior session |
| `/reset` | 320x640 | anonymous | render check | noindex, title, form, no overflow | title "Reset password", robots noindex, email field present, docOverflow 0 | HTTP and in-session |

Not performed, with reasons:
- Reset form submission: the route calls the rate-limit store (shared dev database row write) and the auth provider. Not run (no authorization for remote side effects).
- Login submission: calls the remote auth service. Not run.
- Authenticated pages (rehearsal, operator console, cue sheet import, remote, broadcast, displays, settings): require a real session. No authorized session fixture is available to this batch. UNVERIFIED-runtime.
- Screen-reader announcements: not performed.

---
Amendment (B009, see CORRECTION_rgb_only_contrast.md): the row above used an rgb-only parser that skipped `oklab()` colors. Its "0 failing" result is superseded. Corrected oklab-aware result: desktop 496 nodes, 0 failing, min 4.63:1; mobile 491 nodes, 0 failing, min 4.63:1.

# Dev-route exclusion evidence (KF-025, B009 r7)

Source obligation (KF-025, ledger acceptance criteria, verbatim): "exclude /dev/components from production builds, or require genuine authorization to view it; a robots.txt disallow entry is not treated as access control." Criteria: (1) an anonymous production-like request to /dev/components returns 404 or an authenticated-denial response; (2) no catalog chunks or internal links remain publicly discoverable.

Option taken: exclusion from production builds (the source's first option), by a NODE_ENV-gated dynamic import. Implementation branch is removed by the bundler in production; no runtime check is relied on alone.

Applied to: `app/(catalog)/dev/components/` (implementation moved to `catalog-impl.tsx`), `dev/modal`, `dev/realtime`, `dev/import`, `dev/import/console`, `dev/rehearsal`.

Verified, production build (Turbopack, `npm run build`):
- Chunks containing catalog or harness strings in `.next/static`: 0 (scan over 52 JS files; a landing control string is found in 1 file, so the scan is valid).
- HTTP status, production server: /dev/components 404, /dev/modal 404, /dev/realtime 404, /dev/import 404, /dev/import/console 404, /dev/rehearsal 404, / 200.
- Before this change the catalog chunk `chunks/app/(catalog)/dev/components/page-<hash>.js` was served with HTTP 200 (37,704 bytes) at its hashed URL. No public page or public manifest linked it (landing HTML: 0 references to /dev/).
- Development: `/dev/modal` returns 200 under `next dev` (the gated import works in development).

Not verified here: external crawlers and CDN caching of the removed paths; search-engine history.

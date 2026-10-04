# Canonical origin plan (Lane D)

## Verified in the repo

- `lib/site-origin.ts` — `SITE_ORIGIN = "https://www.kramflow.me"`. Used by `app/layout.tsx` (`metadataBase`), `app/sitemap.ts`, and the reset redirect in `app/api/auth/reset/route.ts`.
- `proxy.ts` and `app/auth/callback/route.ts` build redirects from `request.url`. Those redirects stay on whichever host received the request. They are same-origin, so they are not an open redirect, but they do not force one canonical host.
- `app/api/auth/reset/route.ts` builds `redirectTo` from `SITE_ORIGIN`, never from the Host header (tested).
- `README.md` line 7 links the live app as `https://kramflow.me` (apex). That disagrees with `SITE_ORIGIN`.
- `.env.example` sets `RESEND_FROM_EMAIL` on `kramflow.me`. That is a mail sender domain, not the web origin, and is covered by the DNS/Resend plan (Lane F).

## Decision needed (owner)

1. Canonical host: `www.kramflow.me` (current code) or the apex `kramflow.me`. This plan assumes `www`. Changing it means changing `SITE_ORIGIN`, `metadataBase`, and the sitemap together, and the README link.

## Code work, local

- Done: one constant (`SITE_ORIGIN`) for the metadata base, sitemap, and reset redirect.
- Not done, by choice: `proxy.ts` and the callback keep request-relative redirects. Changing them to `SITE_ORIGIN` would break local development on `localhost`. The external host redirect below handles the apex-to-www case instead.

## External steps (not run here; owner action)

1. Supabase dashboard, Authentication > URL configuration: Site URL = `https://www.kramflow.me`. Redirect allowlist includes `https://www.kramflow.me/auth/callback`. Without this, the reset link from `/api/auth/reset` will not complete.
2. Vercel project domains: apex `kramflow.me` redirects permanently to `www.kramflow.me`, or the reverse if `www` is not chosen.
3. Re-verify after both changes: `curl -sI https://kramflow.me/` returns one permanent redirect to the canonical host, and the reset email link lands on the canonical host.

## Verification debt

Steps 1 to 3 need dashboard and DNS access and have not been checked. Nothing in this repo proves they are set.

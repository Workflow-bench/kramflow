# Route metadata policy (B006-F1 / B006-F2)

Enforced by `app/route-metadata-policy.test.ts`, which reads the source files.

| Route | Indexing | Head source | Verified how |
| --- | --- | --- | --- |
| `/` | indexable, canonical `/` | `app/layout.tsx` + `app/page.tsx` | production HTML: `og:site_name=KramFlow`, `og:type=website`, canonical |
| `/login`, `/signup`, `/set-password` | noindex, nofollow | own layout | production HTML: `robots noindex, nofollow` |
| `/reset` (password reset request) | noindex, nofollow | `app/reset/layout.tsx` | source + policy test |
| `/presenter`, `/general`, `/av`, `/green-room`, `/custom`, `/screens`, `/tv` | noindex, nofollow | own layout | source + policy test |
| `/dashboard` (`app/(operator)`) | noindex, nofollow; `robots.ts` disallows | group layout | source + policy test; unauthenticated visit redirects to `/login` (307) |
| `/e/[eventId]/**` | noindex, nofollow; `robots.ts` disallows | `app/e/[eventId]/layout.tsx` | source + policy test; unauthenticated visit redirects (307) |
| `/invite/[token]` | noindex, nofollow; crawlable (not disallowed in `robots.ts`, KF-026) | `app/invite/layout.tsx` | production HTML: title `Invitation · KramFlow`, robots noindex. Correction (KF-026, B009): the token string appears in Next's RSC segment payload because it is part of the request URL; it does not appear in metadata or the rendered markup. |
| `/dev/components` | noindex; page returns `notFound()` in production | `app/(catalog)/layout.tsx` | source + policy test |
| `/api/**` | disallowed in `robots.ts` | n/a | not a page |

Rules:

- Private titles are static strings. No route parameter, event name, account name, or token appears in any `metadata` block (policy test checks this).
- Private surfaces do not inherit the root Open Graph. Each noindex layout sets `openGraph: PRIVATE_OPEN_GRAPH` (`lib/private-metadata.ts`): title and site name only, no `url`, no image. Previously every private page advertised the homepage as its `og:url` (KF-026). Enforced by `app/route-metadata-policy.test.ts`.
- `robots.ts` disallows only `/dashboard`, `/e/` and `/api/`. Those routes redirect unauthenticated visitors to `/login` (307), so a crawler never receives their noindex page. `/invite/` is not disallowed: its noindex meta is the control, and a disallow would hide it (KF-026). `/dev/` is no longer listed; it returns 404 in production.

Not verified here: how Google and other crawlers treat these routes in production search, and whether any previously indexed `/dashboard` or `/e/...` URLs need removal. That needs Search Console access, which is external.

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
| `/invite/[token]` | noindex, nofollow; `robots.ts` disallows | `app/invite/layout.tsx` | production HTML: title `Invitation · KramFlow`, robots noindex; token absent from HTML |
| `/dev/components` | noindex; page returns `notFound()` in production | `app/(catalog)/layout.tsx` | source + policy test |
| `/api/**` | disallowed in `robots.ts` | n/a | not a page |

Rules:

- Private titles are static strings. No route parameter, event name, account name, or token appears in any `metadata` block (policy test checks this).
- Private surfaces inherit the root Open Graph and Twitter values. Those are static brand values with no identifiers. No per-route preview image is designed for them.
- `robots.ts` disallows private paths so crawlers do not fetch them. Their noindex is a fallback for any URL that is crawled anyway. Noindex is not visible to a crawler that is disallowed, so the two rules together mean "do not crawl, and do not index if reached."

Not verified here: how Google and other crawlers treat these routes in production search, and whether any previously indexed `/dashboard` or `/e/...` URLs need removal. That needs Search Console access, which is external.

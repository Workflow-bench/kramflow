# E2E tests

Real end-to-end tests against the actual dev server and a real Supabase project — no mocking.

## One-time setup

```
node --env-file=.env.local scripts/provision-test-account.mjs
```

Requires `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (same credentials `scripts/seed-mock.mjs` already uses). Creates (or resets the password on, if it already exists) a dedicated test operator account and writes its credentials to `.env.test.local` (gitignored). Safe to re-run any time.

## Running

```
npm run test:e2e
```

Starts the dev server automatically (`playwright.config.ts`'s `webServer`) if one isn't already running. Without `.env.test.local` present, the golden-path test skips itself with a clear message rather than failing.

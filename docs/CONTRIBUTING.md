# Contributing

## Setup

```bash
git clone https://github.com/Workflow-bench/kramflow.git
cd kramflow
npm install
cp .env.example .env.local   # fill in your Supabase values
npm run dev
```

The app needs a Supabase project with the schema and migrations applied. See the [README](../README.md#quick-start) and [Deployment](DEPLOYMENT.md).

## Before opening a PR

These must pass:

```bash
npx tsc --noEmit   # TypeScript, strict mode
npm run lint       # ESLint (existing warnings are known)
npm test           # unit tests (Vitest)
npm run build      # production build
```

CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs these on every push and pull request, plus the Playwright end-to-end test (`npm run test:e2e`, which needs a provisioned test account; see [`e2e/README.md`](../e2e/README.md)).

Automated tests do not cover the visual layout of each surface. Verify UI changes by driving the affected flow in a browser (all four display surfaces if the change touches shared code), rather than relying on typecheck, lint, and tests alone.

## Commit messages

Conventional Commits, roughly:

```text
feat: add PIN authentication for operator and remote
fix: clamp progress counter to session length after finish
refactor: split ProgramList row into ItemRow/BreakRow
docs: document the responsive breakpoint audit
```

`feat` / `fix` / `refactor` / `docs` / `chore` / `style` cover nearly everything here. Keep the subject line under ~70 characters; put the *why* in the body if it's not obvious from the diff.

## Where things belong

Read `docs/COMPONENT_GUIDE.md` before adding a component — it explains which of the four families (`ui` / `tv` / `operator` / `remote`) a new component belongs in, and why they don't share layout logic even when they look superficially similar.

Read `docs/DESIGN_SYSTEM.md` before touching layout, spacing, or type sizes. In particular: **never solve a mobile layout problem by shrinking the desktop one, and never solve a TV layout problem by centering the desktop one in a `max-width` box.** Each surface gets its own layout decision.

If you're touching the cue sheet parser (`lib/parse-cuesheet.ts`), read `docs/DATA_MODEL.md` first - it documents the specific quirks of the source spreadsheet the parser works around (columns that shift position between sheets, an order column that resets mid-sheet, etc.). Verify against the real file, not assumptions.

## Code style

- No comments explaining *what* code does — names should already say that. A comment is only worth adding for a non-obvious *why* (a workaround, a hidden constraint, a subtle invariant).
- No premature abstraction — three similar lines beat a speculative shared helper built for cases that don't exist yet.
- Real `<button>` elements for anything clickable, not `<div onClick>` — see `docs/COMPONENT_GUIDE.md`'s note on accessibility conventions.
- State reads go through `useEventStore()` — never read `localStorage`/`sessionStorage` directly from a component.

## Reporting issues

Open a GitHub issue with: what you expected, what happened, and which of the four surfaces (and at what viewport width, if it's a layout issue) it affects.

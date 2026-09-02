import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Console/Stage boundary guardrail (DESIGN.md's "Operational vocabulary" +
// "Console vs. Stage" sections) — the 2026-09-01 design-system audit found
// this violated across authenticated routes with no mechanism catching it.
// Two real regressions already happened this way: Stage components
// (components/tv/*, since deleted — nothing legitimate used it) got
// imported into Console files just because nothing stopped it, and raw
// Stage-scale type tokens (text-title/subtitle/body/caption at Stage
// sizes, rounded-card) got hand-typed into Console className strings.
// This is deliberately narrow — a fixed, known-bad token list, not a
// general "no raw Tailwind" rule — so it can't false-positive on
// legitimate class names that happen to contain other substrings.
//
// Remote (app/e/[eventId]/remote/**) is excluded on purpose: it keeps
// Stage-scale type by design (arm's-length, one-handed, not desk-scanned)
// — see DESIGN.md's explicit exception. Stage/display routes themselves
// are excluded because Stage tokens are exactly correct there.
const CONSOLE_SURFACE_GLOBS = [
  "app/(operator)/**/*.{ts,tsx}",
  "app/e/[eventId]/operator/**/*.{ts,tsx}",
  "app/e/[eventId]/broadcast/**/*.{ts,tsx}",
  "app/e/[eventId]/displays/**/*.{ts,tsx}",
  "app/e/[eventId]/settings/**/*.{ts,tsx}",
  "app/e/[eventId]/rehearsal/**/*.{ts,tsx}",
  "app/login/**/*.{ts,tsx}",
  "app/signup/**/*.{ts,tsx}",
  "app/invite/**/*.{ts,tsx}",
  "app/dashboard/**/*.{ts,tsx}",
  "components/operator/**/*.{ts,tsx}",
  "components/dashboard/**/*.{ts,tsx}",
  "components/forms/**/*.{ts,tsx}",
];

const STAGE_TOKEN_PATTERN =
  "/(^|\\s)(text-title|text-subtitle|text-hero|text-caption|text-body|rounded-card)(\\s|$)/";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: CONSOLE_SURFACE_GLOBS,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/tv/*", "@/components/tv"],
              message:
                "components/tv/* is the Stage-only namespace (DESIGN.md's Console/Stage boundary) — use the components/ui/* Console equivalent instead.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=${STAGE_TOKEN_PATTERN}]`,
          message:
            "Stage-scale type token in a Console surface — see DESIGN.md's Console/Stage boundary. Use the text-console-* equivalent (or, on app/e/[eventId]/remote, this rule doesn't apply — that surface keeps Stage-scale type on purpose).",
        },
        {
          selector: `TemplateElement[value.raw=${STAGE_TOKEN_PATTERN}]`,
          message:
            "Stage-scale type token in a Console surface — see DESIGN.md's Console/Stage boundary. Use the text-console-* equivalent.",
        },
      ],
    },
  },
]);

export default eslintConfig;

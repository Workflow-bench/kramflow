# Decisions for KF-038 to KF-042 (Lane F)

Each item records what is decided here, what is not, and who decides the rest. No decision below is taken on the owner's behalf.

## KF-038: structured data (schema.org)

- Decision recorded: no schema is added in this batch. The source calls it optional and not launch-blocking. Adding it needs an accurate description of the product and a structured-data test before it ships.
- Owner decision still needed: whether to invest before or after launch. Status stays OPEN.

## KF-039: AI-crawler policy

- Current `app/robots.ts`: `allow: ["/"]` for all user agents, with `/dashboard`, `/e/`, `/invite/`, `/api/`, and `/dev/` disallowed. No AI-crawler-specific rules.
- Recorded as "no change pending owner decision". A named rule for an AI user agent is a legal and product decision, so it is not made here. Status stays OPEN until the owner confirms the default.

## KF-040: PRD review

- `docs/PRD.md` is 48 lines. It states purpose, non-goals, and constraints for the TV surfaces. It does not cover the operator console, the cue-sheet import, or the AI features that now exist.
- Gap list written for the product owner, not filled here: value proposition for the console and collaborators, explicit ICP, and a task breakdown. Status stays OPEN (product owner task).

## KF-041: operator-tool inventory

- Written as `docs/audit-remediation/OPERATOR_TOOL_INVENTORY.md`, from the code.
- Acceptance also needs verification against a real pre-show setup. That needs the operations owner and a live event. Not done here. Status stays OPEN.

## KF-042: conditional review

- Re-checked: no FAQ page exists (`find app -iname "*faq*"` returns nothing), so the condition in the ledger has not triggered. Status stays NOT_APPLICABLE.

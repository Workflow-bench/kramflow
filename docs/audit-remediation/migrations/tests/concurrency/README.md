
## Same-event and version races (B009)
- `race_same_event.sh <db> <event-name>`: two imports into one event; expected B replaces A completely with no interleaving.
- `race_version.sh <db> <event-id>`: real database race on the conditional version update used by the timer route; expected the second writer matches zero rows.
- `display_type_state_mirror.sql`: mirror of the keys and columns the timer and hold routes use. Not the production migration text.
Results: `docs/audit-remediation/evidence/B009/db/concurrency_b9.txt`.

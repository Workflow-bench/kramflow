# KF-006 evidence (B009): first-import race and existing SQL scenarios

Evidence class: LOCAL DISPOSABLE POSTGRES 16.15 (Homebrew), real two-connection `psql`
sessions on a throwaway database `b9_conc`. Not Supabase runtime proof.

Command (from repo root, `$TMPDIR` is the socket directory of the local cluster):
    bash $TMPDIR/setup_race.sh      # drops and recreates b9_conc, loads schema_mirror.sql,
                                    # the migration, seed_race.sql, then race_first_import.sh
Output: `first_import_race.txt`.

Before the fix (migration without the advisory locks) the same race produced
`B_exit=3`: session B failed in the sessions upsert (global primary key) and only A's
row was stored. After the fix: `A_exit=0 B_exit=0`; A stored `sat-am`, B stored
`sat-am~69e2703f`, each in its own event.

Existing scenario suite, same migration, fresh database: `import_cue_sheet.test.sql`
prints `ALL PASSED` (repeat own-event update, two-event workbook, empty-session
replacement, induced rollback, foreign program/partition/session references, viewer and
stranger refusal, accepted editor).

Not covered here: reversed-order multi-session races (deadlock avoidance is argued from
sorted lock order, not exercised), and a Supabase-hosted run (not authorised).

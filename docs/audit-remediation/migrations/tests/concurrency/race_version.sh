#!/bin/bash
# Real database race on the optimistic version check used by the timer route:
#   update display_type_state set timer_version = timer_version + 1 where ... and timer_version = <read>
# Session A reads version 0 and updates it inside an open transaction. Session B, started while
# A is uncommitted, issues the same conditional update with the same read version. B must match
# zero rows once A commits (READ COMMITTED re-evaluates the WHERE on the new row). Throwaway DB only.
# Usage: race_version.sh <db> <event-id>
set -u
DB="$1"; EID="$2"; HOLD="${HOLD:-3}"; DELAY="${DELAY:-1}"
P="/opt/homebrew/bin/psql -h ${PGHOST:-$TMPDIR} -p ${PGPORT:-54329} -U postgres -d $DB -X -q -At -v ON_ERROR_STOP=0"
OUT="${OUT:-$TMPDIR}"
UPD="update display_type_state set timer = jsonb_set(timer, '{mode}', '\"countdown\"'), timer_version = timer_version + 1 where event_id='$EID' and display_type='presenter' and timer_version = 0 returning timer_version"
{ echo "begin;"; echo "$UPD;"; echo "select pg_sleep($HOLD);"; echo "commit;"; } | $P > "$OUT/ver_A.out" 2>&1 & PA=$!
sleep "$DELAY"
$P -c "$UPD" > "$OUT/ver_B.out" 2>&1; RB=$(wc -l < "$OUT/ver_B.out" | tr -d ' ')
wait $PA
echo "--- session A (first writer, version 0 -> 1) output:"; cat "$OUT/ver_A.out" | grep -v "^$" | tail -2
echo "--- session B (same read version 0) rows returned: $(grep -c . "$OUT/ver_B.out" 2>/dev/null)"; cat "$OUT/ver_B.out" | grep -v "^$" | tail -2
echo "--- stored version and mode after both:"; $P -c "select timer_version, timer->>'mode' from display_type_state where event_id='$EID' and display_type='presenter'"

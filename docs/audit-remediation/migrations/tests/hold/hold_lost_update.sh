#!/bin/bash
# Lost-update reproduction for hold deactivation (B009 KF-031). Two real psql sessions on a
# THROWAWAY database. Session A is the route's deactivation: read current hold, then write
# {...current, active:false, activatedAt:null} as a separate statement (the route's
# read-then-write). Session B is an activation with a NEW message, committed while A is
# between read and write. Mode "rmw" = the route's current behaviour. Mode "cas" = the
# corrected conditional write (compare on the activatedAt witness; retry on zero rows).
set -u
DB="$1"; MODE="${2:-rmw}"; HOLD="${HOLD:-3}"; DELAY="${DELAY:-1}"
P="/opt/homebrew/bin/psql -h $TMPDIR -p 54329 -U postgres -d $DB -X -q -At -v ON_ERROR_STOP=1"
EV=00000000-0000-0000-0000-00000000000a
$P -c "update display_type_state set hold='{\"active\":true,\"message\":\"M1\",\"activatedAt\":\"2026-10-04T10:00:00Z\"}' where event_id='$EV' and display_type='presenter'" >/dev/null
if [ "$MODE" = "rmw" ]; then
  {
    echo "begin;"
    # The route reads the hold in one statement, then writes the merged object it holds
    # in application memory. \gset captures the stale read; the write embeds that value.
    echo "select hold::text as cur_hold from display_type_state where event_id='$EV' and display_type='presenter' \\gset"
    echo "select pg_sleep($HOLD);"
    echo "update display_type_state set hold = (:'cur_hold')::jsonb || '{\"active\":false,\"activatedAt\":null}'::jsonb where event_id='$EV' and display_type='presenter';"
    echo "commit;"
  } | $P > "$TMPDIR/lu_A.out" 2>&1 &
  PA=$!
else
  # Corrected (cas): read the hold, merge, write ONLY if the activatedAt witness is unchanged.
  # Zero rows = a concurrent change: re-read and retry (bounded to 3 attempts), as the route does.
  {
    echo "begin;"
    echo "do \$\$ declare cur jsonb; n int := 0; wrote int; begin"
    echo "  loop"
    echo "    n := n + 1;"
    echo "    select hold into cur from display_type_state where event_id='$EV' and display_type='presenter';"
    echo "    if n = 1 then perform pg_sleep($HOLD); end if;"
    echo "    update display_type_state set hold = cur || '{\"active\":false,\"activatedAt\":null}'::jsonb"
    echo "      where event_id='$EV' and display_type='presenter' and hold->>'activatedAt' is not distinct from cur->>'activatedAt';"
    echo "    get diagnostics wrote = row_count;"
    echo "    raise notice 'attempt % wrote %', n, wrote;"
    echo "    exit when wrote = 1 or n >= 3;"
    echo "  end loop;"
    echo "end \$\$;"
    echo "commit;"
  } | $P > "$TMPDIR/lu_A.out" 2>&1 &
  PA=$!
fi
sleep "$DELAY"
# Session B: activation with a new message, committed.
echo "update display_type_state set hold='{\"active\":true,\"message\":\"M2\",\"activatedAt\":\"2026-10-04T10:05:00Z\"}' where event_id='$EV' and display_type='presenter';" | $P > "$TMPDIR/lu_B.out" 2>&1
RB=$?
wait $PA; RA=$?
echo "mode=$MODE A_exit=$RA B_exit=$RB"
echo "final hold: $($P -c "select hold::text from display_type_state where event_id='$EV' and display_type='presenter'")"

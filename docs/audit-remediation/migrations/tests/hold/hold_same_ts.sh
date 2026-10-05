#!/bin/bash
# Same-timestamp conflict on local Postgres (B009 KF-031). Two real psql sessions, disposable DB.
# Hold M1 (rev r1, activatedAt T). Session A deactivates from a stale read. Session B commits an
# activation M2 (rev r2) with the SAME activatedAt T while A is between read and write.
# Mode "ts"  = witness is activatedAt only (previous route; legacy rows).
# Mode "rev" = witness is hold->>rev (current route for new activations).
set -u
DB="$1"; MODE="${2:-rev}"; HOLD="${HOLD:-3}"; DELAY="${DELAY:-1}"
P="/opt/homebrew/bin/psql -h $TMPDIR -p 54329 -U postgres -d $DB -X -q -At -v ON_ERROR_STOP=1"
EV=00000000-0000-0000-0000-00000000000a
T=2026-10-04T10:00:00.000Z
if [ "$MODE" = "ts" ]; then KEY=activatedAt; else KEY=rev; fi
$P -c "update display_type_state set hold='{\"active\":true,\"message\":\"M1\",\"activatedAt\":\"$T\",\"rev\":\"r1\"}' where event_id='$EV' and display_type='presenter'" >/dev/null
SQL_A="$TMPDIR/same_ts_A.sql"
cat > "$SQL_A" <<'SQL'
begin;
select hold::text as cur_hold from display_type_state where event_id='EVENT_ID' and display_type='presenter' \gset
select pg_sleep(HOLD_SECS);
update display_type_state
   set hold = (:'cur_hold')::jsonb || '{"active":false,"activatedAt":null,"rev":null}'::jsonb
 where event_id='EVENT_ID' and display_type='presenter'
   and hold->>'WITNESS_KEY' is not distinct from ((:'cur_hold')::jsonb->>'WITNESS_KEY');
commit;
SQL
sed -i.bak -e "s/EVENT_ID/$EV/g" -e "s/HOLD_SECS/$HOLD/g" -e "s/WITNESS_KEY/$KEY/g" "$SQL_A"
$P -f "$SQL_A" > "$TMPDIR/same_ts_A.out" 2>&1 &
PA=$!
sleep "$DELAY"
$P -c "update display_type_state set hold='{\"active\":true,\"message\":\"M2\",\"activatedAt\":\"$T\",\"rev\":\"r2\"}' where event_id='$EV' and display_type='presenter'" > "$TMPDIR/same_ts_B.out" 2>&1
RB=$?
wait $PA; RA=$?
echo "mode=$MODE witness=$KEY A_exit=$RA B_exit=$RB"
grep -E "^UPDATE" "$TMPDIR/same_ts_A.out" | head -1
echo "final hold: $($P -c "select hold::text from display_type_state where event_id='$EV' and display_type='presenter'")"

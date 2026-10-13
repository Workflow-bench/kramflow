#!/bin/bash
# Two concurrent imports into the SAME event. A holds its transaction; B starts while A is
# uncommitted. Expected: B waits, then replaces A's rows completely; no interleaving, no
# leftover A rows. Throwaway database only. Usage: race_same_event.sh <db> <event-name>
set -u
DB="$1"; EV="$2"; HOLD="${HOLD:-3}"; DELAY="${DELAY:-1}"
P="/opt/homebrew/bin/psql -h ${PGHOST:-$TMPDIR} -p ${PGPORT:-54329} -U postgres -d $DB -X -q -At -v ON_ERROR_STOP=1"
OUT="${OUT:-$TMPDIR}"
EID=$($P -c "select id from events where name='$EV'"); OWN=$($P -c "select owner_id from events where name='$EV'")
prog() { # $1 = label, $2 = count
  local out="[" ; for i in $(seq 1 $2); do [ $i -gt 1 ] && out+=","; out+="{\"sort_order\":$i,\"session_id\":\"sat-am\",\"partition_id\":null,\"section_label\":null,\"type\":\"item\",\"name\":\"$1-$i\",\"description\":null,\"presenter\":null,\"presenter_requirement\":null,\"presenter_contact\":null,\"duration\":5,\"start_time\":null,\"end_time\":null,\"audio_mics\":false,\"audio_track\":false,\"video_sidescreen\":null,\"backdrop\":false,\"video_ppt_needed\":false,\"hall_lights\":null,\"stage_lights\":null,\"camera_angle\":null,\"props\":null,\"curtains\":null,\"remarks\":null,\"status\":null,\"color_tag\":null}"; done; echo "$out]"; }
SESS='[{"id":"sat-am","sheet_name":"Sat","event_name":"E","day_label":"Sat","session_label":"AM","sort_order":0}]'
A_PROG=$(prog A 3); B_PROG=$(prog B 2)
{ echo "begin;"; echo "select import_cue_sheet('$EID','$OWN','$SESS'::jsonb,'[]'::jsonb,'$A_PROG'::jsonb);"; echo "select pg_sleep($HOLD);"; echo "commit;"; } | $P > "$OUT/same_A.out" 2>&1 & PA=$!
sleep "$DELAY"
{ echo "select import_cue_sheet('$EID','$OWN','$SESS'::jsonb,'[]'::jsonb,'$B_PROG'::jsonb);"; } | $P > "$OUT/same_B.out" 2>&1; RB=$?
wait $PA; RA=$?
echo "A_exit=$RA B_exit=$RB"
echo "--- stored programs for event (name, session, sort_order):"
$P -c "select name, session_id, sort_order from programs where event_id='$EID' order by sort_order"
echo "--- rows with A-prefixed names after B committed (must be 0): $($P -c "select count(*) from programs where event_id='$EID' and name like 'A-%'")"

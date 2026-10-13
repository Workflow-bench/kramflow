#!/bin/bash
# Real two-connection race for the first import of one workbook into two events.
# Session A opens a transaction, imports, and holds it open for HOLD seconds.
# Session B starts after DELAY seconds, while A is still uncommitted.
# Run against a THROWAWAY database only. Usage: race_first_import.sh <dbname>
set -u
DB="$1"; HOLD="${HOLD:-3}"; DELAY="${DELAY:-1}"
P="/opt/homebrew/bin/psql -h ${PGHOST:-$TMPDIR} -p ${PGPORT:-54329} -U postgres -d $DB -X -q -v ON_ERROR_STOP=1"
OUT="${OUT:-$TMPDIR}"
SESSIONS='[{"id":"sat-am","sheet_name":"Sat","event_name":"E","day_label":"Sat","session_label":"AM","sort_order":0}]'
PROGRAMS='[{"sort_order":1,"session_id":"sat-am","partition_id":null,"section_label":null,"type":"item","name":"Opening","description":null,"presenter":null,"presenter_requirement":null,"presenter_contact":null,"duration":5,"start_time":null,"end_time":null,"audio_mics":false,"audio_track":false,"video_sidescreen":null,"backdrop":false,"video_ppt_needed":false,"hall_lights":null,"stage_lights":null,"camera_angle":null,"props":null,"curtains":null,"remarks":null,"status":null,"color_tag":null}]'
A_ID=$($P -At -c "select id from events where name='race-A'")
B_ID=$($P -At -c "select id from events where name='race-B'")
A_OWNER=$($P -At -c "select owner_id from events where name='race-A'")
B_OWNER=$($P -At -c "select owner_id from events where name='race-B'")
{ echo "begin;"; echo "select import_cue_sheet('$A_ID','$A_OWNER','$SESSIONS'::jsonb,'[]'::jsonb,'$PROGRAMS'::jsonb);"; echo "select pg_sleep($HOLD);"; echo "commit;"; } | $P > "$OUT/race_A.out" 2>&1 &
PA=$!
sleep "$DELAY"
{ echo "select import_cue_sheet('$B_ID','$B_OWNER','$SESSIONS'::jsonb,'[]'::jsonb,'$PROGRAMS'::jsonb);"; } | $P > "$OUT/race_B.out" 2>&1
RB=$?
wait $PA; RA=$?
echo "A_exit=$RA B_exit=$RB"
echo "--- A:"; cat "$OUT/race_A.out" | tail -3
echo "--- B:"; cat "$OUT/race_B.out" | tail -3
echo "--- sessions after race:"
$P -At -c "select event_id, id from sessions order by 1,2"

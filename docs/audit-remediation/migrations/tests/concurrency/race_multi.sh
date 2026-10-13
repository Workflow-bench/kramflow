#!/bin/bash
# Two concurrent first imports with explicit session lists. Session A holds its
# transaction for HOLD seconds; session B starts DELAY seconds later, while A is
# uncommitted. Throwaway database only. Usage:
#   race_multi.sh <db> "<A session ids>" "<B session ids>" [B_FAIL=1]
# A and B each get one item per session id. B_FAIL=1 makes B reference a foreign
# session, so B must roll back completely.
set -u
DB="$1"; A_IDS="$2"; B_IDS="$3"; B_FAIL="${B_FAIL:-0}"
HOLD="${HOLD:-3}"; DELAY="${DELAY:-1}"
P="/opt/homebrew/bin/psql -h ${PGHOST:-$TMPDIR} -p ${PGPORT:-54329} -U postgres -d $DB -X -q -At -v ON_ERROR_STOP=1"
json_sessions() { local out="["; local first=1; for id in $1; do [ $first -eq 0 ] && out+=","; first=0; out+="{\"id\":\"$id\",\"sheet_name\":\"Sheet1\",\"event_name\":\"E\",\"day_label\":\"Day\",\"session_label\":\"$id\",\"sort_order\":0}"; done; echo "$out]"; }
json_programs() { local out="["; local first=1; local ord=1; for id in $1; do [ $first -eq 0 ] && out+=","; first=0; out+="{\"sort_order\":1,\"session_id\":\"$id\",\"partition_id\":null,\"section_label\":null,\"type\":\"item\",\"name\":\"item-$id\",\"description\":null,\"presenter\":null,\"presenter_requirement\":null,\"presenter_contact\":null,\"duration\":5,\"start_time\":null,\"end_time\":null,\"audio_mics\":false,\"audio_track\":false,\"video_sidescreen\":null,\"backdrop\":false,\"video_ppt_needed\":false,\"hall_lights\":null,\"stage_lights\":null,\"camera_angle\":null,\"props\":null,\"curtains\":null,\"remarks\":null,\"status\":null,\"color_tag\":null}"; done; echo "$out]"; }
A_SESS=$(json_sessions "$A_IDS"); A_PROG=$(json_programs "$A_IDS")
B_SESS=$(json_sessions "$B_IDS"); B_PROG=$(json_programs "$B_IDS")
if [ "$B_FAIL" = "1" ]; then B_PROG="${B_PROG%]},{\"sort_order\":2,\"session_id\":\"no-such-session\",\"partition_id\":null,\"section_label\":null,\"type\":\"item\",\"name\":\"bad\",\"description\":null,\"presenter\":null,\"presenter_requirement\":null,\"presenter_contact\":null,\"duration\":5,\"start_time\":null,\"end_time\":null,\"audio_mics\":false,\"audio_track\":false,\"video_sidescreen\":null,\"backdrop\":false,\"video_ppt_needed\":false,\"hall_lights\":null,\"stage_lights\":null,\"camera_angle\":null,\"props\":null,\"curtains\":null,\"remarks\":null,\"status\":null,\"color_tag\":null}]"; fi
A_ID=$($P -c "select id from events where name='race-A'"); A_OWN=$($P -c "select owner_id from events where name='race-A'")
B_ID=$($P -c "select id from events where name='race-B'"); B_OWN=$($P -c "select owner_id from events where name='race-B'")
OUT="${OUT:-$TMPDIR}"
{ echo "begin;"; echo "select import_cue_sheet('$A_ID','$A_OWN','$A_SESS'::jsonb,'[]'::jsonb,'$A_PROG'::jsonb);"; echo "select pg_sleep($HOLD);"; echo "commit;"; } | $P > "$OUT/multi_A.out" 2>&1 & PA=$!
sleep "$DELAY"
{ echo "select import_cue_sheet('$B_ID','$B_OWN','$B_SESS'::jsonb,'[]'::jsonb,'$B_PROG'::jsonb);"; } | $P > "$OUT/multi_B.out" 2>&1; RB=$?
wait $PA; RA=$?
echo "A_exit=$RA B_exit=$RB"
echo "--- stored sessions by event (event, session id, items):"
$P -c "select e.name, s.id, (select count(*) from programs p where p.session_id=s.id and p.event_id=e.id) from sessions s join events e on e.id=s.event_id order by 1,2"
echo "--- cross-tenant rows (must be 0): $($P -c "select count(*) from programs p join events e on e.id=p.event_id join sessions s on s.id=p.session_id and s.event_id<>p.event_id")"

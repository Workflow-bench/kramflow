#!/bin/bash
set -u
cd /Users/deeppatel/Documents/AI/Shibir/stageflow
C=docs/audit-remediation/migrations/tests/concurrency
M=supabase/migrations/20260930000000_import_cue_sheet_atomic.sql
export OUT=$TMPDIR
setup() {
  local db=$1
  /opt/homebrew/bin/psql -h $TMPDIR -p 54329 -U postgres -X -q -d postgres -c "drop database if exists $db" -c "create database $db" >/dev/null 2>&1
  for f in $C/schema_mirror.sql $M $C/seed_race.sql $C/display_type_state_mirror.sql $C/seed_dts.sql; do
    /opt/homebrew/bin/psql -h $TMPDIR -p 54329 -U postgres -X -q -v ON_ERROR_STOP=1 -d $db -f $f >/dev/null 2>&1 || echo "SETUP_FAIL $f"
  done
}
setup b9_r_first; echo "== FIRST IMPORT"; bash $C/race_first_import.sh b9_r_first 2>&1 | grep -E "A_exit|sat-am" 
setup b9_r_same;  echo "== SAME EVENT"; bash $C/race_same_event.sh b9_r_same race-A 2>&1 | grep -E "exit|rows with|B-"
setup b9_r_ver;   echo "== VERSION"; EID=$(/opt/homebrew/bin/psql -h $TMPDIR -p 54329 -U postgres -X -At -d b9_r_ver -c "select id from events where name='race-A'"); bash $C/race_version.sh b9_r_ver "$EID" 2>&1 | grep -E "rows returned|countdown|\|" | head -4
setup b9_r_multi; echo "== MULTI OK"; bash $C/race_multi.sh b9_r_multi "sat-am sat-pm" "sat-am sat-pm" 2>&1 | grep -E "exit|cross|race-"
setup b9_r_multi2; echo "== MULTI B_FAIL"; B_FAIL=1 bash $C/race_multi.sh b9_r_multi2 "sat-am" "sat-am" 2>&1 | grep -E "exit|cross|race-"

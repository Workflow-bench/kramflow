# Roadmap

```text
MVP (single event, 6 real sessions, bundled cue sheet)
  ↓
Supabase Realtime (replace localStorage/BroadcastChannel sync)      ✅ done
  ↓
Generic cue sheet import (any file, not just this one)              ✅ done
  ↓
Real auth + multiple events (any operator, their own event(s))      ✅ done
  ↓
Phone Companion
  ↓
Volunteer Check-in
  ↓
QR Join
  ↓
Automatic Cue Timing
  ↓
Analytics
```

Multi-day/multi-session support landed in the MVP itself, ahead of the
original plan — the real cue sheet already spans three days and six
sessions, so the operator's session switcher was required from day one
rather than a later increment.

## Done: Supabase + dynamic cue sheet

Reference data (`sessions`/`programs`) and live state now live in Supabase
Postgres, synced via Realtime — see `docs/ARCHITECTURE.md` and
`docs/DATA_MODEL.md`. The cue sheet is dynamic: re-upload an `.xlsx` from
`/operator/cue-sheet` at any time, or add/edit individual items via a
form, both validated against one shared schema
(`lib/validation/program.ts`). `npm run seed` remains for the initial
load from `data/cue-sheet.xlsx` against a fresh project.

Still pending before treating this as fully proven: live end-to-end
verification against a real Supabase project (see
`docs/DEPLOYMENT.md`'s "What production-ready means" section) — the code
path is exercised by `tsc`/`lint`/`build` but not yet by an actual
seed → cross-device sync → upload run.

"Multiple Events" above is now the more accurate next step for
"generic cue sheet import" to build on — today's schema still assumes one
event with several sessions, not several independent events.

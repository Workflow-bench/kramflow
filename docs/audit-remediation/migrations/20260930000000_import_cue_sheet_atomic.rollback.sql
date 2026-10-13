-- Rollback for supabase/migrations/20260930000000_import_cue_sheet_atomic.sql.
-- Removes only the new function. The route falls back to the previous two-step
-- path only if the code is also reverted.
-- do NOT run this rollback while the new route is deployed, or imports fail. Revert the Lane C commit first.
drop function if exists public.import_cue_sheet(uuid, uuid, jsonb, jsonb, jsonb);

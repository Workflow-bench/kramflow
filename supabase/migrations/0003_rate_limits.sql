-- Moves lib/server/rate-limit.ts off its in-memory Map (resets on restart,
-- doesn't share state across serverless instances — a real gap called out
-- in docs/DEPLOYMENT.md) onto this table, with the increment/lockout logic
-- done atomically in a single RPC rather than a read-then-write from the
-- app layer (the actual reason this needs to be server-side, not just
-- persistence: two concurrent failed-login requests racing a
-- read-modify-write in application code could both read "not locked yet"
-- and both write a stale failure count).
--
-- No RLS needed — this table is never read or written by anything except
-- the service-role-authenticated check_and_record_rate_limit RPC below,
-- called from lib/server/rate-limit.ts's server-only code. Explicitly
-- revoke default PUBLIC/anon/authenticated execute on the function so a
-- client can't invalidate another IP's rate-limit state by calling it
-- directly with an arbitrary bucket/ip.

begin;

create table if not exists rate_limit_attempts (
  bucket text not null,
  ip text not null,
  failures integer not null default 0,
  locked_until timestamptz,
  lockout_ms integer not null default 30000,
  updated_at timestamptz not null default now(),
  primary key (bucket, ip)
);

create or replace function check_and_record_rate_limit(
  p_bucket text,
  p_ip text,
  p_success boolean,
  p_threshold integer,
  p_base_lockout_ms integer,
  p_max_lockout_ms integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row rate_limit_attempts;
  v_now timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtext(p_bucket || ':' || p_ip));

  select * into v_row from rate_limit_attempts where bucket = p_bucket and ip = p_ip;

  if v_row.locked_until is not null and v_row.locked_until > v_now then
    return query select false, ceil(extract(epoch from (v_row.locked_until - v_now)))::integer;
    return;
  end if;

  if p_success then
    delete from rate_limit_attempts where bucket = p_bucket and ip = p_ip;
    return query select true, 0;
    return;
  end if;

  if v_row.bucket is null then
    insert into rate_limit_attempts (bucket, ip, failures, lockout_ms, updated_at)
    values (p_bucket, p_ip, 1, p_base_lockout_ms, v_now);
    return query select true, 0;
    return;
  end if;

  if v_row.failures + 1 >= p_threshold then
    update rate_limit_attempts
    set failures = 0,
        locked_until = v_now + (v_row.lockout_ms || ' milliseconds')::interval,
        lockout_ms = least(v_row.lockout_ms * 2, p_max_lockout_ms),
        updated_at = v_now
    where bucket = p_bucket and ip = p_ip;
    return query select false, ceil(v_row.lockout_ms / 1000.0)::integer;
    return;
  end if;

  update rate_limit_attempts
  set failures = v_row.failures + 1, updated_at = v_now
  where bucket = p_bucket and ip = p_ip;
  return query select true, 0;
end;
$$;

revoke all on function check_and_record_rate_limit(text, text, boolean, integer, integer, integer) from public;
revoke all on function check_and_record_rate_limit(text, text, boolean, integer, integer, integer) from anon;
revoke all on function check_and_record_rate_limit(text, text, boolean, integer, integer, integer) from authenticated;
grant execute on function check_and_record_rate_limit(text, text, boolean, integer, integer, integer) to service_role;

revoke all on rate_limit_attempts from public;
revoke all on rate_limit_attempts from anon;
revoke all on rate_limit_attempts from authenticated;
grant all on rate_limit_attempts to service_role;

alter table rate_limit_attempts enable row level security;

commit;

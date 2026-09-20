-- Six-digit TV code for the existing Share Display Link.
--
-- The code is one more way to reach the SAME share_links row a URL/QR
-- already reaches: /tv resolves it server-side (app/api/tv/connect) to the
-- share, then hands the TV the normal /screens?token=... path. Validity
-- (revoked_at / expires_at) is deliberately NOT duplicated here: revoking or
-- expiring the share is the only thing that ever invalidates the code.
--
-- Purely additive: existing rows, links, QR codes, direct display links,
-- revocation and expiry keep working untouched. Deployed code that predates
-- this migration never reads or writes tv_code.
--
-- Uniqueness: a partial unique index over non-revoked rows, so two live
-- shares can never hold the same code (share creation retries on a
-- collision), while a revoked share frees its code. Expiry cannot appear in
-- an index predicate (now() is not immutable), so an expired-but-unrevoked
-- share keeps holding its code, which is conservative and safe.

begin;

alter table share_links add column if not exists tv_code text;

alter table share_links drop constraint if exists share_links_tv_code_format;
alter table share_links
  add constraint share_links_tv_code_format check (tv_code is null or tv_code ~ '^[0-9]{6}$');

create unique index if not exists share_links_tv_code_active_idx
  on share_links (tv_code)
  where revoked_at is null and tv_code is not null;

-- Backfill currently-active shares only (not revoked, not expired). Revoked
-- and expired rows stay null so they can never resolve and never occupy the
-- code space. gen_random_uuid() draws from the server CSPRNG; 32 bits mod
-- 1,000,000 has negligible bias for this purpose. Collisions are caught by
-- the unique index above and retried.
do $$
declare
  r record;
  v_code text;
  v_attempts integer;
begin
  for r in
    select id from share_links
    where tv_code is null and revoked_at is null and expires_at > now()
  loop
    v_attempts := 0;
    loop
      v_attempts := v_attempts + 1;
      v_code := lpad(
        (((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000))::text,
        6,
        '0'
      );
      begin
        update share_links set tv_code = v_code where id = r.id;
        exit;
      exception when unique_violation then
        if v_attempts >= 25 then
          raise;
        end if;
      end;
    end loop;
  end loop;
end $$;

-- Undo one reserved attempt for /api/tv/connect's rate limiter.
--
-- The limiter reserves an attempt atomically BEFORE resolving a code (so a
-- burst of parallel guesses cannot all slip past a read-then-write check),
-- and gives that one attempt back only when the code was valid, so several
-- TVs behind one venue NAT connecting successfully do not lock each other
-- out. This deliberately decrements by one instead of deleting the row the
-- way a success does in check_and_record_rate_limit: a valid code must not
-- be able to reset the failure counter for someone alternating it with wrong
-- guesses.
create or replace function refund_rate_limit_attempt(p_bucket text, p_ip text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext(p_bucket || ':' || p_ip));
  update rate_limit_attempts
  set failures = greatest(failures - 1, 0), updated_at = now()
  where bucket = p_bucket and ip = p_ip;
end;
$$;

revoke all on function refund_rate_limit_attempt(text, text) from public;
revoke all on function refund_rate_limit_attempt(text, text) from anon;
revoke all on function refund_rate_limit_attempt(text, text) from authenticated;
grant execute on function refund_rate_limit_attempt(text, text) to service_role;

commit;

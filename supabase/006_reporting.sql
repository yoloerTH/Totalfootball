-- What the daily Telegram report runs on.
--
-- WHY THIS FILE EXISTS AT ALL. `public.execute_sql` was created by hand in the
-- SQL editor and never written down, so this repository described a database
-- that could not produce the report in netlify/functions/daily-report.mts. Every
-- query in that function goes through this one RPC; restore the project from
-- these migrations without it and the report fails at the first `select` with a
-- 404 that nobody sees, because a scheduled function's errors go to a log that
-- is only read after somebody notices the messages stopped.
--
-- Running this against the live database is a no-op: it is byte-identical to
-- what is already there (pulled with pg_get_functiondef, 2026-08-14), and the
-- grants below are the ones already in place.
--
-- ── THE SECURITY POSITION, STATED ────────────────────────────────────────────
-- This function runs ARBITRARY SQL as its owner and bypasses RLS entirely. That
-- is only acceptable because of who can call it:
--
--   · it is owned by `postgres` and SECURITY DEFINER, so it runs as postgres
--   · EXECUTE is granted to `service_role` and nothing else
--   · PUBLIC, anon and authenticated are revoked below, so a request carrying
--     the anon key — the one that IS in the browser bundle, see .env.example —
--     is refused by PostgREST with a 401 before a statement is parsed
--   · the only caller is the scheduled function, which holds
--     SUPABASE_SERVICE_ROLE_KEY from Netlify's environment
--
-- The rule that keeps this safe is therefore not in the SQL, it is this: the
-- service-role key never reaches a browser, and no user input is ever
-- concatenated into a query passed to it. Every call site in daily-report.mts
-- is a literal.
--
-- If either of those stops being true, this function must be replaced with
-- purpose-built read-only functions rather than patched.

create or replace function public.execute_sql(query text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
  declare
    result jsonb;
  begin
    execute format('select coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) from (%s) t', query)
      into result;
    return result;
  exception
    when others then
      execute query;
      return jsonb_build_object('status', 'ok');
  end;
  $function$;

revoke all on function public.execute_sql(text) from public, anon, authenticated;
grant execute on function public.execute_sql(text) to service_role;

-- ── The report's own indexes ────────────────────────────────────────────────
-- Every section of the report filters site_events by created_at and then by
-- type, and the clicks and studio sections filter on label as well. The
-- created_at index from 002 already carries most of it; this one keeps the
-- per-type counts off a scan as the table grows, and it is where the report
-- will start to hurt first.
create index if not exists site_events_type_created_idx
  on public.site_events (type, created_at desc);

-- Shared-system pageviews are counted by path, which is now a single value
-- ('/s/:id', normalised in netlify/functions/track.mts) rather than one path per
-- share, so this partial index stays small no matter how many links exist.
create index if not exists site_events_share_views_idx
  on public.site_events (created_at desc)
  where type = 'pageview' and path = '/s/:id';

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Rows written before the collector started normalising still carry one path
-- per share, so "shared links opened" would ignore every visit up to today and
-- "most read" keeps a handful of strangers' ids in it. This brings the old rows
-- into the same shape, moving each id to `label` exactly as the function now
-- does, and touching nothing else.
--
-- It is written to be safe to run twice: the WHERE clause cannot match a row it
-- has already rewritten.
update public.site_events
   set label = coalesce(label, 'share:' || substring(path from '^/s/([0-9a-hjkmnp-tv-z]{6,16})/?$')),
       path  = '/s/:id'
 where path ~ '^/s/[0-9a-hjkmnp-tv-z]{6,16}/?$';

-- Studio-welcome webhook trigger.
--
-- This creates the Database Webhook that fires netlify/functions/studio-welcome.mts
-- the moment a user's email is confirmed (Google OAuth = on INSERT, email/password
-- = on UPDATE when email_confirmed_at goes from null to a timestamp).
--
-- ── PREREQUISITES ─────────────────────────────────────────────────────────────
--
-- 1. The `pg_net` extension must be enabled (it is on all Supabase projects).
-- 2. The `supabase_functions` schema must exist (it does on all Supabase projects).
-- 3. Set SUPABASE_WEBHOOK_SECRET in Netlify's UI before deploying — the value
--    is already stored in .env locally and must match the header below.
--
-- ── HOW TO APPLY ──────────────────────────────────────────────────────────────
--
-- Option A  — Supabase Dashboard (no token needed)
--   Dashboard → SQL Editor → paste this file → Run
--
-- Option B  — Supabase CLI (requires a personal access token)
--   supabase login
--   supabase db execute --project-ref bewvowkkikxsjcfnkeot < supabase/011_studio_welcome_webhook.sql
--
-- Option C  — Management API (one-liner, token required)
--   See docs/STUDIO.md §7 for the full command.
--
-- The trigger is IDEMPOTENT: re-running this file drops and recreates it, so
-- applying it twice is safe. The net_request_id returned by the async call is
-- discarded by design — the return value of a TRIGGER function is only ever
-- NEW or NULL, not the pg_net result.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The trigger function ───────────────────────────────────────────────────
--
-- Written in plain SQL (not plpgsql) so the body is easy to read and the only
-- moving part — the x-webhook-secret header value — is obvious at a glance.
-- The secret is baked in at DDL time, which is fine: it is already in the
-- Netlify env and the local .env, so rotating it means updating both sides and
-- re-running this file with the new value.

create or replace function public.studio_welcome_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _body  jsonb;
  _old   jsonb;
begin
  -- Build the same payload shape Supabase's own Database Webhooks produce,
  -- so studio-welcome.mts can be tested with the same format either way.
  _old  := case when TG_OP = 'INSERT' then 'null'::jsonb else to_jsonb(OLD) end;
  _body := jsonb_build_object(
    'type',       TG_OP,
    'table',      TG_TABLE_NAME,
    'schema',     TG_TABLE_SCHEMA,
    'record',     to_jsonb(NEW),
    'old_record', _old
  );

  -- pg_net performs the HTTP call asynchronously; the trigger returns
  -- immediately without waiting for the response.
  perform net.http_post(
    url     := 'https://totalfootball.naurra.ai/api/studio-welcome',
    headers := jsonb_build_object(
      'Content-Type',      'application/json',
      'x-webhook-secret',  '16b7e39f0a0d54311abcb898781a327919a65bab564c4d4ed789d23e1470047c'
    ),
    body    := _body
  );

  return NEW;
end;
$$;

-- ── 2. The trigger ────────────────────────────────────────────────────────────
--
-- Fires AFTER (not BEFORE) so the row is committed and any NOT NULL constraint
-- on email_confirmed_at has already been enforced before we call out. A BEFORE
-- trigger would fire with data that has not yet hit the table — if the INSERT
-- were then rolled back, we'd have sent a welcome for an account that does not
-- exist.
--
-- FOR EACH ROW: webhooks are per-row events, not per-statement.

drop trigger if exists studio_welcome_webhook on auth.users;
create trigger studio_welcome_webhook
  after insert or update on auth.users
  for each row
  execute function public.studio_welcome_webhook();
